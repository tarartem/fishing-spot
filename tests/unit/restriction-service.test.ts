import { describe, it, expect } from 'vitest';
import {
  buildRestrictionOverview,
  applyCommunityRestrictionReport,
} from '@/modules/restrictions/restriction-service';
import { buildSpainRestrictionCheck } from '@/modules/ai-advisor/geospatial-context.service';
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

  it('resolves Castile and León and Galicia Autonomous Community permits instead of falling back to Comunidad Valenciana', () => {
    const sanabriaCheck = buildSpainRestrictionCheck({
      waterBodyName: 'Lago de Sanabria',
      autonomousCommunity: 'Castile and León',
      detectedRestrictedPlaces: [
        'Parque natural Lago de Sanabria y Sierras Segundera y de Porto',
      ],
    });
    expect(sanabriaCheck.status_label).toContain('Castilla y León');
    expect(sanabriaCheck.permits_required).toContain('Castilla y León');
    expect(sanabriaCheck.permits_required).toContain('AREC');
    expect(sanabriaCheck.permits_required).not.toContain('(gratuita / Interautonómica)');
    expect(sanabriaCheck.permits_required).not.toContain('ZPC');
    expect(
      sanabriaCheck.regulations_list.some((r) =>
        r.toLowerCase().includes('flotación') || r.toLowerCase().includes('floatation')
      )
    ).toBe(true);
    expect(
      sanabriaCheck.regulations_list.some((r) =>
        r.toLowerCase().includes('single') || r.toLowerCase().includes('barbless')
      )
    ).toBe(true);
    expect(sanabriaCheck.status_label).not.toContain('Comunidad Valenciana');
    expect(sanabriaCheck.permits_required).not.toContain('Valenciana');

    const pradaCheck = buildSpainRestrictionCheck({
      waterBodyName: 'Embalse de Prada',
      autonomousCommunity: 'Galicia',
      detectedRestrictedPlaces: ['Parque natural da Serra da Enciña da Lastra'],
    });
    expect(pradaCheck.status_label).toContain('Galicia');
    expect(pradaCheck.permits_required).toContain('Galicia');
    expect(pradaCheck.prohibited_zones_warning).not.toContain('Zonas de Pesca Controlada');
    expect(pradaCheck.prohibited_zones_warning).not.toContain('(ZPC)');
    expect(pradaCheck.status_label).not.toContain('Comunidad Valenciana');
    expect(pradaCheck.permits_required).not.toContain('Valenciana');

    const borderCheck = buildSpainRestrictionCheck({
      waterBodyName: 'Embalse de Peñarrubia',
      autonomousCommunity: 'Galicia',
      borderAutonomousCommunity: 'Castilla y León',
      hasRegionalBoundary: true,
      detectedRestrictedPlaces: [],
    });
    expect(borderCheck.permits_required.toLowerCase()).toContain('border');
    expect(borderCheck.permits_required).toContain('Castilla y León');
    expect(
      borderCheck.regulations_list.some((r) => r.toLowerCase().includes('opposite'))
    ).toBe(true);

    const unknownRegionCheck = buildSpainRestrictionCheck({
      waterBodyName: 'Unknown Reservoir',
      autonomousCommunity: 'Spain',
      detectedRestrictedPlaces: [],
    });
    expect(unknownRegionCheck.status_label).not.toContain('Comunidad Valenciana');
    expect(unknownRegionCheck.permits_required).not.toContain('Valenciana');
  });
});
