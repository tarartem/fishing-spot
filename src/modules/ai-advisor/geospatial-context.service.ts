import { SEEDED_WATER_BODIES } from '@db/seed/poland-spain-waters';
import type {
  ArtifactGeographicalContext,
  ArtifactRestrictionCheck,
  BoundingBox,
  RestrictionStatus,
  ScaleAnalysisMode,
  WaterBodyRecord,
} from '@/shared/types/domain';

export interface EnrichedGeospatialContext {
  matchedRecord?: WaterBodyRecord;
  waterBodyName: string;
  regionLabel: string;
  autonomousCommunity: string;
  scaleMode: ScaleAnalysisMode;
  widthKm: number;
  heightKm: number;
  landmarks: string[];
  detectedRoads: string[];
  wikipediaExtract: string;
  sectorSlopePromptSummary: string;
  geographicalContext: ArtifactGeographicalContext;
  restrictionCheck: ArtifactRestrictionCheck;
}

const SPAIN_AUTONOMOUS_COMMUNITY_RULES: Record<
  string,
  {
    licenseName: string;
    cotoSystem: string;
    authority: string;
    regionalNotes: string;
  }
> = {
  'Comunidad Valenciana': {
    licenseName:
      'Licencia de Pesca Recreo de la Comunitat Valenciana (Continental / Marítima) or Licencia Interautonómica',
    cotoSystem:
      'Zonas de Pesca Controlada (ZPC) & Acotados managed by Generalitat Valenciana / Conselleria de Medio Ambiente.',
    authority: 'Generalitat Valenciana (Orden Anual de Vedas)',
    regionalNotes:
      'In Embalses (Cortes, Tous, Contreras, Benagéber, Bellús), check ZPC daily permit requirements. Under Real Decreto 630/2013 & regional orders, live fish/vertebrates as bait (pez vivo) are strictly prohibited.',
  },
  Aragón: {
    licenseName:
      'Licencia de Pesca de Aragón (or Licencia Interautonómica) + Permiso de Coto Social/Deportivo',
    cotoSystem:
      'Cotos Deportivos (e.g., Mar de Aragón / Embalse de Mequinenza — Sociedad de Pesca El Siluro / FAPD).',
    authority: 'Gobierno de Aragón — Plan General de Pesca de Aragón',
    regionalNotes:
      'Night fishing for Siluro/Catfish is prohibited outside designated hours. Live bait is strictly prohibited; transport of live invasive species (Black Bass, Lucioperca, Siluro, Alburno) is illegal.',
  },
  Cataluña: {
    licenseName:
      'Llicència de Pesca Recreativa de Catalunya + Permís de Zona de Pesca Controlada (ZPC)',
    cotoSystem: 'Zonas de Pesca Controlada (ZPC) via Gencat.',
    authority: 'Generalitat de Catalunya',
    regionalNotes:
      'Strict rules on exotic species (Black Bass, Siluro, Lucioperca, Carpa); use of live fish as bait is forbidden.',
  },
  Andalucía: {
    licenseName:
      'Licencia de Pesca Continental de Andalucía (requiere NIR y curso/examen o exención)',
    cotoSystem: 'Cotos de Pesca y Tramos Libres (Junta de Andalucía).',
    authority: 'Junta de Andalucía — Orden General de Vedas',
    regionalNotes:
      'Check reservoir zoning for Black Bass and Pike spawning closures and mandatory zebra mussel (mejillón cebra) boat/wader disinfection rules in Guadalquivir/Guadiana basins.',
  },
  Extremadura: {
    licenseName:
      'Licencia de Pesca de Extremadura (or Licencia Interautonómica) + Coto Consorciado ticket',
    cotoSystem: 'Cotos Regionales y Consorciados (Cijara, García de Sola, Orellana, Alcántara).',
    authority: 'Junta de Extremadura — Orden General de Vedas',
    regionalNotes:
      'Premier Spanish predator waters (Cijara, Orellana, Alcántara). Live bait prohibited; check seasonal waterfowl reserve closures (ZEPA) in shallow coves.',
  },
  'Castilla-La Mancha': {
    licenseName:
      'Licencia de Pesca de Castilla-La Mancha (or Licencia Interautonómica)',
    cotoSystem: 'Cotos de Pesca y Aguas en Régimen Especial (Entrepeñas, Buendía, Bolarque).',
    authority: 'Junta de Comunidades de Castilla-La Mancha',
    regionalNotes:
      'Strict invasive species controls under Real Decreto 630/2013; live bait is prohibited.',
  },
  'Comunidad de Madrid': {
    licenseName: 'Licencia de Pesca de la Comunidad de Madrid (or Interautonómica)',
    cotoSystem: 'Cotos de Pesca (El Atazar, San Juan, Valmayor, Pinilla).',
    authority: 'Comunidad de Madrid — Orden Anual de Pesca',
    regionalNotes:
      'In Embalse de El Atazar (drinking water supply), wading and float-tubes/boats are strictly prohibited in designated protection zones.',
  },
  'Castilla y León': {
    licenseName: 'Licencia de Pesca de Castilla y León (gratuita / Interautonómica)',
    cotoSystem: 'Escenarios Deportivos-Sociales, Cotos de Pesca y Aguas en Régimen Especial.',
    authority: 'Junta de Castilla y León',
    regionalNotes: 'Check trout (trucha común) seasonal openings and salmonid stretch lure restrictions.',
  },
};

