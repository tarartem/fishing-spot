import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { SEEDED_WATER_BODIES } from '@db/seed/poland-spain-waters';
import { isPercentOnRasterWater } from '@/modules/ai-advisor/osm-tile-water-mask';
import {
  computeFlowContext,
  type FlowContext,
} from '@/modules/ai-advisor/flow-direction';
import { fetchServerOsmWaterMask } from '@/modules/ai-advisor/osm-tile-water-mask.server';
import { computeSelectionScale } from '@/modules/ai-advisor/scale-utils';
import {
  fetchLiveFishOccurrences,
  mergeSpeciesWithOccurrences,
  SPECIES_CATALOG_ES,
} from '@/modules/ai-advisor/species-occurrence';
import {
  computeAllowedWaterCells,
  fetchOsmWaterAndRoads,
  percentToLngLat,
  type OsmRoadSegment,
  type OsmWaterStatus,
  type WaterCellMask,
  type WaterGeometryFeature,
} from '@/modules/ai-advisor/water-mask-and-access';
import type {
  ArtifactGeographicalContext,
  ArtifactRestrictionCheck,
  BoundingBox,
  ClientWaterMaskSummary,
  RestrictionStatus,
  ScaleAnalysisMode,
  SpeciesPresenceInfo,
  TargetSpecies,
  WaterBodyRecord,
} from '@/shared/types/domain';

export interface DemSectorSample {
  label: string;
  x_percent: number;
  y_percent: number;
  lat: number;
  lng: number;
  elevationM: number;
  riseM: number;
}

export interface EnrichedGeospatialContext {
  matchedRecord?: WaterBodyRecord;
  waterBodyName: string;
  regionLabel: string;
  autonomousCommunity: string;
  scaleMode: ScaleAnalysisMode;
  widthKm: number;
  heightKm: number;
  metersPerPixel: number;
  landmarks: string[];
  detectedRoads: string[];
  roads: OsmRoadSegment[];
  roadPromptSummary: string;
  waterPolygons: WaterGeometryFeature[];
  flowContext: FlowContext;
  osmWaterStatus: OsmWaterStatus;
  rasterWaterMask?: ClientWaterMaskSummary | null;
  waterCellMask: WaterCellMask;
  demSectorSamples: DemSectorSample[];
  speciesPresentDefaults: SpeciesPresenceInfo[];
  liveSpeciesSummary: string;
  wikipediaExtract: string;
  sectorSlopePromptSummary: string;
  geographicalContext: ArtifactGeographicalContext;
  restrictionCheck: ArtifactRestrictionCheck;
}

export function buildSpeciesRoster(
  speciesSlugs?: TargetSpecies[],
  waterType: 'freshwater' | 'sea' = 'freshwater',
  waterBodyName = '',
  autonomousCommunity = '',
  waterElevationM = 0
): SpeciesPresenceInfo[] {
  const isRiver = /\b(r[ií]o|river|arroyo|garganta)\b/i.test(waterBodyName);
  const isNorthernOrMontane =
    /galicia|asturias|cantabria|pa[ií]s vasco|euskadi|navarra|la rioja|castilla y le[oó]n|castile and le[oó]n|arag[oó]n/i.test(
      autonomousCommunity
    ) || waterElevationM >= 450;

  const slugs =
    speciesSlugs && speciesSlugs.length > 0
      ? speciesSlugs.filter((s) => s !== 'any')
      : waterType === 'sea'
        ? (['sea_bass', 'dorada'] as TargetSpecies[])
        : isRiver
          ? (['trout', 'barbel', 'chub', 'carp'] as TargetSpecies[])
          : isNorthernOrMontane
            ? (['trout', 'barbel', 'chub', 'carp', 'black_bass'] as TargetSpecies[])
            : (['black_bass', 'carp', 'zander', 'barbel'] as TargetSpecies[]);

  const roster = slugs
    .map((slug) => SPECIES_CATALOG_ES[slug])
    .filter((entry): entry is SpeciesPresenceInfo => Boolean(entry));

  if (roster.length >= 2) return roster;
  return [
    SPECIES_CATALOG_ES.black_bass,
    SPECIES_CATALOG_ES.carp,
    SPECIES_CATALOG_ES.zander,
    SPECIES_CATALOG_ES.barbel,
  ];
}

const SPAIN_AUTONOMOUS_COMMUNITY_RULES: Record<
  string,
  {
    licenseName: string;
    permitRequirementSuffix: string;
    cotoSystem: string;
    authority: string;
    regionalNotes: string;
  }
