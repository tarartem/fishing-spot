import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import spotSchemaJson from '@prompts/schemas/spot-recommendation.schema.json';
import {
  analyzeWaterBodyScreenshot,
  recognizeWaterBodyFromBbox,
} from '@/modules/ai-advisor/screenshot-analyzer.service';

const ajv = new Ajv({ allErrors: true });
const validateArtifactSchema = ajv.compile(spotSchemaJson);

describe('F02 — AI Screenshot Water Body Recognizer & 6-Spot Grid Evals', () => {
  it('recognizes Embalse de Cortes (Valencia) from selected map bounding box', async () => {
    const result = await recognizeWaterBodyFromBbox([
      -0.972, 39.222, -0.92, 39.262,
    ]);
    expect(result.waterBodyName).toContain('Embalse de Cortes');
    expect(result.regionLabel).toContain('Valencia');
  });

  it('produces a 6-spot analysis (🔴 1–2, 🔵 3–4, 🟠 5–6) + Best Game Plan strictly conforming to spot-recommendation.schema.json', async () => {
    const analysis = await analyzeWaterBodyScreenshot({
      bbox: [-0.972, 39.222, -0.92, 39.262],
      anglerGearNote:
        'WETA+ No. 3 (7g), WETA No. 2 (5g), Texas-rigged Yubari Craw & Yubari Worm (100mm)',
      hintWaterBodyId: 'wb-es-cortes-valencia',
    });

    const isValid = validateArtifactSchema(analysis);
    expect(isValid).toBe(true);

    expect(analysis.water_body_name).toContain('Embalse de Cortes');
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

    const spot3 = analysis.recommended_spots[2];
    expect(spot3.color).toBe('blue');
    expect(spot3.title).toContain('Carpa Cofrentes Sheltered Bay');

    const spot4 = analysis.recommended_spots[3];
    expect(spot4.color).toBe('blue');
    expect(spot4.title).toContain('Playa del Ral Beach Cove');

    const spot5 = analysis.recommended_spots[4];
    expect(spot5.color).toBe('orange');
    expect(spot5.title).toContain('The Canyon S-Bend & Powerline Point');

    const spot6 = analysis.recommended_spots[5];
    expect(spot6.color).toBe('orange');
    expect(spot6.title).toContain('Southern Gate of the Western Arm');

    expect(analysis.best_game_plan.length).toBeGreaterThanOrEqual(3);
  });
});
