import { GoogleGenAI } from '@google/genai';
import type {
  AccessMode,
  BoundingBox,
  CellMicroAnalysisResponse,
  FishingType,
  GridCell,
  RecommendedSpot,
  Season,
  SpotRecommendationResponse,
  TargetSpecies,
  WaterBodyRecord,
  WaterType,
} from '@/shared/types/domain';
import { buildRestrictionOverview } from '@/modules/restrictions/restriction-service';
import {
  buildSpotFinderPrompt,
  computeQueryHash,
} from './prompt-builder';
import { validateSpotRecommendation } from './spot-recommendation.validator';

// Deterministic in-memory cache backing DB cache for $0 token reuse
const gridAnalysisMemoryCache = new Map<string, SpotRecommendationResponse>();
const cellMicroMemoryCache = new Map<string, CellMicroAnalysisResponse>();

const TECHNIQUE_LURE_BAIT_MAP: Record<FishingType, string[]> = {
  spinning: [
    '9–12cm soft paddle-tail shad on 12–18g lead jig head',
    '11cm suspending jerkbait / twitchbait (natural baitfish pattern)',
    '18g metal blade bait / spoon for drop-off search',
  ],
  feeder_bottom: [
    'Method feeder 35g with krill/halibut micro-pellets and 8mm wafter',
    'Open-end cage feeder with sweetcorn, hemp, and red maggots',
  ],
  carp: [
    '20mm fishmeal/krill snowman boilie rig on safety lead clip',
    'PVA mesh bag with crushed boilies and halibut pellets',
  ],
  float: [
    '4g loaded waggler float with double red maggot or sweetcorn on #14 hook',
    'Bolognese slider float worked along the marginal shelf',
  ],
  fly: [
    'Weighted olive/black streamer (#4–#6) on intermediate sinking line',
    'Pheasant Tail nymph (#14) with tungsten bead under indicator',
  ],
  surfcasting: [
    'Long-distance pulley rig with 120g grip lead and whole ragworm/crab bait',
    'Two-hook paternoster with sandeel or bibi worm on fluorocarbon snoods',
  ],
};

export interface RecommendSpotsInput {
  waterBody: WaterBodyRecord;
  sectorBbox: BoundingBox;
  gridCells: GridCell[];
  waterType: WaterType;
  fishingType: FishingType;
  targetSpecies: TargetSpecies[];
  accessMode: AccessMode;
  season: Season;
}

export interface RecommendSpotsOutput {
  queryHash: string;
  cacheHit: boolean;
  recommendation: SpotRecommendationResponse;
}

/**
 * Generates or retrieves cached AI spatial grid spot recommendations.
 * Uses Gemini 2.5 Flash when GEMINI_API_KEY is configured, and falls back to
 * a deterministic hydro-structural grid ranking engine when running offline/in tests.
 */
export async function recommendFishingSpots(
  input: RecommendSpotsInput
): Promise<RecommendSpotsOutput> {
  const normalizedSpecies: TargetSpecies[] =
    input.targetSpecies.length > 0 ? input.targetSpecies : ['any'];

  const queryHash = computeQueryHash({
    waterBodyId: input.waterBody.id,
    sectorBbox: input.sectorBbox,
    waterType: input.waterType,
    fishingType: input.fishingType,
    targetSpecies: normalizedSpecies,
    accessMode: input.accessMode,
    season: input.season,
  });

  const cached = gridAnalysisMemoryCache.get(queryHash);
  if (cached) {
    return {
      queryHash,
      cacheHit: true,
      recommendation: cached,
    };
  }

  const prompt = buildSpotFinderPrompt({
    ...input,
    targetSpecies: normalizedSpecies,
  });

  let recommendation: SpotRecommendationResponse | null = null;

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your-gemini-api-key') {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt.userPrompt,
        config: {
          systemInstruction: prompt.systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      if (response.text) {
        const parsedJson = JSON.parse(response.text);
        const validation = validateSpotRecommendation(
          parsedJson,
          input.gridCells,
          input.accessMode
        );
        if (validation.valid) {
          recommendation = parsedJson as SpotRecommendationResponse;
        }
      }
    } catch {
      // Fall back to deterministic structural advisor if API quota or network fails
    }
  }

  if (!recommendation) {
    recommendation = buildDeterministicGridRecommendation({
      ...input,
      targetSpecies: normalizedSpecies,
    });
  }

  gridAnalysisMemoryCache.set(queryHash, recommendation);

  return {
    queryHash,
    cacheHit: false,
    recommendation,
  };
}

