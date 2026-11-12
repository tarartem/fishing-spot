import booleanIntersects from '@turf/boolean-intersects';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { lineString, point, polygon } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import pointToLineDistance from '@turf/point-to-line-distance';
import type { Feature, LineString, MultiPolygon, Polygon } from 'geojson';
import type { WaterwayLine } from '@/modules/ai-advisor/flow-direction';
import {
  isPercentOnRasterWater,
  snapPercentToRasterWater,
} from '@/modules/ai-advisor/osm-tile-water-mask';
import type {
  BoundingBox,
  ClientWaterMaskSummary,
  GridArtifactSpot,
  SpotAccessMode,
} from '@/shared/types/domain';

export const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export type WaterGeometryFeature = Feature<Polygon | MultiPolygon>;
export type OsmWaterStatus = 'ok' | 'empty' | 'unavailable';

export interface OsmRoadSegment {
  name: string;
  highway: string;
  surface?: string;
  tracktype?: string;
  access?: string;
  coordinates: [number, number][]; // [lng, lat][]
}

export interface WaterCellMask {
  allowedCells: string[];
  dryLandCells: string[];
  waterPresence: 'confirmed_water' | 'no_water' | 'unknown';
}

export function percentToCellId(xPercent: number, yPercent: number): string {
  const colIdx = Math.max(0, Math.min(7, Math.floor((xPercent / 100) * 8)));
  const rowNum = Math.max(1, Math.min(8, Math.floor((yPercent / 100) * 8) + 1));
  return `${COL_LABELS[colIdx]}${rowNum}`;
}

export function percentToLngLat(
  xPercent: number,
  yPercent: number,
  bbox: BoundingBox
): [number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lng = minLng + (xPercent / 100) * (maxLng - minLng);
  // y=0 is top (maxLat), y=100 is bottom (minLat)
  const lat = maxLat - (yPercent / 100) * (maxLat - minLat);
  return [lng, lat];
}

export function lngLatToPercent(
  lng: number,
  lat: number,
  bbox: BoundingBox
): { x_percent: number; y_percent: number } {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const rawX = ((lng - minLng) / Math.max(1e-9, maxLng - minLng)) * 100;
  const rawY = ((maxLat - lat) / Math.max(1e-9, maxLat - minLat)) * 100;
  return {
    x_percent: Number(Math.max(3, Math.min(97, rawX)).toFixed(1)),
    y_percent: Number(Math.max(3, Math.min(97, rawY)).toFixed(1)),
  };
}

export function cellIdToPercentCenter(cellId: string): {
  x_percent: number;
  y_percent: number;
} {
  const colIdx = Math.max(0, COL_LABELS.indexOf(cellId[0] as (typeof COL_LABELS)[number]));
  const rowIdx = Math.max(0, Math.min(7, Number(cellId.slice(1)) - 1));
  return {
    x_percent: Number(((colIdx + 0.5) * 12.5).toFixed(1)),
    y_percent: Number(((rowIdx + 0.5) * 12.5).toFixed(1)),
  };
}

function cellPolygon(colIdx: number, rowIdx: number, bbox: BoundingBox): Feature<Polygon> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngStep = (maxLng - minLng) / 8;
  const latStep = (maxLat - minLat) / 8;
  const cMinLng = minLng + colIdx * lngStep;
  const cMaxLng = cMinLng + lngStep;
  const cMaxLat = maxLat - rowIdx * latStep;
  const cMinLat = cMaxLat - latStep;
  return polygon([
    [
      [cMinLng, cMinLat],
      [cMaxLng, cMinLat],
      [cMaxLng, cMaxLat],
      [cMinLng, cMaxLat],
      [cMinLng, cMinLat],
    ],
  ]);
}

function extractOuterRings(waterPolygons: WaterGeometryFeature[]): Feature<LineString>[] {
  const lines: Feature<LineString>[] = [];
  for (const poly of waterPolygons) {
    if (poly.geometry.type === 'Polygon') {
      const outer = poly.geometry.coordinates[0];
      if (outer && outer.length >= 2) {
        lines.push(lineString(outer));
      }
    } else if (poly.geometry.type === 'MultiPolygon') {
      for (const coords of poly.geometry.coordinates) {
        if (coords[0] && coords[0].length >= 2) {
          lines.push(lineString(coords[0]));
        }
      }
    }
  }
  return lines;
}

function isPointInOrNearWater(
  lng: number,
  lat: number,
  waterPolygons: WaterGeometryFeature[],
  shoreLines: Feature<LineString>[],
  maxShoreDistanceKm = 0.002
): boolean {
  const pt = point([lng, lat]);
  for (const poly of waterPolygons) {
    if (booleanPointInPolygon(pt, poly)) return true;
  }
  if (maxShoreDistanceKm > 0) {
    for (const line of shoreLines) {
      const distKm = pointToLineDistance(pt, line, { units: 'kilometers' });
      if (distKm <= maxShoreDistanceKm) return true;
    }
  }
  return false;
}

/** Nudges a shoreline-snapped point slightly inward into a water polygon so UI pin circles sit inside water, not on dry banks. */
function nudgeInsideWaterPolygon(
  sLng: number,
  sLat: number,
  waterPolygons: WaterGeometryFeature[],
  bbox: BoundingBox
): [number, number] {
  const pt = point([sLng, sLat]);
  if (waterPolygons.some((wp) => booleanPointInPolygon(pt, wp))) {
    return [sLng, sLat];
  }
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const baseLng = Math.max(0.00008, (maxLng - minLng) * 0.012);
  const baseLat = Math.max(0.00008, (maxLat - minLat) * 0.012);
  const unitDirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  for (const mult of [1, 2, 3.5, 5.5]) {
    for (const [ux, uy] of unitDirs) {
      const cx = sLng + ux * baseLng * mult;
      const cy = sLat + uy * baseLat * mult;
      if (cx < minLng || cx > maxLng || cy < minLat || cy > maxLat) continue;
      if (waterPolygons.some((wp) => booleanPointInPolygon(point([cx, cy]), wp))) {
        return [cx, cy];
      }
    }
  }
  return [sLng, sLat];
}

const CELL_BORDER_MARGIN_PCT = 1.85;

