import distance from '@turf/distance';
import booleanIntersects from '@turf/boolean-intersects';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon as turfPolygon } from '@turf/helpers';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type {
  BoundingBox,
  GridCell,
  GridZoneType,
  RestrictionStatus,
  WaterBodyRecord,
} from '@/shared/types/domain';

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const GRID_DIMENSION = 8; // 8 columns (A..H) x 8 rows (1..8) -> A1..H8
const MAX_UNCLIPPED_SPAN_KM = 5.0;
const TACTICAL_SECTOR_RADIUS_KM = 2.0;

const DETERMINISTIC_STRUCTURE_FEATURES: Record<string, string[]> = {
  A: ['western_bank', 'inflow_cove'],
  B: ['reed_bed', 'shallow_shelf'],
  C: ['cove_access', 'silt_to_sand_transition'],
  D: ['submerged_ledge', 'narrow_canyon_point'],
  E: ['main_channel_drop_off', 'rocky_peninsula_point'],
  F: ['submerged_island_margin', 'deep_terrace'],
  G: ['sheltered_bay', 'weed_margin'],
  H: ['eastern_headland', 'stone_riprap'],
};

/**
 * Calculates the maximum horizontal or vertical span of a bounding box in kilometers.
 */
export function calculateBboxSpanKm(bbox: BoundingBox): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;

  const widthKm = distance(point([minLng, midLat]), point([maxLng, midLat]), {
    units: 'kilometers',
  });
  const heightKm = distance(point([midLng, minLat]), point([midLng, maxLat]), {
    units: 'kilometers',
  });

  return Math.max(widthKm, heightKm);
}

/**
 * Small lakes (< 5km) use the full water body bounding box.
 * Large reservoirs, long rivers, or sea coastlines (>= 5km) are clipped to a
 * tactical sector (~2km-2.5km radius) around the focus coordinate.
 */
export function resolveTacticalSectorBbox(
  waterBodyBbox: BoundingBox,
  focusCoord: { latitude: number; longitude: number }
): BoundingBox {
  const spanKm = calculateBboxSpanKm(waterBodyBbox);
  if (spanKm < MAX_UNCLIPPED_SPAN_KM) {
    return waterBodyBbox;
  }

  const latDelta = TACTICAL_SECTOR_RADIUS_KM / 111.32;
  const cosLat = Math.max(
    0.2,
    Math.cos((focusCoord.latitude * Math.PI) / 180)
  );
  const lngDelta = TACTICAL_SECTOR_RADIUS_KM / (111.32 * cosLat);

  return [
    Number((focusCoord.longitude - lngDelta).toFixed(5)),
    Number((focusCoord.latitude - latDelta).toFixed(5)),
    Number((focusCoord.longitude + lngDelta).toFixed(5)),
    Number((focusCoord.latitude + latDelta).toFixed(5)),
  ];
}

export interface GenerateGridParams {
  sectorBbox: BoundingBox;
  waterPolygon: Feature<Polygon | MultiPolygon>;
  restrictionZones: WaterBodyRecord['restrictionZones'];
}

/**
 * Deterministically partitions a tactical sector into an 8x8 coordinate grid:
 * Columns A..H (West to East) and Rows 1..8 (North to South), so top row is A1..H1
 * and bottom row is A8..H8.
 * Filters out dry-land cells that do not intersect the water body polygon.
 */
