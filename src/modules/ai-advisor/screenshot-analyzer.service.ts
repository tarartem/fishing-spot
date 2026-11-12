import { GoogleGenAI, Type, type Schema } from '@google/genai';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import turfDistance from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import {
  APP_VERSION,
  formatReportTimestamp,
  generateReportId,
} from '@/shared/app-version';
import {
  computeCompassBearingDeg,
  isDownstreamLeeOfShore,
  isPointInFlowingWater,
  type FlowContext,
} from '@/modules/ai-advisor/flow-direction';
import {
  buildEnrichedGeospatialContext,
  resolveLocalSectorReliefM,
  type EnrichedGeospatialContext,
} from '@/modules/ai-advisor/geospatial-context.service';
import {
  ALL_ANGLER_FEATURE_KEYS,
  getAllowedFeaturesForScale,
} from '@/modules/ai-advisor/scale-utils';
import { isPercentOnRasterWater } from '@/modules/ai-advisor/osm-tile-water-mask';
import {
  IMAGERY_FRESHNESS_NOTE,
  rankAndRateSpots,
} from '@/modules/ai-advisor/spot-rating';
import {
  classifySpotRoadAccess,
  computeShoreMetrics,
  constrainSpotsToWaterMask,
  percentToCellId,
  percentToLngLat,
  sampleDistinctWaterCoordinates,
  type CardinalDirection,
  type WaterGeometryFeature,
} from '@/modules/ai-advisor/water-mask-and-access';
import type {
  AnglerFeatureKey,
  BoundingBox,
  ClientWaterMaskSummary,
  ExtractedSpotFeature,
  GridArtifactSpot,
  SpeciesPresenceInfo,
  SpotAccessMode,
  WaterBodyArtifactAnalysis,
} from '@/shared/types/domain';

export interface AnalyzeWaterBodyScreenshotInput {
  bbox: BoundingBox;
  griddedScreenshotBase64?: string;
  anglerGearNote?: string;
  hintWaterBodyId?: string;
  clientWaterMask?: ClientWaterMaskSummary | null;
}

const SYSTEM_INSTRUCTION = `You are an expert Spanish angling guide, satellite imagery photo-interpreter, topographer, and Spanish fisheries regulation specialist.
You analyze 1024x1024 satellite screenshots overlaid with an 8x8 Coordinate Grid:
- Columns A..H left-to-right: A=0..12.5%, B=12.5..25%, C=25..37.5%, D=37.5..50%, E=50..62.5%, F=62.5..75%, G=75..87.5%, H=87.5..100%.
- Rows 1..8 top-to-bottom: 1=0..12.5%, 2=12.5..25%, 3=25..37.5%, 4=37.5..50%, 5=50..62.5%, 6=62.5..75%, 7=75..87.5%, 8=87.5..100%.

CRITICAL PLACEMENT & ZERO-HALLUCINATION RULES (NO WATER = NO SPOTS):
0. WATER PRESENCE GATE: First inspect the screenshot. If NO fishable river, lake, reservoir, pond, or sea coastline is visibly present in the image (e.g., only mountains, pine forests, fields, dirt roads, or urban buildings), you MUST set has_fishable_water=false, water_coverage_pct=0, explain why in no_water_reason, and return recommended_spots=[], species_present=[], best_game_plan=[]. NEVER invent water structures or place pins on dry land.
1. EVERY pin (x_percent, y_percent) MUST sit directly ON VISIBLE WATER (dark blue, turquoise, green-blue, or submerged shallow shelf within <=10m of water).
2. NEVER place a pin on dry land, hillsides, trees, bushes, dirt roads, or paved roads. Even for road-accessible spots (Rank 3-4), place the pin IN THE WATER right off the accessible shoreline, and describe the parking/road approach in access_summary.
3. ONLY place pins inside the provided ALLOWED_WATER_CELLS list. Never pick a cell from DRY_LAND_FORBIDDEN_CELLS.
4. Match cell_id mathematically to (x_percent, y_percent) using the column/row percentage bands above, and spread spots across distinct water cells without stacking.
5. When water IS present, output 2 to 6 distinct spots (6 when water spans wide areas; 2-5 if water covers only an edge or corner of the crop).
6. Never place a pin on a dam wall (presa), spillway, or restricted exclusion zone.

PRACTICAL REPORT, ENGLISH-ONLY & ACCESS RULES:
7. Write ALL summaries, fish species names, spot titles, terrain/access notes, region names (Spain), and game plan strictly in English. Spanish terms are used ONLY inside the fishing regulation/allowed check, not in the UI report text.
8. Provide a clear species_present roster of fish in this water body (English name, holding habitat/depth, and brief regulation note).
9. For every spot, classify access_mode strictly from the verified OSM road/surface and elevation slope context: car_asphalt, dirt_track, hike_in, or boat_only.
10. Keep spot descriptions crisp, practical, and scannable outdoors on a phone.

SPOT EVALUATION, 12-FEATURE EXTRACTION & ZERO-OVERPROMISING RULES:
11. Scan the water body for the 12 canonical angler features:
    - point, flat, drop_off, channel, shadow, cover, depth_change, weed_line, weed_edge, current_break, bottom_transition, multiple_points.
12. NEVER hallucinate or pad features! Report ONLY features genuinely visible in the screenshot or cleanly supported by shoreline/channel geometry. If a spot shows only 1 or 2 features, report 1 or 2 honestly.
13. Respect scale & visibility limits: ONLY use feature keys listed in ALLOWED_FEATURES_FOR_SCALE. If water is turbid or glared, do not invent submerged weed edges or bottom transitions—note the visibility limit in extraction_limitations.
14. For each feature in extracted_features, set observation_type to "directly_visible" (seen in pixels) or "topographic_inference" (inferred from geometry/slope) and cite a factual visual_cue.
15. Satellite imagery is a historical snapshot; aquatic flora (weed_line, weed_edge) and shadows change seasonally. Frame flora cues as historical reference to verify on site.
16. Write a concise 1-2 sentence rating_justification summarizing which features combine at that spot. Final 1-10 rating and rank order are computed deterministically on the server from extracted_features.`;

const SCREENSHOT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: [
    'has_fishable_water',
    'water_body_name',
    'region_label',
    'water_body_summary',
    'extraction_limitations',
    'screenshot_feature_inventory',
    'species_present',
    'recommended_spots',
    'best_game_plan',
  ],
  properties: {
    has_fishable_water: { type: Type.BOOLEAN },
    water_coverage_pct: { type: Type.NUMBER },
    no_water_reason: { type: Type.STRING },
    water_body_name: { type: Type.STRING },
    region_label: { type: Type.STRING },
    water_body_summary: { type: Type.STRING },
    extraction_limitations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    screenshot_feature_inventory: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        enum: [...ALL_ANGLER_FEATURE_KEYS],
      },
    },
    species_present: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['name', 'habitat_zone', 'recommended_approach'],
        properties: {
          name: { type: Type.STRING },
          habitat_zone: { type: Type.STRING },
          recommended_approach: { type: Type.STRING },
          regulation_note: { type: Type.STRING },
        },
      },
    },
    recommended_spots: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: [
          'rank',
          'color',
          'cell_id',
          'grid_cells_label',
          'title',
          'x_percent',
          'y_percent',
          'target_species',
          'access_mode',
          'access_summary',
          'depth_structure',
          'why_label',
          'why_this_spot',
          'how_to_fish',
          'extracted_features',
          'rating_justification',
          'stacked_x_count',
          'influencing_features',
          'why_rank_summary',
        ],
        properties: {
          rank: { type: Type.INTEGER },
          color: { type: Type.STRING, enum: ['green', 'blue', 'yellow', 'red', 'orange'] },
          cell_id: { type: Type.STRING },
          grid_cells_label: { type: Type.STRING },
          badge: { type: Type.STRING },
          title: { type: Type.STRING },
          x_percent: { type: Type.NUMBER },
          y_percent: { type: Type.NUMBER },
          target_species: { type: Type.ARRAY, items: { type: Type.STRING } },
          access_mode: {
            type: Type.STRING,
            enum: ['car_asphalt', 'dirt_track', 'hike_in', 'boat_only'],
          },
          access_summary: { type: Type.STRING },
          depth_structure: { type: Type.STRING },
          why_label: { type: Type.STRING },
          why_this_spot: { type: Type.STRING },
          secondary_label: { type: Type.STRING },
          secondary_text: { type: Type.STRING },
          how_to_fish: { type: Type.STRING },
          extracted_features: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['feature', 'observation_type', 'visual_cue'],
              properties: {
                feature: {
                  type: Type.STRING,
                  enum: [...ALL_ANGLER_FEATURE_KEYS],
                },
                observation_type: {
                  type: Type.STRING,
                  enum: ['directly_visible', 'topographic_inference'],
                },
                visual_cue: { type: Type.STRING },
              },
            },
          },
          rating_justification: { type: Type.STRING },
          stacked_x_count: { type: Type.INTEGER },
          influencing_features: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          why_rank_summary: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
    best_game_plan: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
};