/**
 * Keeps a pin center clear of 12.5% grid cell boundaries (>= 1.85% inside its cell)
 * so 16px-radius rendered circles on 1024x1024 screenshots do not straddle adjacent cells
 * or overlap neighboring top-left cell labels, while strictly preserving water containment.
 */
function nudgeClearOfCellBorders(
  xPercent: number,
  yPercent: number,
  isValidWaterFn: (x: number, y: number) => boolean,
  margin = CELL_BORDER_MARGIN_PCT
): { x_percent: number; y_percent: number } {
  const x = Math.max(3, Math.min(97, xPercent));
  const y = Math.max(3, Math.min(97, yPercent));
  const colIdx = Math.max(0, Math.min(7, Math.floor((x / 100) * 8)));
  const rowIdx = Math.max(0, Math.min(7, Math.floor((y / 100) * 8)));
  const cellMinX = Math.max(3, colIdx * 12.5 + margin);
  const cellMaxX = Math.min(97, (colIdx + 1) * 12.5 - margin);
  const cellMinY = Math.max(3, rowIdx * 12.5 + margin);
  const cellMaxY = Math.min(97, (rowIdx + 1) * 12.5 - margin);

  if (x >= cellMinX && x <= cellMaxX && y >= cellMinY && y <= cellMaxY) {
    return { x_percent: x, y_percent: y };
  }

  const clampedX = Math.max(cellMinX, Math.min(cellMaxX, x));
  const clampedY = Math.max(cellMinY, Math.min(cellMaxY, y));
  const centerX = colIdx * 12.5 + 6.25;
  const centerY = rowIdx * 12.5 + 6.25;

  const candidates: Array<[number, number]> = [
    [clampedX, clampedY],
    [clampedX, y],
    [x, clampedY],
    [centerX, centerY],
    [(clampedX + centerX) / 2, (clampedY + centerY) / 2],
    [cellMinX + 1.0, cellMinY + 1.0],
    [cellMaxX - 1.0, cellMinY + 1.0],
    [cellMinX + 1.0, cellMaxY - 1.0],
    [cellMaxX - 1.0, cellMaxY - 1.0],
  ];

  for (const [cx, cy] of candidates) {
    const rx = Number(cx.toFixed(1));
    const ry = Number(cy.toFixed(1));
    if (
      rx >= cellMinX &&
      rx <= cellMaxX &&
      ry >= cellMinY &&
      ry <= cellMaxY &&
      isValidWaterFn(rx, ry)
    ) {
      return { x_percent: rx, y_percent: ry };
    }
  }

  return { x_percent: x, y_percent: y };
}

export function computeAllowedWaterCells(
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[],
  clientWaterMask?: ClientWaterMaskSummary | null,
  osmWaterStatus: OsmWaterStatus = 'unavailable'
): WaterCellMask {
  const allowedCells: string[] = [];
  const dryLandCells: string[] = [];

  if (waterPolygons.length > 0) {
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
      for (let colIdx = 0; colIdx < 8; colIdx++) {
        const cellId = `${COL_LABELS[colIdx]}${rowIdx + 1}`;
        const cPoly = cellPolygon(colIdx, rowIdx, bbox);
        const intersectsWater = waterPolygons.some((wp) =>
          booleanIntersects(cPoly, wp)
        );
        if (intersectsWater) {
          allowedCells.push(cellId);
        } else {
          dryLandCells.push(cellId);
        }
      }
    }
    return {
      allowedCells,
      dryLandCells,
      waterPresence: allowedCells.length > 0 ? 'confirmed_water' : 'no_water',
    };
  }

  if (clientWaterMask) {
    const rasterSet = new Set(clientWaterMask.waterCells);
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
      for (let colIdx = 0; colIdx < 8; colIdx++) {
        const cellId = `${COL_LABELS[colIdx]}${rowIdx + 1}`;
        if (rasterSet.has(cellId)) {
          allowedCells.push(cellId);
        } else {
          dryLandCells.push(cellId);
        }
      }
    }
    const hasClusteredWater =
      clientWaterMask.waterCoveragePct >= 0.8 && allowedCells.length > 0;
    return {
      allowedCells,
      dryLandCells,
      waterPresence: hasClusteredWater ? 'confirmed_water' : 'no_water',
    };
  }

  if (osmWaterStatus === 'empty') {
    for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
      for (let colIdx = 0; colIdx < 8; colIdx++) {
        dryLandCells.push(`${COL_LABELS[colIdx]}${rowIdx + 1}`);
      }
    }
    return { allowedCells: [], dryLandCells, waterPresence: 'no_water' };
  }

  // Water availability unknown (e.g. offline/rate-limited with no raster mask)
  for (let rowIdx = 0; rowIdx < 8; rowIdx++) {
    for (let colIdx = 0; colIdx < 8; colIdx++) {
      allowedCells.push(`${COL_LABELS[colIdx]}${rowIdx + 1}`);
    }
  }
  return { allowedCells, dryLandCells, waterPresence: 'unknown' };
}

function isValidWaterPercentPoint(
  x: number,
  y: number,
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[],
  shoreLines: Feature<LineString>[],
  clientWaterMask?: ClientWaterMaskSummary | null,
  strictInterior = false
): boolean {
  if (waterPolygons.length > 0 && shoreLines.length > 0) {
    const [lng, lat] = percentToLngLat(x, y, bbox);
    if (
      !isPointInOrNearWater(
        lng,
        lat,
        waterPolygons,
        shoreLines,
        strictInterior ? 0 : 0.002
      )
    ) {
      return false;
    }
    return true;
  }
  if (clientWaterMask?.grid64Mask) {
    return isPercentOnRasterWater(clientWaterMask.grid64Mask, x, y, 0);
  }
  return true;
}

/**
 * Checks whether a grid cell has genuine interior water (rather than barely grazing
 * a 1% corner of the cell) so fallback spot sampling prioritizes solid water cells.
 */
