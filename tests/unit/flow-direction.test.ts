import { describe, it, expect } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import {
  computeFlowContext,
  isDownstreamLeeOfShore,
  isPointInFlowingWater,
  type WaterwayLine,
} from '@/modules/ai-advisor/flow-direction';
import {
  classifyWaterCoordGeometry,
  selectDiverseSpotGeometries,
} from '@/modules/ai-advisor/screenshot-analyzer.service';
import type { BoundingBox } from '@/shared/types/domain';

describe('AC-F02-13 — Water Current Direction, DEM Cross-Check & Stillwater Guardrail', () => {
  it('computes length-weighted flow direction from OSM waterways and confirms with DEM (>= 2m drop)', () => {
    const riverSegments: WaterwayLine[] = [
      {
        kind: 'river',
        name: 'Río Sil',
        // Drawn North -> South
        coords: [
          [-6.65, 42.56],
          [-6.65, 42.55],
        ],
      },
      {
        kind: 'river',
        name: 'Río Sil',
        coords: [
          [-6.65, 42.55],
          [-6.65, 42.54],
        ],
      },
    ];

    const flow = computeFlowContext({
      waterwayLines: riverSegments,
      waterPolygons: [],
      sampleElevationFn: (_lng, lat) => (lat > 42.55 ? 410 : 400), // 10m drop N->S
    });

    expect(flow.isFlowingWater).toBe(true);
    expect(flow.flowCardinal).toBe('S');
    expect(flow.confidence).toBe('osm_and_dem');
    expect(flow.flowDirectionSummary).toContain('N -> S');
  });

  it('flips reversed OSM waterway when DEM drop >= 2m disagrees, but trusts OSM when |Δelev| < 2m', () => {
    const reversedCanal: WaterwayLine[] = [
      {
        kind: 'canal',
        // Drawn South -> North by mistake, but elevation drops North -> South by 6m
        coords: [
          [-6.65, 42.54],
          [-6.65, 42.56],
        ],
      },
    ];

    const corrected = computeFlowContext({
      waterwayLines: reversedCanal,
      waterPolygons: [],
      sampleElevationFn: (_lng, lat) => (lat > 42.55 ? 410 : 404), // North is 6m higher
    });
    expect(corrected.flowCardinal).toBe('S');
    expect(corrected.confidence).toBe('osm_and_dem');

    const flatCanal = computeFlowContext({
      waterwayLines: reversedCanal,
      waterPolygons: [],
      sampleElevationFn: (_lng, lat) => (lat > 42.55 ? 400 : 401), // |1m| noise < 2m
    });
    expect(flatCanal.flowCardinal).toBe('N'); // trusts OSM digitization
    expect(flatCanal.confidence).toBe('osm_way_order');
  });

  it('treats calm reservoir basins far from inflows as stillwater while detecting scaled inflow plumes', () => {
    const reservoir: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water', water: 'reservoir' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-6.70, 42.45],
            [-6.68, 42.45],
            [-6.68, 42.47],
            [-6.70, 42.47],
            [-6.70, 42.45],
          ],
        ],
      },
    };
    const inflowRiver: WaterwayLine[] = [
      {
        kind: 'river',
        name: 'Río Cabrera',
        // Flows from outside north (-6.69, 42.475) into reservoir (-6.69, 42.469)
        coords: [
          [-6.69, 42.475],
          [-6.69, 42.469],
        ],
      },
    ];

    const flow = computeFlowContext({
      waterwayLines: inflowRiver,
      waterPolygons: [reservoir],
    });

    expect(flow.inflowPoints.length).toBeGreaterThanOrEqual(1);
    expect(flow.inflowPoints[0].radiusM).toBeGreaterThanOrEqual(350);
    // Point right at inflow mouth (~100m inside) is flowing
    expect(isPointInFlowingWater(-6.69, 42.469, flow)).toBe(true);
    // Point 1.5km away in calm south basin is stillwater
    expect(isPointInFlowingWater(-6.69, 42.453, flow)).toBe(false);
  });

  it('identifies downstream lee side of a shoreline point', () => {
    // Current flows South (180°). Shore tip is at (lat 42.50), pin is south at (lat 42.4997)
    expect(isDownstreamLeeOfShore(-6.65, 42.4997, -6.65, 42.50, 180)).toBe(true);
    // Pin upstream (north) of point tip at (lat 42.5003) is NOT downstream lee
    expect(isDownstreamLeeOfShore(-6.65, 42.5003, -6.65, 42.50, 180)).toBe(false);
  });

  it('titles stillwater narrows as Constriction Neck without current_break and caps channel_narrowing to max 2', () => {
    const bbox: BoundingBox = [-6.80, 42.45, -6.794, 42.455];
    const narrowLake: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water', water: 'lake' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-6.7972, 42.451],
            [-6.7968, 42.451],
            [-6.7968, 42.454],
            [-6.7972, 42.454],
            [-6.7972, 42.451],
          ],
        ],
      },
    };
    const stillwaterFlow = computeFlowContext({
      waterwayLines: [],
      waterPolygons: [narrowLake],
    });

    const classified = classifyWaterCoordGeometry(
      { x_percent: 50, y_percent: 50, cell_id: 'D4' },
      bbox,
      [narrowLake],
      2,
      undefined,
      stillwaterFlow
    );
    expect(classified.kind).toBe('channel_narrowing');
    expect(classified.title).toContain('Constriction Neck');
    expect(classified.title).not.toContain('Channel Bottleneck');
    expect(classified.features.map((f) => f.feature)).not.toContain('current_break');

    const diverse = selectDiverseSpotGeometries(
      [
        { coord: { x_percent: 10, y_percent: 10, cell_id: 'A1' }, kind: 'channel_narrowing' },
        { coord: { x_percent: 20, y_percent: 20, cell_id: 'B2' }, kind: 'channel_narrowing' },
        { coord: { x_percent: 30, y_percent: 30, cell_id: 'C3' }, kind: 'channel_narrowing' },
        { coord: { x_percent: 40, y_percent: 40, cell_id: 'D4' }, kind: 'channel_narrowing' },
        { coord: { x_percent: 50, y_percent: 50, cell_id: 'E5' }, kind: 'sheltered_cove' },
        { coord: { x_percent: 60, y_percent: 60, cell_id: 'F6' }, kind: 'shore_point' },
        { coord: { x_percent: 70, y_percent: 70, cell_id: 'G7' }, kind: 'shallow_margin' },
        { coord: { x_percent: 80, y_percent: 80, cell_id: 'H8' }, kind: 'steep_shore' },
      ],
      6
    );
    expect(diverse).toHaveLength(6);
    expect(diverse.filter((d) => d.kind === 'channel_narrowing').length).toBeLessThanOrEqual(2);
  });
});
