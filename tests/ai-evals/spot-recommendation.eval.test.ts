import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import spotSchemaJson from '@prompts/schemas/spot-recommendation.schema.json';
import { analyzeWaterBodyScreenshot } from '@/modules/ai-advisor/screenshot-analyzer.service';
import {
  buildEnrichedGeospatialContext,
  computeSelectionScale,
} from '@/modules/ai-advisor/geospatial-context.service';
import { GRID64_SIZE } from '@/modules/ai-advisor/osm-tile-water-mask';
import { percentToCellId } from '@/modules/ai-advisor/water-mask-and-access';

const ajv = new Ajv({ allErrors: true });
const validateArtifactSchema = ajv.compile(spotSchemaJson);

describe('F02 & F03 — Spain AI Screenshot, Geographical Context & Restriction Evals', () => {
  it('classifies selection scale into micro (<2.5km), meso (2.5-8km), and macro (>8km) plus overZoomed (<0.35km)', () => {
    const overZoomed = computeSelectionScale([-0.947, 39.241, -0.945, 39.243]);
    expect(overZoomed.scaleMode).toBe('micro');
    expect(overZoomed.isOverZoomed).toBe(true);

    const micro = computeSelectionScale([-0.955, 39.238, -0.942, 39.248]);
    expect(micro.scaleMode).toBe('micro');
    expect(micro.isOverZoomed).toBe(false);

    const meso = computeSelectionScale([-0.972, 39.222, -0.92, 39.262]);
    expect(meso.scaleMode).toBe('meso');

    const macro = computeSelectionScale([-1.05, 39.18, -0.85, 39.32]);
    expect(macro.scaleMode).toBe('macro');
  });

  it('recognizes Embalse de Cortes (Valencia, Spain), altitude, shore access, and Spain restrictions from bbox', async () => {
    const result = await buildEnrichedGeospatialContext([
      -0.972, 39.222, -0.92, 39.262,
    ]);
    expect(result.waterBodyName).toContain('Embalse de Cortes');
    expect(result.regionLabel).toContain('Valencia');
    expect(result.geographicalContext.water_elevation_m).toBeGreaterThan(100);
    expect(result.restrictionCheck.permits_required).toContain('Licencia');
    expect(
      result.restrictionCheck.regulations_list.some((r) =>
        r.includes('Real Decreto 630/2013')
      )
    ).toBe(true);
  });

  it('produces 2-6 spots + species_present + access_mode + restriction_check without hardcoded brand lures or fake fallback depths', async () => {
    const analysis = await analyzeWaterBodyScreenshot({
      bbox: [-0.972, 39.222, -0.92, 39.262],
      hintWaterBodyId: 'wb-es-cortes-valencia',
    });

    const isValid = validateArtifactSchema(analysis);
    if (!isValid) {
      console.error('AJV Schema Errors:', validateArtifactSchema.errors);
    }
    expect(isValid).toBe(true);

    expect(analysis.has_fishable_water).toBe(true);
    expect(analysis.region_label).not.toContain('España');
    expect(analysis.water_body_name).toContain('Embalse de Cortes');
    expect(analysis.species_present.length).toBeGreaterThanOrEqual(2);
    expect(analysis.species_present[0].name).toBeTruthy();
    expect(analysis.species_present[0].habitat_zone).toBeTruthy();
    expect(analysis.species_present[0].recommended_approach).toBeTruthy();

    expect(analysis.geographical_context).toBeDefined();
    expect(analysis.geographical_context!.water_elevation_m).toBeGreaterThan(100);
    expect(analysis.restriction_check).toBeDefined();
    expect(analysis.restriction_check!.status).toBe('permit_required');
    expect(analysis.recommended_spots.length).toBeGreaterThanOrEqual(2);
    expect(analysis.recommended_spots.length).toBeLessThanOrEqual(6);

    for (const spot of analysis.recommended_spots) {
      expect(spot.cell_id).toBe(percentToCellId(spot.x_percent, spot.y_percent));
      expect(spot.target_species.length).toBeGreaterThanOrEqual(1);
      expect(['car_asphalt', 'dirt_track', 'hike_in', 'boat_only']).toContain(
        spot.access_mode
      );
      expect(spot.access_summary.length).toBeGreaterThan(4);
      expect(spot.depth_structure.length).toBeGreaterThan(3);
      expect(spot.how_to_fish).not.toContain('WETA');
      expect(spot.how_to_fish).not.toContain('Yubari');
      if (analysis.analysis_source === 'geospatial_fallback') {
        expect(spot.depth_structure).not.toMatch(/\b\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?m\b/);
      }
      expect(spot.stacked_x_count).toBeGreaterThanOrEqual(1);
      expect(spot.influencing_features?.length).toBeGreaterThanOrEqual(1);
      expect(spot.why_rank_summary?.length).toBeGreaterThanOrEqual(1);
    }

    // AC-F02-9 & AC-F02-10: Deterministic 1-10 rating, canonical 12 features, justification & freshness honesty
    expect(analysis.imagery_freshness_note).toBeTruthy();
    for (let i = 0; i < analysis.recommended_spots.length; i++) {
      const spot = analysis.recommended_spots[i];
      expect(spot.extracted_features?.length).toBeGreaterThanOrEqual(1);
      expect(spot.rating).toBeGreaterThanOrEqual(1);
      expect(spot.rating).toBeLessThanOrEqual(10);
      expect(spot.rating_tier).toBeTruthy();
      if ((spot.extracted_features?.length ?? 0) >= 2) {
        expect(spot.rating_tier).not.toBe('Single-Feature / Limited');
      }
      expect(spot.rating_justification?.length).toBeGreaterThan(10);
      if (i > 0) {
        expect(analysis.recommended_spots[i - 1].rating!).toBeGreaterThanOrEqual(
          spot.rating!
        );
      }
    }

    const spot1 = analysis.recommended_spots.find((s) => s.rank === 1);
    expect(spot1).toBeDefined();
    expect(spot1!.stacked_x_count).toBeGreaterThanOrEqual(2);
    expect(spot1!.influencing_features!.length).toBeGreaterThanOrEqual(2);
    expect(spot1!.why_rank_summary!.length).toBeGreaterThanOrEqual(1);

    expect(analysis.best_game_plan.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects dry mountain screenshots with zero hallucinated spots when no fishable water exists (AC-F02-6 & AC-F02-8)', async () => {
    const dryAnalysis = await analyzeWaterBodyScreenshot({
      // Camino del Otonel dry hillside coordinates
      bbox: [-0.905, 39.282, -0.885, 39.298],
      clientWaterMask: {
        waterCoveragePct: 0,
        waterCells: [],
        sampledWaterPoints: [],
        grid64Mask: '0'.repeat(GRID64_SIZE * GRID64_SIZE),
      },
    });

    const isValid = validateArtifactSchema(dryAnalysis);
    if (!isValid) {
      console.error('AJV Schema Errors (no water):', validateArtifactSchema.errors);
    }
    expect(isValid).toBe(true);
    expect(dryAnalysis.has_fishable_water).toBe(false);
    expect(dryAnalysis.analysis_source).toBe('no_water_detected');
    expect(dryAnalysis.recommended_spots).toEqual([]);
    expect(dryAnalysis.species_present).toEqual([]);
    expect(dryAnalysis.no_water_reason).toBeTruthy();
    expect(dryAnalysis.region_label).not.toContain('España');
  });
});