function enrichSpotWithRoadAccess(
  spot: GridArtifactSpot,
  bbox: BoundingBox,
  geo: EnrichedGeospatialContext
): GridArtifactSpot {
  const [spotLng, spotLat] = percentToLngLat(spot.x_percent, spot.y_percent, bbox);
  const localReliefM = resolveLocalSectorReliefM(
    geo.demSectorSamples,
    spot.x_percent,
    spot.y_percent,
    geo.geographicalContext.relief_range_m
  );
  if (geo.roads.length > 0 || !spot.access_summary) {
    const roadCheck = classifySpotRoadAccess({
      spotLng,
      spotLat,
      roads: geo.roads,
      sectorReliefM: localReliefM,
      fallbackRoadNames: geo.detectedRoads,
    });
    return {
      ...spot,
      access_mode: roadCheck.access_mode,
      access_summary: roadCheck.access_summary,
    };
  }
  return spot;
}

function normalizeAccessMode(raw: unknown): SpotAccessMode {
  if (
    raw === 'car_asphalt' ||
    raw === 'dirt_track' ||
    raw === 'hike_in' ||
    raw === 'boat_only'
  ) {
    return raw;
  }
  return 'hike_in';
}

function normalizeSpeciesList(
  raw: unknown,
  fallback: SpeciesPresenceInfo[]
): SpeciesPresenceInfo[] {
  if (!Array.isArray(raw) || raw.length < 2) return fallback;
  const cleaned = raw
    .filter((item): item is SpeciesPresenceInfo =>
      Boolean(
        item &&
          typeof item === 'object' &&
          'name' in item &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0
      )
    )
    .slice(0, 6)
    .map((item) => ({
      name: item.name.trim(),
      habitat_zone: item.habitat_zone || 'Shoreline shelves & main channel edges',
      recommended_approach:
        item.recommended_approach || 'Spinning lures and soft plastics',
      regulation_note: item.regulation_note,
    }));
  return cleaned.length >= 2 ? cleaned : fallback;
}

function buildNoWaterDetectedResponse(
  geo: EnrichedGeospatialContext,
  customReason?: string
): WaterBodyArtifactAnalysis {
  const coveragePct = geo.rasterWaterMask?.waterCoveragePct ?? 0;
  const reason =
    customReason?.trim() ||
    `No fishable river, lake, reservoir, or coastline was detected inside this captured view (${coveragePct.toFixed(1)}% clustered water across ${geo.regionLabel}). Pan or zoom directly onto visible water and try again.`;

  return {
    report_id: generateReportId(),
    app_version: APP_VERSION,
    generated_at: formatReportTimestamp(),
    has_fishable_water: false,
    water_coverage_pct: coveragePct,
    no_water_reason: reason,
    analysis_source: 'no_water_detected',
    water_body_name: 'No Water Body Detected',
    region_label: geo.regionLabel.replace(/\bEspaña\b/g, 'Spain'),
    water_body_summary: reason,
    imagery_freshness_note: IMAGERY_FRESHNESS_NOTE,
    extraction_limitations: [],
    screenshot_feature_inventory: [],
    species_present: [],
    geographical_context: geo.geographicalContext,
    restriction_check: geo.restrictionCheck,
    recommended_spots: [],
    best_game_plan: [],
  };
}

function computeCardinalPrefix(cell_id: string): string {
  const colLetter = cell_id[0]?.toUpperCase() || 'D';
  const rowNum = parseInt(cell_id.slice(1), 10) || 4;

  const isNorth = rowNum <= 3;
  const isSouth = rowNum >= 6;
  const isWest = colLetter === 'A' || colLetter === 'B' || colLetter === 'C';
  const isEast = colLetter === 'F' || colLetter === 'G' || colLetter === 'H';

  if (isNorth && isWest) return 'Northwest';
  if (isNorth && isEast) return 'Northeast';
  if (isSouth && isWest) return 'Southwest';
  if (isSouth && isEast) return 'Southeast';
  if (isNorth) return 'North';
  if (isSouth) return 'South';
  if (isWest) return 'West';
  if (isEast) return 'East';
  return 'Central';
}

function buildAnglerWhyThisSpot(
  kind: FallbackSpotKind,
  speciesList: string[],
  cardinal: string,
  rank: number,
  inFlowingWater: boolean,
  isDownstreamLee: boolean
): string {
  const speciesPhrase = speciesList.slice(0, 2).join(' and ') || 'target fish';

  switch (kind) {
    case 'channel_narrowing':
      if (inFlowingWater) {
        return `Current velocities compress through this constriction, creating distinct seams and eddy edges where ${speciesPhrase} hold out of the main flow to ambush drifting forage.`;
      }
      if (rank === 1) {
        return `A natural pinch-point funnels cruising fish moving between the quiet northern cove and the main reservoir basin. Cruising ${speciesPhrase} use this bottleneck as an ambush corridor, bringing them within easy casting reach of the shore.`;
      }
      return `The lake contour constricts here into a natural bottleneck between basins. Cruising ${speciesPhrase} funnel through this corridor with moving water and forage, creating a high-percentage ambush window.`;

    case 'shore_point':
      if (inFlowingWater && isDownstreamLee) {
        return `This point extends into the flow, deflecting current and forming a calm slack-water eddy immediately behind the tip where ${speciesPhrase} rest and pick off disoriented prey.`;
      }
      if (rank <= 2) {
        return `A prominent shoreline point projecting into open water breaks the lake contour line. Predatory ${speciesPhrase} use this structure to corral passing schools of baitfish against the shore, providing an expansive casting arc into multiple depth zones.`;
      }
      return `This point juts into open water, deflecting shoreline drift and providing a prime staging drop-off where active ${speciesPhrase} cruise and feed.`;

    case 'sheltered_cove':
      return `Tucked into the shoreline, this cove is completely shielded from main-lake chop and wind. The warmer, calm water provides safe haven for fry and terrestrial insects, drawing active ${speciesPhrase} into the shallows during midday feeding windows.`;

    case 'shallow_margin':
      return `An open, gradual shoreline flat offering consistent shallow feeding grounds. Cruising ${speciesPhrase} patrol parallel to the bank during dawn and dusk low-light feeding windows.`;

    case 'steep_shore':
      return `A steep shoreline transition where the bank drops quickly into deeper water. ${speciesPhrase} cruise directly beneath the bank shade, giving shore anglers immediate access to deep-holding fish without long-distance casting.`;

    case 'open_basin':
    default:
      return `Open-water pelagic zone over deeper basin contours where schools of ${speciesPhrase} suspend and feed on forage moving between main shoreline shelves.`;
  }
}

