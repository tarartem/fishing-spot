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

export type ArtifactSpotColor = 'red' | 'blue' | 'orange';

export interface GridArtifactSpot {
  rank: number; // 1..6
  color: ArtifactSpotColor; // red (1-2), blue (3-4), orange (5-6)
  cell_id: string; // Primary cell e.g. "F6"
  grid_cells_label: string; // e.g. "Grid E6 / F6"
  badge?: string; // e.g. "🏆 (The #1 Trophy Point)"
  title: string; // e.g. "Tip of the Dehesa de Cortes Peninsula"
  x_percent: number; // 0..100 horizontal position on screenshot
  y_percent: number; // 0..100 vertical position on screenshot
  why_label: string; // e.g. "Why it's #1:"
  why_this_spot: string;
  secondary_label?: string; // e.g. "The Terrain:" or "Why fish love it:"
  secondary_text?: string;
  how_to_fish?: string;
}

export type ScaleAnalysisMode = 'micro' | 'meso' | 'macro';

export interface ArtifactGeographicalContext {
  water_elevation_m: number;
  relief_range_m: number;
  scale_mode?: ScaleAnalysisMode;
  scale_label: string;
  road_access_summary: string;
  shore_accessibility_summary: string;
}

export interface ArtifactRestrictionCheck {
  status: RestrictionStatus;
  status_label: string;
  permits_required: string;
  prohibited_zones_warning: string;
  regulations_list: string[];
  verified_sources: string[];
  disclaimer: string;
}

export interface WaterBodyArtifactAnalysis {
  water_body_name: string;
  region_label: string;
  water_body_summary: string;
  geographical_context?: ArtifactGeographicalContext;
  restriction_check?: ArtifactRestrictionCheck;
  recommended_spots: GridArtifactSpot[];
  best_game_plan: string[];
}

export interface UserScreenshotArtifact {
  id: string;
  createdAt: string;
  bbox: BoundingBox;
  mapStyle: MapStyleMode;
  anglerGearNote?: string;
  rawScreenshotDataUrl: string;
  annotatedScreenshotDataUrl: string;
  analysis: WaterBodyArtifactAnalysis;
}

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