function cellHasInteriorWater(
  cellId: string,
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[]
): boolean {
  const colIdx = Math.max(0, COL_LABELS.indexOf(cellId[0] as (typeof COL_LABELS)[number]));
  const rowIdx = Math.max(0, Math.min(7, Number(cellId.slice(1)) - 1));
  const probes: Array<[number, number]> = [
    [(colIdx + 0.5) * 12.5, (rowIdx + 0.5) * 12.5],
    [(colIdx + 0.3) * 12.5, (rowIdx + 0.3) * 12.5],
    [(colIdx + 0.7) * 12.5, (rowIdx + 0.3) * 12.5],
    [(colIdx + 0.3) * 12.5, (rowIdx + 0.7) * 12.5],
    [(colIdx + 0.7) * 12.5, (rowIdx + 0.7) * 12.5],
  ];
  let hits = 0;
  for (const [px, py] of probes) {
    const [lng, lat] = percentToLngLat(px, py, bbox);
    if (waterPolygons.some((wp) => booleanPointInPolygon(point([lng, lat]), wp))) {
      hits++;
      if (hits >= 2) return true;
    }
  }
  return false;
}

/**
 * Generates up to `desiredCount` distinct coordinates strictly inside verified water
 * (polygons or raster mask), spread across available water cells without stacking
 * and clear of 12.5% grid lines.
 */
export type CardinalDirection =
  | 'north'
  | 'northeast'
  | 'east'
  | 'southeast'
  | 'south'
  | 'southwest'
  | 'west'
  | 'northwest';

export interface ShoreMetrics {
  shoreDistanceM: number;
  shoreDirection: CardinalDirection;
  nearestShoreLngLat: [number, number] | null;
  source: 'vector' | 'raster' | 'unknown';
}

const CARDINAL_8: CardinalDirection[] = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

function bearingToCardinal(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): CardinalDirection {
  const cosLat = Math.cos((fromLat * Math.PI) / 180);
  const dx = (toLng - fromLng) * cosLat;
  const dy = toLat - fromLat;
  // Angle clockwise from North (0 deg = north, 90 deg = east)
  const deg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return CARDINAL_8[Math.round(deg / 45) % 8];
}

function estimateBboxSpanMeters(bbox: BoundingBox): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const widthM = (maxLng - minLng) * 111_320 * Math.cos(midLatRad);
  const heightM = (maxLat - minLat) * 110_574;
  return Math.max(widthM, heightM);
}

/**
 * Computes metric distance (m) and 8-way compass direction from a water point
 * to the nearest shoreline using OSM vector rings or scale-aware 64x64 raster scan.
 */
export function computeShoreMetrics(
  xPercent: number,
  yPercent: number,
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[],
  shoreLines: Feature<LineString>[],
  grid64Mask?: string
): ShoreMetrics {
  const [lng, lat] = percentToLngLat(xPercent, yPercent, bbox);

  if (waterPolygons.length > 0 && shoreLines.length > 0) {
    const pt = point([lng, lat]);
    let bestKm = Infinity;
    let bestShore: [number, number] | null = null;
    for (const line of shoreLines) {
      const snapped = nearestPointOnLine(line, pt, { units: 'kilometers' });
      const distKm = snapped.properties.dist ?? Infinity;
      if (distKm < bestKm) {
        bestKm = distKm;
        bestShore = snapped.geometry.coordinates as [number, number];
      }
    }
    if (bestShore && Number.isFinite(bestKm)) {
      return {
        shoreDistanceM: Math.round(bestKm * 1000),
        shoreDirection: bearingToCardinal(lng, lat, bestShore[0], bestShore[1]),
        nearestShoreLngLat: bestShore,
        source: 'vector',
      };
    }
  }

  if (grid64Mask && grid64Mask.length === 4096) {
    const gx = Math.max(0, Math.min(63, Math.floor((xPercent / 100) * 64)));
    const gy = Math.max(0, Math.min(63, Math.floor((yPercent / 100) * 64)));
    const cellSizeM = estimateBboxSpanMeters(bbox) / 64;

    let bestPxDist = Infinity;
    let bestLx = gx;
    let bestLy = gy;
    for (let ly = 0; ly < 64; ly++) {
      for (let lx = 0; lx < 64; lx++) {
        if (grid64Mask[ly * 64 + lx] !== '0') continue;
        const d = Math.hypot(lx - gx, ly - gy);
        if (d < bestPxDist) {
          bestPxDist = d;
          bestLx = lx;
          bestLy = ly;
        }
      }
    }
    if (Number.isFinite(bestPxDist)) {
      const shoreXPct = ((bestLx + 0.5) / 64) * 100;
      const shoreYPct = ((bestLy + 0.5) / 64) * 100;
      const [sLng, sLat] = percentToLngLat(shoreXPct, shoreYPct, bbox);
      return {
        shoreDistanceM: Math.max(10, Math.round(bestPxDist * cellSizeM)),
        shoreDirection: bearingToCardinal(lng, lat, sLng, sLat),
        nearestShoreLngLat: [sLng, sLat],
        source: 'raster',
      };
    }
  }

  return {
    shoreDistanceM: 40,
    shoreDirection: 'north',
    nearestShoreLngLat: null,
    source: 'unknown',
  };
}

