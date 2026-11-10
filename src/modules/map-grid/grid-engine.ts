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

const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const GRID_DIMENSION = 8; // 8x8 tactical grid (A1..H8)
const MAX_UNCLIPPED_SPAN_KM = 5.0;
const TACTICAL_SECTOR_RADIUS_KM = 2.0; // ~4km x 4km box -> ~500m/250m cells

const DETERMINISTIC_STRUCTURE_FEATURES: Record<string, string[]> = {
  A: ['northern_bank', 'inflow_channel'],
  B: ['reed_bed', 'shallow_shelf'],
  C: ['channel_drop_off', 'hard_mussel_bottom'],
  D: ['submerged_ledge', 'current_seam'],
  E: ['rocky_point', 'weed_margin'],
  F: ['sheltered_bay', 'silt_to_sand_transition'],
  G: ['deep_basin_slope', 'windward_point'],
  H: ['outflow_margin', 'stone_riprap'],
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
 * AC-F01-2: Small lakes (< 5km) use the full water body bounding box.
 * Large reservoirs, long rivers (e.g. Vistula, Ebro), or sea coastlines (>= 5km)
 * are clipped to a tactical sector (~2km-2.5km radius) around the clicked/pin point.
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
 * Deterministically partitions a tactical sector into an 8x8 coordinate grid (A1..H8),
 * discards dry-land cells that do not intersect the water body polygon, and attaches
 * shoreline accessibility + Layer 1/3 restriction statuses.
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

  for (let rowIdx = 0; rowIdx < GRID_DIMENSION; rowIdx++) {
    const rowLabel = ROW_LABELS[rowIdx];
    // Row A is northernmost (top of map), Row H is southernmost (bottom of map)
    const cellMaxLat = Number((maxLat - rowIdx * latStep).toFixed(6));
    const cellMinLat = Number((maxLat - (rowIdx + 1) * latStep).toFixed(6));

    for (let colIdx = 0; colIdx < GRID_DIMENSION; colIdx++) {
      const colNumber = colIdx + 1;
      const cellId = `${rowLabel}${colNumber}`;
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

      // Check how many of the 4 corners lie inside the water polygon to distinguish shoreline vs open_water
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
      if (rowIdx === 0 && (colIdx === 2 || colIdx === 3)) {
        zoneType = 'inflow_outflow';
      }

      // Check deterministic restriction zones matching cellId or intersecting bounds
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

      const baseFeatures = DETERMINISTIC_STRUCTURE_FEATURES[rowLabel] ?? [
        'natural_bank',
      ];
      const features = shoreAccessible
        ? [...baseFeatures, 'bank_casting_access']
        : [...baseFeatures, 'offshore_drop_off'];

      cells.push({
        cellId,
        rowLabel,
        colIndex: colNumber,
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
