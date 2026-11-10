import { describe, it, expect } from 'vitest';
import {
  calculateBboxSpanKm,
  resolveTacticalSectorBbox,
  generateSpatialGrid,
} from '@/modules/map-grid/grid-engine';
import { SEEDED_WATER_BODIES } from '@db/seed/poland-spain-waters';

describe('F01 — Spatial Grid Engine (Turf.js)', () => {
  it('calculates bbox span accurately and keeps small lakes (< 5km) unclipped', () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const spanKm = calculateBboxSpanKm(zegrze.bbox);
    expect(spanKm).toBeLessThan(5);

    const resolvedBbox = resolveTacticalSectorBbox(zegrze.bbox, {
      latitude: zegrze.centerLat,
      longitude: zegrze.centerLng,
    });
    expect(resolvedBbox).toEqual(zegrze.bbox);
  });

  it('clips large rivers/reservoirs (>= 5km, e.g. Vistula or Mequinenza) to a ~2.5km radius tactical sector', () => {
    const wisla = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-wisla-warszawa')!;
    const fullSpanKm = calculateBboxSpanKm(wisla.bbox);
    expect(fullSpanKm).toBeGreaterThanOrEqual(5);

    const sectorBbox = resolveTacticalSectorBbox(wisla.bbox, {
      latitude: wisla.centerLat,
      longitude: wisla.centerLng,
    });
    const clippedSpanKm = calculateBboxSpanKm(sectorBbox);
    // ~2.5km radius -> ~5km box width, cell size ~100m-350m
    expect(clippedSpanKm).toBeLessThanOrEqual(6.0);
    expect(clippedSpanKm).toBeGreaterThan(2.0);
  });

  it('generates labeled grid cells (A1..H8), filters out dry-land cells, and marks prohibited cells', () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const cells = generateSpatialGrid({
      sectorBbox: zegrze.bbox,
      waterPolygon: zegrze.polygon,
      restrictionZones: zegrze.restrictionZones,
    });

    expect(cells.length).toBeGreaterThan(10);
    expect(cells.every((c) => /^[A-H][1-8]$/.test(c.cellId))).toBe(true);

    // Verify cell A1 is marked prohibited due to the dam safety zone in Jezioro Zegrzyńskie
    const prohibitedCell = cells.find((c) => c.cellId === 'A1' || c.restrictionStatus === 'prohibited');
    expect(prohibitedCell).toBeDefined();
    expect(prohibitedCell?.restrictionStatus).toBe('prohibited');
  });
});
