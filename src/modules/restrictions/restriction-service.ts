import type {
  RestrictionOverview,
  RestrictionStatus,
  TargetSpecies,
  WaterBodyRecord,
} from '@/shared/types/domain';

const POLAND_SPECIES_SEASONAL_RULES: Partial<Record<TargetSpecies, string>> = {
  pike: 'Pike (Szczupak): Closed season Jan 1 – Apr 30; minimum statutory size 50 cm (check local PZW Okręg upper/lower slot limits).',
  zander:
    'Zander (Sandacz): Closed season Jan 1 – May 31; minimum statutory size 50 cm (daily bag limit typically 2 fish combined with pike).',
  perch:
    'Perch (Okoń): Minimum size typically 18–20 cm depending on PZW district; watch spawning closures in early spring.',
  carp: 'Carp (Karp): Minimum size 30–35 cm on PZW waters; strict upper trophy slot limits (e.g., >60 cm release) apply on many reservoirs.',
  bream: 'Bream (Leszcz): Protected on selected spawning sanctuaries in May.',
  asp: 'Asp (Boleń): Closed season Jan 1 – Apr 30; minimum size 40 cm.',
  catfish:
    'Wels Catfish (Sum): Closed season Nov 1 – Jun 30 on most inland rivers/reservoirs; minimum size 70 cm.',
  sea_trout:
    'Sea Trout (Troć wędrowna): Minimum size 50 cm in Baltic coastal waters; check seasonal river mouth buffer zones (500m exclusion around river mouths).',
  garfish: 'Garfish (Belona): Peak coastal season in May–June; Baltic Sea recreational fishing license required.',
  flounder: 'European Flounder (Stornia/Flądra): Minimum size 23–25 cm in Baltic sectors.',
};

const SPAIN_SPECIES_SEASONAL_RULES: Partial<Record<TargetSpecies, string>> = {
  black_bass:
    'Largemouth Black Bass: Regulated as an exotic species in Spain; live bait is strictly prohibited and catch-and-release or Coto Deportivo rules depend on the Autonomous Community.',
  pike: 'Pike (Lucio): Classified under Spanish exotic/invasive regulations (Real Decreto 630/2013); live bait strictly forbidden; verify regional Coto rules.',
  zander:
    'Zander (Lucioperca): Subject to strict Spanish invasive species regulations; transporting live specimens or using live fish as bait is illegal.',
  catfish:
    'Wels Catfish (Siluro): Regulated in the Ebro/Mar de Aragón basin; use of live vertebrate bait is strictly prohibited; night fishing prohibited outside designated hours.',
  carp: 'Common Carp (Carpa): Check Autonomous Community rules on night ledgering and vegetal/pellet bait permissions.',
  sea_bass:
    'European Sea Bass (Lubina): Minimum conservation reference size 42 cm in Atlantic waters / 25 cm in Mediterranean; recreational maritime license required.',
  dorada:
    'Gilthead Seabream (Dorada): Minimum size 20 cm (Mediterranean) / 22 cm (Atlantic); daily recreational coastal catch limit 5 kg per angler.',
  sargo: 'White Seabream (Sargo): Minimum size 15–23 cm depending on Mediterranean/Atlantic coastal zone.',
};

export interface BuildRestrictionOverviewParams {
  waterBody: WaterBodyRecord;
  targetSpecies: TargetSpecies[];
}

/**
 * Builds the 3-Layer Hybrid Restriction Overview for a Water Body and Target Species.
 */
export function buildRestrictionOverview({
  waterBody,
  targetSpecies,
}: BuildRestrictionOverviewParams): RestrictionOverview {
  const prohibitedZones = waterBody.restrictionZones.filter(
    (z) => z.status === 'prohibited'
  );
  const permitZones = waterBody.restrictionZones.filter(
    (z) => z.status === 'permit_required'
  );

  let overallStatus: RestrictionStatus = 'allowed';
  if (permitZones.length > 0 || waterBody.countryCode === 'PL' || waterBody.countryCode === 'ES') {
    overallStatus = 'permit_required';
  }

  const warnings: string[] = [];
  for (const pz of prohibitedZones) {
    const cellLabel = pz.cellId ? `Grid Cell ${pz.cellId}: ` : '';
    warnings.push(`PROHIBITED — ${cellLabel}${pz.reason}`);
  }
  for (const req of permitZones) {
    const cellLabel = req.cellId ? `Grid Cell ${req.cellId}: ` : '';
    warnings.push(`PERMIT REQUIRED — ${cellLabel}${req.reason}`);
  }

  const permitRequirements: string[] = [];
  const seasonalRules: string[] = [];

  if (waterBody.countryCode === 'PL') {
    if (waterBody.waterType === 'sea') {
      permitRequirements.push(
        'Baltic Sea Recreational Angling Fee (Opłata na sportowy połów ryb w wodach morskich — GИРM) required.'
      );
    } else {
      permitRequirements.push(
        'State Angling Card (Karta Wędkarska) + local Water Manager Permit (e.g., PZW Okręg Zezwolenie or Wody Polskie license) required.'
      );
    }

    const speciesToLookup =
      targetSpecies.length > 0 && !targetSpecies.includes('any')
        ? targetSpecies
        : waterBody.commonSpecies;

    for (const sp of speciesToLookup) {
      const rule = POLAND_SPECIES_SEASONAL_RULES[sp];
      if (rule) seasonalRules.push(rule);
    }
  } else if (waterBody.countryCode === 'ES') {
    if (waterBody.waterType === 'sea') {
      permitRequirements.push(
        'Autonomous Community Recreational Maritime Fishing License (Licencia de Pesca Marítima de Recreo) required.'
      );
    } else {
      permitRequirements.push(
        'Autonomous Community Inland Fishing License (Licencia de Pesca Continental) + Coto de Pesca daily ticket (where applicable) required.'
      );
    }

    const speciesToLookup =
      targetSpecies.length > 0 && !targetSpecies.includes('any')
        ? targetSpecies
        : waterBody.commonSpecies;

    for (const sp of speciesToLookup) {
      const rule = SPAIN_SPECIES_SEASONAL_RULES[sp];
      if (rule) seasonalRules.push(rule);
    }
  } else {
    permitRequirements.push(
      'Check local national and municipal angling permit requirements before fishing.'
    );
  }

  return {
    overall_status: overallStatus,
    warnings,
    permit_requirements: permitRequirements,
    seasonal_rules: seasonalRules,
    disclaimer:
      'Regulatory data combines OpenStreetMap protected-area boundaries, community reports, and regional rules. Always verify current local water manager bylaws and on-site signage before casting.',
  };
}

export interface CommunityRestrictionReportInput {
  waterBodyId: string;
  userId: string;
  cellId?: string;
  status: RestrictionStatus;
  reason: string;
}

/**
 * Layer 3: Appends or updates a community-reported restriction flag on a water body / grid cell.
 */
export function applyCommunityRestrictionReport(
  existingZones: WaterBodyRecord['restrictionZones'],
  report: CommunityRestrictionReportInput
): WaterBodyRecord['restrictionZones'] {
  const newZone = {
    id: `rz-comm-${Date.now()}`,
    cellId: report.cellId?.toUpperCase(),
    status: report.status,
    reason: report.reason,
    source: 'community' as const,
  };

  return [
    ...existingZones.filter(
      (z) => !(z.source === 'community' && z.cellId === newZone.cellId)
    ),
    newZone,
  ];
}