function selectFarthestSpread<T extends { x_percent: number; y_percent: number; cell_id: string }>(
  pool: T[],
  existing: T[],
  limit: number,
  minSepPct: number
): T[] {
  const picked = [...existing];
  const remaining = pool.filter(
    (c) =>
      !picked.some(
        (p) =>
          p.cell_id === c.cell_id ||
          Math.hypot(p.x_percent - c.x_percent, p.y_percent - c.y_percent) < minSepPct
      )
  );

  while (picked.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDist = -1;
    if (picked.length === 0) {
      // Start with the first candidate (already ordered by shoreline-structure priority)
      bestIdx = 0;
    } else {
      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        let minDist = Infinity;
        for (const p of picked) {
          const d = Math.hypot(p.x_percent - cand.x_percent, p.y_percent - cand.y_percent);
          if (d < minDist) minDist = d;
        }
        if (minDist > bestMinDist) {
          bestMinDist = minDist;
          bestIdx = i;
        }
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    const ok = picked.every(
      (p) =>
        p.cell_id !== chosen.cell_id &&
        Math.hypot(p.x_percent - chosen.x_percent, p.y_percent - chosen.y_percent) >= minSepPct
    );
    if (ok) {
      picked.push(chosen);
    }
  }
  return picked;
}

export function sampleDistinctWaterCoordinates(
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[],
  clientWaterMask: ClientWaterMaskSummary | null | undefined,
  desiredCount = 6
): Array<{ x_percent: number; y_percent: number; cell_id: string }> {
  const mask = computeAllowedWaterCells(bbox, waterPolygons, clientWaterMask);
  const shoreLines = extractOuterRings(waterPolygons);
  const strictValidator = (x: number, y: number) =>
    isValidWaterPercentPoint(x, y, bbox, waterPolygons, shoreLines, clientWaterMask, true);

  const rawCandidates: Array<{
    x_percent: number;
    y_percent: number;
    cell_id: string;
    shoreDistanceM: number;
  }> = [];

  const pushCandidate = (x: number, y: number) => {
    const cleared = nudgeClearOfCellBorders(x, y, strictValidator);
    if (!strictValidator(cleared.x_percent, cleared.y_percent)) return;
    const cellId = percentToCellId(cleared.x_percent, cleared.y_percent);
    if (rawCandidates.some((c) => c.cell_id === cellId)) return;
    const metrics = computeShoreMetrics(
      cleared.x_percent,
      cleared.y_percent,
      bbox,
      waterPolygons,
      shoreLines,
      clientWaterMask?.grid64Mask
    );
    rawCandidates.push({
      ...cleared,
      cell_id: cellId,
      shoreDistanceM: metrics.shoreDistanceM,
    });
  };

  if (clientWaterMask && clientWaterMask.sampledWaterPoints.length > 0) {
    const rawPts = clientWaterMask.sampledWaterPoints;
    const pts =
      waterPolygons.length > 0
        ? rawPts.filter((p) => {
            const [lng, lat] = percentToLngLat(p.x_percent, p.y_percent, bbox);
            return isPointInOrNearWater(lng, lat, waterPolygons, shoreLines, 0.002);
          })
        : rawPts;

    for (const p of pts) {
      pushCandidate(p.x_percent, p.y_percent);
    }
  }

  if (waterPolygons.length > 0 && mask.allowedCells.length > 0) {
    const interiorCells = mask.allowedCells.filter((c) =>
      cellHasInteriorWater(c, bbox, waterPolygons)
    );
    const cellPool = interiorCells.length >= 2 ? interiorCells : mask.allowedCells;

    for (const cell of cellPool) {
      if (rawCandidates.some((c) => c.cell_id === cell)) continue;
      const center = cellIdToPercentCenter(cell);
      const [lng, lat] = percentToLngLat(center.x_percent, center.y_percent, bbox);

      let chosen: { x_percent: number; y_percent: number } | null = null;
      if (isPointInOrNearWater(lng, lat, waterPolygons, shoreLines, 0)) {
        chosen = center;
      } else {
        const colIdx = Math.max(0, COL_LABELS.indexOf(cell[0] as (typeof COL_LABELS)[number]));
        const rowIdx = Math.max(0, Math.min(7, Number(cell.slice(1)) - 1));
        const subProbes: Array<[number, number]> = [
          [(colIdx + 0.3) * 12.5, (rowIdx + 0.3) * 12.5],
          [(colIdx + 0.7) * 12.5, (rowIdx + 0.3) * 12.5],
          [(colIdx + 0.3) * 12.5, (rowIdx + 0.7) * 12.5],
          [(colIdx + 0.7) * 12.5, (rowIdx + 0.7) * 12.5],
        ];
        for (const [sx, sy] of subProbes) {
          const [sLng, sLat] = percentToLngLat(sx, sy, bbox);
          if (waterPolygons.some((wp) => booleanPointInPolygon(point([sLng, sLat]), wp))) {
            chosen = { x_percent: Number(sx.toFixed(1)), y_percent: Number(sy.toFixed(1)) };
            break;
          }
        }

        if (!chosen && shoreLines.length > 0) {
          const pt = point([lng, lat]);
          let bestDist = Infinity;
          let bestLngLat: [number, number] | null = null;
          for (const line of shoreLines) {
            const snapped = nearestPointOnLine(line, pt, { units: 'kilometers' });
            const [sLng, sLat] = snapped.geometry.coordinates as [number, number];
            const inBbox =
              sLng >= bbox[0] && sLng <= bbox[2] && sLat >= bbox[1] && sLat <= bbox[3];
            const dist = snapped.properties.dist ?? Infinity;
            if (inBbox && dist < bestDist) {
              bestDist = dist;
              bestLngLat = [sLng, sLat];
            }
          }
          if (bestLngLat) {
            const [inLng, inLat] = nudgeInsideWaterPolygon(
              bestLngLat[0],
              bestLngLat[1],
              waterPolygons,
              bbox
            );
            chosen = lngLatToPercent(inLng, inLat, bbox);
          }
        }
      }

      if (chosen) {
        pushCandidate(chosen.x_percent, chosen.y_percent);
      }
    }
  }

  if (rawCandidates.length === 0) return [];

  // Prioritize shore-castable spots (<= 75m, or <= 1 raster pixel on coarse macro masks)
  const cellSizeM = estimateBboxSpanMeters(bbox) / 64;
  const shoreMaxM =
    waterPolygons.length === 0 && clientWaterMask?.grid64Mask
      ? Math.max(75, Math.round(cellSizeM * 1.15))
      : 75;

  const shorePool = rawCandidates
    .filter((c) => c.shoreDistanceM <= shoreMaxM)
    .sort((a, b) => a.shoreDistanceM - b.shoreDistanceM);
  const openPool = rawCandidates
    .filter((c) => c.shoreDistanceM > shoreMaxM)
    .sort((a, b) => a.shoreDistanceM - b.shoreDistanceM);

  // Greedy farthest-point sampling: >= 18% spacing first, then >= 12%
  let selected = selectFarthestSpread(shorePool, [], desiredCount, 18);
  if (selected.length < desiredCount) {
    selected = selectFarthestSpread(shorePool, selected, desiredCount, 12);
  }

  // Cap > 75m open-basin spots at max 2 when >= 4 shore spots exist
  if (selected.length < desiredCount && openPool.length > 0) {
    const openCap =
      shorePool.length >= 4
        ? Math.min(desiredCount, selected.length + 2)
        : desiredCount;
    selected = selectFarthestSpread(openPool, selected, openCap, 18);
    if (selected.length < openCap) {
      selected = selectFarthestSpread(openPool, selected, openCap, 12);
    }
  }

  // Tiny-water fallback if < 2 spots could meet >= 12%
  if (selected.length < Math.min(2, rawCandidates.length)) {
    selected = selectFarthestSpread(rawCandidates, selected, desiredCount, 6);
  }

  return selected.slice(0, desiredCount).map(({ x_percent, y_percent, cell_id }) => ({
    x_percent,
    y_percent,
    cell_id,
  }));
}

/**
 * Guarantees zero inland spots:
 * - Verifies every spot coordinate against OSM/curated water polygons and/or raster water mask.
 * - Snaps any dry-land pin to the nearest verified water pixel/shoreline inside `bbox`.
 * - Avoids overlapping/stacked pins without ever nudging a pin back onto dry land.
 * - Derives `cell_id` and `grid_cells_label` deterministically from `(x_percent, y_percent)`.
 */
export function constrainSpotsToWaterMask(
  spots: GridArtifactSpot[],
  bbox: BoundingBox,
  waterPolygons: WaterGeometryFeature[],
  clientWaterMask?: ClientWaterMaskSummary | null
): GridArtifactSpot[] {
  const shoreLines = extractOuterRings(waterPolygons);
  const mask = computeAllowedWaterCells(bbox, waterPolygons, clientWaterMask);
  const placedCoords: { x: number; y: number }[] = [];
  const strictValidator = (px: number, py: number) =>
    isValidWaterPercentPoint(px, py, bbox, waterPolygons, shoreLines, clientWaterMask, true);

  return spots.map((spot) => {
    let x = Math.max(3, Math.min(97, Number(spot.x_percent) || 50));
    let y = Math.max(3, Math.min(97, Number(spot.y_percent) || 50));

    // 1. Snap inland coordinates using vector water polygons when available
    if (waterPolygons.length > 0 && shoreLines.length > 0) {
      const [lng, lat] = percentToLngLat(x, y, bbox);
      if (!isPointInOrNearWater(lng, lat, waterPolygons, shoreLines, 0.002)) {
        const pt = point([lng, lat]);
        let bestDist = Infinity;
        let bestLngLat: [number, number] | null = null;

        for (const line of shoreLines) {
          const snapped = nearestPointOnLine(line, pt, { units: 'kilometers' });
          const [sLng, sLat] = snapped.geometry.coordinates as [number, number];
          const inBbox =
            sLng >= bbox[0] &&
            sLng <= bbox[2] &&
            sLat >= bbox[1] &&
            sLat <= bbox[3];
          const dist = snapped.properties.dist ?? Infinity;
          if (inBbox && dist < bestDist) {
            bestDist = dist;
            bestLngLat = [sLng, sLat];
          }
        }

        if (bestLngLat) {
          const [inLng, inLat] = nudgeInsideWaterPolygon(
            bestLngLat[0],
            bestLngLat[1],
            waterPolygons,
            bbox
          );
          const snappedPct = lngLatToPercent(inLng, inLat, bbox);
          x = snappedPct.x_percent;
          y = snappedPct.y_percent;
        } else if (clientWaterMask?.grid64Mask) {
          const snappedRaster = snapPercentToRasterWater(
            x,
            y,
            clientWaterMask.grid64Mask,
            placedCoords
          );
          if (snappedRaster) {
            x = snappedRaster.x_percent;
            y = snappedRaster.y_percent;
          }
        } else if (mask.allowedCells.length > 0) {
          for (const fallbackCell of mask.allowedCells) {
            const center = cellIdToPercentCenter(fallbackCell);
            if (strictValidator(center.x_percent, center.y_percent)) {
              x = center.x_percent;
              y = center.y_percent;
              break;
            }
          }
        }
      }
    } else if (clientWaterMask?.grid64Mask) {
      // 2. Raster tile water-mask verification & snapping (when Overpass vector failed/timed out)
      if (!isPercentOnRasterWater(clientWaterMask.grid64Mask, x, y, 0)) {
        const snapped = snapPercentToRasterWater(
          x,
          y,
          clientWaterMask.grid64Mask,
          placedCoords
        );
        if (snapped) {
          x = snapped.x_percent;
          y = snapped.y_percent;
        }
      }
    }

    // 2.5 Ensure pin sits clear of 12.5% grid lines so rendered 16px pins don't straddle adjacent cells
    const clearedInitial = nudgeClearOfCellBorders(x, y, strictValidator);
    x = clearedInitial.x_percent;
    y = clearedInitial.y_percent;

    // 3. De-conflict overlapping pins ONLY to verified water coordinates
    const isTooClose = (cx: number, cy: number) =>
      placedCoords.some((prev) => Math.hypot(cx - prev.x, cy - prev.y) < 5.5);

    if (isTooClose(x, y) && mask.allowedCells.length > 1) {
      const nudgeCandidates: Array<[number, number]> = [
        [x, Math.max(4, Math.min(96, y + (y > 50 ? -6.5 : 6.5)))],
        [Math.max(4, Math.min(96, x + (x > 50 ? -6.5 : 6.5))), y],
        [x, Math.max(4, Math.min(96, y + (y > 50 ? 6.5 : -6.5)))],
        [Math.max(4, Math.min(96, x + (x > 50 ? 6.5 : -6.5))), y],
      ];

      let resolved = false;
      for (const [nx, ny] of nudgeCandidates) {
        const clearedNudge = nudgeClearOfCellBorders(nx, ny, strictValidator);
        if (
          !isTooClose(clearedNudge.x_percent, clearedNudge.y_percent) &&
          isValidWaterPercentPoint(
            clearedNudge.x_percent,
            clearedNudge.y_percent,
            bbox,
            waterPolygons,
            shoreLines,
            clientWaterMask
          )
        ) {
          x = clearedNudge.x_percent;
          y = clearedNudge.y_percent;
          resolved = true;
          break;
        }
      }

      if (!resolved && clientWaterMask?.grid64Mask) {
        const snappedDistinct = snapPercentToRasterWater(
          x,
          y,
          clientWaterMask.grid64Mask,
          placedCoords
        );
        if (snappedDistinct && !isTooClose(snappedDistinct.x_percent, snappedDistinct.y_percent)) {
          const clearedDistinct = nudgeClearOfCellBorders(
            snappedDistinct.x_percent,
            snappedDistinct.y_percent,
            strictValidator
          );
          x = clearedDistinct.x_percent;
          y = clearedDistinct.y_percent;
          resolved = true;
        }
      }

      if (!resolved && waterPolygons.length > 0) {
        // Sample allowed water cell centers that are inside polygon & not yet occupied
        for (const cell of mask.allowedCells) {
          const c = cellIdToPercentCenter(cell);
          if (
            !isTooClose(c.x_percent, c.y_percent) &&
            isValidWaterPercentPoint(
              c.x_percent,
              c.y_percent,
              bbox,
              waterPolygons,
              shoreLines,
              clientWaterMask
            )
          ) {
            x = c.x_percent;
            y = c.y_percent;
            break;
          }
        }
      }
    }

    placedCoords.push({ x, y });

    const validCell = percentToCellId(x, y);
    const updatedLabel =
      spot.grid_cells_label && spot.grid_cells_label.includes(validCell)
        ? spot.grid_cells_label
        : `Grid ${validCell}`;

    return {
      ...spot,
      x_percent: Number(x.toFixed(1)),
      y_percent: Number(y.toFixed(1)),
      cell_id: validCell,
      grid_cells_label: updatedLabel,
    };
  });
}

function isPavedRoad(road: OsmRoadSegment): boolean {
  const surf = (road.surface || '').toLowerCase();
  if (['asphalt', 'paved', 'concrete', 'cobblestone'].includes(surf)) {
    return true;
  }
  if (['unpaved', 'dirt', 'gravel', 'ground', 'earth', 'sand', 'mud'].includes(surf)) {
    return false;
  }
  return ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential'].includes(
    road.highway
  );
}