> = {
  'Comunidad Valenciana': {
    licenseName:
      'Licencia de Pesca Recreo de la Comunitat Valenciana (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto / ZPC daily permit where signposted',
    cotoSystem:
      'Zonas de Pesca Controlada (ZPC) & Acotados managed by Generalitat Valenciana / Conselleria de Medio Ambiente.',
    authority: 'Generalitat Valenciana (Orden Anual de Vedas)',
    regionalNotes:
      'In Embalses (Cortes, Tous, Contreras, Benagéber, Bellús), check ZPC daily permit requirements. Under Real Decreto 630/2013 & regional orders, live fish/vertebrates as bait (pez vivo) are strictly prohibited.',
  },
  Aragón: {
    licenseName:
      'Licencia de Pesca de Aragón (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto Social/Deportivo permit where designated',
    cotoSystem:
      'Cotos Deportivos (e.g., Mar de Aragón / Embalse de Mequinenza — Sociedad de Pesca El Siluro / FAPD).',
    authority: 'Gobierno de Aragón — Plan General de Pesca de Aragón',
    regionalNotes:
      'Night fishing for Siluro/Catfish is prohibited outside designated hours. Live bait is strictly prohibited; transport of live invasive species (Black Bass, Lucioperca, Siluro, Alburno) is illegal.',
  },
  Cataluña: {
    licenseName:
      'Llicència de Pesca Recreativa de Catalunya',
    permitRequirementSuffix: 'Permís de Zona de Pesca Controlada (ZPC) where signposted',
    cotoSystem: 'Zonas de Pesca Controlada (ZPC) via Gencat.',
    authority: 'Generalitat de Catalunya',
    regionalNotes:
      'Strict rules on exotic species (Black Bass, Siluro, Lucioperca, Carpa); use of live fish as bait is forbidden.',
  },
  Andalucía: {
    licenseName:
      'Licencia de Pesca Continental de Andalucía (requiere NIR y curso/examen o exención)',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos de Pesca y Tramos Libres (Junta de Andalucía).',
    authority: 'Junta de Andalucía — Orden General de Vedas',
    regionalNotes:
      'Check reservoir zoning for Black Bass and Pike spawning closures and mandatory zebra mussel (mejillón cebra) boat/wader disinfection rules in Guadalquivir/Guadiana basins.',
  },
  Extremadura: {
    licenseName:
      'Licencia de Pesca de Extremadura (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'Coto Regional/Consorciado permit where designated',
    cotoSystem: 'Cotos Regionales y Consorciados (Cijara, García de Sola, Orellana, Alcántara).',
    authority: 'Junta de Extremadura — Orden General de Vedas',
    regionalNotes:
      'Premier Spanish predator waters (Cijara, Orellana, Alcántara). Live bait prohibited; check seasonal waterfowl reserve closures (ZEPA) in shallow coves.',
  },
  'Castilla-La Mancha': {
    licenseName:
      'Licencia de Pesca de Castilla-La Mancha (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto / Aguas en Régimen Especial permit where designated',
    cotoSystem: 'Cotos de Pesca y Aguas en Régimen Especial (Entrepeñas, Buendía, Bolarque).',
    authority: 'Junta de Comunidades de Castilla-La Mancha',
    regionalNotes:
      'Strict invasive species controls under Real Decreto 630/2013; live bait is prohibited.',
  },
  'Comunidad de Madrid': {
    licenseName: 'Licencia de Pesca de la Comunidad de Madrid (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos de Pesca (El Atazar, San Juan, Valmayor, Pinilla).',
    authority: 'Comunidad de Madrid — Orden Anual de Pesca',
    regionalNotes:
      'In Embalse de El Atazar (drinking water supply), wading and float-tubes/boats are strictly prohibited in designated protection zones.',
  },
  'Castilla y León': {
    licenseName: 'Licencia de Pesca de Castilla y León (free regional license; distinct from the €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'free AREC pase de control or Coto/EDS permit where signposted (free Tramo Libre otherwise)',
    cotoSystem: 'Tramos Libres, Cotos de Pesca, Escenarios Deportivos-Sociales (EDS), and AREC (Aguas en Régimen Especial Controlado — free pase de control via Junta de Castilla y León / 012).',
    authority: 'Junta de Castilla y León (Visor de Pesca / Orden Anual de Pesca)',
    regionalNotes:
      'Observe Castilla y León trout (trucha común) seasonal openings, single/barbless hook rules on salmonid/AREC waters (often single hook only, barbless on catch-and-release days), and verify whether floatation devices (aparatos de flotación / float-tubes) are prohibited on this reservoir.',
  },
  Galicia: {
    licenseName: 'Licencia de Pesca Fluvial de Galicia (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto / Tramo Libre rules per Xunta de Galicia',
    cotoSystem: 'Cotos de Pesca Fluvial, Tramos Libres y Vedados (Xunta de Galicia).',
    authority: 'Xunta de Galicia — Consellería de Medio Ambiente',
    regionalNotes:
      'Observe Galicia annual salmonid/cyprinid open-season dates, catch-and-release (pesca sen morte) stretches, and live bait prohibitions.',
  },
  Asturias: {
    licenseName: 'Licencia de Pesca Continental del Principado de Asturias (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos de Pesca y Zonas Libres (Principado de Asturias).',
    authority: 'Gobierno del Principado de Asturias',
    regionalNotes: 'Strict salmon and trout coto permits and single-hook/barbless gear restrictions apply across mountain rivers and reservoirs.',
  },
  Cantabria: {
    licenseName: 'Licencia de Pesca Continental de Cantabria',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos de Pesca y Tramos Libres (Gobierno de Cantabria).',
    authority: 'Gobierno de Cantabria',
    regionalNotes: 'Check seasonal coto draw permits and catch-and-release trout waters.',
  },
  'País Vasco': {
    licenseName: 'Licencia de Pesca Fluvial del País Vasco',
    permitRequirementSuffix: 'provincial Coto pass where designated',
    cotoSystem: 'Cotos y Tramos de Pesca (Diputaciones Forales / Euskadi).',
    authority: 'Gobierno Vasco / Diputaciones Forales',
    regionalNotes: 'Verify provincial (Álava, Bizkaia, Gipuzkoa) coto passes and reservoir navigation rules.',
  },
  Navarra: {
    licenseName: 'Licencia de Pesca de Navarra',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos y Tramos Libres de Navarra.',
    authority: 'Gobierno de Navarra',
    regionalNotes: 'Check salmonid region boundaries and invasive species disinfection rules.',
  },
  'La Rioja': {
    licenseName: 'Licencia de Pesca de La Rioja',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos de Pesca y Tramos Libres (Gobierno de La Rioja).',
    authority: 'Gobierno de La Rioja',
    regionalNotes: 'Check trout season dates and Ebro basin zebra mussel disinfection rules.',
  },
  'Región de Murcia': {
    licenseName: 'Licencia de Pesca Fluvial de la Región de Murcia (or separate €25/yr Licencia Interautonómica)',
    permitRequirementSuffix: 'local Coto permit where designated',
    cotoSystem: 'Cotos de Pesca y Tramos Libres (CARM).',
    authority: 'Comunidad Autónoma de la Región de Murcia',
    regionalNotes: 'Live fish bait is prohibited; observe Segura basin reservoir water-level and reserve rules.',
  },
  'Illes Balears': {
    licenseName: 'Llicència de Pesca Marítima Recreativa (Illes Balears)',
    permitRequirementSuffix: 'marine reserve authorization where applicable',
    cotoSystem: 'Reservas Marinas y Zonas Costeras (Govern de les Illes Balears).',
    authority: 'Govern de les Illes Balears',
    regionalNotes: 'Verify marine reserve no-take zones before fishing coastal rock shelves.',
  },
  Canarias: {
    licenseName: 'Licencia de Pesca Marítima de Recreo de Canarias',
    permitRequirementSuffix: 'marine reserve authorization where applicable',
    cotoSystem: 'Zonas Costeras y Reservas Marinas (Gobierno de Canarias).',
    authority: 'Gobierno de Canarias',
    regionalNotes: 'Check coastal protected marine reserve zones and minimum landing sizes.',
  },
  'Spain (Regional Authority)': {
    licenseName: 'Licencia de Pesca Autonómica (or separate €25/yr Licencia Interautonómica where applicable)',
    permitRequirementSuffix: 'local Coto / AREC / ZPC permit where designated',
    cotoSystem: 'Regional Cotos de Pesca / AREC / Zonas de Pesca Controlada (verify local autonomous community).',
    authority: 'Spanish Autonomous Community Fisheries Authority',
    regionalNotes:
      'Always verify the specific Autonomous Community Orden Anual de Vedas, watercraft/floatation rules, and on-site signage before fishing.',
  },
};