/**
 * Deterministic structural grid ranker that combines pre-seeded spot knowledge with
 * candidate grid cell hydro-morphology, guaranteeing 100% schema & boundary compliance.
 */
function buildDeterministicGridRecommendation(
  input: RecommendSpotsInput
): SpotRecommendationResponse {
  const restrictionOverview = buildRestrictionOverview({
    waterBody: input.waterBody,
    targetSpecies: input.targetSpecies,
  });

  // Filter eligible cells: never recommend prohibited cells, and enforce shore accessibility when accessMode === 'shore'
  const eligibleCells = input.gridCells.filter((cell) => {
    if (cell.restrictionStatus === 'prohibited') return false;
    if (input.accessMode === 'shore' && !cell.shoreAccessible) return false;
    return true;
  });

  // Score cells based on pre-seeded spot presence, community reviews, and structural features
  const scoredCells = eligibleCells.map((cell) => {
    let score = 74;
    const preSeeded = input.waterBody.preSeededSpots.find(
      (s) => s.cell_id === cell.cellId
    );
    if (preSeeded) score += 18;
    if (cell.zoneType === 'inflow_outflow') score += 8;
    if (cell.zoneType === 'structure') score += 6;
    if (cell.features.includes('channel_drop_off')) score += 7;
    if (cell.features.includes('reed_bed')) score += 5;

    return {
      cell,
      preSeeded,
      score: Math.min(98, score),
    };
  });

  scoredCells.sort((a, b) => b.score - a.score);
  const topCandidates = scoredCells.slice(0, 6);

  const speciesLabels =
    input.targetSpecies.includes('any') || input.targetSpecies.length === 0
      ? input.waterBody.commonSpecies.slice(0, 3)
      : input.targetSpecies;

  const recommendedSpots: RecommendedSpot[] = topCandidates.map(
    ({ cell, preSeeded, score }, idx) => {
      const rank = idx + 1;
      const safeRestriction =
        cell.restrictionStatus === 'prohibited'
          ? 'permit_required'
          : cell.restrictionStatus;

      const luresOrBaits =
        preSeeded?.tactical_advice.recommended_baits_or_lures ??
        TECHNIQUE_LURE_BAIT_MAP[input.fishingType];

      const defaultCategory =
        rank <= 2
          ? 'primary_hot'
          : rank === 3 || rank === 4
            ? 'shore_cove'
            : 'structure_ledge';

      return {
        id: preSeeded?.id ?? `spot-${input.waterBody.id}-${cell.cellId.toLowerCase()}`,
        rank,
        cell_id: cell.cellId,
        coordinates: preSeeded?.coordinates ?? cell.center,
        title:
          preSeeded?.title ??
          `Cell ${cell.cellId} — ${formatFeaturesTitle(cell.features)}`,
        confidence_score: score,
        spot_category: preSeeded?.spot_category ?? defaultCategory,
        feature_tags:
          preSeeded?.feature_tags ??
          cell.features.map((f) =>
            f
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')
          ),
        why_this_spot:
          preSeeded?.why_this_spot ??
          `Grid cell ${cell.cellId} features ${cell.features.map((f) => f.replace(/_/g, ' ')).join(', ')} (${cell.zoneType.replace(/_/g, ' ')}), creating a prime holding and feeding lane for ${speciesLabels.join(', ')} during ${input.season} when angling from the ${input.accessMode}.`,
        tactical_advice: {
          recommended_baits_or_lures: luresOrBaits,
          presentation_tips:
            preSeeded?.tactical_advice.presentation_tips ??
            `Target the transition seam inside cell ${cell.cellId} (${cell.center.latitude.toFixed(4)}, ${cell.center.longitude.toFixed(4)}) using ${input.fishingType.replace(/_/g, ' ')} tactics with controlled pauses near structure.`,
          best_time_of_day:
            preSeeded?.tactical_advice.best_time_of_day ??
            'First 2 hours after dawn and the golden hour before sunset',
        },
        target_species_fit: speciesLabels,
        restriction_status: safeRestriction,
        avg_rating: preSeeded?.avg_rating ?? input.waterBody.avgRating,
        review_count: preSeeded?.review_count ?? 0,
      };
    }
  );

  return {
    water_body_summary: `${input.waterBody.name} (${input.waterBody.regionLabel}) analyzed for ${input.fishingType.replace(/_/g, ' ')} targeting ${speciesLabels.join(', ')} (${input.accessMode} access, ${input.season}). ${eligibleCells.length} fishable grid cells evaluated; ${input.gridCells.filter((c) => c.restrictionStatus === 'prohibited').length} prohibited reserve/dam cells automatically excluded.`,
    restriction_overview: restrictionOverview,
    recommended_spots: recommendedSpots,
  };
}