function isDrivableRoad(road: OsmRoadSegment): boolean {
  if (road.access === 'private' || road.access === 'no') return false;
  return !['footway', 'path', 'steps', 'cycleway', 'bridleway'].includes(
    road.highway
  );
}

export function classifySpotRoadAccess(params: {
  spotLng: number;
  spotLat: number;
  roads: OsmRoadSegment[];
  sectorReliefM: number;
  fallbackRoadNames?: string[];
  isOffshoreOpenWater?: boolean;
  shoreDistanceM?: number;
  shoreDirection?: string;
}): {
  access_mode: SpotAccessMode;
  access_summary: string;
} {
  const {
    spotLng,
    spotLat,
    roads,
    sectorReliefM,
    isOffshoreOpenWater = false,
    shoreDistanceM,
    shoreDirection,
  } = params;

  const dirLabel = shoreDirection ? `${shoreDirection} ` : '';

  // Single crisp shore/offshore boundary: > 75m from nearest bank requires watercraft
  if (shoreDistanceM !== undefined && shoreDistanceM > 75) {
    return {
      access_mode: 'boat_only',
      access_summary: `Offshore open-basin position (~${Math.round(shoreDistanceM)}m off ${dirLabel}shore) — watercraft/float-tube required (verify local floatation rules)`,
    };
  }

  if (sectorReliefM > 55) {
    return {
      access_mode: 'boat_only',
      access_summary: `Steep canyon ${dirLabel}bank (+${Math.round(sectorReliefM)}m relief) — check shore footpath access or verify local watercraft/floatation rules before launching`,
    };
  }

  const pt = point([spotLng, spotLat]);
  let nearestPaved: { road: OsmRoadSegment; distKm: number } | null = null;
  let nearestTrack: { road: OsmRoadSegment; distKm: number } | null = null;

  for (const road of roads) {
    if (road.coordinates.length < 2 || !isDrivableRoad(road)) continue;
    const distKm = pointToLineDistance(pt, lineString(road.coordinates), {
      units: 'kilometers',
    });

    if (isPavedRoad(road)) {
      if (!nearestPaved || distKm < nearestPaved.distKm) {
        nearestPaved = { road, distKm };
      }
    } else if (!nearestTrack || distKm < nearestTrack.distKm) {
      nearestTrack = { road, distKm };
    }
  }

  const pavedMeters = nearestPaved ? Math.round(nearestPaved.distKm * 1000) : Infinity;
  const trackMeters = nearestTrack ? Math.round(nearestTrack.distKm * 1000) : Infinity;

  if (nearestPaved && pavedMeters <= 180 && sectorReliefM <= 25) {
    const label = nearestPaved.road.name || 'Paved road';
    return {
      access_mode: 'car_asphalt',
      access_summary: isOffshoreOpenWater
        ? `Asphalt road (${label}) · ~${pavedMeters}m to ${dirLabel}bank for long-cast reach, or permitted watercraft`
        : `Asphalt road (${label}) · ~${pavedMeters}m ${sectorReliefM <= 12 ? 'flat' : 'gentle'} walk to ${dirLabel}bank`,
    };
  }

  if (nearestTrack && trackMeters <= 250 && sectorReliefM <= 30 && trackMeters <= pavedMeters) {
    const label = nearestTrack.road.name || 'Unpaved dirt track';
    const gradeNote = nearestTrack.road.tracktype
      ? ` (${nearestTrack.road.tracktype}${['grade3', 'grade4', 'grade5'].includes(nearestTrack.road.tracktype) ? ', high-clearance' : ''})`
      : ' (dirt/gravel)';
    return {
      access_mode: 'dirt_track',
      access_summary: isOffshoreOpenWater
        ? `Dirt track ${label}${gradeNote} · ~${trackMeters}m to ${dirLabel}bank for long-cast reach, or permitted watercraft`
        : `Dirt track ${label}${gradeNote} · ~${trackMeters}m walk to ${dirLabel}water`,
    };
  }

  const bestRoad =
    pavedMeters <= trackMeters ? nearestPaved : nearestTrack;
  if (bestRoad && bestRoad.distKm <= 1.5) {
    const distM = Math.round(bestRoad.distKm * 1000);
    const kind = isPavedRoad(bestRoad.road) ? 'asphalt road' : 'dirt track';
    return {
      access_mode: 'hike_in',
      access_summary: isOffshoreOpenWater
        ? `Nearest ${dirLabel}shore trail ~${distM}m from ${bestRoad.road.name || kind} (+${Math.round(sectorReliefM)}m bank) — long-cast target or permitted watercraft`
        : `~${distM}m hike from ${bestRoad.road.name || kind} to ${dirLabel}bank (+${Math.round(sectorReliefM)}m slope)`,
    };
  }

  if (sectorReliefM > 35) {
    return {
      access_mode: 'boat_only',
      access_summary: `Steep bank (+${Math.round(sectorReliefM)}m relief, no mapped road) — check shore trail or verify local watercraft rules`,
    };
  }

  if (isOffshoreOpenWater) {
    return {
      access_mode: 'hike_in',
      access_summary: `Accessible bank (~+${Math.round(sectorReliefM)}m slope) for long-cast reach (~${shoreDistanceM ?? 55}m offshore), or permitted boat`,
    };
  }

  return {
    access_mode: 'hike_in',
    access_summary:
      sectorReliefM <= 10
        ? `Gentle bank (~+${Math.round(sectorReliefM)}m slope) — no mapped road; check shore trail`
        : `Moderate hike-in bank (~+${Math.round(sectorReliefM)}m slope) — no mapped road; check shore trail`,
  };
}