const SPAIN_COMMUNITY_ALIASES: Array<[RegExp, keyof typeof SPAIN_AUTONOMOUS_COMMUNITY_RULES]> = [
  [/valencian|comunitat valenciana|comunidad valenciana/i, 'Comunidad Valenciana'],
  [/arag[oó]n/i, 'Aragón'],
  [/catalu[nñ]a|catalonia|catalunya/i, 'Cataluña'],
  [/andaluc[ií]a|andalusia/i, 'Andalucía'],
  [/extremadura/i, 'Extremadura'],
  [/castil[le].*mancha/i, 'Castilla-La Mancha'],
  [/madrid/i, 'Comunidad de Madrid'],
  [/castil[le].*le[oó]n|castilla y le[oó]n/i, 'Castilla y León'],
  [/galicia/i, 'Galicia'],
  [/asturias/i, 'Asturias'],
  [/cantabria/i, 'Cantabria'],
  [/pa[ií]s vasco|basque|euskadi/i, 'País Vasco'],
  [/navarr[ae]/i, 'Navarra'],
  [/rioja/i, 'La Rioja'],
  [/murcia/i, 'Región de Murcia'],
  [/balear/i, 'Illes Balears'],
  [/canari/i, 'Canarias'],
];

function resolveSpainAutonomousCommunityKey(
  rawCommunity: string
): keyof typeof SPAIN_AUTONOMOUS_COMMUNITY_RULES {
  const trimmed = rawCommunity.trim();
  const exact = Object.keys(SPAIN_AUTONOMOUS_COMMUNITY_RULES).find((k) =>
    trimmed.toLowerCase().includes(k.toLowerCase())
  );
  if (exact) {
    return exact as keyof typeof SPAIN_AUTONOMOUS_COMMUNITY_RULES;
  }
  for (const [pattern, targetKey] of SPAIN_COMMUNITY_ALIASES) {
    if (pattern.test(trimmed)) {
      return targetKey;
    }
  }
  return 'Spain (Regional Authority)';
}

export { computeSelectionScale };

/**
 * Queries Open-Meteo 90m Copernicus DEM Elevation API across 9 points inside the selected bbox
 * to determine water surface altitude (m ASL) and surrounding shoreline bank steepness.
 */