/**
 * Analyzes the user's captured satellite screenshot + OSM water mask + road surfaces +
 * DEM elevation + Spain fishing restrictions using Gemini Multimodal Vision (`gemini-3.5-flash-lite` primary).
 */
export async function analyzeWaterBodyScreenshot(
  input: AnalyzeWaterBodyScreenshotInput
): Promise<WaterBodyArtifactAnalysis> {
  const geo = await buildEnrichedGeospatialContext(
    input.bbox,
    input.hintWaterBodyId,
    input.clientWaterMask
  );

  // Layer 1 Zero-Hallucination Gate: if verified vector/raster mask confirms zero fishable water,
  // reject immediately before AI vision or fallback can invent spots on dry terrain.
  if (geo.waterCellMask.waterPresence === 'no_water') {
    return buildNoWaterDetectedResponse(geo);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== 'your-gemini-api-key' && input.griddedScreenshotBase64) {
    const ai = new GoogleGenAI({ apiKey });
    const base64Clean = input.griddedScreenshotBase64.replace(
      /^data:image\/\w+;base64,/,
      ''
    );

    const allowedScaleFeatures = getAllowedFeaturesForScale(geo.scaleMode);
    const scaleInstruction =
      geo.scaleMode === 'macro'
        ? `MACRO / WIDE BASIN SCALE (${geo.widthKm} km × ${geo.heightKm} km · ~${geo.metersPerPixel} m/px): Small features (weed lines, weed edges, shadows, shoreline cover, fine bottom transitions) CANNOT be resolved reliably at this resolution. Evaluate ONLY macro structures (${allowedScaleFeatures.join(', ')}).`
        : geo.scaleMode === 'meso'
          ? `SECTOR SCALE (${geo.widthKm} km × ${geo.heightKm} km · ~${geo.metersPerPixel} m/px): Inspect sector peninsulas, bays, channels, and large shelf transitions; mark uncertain fine cover/flora as topographic_inference or omit if not clearly visible.`
          : `OPTIMAL FEATURE SCALE (${geo.widthKm} km × ${geo.heightKm} km · ~${geo.metersPerPixel} m/px): High-detail tactical scale — scan carefully for all 12 features (${allowedScaleFeatures.join(', ')}), reporting ONLY those genuinely supported by imagery or shoreline geometry.`;

    const waterCellsStr =
      geo.waterCellMask.allowedCells.length > 0
        ? geo.waterCellMask.allowedCells.join(', ')
        : 'Inspect screenshot water pixels carefully; place pins ONLY on dark/turquoise water';
    const dryCellsStr =
      geo.waterCellMask.dryLandCells.length > 0
        ? geo.waterCellMask.dryLandCells.join(', ')
        : 'Any cell showing only trees, hills, scrub, or roads';

    const speciesHintStr = geo.speciesPresentDefaults
      .map((s) => s.name)
      .join(', ');

    const promptText = `Analyze this Spanish water body satellite screenshot (Bounding Box [westLng, southLat, eastLng, northLat]: ${JSON.stringify(input.bbox)}).

=== 1. VERIFIED WATER BODY & FISH SPECIES CONTEXT ===
- Recognized Water Body: ${geo.waterBodyName}
- Region & Autonomous Community: ${geo.regionLabel} (${geo.autonomousCommunity})
- Known Regional Species: ${speciesHintStr}
- Live Biological Sightings: ${geo.liveSpeciesSummary}
- Nearby Wikipedia / OSM Landmarks: ${geo.landmarks.join(', ') || 'Inspect screenshot for peninsulas, coves, bridges, and dams'}
- Hydrology / Current Direction: ${geo.flowContext.flowDirectionSummary}
${geo.wikipediaExtract ? `- Official Hydrological Summary: ${geo.wikipediaExtract}` : ''}

=== 2. WATER-ONLY PLACEMENT MASK (MANDATORY) ===
- WATER_MASK_STATUS: ${geo.waterCellMask.waterPresence} (${geo.rasterWaterMask ? `${geo.rasterWaterMask.waterCoveragePct}% raster surface water` : `OSM polygons: ${geo.waterPolygons.length}`})
- ALLOWED_WATER_CELLS: [${waterCellsStr}]
- DRY_LAND_FORBIDDEN_CELLS: [${dryCellsStr}]
- Place EVERY pin (x_percent, y_percent) strictly on visible water pixels inside ALLOWED_WATER_CELLS!
- If the screenshot shows ONLY dry land/forest/roads with no fishable water visible, set has_fishable_water=false and recommended_spots=[].

=== 3. SELECTION SCALE ===
- ${scaleInstruction}

=== 4. TERRAIN, ALTITUDE & ROAD SURFACE ACCESS ===
- Water Surface Altitude: ~${geo.geographicalContext.water_elevation_m}m ASL (Surrounding relief: +${geo.geographicalContext.relief_range_m}m)
- OSM Road & Track Surfaces: ${geo.roadPromptSummary}
- Shoreline Steepness by Sector:
${geo.sectorSlopePromptSummary}

=== 5. SPAIN FISHING RESTRICTIONS ===
- Status: ${geo.restrictionCheck.status_label}
- Permits: ${geo.restrictionCheck.permits_required}
- Exclusion Zones: ${geo.restrictionCheck.prohibited_zones_warning}
- NEVER place a spot on a dam wall (presa), spillway, or restricted reserve.

=== 6. ANGLER LURES / TARGET ===
- ${input.anglerGearNote?.trim() || 'No fixed gear preset: tailor lure/bait & rig tactics per spot to the target species and spot structure (spinning, feeder, float, fly, or soft-plastic rigs).'}

=== 7. 12-FEATURE EXTRACTION & HONEST EVALUATION ===
- ALLOWED_FEATURES_FOR_SCALE: [${allowedScaleFeatures.join(', ')}]
- Extract ONLY features genuinely supported at each spot (1 to 12 features; NEVER invent features to hit a quota—if a spot only shows 1 or 2 real features, report 1 or 2 honestly).
- Mark seasonal/time-varying cues (weed_line, weed_edge, shadow) as historical reference from static satellite imagery; never promise live vegetation.
- Note any glare, turbidity, cloud shadow, or zoom limits in extraction_limitations.
- Provide a concise 1-2 sentence rating_justification per spot; the server computes deterministic 1.0-10.0 ratings and sorts Rank 1..6 descending.`;

    const primaryModel =
      process.env.GEMINI_VISION_MODEL?.trim() || 'gemini-2.5-flash';
    const candidateModels: {
      name: string;
      thinkingBudget?: number;
      timeoutMs: number;
    }[] = [
      { name: primaryModel, thinkingBudget: 0, timeoutMs: 12000 },
      ...(primaryModel !== 'gemini-2.5-flash-lite'
        ? [{ name: 'gemini-2.5-flash-lite', timeoutMs: 9000 }]
        : []),
    ];

    const llmDeadline = Date.now() + 20000;

    for (const candidate of candidateModels) {
      const remainingMs = llmDeadline - Date.now();
      if (remainingMs < 2500) break;

      try {
        const response = await ai.models.generateContent({
          model: candidate.name,
          contents: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64Clean,
              },
            },
            { text: promptText },
          ],
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: SCREENSHOT_RESPONSE_SCHEMA,
            temperature: 0.2,
            ...(candidate.thinkingBudget !== undefined
              ? { thinkingConfig: { thinkingBudget: candidate.thinkingBudget } }
              : {}),
            abortSignal: AbortSignal.timeout(
              Math.min(candidate.timeoutMs, remainingMs)
            ),
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text) as Partial<WaterBodyArtifactAnalysis>;
          if (parsed.has_fishable_water === false) {
            return buildNoWaterDetectedResponse(geo, parsed.no_water_reason);
          }

          if (
            parsed.recommended_spots &&
            Array.isArray(parsed.recommended_spots) &&
            parsed.recommended_spots.length >= 1
          ) {
            const rawSpots: GridArtifactSpot[] = parsed.recommended_spots
              .slice(0, 6)
              .map((s, idx) => {
                const rank = idx + 1;
                const x = Math.max(3, Math.min(97, Number(s.x_percent) || 50));
                const y = Math.max(3, Math.min(97, Number(s.y_percent) || 50));
                const computedCell = percentToCellId(x, y);
                const color =
                  rank <= 2 ? 'green' : rank <= 4 ? 'blue' : 'yellow';

                const parsedExtracted: ExtractedSpotFeature[] = Array.isArray(
                  s.extracted_features
                )
                  ? s.extracted_features
                      .filter(
                        (item): item is ExtractedSpotFeature =>
                          Boolean(item && typeof item === 'object' && 'feature' in item)
                      )
                      .map((item) => ({
                        feature: item.feature,
                        observation_type:
                          item.observation_type === 'topographic_inference'
                            ? 'topographic_inference'
                            : 'directly_visible',
                        visual_cue: String(item.visual_cue || '').trim(),
                      }))
                  : [];

                const influencing_features =
                  Array.isArray(s.influencing_features) && s.influencing_features.length > 0
                    ? s.influencing_features.map((f) => String(f).trim()).filter(Boolean)
                    : undefined;

                const why_rank_summary =
                  Array.isArray(s.why_rank_summary) && s.why_rank_summary.length > 0
                    ? s.why_rank_summary.map((b) => String(b).trim()).filter(Boolean)
                    : undefined;

                return {
                  rank,
                  color,
                  cell_id: computedCell,
                  grid_cells_label: s.grid_cells_label || `Grid ${computedCell}`,
                  badge: s.badge,
                  title: s.title || `Sector ${computedCell} Water Structure`,
                  x_percent: x,
                  y_percent: y,
                  target_species:
                    Array.isArray(s.target_species) && s.target_species.length > 0
                      ? s.target_species
                      : geo.speciesPresentDefaults.slice(0, 2).map((sp) => sp.name),
                  access_mode: normalizeAccessMode(s.access_mode),
                  access_summary:
                    s.access_summary || geo.geographicalContext.road_access_summary,
                  depth_structure: s.depth_structure || 'Shoreline shelf / drop-off',
                  why_label: s.why_label || 'Feature Breakdown:',
                  why_this_spot: s.why_this_spot || '',
                  secondary_label: s.secondary_label || 'Terrain & Access:',
                  secondary_text: s.secondary_text,
                  how_to_fish: s.how_to_fish || '',
                  stacked_x_count:
                    typeof s.stacked_x_count === 'number' ? s.stacked_x_count : undefined,
                  influencing_features,
                  why_rank_summary,
                  extracted_features: parsedExtracted,
                  rating_justification:
                    typeof s.rating_justification === 'string'
                      ? s.rating_justification.trim()
                      : undefined,
                };
              });

            const waterConstrained = constrainSpotsToWaterMask(
              rawSpots,
              input.bbox,
              geo.waterPolygons,
              geo.rasterWaterMask
            ).map((spot) => enrichSpotWithRoadAccess(spot, input.bbox, geo));

            const { ratedSpots, limitations, inventory } = rankAndRateSpots(
              waterConstrained,
              geo.scaleMode
            );

            const llmLimitations = Array.isArray(parsed.extraction_limitations)
              ? parsed.extraction_limitations.map((l) => String(l).trim()).filter(Boolean)
              : [];
            const combinedLimitations = Array.from(
              new Set([...llmLimitations, ...limitations])
            );

            const llmInventory = Array.isArray(parsed.screenshot_feature_inventory)
              ? parsed.screenshot_feature_inventory.filter((k): k is AnglerFeatureKey =>
                  (ALL_ANGLER_FEATURE_KEYS as string[]).includes(String(k))
                )
              : [];
            const combinedInventory = Array.from(
              new Set([...llmInventory, ...inventory])
            );

            const normalizedRegion = (parsed.region_label || geo.regionLabel).replace(
              /\bEspaña\b/g,
              'Spain'
            );

            return {
              report_id: generateReportId(),
              app_version: APP_VERSION,
              generated_at: formatReportTimestamp(),
              has_fishable_water: true,
              water_coverage_pct:
                geo.rasterWaterMask?.waterCoveragePct ?? parsed.water_coverage_pct,
              analysis_source: 'gemini_vision',
              water_body_name: parsed.water_body_name || geo.waterBodyName,
              region_label: normalizedRegion,
              water_body_summary:
                parsed.water_body_summary ||
                `Satellite, terrain (${geo.geographicalContext.water_elevation_m}m ASL), road-surface & Spain regulatory analysis of ${geo.waterBodyName}.`,
              imagery_freshness_note: IMAGERY_FRESHNESS_NOTE,
              extraction_limitations: combinedLimitations,
              screenshot_feature_inventory: combinedInventory,
              species_present: normalizeSpeciesList(
                parsed.species_present,
                geo.speciesPresentDefaults
              ),
              geographical_context: geo.geographicalContext,
              restriction_check: geo.restrictionCheck,
              recommended_spots: ratedSpots,
              best_game_plan:
                parsed.best_game_plan && parsed.best_game_plan.length >= 2
                  ? parsed.best_game_plan
                  : buildDynamicGamePlan(
                      ratedSpots,
                      input.bbox,
                      geo.autonomousCommunity,
                      geo.waterPolygons,
                      geo.rasterWaterMask?.grid64Mask
                    ),
            };
          }
          return buildNoWaterDetectedResponse(
            geo,
            parsed.no_water_reason ||
              'No fishable water body spots could be confirmed in this image.'
          );
        }
      } catch (err) {
        console.warn(
          `[ai-advisor] Vision model ${candidate.name} failed, trying fallback:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  return buildFallbackGeospatialAnalysis(geo, input.bbox, input.anglerGearNote);
}

function buildFallbackGeospatialAnalysis(
  geo: EnrichedGeospatialContext,
  bbox: BoundingBox,
  anglerGearNote?: string
): WaterBodyArtifactAnalysis {
  // Zero-hallucination guard: never scatter arbitrary points if water cannot be confirmed
  if (
    geo.waterCellMask.waterPresence === 'no_water' ||
    (geo.waterCellMask.waterPresence === 'unknown' && !geo.matchedRecord)
  ) {
    return buildNoWaterDetectedResponse(
      geo,
      'Live AI vision is temporarily busy and no verified river, reservoir, lake, or coast polygon was confirmed inside this area. Pan over visible water and retry.'
    );
  }

  const candidatePool = sampleDistinctWaterCoordinates(
    bbox,
    geo.waterPolygons,
    geo.rasterWaterMask,
    16
  );

  if (candidatePool.length === 0) {
    return buildNoWaterDetectedResponse(geo);
  }

  const classifiedPool = candidatePool.map((coord) => ({
    coord,
    geom: classifyWaterCoordGeometry(
      coord,
      bbox,
      geo.waterPolygons,
      resolveLocalSectorReliefM(
        geo.demSectorSamples,
        coord.x_percent,
        coord.y_percent,
        geo.geographicalContext.relief_range_m
      ),
      geo.rasterWaterMask?.grid64Mask,
      geo.flowContext
    ),
  }));

  const selectedPool = selectDiverseSpotGeometries(
    classifiedPool.map((item) => ({ ...item, kind: item.geom.kind })),
    6
  );
  const verifiedWaterCoords = selectedPool.map((item) => item.coord);
  const spotGeometries = selectedPool.map((item) => item.geom);

  const dynamicSpots: GridArtifactSpot[] = verifiedWaterCoords.map((coord, idx) => {
    const rank = idx + 1;
    const geom = spotGeometries[idx];
    const [spotLng, spotLat] = percentToLngLat(coord.x_percent, coord.y_percent, bbox);
    const accessInfo = classifySpotRoadAccess({
      spotLng,
      spotLat,
      roads: geo.roads,
      sectorReliefM: geom.localReliefM,
      isOffshoreOpenWater: geom.shoreDistanceM > 50,
      shoreDistanceM: geom.shoreDistanceM,
      shoreDirection: geom.shoreDirection,
    });

    const spotSpecies = selectSpeciesForSpotGeometry(
      geom.kind,
      geo.speciesPresentDefaults,
      idx
    );
    const tactics = buildStructureMatchedTactics(
      geom.kind,
      spotSpecies,
      anglerGearNote,
      idx,
      geom.shoreDirection,
      geom.shoreDistanceM,
      geom.inFlowingWater ? geo.flowContext : undefined,
      geom.isDownstreamLee,
      geom.inFlowingWater !== false
    );

    const cardinal = computeCardinalPrefix(coord.cell_id);
    const spotTitle = `${cardinal} ${geom.baseTitle || geom.title}`;
    const whyThisSpot = buildAnglerWhyThisSpot(
      geom.kind,
      spotSpecies,
      cardinal,
      rank,
      geom.inFlowingWater !== false,
      Boolean(geom.isDownstreamLee)
    );

    return {
      rank,
      color: rank <= 2 ? 'green' : rank <= 4 ? 'blue' : 'yellow',
      cell_id: coord.cell_id,
      grid_cells_label: `Grid ${coord.cell_id}`,
      title: spotTitle,
      x_percent: coord.x_percent,
      y_percent: coord.y_percent,
      target_species: spotSpecies,
      access_mode: accessInfo.access_mode,
      access_summary: accessInfo.access_summary,
      depth_structure: geom.depthStructure,
      why_label: 'Why this spot:',
      why_this_spot: whyThisSpot,
      secondary_label: 'Terrain & Access:',
      secondary_text: accessInfo.access_summary,
      how_to_fish: tactics,
      extracted_features: geom.features,
    };
  });

  const constrainedDynamic = constrainSpotsToWaterMask(
    dynamicSpots,
    bbox,
    geo.waterPolygons,
    geo.rasterWaterMask
  ).map((spot) => enrichSpotWithRoadAccess(spot, bbox, geo));

  const { ratedSpots, limitations, inventory } = rankAndRateSpots(
    constrainedDynamic,
    geo.scaleMode
  );

  const extraLimitations: string[] = [];
  if (geo.waterPolygons.length === 0 && geo.rasterWaterMask) {
    extraLimitations.push(
      'OSM Overpass vector polygons were unavailable; spot positions rely strictly on OSM raster water pixels.'
    );
  }

  return {
    report_id: generateReportId(),
    app_version: APP_VERSION,
    generated_at: formatReportTimestamp(),
    has_fishable_water: true,
    water_coverage_pct: geo.rasterWaterMask?.waterCoveragePct,
    analysis_source: 'geospatial_fallback',
    water_body_name: geo.waterBodyName,
    region_label: geo.regionLabel.replace(/\bEspaña\b/g, 'Spain'),
    water_body_summary: `${geo.geographicalContext.scale_label} for ${geo.waterBodyName} (${geo.regionLabel.replace(/\bEspaña\b/g, 'Spain')}) at ~${geo.geographicalContext.water_elevation_m}m ASL (DEM est.).`,
    imagery_freshness_note: IMAGERY_FRESHNESS_NOTE,
    extraction_limitations: [
      'Shoreline contours and access inferred conservatively from hydrographic geometry, road network, and DEM elevation models (verify local water levels and bank footing on site).',
      ...extraLimitations,
      ...limitations,
    ],
    screenshot_feature_inventory: inventory,
    species_present: geo.speciesPresentDefaults,
    geographical_context: geo.geographicalContext,
    restriction_check: geo.restrictionCheck,
    recommended_spots: ratedSpots,
    best_game_plan: buildDynamicGamePlan(
      ratedSpots,
      bbox,
      geo.autonomousCommunity,
      geo.waterPolygons,
      geo.rasterWaterMask?.grid64Mask,
      geo.flowContext
    ),
  };
}

type FallbackSpotKind =
  | 'shore_point'
  | 'sheltered_cove'
  | 'channel_narrowing'
  | 'steep_shore'
  | 'shallow_margin'
  | 'offshore_transition'
  | 'open_basin';

function capitalizeDir(dir: CardinalDirection): string {
  return dir.charAt(0).toUpperCase() + dir.slice(1);
}

function longestContiguousRun(flags: boolean[]): number {
  if (flags.length === 0) return 0;
  const doubled = [...flags, ...flags];
  let best = 0;
  let cur = 0;
  for (const f of doubled) {
    if (f) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return Math.min(flags.length, best);
}

export function classifyWaterCoordGeometry(
  coord: { x_percent: number; y_percent: number; cell_id: string },
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[],
  localReliefM: number,
  grid64Mask?: string,
  flowContext?: FlowContext
): {
  kind: FallbackSpotKind;
  kindLabel: string;
  baseTitle?: string;
  title: string;
  depthStructure: string;
  localReliefM: number;
  shoreDistanceM: number;
  shoreDirection: CardinalDirection;
  inFlowingWater?: boolean;
  isDownstreamLee?: boolean;
  features: ExtractedSpotFeature[];
} {
  const [lng, lat] = percentToLngLat(coord.x_percent, coord.y_percent, bbox);
  const shoreLines = waterPolygons.flatMap((poly) => {
    const rings =
      poly.geometry.type === 'Polygon'
        ? [poly.geometry.coordinates[0]]
        : poly.geometry.coordinates.map((c) => c[0]);
    return rings.filter((r) => r && r.length >= 2).map((r) => lineString(r));
  });

  const metrics = computeShoreMetrics(
    coord.x_percent,
    coord.y_percent,
    bbox,
    waterPolygons,
    shoreLines,
    grid64Mask
  );
  const { shoreDistanceM, shoreDirection, nearestShoreLngLat } = metrics;
  const inFlowingWater = flowContext
    ? isPointInFlowingWater(lng, lat, flowContext)
    : true;
  const isDownstreamLee =
    flowContext && nearestShoreLngLat
      ? isDownstreamLeeOfShore(
          lng,
          lat,
          nearestShoreLngLat[0],
          nearestShoreLngLat[1],
          flowContext.flowBearingDeg
        )
      : false;
  const dirCap = capitalizeDir(shoreDirection);

  // Metric-scaled 12-bearing angular probe around the water pin (and nearest shore tip)
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const spanM = Math.max(
    (maxLng - minLng) * 111_320 * Math.cos((lat * Math.PI) / 180),
    (maxLat - minLat) * 110_574
  );
  const cellSizeM = spanM / 64;
  const probeRadiusM =
    waterPolygons.length > 0 ? 30 : Math.max(30, Math.round(cellSizeM * 1.15));

  const isWaterAtLngLat = (pLng: number, pLat: number): boolean => {
    if (waterPolygons.length > 0) {
      return waterPolygons.some((wp) => booleanPointInPolygon(point([pLng, pLat]), wp));
    }
    if (grid64Mask && grid64Mask.length === 4096) {
      const px = ((pLng - minLng) / Math.max(1e-6, maxLng - minLng)) * 100;
      const py = ((maxLat - pLat) / Math.max(1e-6, maxLat - minLat)) * 100;
      if (px < 0 || px > 100 || py < 0 || py > 100) return false;
      return isPercentOnRasterWater(grid64Mask, px, py, 0);
    }
    return true;
  };

  const offsetMeters = (
    oLng: number,
    oLat: number,
    distM: number,
    degClockwiseNorth: number
  ): [number, number] => {
    const rad = (degClockwiseNorth * Math.PI) / 180;
    const dLat = (distM * Math.cos(rad)) / 110_574;
    const dLng =
      (distM * Math.sin(rad)) / (111_320 * Math.max(0.1, Math.cos((oLat * Math.PI) / 180)));
    return [oLng + dLng, oLat + dLat];
  };

  const landArcPin: boolean[] = [];
  for (let i = 0; i < 12; i++) {
    const [pLng, pLat] = offsetMeters(lng, lat, probeRadiusM, i * 30);
    landArcPin.push(!isWaterAtLngLat(pLng, pLat));
  }
  const hasOppositeLandWalls = [0, 1, 2, 3, 4, 5].some(
    (i) => landArcPin[i] && landArcPin[i + 6]
  );
  const maxLandContigPin = longestContiguousRun(landArcPin);

  let maxWaterContigShoreTip = 0;
  if (nearestShoreLngLat && shoreDistanceM <= 75) {
    const tipProbeRadiusM = Math.max(
      probeRadiusM,
      Math.min(240, Math.round(spanM * 0.06))
    );
    const waterArcTip: boolean[] = [];
    for (let i = 0; i < 12; i++) {
      const [pLng, pLat] = offsetMeters(
        nearestShoreLngLat[0],
        nearestShoreLngLat[1],
        tipProbeRadiusM,
        i * 30
      );
      waterArcTip.push(isWaterAtLngLat(pLng, pLat));
    }
    maxWaterContigShoreTip = longestContiguousRun(waterArcTip);
  }

  // 1. True channel / bottleneck (opposing banks <= ~60m apart)
  if (hasOppositeLandWalls && shoreDistanceM <= 75) {
    const channelFeatures: ExtractedSpotFeature[] = inFlowingWater
      ? [
          {
            feature: 'channel',
            observation_type: 'topographic_inference',
            visual_cue: `Opposing banks enclosing narrowed corridor (~${shoreDistanceM}m to ${shoreDirection} bank)`,
          },
          {
            feature: 'current_break',
            observation_type: 'topographic_inference',
            visual_cue:
              flowContext?.upstreamCardinal && flowContext?.flowCardinal
                ? `Flow seam (${flowContext.upstreamCardinal} -> ${flowContext.flowCardinal}) along channel constriction`
                : 'Flow alignment & eddy seam along channel constriction',
          },
        ]
      : [
          {
            feature: 'channel',
            observation_type: 'topographic_inference',
            visual_cue: `Opposing banks enclosing narrowed stillwater neck (~${shoreDistanceM}m to ${shoreDirection} bank)`,
          },
          {
            feature: 'depth_change',
            observation_type: 'topographic_inference',
            visual_cue: 'Neck transition between cove and main basin',
          },
        ];
    return {
      kind: 'channel_narrowing',
      kindLabel: inFlowingWater
        ? 'channel corridor / narrowing'
        : 'stillwater constriction neck',
      baseTitle: inFlowingWater ? 'Channel Bottleneck' : 'Constriction Neck',
      title: inFlowingWater ? 'Channel Bottleneck' : 'Constriction Neck',
      depthStructure: inFlowingWater
        ? `Narrowed channel corridor (nearest bank ~${shoreDistanceM}m ${shoreDirection} of pin)`
        : `Narrowed cove/lake pass (nearest bank ~${shoreDistanceM}m ${shoreDirection} of pin)`,
      localReliefM,
      shoreDistanceM,
      shoreDirection,
      inFlowingWater,
      isDownstreamLee,
      features: channelFeatures,
    };
  }

  // 2. Peninsula / Point tip (water wraps > 200° around the nearest shore tip)
  if (maxWaterContigShoreTip >= 7 && shoreDistanceM <= 75) {
    const pointFeatures: ExtractedSpotFeature[] = inFlowingWater
      ? [
          {
            feature: 'point',
            observation_type: 'topographic_inference',
            visual_cue: `Peninsula / point tip protruding into water (>200° water arc, shore ~${shoreDistanceM}m ${shoreDirection} of pin)`,
          },
          {
            feature: 'current_break',
            observation_type: 'topographic_inference',
            visual_cue:
              isDownstreamLee && flowContext?.upstreamCardinal && flowContext?.flowCardinal
                ? `Downstream eddy pocket (${flowContext.upstreamCardinal} -> ${flowContext.flowCardinal} flow) behind point`
                : 'Angled point contour deflecting current into an eddy seam',
          },
        ]
      : [
          {
            feature: 'point',
            observation_type: 'topographic_inference',
            visual_cue: `Peninsula / point tip protruding into stillwater (>200° water arc, shore ~${shoreDistanceM}m ${shoreDirection} of pin)`,
          },
          {
            feature: 'depth_change',
            observation_type: 'topographic_inference',
            visual_cue: 'Submerged point taper into deeper basin water',
          },
        ];
    return {
      kind: 'shore_point',
      kindLabel: 'peninsula / shoreline point',
      baseTitle: isDownstreamLee ? 'Point Downstream Eddy' : 'Peninsula Point',
      title: isDownstreamLee ? 'Point Downstream Eddy' : 'Peninsula Point',
      depthStructure: `Prominent point/peninsula tip (shore ~${shoreDistanceM}m ${shoreDirection} of pin)`,
      localReliefM,
      shoreDistanceM,
      shoreDirection,
      inFlowingWater,
      isDownstreamLee,
      features: pointFeatures,
    };
  }

  // 3. Steep bank / drop-off along shoreline (<= 75m)
  if (shoreDistanceM <= 75 && localReliefM > 22) {
    return {
      kind: 'steep_shore',
      kindLabel: 'steep shoreline margin',
      baseTitle: 'Steep Bank Contour',
      title: 'Steep Bank Contour',
      depthStructure: `Steep shoreline margin (bank ~${shoreDistanceM}m ${shoreDirection} of pin, +${localReliefM}m slope)`,
      localReliefM,
      shoreDistanceM,
      shoreDirection,
      features: [
        { feature: 'drop_off', observation_type: 'topographic_inference', visual_cue: `Steep +${localReliefM}m bank relief ~${shoreDistanceM}m ${shoreDirection} of pin` },
        { feature: 'depth_change', observation_type: 'topographic_inference', visual_cue: 'Shoreline contour transition inferred from bank slope' },
      ],
    };
  }

  // 4. Sheltered Cove / Bay (land wraps >= 180° around the water point)
  if (maxLandContigPin >= 6 && shoreDistanceM <= 75) {
    return {
      kind: 'sheltered_cove',
      kindLabel: 'sheltered bay / cove',
      baseTitle: 'Sheltered Cove',
      title: 'Sheltered Cove',
      depthStructure: `Sheltered horseshoe bay (shore ~${shoreDistanceM}m ${shoreDirection} of pin)`,
      localReliefM,
      shoreDistanceM,
      shoreDirection,
      features: [
        { feature: 'flat', observation_type: 'topographic_inference', visual_cue: `Protected horseshoe cove (shore ~${shoreDistanceM}m ${shoreDirection} of pin)` },
        { feature: 'depth_change', observation_type: 'topographic_inference', visual_cue: 'Cove mouth to inner-bay depth gradient' },
      ],
    };
  }

  // 5. Crisp > 75m offshore / open-basin boundary (never misuse 'channel' on wide open water)
  if (shoreDistanceM > 75) {
    return {
      kind: 'open_basin',
      kindLabel: 'open-basin water',
      baseTitle: 'Mid-Basin Open Water',
      title: 'Mid-Basin Open Water',
      depthStructure: `Open-basin pelagic water (nearest shore ~${shoreDistanceM}m ${shoreDirection} of pin)`,
      localReliefM,
      shoreDistanceM,
      shoreDirection,
      features: [
        { feature: 'depth_change', observation_type: 'topographic_inference', visual_cue: `Open-basin surface (~${shoreDistanceM}m off shore; bathymetry unmeasured)` },
      ],
    };
  }

  // 6. Bank margin (<= 75m, low-slope open bank)
  return {
    kind: 'shallow_margin',
    kindLabel: 'shoreline margin',
    baseTitle: 'Shoreline Margin',
    title: 'Shoreline Margin',
    depthStructure: `Low-slope shoreline margin (bank ~${shoreDistanceM}m ${shoreDirection} of pin)`,
    localReliefM,
    shoreDistanceM,
    shoreDirection,
    features: [
      { feature: 'flat', observation_type: 'topographic_inference', visual_cue: `Low-slope (+${localReliefM}m) bank ~${shoreDistanceM}m ${shoreDirection} of pin` },
    ],
  };
}

export function selectDiverseSpotGeometries<
  T extends { kind: FallbackSpotKind },
>(items: T[], maxCount = 6): T[] {
  const chosen: T[] = [];
  const overflow: T[] = [];
  let channelCount = 0;
  let openBasinCount = 0;

  for (const item of items) {
    if (item.kind === 'channel_narrowing' && channelCount >= 2) {
      overflow.push(item);
      continue;
    }
    if (item.kind === 'open_basin' && openBasinCount >= 2) {
      overflow.push(item);
      continue;
    }
    chosen.push(item);
    if (item.kind === 'channel_narrowing') channelCount++;
    if (item.kind === 'open_basin') openBasinCount++;
    if (chosen.length >= maxCount) return chosen;
  }

  for (const item of overflow) {
    if (chosen.length >= maxCount) break;
    chosen.push(item);
  }
  return chosen;
}

function selectSpeciesForSpotGeometry(
  kind: FallbackSpotKind,
  roster: SpeciesPresenceInfo[],
  spotIdx: number
): string[] {
  if (roster.length === 0) return ['Common Carp'];
  const preferredByKind: Record<FallbackSpotKind, RegExp[]> = {
    shallow_margin: [/carp/i, /chub/i, /black bass/i, /tench/i, /mullet/i, /dorada/i],
    sheltered_cove: [/carp/i, /black bass/i, /tench/i, /chub/i, /pike/i],
    steep_shore: [/black bass/i, /brown trout/i, /zander/i, /pike/i, /dentex/i],
    shore_point: [/black bass/i, /brown trout/i, /barbel/i, /zander/i, /sea bass/i],
    channel_narrowing: [/brown trout/i, /barbel/i, /chub/i, /zander/i, /catfish/i],
    offshore_transition: [/black bass/i, /brown trout/i, /barbel/i, /zander/i, /pike/i],
    open_basin: [/zander/i, /brown trout/i, /rainbow trout/i, /black bass/i, /catfish/i, /pike/i],
  };

  const patterns = preferredByKind[kind];
  const matched: string[] = [];
  for (let offset = 0; offset < patterns.length; offset++) {
    const pattern = patterns[(offset + (spotIdx % 2)) % patterns.length];
    const hit = roster.find((sp) => pattern.test(sp.name) && !matched.includes(sp.name));
    if (hit) matched.push(hit.name);
    if (matched.length >= 2) break;
  }

  if (matched.length === 0) {
    const first = roster[spotIdx % roster.length]?.name;
    const second = roster[(spotIdx + 1) % roster.length]?.name;
    return Array.from(new Set([first, second].filter(Boolean) as string[]));
  }
  return matched;
}

function buildStructureMatchedTactics(
  kind: FallbackSpotKind,
  targetSpecies: string[],
  anglerGearNote?: string,
  spotIdx = 0,
  shoreDirection?: CardinalDirection,
  shoreDistanceM?: number,
  flowContext?: FlowContext,
  isDownstreamLee = false,
  isFlowingSpot = true
): string {
  const speciesText = targetSpecies.join(' / ');
  const bankPhrase = shoreDirection ? `off the ${shoreDirection} bank` : 'along the bank';
  const distPhrase =
    shoreDistanceM !== undefined ? ` (~${shoreDistanceM}m out)` : '';
  const flowPrefix =
    flowContext?.upstreamCardinal && flowContext?.flowCardinal
      ? `Current flows ${flowContext.upstreamCardinal} -> ${flowContext.flowCardinal}: `
      : '';

  if (anglerGearNote && anglerGearNote.trim().length > 0) {
    const gearItems = anglerGearNote
      .split(/[,&;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const chosenGear =
      kind === 'shallow_margin' || kind === 'sheltered_cove'
        ? gearItems.find((g) => /worm|craw|jig|float|corn|boilie/i.test(g)) ?? gearItems[0]
        : kind === 'channel_narrowing' || kind === 'shore_point'
          ? gearItems.find((g) => /spinner|spoon|minnow|jerk|shad|fly/i.test(g)) ?? gearItems[0]
          : gearItems[(gearItems.length - 1 - (spotIdx % gearItems.length) + gearItems.length) % gearItems.length] ??
            anglerGearNote.trim();

    const zonePhrase =
      kind === 'sheltered_cove'
        ? `inside the sheltered cove ${bankPhrase}`
        : kind === 'shallow_margin'
          ? `across the ${shoreDirection || 'shoreline'} margin${distPhrase}`
          : kind === 'open_basin'
            ? `through open-basin water${distPhrase}`
            : kind === 'channel_narrowing'
              ? 'along the channel current seam'
              : `along the ${shoreDirection || 'shoreline'} contour transition`;
    return `Work ${chosenGear} ${zonePhrase} targeting ${speciesText}.`;
  }

  switch (kind) {
    case 'sheltered_cove':
      return `Quietly pitch weightless soft plastics or float-fish corn and worms ${bankPhrase}${distPhrase} with minimal surface splash.`;
    case 'shallow_margin':
      return spotIdx % 2 === 0
        ? `Fish a light ledger or feeder rig with corn or boilies quietly ${bankPhrase}${distPhrase}; keep bank footsteps and noise to a minimum.`
        : `Slow-roll a weedless soft plastic or light inline spinner parallel to the ${shoreDirection || 'shoreline'} bank${distPhrase}.`;
    case 'channel_narrowing':
      if (!isFlowingSpot) {
        return spotIdx % 2 === 0
          ? `Cast across the narrow pass from the ${shoreDirection || 'south'} bank${distPhrase} reach using a single-hook inline spinner, a slow-rolled paddle-tail shad, or a suspended float rig.`
          : `Position on the ${shoreDirection || 'north'} bank and fan-cast suspending jerkbaits or compact jigs${distPhrase} across the mouth into the main basin transition.`;
      }
      if (flowPrefix) {
        return `${flowPrefix}stand slightly upstream and quarter a single-hook spinner or small crankbait across the channel seam from the ${shoreDirection || 'shoreline'} bank.`;
      }
      return spotIdx % 2 === 0
        ? `Drift or slow-retrieve a single-hook inline spinner, small crankbait, or weighted nymph along the channel seam${distPhrase}.`
        : `Quarter suspending minnows or compact jigs across the bottleneck current edge${distPhrase}.`;
    case 'shore_point':
      if (flowPrefix && isDownstreamLee) {
        return `${flowPrefix}quarter suspending minnows or spinners across the point tip and let them swing naturally into the downstream eddy pocket${distPhrase}.`;
      }
      return spotIdx % 2 === 0
        ? `${flowPrefix}stand on the point tip and fan-cast suspending jerkbaits or lightly jigged soft plastics past the ${shoreDirection || 'shoreline'} tip${distPhrase}, working lures back down the underwater slope.`
        : `${flowPrefix}cast medium-diving crankbaits or inline spinners parallel to the point's breakline${distPhrase}, retrieving along the depth transition.`;
    case 'steep_shore':
      return `Cast parallel to the steeper ${shoreDirection || 'shoreline'} bank edge${distPhrase} using jigged soft plastics or medium-diving lures.`;
    case 'open_basin':
    default:
      return spotIdx % 2 === 0
        ? `Fan-cast counted-down jigged shads or heavy spoons across open water${distPhrase}, counting down to mid-depth before slow-rolling.`
        : `Cover mid-basin water${distPhrase} using slow-sinking lipless crankbaits or weighted swimbaits.`;
  }
}