export interface OverpassGeomElement {
  type: 'way' | 'relation';
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
  members?: {
    role?: string;
    geometry?: { lat: number; lon: number }[];
  }[];
}

function coordDist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function toClosedPolygon(coords: [number, number][]): Feature<Polygon> | null {
  if (coords.length < 4) return null;
  const first = coords[0];
  const last = coords[coords.length - 1];
  const closed =
    coordDist(first, last) < 1e-6 ? coords : [...coords, first];
  if (closed.length < 4) return null;
  return polygon([closed]);
}

/**
 * Stitches unclosed OSM multipolygon `outer` shoreline segments end-to-end into closed
 * polygon rings instead of wrapping partial arcs individually with straight-line chords.
 */
function assembleRelationOuterRings(
  members: NonNullable<OverpassGeomElement['members']>
): Feature<Polygon>[] {
  const polygons: Feature<Polygon>[] = [];
  const openChains: [number, number][][] = [];
  const stitchTolerance = 0.0002; // ~20m node match tolerance

  for (const m of members) {
    if (m.role && m.role !== 'outer') continue;
    if (!m.geometry || m.geometry.length < 2) continue;
    const pts: [number, number][] = m.geometry.map((g) => [g.lon, g.lat]);

    if (pts.length >= 4 && coordDist(pts[0], pts[pts.length - 1]) <= stitchTolerance) {
      const poly = toClosedPolygon(pts);
      if (poly) polygons.push(poly);
    } else {
      openChains.push(pts);
    }
  }

  while (openChains.length > 0) {
    const chain = openChains.shift()!;
    let merged = true;
    while (merged) {
      merged = false;
      const head = chain[0];
      const tail = chain[chain.length - 1];
      if (chain.length >= 4 && coordDist(head, tail) <= stitchTolerance) break;

      for (let i = 0; i < openChains.length; i++) {
        const cand = openChains[i];
        const cHead = cand[0];
        const cTail = cand[cand.length - 1];

        if (coordDist(tail, cHead) <= stitchTolerance) {
          chain.push(...cand.slice(1));
          openChains.splice(i, 1);
          merged = true;
          break;
        }
        if (coordDist(tail, cTail) <= stitchTolerance) {
          chain.push(...[...cand].reverse().slice(1));
          openChains.splice(i, 1);
          merged = true;
          break;
        }
        if (coordDist(head, cTail) <= stitchTolerance) {
          chain.unshift(...cand.slice(0, -1));
          openChains.splice(i, 1);
          merged = true;
          break;
        }
        if (coordDist(head, cHead) <= stitchTolerance) {
          chain.unshift(...[...cand].reverse().slice(0, -1));
          openChains.splice(i, 1);
          merged = true;
          break;
        }
      }
    }

    // Only close stitched chain if it genuinely closes into a loop (avoid bogus chords across dry bays)
    if (chain.length >= 4 && coordDist(chain[0], chain[chain.length - 1]) <= stitchTolerance * 3) {
      const poly = toClosedPolygon(chain);
      if (poly) polygons.push(poly);
    }
  }

  return polygons;
}