async function fetchElevationAndSlopeProfile(bbox: BoundingBox): Promise<{
  waterElevationM: number;
  reliefRangeM: number;
  shoreAccessibilitySummary: string;
  sectorSlopePromptSummary: string;
  sectorSamples: DemSectorSample[];
}> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  const samplePoints = [
    { label: 'Center Sector (Grid D4/E5)', xPct: 50, yPct: 50, lat: minLat + latSpan * 0.5, lng: minLng + lngSpan * 0.5 },
    { label: 'North Sector (Grid D1/E1)', xPct: 50, yPct: 12, lat: minLat + latSpan * 0.88, lng: minLng + lngSpan * 0.5 },
    { label: 'South Sector (Grid D8/E8)', xPct: 50, yPct: 88, lat: minLat + latSpan * 0.12, lng: minLng + lngSpan * 0.5 },
    { label: 'West Sector (Grid B4/B5)', xPct: 15, yPct: 50, lat: minLat + latSpan * 0.5, lng: minLng + lngSpan * 0.15 },
    { label: 'East Sector (Grid G4/G5)', xPct: 85, yPct: 50, lat: minLat + latSpan * 0.5, lng: minLng + lngSpan * 0.85 },
    { label: 'NW Sector (Grid B2)', xPct: 20, yPct: 20, lat: minLat + latSpan * 0.8, lng: minLng + lngSpan * 0.2 },
    { label: 'NE Sector (Grid G2)', xPct: 80, yPct: 20, lat: minLat + latSpan * 0.8, lng: minLng + lngSpan * 0.8 },
    { label: 'SW Sector (Grid B7)', xPct: 20, yPct: 80, lat: minLat + latSpan * 0.2, lng: minLng + lngSpan * 0.2 },
    { label: 'SE Sector (Grid G7)', xPct: 80, yPct: 80, lat: minLat + latSpan * 0.2, lng: minLng + lngSpan * 0.8 },
  ];

  try {
    const lats = samplePoints.map((p) => p.lat.toFixed(5)).join(',');
    const lngs = samplePoints.map((p) => p.lng.toFixed(5)).join(',');
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (res.ok) {
      const data = (await res.json()) as { elevation?: number[] };
      const elevations = data.elevation ?? [];
      if (elevations.length === samplePoints.length) {
        const waterElevationM = Math.round(Math.min(...elevations));
        const maxElevationM = Math.round(Math.max(...elevations));
        const reliefRangeM = Math.max(0, maxElevationM - waterElevationM);

        const flatSectors: string[] = [];
        const moderateSectors: string[] = [];
        const cliffSectors: string[] = [];
        const promptLines: string[] = [];
        const sectorSamples: DemSectorSample[] = [];

        samplePoints.forEach((pt, idx) => {
          const elev = Math.round(elevations[idx]);
          const rise = Math.max(0, elev - waterElevationM);
          sectorSamples.push({
            label: pt.label,
            x_percent: pt.xPct,
            y_percent: pt.yPct,
            lat: pt.lat,
            lng: pt.lng,
            elevationM: elev,
            riseM: rise,
          });
          let slopeClass = 'Flat/Gentle Walkable Bank';
          if (rise > 55) {
            slopeClass = `Steep Canyon Cliff (+${rise}m vertical relief — Difficult/Inaccessible on foot)`;
            cliffSectors.push(`${pt.label} (+${rise}m)`);
          } else if (rise > 18) {
            slopeClass = `Moderate Bank Slope (+${rise}m rise — Hike-in shore access)`;
            moderateSectors.push(`${pt.label} (+${rise}m)`);
          } else {
            flatSectors.push(`${pt.label} (+${rise}m)`);
          }
          promptLines.push(`- ${pt.label}: ${elev}m ASL (${slopeClass})`);
        });

        const shoreParts: string[] = [];
        if (flatSectors.length > 0) {
          shoreParts.push(`Accessible flat/gentle banks in ${flatSectors.slice(0, 3).join(', ')}`);
        }
        if (moderateSectors.length > 0) {
          shoreParts.push(`moderate hike-in slopes in ${moderateSectors.slice(0, 2).join(', ')}`);
        }
        if (cliffSectors.length > 0) {
          shoreParts.push(`steep canyon walls/cliffs in ${cliffSectors.slice(0, 3).join(', ')} (avoid steep foot descent)`);
        }

        return {
          waterElevationM,
          reliefRangeM,
          shoreAccessibilitySummary:
            shoreParts.join('; ') ||
            `Water altitude ~${waterElevationM}m ASL (DEM est.) with ${reliefRangeM}m surrounding terrain relief.`,
          sectorSlopePromptSummary: promptLines.join('\n'),
          sectorSamples,
        };
      }
    }
  } catch {
    // Fallback below
  }

  return {
    waterElevationM: 380,
    reliefRangeM: 95,
    shoreAccessibilitySummary:
      'Mixed topography: verify shore slope and footpath footing on site before descending steep banks.',
    sectorSlopePromptSummary:
      '- DEM elevation service unavailable; verify local shoreline steepness from satellite relief cues.',
    sectorSamples: [],
  };
}

/**
 * Estimates local bank relief (m above water surface) at `(xPercent, yPercent)` using
 * inverse-distance-weighted interpolation of the 9 DEM sector samples instead of global bbox max.
 */
export function resolveLocalSectorReliefM(
  samples: DemSectorSample[],
  xPercent: number,
  yPercent: number,
  fallbackReliefM: number
): number {
  if (!samples || samples.length === 0) return fallbackReliefM;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of samples) {
    const dist = Math.hypot(xPercent - s.x_percent, yPercent - s.y_percent);
    if (dist < 1e-3) return s.riseM;
    const w = 1 / (dist * dist);
    weightedSum += s.riseM * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : fallbackReliefM;
}

/**
 * Enriches the selected bounding box with:
 * 1. Exact Water Body Name & Spanish Autonomous Community (DB + Wikipedia ES/EN GeoSearch + Nominatim)
 * 2. 9-Point DEM Altitude & Shore Accessibility Profile (Open-Meteo)
 * 3. Perimeter Road Availability (OSM Nominatim)
 * 4. Multi-Source Spain Fishing Restrictions & Protected Area Verification
 */
