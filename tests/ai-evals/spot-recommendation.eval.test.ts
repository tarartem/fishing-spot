import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import spotSchemaJson from '@prompts/schemas/spot-recommendation.schema.json';
import { SEEDED_WATER_BODIES } from '@db/seed/poland-spain-waters';
import {
  resolveTacticalSectorBbox,
  generateSpatialGrid,
} from '@/modules/map-grid/grid-engine';
import {
  computeQueryHash,
  buildSpotFinderPrompt,
} from '@/modules/ai-advisor/prompt-builder';
import { validateSpotRecommendation } from '@/modules/ai-advisor/spot-recommendation.validator';
import {
  recommendFishingSpots,
  analyzeSingleGridCell,
} from '@/modules/ai-advisor/ai-advisor.service';

const ajv = new Ajv({ allErrors: true });
const validateJsonSchema = ajv.compile(spotSchemaJson);

describe('F02 — AI Spatial Grid Advisor & Schema Evals', () => {
  it('computes identical SHA-256 queryHash regardless of targetSpecies array ordering', () => {
    const hash1 = computeQueryHash({
      waterBodyId: 'wb-pl-zegrzynskie',
      sectorBbox: [21.005, 52.435, 21.065, 52.468],
      waterType: 'freshwater',
      fishingType: 'spinning',
      targetSpecies: ['zander', 'pike', 'perch'],
      accessMode: 'shore',
      season: 'autumn',
    });

    const hash2 = computeQueryHash({
      waterBodyId: 'wb-pl-zegrzynskie',
      sectorBbox: [21.005, 52.435, 21.065, 52.468],
      waterType: 'freshwater',
      fishingType: 'spinning',
      targetSpecies: ['perch', 'zander', 'pike'],
      accessMode: 'shore',
      season: 'autumn',
    });

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('builds a prompt containing candidate grid cells, angler inputs, and community review summaries', () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const gridCells = generateSpatialGrid({
      sectorBbox: zegrze.bbox,
      waterPolygon: zegrze.polygon,
      restrictionZones: zegrze.restrictionZones,
    });

    const prompt = buildSpotFinderPrompt({
      waterBody: zegrze,
      gridCells,
      waterType: 'freshwater',
      fishingType: 'spinning',
      targetSpecies: ['zander', 'perch'],
      accessMode: 'shore',
      season: 'autumn',
    });

    expect(prompt.systemPrompt).toContain('GRID-LOCKED SELECTION');
    expect(prompt.userPrompt).toContain('Jezioro Zegrzyńskie');
    expect(prompt.userPrompt).toContain('spinning');
    expect(prompt.userPrompt).toContain('zander, perch');
    expect(prompt.userPrompt).toContain('C4');
  });

  it('produces recommendations strictly conforming to spot-recommendation.schema.json and never recommends prohibited cells', async () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const sectorBbox = resolveTacticalSectorBbox(zegrze.bbox, {
      latitude: zegrze.centerLat,
      longitude: zegrze.centerLng,
    });
    const gridCells = generateSpatialGrid({
      sectorBbox,
      waterPolygon: zegrze.polygon,
      restrictionZones: zegrze.restrictionZones,
    });

    const result = await recommendFishingSpots({
      waterBody: zegrze,
      sectorBbox,
      gridCells,
      waterType: 'freshwater',
      fishingType: 'spinning',
      targetSpecies: ['zander', 'perch'],
      accessMode: 'shore',
      season: 'autumn',
    });

    // 1. Validate against official JSON Schema in prompts/schemas/spot-recommendation.schema.json
    const schemaValid = validateJsonSchema(result.recommendation);
    expect(schemaValid).toBe(true);

    // 2. Validate domain invariants (no prohibited cells like A1, shore accessibility respected)
    const domainCheck = validateSpotRecommendation(
      result.recommendation,
      gridCells,
      'shore'
    );
    expect(domainCheck.valid).toBe(true);
    expect(
      result.recommendation.recommended_spots.every((s) => s.cell_id !== 'A1')
    ).toBe(true);

    // 3. Verify second identical call hits deterministic cache
    const secondCall = await recommendFishingSpots({
      waterBody: zegrze,
      sectorBbox,
      gridCells,
      waterType: 'freshwater',
      fishingType: 'spinning',
      targetSpecies: ['perch', 'zander'],
      accessMode: 'shore',
      season: 'autumn',
    });
    expect(secondCall.cacheHit).toBe(true);
    expect(secondCall.queryHash).toBe(result.queryHash);
  });

  it('rejects any hallucinated or prohibited grid cell in validateSpotRecommendation', () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const gridCells = generateSpatialGrid({
      sectorBbox: zegrze.bbox,
      waterPolygon: zegrze.polygon,
      restrictionZones: zegrze.restrictionZones,
    });

    const invalidPayload = {
      water_body_summary: 'Test summary',
      restriction_overview: {
        overall_status: 'permit_required' as const,
        warnings: [],
        disclaimer: 'Verify local permits.',
      },
      recommended_spots: [
        {
          rank: 1,
          cell_id: 'A1', // Prohibited dam cell!
          coordinates: { latitude: 52.465, longitude: 21.01 },
          title: 'Illegal Dam Spot',
          confidence_score: 90,
          why_this_spot: 'Near the dam',
          tactical_advice: {
            recommended_baits_or_lures: ['Jig'],
            presentation_tips: 'Cast near the dam structure',
            best_time_of_day: 'Dawn',
          },
          target_species_fit: ['zander'],
          restriction_status: 'permit_required' as const,
        },
      ],
    };

    const validation = validateSpotRecommendation(
      invalidPayload,
      gridCells,
      'shore'
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('prohibited'))).toBe(true);
  });

  it('supports Level 2 single-cell micro-analysis (e.g. clicking cell D5)', async () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const gridCells = generateSpatialGrid({
      sectorBbox: zegrze.bbox,
      waterPolygon: zegrze.polygon,
      restrictionZones: zegrze.restrictionZones,
    });
    const targetCell = gridCells.find((c) => c.restrictionStatus !== 'prohibited')!;

    const micro = await analyzeSingleGridCell({
      waterBody: zegrze,
      cell: targetCell,
      fishingType: 'spinning',
      targetSpecies: ['zander', 'pike'],
      accessMode: 'shore',
    });

    expect(micro.cellId).toBe(targetCell.cellId);
    expect(micro.suitabilityScore).toBeGreaterThan(0);
    expect(micro.howToFishThisCell.length).toBeGreaterThan(15);
  });
});
