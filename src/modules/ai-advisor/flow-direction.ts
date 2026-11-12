import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import turfDistance from '@turf/distance';
import { point } from '@turf/helpers';
import type { Feature, Polygon } from 'geojson';

export interface WaterwayLine {
  kind: 'river' | 'canal' | 'stream';
  name?: string;
  coords: [number, number][];
}

export interface InflowPoint {
  lng: number;
  lat: number;
  radiusM: number;
  kind: 'river' | 'canal' | 'stream';
  name?: string;
}

export interface FlowContext {
  isFlowingWater: boolean;
  flowBearingDeg: number | null;
  flowCardinal: string | null;
  upstreamCardinal: string | null;
  flowDirectionSummary: string;
  confidence: 'osm_and_dem' | 'osm_way_order' | 'stillwater';
  inflowPoints: InflowPoint[];
}

const CARDINALS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export function bearingDegToCardinal(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  return CARDINALS_8[Math.round(norm / 45) % 8];
}

export function computeCompassBearingDeg(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number
): number {
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const dLon = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angularDiffDeg(a: number, b: number): number {
  const diff = Math.abs(((a - b + 540) % 360) - 180);
  return diff;
}

/**
 * Computes river/canal flow direction from OSM waterway polylines (upstream -> downstream convention),
 * cross-checked against DEM elevation when |Δelev| >= 2m, plus scaled reservoir inflow plumes.
 */
export function computeFlowContext(params: {
  waterwayLines: WaterwayLine[];
  waterPolygons: Feature<Polygon>[];
  sampleElevationFn?: (lng: number, lat: number) => number | null;
}): FlowContext {
  const { waterwayLines, waterPolygons, sampleElevationFn } = params;
  if (!waterwayLines || waterwayLines.length === 0) {
    return {
      isFlowingWater: false,
      flowBearingDeg: null,
      flowCardinal: null,
      upstreamCardinal: null,
      flowDirectionSummary: 'Stillwater basin (minimal river current)',
      confidence: 'stillwater',
      inflowPoints: [],
    };
  }

  let sumSin = 0;
  let sumCos = 0;
  let totalWeight = 0;
  let demCheckedDelta = 0;
  let hasDemFlip = false;
  let hasDemConfirm = false;

  const classWeight: Record<WaterwayLine['kind'], number> = {
    river: 1.0,
    canal: 0.8,
    stream: 0.5,
  };

  for (const line of waterwayLines) {
    if (line.coords.length < 2) continue;
    const start = line.coords[0];
    const end = line.coords[line.coords.length - 1];
    const lengthM = turfDistance(point(start), point(end), { units: 'meters' });
    if (lengthM < 5) continue;

    let bearing = computeCompassBearingDeg(start[0], start[1], end[0], end[1]);
    if (sampleElevationFn) {
      const startElev = sampleElevationFn(start[0], start[1]);
      const endElev = sampleElevationFn(end[0], end[1]);
      if (startElev !== null && endElev !== null) {
        const dropM = startElev - endElev;
        if (Math.abs(dropM) >= 2) {
          demCheckedDelta += dropM;
          if (dropM < -2) {
            bearing = (bearing + 180) % 360;
            hasDemFlip = true;
          } else {
            hasDemConfirm = true;
          }
        }
      }
    }

    const w = lengthM * classWeight[line.kind];
    const rad = (bearing * Math.PI) / 180;
    sumSin += Math.sin(rad) * w;
    sumCos += Math.cos(rad) * w;
    totalWeight += w;
  }

  if (totalWeight <= 0) {
    return {
      isFlowingWater: false,
      flowBearingDeg: null,
      flowCardinal: null,
      upstreamCardinal: null,
      flowDirectionSummary: 'Stillwater basin (minimal river current)',
      confidence: 'stillwater',
      inflowPoints: [],
    };
  }

  const flowBearingDeg = ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;
  const flowCardinal = bearingDegToCardinal(flowBearingDeg);
  const upstreamCardinal = bearingDegToCardinal((flowBearingDeg + 180) % 360);
  const confidence: FlowContext['confidence'] =
    hasDemFlip || hasDemConfirm || Math.abs(demCheckedDelta) >= 2
      ? 'osm_and_dem'
      : 'osm_way_order';

  // Detect reservoir/lake inflow plumes where a waterway enters a stillwater polygon
  const inflowPoints: InflowPoint[] = [];
  const stillwaterPolys = waterPolygons.filter(
    (wp) =>
      wp.properties?.water !== 'river' &&
      wp.properties?.waterway !== 'riverbank'
  );

  if (stillwaterPolys.length > 0) {
    const radiusByKind: Record<WaterwayLine['kind'], number> = {
      stream: 200,
      canal: 250,
      river: 450,
    };

    for (const line of waterwayLines) {
      if (line.coords.length < 2) continue;
      for (let i = 0; i < line.coords.length - 1; i++) {
        const a = line.coords[i];
        const b = line.coords[i + 1];
        const aIn = stillwaterPolys.some((wp) => booleanPointInPolygon(point(a), wp));
        const bIn = stillwaterPolys.some((wp) => booleanPointInPolygon(point(b), wp));
        if (!aIn && bIn) {
          inflowPoints.push({
            lng: b[0],
            lat: b[1],
            radiusM: radiusByKind[line.kind],
            kind: line.kind,
            name: line.name,
          });
          break;
        }
      }
    }
  }

  // If large stillwater reservoir polygons exist, only treat the inflow zone as flowing
  const isDominantlyStillwater = stillwaterPolys.length > 0;
  const isFlowingWater = !isDominantlyStillwater;
  const flowDirectionSummary = isFlowingWater
    ? `Flows ${upstreamCardinal} -> ${flowCardinal} (${confidence === 'osm_and_dem' ? 'OSM + DEM verified' : 'OSM waterway vector'})`
    : inflowPoints.length > 0
      ? `Stillwater basin with ${inflowPoints.length} inflow(s) flowing ${upstreamCardinal} -> ${flowCardinal}`
      : `Stillwater basin (minimal current; regional drainage ${upstreamCardinal} -> ${flowCardinal})`;

  return {
    isFlowingWater,
    flowBearingDeg: Math.round(flowBearingDeg),
    flowCardinal,
    upstreamCardinal,
    flowDirectionSummary,
    confidence,
    inflowPoints,
  };
}

/**
 * Returns true when a coordinate experiences active river/canal current
 * (either on a flowing river or inside a scaled reservoir inflow plume).
 */
export function isPointInFlowingWater(
  lng: number,
  lat: number,
  flow: FlowContext | undefined
): boolean {
  if (!flow) return false;
  if (flow.isFlowingWater) return true;
  if (flow.inflowPoints.length === 0) return false;
  const p = point([lng, lat]);
  return flow.inflowPoints.some(
    (inflow) => turfDistance(p, point([inflow.lng, inflow.lat]), { units: 'meters' }) <= inflow.radiusM
  );
}

/**
 * Returns true when a pin lies on the downstream lee side of a shoreline tip/bank
 * relative to the water flow vector (within +-75° of flowBearingDeg).
 */
export function isDownstreamLeeOfShore(
  pinLng: number,
  pinLat: number,
  shoreLng: number,
  shoreLat: number,
  flowBearingDeg: number | null
): boolean {
  if (flowBearingDeg === null) return false;
  const shoreToPinDeg = computeCompassBearingDeg(shoreLng, shoreLat, pinLng, pinLat);
  return angularDiffDeg(shoreToPinDeg, flowBearingDeg) <= 75;
}