export async function buildEnrichedGeospatialContext(
  bbox: BoundingBox,
  hintWaterBodyId?: string,
  clientWaterMask?: ClientWaterMaskSummary | null
): Promise<EnrichedGeospatialContext> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const scale = computeSelectionScale(bbox);

  // 1. Check Curated DB match only when bbox actually overlaps the seeded water body (never wide ±2.5km halos)
  let candidateRecord: WaterBodyRecord | undefined;
  if (hintWaterBodyId) {
    const hinted = SEEDED_WATER_BODIES.find((w) => w.id === hintWaterBodyId);
    if (
      hinted &&
      Math.abs(hinted.centerLng - centerLng) < 0.025 &&
      Math.abs(hinted.centerLat - centerLat) < 0.025
    ) {
      candidateRecord = hinted;
    }
  }
  if (!candidateRecord) {
    for (const wb of SEEDED_WATER_BODIES) {
      const [wMinLng, wMinLat, wMaxLng, wMaxLat] = wb.bbox;
      const overlaps =
        maxLng >= wMinLng &&
        minLng <= wMaxLng &&
        maxLat >= wMinLat &&
        minLat <= wMaxLat &&
        centerLng >= wMinLng - 0.005 &&
        centerLng <= wMaxLng + 0.005 &&
        centerLat >= wMinLat - 0.005 &&
        centerLat <= wMaxLat + 0.005;
      if (overlaps) {
        candidateRecord = wb;
        break;
      }
    }
  }

  // 2. Run Elevation/Slope API, Overpass Water+Roads, optional Server OSM Water Tile Mask,
  //    Wikipedia ES/EN GeoSearch, and Nominatim Reverse all in parallel
  const searchRadiusM = Math.min(10000, Math.max(5000, Math.round(scale.maxSpanKm * 900)));

  const preliminaryWaterType = candidateRecord?.waterType ?? 'auto';

  const [
    elevationProfile,
    osmData,
    serverTileMask,
    wikiTitlesEs,
    wikiTitlesEn,
    nomCenter,
    nomShoreRoad,
    initialSpeciesLookup,
  ] = await Promise.all([
    fetchElevationAndSlopeProfile(bbox),
    fetchOsmWaterAndRoads(bbox),
    clientWaterMask ? Promise.resolve(null) : fetchServerOsmWaterMask(bbox),
    fetchWikipediaGeoSearch('es', centerLat, centerLng, searchRadiusM),
    fetchWikipediaGeoSearch('en', centerLat, centerLng, searchRadiusM),
    fetchNominatimReverse(centerLat, centerLng, 13),
    fetchNominatimReverse(minLat + (maxLat - minLat) * 0.78, centerLng, 16),
    fetchLiveFishOccurrences({ bbox, waterType: preliminaryWaterType }),
  ]);

  const rasterWaterMask: ClientWaterMaskSummary | null =
    clientWaterMask ?? serverTileMask ?? null;

  const waterCellMask = computeAllowedWaterCells(
    bbox,
    osmData.waterPolygons,
    rasterWaterMask,
    osmData.osmWaterStatus
  );

  // Never keep a seeded water body match if verified water mask says zero fishable water exists in this crop
  const matchedRecord =
    waterCellMask.waterPresence === 'no_water' ? undefined : candidateRecord;

  const allWikiTitles = Array.from(new Set([...wikiTitlesEs, ...wikiTitlesEn]));

  // Refine water_elevation_m using DEM sample points inside verified water cells/polygons
  let refinedWaterElevationM = elevationProfile.waterElevationM;
  let refinedReliefRangeM = elevationProfile.reliefRangeM;
  const sectorSamples = elevationProfile.sectorSamples;
  if (sectorSamples.length > 0) {
    const minSectorElev = Math.min(...sectorSamples.map((s) => s.elevationM));
    const waterSamples = sectorSamples.filter((s) => {
      if (osmData.waterPolygons.length > 0) {
        const [lng, lat] = percentToLngLat(s.x_percent, s.y_percent, bbox);
        return osmData.waterPolygons.some((wp) => booleanPointInPolygon(point([lng, lat]), wp));
      }
      if (rasterWaterMask?.grid64Mask) {
        return isPercentOnRasterWater(rasterWaterMask.grid64Mask, s.x_percent, s.y_percent, 0);
      }
      return false;
    });
    // Use lowest verified water-pixel elevation (within +60m of bbox floor) so steep canyon cliff pixels never inflate water altitude
    const plausibleWaterSamples = waterSamples.filter((s) => s.elevationM <= minSectorElev + 60);
    const chosenWaterSamples = plausibleWaterSamples.length > 0 ? plausibleWaterSamples : waterSamples;
    if (chosenWaterSamples.length > 0) {
      const candidateElev = Math.min(...chosenWaterSamples.map((s) => s.elevationM));
      if (candidateElev <= minSectorElev + 60) {
        refinedWaterElevationM = candidateElev;
        const maxElev = Math.max(...sectorSamples.map((s) => s.elevationM));
        refinedReliefRangeM = Math.max(0, maxElev - refinedWaterElevationM);
        for (const s of sectorSamples) {
          s.riseM = Math.max(0, s.elevationM - refinedWaterElevationM);
        }
      }
    }
  }

  // Identify explicit water body titles from Wikipedia GeoSearch
  const waterBodyRegex =
    /\b(embalse|pantano|río|rio|lago|laguna|albufera|azud|mar de|reservoir|river|lake|canal|cala|playa|bahía|estanque)\b/i;
  const wikiWaterBodies = allWikiTitles.filter((t) => waterBodyRegex.test(t));

  // Identify protected areas or restricted infrastructure from Wikipedia GeoSearch
  const protectedOrDamRegex =
    /\b(parque natural|parque nacional|reserva natural|reserva fluvial|refugio|zepa|natura 2000|presa|central nuclear|central hidroeléctrica|militar)\b/i;
  const detectedRestrictedPlaces = Array.from(
    new Set([
      ...allWikiTitles.filter((t) => protectedOrDamRegex.test(t)),
      ...osmData.hazards,
    ])
  );

  // Determine the best Water Body Name
  const nomWaterName =
    nomCenter?.address?.water ||
    nomCenter?.address?.reservoir ||
    nomCenter?.address?.lake ||
    nomCenter?.address?.river ||
    nomCenter?.address?.bay ||
    (nomCenter?.category === 'natural' || nomCenter?.category === 'waterway'
      ? nomCenter?.name
      : undefined);

  const waterBodyName =
    matchedRecord?.name ||
    nomWaterName ||
    wikiWaterBodies[0] ||
    (nomCenter?.name
      ? `${nomCenter.name} (${nomCenter.address?.municipality || nomCenter.address?.county || 'Sector'})`
      : `Water Sector (${centerLat.toFixed(3)}°N, ${centerLng.toFixed(3)}°E)`);

  const autonomousCommunity =
    nomCenter?.address?.state ||
    (matchedRecord?.regionLabel.includes('Valencia')
      ? 'Comunidad Valenciana'
      : matchedRecord?.regionLabel.includes('Aragón')
        ? 'Aragón'
        : 'Spain');

  const municipality =
    nomCenter?.address?.municipality ||
    nomCenter?.address?.town ||
    nomCenter?.address?.village ||
    nomCenter?.address?.county ||
    '';

  const rawCountry = nomCenter?.address?.country || 'Spain';
  const normalizedCountry = rawCountry === 'España' ? 'Spain' : rawCountry;

  const regionLabel =
    matchedRecord?.regionLabel ||
    [municipality, autonomousCommunity, normalizedCountry]
      .filter(Boolean)
      .join(', ');

  // Fetch Wikipedia introductory extract for the water body if not already in matchedRecord
  const primaryWikiTitle = wikiWaterBodies[0] || detectedRestrictedPlaces[0] || allWikiTitles[0];
  const wikipediaExtract = matchedRecord?.description
    ? matchedRecord.description
    : primaryWikiTitle
      ? await fetchWikipediaExtract('es', primaryWikiTitle)
      : '';

  // Extract road availability + surface classification from Overpass + Nominatim
  const overpassRoadNames = osmData.roads
    .filter((r) => !['footway', 'path', 'steps'].includes(r.highway))
    .map((r) => {
      const surf = r.surface
        ? r.surface
        : r.highway === 'track'
          ? `dirt track${r.tracktype ? ` (${r.tracktype})` : ''}`
          : ['secondary', 'tertiary', 'primary', 'residential'].includes(r.highway)
            ? 'asphalt'
            : r.highway;
      return `${r.name} [${surf}]`;
    });

  const detectedRoads = Array.from(
    new Set(
      [
        ...overpassRoadNames.slice(0, 6),
        nomShoreRoad?.address?.road,
        nomShoreRoad?.name && nomShoreRoad?.category === 'highway'
          ? nomShoreRoad.name
          : undefined,
        nomCenter?.address?.road,
      ].filter(Boolean) as string[]
    )
  );

  const pavedCount = osmData.roads.filter((r) =>
    ['asphalt', 'paved', 'concrete'].includes((r.surface || '').toLowerCase()) ||
    ['primary', 'secondary', 'tertiary', 'residential'].includes(r.highway)
  ).length;
  const trackCount = osmData.roads.filter(
    (r) =>
      r.highway === 'track' ||
      ['unpaved', 'dirt', 'gravel', 'ground'].includes((r.surface || '').toLowerCase())
  ).length;

  const roadPromptSummary =
    overpassRoadNames.length > 0
      ? `OSM Roads in/near bbox (${pavedCount} paved/asphalt segments, ${trackCount} dirt/gravel tracks): ${overpassRoadNames.slice(0, 8).join('; ')}`
      : detectedRoads.length > 0
        ? `Nominatim roads near perimeter: ${detectedRoads.join(', ')}`
        : `No mapped paved roads inside crop; check for rural dirt tracks or boat/hike-in access.`;

  const roadAccessSummary =
    overpassRoadNames.length > 0
      ? `${pavedCount > 0 ? `${pavedCount} paved/asphalt segment(s)` : 'No paved roads inside crop'}${trackCount > 0 ? ` + ${trackCount} dirt/gravel track(s)` : ''}: ${detectedRoads.slice(0, 4).join(', ')}`
      : detectedRoads.length > 0
        ? `Verified perimeter road access: ${detectedRoads.join(', ')} (${municipality || autonomousCommunity}).`
        : `Rural/mountain perimeter tracks in ${municipality || autonomousCommunity}; verify track grade before driving down to shore.`;

  const detectedWaterType = inferWaterTypeFromContext(
    matchedRecord,
    nomCenter,
    waterBodyName
  );

  const liveSpeciesLookup =
    waterCellMask.waterPresence !== 'no_water' &&
    detectedWaterType === 'sea' &&
    preliminaryWaterType !== 'sea'
      ? await fetchLiveFishOccurrences({ bbox, waterType: 'sea' })
      : initialSpeciesLookup;

  const curatedSpecies = matchedRecord
    ? buildSpeciesRoster(
        matchedRecord.commonSpecies,
        detectedWaterType,
        waterBodyName,
        autonomousCommunity,
        refinedWaterElevationM
      )
    : undefined;
  const regionalFallback = buildSpeciesRoster(
    undefined,
    detectedWaterType,
    waterBodyName,
    autonomousCommunity,
    refinedWaterElevationM
  );

  const speciesPresentDefaults = mergeSpeciesWithOccurrences({
    curatedSpecies,
    liveOccurrences: liveSpeciesLookup.occurrences,
    regionalFallback,
    waterType: detectedWaterType,
  });

  const liveSpeciesSummary =
    liveSpeciesLookup.occurrences.length > 0
      ? `${liveSpeciesLookup.sourcesUsed.join(' + ') || 'Live Occurrence API'}: ${liveSpeciesLookup.occurrences
          .slice(0, 6)
          .map((o) => `${o.species.name} (${o.scientificName}, ${o.observationCount} sightings)`)
          .join('; ')}`
      : `No recent citizen/survey sightings indexed inside local watershed; using Spain ${detectedWaterType} regional baseline.`;

  const geographicalContext: ArtifactGeographicalContext = {
    water_elevation_m: refinedWaterElevationM,
    relief_range_m: refinedReliefRangeM,
    scale_mode: scale.scaleMode,
    scale_label: scale.scaleLabel,
    road_access_summary: roadAccessSummary,
    shore_accessibility_summary: elevationProfile.shoreAccessibilitySummary,
  };

  const centerCommunityKey = resolveSpainAutonomousCommunityKey(autonomousCommunity);
  const shoreCommunityRaw = nomShoreRoad?.address?.state ?? '';
  const shoreCommunityKey = shoreCommunityRaw
    ? resolveSpainAutonomousCommunityKey(shoreCommunityRaw)
    : '';
  const borderAutonomousCommunity =
    shoreCommunityKey &&
    shoreCommunityKey !== 'Spain (Regional Authority)' &&
    shoreCommunityKey !== centerCommunityKey
      ? shoreCommunityKey
      : undefined;

  // Build Spain Fishing Restrictions & Regulatory Check
  const restrictionCheck = buildSpainRestrictionCheck({
    waterBodyName,
    autonomousCommunity,
    borderAutonomousCommunity,
    hasRegionalBoundary: osmData.hasRegionalBoundary || Boolean(borderAutonomousCommunity),
    matchedRecord,
    detectedRestrictedPlaces,
    nomExtratags: nomCenter?.extratags,
  });

  const flowContext = computeFlowContext({
    waterwayLines: osmData.waterwayLines,
    waterPolygons: osmData.waterPolygons.filter(
      (wp): wp is import('geojson').Feature<import('geojson').Polygon> =>
        wp.geometry.type === 'Polygon'
    ),
    sampleElevationFn:
      sectorSamples.length > 0
        ? (lng, lat) => {
            const px = ((lng - minLng) / Math.max(1e-6, maxLng - minLng)) * 100;
            const py = ((maxLat - lat) / Math.max(1e-6, maxLat - minLat)) * 100;
            let best: (typeof sectorSamples)[number] | null = null;
            let bestDist = Infinity;
            for (const s of sectorSamples) {
              const d = Math.hypot(s.x_percent - px, s.y_percent - py);
              if (d < bestDist) {
                bestDist = d;
                best = s;
              }
            }
            return best ? best.elevationM : null;
          }
        : undefined,
  });

  return {
    matchedRecord,
    waterBodyName,
    regionLabel,
    autonomousCommunity,
    scaleMode: scale.scaleMode,
    widthKm: scale.widthKm,
    heightKm: scale.heightKm,
    metersPerPixel: scale.metersPerPixel,
    landmarks: allWikiTitles.slice(0, 8),
    detectedRoads,
    roads: osmData.roads,
    roadPromptSummary,
    waterPolygons: osmData.waterPolygons,
    flowContext,
    osmWaterStatus: osmData.osmWaterStatus,
    rasterWaterMask,
    waterCellMask,
    demSectorSamples: sectorSamples,
    speciesPresentDefaults,
    liveSpeciesSummary,
    wikipediaExtract,
    sectorSlopePromptSummary: elevationProfile.sectorSlopePromptSummary,
    geographicalContext,
    restrictionCheck,
  };
}

