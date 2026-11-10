import { describe, it, expect } from 'vitest';
import {
  buildRestrictionOverview,
  applyCommunityRestrictionReport,
} from '@/modules/restrictions/restriction-service';
import { SEEDED_WATER_BODIES } from '@db/seed/poland-spain-waters';

describe('F03 — 3-Layer Hybrid Fishing Restrictions Engine', () => {
  it('generates Poland (PL) regulatory summary with Karta Wędkarska, PZW permit, and pike/zander seasonal rules', () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const overview = buildRestrictionOverview({
      waterBody: zegrze,
      targetSpecies: ['pike', 'zander'],
    });

    expect(overview.overall_status).toBe('permit_required');
    expect(overview.warnings.some((w) => w.includes('A1'))).toBe(true);
    expect(overview.permit_requirements?.some((p) => p.includes('Karta Wędkarska'))).toBe(true);
    expect(overview.seasonal_rules?.some((r) => r.toLowerCase().includes('pike'))).toBe(true);
    expect(overview.disclaimer.length).toBeGreaterThan(20);
  });

  it('generates Spain (ES) regulatory summary with Licencia de Pesca, Coto de Pesca, and invasive species rules', () => {
    const mequinenza = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-es-mequinenza')!;
    const overview = buildRestrictionOverview({
      waterBody: mequinenza,
      targetSpecies: ['black_bass', 'catfish'],
    });

    expect(overview.overall_status).toBe('permit_required');
    expect(overview.permit_requirements?.some((p) => p.includes('Licencia de Pesca'))).toBe(true);
    expect(overview.seasonal_rules?.some((r) => r.toLowerCase().includes('invasive') || r.toLowerCase().includes('live bait'))).toBe(true);
  });

  it('allows registered users to flag a grid cell with a community restriction report', () => {
    const zegrze = SEEDED_WATER_BODIES.find((w) => w.id === 'wb-pl-zegrzynskie')!;
    const updatedZones = applyCommunityRestrictionReport(zegrze.restrictionZones, {
      waterBodyId: zegrze.id,
      userId: 'user-test',
      cellId: 'D5',
      status: 'prohibited',
      reason: 'Spawning reserve buoy line marked on bank sign.',
    });

    const d5Rule = updatedZones.find((z) => z.cellId === 'D5');
    expect(d5Rule).toBeDefined();
    expect(d5Rule?.status).toBe('prohibited');
    expect(d5Rule?.source).toBe('community');
  });
});