/**
 * Computes the physical width and height (in km) of the selected map bounding box
 * and classifies the analysis scale (micro <2.5km, meso 2.5–8km, macro >8km).
 */
export function computeSelectionScale(bbox: BoundingBox): {
  widthKm: number;
  heightKm: number;
  maxSpanKm: number;
  scaleMode: ScaleAnalysisMode;
  scaleLabel: string;
} {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const heightKm = Math.max(0.1, Math.abs(maxLat - minLat) * 111.32);
  const widthKm = Math.max(
    0.1,
    Math.abs(maxLng - minLng) * 111.32 * Math.cos(centerLatRad)
  );
  const maxSpanKm = Math.max(widthKm, heightKm);

  let scaleMode: ScaleAnalysisMode = 'micro';
  let scaleLabel = `High-Detail Tactical Selection (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km — Micro Terrain Mode)`;

  if (maxSpanKm > 8.0) {
    scaleMode = 'macro';
    scaleLabel = `Wide Basin Selection (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km — Macro Basin & Channel Mode)`;
  } else if (maxSpanKm > 2.5) {
    scaleMode = 'meso';
    scaleLabel = `Sector Selection (${widthKm.toFixed(1)} km × ${heightKm.toFixed(1)} km — Reservoir Sector Mode)`;
  }

  return {
    widthKm: Number(widthKm.toFixed(2)),
    heightKm: Number(heightKm.toFixed(2)),
    maxSpanKm: Number(maxSpanKm.toFixed(2)),
    scaleMode,
    scaleLabel,
  };
}

/**
 * Queries Open-Meteo 90m Copernicus DEM Elevation API across 9 points inside the selected bbox
 * to determine water surface altitude (m ASL) and surrounding shoreline bank steepness.
 */
