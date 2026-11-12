import { describe, expect, it } from 'vitest';
import {
  clearSpeciesOccurrenceCacheForTests,
  expandSpeciesSearchBbox,
  fetchLiveFishOccurrences,
  matchIberianAnglingSpecies,
  mergeSpeciesWithOccurrences,
  SPECIES_CATALOG_ES,
} from '@/modules/ai-advisor/species-occurrence';
import {
  buildSpeciesRoster,
  inferWaterTypeFromContext,
} from '@/modules/ai-advisor/geospatial-context.service';
import type { BoundingBox } from '@/shared/types/domain';

describe('Live Free Fish Species Occurrence API & Iberian Taxonomy Mapping', () => {
  it('expands tight reservoir crops to a tighter 5km watershed halo (~0.05 deg) while preserving wide boxes', () => {
    const tight: BoundingBox = [-0.97, 39.22, -0.92, 39.26];
    const expanded = expandSpeciesSearchBbox(tight);

    expect(expanded[2] - expanded[0]).toBeCloseTo(0.1, 3);
    expect(expanded[3] - expanded[1]).toBeCloseTo(0.1, 3);

    const wide: BoundingBox = [-1.5, 39.0, -0.5, 39.8];
    expect(expandSpeciesSearchBbox(wide)).toEqual([-1.5, 39.0, -0.5, 39.8]);
  });

  it('distinguishes native Brown Trout from invasive Rainbow Trout under RD 630/2013', () => {
    const brown = matchIberianAnglingSpecies('Salmo trutta', 'Brown Trout', 'freshwater');
    const rainbow = matchIberianAnglingSpecies('Oncorhynchus mykiss', 'Rainbow Trout', 'freshwater');

    expect(brown?.species.name).toBe('Brown Trout');
    expect(rainbow?.species.name).toBe('Rainbow Trout');
    expect(rainbow?.species.regulation_note).toContain('630/2013');
  });

  it('maps authentic Spanish angling species and filters out micro-pests & urban aquarium releases', () => {
    expect(matchIberianAnglingSpecies('Cyprinus carpio', 'European Carp', 'freshwater')?.species.name).toBe(
      'Common Carp'
    );
    expect(
      matchIberianAnglingSpecies('Luciobarbus guiraonis', 'eastern Iberian barbel', 'freshwater')?.species.name
    ).toBe('Eastern Iberian Barbel');
    expect(
      matchIberianAnglingSpecies('Squalius valentinus', 'eastern Iberian chub', 'freshwater')?.species.name
    ).toBe('Eastern Iberian Chub');
    expect(matchIberianAnglingSpecies('Sparus aurata', 'Gilt-head Bream', 'sea')?.species.name).toBe(
      'Gilt-head Bream'
    );

    // Non-angling micro-pest and exotic aquarium releases must be filtered out
    expect(matchIberianAnglingSpecies('Gambusia holbrooki', 'Eastern Mosquitofish', 'freshwater')).toBeNull();
    expect(matchIberianAnglingSpecies('Heterotilapia buettikoferi', 'Zebra Tilapia', 'freshwater')).toBeNull();
    expect(matchIberianAnglingSpecies('Phenacogrammus interruptus', 'Congo Tetra', 'freshwater')).toBeNull();

    // Marine species filtered out when querying freshwater
    expect(matchIberianAnglingSpecies('Sparus aurata', 'Gilt-head Bream', 'freshwater')).toBeNull();
  });

  it('fetches & ranks iNaturalist species occurrences while failing open on network errors', async () => {
    clearSpeciesOccurrenceCacheForTests();
    const mockFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            { count: 31, taxon: { name: 'Cyprinus carpio', preferred_common_name: 'European Carp' } },
            { count: 6, taxon: { name: 'Gambusia holbrooki', preferred_common_name: 'Eastern Mosquitofish' } },
            { count: 4, taxon: { name: 'Luciobarbus guiraonis', preferred_common_name: 'Eastern Iberian barbel' } },
            { count: 3, taxon: { name: 'Silurus glanis', preferred_common_name: 'Wels Catfish' } },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    const res = await fetchLiveFishOccurrences({
      bbox: [-0.97, 39.22, -0.92, 39.26],
      waterType: 'freshwater',
      fetchFn: mockFetch,
    });

    expect(res.sourcesUsed).toContain('iNaturalist Observations API v1');
    expect(res.occurrences.map((o) => o.species.name)).toEqual([
      'Common Carp',
      'Eastern Iberian Barbel',
      'Wels Catfish',
    ]);

    const failingFetch: typeof fetch = async () => {
      throw new Error('Network timeout');
    };
    const fallbackRes = await fetchLiveFishOccurrences({
      bbox: [-0.97, 39.22, -0.92, 39.26],
      waterType: 'freshwater',
      fetchFn: failingFetch,
    });
    expect(fallbackRes.occurrences).toEqual([]);
  });

  it('combines iNaturalist + OBIS checklists for sea/coastal zones', async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('api.obis.org')) {
        return new Response(
          JSON.stringify({
            results: [
              { scientificName: 'Dicentrarchus labrax', records: 18, is_marine: true },
              { scientificName: 'Dentex dentex', records: 9, is_marine: true },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          results: [
            { count: 12, taxon: { name: 'Sparus aurata', preferred_common_name: 'Gilt-head Bream' } },
          ],
        }),
        { status: 200 }
      );
    };

    const res = await fetchLiveFishOccurrences({
      bbox: [-0.33, 39.42, -0.28, 39.47],
      waterType: 'sea',
      fetchFn: mockFetch,
    });

    expect(res.sourcesUsed).toEqual(
      expect.arrayContaining(['iNaturalist Observations API v1', 'OBIS Marine Checklist API v3'])
    );
    expect(res.occurrences.map((o) => o.species.name)).toEqual([
      'European Sea Bass',
      'Gilt-head Bream',
      'Common Dentex',
    ]);
  });

  it('merges curated DB + live occurrences and guarantees at least 2 structured entries', () => {
    const regionalFallback = buildSpeciesRoster(undefined, 'freshwater');

    const unseededFromLive = mergeSpeciesWithOccurrences({
      curatedSpecies: undefined,
      liveOccurrences: [
        {
          scientificName: 'Cyprinus carpio',
          observationCount: 25,
          source: 'inaturalist',
          waterHabitat: 'freshwater',
          species: SPECIES_CATALOG_ES.carp,
        },
        {
          scientificName: 'Silurus glanis',
          observationCount: 14,
          source: 'inaturalist',
          waterHabitat: 'freshwater',
          species: SPECIES_CATALOG_ES.catfish,
        },
      ],
      regionalFallback,
      waterType: 'freshwater',
    });

    expect(unseededFromLive.map((s) => s.name)).toEqual(['Common Carp', 'Wels Catfish']);

    // When live API returns empty, regional fallback supplies defaults
    const emptyLive = mergeSpeciesWithOccurrences({
      curatedSpecies: undefined,
      liveOccurrences: [],
      regionalFallback,
      waterType: 'freshwater',
    });
    expect(emptyLive.length).toBeGreaterThanOrEqual(2);
  });

  it('distinguishes coastal/sea waters from inland reservoirs including Mar de Aragón', () => {
    expect(inferWaterTypeFromContext(undefined, null, 'Mar de Aragón')).toBe('freshwater');
    expect(
      inferWaterTypeFromContext(undefined, { type: 'bay', address: { sea: 'Mediterranean' } }, 'Bahía de Xàbia')
    ).toBe('sea');
  });

  it('includes Brown Trout and Barbel without over-defaulting Zander on northern/montane Spanish reservoirs', () => {
    const galiciaReservoir = buildSpeciesRoster(
      undefined,
      'freshwater',
      'Embalse de Peñarrubia',
      'Galicia',
      392
    );
    const names = galiciaReservoir.map((s) => s.name);
    expect(names).toContain('Brown Trout');
    expect(names).toContain('Iberian Barbel');
    expect(names).not.toContain('Zander');

    const lowlandWarmReservoir = buildSpeciesRoster(
      undefined,
      'freshwater',
      'Embalse de Tous',
      'Comunidad Valenciana',
      120
    );
    expect(lowlandWarmReservoir.map((s) => s.name)).toContain('Zander');
  });
});
