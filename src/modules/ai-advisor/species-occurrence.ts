import type { BoundingBox, SpeciesPresenceInfo } from '@/shared/types/domain';

export interface LiveSpeciesOccurrence {
  scientificName: string;
  observationCount: number;
  source: 'inaturalist' | 'obis';
  waterHabitat: 'freshwater' | 'sea' | 'both';
  species: SpeciesPresenceInfo;
}

export interface LiveSpeciesLookupResult {
  occurrences: LiveSpeciesOccurrence[];
  sourcesUsed: string[];
}

interface IberianSpeciesProfile {
  catalogKey: string;
  waterHabitat: 'freshwater' | 'sea' | 'both';
  species: SpeciesPresenceInfo;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const SPECIES_LOOKUP_TIMEOUT_MS = 2500;
const MIN_SEARCH_HALF_SPAN_DEG = 0.05; // ~5 km local watershed halo

const occurrenceCache = new Map<
  string,
  { expiresAt: number; result: LiveSpeciesLookupResult }
>();

export const SPECIES_CATALOG_ES: Record<string, SpeciesPresenceInfo> = {
  black_bass: {
    name: 'Black Bass',
    habitat_zone: 'Submerged rock shelves, rocky points, flooded timber & coves (1–7m)',
    recommended_approach: 'Texas-rigged craws/worms, suspending jerkbaits, spinnerbaits',
    regulation_note: 'Invasive species rule: live bait & live transport prohibited',
  },
  zander: {
    name: 'Zander',
    habitat_zone: 'Deep canyon channel edges, 5–14m drop-offs & low-light ledges',
    recommended_approach: 'Paddle-tail shads on 10–18g jig heads bounced down ledges',
    regulation_note: 'Invasive species rule: live bait & live transport prohibited',
  },
  carp: {
    name: 'Common Carp',
    habitat_zone: 'Warm shallow bays, muddy/gravel flats & shoreline reed margins (1–5m)',
    recommended_approach: 'Method feeder, boilies, sweetcorn, or surface crust in sheltered coves',
    regulation_note: 'Check regional seasonal orders for catch-and-release or controlled zone rules',
  },
  barbel: {
    name: 'Iberian Barbel',
    habitat_zone: 'Current seams, gravel tailouts, canyon bottlenecks & rocky shelves',
    recommended_approach: 'Bottom feeder with cheese/pellets or small deep-diving crankbaits',
    regulation_note: 'Native species — observe minimum size & seasonal closed periods',
  },
  pike: {
    name: 'Northern Pike',
    habitat_zone: 'Weed edges, submerged trees & bay mouths (2–8m)',
    recommended_approach: 'Large swimbaits, spinnerbaits, spoons with wire/heavy fluoro leader',
    regulation_note: 'Invasive species rule: live bait & live transport prohibited',
  },
  catfish: {
    name: 'Wels Catfish',
    habitat_zone: 'Deep main river bends, dam tailraces & deep channel holes (6–18m)',
    recommended_approach: 'Heavy halibut pellets, large soft shads, clonk/vertical jigging',
    regulation_note: 'Invasive species rule: live bait prohibited; check regional night-fishing hours',
  },
  trout: {
    name: 'Brown Trout',
    habitat_zone: 'Cool oxygenated inflows, riffles & shaded rocky banks',
    recommended_approach: 'Single-hook inline spinners, nymphs, or small minnow plugs (check barbless rules)',
    regulation_note: 'Native salmonid — verify trout beat permit, seasonal dates, size limits & barbless hook rules',
  },
  rainbow_trout: {
    name: 'Rainbow Trout',
    habitat_zone: 'Oxygenated reservoir basins, tailraces & cool inflows',
    recommended_approach: 'Inline spinners, spoons, or drifting nymphs/streamers',
    regulation_note: 'Regulated under Real Decreto 630/2013 (invasive species outside exempted zones) — check local fishing order',
  },
  perch: {
    name: 'European Perch',
    habitat_zone: 'Rocky points, bridge pilings & submerged weedline transitions',
    recommended_approach: 'Small drop-shot worms, #2 inline spinners, 5–7cm shads',
    regulation_note: 'Invasive species rule where present; no live bait',
  },
  chub: {
    name: 'Iberian Chub',
    habitat_zone: 'Shaded undercut banks, riffle tailouts & rocky reservoir inlets',
    recommended_approach: 'Small 3–5cm floating minnows, #1 inline spinners, bread/insect imitations',
    regulation_note: 'Native Iberian species — catch-and-release encouraged; verify local minimum size',
  },
  tench: {
    name: 'Tench',
    habitat_zone: 'Slow, weed-lined backwaters and silty coves at dawn/dusk',
    recommended_approach: 'Float rig or light feeder with sweetcorn, worms, or soft pellets',
    regulation_note: 'Check regional size limits and spawning season dates',
  },
  grass_carp: {
    name: 'Grass Carp',
    habitat_zone: 'Marginal aquatic vegetation, shallow weed beds & warm coves',
    recommended_approach: 'Floating crust, sweetcorn, or zig-rigged plant-based boilies',
    regulation_note: 'Check regional regulations regarding non-native cyprinids',
  },
  sunfish: {
    name: 'Pumpkinseed Sunfish',
    habitat_zone: 'Warm shallow shoreline rocks, docks & submerged brush (< 2m)',
    recommended_approach: 'Ultralight micro-jigs, small worms, or #0/#1 inline spinners',
    regulation_note: 'Invasive species under Real Decreto 630/2013 — live transport prohibited',
  },
  eel: {
    name: 'European Eel',
    habitat_zone: 'Muddy bottoms, submerged rocks & river mouths (nocturnal)',
    recommended_approach: 'Ledgered worm rigs (check protection status first)',
    regulation_note: 'Critically Endangered — retention/fishing is strictly prohibited in most Spanish basins',
  },
  sea_bass: {
    name: 'European Sea Bass',
    habitat_zone: 'Estuary mouths, rocky surf breaks, jetties & tidal currents',
    recommended_approach: 'Surface walkers, minnows, soft shads worked in whitewater',
    regulation_note: 'Requires maritime recreational license; observe 36cm minimum size',
  },
  dorada: {
    name: 'Gilt-head Bream',
    habitat_zone: 'Sandy-rocky coastal shelves, lagoons & harbor channels',
    recommended_approach: 'Surfcasting / bottom rigs with crab, shrimp, or marine worm',
    regulation_note: 'Requires maritime recreational license',
  },
  white_seabream: {
    name: 'White Seabream',
    habitat_zone: 'Rocky reefs, cliff drop-offs, breakwaters & foaming surf zones',
    recommended_approach: 'Bolognese float fishing with shrimp/bread or light ledgering',
    regulation_note: 'Requires maritime recreational license; check regional minimum size (23cm typical)',
  },
  bluefish: {
    name: 'Bluefish',
    habitat_zone: 'Warm coastal breaks, estuary channels & baitfish schools near surface',
    recommended_approach: 'Fast surface poppers, heavy pencil poppers, metal jigs (wire trace required)',
    regulation_note: 'Requires maritime recreational license; adhere to daily bag limits',
  },
  dentex: {
    name: 'Common Dentex',
    habitat_zone: 'Deep rocky reefs, Posidonia edges & coastal drop-offs (15–50m)',
    recommended_approach: 'Slow-pitch jigging, heavy soft baits, or boat trolling near structure',
    regulation_note: 'Requires maritime recreational license; check daily bag & weight limits',
  },
  mullet: {
    name: 'Grey Mullet',
    habitat_zone: 'Harbor basins, river estuaries & shallow coastal flats',
    recommended_approach: 'Light float tackle with bread paste or fine groundbait',
    regulation_note: 'Requires maritime recreational license',
  },
};

const EXACT_SCIENTIFIC_MAP: Record<string, IberianSpeciesProfile> = {
  'micropterus salmoides': { catalogKey: 'black_bass', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.black_bass },
  'sander lucioperca': { catalogKey: 'zander', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.zander },
  'cyprinus carpio': { catalogKey: 'carp', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.carp },
  'esox lucius': { catalogKey: 'pike', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.pike },
  'silurus glanis': { catalogKey: 'catfish', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.catfish },
  'salmo trutta': { catalogKey: 'trout', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.trout },
  'oncorhynchus mykiss': { catalogKey: 'rainbow_trout', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.rainbow_trout },
  'perca fluviatilis': { catalogKey: 'perch', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.perch },
  'tinca tinca': { catalogKey: 'tench', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.tench },
  'ctenopharyngodon idella': { catalogKey: 'grass_carp', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.grass_carp },
  'lepomis gibbosus': { catalogKey: 'sunfish', waterHabitat: 'freshwater', species: SPECIES_CATALOG_ES.sunfish },
  'anguilla anguilla': { catalogKey: 'eel', waterHabitat: 'both', species: SPECIES_CATALOG_ES.eel },
  'dicentrarchus labrax': { catalogKey: 'sea_bass', waterHabitat: 'both', species: SPECIES_CATALOG_ES.sea_bass },
  'dicentrarchus punctatus': { catalogKey: 'sea_bass', waterHabitat: 'sea', species: SPECIES_CATALOG_ES.sea_bass },
  'sparus aurata': { catalogKey: 'dorada', waterHabitat: 'sea', species: SPECIES_CATALOG_ES.dorada },
  'pomatomus saltatrix': { catalogKey: 'bluefish', waterHabitat: 'sea', species: SPECIES_CATALOG_ES.bluefish },
  'dentex dentex': { catalogKey: 'dentex', waterHabitat: 'sea', species: SPECIES_CATALOG_ES.dentex },
  'seriola dumerili': { catalogKey: 'dentex', waterHabitat: 'sea', species: { ...SPECIES_CATALOG_ES.dentex, name: 'Greater Amberjack' } },
  'mugil cephalus': { catalogKey: 'mullet', waterHabitat: 'both', species: SPECIES_CATALOG_ES.mullet },
  'chelo labrosus': { catalogKey: 'mullet', waterHabitat: 'both', species: SPECIES_CATALOG_ES.mullet },
  'chelon labrosus': { catalogKey: 'mullet', waterHabitat: 'both', species: SPECIES_CATALOG_ES.mullet },
};

/**
 * Expands tight selection bounding boxes to a ~15-20km watershed halo so small reservoir
 * or river crops capture real biological sightings along the same drainage basin.
 */
export function expandSpeciesSearchBbox(
  bbox: BoundingBox,
  minHalfSpanDeg: number = MIN_SEARCH_HALF_SPAN_DEG
): BoundingBox {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  const halfLng = Math.max((maxLng - minLng) / 2, minHalfSpanDeg);
  const halfLat = Math.max((maxLat - minLat) / 2, minHalfSpanDeg);

  return [
    Number((centerLng - halfLng).toFixed(4)),
    Number((centerLat - halfLat).toFixed(4)),
    Number((centerLng + halfLng).toFixed(4)),
    Number((centerLat + halfLat).toFixed(4)),
  ];
}

/**
 * Matches scientific species names from iNaturalist/OBIS onto known Iberian/European
 * angling & native conservation species, filtering out micro-pests or pet-trade noise.
 */
export function matchIberianAnglingSpecies(
  scientificName: string,
  englishCommonName?: string,
  targetWaterType?: 'freshwater' | 'sea'
): IberianSpeciesProfile | null {
  const normalized = scientificName.trim().toLowerCase();
  if (!normalized) return null;

  let matched: IberianSpeciesProfile | undefined = EXACT_SCIENTIFIC_MAP[normalized];

  if (!matched) {
    const genus = normalized.split(/\s+/)[0];
    if (genus === 'luciobarbus' || genus === 'barbus') {
      matched = {
        catalogKey: 'barbel',
        waterHabitat: 'freshwater',
        species: {
          ...SPECIES_CATALOG_ES.barbel,
          name: englishCommonName ? toTitleCase(englishCommonName) : SPECIES_CATALOG_ES.barbel.name,
        },
      };
    } else if (genus === 'squalius' || genus === 'pseudochondrostoma' || genus === 'parachondrostoma') {
      matched = {
        catalogKey: 'chub',
        waterHabitat: 'freshwater',
        species: {
          ...SPECIES_CATALOG_ES.chub,
          name: englishCommonName ? toTitleCase(englishCommonName) : SPECIES_CATALOG_ES.chub.name,
        },
      };
    } else if (genus === 'diplodus') {
      matched = {
        catalogKey: 'white_seabream',
        waterHabitat: 'sea',
        species: {
          ...SPECIES_CATALOG_ES.white_seabream,
          name: englishCommonName
            ? toTitleCase(englishCommonName)
            : SPECIES_CATALOG_ES.white_seabream.name,
        },
      };
    } else if (genus === 'pagrus' || genus === 'pagellus' || genus === 'lithognathus') {
      matched = {
        catalogKey: 'dorada',
        waterHabitat: 'sea',
        species: {
          ...SPECIES_CATALOG_ES.dorada,
          name: englishCommonName ? toTitleCase(englishCommonName) : SPECIES_CATALOG_ES.dorada.name,
        },
      };
    } else if (genus === 'liza' || genus === 'mugil' || genus === 'chelon') {
      matched = {
        catalogKey: 'mullet',
        waterHabitat: 'both',
        species: SPECIES_CATALOG_ES.mullet,
      };
    }
  }

  if (!matched) return null;
  if (
    targetWaterType &&
    matched.waterHabitat !== 'both' &&
    matched.waterHabitat !== targetWaterType
  ) {
    return null;
  }

  return matched;
}

function toTitleCase(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildCacheKey(searchBbox: BoundingBox, waterType: 'freshwater' | 'sea' | 'auto'): string {
  const centerLng = ((searchBbox[0] + searchBbox[2]) / 2).toFixed(1);
  const centerLat = ((searchBbox[1] + searchBbox[3]) / 2).toFixed(1);
  return `${waterType}:${centerLng}:${centerLat}`;
}

export function clearSpeciesOccurrenceCacheForTests(): void {
  occurrenceCache.clear();
}

/**
 * Queries free, unauthenticated biological occurrence APIs:
 * - iNaturalist API v1 (/observations/species_counts, Actinopterygii taxon_id=47178)
 * - OBIS API v3 (/checklist, coastal/marine fishes taxonid=10194) when waterType === 'sea'
 */
export async function fetchLiveFishOccurrences(params: {
  bbox: BoundingBox;
  waterType: 'freshwater' | 'sea' | 'auto';
  fetchFn?: typeof fetch;
}): Promise<LiveSpeciesLookupResult> {
  const searchBbox = expandSpeciesSearchBbox(params.bbox);
  const cacheKey = buildCacheKey(searchBbox, params.waterType);
  const cached = occurrenceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && !params.fetchFn) {
    return cached.result;
  }

  const doFetch = params.fetchFn ?? fetch;
  const [swlng, swlat, nelng, nelat] = searchBbox;
  const occurrences: LiveSpeciesOccurrence[] = [];
  const sourcesUsed: string[] = [];
  const filterWaterType = params.waterType === 'auto' ? undefined : params.waterType;

  const inatUrl =
    `https://api.inaturalist.org/v1/observations/species_counts` +
    `?swlat=${swlat}&swlng=${swlng}&nelat=${nelat}&nelng=${nelng}` +
    `&taxon_id=47178&rank=species&locale=en&per_page=30`;

  const wktPolygon = `POLYGON((${swlng} ${swlat},${nelng} ${swlat},${nelng} ${nelat},${swlng} ${nelat},${swlng} ${swlat}))`;
  const obisUrl = `https://api.obis.org/v3/checklist?geometry=${encodeURIComponent(wktPolygon)}&taxonid=10194&size=25`;

  const inatPromise = (async () => {
    try {
      const res = await doFetch(inatUrl, {
        headers: { 'User-Agent': 'FishingSpotAI-SpainMVP/1.0' },
        signal: AbortSignal.timeout(SPECIES_LOOKUP_TIMEOUT_MS),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        results?: Array<{
          count?: number;
          taxon?: { name?: string; preferred_common_name?: string };
        }>;
      };
      let matchedAny = false;
      for (const row of data.results ?? []) {
        const sci = row.taxon?.name;
        if (!sci) continue;
        const matched = matchIberianAnglingSpecies(
          sci,
          row.taxon?.preferred_common_name,
          filterWaterType
        );
        if (!matched) continue;
        matchedAny = true;
        occurrences.push({
          scientificName: sci,
          observationCount: row.count ?? 1,
          source: 'inaturalist',
          waterHabitat: matched.waterHabitat,
          species: matched.species,
        });
      }
      if (matchedAny || (data.results ?? []).length > 0) {
        sourcesUsed.push('iNaturalist Observations API v1');
      }
    } catch {
      // Fail-open on timeout or offline network
    }
  })();

  const obisPromise =
    params.waterType === 'sea'
      ? (async () => {
          try {
            const res = await doFetch(obisUrl, {
              headers: { 'User-Agent': 'FishingSpotAI-SpainMVP/1.0' },
              signal: AbortSignal.timeout(SPECIES_LOOKUP_TIMEOUT_MS),
            });
            if (!res.ok) return;
            const data = (await res.json()) as {
              results?: Array<{
                scientificName?: string;
                records?: number;
                is_marine?: boolean;
              }>;
            };
            let matchedAny = false;
            for (const row of data.results ?? []) {
              if (!row.scientificName) continue;
              const matched = matchIberianAnglingSpecies(
                row.scientificName,
                undefined,
                'sea'
              );
              if (!matched) continue;
              matchedAny = true;
              occurrences.push({
                scientificName: row.scientificName,
                observationCount: row.records ?? 1,
                source: 'obis',
                waterHabitat: matched.waterHabitat,
                species: matched.species,
              });
            }
            if (matchedAny) {
              sourcesUsed.push('OBIS Marine Checklist API v3');
            }
          } catch {
            // Fail-open on timeout or offline network
          }
        })()
      : Promise.resolve();

  await Promise.all([inatPromise, obisPromise]);

  // Sort by observation count descending and deduplicate identical names
  const dedupedMap = new Map<string, LiveSpeciesOccurrence>();
  for (const occ of occurrences.sort((a, b) => b.observationCount - a.observationCount)) {
    const key = occ.species.name.toLowerCase();
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, occ);
    }
  }