export function generateSpatialGrid({
  sectorBbox,
  waterPolygon,
  restrictionZones,
}: GenerateGridParams): GridCell[] {
  const [minLng, minLat, maxLng, maxLat] = sectorBbox;
  const lngStep = (maxLng - minLng) / GRID_DIMENSION;
  const latStep = (maxLat - minLat) / GRID_DIMENSION;

  const overallStatusRule = restrictionZones.find(
    (z) => !z.cellId && !z.bounds
  );
  const defaultStatus: RestrictionStatus =
    overallStatusRule?.status ?? 'allowed';

  const cells: GridCell[] = [];

  // Row 1 is northernmost (top of map), Row 8 is southernmost (bottom of map)
  for (let rowIdx = 0; rowIdx < GRID_DIMENSION; rowIdx++) {
    const rowNumber = rowIdx + 1;
    const cellMaxLat = Number((maxLat - rowIdx * latStep).toFixed(6));
    const cellMinLat = Number((maxLat - (rowIdx + 1) * latStep).toFixed(6));

    // Col A is westernmost (left of map), Col H is easternmost (right of map)
    for (let colIdx = 0; colIdx < GRID_DIMENSION; colIdx++) {
      const colLabel = COL_LABELS[colIdx];
      const cellId = `${colLabel}${rowNumber}`;
      const cellMinLng = Number((minLng + colIdx * lngStep).toFixed(6));
      const cellMaxLng = Number((minLng + (colIdx + 1) * lngStep).toFixed(6));

      const cellPoly = turfPolygon([
        [
          [cellMinLng, cellMinLat],
          [cellMaxLng, cellMinLat],
          [cellMaxLng, cellMaxLat],
          [cellMinLng, cellMaxLat],
          [cellMinLng, cellMinLat],
        ],
      ]);

      const intersectsWater = booleanIntersects(cellPoly, waterPolygon);
      if (!intersectsWater) {
        continue;
      }

      const centerLat = Number(((cellMinLat + cellMaxLat) / 2).toFixed(6));
      const centerLng = Number(((cellMinLng + cellMaxLng) / 2).toFixed(6));

      const corners = [
        point([cellMinLng, cellMinLat]),
        point([cellMaxLng, cellMinLat]),
        point([cellMaxLng, cellMaxLat]),
        point([cellMinLng, cellMaxLat]),
      ];
      const cornersInWater = corners.filter((pt) =>
        booleanPointInPolygon(pt, waterPolygon)
      ).length;

      const isEdgeRowOrCol =
        rowIdx === 0 ||
        rowIdx === GRID_DIMENSION - 1 ||
        colIdx === 0 ||
        colIdx === GRID_DIMENSION - 1;

      const shoreAccessible = cornersInWater < 4 || isEdgeRowOrCol;
      let zoneType: GridZoneType = shoreAccessible
        ? 'shoreline'
        : (rowIdx + colIdx) % 2 === 0
          ? 'structure'
          : 'open_water';
      if (rowIdx === 0 && (colIdx === 3 || colIdx === 4)) {
        zoneType = 'inflow_outflow';
      }

      let restrictionStatus: RestrictionStatus = defaultStatus;
      let restrictionReason: string | undefined = overallStatusRule?.reason;

      for (const rz of restrictionZones) {
        if (rz.cellId && rz.cellId.toUpperCase() === cellId) {
          restrictionStatus = rz.status;
          restrictionReason = rz.reason;
          break;
        }
        if (rz.bounds) {
          const [rzMinLng, rzMinLat, rzMaxLng, rzMaxLat] = rz.bounds;
          const overlapsBounds =
            cellMinLng <= rzMaxLng &&
            cellMaxLng >= rzMinLng &&
            cellMinLat <= rzMaxLat &&
            cellMaxLat >= rzMinLat;
          if (overlapsBounds) {
            restrictionStatus = rz.status;
            restrictionReason = rz.reason;
            break;
          }
        }
      }

      const baseFeatures = DETERMINISTIC_STRUCTURE_FEATURES[colLabel] ?? [
        'natural_bank',
      ];
      const features = shoreAccessible
        ? [...baseFeatures, 'bank_casting_access']
        : [...baseFeatures, 'offshore_drop_off'];

      cells.push({
        cellId,
        rowLabel: colLabel,
        colIndex: rowNumber,
        bounds: [cellMinLng, cellMinLat, cellMaxLng, cellMaxLat],
        center: { latitude: centerLat, longitude: centerLng },
        zoneType,
        shoreAccessible,
        features,
        restrictionStatus,
        restrictionReason,
      });
    }
  }

  return cells;
}