function parseSpotSlopeM(accessSummary: string): number {
  const m = accessSummary.match(/\+(\d+)\s*m/);
  return m ? Number(m[1]) : 999;
}

function isSpotOffshore(spot: GridArtifactSpot): boolean {
  return (
    spot.access_mode === 'boat_only' ||
    /offshore|open-basin|open-water/i.test(
      `${spot.access_summary} ${spot.depth_structure}`
    )
  );
}

function segmentCrossesWater(
  a: GridArtifactSpot,
  b: GridArtifactSpot,
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[] = [],
  grid64Mask?: string
): boolean {
  if (waterPolygons.length === 0 && (!grid64Mask || grid64Mask.length !== 4096)) {
    return false;
  }
  let waterHits = 0;
  for (const t of [0.15, 0.3, 0.5, 0.7, 0.85]) {
    const px = a.x_percent + (b.x_percent - a.x_percent) * t;
    const py = a.y_percent + (b.y_percent - a.y_percent) * t;
    let inWater = false;
    if (waterPolygons.length > 0) {
      const [lng, lat] = percentToLngLat(px, py, bbox);
      inWater = waterPolygons.some((wp) => booleanPointInPolygon(point([lng, lat]), wp));
    } else if (grid64Mask) {
      inWater = isPercentOnRasterWater(grid64Mask, px, py, 0);
    }
    if (inWater) waterHits++;
  }
  return waterHits >= 1;
}