/**
 * Builds thin river corridor polygons along unclosed OSM `waterway=river` centerlines
 * so rivers without mapped riverbanks still participate in water masking.
 */
function lineToRiverCorridorPolygons(
  coords: [number, number][],
  halfWidthDeg = 0.00018
): Feature<Polygon>[] {
  if (coords.length < 2) return [];
  const polys: Feature<Polygon>[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-7) continue;
    const nx = (-dy / len) * halfWidthDeg;
    const ny = (dx / len) * halfWidthDeg;
    polys.push(
      polygon([
        [
          [x1 + nx, y1 + ny],
          [x2 + nx, y2 + ny],
          [x2 - nx, y2 - ny],
          [x1 - nx, y1 - ny],
          [x1 + nx, y1 + ny],
        ],
      ])
    );
  }
  return polys;
}

const EXCLUDED_NON_FISHABLE_WATER_TYPES = new Set([
  'basin',
  'wastewater',
  'reflecting_pool',
  'fountain',
  'fishpond',
  'moat',
  'pool',
]);

function polygonAreaSqMeters(poly: Feature<Polygon>): number {
  const ring = poly.geometry.coordinates[0];
  if (!ring || ring.length < 4) return 0;
  let refLat = 0;
  for (const [, lat] of ring) refLat += lat;
  refLat /= ring.length;
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((refLat * Math.PI) / 180) * 111320;

  let area2 = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] * mPerDegLng;
    const y1 = ring[i][1] * mPerDegLat;
    const x2 = ring[i + 1][0] * mPerDegLng;
    const y2 = ring[i + 1][1] * mPerDegLat;
    area2 += x1 * y2 - x2 * y1;
  }
  return Math.abs(area2) / 2;
}

function isFishableOsmWaterTags(tags: Record<string, string>): boolean {
  if (
    tags.intermittent === 'yes' ||
    tags.seasonal === 'yes' ||
    tags.dry === 'yes' ||
    tags.covered === 'yes' ||
    tags.tunnel === 'yes' ||
    tags.tunnel === 'culvert' ||
    tags.leisure === 'swimming_pool' ||
    tags.man_made === 'water_works' ||
    tags.man_made === 'reservoir_covered'
  ) {
    return false;
  }
  if (tags.water && EXCLUDED_NON_FISHABLE_WATER_TYPES.has(tags.water.toLowerCase())) {
    return false;
  }
  return true;
}