function formatFeaturesTitle(features: string[]): string {
  return features
    .slice(0, 2)
    .map((f) =>
      f
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    )
    .join(' & ');
}

export interface AnalyzeSingleCellInput {
  waterBody: WaterBodyRecord;
  cell: GridCell;
  fishingType: FishingType;
  targetSpecies: TargetSpecies[];
  accessMode: AccessMode;
}

/**
 * Level 2 Interaction: On-demand AI micro-analysis when a registered angler clicks any individual grid cell (e.g. D5).
 */
export async function analyzeSingleGridCell(
  input: AnalyzeSingleCellInput
): Promise<CellMicroAnalysisResponse> {
  const cacheKey = `${input.waterBody.id}:${input.cell.cellId}:${input.fishingType}:${input.targetSpecies.sort().join(',')}:${input.accessMode}`;
  const cached = cellMicroMemoryCache.get(cacheKey);
  if (cached) return cached;

  if (input.cell.restrictionStatus === 'prohibited') {
    const prohibitedResult: CellMicroAnalysisResponse = {
      cellId: input.cell.cellId,
      suitabilityScore: 0,
      structuralAnalysis: `PROHIBITED SECTOR: ${input.cell.restrictionReason ?? 'Protected reserve or hydrotechnical safety zone.'}`,
      howToFishThisCell:
        'Do NOT fish inside this grid cell. Move to an adjacent permitted cell outside the exclusion boundary.',
      recommendedBaitsOrLures: [],
      restrictionStatus: 'prohibited',
    };
    cellMicroMemoryCache.set(cacheKey, prohibitedResult);
    return prohibitedResult;
  }

  const preSeeded = input.waterBody.preSeededSpots.find(
    (s) => s.cell_id === input.cell.cellId
  );
  const suitabilityScore = preSeeded ? preSeeded.confidence_score : 78;
  const speciesText =
    input.targetSpecies.length > 0 && !input.targetSpecies.includes('any')
      ? input.targetSpecies.join(', ')
      : input.waterBody.commonSpecies.slice(0, 3).join(', ');

  const result: CellMicroAnalysisResponse = {
    cellId: input.cell.cellId,
    suitabilityScore,
    structuralAnalysis: `Sector ${input.cell.cellId} (${input.cell.center.latitude.toFixed(4)}°N, ${input.cell.center.longitude.toFixed(4)}°E) is classified as a ${input.cell.zoneType.replace(/_/g, ' ')} zone with ${input.cell.features.map((f) => f.replace(/_/g, ' ')).join(', ')}. ${input.cell.shoreAccessible ? 'Directly accessible from the bank/shoreline.' : 'Offshore sector best approached by boat or kayak.'}`,
    howToFishThisCell:
      preSeeded?.tactical_advice.presentation_tips ??
      `Fan-cast across cell ${input.cell.cellId} focusing on the depth and bottom-substrate transition. For ${speciesText} using ${input.fishingType.replace(/_/g, ' ')}, maintain bottom or structure contact and slow down your presentation during mid-day high light.`,
    recommendedBaitsOrLures:
      preSeeded?.tactical_advice.recommended_baits_or_lures ??
      TECHNIQUE_LURE_BAIT_MAP[input.fishingType],
    restrictionStatus: input.cell.restrictionStatus,
  };

  cellMicroMemoryCache.set(cacheKey, result);
  return result;
}