/**
 * Distinguishes marine/coastal sectors from inland reservoirs/rivers (explicitly guarding
 * against inland names like "Mar de Aragón" / Embalse de Mequinenza).
 */
export function inferWaterTypeFromContext(
  matchedRecord: WaterBodyRecord | undefined,
  nomCenter: {
    type?: string;
    address?: Record<string, string>;
  } | null,
  waterBodyName: string
): 'freshwater' | 'sea' {
  if (matchedRecord) return matchedRecord.waterType;

  const isInlandReservoir = /\b(embalse|pantano|reservoir|mar de arag[oó]n|r[ií]o|river|lago|laguna)\b/i.test(
    waterBodyName
  );
  if (isInlandReservoir) return 'freshwater';

  if (
    nomCenter?.address?.sea ||
    nomCenter?.address?.bay ||
    ['bay', 'coastline', 'sea', 'strait', 'harbour', 'beach'].includes(
      nomCenter?.type ?? ''
    )
  ) {
    return 'sea';
  }

  if (
    /\b(mediterr[aá]neo|mediterranean|atl[aá]ntico|atlantic|cant[aá]brico|balearic|golfo|bah[ií]a|playa|cala)\b/i.test(
      waterBodyName
    )
  ) {
    return 'sea';
  }

  return 'freshwater';
}

