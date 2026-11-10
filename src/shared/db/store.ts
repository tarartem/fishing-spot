import { SEEDED_WATER_BODIES } from '@db/seed/poland-spain-waters';
import type {
  BoundingBox,
  GridCell,
  RecommendedSpot,
  RestrictionOverview,
  SpotReviewItem,
  WaterBodyPinSummary,
  WaterBodyRecord,
} from '@/shared/types/domain';
import {
  resolveTacticalSectorBbox,
  generateSpatialGrid,
} from '@/modules/map-grid/grid-engine';
import { buildRestrictionOverview } from '@/modules/restrictions/restriction-service';
import {
  type AuthSessionContext,
  resetGuestQuotasForTests,
} from '@/shared/auth/tier-gating';

// Deep clone helper so tests and runtime mutations can be cleanly reset
function cloneSeedData(): WaterBodyRecord[] {
  return JSON.parse(JSON.stringify(SEEDED_WATER_BODIES));
}

let waterBodiesStore: WaterBodyRecord[] = cloneSeedData();

export function resetStoreForTests(): void {
  waterBodiesStore = cloneSeedData();
  resetGuestQuotasForTests();
}

export function getAllWaterBodies(): WaterBodyRecord[] {
  return waterBodiesStore;
}

export function getWaterBodyById(id: string): WaterBodyRecord | undefined {
  return waterBodiesStore.find((w) => w.id === id);
}

/**
 * Returns named Water Body Pins for the interactive map (Visible to Guests and Registered users).
 */
export function getWaterBodyPins(countryFilter?: string): WaterBodyPinSummary[] {
  return waterBodiesStore
    .filter((w) =>
      countryFilter && countryFilter !== 'ALL'
        ? w.countryCode === countryFilter
        : true
    )
    .map((w) => ({
      id: w.id,
      osmId: w.osmId,
      name: w.name,
      regionLabel: w.regionLabel,
      waterType: w.waterType,
      countryCode: w.countryCode,
      centerLat: w.centerLat,
      centerLng: w.centerLng,
      avgRating: w.avgRating,
      reviewCount: w.reviewCount,
      commonSpecies: w.commonSpecies,
    }));
}

export interface TeaserFeedbackItem {
  id: string;
  authorName: string;
  rating: number;
  commentSnippet: string;
  speciesNames: string[];
  fishedOn: string;
}

export interface WaterBodyTierResponse {
  tier: 'guest' | 'registered';
  waterBody: {
    id: string;
    osmId: string;
    name: string;
    regionLabel: string;
    waterType: WaterBodyRecord['waterType'];
    countryCode: string;
    centerLat: number;
    centerLng: number;
    description: string;
    commonSpecies: WaterBodyRecord['commonSpecies'];
    avgRating: number;
    reviewCount: number;
    bbox: BoundingBox;
    polygon: WaterBodyRecord['polygon'];
  };
  restrictionOverview: RestrictionOverview;
  teaserFeedback: TeaserFeedbackItem[];
  cta: {
    title: string;
    description: string;
    actionLabel: string;
    requiresEmailRegistration: boolean;
  };
  grid: {
    sectorBbox: BoundingBox;
    cells: GridCell[];
  } | null;
  exactSpots: RecommendedSpot[];
  fullReviews: SpotReviewItem[];
}

/**
 * Enforces the SDD Guest vs. Registered data boundary when clicking a Water Body Pin.
 * - Guests receive basic description, catchable fish, teaser feedback, and registration CTA (grid = null, exactSpots = []).
 * - Registered users receive the full Spatial Grid (A1..H8), pre-seeded/discovered exact Fishing Spot Pins, and full reviews/photos.
 */
export function getWaterBodyDetailsForTier(
  waterBodyId: string,
  session: AuthSessionContext
): WaterBodyTierResponse | null {
  const wb = getWaterBodyById(waterBodyId);
  if (!wb) return null;

  const restrictionOverview = buildRestrictionOverview({
    waterBody: wb,
    targetSpecies: wb.commonSpecies,
  });

  const teaserFeedback: TeaserFeedbackItem[] = wb.reviews
    .slice(0, 2)
    .map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      commentSnippet:
        r.comment.length > 120 ? `${r.comment.slice(0, 117)}...` : r.comment,
      speciesNames: r.speciesCaught.map((s) => String(s.species)),
      fishedOn: r.fishedOn,
    }));

  const baseWaterBody = {
    id: wb.id,
    osmId: wb.osmId,
    name: wb.name,
    regionLabel: wb.regionLabel,
    waterType: wb.waterType,
    countryCode: wb.countryCode,
    centerLat: wb.centerLat,
    centerLng: wb.centerLng,
    description: wb.description,
    commonSpecies: wb.commonSpecies,
    avgRating: wb.avgRating,
    reviewCount: wb.reviewCount,
    bbox: wb.bbox,
    polygon: wb.polygon,
  };

  if (!session.isAuthenticated) {
    return {
      tier: 'guest',
      waterBody: baseWaterBody,
      restrictionOverview,
      teaserFeedback,
      cta: {
        title: 'Unlock Exact Fishing Spots on the AI Spatial Grid',
        description:
          'Register free with your email to reveal the A1–H8 tactical spatial grid, exact fishing spot pins, bait & lure presentations, and all angler catch photos.',
        actionLabel: 'Register Free with Email',
        requiresEmailRegistration: true,
      },
      grid: null,
      exactSpots: [],
      fullReviews: [],
    };
  }

  // Registered user: compute tactical sector and generate Spatial Grid (A1..H8)
  const sectorBbox = resolveTacticalSectorBbox(wb.bbox, {
    latitude: wb.centerLat,
    longitude: wb.centerLng,
  });

  const cells = generateSpatialGrid({
    sectorBbox,
    waterPolygon: wb.polygon,
    restrictionZones: wb.restrictionZones,
  });

  return {
    tier: 'registered',
    waterBody: baseWaterBody,
    restrictionOverview,
    teaserFeedback,
    cta: {
      title: 'Full Angler Access Active',
      description:
        'Use the AI Spatial Grid Advisor or click any cell on the map for a sector deep-dive.',
      actionLabel: 'Run AI Grid Analysis',
      requiresEmailRegistration: false,
    },
    grid: {
      sectorBbox,
      cells,
    },
    exactSpots: wb.preSeededSpots,
    fullReviews: wb.reviews,
  };
}