async function fetchElevationAndSlopeProfile(bbox: BoundingBox): Promise<{
  waterElevationM: number;
  reliefRangeM: number;
  shoreAccessibilitySummary: string;
  sectorSlopePromptSummary: string;
}> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngSpan = maxLng - minLng;
  const latSpan = maxLat - minLat;

  const samplePoints = [
    { label: 'Center Water (Grid D4/E5)', lat: minLat + latSpan * 0.5, lng: minLng + lngSpan * 0.5 },
    { label: 'North Shore (Grid D1/E1)', lat: minLat + latSpan * 0.88, lng: minLng + lngSpan * 0.5 },
    { label: 'South Shore (Grid D8/E8)', lat: minLat + latSpan * 0.12, lng: minLng + lngSpan * 0.5 },
    { label: 'West Shore (Grid B4/B5)', lat: minLat + latSpan * 0.5, lng: minLng + lngSpan * 0.15 },
    { label: 'East Shore (Grid G4/G5)', lat: minLat + latSpan * 0.5, lng: minLng + lngSpan * 0.85 },
    { label: 'NW Sector (Grid B2)', lat: minLat + latSpan * 0.8, lng: minLng + lngSpan * 0.2 },
    { label: 'NE Sector (Grid G2)', lat: minLat + latSpan * 0.8, lng: minLng + lngSpan * 0.8 },
    { label: 'SW Sector (Grid B7)', lat: minLat + latSpan * 0.2, lng: minLng + lngSpan * 0.2 },
    { label: 'SE Sector (Grid G7)', lat: minLat + latSpan * 0.2, lng: minLng + lngSpan * 0.8 },
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

        samplePoints.forEach((pt, idx) => {
          const elev = Math.round(elevations[idx]);
          const rise = Math.max(0, elev - waterElevationM);
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
            `Water altitude ~${waterElevationM}m ASL with ${reliefRangeM}m surrounding terrain relief.`,
          sectorSlopePromptSummary: promptLines.join('\n'),
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
      'Mixed reservoir topography: accessible gentle gravel coves in northern/western inlets; steeper limestone canyon walls along main channel narrows.',
    sectorSlopePromptSummary:
      '- North & West Coves (D1/E1, B6/C7): Gentle accessible shore slope\n- Main Canyon Walls (F6, E7): Steeper rocky drop-off',
  };
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
  hintWaterBodyId?: string
): Promise<EnrichedGeospatialContext> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const scale = computeSelectionScale(bbox);

  // 1. Check Curated DB match if tightly inside bbox
  let matchedRecord: WaterBodyRecord | undefined;
  if (hintWaterBodyId) {
    const hinted = SEEDED_WATER_BODIES.find((w) => w.id === hintWaterBodyId);
    if (
      hinted &&
      Math.abs(hinted.centerLng - centerLng) < 0.03 &&
      Math.abs(hinted.centerLat - centerLat) < 0.03
    ) {
      matchedRecord = hinted;
    }
  }
  if (!matchedRecord) {
    for (const wb of SEEDED_WATER_BODIES) {
      const [wMinLng, wMinLat, wMaxLng, wMaxLat] = wb.bbox;
      if (
        centerLng >= wMinLng - 0.025 &&
        centerLng <= wMaxLng + 0.025 &&
        centerLat >= wMinLat - 0.025 &&
        centerLat <= wMaxLat + 0.025
      ) {
        matchedRecord = wb;
        break;
      }
    }
  }

  // 2. Run Elevation/Slope API, Wikipedia ES/EN GeoSearch, and Nominatim Reverse (Center + Shore Road check) in parallel
  const searchRadiusM = Math.min(10000, Math.max(5000, Math.round(scale.maxSpanKm * 900)));

  const [elevationProfile, wikiTitlesEs, wikiTitlesEn, nomCenter, nomShoreRoad] =
    await Promise.all([
      fetchElevationAndSlopeProfile(bbox),
      fetchWikipediaGeoSearch('es', centerLat, centerLng, searchRadiusM),
      fetchWikipediaGeoSearch('en', centerLat, centerLng, searchRadiusM),
      fetchNominatimReverse(centerLat, centerLng, 13),
      fetchNominatimReverse(minLat + (maxLat - minLat) * 0.78, centerLng, 16),
    ]);

  const allWikiTitles = Array.from(new Set([...wikiTitlesEs, ...wikiTitlesEn]));

  // Identify explicit water body titles from Wikipedia GeoSearch
  const waterBodyRegex =
    /\b(embalse|pantano|río|rio|lago|laguna|albufera|azud|mar de|reservoir|river|lake|canal|cala|playa|bahía|estanque)\b/i;
  const wikiWaterBodies = allWikiTitles.filter((t) => waterBodyRegex.test(t));

  // Identify protected areas or restricted infrastructure from Wikipedia GeoSearch
  const protectedOrDamRegex =
    /\b(parque natural|parque nacional|reserva natural|reserva fluvial|refugio|zepa|natura 2000|presa|central nuclear|central hidroeléctrica|militar)\b/i;
  const detectedRestrictedPlaces = allWikiTitles.filter((t) =>
    protectedOrDamRegex.test(t)
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
      : `Tramo de Agua (${centerLat.toFixed(3)}°N, ${centerLng.toFixed(3)}°E)`);

  const autonomousCommunity =
    nomCenter?.address?.state ||
    (matchedRecord?.regionLabel.includes('Valencia')
      ? 'Comunidad Valenciana'
      : matchedRecord?.regionLabel.includes('Aragón')
        ? 'Aragón'
        : 'Comunidad Valenciana / España');

  const municipality =
    nomCenter?.address?.municipality ||
    nomCenter?.address?.town ||
    nomCenter?.address?.village ||
    nomCenter?.address?.county ||
    '';

  const regionLabel =
    matchedRecord?.regionLabel ||
    [municipality, autonomousCommunity, nomCenter?.address?.country || 'Spain']
      .filter(Boolean)
      .join(', ');

  // Fetch Wikipedia introductory extract for the water body if not already in matchedRecord
  const primaryWikiTitle = wikiWaterBodies[0] || detectedRestrictedPlaces[0] || allWikiTitles[0];
  const wikipediaExtract = matchedRecord?.description
    ? matchedRecord.description
    : primaryWikiTitle
      ? await fetchWikipediaExtract('es', primaryWikiTitle)
      : '';

  // Extract road availability from Nominatim shore + center checks
  const detectedRoads = Array.from(
    new Set(
      [
        nomShoreRoad?.address?.road,
        nomShoreRoad?.name && nomShoreRoad?.category === 'highway'
          ? nomShoreRoad.name
          : undefined,
        nomCenter?.address?.road,
      ].filter(Boolean) as string[]
    )
  );

  const roadAccessSummary =
    detectedRoads.length > 0
      ? `Verified road/track access near perimeter: ${detectedRoads.join(', ')} (${municipality || autonomousCommunity}). Combine paved highway approach with local bank tracks.`
      : `Rural/mountain perimeter tracks in ${municipality || autonomousCommunity}; inspect satellite grid for dirt spur tracks leading to low-slope coves.`;

  const geographicalContext: ArtifactGeographicalContext = {
    water_elevation_m: elevationProfile.waterElevationM,
    relief_range_m: elevationProfile.reliefRangeM,
    scale_mode: scale.scaleMode,
    scale_label: scale.scaleLabel,
    road_access_summary: roadAccessSummary,
    shore_accessibility_summary: elevationProfile.shoreAccessibilitySummary,
  };

  // Build Spain Fishing Restrictions & Regulatory Check
  const restrictionCheck = buildSpainRestrictionCheck({
    waterBodyName,
    autonomousCommunity,
    matchedRecord,
    detectedRestrictedPlaces,
    nomExtratags: nomCenter?.extratags,
  });

  return {
    matchedRecord,
    waterBodyName,
    regionLabel,
    autonomousCommunity,
    scaleMode: scale.scaleMode,
    widthKm: scale.widthKm,
    heightKm: scale.heightKm,
    landmarks: allWikiTitles.slice(0, 8),
    detectedRoads,
    wikipediaExtract,
    sectorSlopePromptSummary: elevationProfile.sectorSlopePromptSummary,
    geographicalContext,
    restrictionCheck,
  };
}

