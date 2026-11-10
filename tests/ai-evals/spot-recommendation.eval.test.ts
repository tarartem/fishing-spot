import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import spotSchemaJson from '@prompts/schemas/spot-recommendation.schema.json';
import { analyzeWaterBodyScreenshot } from '@/modules/ai-advisor/screenshot-analyzer.service';
import {
  buildEnrichedGeospatialContext,
  computeSelectionScale,
} from '@/modules/ai-advisor/geospatial-context.service';

const ajv = new Ajv({ allErrors: true });
const validateArtifactSchema = ajv.compile(spotSchemaJson);

describe('F02 & F03 — Spain AI Screenshot, Geographical Context & Restriction Evals', () => {
  it('classifies selection scale into micro (<2.5km), meso (2.5-8km), and macro (>8km)', () => {
    const micro = computeSelectionScale([-0.955, 39.238, -0.942, 39.248]);
    expect(micro.scaleMode).toBe('micro');

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

  it('produces a 6-spot analysis + geographical_context + restriction_check strictly conforming to spot-recommendation.schema.json', async () => {
    const analysis = await analyzeWaterBodyScreenshot({
      bbox: [-0.972, 39.222, -0.92, 39.262],
      anglerGearNote:
        'WETA+ No. 3 (7g), WETA No. 2 (5g), Texas-rigged Yubari Craw & Yubari Worm (100mm)',
      hintWaterBodyId: 'wb-es-cortes-valencia',
    });

    const isValid = validateArtifactSchema(analysis);
    expect(isValid).toBe(true);

    expect(analysis.water_body_name).toContain('Embalse de Cortes');
    expect(analysis.geographical_context).toBeDefined();
    expect(analysis.geographical_context!.water_elevation_m).toBeGreaterThan(100);
    expect(analysis.restriction_check).toBeDefined();
    expect(analysis.restriction_check!.status).toBe('permit_required');
    expect(analysis.recommended_spots).toHaveLength(6);

    const spot1 = analysis.recommended_spots[0];
    expect(spot1.rank).toBe(1);
    expect(spot1.color).toBe('red');
    expect(spot1.title).toContain('Tip of the Dehesa de Cortes Peninsula');
    expect(spot1.grid_cells_label).toBe('Grid E6 / F6');

    const spot2 = analysis.recommended_spots[1];
    expect(spot2.rank).toBe(2);
    expect(spot2.color).toBe('red');
    expect(spot2.title).toContain('The Underwater Shelf Below Playa del Ral');

    expect(analysis.best_game_plan.length).toBeGreaterThanOrEqual(3);
  });
});