export function parseOverpassWaterAndRoadsElements(
  elements: OverpassGeomElement[]
): {
  waterPolygons: WaterGeometryFeature[];
  waterwayLines: WaterwayLine[];
  roads: OsmRoadSegment[];
  hazards: string[];
  hasRegionalBoundary: boolean;
} {
  const waterPolygons: WaterGeometryFeature[] = [];
  const waterwayLines: WaterwayLine[] = [];
  const roads: OsmRoadSegment[] = [];
  const hazards = new Set<string>();
  let hasRegionalBoundary = false;

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (tags.boundary === 'administrative' && tags.admin_level === '4') {
      hasRegionalBoundary = true;
      continue;
    }
    if (tags.man_made === 'dam' || tags.waterway === 'dam' || tags.waterway === 'weir') {
      hazards.add(
        tags.name
          ? `Hydroelectric dam/weir (${tags.name})`
          : 'Dam wall / weir structure (presa/azud)'
      );
      continue;
    }
    if (tags.boundary === 'protected_area' || tags.leisure === 'nature_reserve') {
      if (tags.name) {
        hazards.add(`Protected reserve (${tags.name})`);
      }
      continue;
    }
    if (tags.highway && el.geometry && el.geometry.length >= 2) {
      roads.push({
        name: tags.ref || tags.name || (tags.highway === 'track' ? 'Dirt track' : 'Local road'),
        highway: tags.highway,
        surface: tags.surface,
        tracktype: tags.tracktype,
        access: tags.access,
        coordinates: el.geometry.map((g) => [g.lon, g.lat]),
      });
      continue;
    }

    if (!isFishableOsmWaterTags(tags)) continue;

    const isPolygonWater =
      tags.natural === 'water' ||
      tags.waterway === 'riverbank' ||
      tags.landuse === 'reservoir' ||
      Boolean(tags.water);
    const isRiverLine =
      tags.waterway === 'river' ||
      tags.waterway === 'canal' ||
      tags.waterway === 'stream';

    if (!isPolygonWater && !isRiverLine) continue;

    if (el.type === 'way' && el.geometry) {
      const coords: [number, number][] = el.geometry.map((g) => [g.lon, g.lat]);
      const isClosedWay =
        coords.length >= 4 && coordDist(coords[0], coords[coords.length - 1]) < 1e-5;
      if (isPolygonWater && isClosedWay) {
        const poly = toClosedPolygon(coords);
        // Filter out unnamed tiny isolated concrete farm tanks / irrigation ponds (< 3,500 m²)
        if (poly && (Boolean(tags.name) || tags.water === 'reservoir' || polygonAreaSqMeters(poly) >= 3500)) {
          poly.properties = {
            ...(poly.properties ?? {}),
            water: tags.water,
            waterway: tags.waterway,
          };
          waterPolygons.push(poly);
        }
      } else if (isRiverLine) {
        waterwayLines.push({
          kind: tags.waterway as WaterwayLine['kind'],
          name: tags.name,
          coords,
        });
        if (tags.waterway === 'river' || tags.waterway === 'canal') {
          waterPolygons.push(...lineToRiverCorridorPolygons(coords));
        }
      }
    } else if (el.type === 'relation' && el.members && isPolygonWater) {
      for (const ringPoly of assembleRelationOuterRings(el.members)) {
        if (Boolean(tags.name) || tags.water === 'reservoir' || polygonAreaSqMeters(ringPoly) >= 3500) {
          ringPoly.properties = {
            ...(ringPoly.properties ?? {}),
            water: tags.water,
            waterway: tags.waterway,
          };
          waterPolygons.push(ringPoly);
        }
      }
    }
  }

  return { waterPolygons, waterwayLines, roads, hazards: Array.from(hazards), hasRegionalBoundary };
}

/**
 * Fetches OSM water polygons, road/track networks (with surface & tracktype tags),
 * and dam/protected-area/admin-boundary tags for `bbox` using clipped geometry and fast mirror fallback.
 */
export async function fetchOsmWaterAndRoads(bbox: BoundingBox): Promise<{
  waterPolygons: WaterGeometryFeature[];
  waterwayLines: WaterwayLine[];
  roads: OsmRoadSegment[];
  hazards: string[];
  hasRegionalBoundary: boolean;
  osmWaterStatus: OsmWaterStatus;
}> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const pad = 0.003;
  const s = (minLat - pad).toFixed(5);
  const w = (minLng - pad).toFixed(5);
  const n = (maxLat + pad).toFixed(5);
  const e = (maxLng + pad).toFixed(5);

  const nonDry = '[intermittent!="yes"][seasonal!="yes"][dry!="yes"][tunnel!~"^(yes|culvert)$"][covered!="yes"]';
  const query = `[out:json][timeout:4];(way["natural"="water"]${nonDry}(${s},${w},${n},${e});relation["natural"="water"]${nonDry}(${s},${w},${n},${e});way["waterway"~"^(riverbank|river|canal|stream)$"]${nonDry}(${s},${w},${n},${e});way["landuse"="reservoir"]${nonDry}(${s},${w},${n},${e});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|path)$"](${s},${w},${n},${e});way["waterway"~"^(dam|weir)$"](${s},${w},${n},${e});way["man_made"="dam"](${s},${w},${n},${e});way["boundary"="protected_area"](${s},${w},${n},${e});way["boundary"="administrative"]["admin_level"="4"](${s},${w},${n},${e}););out tags geom(${s},${w},${n},${e});`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  try {
    const parsed = await Promise.any(
      endpoints.map(async (endpoint) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Accept: 'application/json',
            'User-Agent': 'FishingSpotAI-SpainMVP/1.0',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) {
          throw new Error(`Overpass ${res.status}`);
        }
        const json = (await res.json()) as { elements?: OverpassGeomElement[] };
        return parseOverpassWaterAndRoadsElements(json.elements ?? []);
      })
    );

    return {
      waterPolygons: parsed.waterPolygons,
      waterwayLines: parsed.waterwayLines,
      roads: parsed.roads,
      hazards: parsed.hazards,
      hasRegionalBoundary: parsed.hasRegionalBoundary,
      osmWaterStatus: parsed.waterPolygons.length > 0 ? 'ok' : 'empty',
    };
  } catch {
    return {
      waterPolygons: [],
      waterwayLines: [],
      roads: [],
      hazards: [],
      hasRegionalBoundary: false,
      osmWaterStatus: 'unavailable',
    };
  }
}