  const result: LiveSpeciesLookupResult = {
    occurrences: Array.from(dedupedMap.values()),
    sourcesUsed,
  };

  if (!params.fetchFn) {
    occurrenceCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      result,
    });
  }

  return result;
}

/**
 * Merges curated DB species, live biological API occurrences, and regional defaults into
 * a deduplicated roster of 2..6 structured English species entries.
 */
export function mergeSpeciesWithOccurrences(params: {
  curatedSpecies?: SpeciesPresenceInfo[];
  liveOccurrences: LiveSpeciesOccurrence[];
  regionalFallback: SpeciesPresenceInfo[];
  waterType?: 'freshwater' | 'sea';
  maxCount?: number;
}): SpeciesPresenceInfo[] {
  const maxCount = params.maxCount ?? 6;
  const merged: SpeciesPresenceInfo[] = [];
  const seenNames = new Set<string>();

  const pushUnique = (sp: SpeciesPresenceInfo) => {
    const key = sp.name.trim().toLowerCase();
    if (!key || seenNames.has(key) || merged.length >= maxCount) return;
    seenNames.add(key);
    merged.push(sp);
  };

  // 1. Curated DB species have highest accuracy for named lakes/reservoirs
  for (const sp of params.curatedSpecies ?? []) {
    pushUnique(sp);
  }

  // 2. Live biological occurrences fill unseeded water bodies or add locally verified species
  const filteredLive = params.waterType
    ? params.liveOccurrences.filter(
        (occ) => occ.waterHabitat === 'both' || occ.waterHabitat === params.waterType
      )
    : params.liveOccurrences;
  for (const occ of filteredLive) {
    pushUnique(occ.species);
  }

  // 3. Ensure at least 2 structured entries (AC-F02-3) if live API returned 0 or 1 match
  if (merged.length < 2) {
    for (const sp of params.regionalFallback) {
      pushUnique(sp);
      if (merged.length >= Math.max(2, params.regionalFallback.length)) break;
    }
  }

  return merged.slice(0, maxCount);
}