export function buildSpainRestrictionCheck(params: {
  waterBodyName: string;
  autonomousCommunity: string;
  borderAutonomousCommunity?: string;
  hasRegionalBoundary?: boolean;
  matchedRecord?: WaterBodyRecord;
  detectedRestrictedPlaces: string[];
  nomExtratags?: Record<string, string>;
}): ArtifactRestrictionCheck {
  // Match Autonomous Community rules (supports both Spanish and English Nominatim names)
  const matchedCommunityKey = resolveSpainAutonomousCommunityKey(
    params.autonomousCommunity
  );

  const communityRule = SPAIN_AUTONOMOUS_COMMUNITY_RULES[matchedCommunityKey];

  const protectedAreaRegimePhrase = ['Comunidad Valenciana', 'Cataluña', 'Andalucía'].includes(
    matchedCommunityKey
  )
    ? 'designated Zonas de Pesca Controlada (ZPC); integral reserve zones are prohibited.'
    : matchedCommunityKey === 'Castilla y León'
      ? 'designated Cotos, AREC, or Tramos Libres; Vedados and integral reserve zones are prohibited.'
      : matchedCommunityKey === 'Galicia'
        ? 'designated Cotos or Tramos Libres per Xunta de Galicia; Vedados and integral reserve zones are prohibited.'
        : 'designated Cotos or regulated stretches; Vedados and integral reserve zones are prohibited.';

  const prohibitedWarnings: string[] = [];
  if (params.matchedRecord?.restrictionZones) {
    for (const z of params.matchedRecord.restrictionZones) {
      if (z.status === 'prohibited') {
        prohibitedWarnings.push(
          `${z.cellId ? `[Grid ${z.cellId}] ` : ''}${z.reason}`
        );
      }
    }
  }

  for (const place of params.detectedRestrictedPlaces) {
    if (/nuclear|presa|militar/i.test(place)) {
      prohibitedWarnings.push(
        `Safety Exclusion Buffer: ${place} — strictly prohibited within 100m–500m of dam walls, spillways, and power plant intakes.`
      );
    } else if (/parque natural|reserva|refugio/i.test(place)) {
      prohibitedWarnings.push(
        `Protected Nature Area (${place}) — fishing restricted to ${protectedAreaRegimePhrase}`
      );
    }
  }

  if (params.nomExtratags?.fishing === 'no' || params.nomExtratags?.access === 'private') {
    prohibitedWarnings.push(
      'OpenStreetMap tags indicate restricted/private shore access in part of this sector.'
    );
  }

  const hasStrictReserve = params.detectedRestrictedPlaces.some((p) =>
    /reserva natural|refugio de pesca|parque nacional/i.test(p)
  );

  const status: RestrictionStatus = hasStrictReserve
    ? 'seasonal_restriction'
    : 'permit_required';

  const statusLabel = hasStrictReserve
    ? `⚠️ Protected Area / Special Coto Regulations (${matchedCommunityKey})`
    : `🪪 Permit Required — Recreational Angling Allowed in Designated Zones (${matchedCommunityKey})`;

  const prohibitedZonesWarning =
    prohibitedWarnings.length > 0
      ? prohibitedWarnings.join(' | ')
      : `Observe mandatory safety buffers around hydroelectric dam walls (presas), weirs (azudes), intake towers, and marked waterfowl sanctuaries (15m–100m+ per regional/reservoir annex).`;

  const hasBorderWarning =
    Boolean(params.hasRegionalBoundary) ||
    Boolean(
      params.borderAutonomousCommunity &&
        params.borderAutonomousCommunity !== matchedCommunityKey
    );

  const borderSummary = hasBorderWarning
    ? params.borderAutonomousCommunity &&
      params.borderAutonomousCommunity !== matchedCommunityKey
      ? `Border-water jurisdiction: spans ${matchedCommunityKey} / ${params.borderAutonomousCommunity} — verify which bank you fish from, as opposite shores may require separate regional licenses or Coto/AREC passes.`
      : 'Border-water jurisdiction: spans an Autonomous Community boundary — verify bank-side permit & regime (e.g., Tramo Libre vs AREC/Coto) on opposite shores.'
    : undefined;

  const regulationsList = [
    `Mandatory Regional License: ${communityRule.licenseName}.`,
    `Local Water Regime: ${communityRule.cotoSystem}`,
    ...(borderSummary ? [borderSummary] : []),
    `Invasive Species Law (Real Decreto 630/2013): For Black Bass, Pike (Lucio), Zander (Lucioperca), Wels Catfish (Siluro), Rainbow Trout (outside exempted zones), and Bleak (Alburno), using live fish as bait (pez vivo) and transporting live specimens is strictly prohibited across Spain.`,
    communityRule.regionalNotes,
  ];

  const verifiedSources = [
    `Authority: ${communityRule.authority}`,
    'Real Decreto 630/2013 (Catálogo Español de Especies Exóticas Invasoras)',
    'OpenStreetMap Overpass/Nominatim & Protected Area Boundaries',
    'Wikipedia España GeoSearch & Hydrological Registry',
  ];
  if (params.matchedRecord) {
    verifiedSources.unshift(`Fishing Spot Curated Spain DB (${params.matchedRecord.name})`);
  }

  const permitsRequired = borderSummary
    ? `${communityRule.licenseName} + ${communityRule.permitRequirementSuffix}. ${borderSummary}`
    : `${communityRule.licenseName} + ${communityRule.permitRequirementSuffix}.`;

  return {
    status,
    status_label: statusLabel,
    permits_required: permitsRequired,
    prohibited_zones_warning: prohibitedZonesWarning,
    regulations_list: regulationsList,
    verified_sources: verifiedSources,
    disclaimer:
      'Regulatory check combines Spanish Autonomous Community fishing decrees, OpenStreetMap protected-area/dam tags, and Wikipedia hydrological records. Always verify the current annual Orden de Vedas, floatation rules, and on-site signage before fishing.',
  };
}

