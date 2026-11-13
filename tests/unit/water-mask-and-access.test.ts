import { describe, it, expect } from 'vitest';
import type { Feature, Polygon } from 'geojson';
import {
  buildWaterMaskFromRgba128,
  GRID64_SIZE,
  RASTER_SIZE,
} from '@/modules/ai-advisor/osm-tile-water-mask';
import {
  computeAllowedWaterCells,
  constrainSpotsToWaterMask,
  classifySpotRoadAccess,
  parseOverpassWaterAndRoadsElements,
  percentToCellId,
  sampleDistinctWaterCoordinates,
  type OsmRoadSegment,
} from '@/modules/ai-advisor/water-mask-and-access';
import {
  buildDynamicGamePlan,
  classifyWaterCoordGeometry,
} from '@/modules/ai-advisor/screenshot-analyzer.service';
import type { BoundingBox, GridArtifactSpot } from '@/shared/types/domain';

describe('F02 — Water-Only Cell Masking, Inland Pin Snapping & Road Surface Access', () => {
  // Bbox spanning 0.04 deg lon x 0.04 deg lat
  const bbox: BoundingBox = [-0.98, 39.22, -0.94, 39.26];

  // Water polygon only covers the left 45% of the bbox (columns A, B, C, and left edge of D)
  // Columns E, F, G, H are 100% dry land (mimicking the user's screenshot #1)
  const leftSideWaterPolygon: Feature<Polygon> = {
    type: 'Feature',
    properties: { natural: 'water' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-0.98, 39.22],
          [-0.962, 39.22],
          [-0.962, 39.26],
          [-0.98, 39.26],
          [-0.98, 39.22],
        ],
      ],
    },
  };

  it('identifies only water-intersecting cells in allowedWaterCells and marks E..H as dry land', () => {
    const mask = computeAllowedWaterCells(bbox, [leftSideWaterPolygon]);
    expect(mask.allowedCells.length).toBeGreaterThan(0);
    expect(mask.allowedCells).toContain('A1');
    expect(mask.allowedCells).toContain('C4');
    expect(mask.allowedCells).toContain('D4');
    expect(mask.dryLandCells).toContain('E2');
    expect(mask.dryLandCells).toContain('F4');
    expect(mask.dryLandCells).toContain('F6');
    expect(mask.dryLandCells).toContain('H8');
  });

  it('snaps any inland LLM spot coordinates (e.g. F6 dirt track, E2 hillside) onto valid water cells and syncs cell_id', () => {
    const inlandSpots: GridArtifactSpot[] = [
      {
        rank: 1,
        color: 'green',
        cell_id: 'C4',
        grid_cells_label: 'Grid C4',
        title: 'Shoreline Drop-off',
        x_percent: 32,
        y_percent: 44,
        target_species: ['Black Bass'],
        access_mode: 'hike_in',
        access_summary: 'Trail walk',
        depth_structure: '4-10m shelf',
        why_label: "Why it's #1:",
        why_this_spot: 'Deep channel break.',
        how_to_fish: 'Jerkbait along edge.',
      },
      {
        rank: 3,
        color: 'blue',
        cell_id: 'F6', // Inland dirt track!
        grid_cells_label: 'Grid F6',
        title: 'Roadside Bay',
        x_percent: 68, // Deep in column F (dry land)
        y_percent: 70, // Row 6
        target_species: ['Carp'],
        access_mode: 'dirt_track',
        access_summary: 'Dirt track',
        depth_structure: '2-4m shallow',
        why_label: "Why it's great:",
        why_this_spot: 'Near dirt road.',
        how_to_fish: 'Cast near reeds.',
      },
      {
        rank: 5,
        color: 'yellow',
        cell_id: 'E2', // Inland!
        grid_cells_label: 'Grid E2',
        title: 'North Point',
        x_percent: 58,
        y_percent: 18,
        target_species: ['Zander'],
        access_mode: 'dirt_track',
        access_summary: 'Dirt track',
        depth_structure: '5-8m drop',
        why_label: "Why it's great:",
        why_this_spot: 'Point.',
        how_to_fish: 'Jig.',
      },
    ];

    const constrained = constrainSpotsToWaterMask(
      inlandSpots,
      bbox,
      [leftSideWaterPolygon]
    );

    const mask = computeAllowedWaterCells(bbox, [leftSideWaterPolygon]);
    for (const spot of constrained) {
      const expectedCell = percentToCellId(spot.x_percent, spot.y_percent);
      expect(spot.cell_id).toBe(expectedCell);
      expect(mask.allowedCells).toContain(spot.cell_id);
      // Column E..H starts at x_percent >= 50; snapped spots must be in water (x_percent <= 46)
      expect(spot.x_percent).toBeLessThanOrEqual(47);
    }
  });

  it('classifies spot road access accurately as car_asphalt vs dirt_track vs boat_only', () => {
    const asphaltRoad: OsmRoadSegment = {
      name: 'CV-428',
      highway: 'secondary',
      surface: 'asphalt',
      coordinates: [
        [-0.961, 39.23],
        [-0.961, 39.25],
      ],
    };
    const dirtTrack: OsmRoadSegment = {
      name: 'Camino de la Dehesa',
      highway: 'track',
      surface: 'dirt',
      tracktype: 'grade3',
      coordinates: [
        [-0.955, 39.23],
        [-0.955, 39.25],
      ],
    };

    const nearAsphalt = classifySpotRoadAccess({
      spotLng: -0.9615,
      spotLat: 39.24,
      roads: [asphaltRoad, dirtTrack],
      sectorReliefM: 8,
    });
    expect(nearAsphalt.access_mode).toBe('car_asphalt');
    expect(nearAsphalt.access_summary.toLowerCase()).toContain('asphalt');
    expect(nearAsphalt.access_summary).toContain('CV-428');

    const nearDirtOnly = classifySpotRoadAccess({
      spotLng: -0.956,
      spotLat: 39.24,
      roads: [dirtTrack],
      sectorReliefM: 10,
    });
    expect(nearDirtOnly.access_mode).toBe('dirt_track');
    expect(nearDirtOnly.access_summary.toLowerCase()).toContain('dirt');

    const steepCliff = classifySpotRoadAccess({
      spotLng: -0.975,
      spotLat: 39.24,
      roads: [dirtTrack],
      sectorReliefM: 72,
    });
    expect(steepCliff.access_mode).toBe('boat_only');

    // Madrid Jarama plain / Vallequillas: flat or rolling terrain near roads NEVER triggers steep canyon boat_only
    const flatValleyAsphalt = classifySpotRoadAccess({
      spotLng: -0.9615,
      spotLat: 39.24,
      roads: [asphaltRoad],
      sectorReliefM: 10,
    });
    expect(flatValleyAsphalt.access_mode).toBe('car_asphalt');
    expect(flatValleyAsphalt.access_summary).not.toContain('Steep canyon');
    expect(flatValleyAsphalt.access_summary.toLowerCase()).not.toContain('boat');

    // Rolling hillside with nearby road gives road access, not boat_only
    const rollingHillAsphalt = classifySpotRoadAccess({
      spotLng: -0.9615,
      spotLat: 39.24,
      roads: [asphaltRoad],
      sectorReliefM: 58,
    });
    expect(rollingHillAsphalt.access_mode).toBe('car_asphalt');
    expect(rollingHillAsphalt.access_summary).toContain('CV-428');
  });

  it('stitches unclosed & reversed OSM multipolygon outer ways into a closed reservoir polygon (AC-F02-7)', () => {
    const parsed = parseOverpassWaterAndRoadsElements([
      {
        type: 'relation',
        tags: { natural: 'water', name: 'Test Reservoir' },
        members: [
          {
            role: 'outer',
            geometry: [
              { lat: 39.22, lon: -0.98 },
              { lat: 39.22, lon: -0.96 },
            ],
          },
          {
            // Reversed direction segment
            role: 'outer',
            geometry: [
              { lat: 39.25, lon: -0.96 },
              { lat: 39.22, lon: -0.96 },
            ],
          },
          {
            role: 'outer',
            geometry: [
              { lat: 39.25, lon: -0.96 },
              { lat: 39.25, lon: -0.98 },
              { lat: 39.22, lon: -0.98 },
            ],
          },
        ],
      },
    ]);

    expect(parsed.waterPolygons).toHaveLength(1);
    const ring = parsed.waterPolygons[0].geometry.coordinates[0] as [number, number][];
    expect(ring.length).toBeGreaterThanOrEqual(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('uses raster OSM water mask to snap inland spots & prevent duplicate stacking, and rejects empty dry land (AC-F02-6, AC-F02-7)', () => {
    // Paint left 25% of a 128x128 RGBA tile with OSM Carto water RGB (170, 211, 223)
    const rgbaWaterLeft = new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE * 4);
    for (let y = 0; y < RASTER_SIZE; y++) {
      for (let x = 0; x < RASTER_SIZE; x++) {
        const idx = (y * RASTER_SIZE + x) * 4;
        if (x < 32) {
          rgbaWaterLeft[idx] = 170;
          rgbaWaterLeft[idx + 1] = 211;
          rgbaWaterLeft[idx + 2] = 223;
          rgbaWaterLeft[idx + 3] = 255;
        } else {
          rgbaWaterLeft[idx] = 242;
          rgbaWaterLeft[idx + 1] = 239;
          rgbaWaterLeft[idx + 2] = 233;
          rgbaWaterLeft[idx + 3] = 255;
        }
      }
    }
    const leftMask = buildWaterMaskFromRgba128(rgbaWaterLeft);
    expect(leftMask.waterCoveragePct).toBeGreaterThan(20);
    expect(leftMask.waterCells.every((c) => c[0] === 'A' || c[0] === 'B')).toBe(true);

    // Constrain spots where 2 spots hallucinate inland into E5 and G5 while Overpass returned []
    const badSpots: GridArtifactSpot[] = [1, 2, 3, 4].map((rank) => ({
      rank,
      color: rank <= 2 ? 'green' : 'blue',
      cell_id: rank <= 2 ? 'E5' : 'G5',
      grid_cells_label: `Grid ${rank <= 2 ? 'E5' : 'G5'}`,
      title: `Spot ${rank}`,
      x_percent: rank <= 2 ? 55 : 80,
      y_percent: 55,
      target_species: ['Black Bass'],
      access_mode: 'hike_in',
      access_summary: 'Track',
      depth_structure: 'Shelf',
      why_label: "Why it's great:",
      why_this_spot: 'Water edge.',
      how_to_fish: 'Cast.',
    }));

    const fixed = constrainSpotsToWaterMask(badSpots, bbox, [], leftMask);
    const coords = new Set<string>();
    for (const s of fixed) {
      expect(s.x_percent).toBeLessThan(26);
      expect(['A', 'B']).toContain(s.cell_id[0]);
      coords.add(`${s.x_percent},${s.y_percent}`);
    }
    expect(coords.size).toBe(4);

    // Distinct fallback sampling yields non-overlapping water points
    const sampled = sampleDistinctWaterCoordinates(bbox, [], leftMask, 6);
    expect(sampled.length).toBeGreaterThanOrEqual(4);
    for (const p of sampled) {
      expect(['A', 'B']).toContain(p.cell_id[0]);
    }

    // Dry hillside with only 1-2 scattered pixels fails cluster filter and reports no_water
    const dryRgba = new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE * 4);
    for (let i = 0; i < dryRgba.length; i += 4) {
      dryRgba[i] = 173;
      dryRgba[i + 1] = 209;
      dryRgba[i + 2] = 158;
      dryRgba[i + 3] = 255;
    }
    dryRgba[10 * RASTER_SIZE * 4 + 20 * 4] = 170;
    dryRgba[10 * RASTER_SIZE * 4 + 20 * 4 + 1] = 211;
    dryRgba[10 * RASTER_SIZE * 4 + 20 * 4 + 2] = 223;
    const dryMask = buildWaterMaskFromRgba128(dryRgba);
    expect(dryMask.waterCoveragePct).toBe(0);
    expect(dryMask.grid64Mask?.length).toBe(GRID64_SIZE * GRID64_SIZE);

    const noWaterCellMask = computeAllowedWaterCells(bbox, [], dryMask, 'empty');
    expect(noWaterCellMask.waterPresence).toBe('no_water');
    expect(noWaterCellMask.allowedCells).toHaveLength(0);
  });

  it('excludes intermittent/dry rivers, swimming pools, and small unnamed farm tanks (Otos dry sector regression)', () => {
    // 1. Overpass vector filter drops intermittent rivers, pools, basins, and unnamed <3500m2 ponds
    const parsed = parseOverpassWaterAndRoadsElements([
      {
        type: 'way',
        tags: { waterway: 'river', intermittent: 'yes', name: 'Riu de Missena' },
        geometry: [
          { lat: 38.90, lon: -0.47 },
          { lat: 38.91, lon: -0.46 },
        ],
      },
      {
        type: 'way',
        tags: { natural: 'water', leisure: 'swimming_pool' },
        geometry: [
          { lat: 38.904, lon: -0.465 },
          { lat: 38.904, lon: -0.4648 },
          { lat: 38.9042, lon: -0.4648 },
          { lat: 38.9042, lon: -0.465 },
          { lat: 38.904, lon: -0.465 },
        ],
      },
      {
        type: 'way',
        tags: { natural: 'water' }, // ~40x40m unnamed farm balsa (~1600 m2 < 3500 m2)
        geometry: [
          { lat: 38.898, lon: -0.457 },
          { lat: 38.898, lon: -0.45655 },
          { lat: 38.89835, lon: -0.45655 },
          { lat: 38.89835, lon: -0.457 },
          { lat: 38.898, lon: -0.457 },
        ],
      },
    ]);
    expect(parsed.waterPolygons).toHaveLength(0);

    // 2. Raster connected-component filter drops scattered 4x4 farm balsas/pools (16px < 45px)
    const farmRgba = new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE * 4);
    for (let i = 0; i < farmRgba.length; i += 4) {
      farmRgba[i] = 242;
      farmRgba[i + 1] = 239;
      farmRgba[i + 2] = 233;
      farmRgba[i + 3] = 255;
    }
    // Paint two isolated 4x4 pools in A1 and H1
    for (const [ox, oy] of [
      [4, 4],
      [118, 4],
    ]) {
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const idx = ((oy + dy) * RASTER_SIZE + (ox + dx)) * 4;
          farmRgba[idx] = 170;
          farmRgba[idx + 1] = 211;
          farmRgba[idx + 2] = 223;
          farmRgba[idx + 3] = 255;
        }
      }
    }
    const farmMask = buildWaterMaskFromRgba128(farmRgba);
    expect(farmMask.waterCoveragePct).toBe(0);
    expect(farmMask.waterCells).toHaveLength(0);
  });

  it('excludes corner-grazing A1 land cells from fallback sampling and keeps pins clear of cell boundary lines (AC-F02-11)', () => {
    // Polygon covers C3..F6 and barely touches 1% of the SE corner of A1
    const cornerGrazingPoly: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.9752, 39.2548], // barely inside SE corner of A1
            [-0.97, 39.255],
            [-0.95, 39.255],
            [-0.95, 39.23],
            [-0.97, 39.23],
            [-0.9752, 39.2548],
          ],
        ],
      },
    };

    const sampled = sampleDistinctWaterCoordinates(bbox, [cornerGrazingPoly], null, 6);
    expect(sampled.length).toBeGreaterThanOrEqual(4);
    for (const p of sampled) {
      // Every sampled coordinate must stay clear of 12.5% grid borders (>= 1.8% margin inside its cell)
      const xInCell = p.x_percent % 12.5;
      const yInCell = p.y_percent % 12.5;
      expect(xInCell).toBeGreaterThanOrEqual(1.8);
      expect(xInCell).toBeLessThanOrEqual(10.7);
      expect(yInCell).toBeGreaterThanOrEqual(1.8);
      expect(yInCell).toBeLessThanOrEqual(10.7);
      expect(p.cell_id).toBe(percentToCellId(p.x_percent, p.y_percent));
    }

    // Spot placed directly on the E6/F6 vertical boundary (x=62.5%) inside full-water polygon is nudged clear of the grid line
    const fullWaterPoly: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.98, 39.22],
            [-0.94, 39.22],
            [-0.94, 39.26],
            [-0.98, 39.26],
            [-0.98, 39.22],
          ],
        ],
      },
    };
    const borderSpot: GridArtifactSpot = {
      rank: 2,
      color: 'green',
      cell_id: 'F6',
      grid_cells_label: 'Grid F6',
      title: 'Borderline Pin',
      x_percent: 62.5,
      y_percent: 66.0,
      target_species: ['Brown Trout'],
      access_mode: 'hike_in',
      access_summary: 'Trail',
      depth_structure: 'Shelf',
      why_label: "Why it's great:",
      why_this_spot: 'Point.',
      how_to_fish: 'Cast.',
    };
    const fixed = constrainSpotsToWaterMask([borderSpot], bbox, [fullWaterPoly]);
    const xMod = fixed[0].x_percent % 12.5;
    expect(xMod).toBeGreaterThanOrEqual(1.8);
    expect(xMod).toBeLessThanOrEqual(10.7);
    expect(fixed[0].cell_id).toBe(percentToCellId(fixed[0].x_percent, fixed[0].y_percent));
  });

  it('never bypasses vector water verification to unverified raw raster points and rejects OSM label blues', () => {
    // 1. OSM blue highway/label color (140, 185, 215) should NOT be classified as water
    const shieldRgba = new Uint8ClampedArray(RASTER_SIZE * RASTER_SIZE * 4);
    for (let y = 0; y < RASTER_SIZE; y++) {
      for (let x = 0; x < RASTER_SIZE; x++) {
        const idx = (y * RASTER_SIZE + x) * 4;
        if (x >= 20 && x <= 60 && y >= 20 && y <= 60) {
          shieldRgba[idx] = 140;
          shieldRgba[idx + 1] = 185;
          shieldRgba[idx + 2] = 215;
          shieldRgba[idx + 3] = 255;
        } else {
          shieldRgba[idx] = 173;
          shieldRgba[idx + 1] = 209;
          shieldRgba[idx + 2] = 158;
          shieldRgba[idx + 3] = 255;
        }
      }
    }
    const shieldMask = buildWaterMaskFromRgba128(shieldRgba);
    expect(shieldMask.waterCoveragePct).toBe(0);

    // 2. When vector polygons only cover A1..A2 (< 3 raster hits), do NOT fall back to unverified dry raster points in G5/H7
    const narrowLeftPoly: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.98, 39.25],
            [-0.975, 39.25],
            [-0.975, 39.26],
            [-0.98, 39.26],
            [-0.98, 39.25],
          ],
        ],
      },
    };
    const fakeRasterMask = {
      waterCoveragePct: 12,
      waterCells: ['A1', 'G5', 'H7'],
      sampledWaterPoints: [
        { x_percent: 6.2, y_percent: 6.2, cell_id: 'A1' },
        { x_percent: 81.2, y_percent: 56.2, cell_id: 'G5' },
        { x_percent: 93.8, y_percent: 81.2, cell_id: 'H7' },
      ],
    };
    const sampled = sampleDistinctWaterCoordinates(bbox, [narrowLeftPoly], fakeRasterMask, 6);
    expect(sampled.length).toBeGreaterThanOrEqual(1);
    for (const pt of sampled) {
      expect(pt.x_percent).toBeLessThan(15);
    }

    // 3. Steep bank access never blindly recommends boat/kayak without verification caveat
    const steepNoRoad = classifySpotRoadAccess({
      spotLng: -0.975,
      spotLat: 39.24,
      roads: [],
      sectorReliefM: 45,
    });
    expect(steepNoRoad.access_summary.toLowerCase()).not.toContain('boat/kayak recommended');
    expect(steepNoRoad.access_summary.toLowerCase()).toContain('verify');
  });

  it('parses regional admin_level=4 boundaries, frames offshore access honestly, and routes game plan around water without cross-water walk claims', () => {
    const boundaryParsed = parseOverpassWaterAndRoadsElements([
      {
        type: 'way',
        tags: { boundary: 'administrative', admin_level: '4', name: 'Galicia - Castilla y León' },
        geometry: [
          { lat: 42.44, lon: -6.84 },
          { lat: 42.47, lon: -6.84 },
        ],
      },
    ]);
    expect(boundaryParsed.hasRegionalBoundary).toBe(true);

    // Offshore open-basin access must never say bare footpath approach without long-cast/watercraft framing
    const offshoreAccess = classifySpotRoadAccess({
      spotLng: -0.96,
      spotLat: 39.24,
      roads: [
        {
          name: 'OU-622',
          highway: 'tertiary',
          surface: 'asphalt',
          coordinates: [
            [-0.962, 39.24],
            [-0.962, 39.25],
          ],
        },
      ],
      sectorReliefM: 2,
      isOffshoreOpenWater: true,
    });
    expect(offshoreAccess.access_summary.toLowerCase()).not.toContain('footpath approach');
    expect(offshoreAccess.access_summary.toLowerCase()).toMatch(/long-cast|offshore|watercraft/);

    // Game plan: picks gentlest shoreline (+8m) over steeper (+16m), routes around water cove, omits floatation when zero boat spots
    const baseSpot = {
      grid_cells_label: '',
      title: 'Test',
      target_species: ['Brown Trout'],
      depth_structure: 'Shoreline margin',
      why_label: 'Feature Breakdown:',
      why_this_spot: 'Test',
      secondary_label: 'Access:',
      secondary_text: 'Test',
      how_to_fish: 'Test',
    };
    const spots: GridArtifactSpot[] = [
      {
        ...baseSpot,
        rank: 1,
        color: 'green',
        cell_id: 'D3',
        grid_cells_label: 'Grid D3',
        x_percent: 40,
        y_percent: 30,
        access_mode: 'hike_in',
        access_summary: 'Moderate hike-in bank (~+16m slope) — footpath approach from perimeter road',
      },
      {
        ...baseSpot,
        rank: 2,
        color: 'green',
        cell_id: 'F1',
        grid_cells_label: 'Grid F1',
        x_percent: 65,
        y_percent: 10,
        access_mode: 'hike_in',
        access_summary: 'Gentle bank (~+8m slope) — footpath approach from perimeter road',
      },
    ];
    // Cove polygon sits directly between D3 (40%,30%) and F1 (65%,10%)
    const covePoly: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.966, 39.245],
            [-0.952, 39.245],
            [-0.952, 39.258],
            [-0.966, 39.258],
            [-0.966, 39.245],
          ],
        ],
      },
    };
    const plan = buildDynamicGamePlan(spots, bbox, 'Galicia', [covePoly]);
    expect(plan[0]).toContain('Spot 2 (Grid F1)'); // gentler +8m chosen over +16m Spot 1
    expect(plan[1].toLowerCase()).not.toContain('walk ~'); // crosses cove water -> perimeter wording
    expect(plan.join(' ').toLowerCase()).not.toContain('floatation'); // no watercraft spots
  });

  it('enforces >=18% farthest-point spacing, <=75m shore vs >75m boat_only boundary, peninsula detection, and no global street copy-paste', () => {
    // 1. Wide reservoir polygon with clustered raster points in A1/B1/A2/B2 + distant points
    const widePoly: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.98, 39.22],
            [-0.94, 39.22],
            [-0.94, 39.26],
            [-0.98, 39.26],
            [-0.98, 39.22],
          ],
        ],
      },
    };
    const clusteredMask = {
      waterCoveragePct: 90,
      waterCells: ['A1', 'B1', 'A2', 'B2', 'G2', 'B7', 'G7', 'D4'],
      sampledWaterPoints: [
        { x_percent: 6.2, y_percent: 6.2, cell_id: 'A1' },
        { x_percent: 18.8, y_percent: 6.2, cell_id: 'B1' },
        { x_percent: 6.2, y_percent: 18.8, cell_id: 'A2' },
        { x_percent: 18.8, y_percent: 18.8, cell_id: 'B2' },
        { x_percent: 81.2, y_percent: 18.8, cell_id: 'G2' },
        { x_percent: 18.8, y_percent: 81.2, cell_id: 'B7' },
        { x_percent: 81.2, y_percent: 81.2, cell_id: 'G7' },
        { x_percent: 43.8, y_percent: 43.8, cell_id: 'D4' },
      ],
    };
    const spread = sampleDistinctWaterCoordinates(bbox, [widePoly], clusteredMask, 5);
    expect(spread.length).toBe(5);
    // Minimum pairwise Euclidean percent separation should avoid A1/B2 tight clustering
    for (let i = 0; i < spread.length; i++) {
      for (let j = i + 1; j < spread.length; j++) {
        const d = Math.hypot(spread[i].x_percent - spread[j].x_percent, spread[i].y_percent - spread[j].y_percent);
        expect(d).toBeGreaterThanOrEqual(18);
      }
    }

    // 2. Crisp <= 75m shore vs > 75m boat_only boundary
    const farOffshore = classifySpotRoadAccess({
      spotLng: -0.96,
      spotLat: 39.24,
      roads: [],
      sectorReliefM: 2,
      shoreDistanceM: 160,
      shoreDirection: 'west',
    });
    expect(farOffshore.access_mode).toBe('boat_only');
    expect(farOffshore.access_summary.toLowerCase()).toContain('watercraft');
    expect(farOffshore.access_summary.toLowerCase()).not.toContain('footpath');

    // 3. No global town street name copy-pasted when roads[] is empty
    const noLocalRoad = classifySpotRoadAccess({
      spotLng: -0.96,
      spotLat: 39.24,
      roads: [],
      sectorReliefM: 2,
      shoreDistanceM: 25,
      shoreDirection: 'east',
    });
    expect(noLocalRoad.access_summary).not.toContain('Calle Gran Vía');

    // 4. Peninsula/point polygon jutting into water classifies off-tip water as shore_point ('point'), and open water uses 'depth_change' (not 'channel')
    const lakeWithPeninsula: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.98, 39.22],
            [-0.94, 39.22],
            [-0.94, 39.26],
            [-0.98, 39.26],
            [-0.98, 39.22],
          ],
          // Inner island/peninsula hole or notch simulated via outer ring notch:
        ],
      },
    };
    const notchLake: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.98, 39.22],
            [-0.94, 39.22],
            [-0.94, 39.26],
            [-0.958, 39.26],
            [-0.958, 39.242], // peninsula jutting down to (55% x, 45% y)
            [-0.962, 39.242],
            [-0.962, 39.26],
            [-0.98, 39.26],
            [-0.98, 39.22],
          ],
        ],
      },
    };
    const peninsulaSpot = classifyWaterCoordGeometry(
      { x_percent: 50, y_percent: 46, cell_id: 'E4' }, // right off peninsula tip (~40m)
      bbox,
      [notchLake],
      2
    );
    expect(peninsulaSpot.features.map((f) => f.feature)).toContain('point');
    expect(peninsulaSpot.title.toLowerCase()).toMatch(/point|peninsula/);

    const openBasinSpot = classifyWaterCoordGeometry(
      { x_percent: 25, y_percent: 75, cell_id: 'C7' }, // > 500m from shore in wide lake
      bbox,
      [lakeWithPeninsula],
      2
    );
    expect(openBasinSpot.features.map((f) => f.feature)).not.toContain('channel');
    expect(openBasinSpot.features.map((f) => f.feature)).toContain('depth_change');

    // 5. Game plan skips trivial <120m hop between identical low-tier spots and never walks to boat_only
    const baseSpot = {
      grid_cells_label: '',
      title: 'Test',
      target_species: ['Common Carp'],
      depth_structure: 'Gentle east-bank bay (~25m off east shore)',
      why_label: 'Feature Breakdown:',
      why_this_spot: 'Test',
      secondary_label: 'Access:',
      secondary_text: 'Test',
      how_to_fish: 'Test',
    };
    const multiSpots: GridArtifactSpot[] = [
      {
        ...baseSpot,
        rank: 1,
        color: 'green',
        rating: 4.1,
        cell_id: 'C8',
        grid_cells_label: 'Grid C8',
        x_percent: 30,
        y_percent: 90,
        access_mode: 'boat_only',
        access_summary: 'Offshore open-basin position (~180m from south shore) — permitted watercraft required',
        depth_structure: 'Mid-basin open water (~180m off south shore)',
      },
      {
        ...baseSpot,
        rank: 2,
        color: 'green',
        rating: 2.1,
        cell_id: 'H4',
        grid_cells_label: 'Grid H4',
        x_percent: 92,
        y_percent: 44,
        access_mode: 'hike_in',
        access_summary: 'Gentle bank (~+0m slope) — footpath approach',
      },
      {
        ...baseSpot,
        rank: 3,
        color: 'blue',
        rating: 2.1,
        cell_id: 'H5',
        grid_cells_label: 'Grid H5',
        x_percent: 92,
        y_percent: 45, // ~44m from H4, identical 2.1 rating
        access_mode: 'hike_in',
        access_summary: 'Gentle bank (~+0m slope) — footpath approach',
      },
      {
        ...baseSpot,
        rank: 4,
        color: 'blue',
        rating: 3.5,
        cell_id: 'F3',
        grid_cells_label: 'Grid F3',
        x_percent: 68,
        y_percent: 30,
        access_mode: 'hike_in',
        access_summary: 'Gentle bank (~+2m slope) — footpath approach',
        depth_structure: 'Sheltered north-east bay (~30m off north shore)',
      },
    ];
    const smartPlan = buildDynamicGamePlan(multiSpots, bbox, 'Aragón', []);
    expect(smartPlan[0]).toContain('Spot 2 (Grid H4)');
    expect(smartPlan[1]).toContain('Spot 4 (Grid F3)'); // skipped trivial 44m H4->H5 hop and avoided walking to boat_only C8
    expect(smartPlan[1].toLowerCase()).not.toContain('44m');
  });

  it('does not misclassify a ~70m wide bend as a tight channel bottleneck and uses sector-neutral shoreline titles (AC-F02-12)', () => {
    // 1km x 1km bbox
    const bbox: BoundingBox = [-6.80, 42.45, -6.788, 42.459];
    // Wide water polygon (~70m+ away from opposing bank at spot)
    const wideArm: Feature<Polygon> = {
      type: 'Feature',
      properties: { natural: 'water', name: 'Wide Arm' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-6.798, 42.451],
            [-6.790, 42.451],
            [-6.790, 42.458],
            [-6.798, 42.458],
            [-6.798, 42.451],
          ],
        ],
      },
    };

    // Pin ~20m off the west bank (x_percent ~18, y_percent ~50), >60m from east bank
    const classified = classifyWaterCoordGeometry(
      { x_percent: 18, y_percent: 50, cell_id: 'B4' },
      bbox,
      [wideArm],
      2
    );
    expect(classified.features.map((f) => f.feature)).not.toContain('channel');
    expect(classified.title).not.toMatch(/^(North|South|East|West)-Bank\b/);
    expect(classified.title).not.toMatch(/^Steep (North|South|East|West)-Bank\b/);
  });
});
