import { describe, it, expect } from 'vitest';
import {
  ANGLER_FEATURE_CATALOG,
  computeSelectionScale,
  getAllowedFeaturesForScale,
} from '@/modules/ai-advisor/scale-utils';
import {
  evaluateSpotFeaturesAndRating,
  rankAndRateSpots,
} from '@/modules/ai-advisor/spot-rating';
import type { ExtractedSpotFeature, GridArtifactSpot } from '@/shared/types/domain';

describe('12-Feature Extraction, Optimal Scale Gating & Deterministic 1-10 Rating', () => {
  it('defines all 12 canonical angler features with seasonal flags', () => {
    const keys = Object.keys(ANGLER_FEATURE_CATALOG);
    expect(keys).toHaveLength(12);
    expect(keys).toEqual(
      expect.arrayContaining([
        'point',
        'flat',
        'drop_off',
        'channel',
        'shadow',
        'cover',
        'depth_change',
        'weed_line',
        'weed_edge',
        'current_break',
        'bottom_transition',
        'multiple_points',
      ])
    );

    expect(ANGLER_FEATURE_CATALOG.weed_line.isSeasonalOrDynamic).toBe(true);
    expect(ANGLER_FEATURE_CATALOG.weed_edge.isSeasonalOrDynamic).toBe(true);
    expect(ANGLER_FEATURE_CATALOG.shadow.isSeasonalOrDynamic).toBe(true);
    expect(ANGLER_FEATURE_CATALOG.point.isSeasonalOrDynamic).toBe(false);
    expect(ANGLER_FEATURE_CATALOG.channel.isSeasonalOrDynamic).toBe(false);
  });

  it('computes metersPerPixel and gates micro features at macro scale (> 5 km)', () => {
    const micro = computeSelectionScale([-0.955, 39.238, -0.942, 39.248]); // ~1.1km
    expect(micro.scaleMode).toBe('micro');
    expect(micro.isOptimalScale).toBe(true);
    expect(micro.metersPerPixel).toBeLessThan(1.5);
    expect(getAllowedFeaturesForScale('micro')).toHaveLength(12);

    const meso = computeSelectionScale([-0.972, 39.222, -0.92, 39.262]); // ~4.5km
    expect(meso.scaleMode).toBe('meso');
    expect(meso.isOptimalScale).toBe(false);

    const macro = computeSelectionScale([-1.05, 39.18, -0.85, 39.32]); // ~17km
    expect(macro.scaleMode).toBe('macro');
    expect(macro.isOptimalScale).toBe(false);
    const macroAllowed = getAllowedFeaturesForScale('macro');
    expect(macroAllowed).toContain('point');
    expect(macroAllowed).toContain('channel');
    expect(macroAllowed).not.toContain('weed_line');
    expect(macroAllowed).not.toContain('weed_edge');
    expect(macroAllowed).not.toContain('shadow');
    expect(macroAllowed).not.toContain('cover');
    expect(macroAllowed).not.toContain('bottom_transition');
  });

  it('caps single-feature spots <= 4.5/10 and rewards multi-category convergence up to 10', () => {
    const singleFlat = evaluateSpotFeaturesAndRating(
      [
        {
          feature: 'flat',
          observation_type: 'directly_visible',
          visual_cue: 'Uniform pale shallow shelf',
        },
      ],
      'micro'
    );
    expect(singleFlat.rating).toBeLessThanOrEqual(4.5);
    expect(singleFlat.rating).toBeGreaterThanOrEqual(1.0);
    expect(singleFlat.rating_tier).toBe('Single-Feature / Limited');
    expect(singleFlat.rating_justification).toContain('/10');
    expect(singleFlat.rating_justification).toContain('Flat');

    const convergenceFeatures: ExtractedSpotFeature[] = [
      {
        feature: 'point',
        observation_type: 'directly_visible',
        visual_cue: 'Limestone point jutting into basin',
      },
      {
        feature: 'multiple_points',
        observation_type: 'directly_visible',
        visual_cue: 'Secondary submerged spur flanks the bay entrance',
      },
      {
        feature: 'drop_off',
        observation_type: 'directly_visible',
        visual_cue: 'Turquoise shelf plunging to deep navy',
      },
      {
        feature: 'weed_edge',
        observation_type: 'directly_visible',
        visual_cue: 'Dark aquatic weed bed meeting open gravel',
      },
      {
        feature: 'current_break',
        observation_type: 'topographic_inference',
        visual_cue: 'Point deflects main channel flow',
      },
    ];
    const stacked = evaluateSpotFeaturesAndRating(convergenceFeatures, 'micro');
    expect(stacked.rating).toBeGreaterThanOrEqual(8.5);
    expect(stacked.rating).toBeLessThanOrEqual(10.0);
    expect(stacked.rating_tier).toBe('Prime Convergence');
    expect(stacked.rating_justification.toLowerCase()).toContain('seasonal');
  });

  it('discounts topographic_inference compared to directly_visible observations', () => {
    const visible = evaluateSpotFeaturesAndRating(
      [
        { feature: 'point', observation_type: 'directly_visible', visual_cue: 'Clear peninsula' },
        { feature: 'drop_off', observation_type: 'directly_visible', visual_cue: 'Sharp color break' },
        { feature: 'channel', observation_type: 'directly_visible', visual_cue: 'Dark thalweg' },
      ],
      'micro'
    );
    const inferred = evaluateSpotFeaturesAndRating(
      [
        { feature: 'point', observation_type: 'topographic_inference', visual_cue: 'Point contour' },
        { feature: 'drop_off', observation_type: 'topographic_inference', visual_cue: 'Steep bank slope' },
        { feature: 'channel', observation_type: 'topographic_inference', visual_cue: 'Canyon trough' },
      ],
      'micro'
    );
    expect(visible.rating).toBeGreaterThan(inferred.rating);
  });

  it('strips disallowed micro-features at macro scale and sorts spots descending by rating', () => {
    const baseSpot = (
      rank: number,
      title: string,
      features: ExtractedSpotFeature[]
    ): GridArtifactSpot => ({
      rank,
      color: 'blue',
      cell_id: `C${rank}`,
      grid_cells_label: `Grid C${rank}`,
      title,
      x_percent: 30 + rank * 5,
      y_percent: 30 + rank * 5,
      target_species: ['Black Bass'],
      access_mode: 'hike_in',
      access_summary: 'Trail',
      depth_structure: 'Shelf',
      why_label: 'Why:',
      why_this_spot: 'Test',
      extracted_features: features,
    });

    const lowSpot = baseSpot(1, 'Simple Flat', [
      { feature: 'flat', observation_type: 'directly_visible', visual_cue: 'Shallow bay' },
      { feature: 'weed_line', observation_type: 'directly_visible', visual_cue: 'Weed band' },
    ]);
    const highSpot = baseSpot(2, 'Crossroads Point', [
      { feature: 'point', observation_type: 'directly_visible', visual_cue: 'Main point' },
      { feature: 'drop_off', observation_type: 'directly_visible', visual_cue: 'Steep drop' },
      { feature: 'channel', observation_type: 'directly_visible', visual_cue: 'Main channel' },
      { feature: 'current_break', observation_type: 'directly_visible', visual_cue: 'Eddy seam' },
    ]);

    const { ratedSpots, limitations } = rankAndRateSpots([lowSpot, highSpot], 'macro');
    expect(ratedSpots[0].title).toBe('Crossroads Point');
    expect(ratedSpots[0].rank).toBe(1);
    expect(ratedSpots[0].color).toBe('green');
    expect(ratedSpots[1].title).toBe('Simple Flat');
    expect(ratedSpots[1].rank).toBe(2);
    // weed_line must have been stripped in macro mode
    expect(
      ratedSpots[1].extracted_features?.some((f) => f.feature === 'weed_line')
    ).toBe(false);
    expect(limitations.length).toBeGreaterThan(0);
  });

  it('never labels multi-feature inferred spots (< 4.8) as Single-Feature / Limited', () => {
    const dualInferred = evaluateSpotFeaturesAndRating(
      [
        {
          feature: 'point',
          observation_type: 'topographic_inference',
          visual_cue: 'Shoreline projection in OSM mask',
        },
        {
          feature: 'drop_off',
          observation_type: 'topographic_inference',
          visual_cue: 'Adjacent slope gradient',
        },
      ],
      'meso'
    );
    expect(dualInferred.rating).toBeLessThan(4.8);
    expect(dualInferred.rating_tier).toBe('Moderate / Inferred Candidate');
    expect(dualInferred.rating_justification).not.toContain('Single-Feature');
  });
});