async function fetchWikipediaGeoSearch(
  lang: 'es' | 'en',
  lat: number,
  lng: number,
  radiusM: number
): Promise<string[]> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat.toFixed(5)}|${lng.toFixed(5)}&gsradius=${radiusM}&gslimit=12&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FishingSpotAI-SpainMVP/1.0' },
      signal: AbortSignal.timeout(2800),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.query?.geosearch ?? []).map(
        (item: { title: string }) => item.title
      );
    }
  } catch {
    // Ignore network timeout
  }
  return [];
}

async function fetchWikipediaExtract(
  lang: 'es' | 'en',
  title: string
): Promise<string> {
  try {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(title)}&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FishingSpotAI-SpainMVP/1.0' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = await res.json();
      const pages = data.query?.pages ?? {};
      const firstPage = Object.values(pages)[0] as { extract?: string } | undefined;
      if (firstPage?.extract) {
        return firstPage.extract.slice(0, 500);
      }
    }
  } catch {
    // Ignore
  }
  return '';
}

async function fetchNominatimReverse(
  lat: number,
  lng: number,
  zoom: number
): Promise<{
  name?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
} | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=${zoom}&extratags=1&accept-language=en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FishingSpotAI-SpainMVP/1.0' },
      signal: AbortSignal.timeout(2800),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Ignore
  }
  return null;
}
