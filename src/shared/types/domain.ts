import type { Feature, Polygon, MultiPolygon } from 'geojson';

export type WaterType = 'freshwater' | 'sea';

export type FishingType =
  | 'spinning'
  | 'feeder_bottom'
  | 'carp'
  | 'float'
  | 'fly'
  | 'surfcasting';

export type TargetSpecies =
  | 'pike'
  | 'zander'
  | 'perch'
  | 'black_bass'
  | 'trout'
  | 'catfish'
  | 'asp'
  | 'chub'
  | 'grayling'
  | 'carp'
  | 'bream'
  | 'tench'
  | 'roach'
  | 'barbel'
  | 'crucian_carp'
  | 'sea_bass'
  | 'dorada'
  | 'mackerel'
  | 'sargo'
  | 'bluefish'
  | 'garfish'
  | 'sea_trout'
  | 'flounder'
  | 'cod'
  | 'mullet'
  | 'any';

export type AccessMode = 'shore' | 'boat';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type RestrictionStatus =
  | 'allowed'
  | 'permit_required'
  | 'seasonal_restriction'
  | 'prohibited'
  | 'unknown';

export type GridZoneType =
  | 'shoreline'
  | 'open_water'
  | 'inflow_outflow'
  | 'structure';

export type BoundingBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export interface GridCell {
  cellId: string; // e.g., "C4"
  rowLabel: string; // "C"
  colIndex: number; // 4
  bounds: [number, number, number, number];
  center: {
    latitude: number;
    longitude: number;
  };
  zoneType: GridZoneType;
  shoreAccessible: boolean;
  features: string[];
  restrictionStatus: RestrictionStatus;
  restrictionReason?: string;
}

export interface TacticalAdvice {
  recommended_baits_or_lures: string[];
  presentation_tips: string;
  best_time_of_day: string;
}

export type SpotCategory = 'primary_hot' | 'structure_ledge' | 'shore_cove';

export type MapStyleMode = 'satellite' | 'terrain' | 'plain';

export interface RecommendedSpot {
  id?: string;
  rank: number;
  cell_id: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  title: string;
  confidence_score: number;
  why_this_spot: string;
  tactical_advice: TacticalAdvice;
  target_species_fit: string[];
  restriction_status: Exclude<RestrictionStatus, 'prohibited'>;
  spot_category?: SpotCategory;
  feature_tags?: string[];
  avg_rating?: number;
  review_count?: number;
}

export interface RestrictionOverview {
  overall_status: RestrictionStatus;
  warnings: string[];
  disclaimer: string;
  permit_requirements?: string[];
  seasonal_rules?: string[];
}

export interface SpotRecommendationResponse {
  water_body_summary: string;
  restriction_overview: RestrictionOverview;
  recommended_spots: RecommendedSpot[];
}

export interface CellMicroAnalysisResponse {
  cellId: string;
  suitabilityScore: number;
  structuralAnalysis: string;
  howToFishThisCell: string;
  recommendedBaitsOrLures: string[];
  restrictionStatus: RestrictionStatus;
}

export interface SpeciesCatchEntry {
  species: TargetSpecies | string;
  count: number;
  lengthCm?: number;
  weightKg?: number;
}

export interface CatchPhotoItem {
  id: string;
  storagePath: string;
  publicUrl: string;
  photoType: 'catch' | 'spot_view' | 'regulation_sign';
}

export interface SpotReviewItem {
  id: string;
  waterBodyId: string;
  spotId?: string;
  cellId?: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  fishingTypeUsed: FishingType;
  speciesCaught: SpeciesCatchEntry[];
  fishedOn: string;
  createdAt: string;
  photos: CatchPhotoItem[];
}

export interface WaterBodyPinSummary {
  id: string;
  osmId: string;
  name: string;
  regionLabel: string;
  waterType: WaterType;
  countryCode: 'PL' | 'ES' | string;
  centerLat: number;
  centerLng: number;
  avgRating: number;
  reviewCount: number;
  commonSpecies: TargetSpecies[];
}

export interface WaterBodyRecord extends WaterBodyPinSummary {
  description: string;
  bbox: [number, number, number, number];
  polygon: Feature<Polygon | MultiPolygon>;
  restrictionZones: {
    id: string;
    cellId?: string;
    status: RestrictionStatus;
    reason: string;
    source: 'osm' | 'community' | 'official';
    bounds?: [number, number, number, number];
  }[];
  preSeededSpots: RecommendedSpot[];
  reviews: SpotReviewItem[];
}