export function buildDynamicGamePlan(
  ratedSpots: GridArtifactSpot[],
  bbox: BoundingBox,
  autonomousCommunity: string,
  waterPolygons: WaterGeometryFeature[] = [],
  grid64Mask?: string,
  flowContext?: FlowContext
): string[] {
  if (ratedSpots.length === 0) return [];
  const accessRank: Record<SpotAccessMode, number> = {
    car_asphalt: 0,
    dirt_track: 1,
    hike_in: 2,
    boat_only: 3,
  };

  const hasWatercraftSpot = ratedSpots.some(
    (s) =>
      s.access_mode === 'boat_only' ||
      /watercraft|boat|float-tube|floatation/i.test(s.access_summary)
  );
  const rulesTail = hasWatercraftSpot
    ? 'permits and gear/floatation rules'
    : 'permits and seasonal gear rules';

  const sortedByEase = [...ratedSpots].sort((a, b) => {
    const offshoreDiff = Number(isSpotOffshore(a)) - Number(isSpotOffshore(b));
    if (offshoreDiff !== 0) return offshoreDiff;
    const easeDiff = accessRank[a.access_mode] - accessRank[b.access_mode];
    if (easeDiff !== 0) return easeDiff;
    const slopeDiff = parseSpotSlopeM(a.access_summary) - parseSpotSlopeM(b.access_summary);
    if (slopeDiff !== 0) return slopeDiff;
    return a.rank - b.rank;
  });

  const startSpot = sortedByEase[0];
  const [startLng, startLat] = percentToLngLat(startSpot.x_percent, startSpot.y_percent, bbox);

  const others = ratedSpots.filter((s) => s.rank !== startSpot.rank);
  if (others.length === 0) {
    return [
      `Start at Spot ${startSpot.rank} (${startSpot.grid_cells_label}) for easiest entry — ${startSpot.access_summary}.`,
      `Verify ${autonomousCommunity} ${rulesTail} and bank safety before casting.`,
    ];
  }

  let bestNext = others[0];
  let bestDistKm = Infinity;
  let bestCrossesWater = false;
  let bestScore = Infinity;

  const startIsShore = !isSpotOffshore(startSpot) && startSpot.access_mode !== 'boat_only';

  for (const cand of others) {
    const [cLng, cLat] = percentToLngLat(cand.x_percent, cand.y_percent, bbox);
    const dKm = turfDistance(point([startLng, startLat]), point([cLng, cLat]), {
      units: 'kilometers',
    });
    const crossesWater = segmentCrossesWater(
      startSpot,
      cand,
      bbox,
      waterPolygons,
      grid64Mask
    );
    const candIsShore = !isSpotOffshore(cand) && cand.access_mode !== 'boat_only';
    // Skip trivial < 120m hops between identical-rating low-tier spots when better options exist
    const isTrivialDuplicateHop =
      dKm < 0.12 &&
      Math.abs((startSpot.rating ?? 0) - (cand.rating ?? 0)) < 0.25 &&
      others.length > 1;
    // Prefer shore-to-shore routing before jumping to boat_only/offshore spots
    const modalPenalty = startIsShore && !candIsShore ? 2.5 : 0;
    const trivialPenalty = isTrivialDuplicateHop ? 3.0 : 0;
    // On flowing rivers, prefer safe downstream-to-upstream stalking progression
    let upstreamBonus = 0;
    if (
      flowContext?.isFlowingWater &&
      flowContext.flowBearingDeg !== null &&
      startIsShore &&
      candIsShore
    ) {
      const upstreamBearing = (flowContext.flowBearingDeg + 180) % 360;
      const moveBearing = computeCompassBearingDeg(startLng, startLat, cLng, cLat);
      const diff = Math.abs(((moveBearing - upstreamBearing + 540) % 360) - 180);
      if (diff <= 80) upstreamBonus = -0.35;
    }
    const weightedScore =
      dKm + (crossesWater ? 0.5 : 0) + modalPenalty + trivialPenalty + upstreamBonus;
    if (weightedScore < bestScore) {
      bestScore = weightedScore;
      bestDistKm = dKm;
      bestCrossesWater = crossesWater;
      bestNext = cand;
    }
  }

  const distLabel =
    bestDistKm < 1
      ? `~${Math.round(bestDistKm * 1000)}m`
      : `~${bestDistKm.toFixed(1)} km`;

  const nextIsShore = !isSpotOffshore(bestNext) && bestNext.access_mode !== 'boat_only';
  let step2Verb: string;
  if (!startIsShore || !nextIsShore) {
    step2Verb = `Reposition via perimeter road or permitted watercraft to Spot ${bestNext.rank} (${bestNext.grid_cells_label})`;
  } else if (bestCrossesWater) {
    step2Verb = `Follow the perimeter shoreline trail around the cove toward Spot ${bestNext.rank} (${bestNext.grid_cells_label})`;
  } else if (bestDistKm <= 0.6) {
    step2Verb = `Walk ${distLabel} along accessible bank paths toward Spot ${bestNext.rank} (${bestNext.grid_cells_label})`;
  } else {
    step2Verb = `Follow the perimeter bank tracks toward Spot ${bestNext.rank} (${bestNext.grid_cells_label})`;
  }

  const topSpot = ratedSpots[0];
  const steps = [
    `Start at Spot ${startSpot.rank} (${startSpot.grid_cells_label}) for easiest entry — ${startSpot.access_summary}.`,
    `${step2Verb} (${bestNext.depth_structure.split('(')[0].trim()}).`,
  ];

  if (topSpot.rank !== startSpot.rank && topSpot.rank !== bestNext.rank) {
    steps.push(
      `Target peak feeding windows at highest-rated Spot 1 (${topSpot.grid_cells_label}) while observing ${autonomousCommunity} ${rulesTail}.`
    );
  } else {
    steps.push(
      `Focus peak dawn/dusk hours on Spot 1 (${topSpot.grid_cells_label}) while observing ${autonomousCommunity} ${rulesTail}.`
    );
  }

  return steps;
}
