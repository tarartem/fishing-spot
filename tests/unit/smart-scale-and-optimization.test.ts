import { describe, expect, it } from 'vitest';
import {
  computeSelectionScale,
  getOptimalBbox,
} from '@/modules/ai-advisor/scale-utils';
import type { BoundingBox } from '@/shared/types/domain';

describe('Smart Scale Classification & Tactical Area Optimization', () => {
  it('classifies a tight zoom (< 0.35 km) as "too_tight" with optimization enabled', () => {
    // 0.001 deg lat is ~0.11 km span
    const tightBbox: BoundingBox = [-0.935, 39.248, -0.934, 39.249];
    const result = computeSelectionScale(tightBbox);

    expect(result.smartScale.tier).toBe('too_tight');
    expect(result.smartScale.badgeLabel).toBe('Too tight');
    expect(result.smartScale.canOptimize).toBe(true);
    expect(result.smartScale.explanation).toContain('Zoomed in too close');
  });

  it('classifies a large basin view (> 1.8 km) as "wide" with optimization enabled', () => {
    // 0.05 deg lat is ~5.5 km span
    const wideBbox: BoundingBox = [-0.96, 39.22, -0.91, 39.27];
    const result = computeSelectionScale(wideBbox);

    expect(result.smartScale.tier).toBe('wide');
    expect(result.smartScale.badgeLabel).toBe('Wide area');
    expect(result.smartScale.canOptimize).toBe(true);
    expect(result.smartScale.explanation).toContain('Area is too wide');
  });

  it('classifies a tactical sector (~1.0 km) as "optimal" with optimization disabled', () => {
    // ~1 km span centered at Embalse de Cortes
    const optimalBbox: BoundingBox = [-0.94, 39.244, -0.93, 39.252];
    const result = computeSelectionScale(optimalBbox);

    expect(result.smartScale.tier).toBe('optimal');
    expect(result.smartScale.badgeLabel).toBe('Optimal');
    expect(result.smartScale.canOptimize).toBe(false);
    expect(result.smartScale.explanation).toContain('Ideal scale');
  });

  it('getOptimalBbox computes an ~1.0 km span box accurately centered on original coordinates', () => {
    const wideBbox: BoundingBox = [-0.98, 39.20, -0.90, 39.28];
    const origCenterLng = (wideBbox[0] + wideBbox[2]) / 2;
    const origCenterLat = (wideBbox[1] + wideBbox[3]) / 2;

    const optBbox = getOptimalBbox(wideBbox, 1.0);
    const optCenterLng = (optBbox[0] + optBbox[2]) / 2;
    const optCenterLat = (optBbox[1] + optBbox[3]) / 2;

    // Center must match within float precision
    expect(optCenterLng).toBeCloseTo(origCenterLng, 4);
    expect(optCenterLat).toBeCloseTo(origCenterLat, 4);

    // Optimized span should now evaluate to "optimal"
    const optScale = computeSelectionScale(optBbox);
    expect(optScale.smartScale.tier).toBe('optimal');
    expect(optScale.maxSpanKm).toBeGreaterThanOrEqual(0.7);
    expect(optScale.maxSpanKm).toBeLessThanOrEqual(1.3);
  });
});