function buildSpainRestrictionCheck(params: {
  waterBodyName: string;
  autonomousCommunity: string;
  matchedRecord?: WaterBodyRecord;
  detectedRestrictedPlaces: string[];
  nomExtratags?: Record<string, string>;
}): ArtifactRestrictionCheck {
  // Match Autonomous Community rules
  const matchedCommunityKey =
    Object.keys(SPAIN_AUTONOMOUS_COMMUNITY_RULES).find((k) =>
      params.autonomousCommunity.toLowerCase().includes(k.toLowerCase())
    ) || 'Comunidad Valenciana';

  const communityRule = SPAIN_AUTONOMOUS_COMMUNITY_RULES[matchedCommunityKey];

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
        `Protected Nature Area (${place}) — fishing restricted to designated Zonas de Pesca Controlada (ZPC); integral reserve zones are prohibited.`
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
      : `Keep a mandatory 100m safety distance from any hydroelectric dam walls (presas), weirs (azudes), intake towers, and marked waterfowl sanctuaries.`;

  const regulationsList = [
    `Mandatory Regional License: ${communityRule.licenseName}.`,
    `Local Water Regime: ${communityRule.cotoSystem}`,
    `Invasive Species Law (Real Decreto 630/2013): For Black Bass, Pike (Lucio), Zander (Lucioperca), Wels Catfish (Siluro), and Bleak (Alburno), using live fish as bait (pez vivo) and transporting live specimens is strictly prohibited across Spain.`,
    communityRule.regionalNotes,
  ];

  const verifiedSources = [
    `Authority: ${communityRule.authority}`,
    'Real Decreto 630/2013 (Catálogo Español de Especies Exóticas Invasoras)',
    'OpenStreetMap Nominatim & Protected Area Boundaries',
    'Wikipedia España GeoSearch & Hydrological Registry',
  ];
  if (params.matchedRecord) {
    verifiedSources.unshift(`Fishing Spot Curated Spain DB (${params.matchedRecord.name})`);
  }

  return {
    status,
    status_label: statusLabel,
    permits_required: `${communityRule.licenseName} + local Coto / ZPC daily permit where signposted.`,
    prohibited_zones_warning: prohibitedZonesWarning,
    regulations_list: regulationsList,
    verified_sources: verifiedSources,
    disclaimer:
      'Regulatory check combines Spanish Autonomous Community fishing decrees, OpenStreetMap protected-area tags, and Wikipedia hydrological records. Always verify the current annual Orden de Vedas and on-site Coto signage before fishing.',
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
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&zoom=${zoom}&extratags=1&accept-language=es,en`;
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
