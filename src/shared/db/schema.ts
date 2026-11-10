import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  integer,
  jsonb,
  timestamp,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import type {
  BoundingBox,
  GridCell,
  SpotRecommendationResponse,
  TacticalAdvice,
  TargetSpecies,
  SpeciesCatchEntry,
  CellMicroAnalysisResponse,
} from '@/shared/types/domain';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  preferredLocale: text('preferred_locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const waterBodies = pgTable(
  'water_bodies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    osmId: text('osm_id').notNull().unique(),
    name: text('name').notNull(),
    waterType: text('water_type').notNull(), // 'freshwater' | 'sea'
    countryCode: text('country_code').notNull(), // 'PL' | 'ES' | etc.
    centerLat: doublePrecision('center_lat').notNull(),
    centerLng: doublePrecision('center_lng').notNull(),
    description: text('description').notNull(),
    commonSpecies: jsonb('common_species').$type<TargetSpecies[]>().notNull(),
    bbox: jsonb('bbox').$type<BoundingBox>().notNull(),
    polygonGeoJson: jsonb('polygon_geojson').notNull(),
    avgRating: doublePrecision('avg_rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_water_bodies_center').on(table.centerLat, table.centerLng),
    uniqueIndex('idx_water_bodies_osm_id').on(table.osmId),
  ]
);

export const restrictionZones = pgTable(
  'restriction_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    waterBodyId: uuid('water_body_id')
      .notNull()
      .references(() => waterBodies.id, { onDelete: 'cascade' }),
    reportedByUserId: uuid('reported_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    cellId: text('cell_id'),
    status: text('status').notNull(), // 'allowed' | 'permit_required' | 'seasonal_restriction' | 'prohibited'
    reason: text('reason').notNull(),
    source: text('source').notNull().default('osm'), // 'osm' | 'community' | 'official'
    bounds: jsonb('bounds').$type<BoundingBox>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_restriction_zones_water_body').on(table.waterBodyId)]
);

export const gridAnalyses = pgTable(
  'grid_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    waterBodyId: uuid('water_body_id')
      .notNull()
      .references(() => waterBodies.id, { onDelete: 'cascade' }),
    queryHash: text('query_hash').notNull().unique(),
    sectorBbox: jsonb('sector_bbox').$type<BoundingBox>().notNull(),
    waterType: text('water_type').notNull(),
    fishingType: text('fishing_type').notNull(),
    targetSpecies: jsonb('target_species').$type<string[]>().notNull(),
    accessMode: text('access_mode').notNull(),
    season: text('season').notNull(),
    gridDefinition: jsonb('grid_definition').$type<GridCell[]>().notNull(),
    aiResponse: jsonb('ai_response').$type<SpotRecommendationResponse>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idx_grid_analyses_query_hash').on(table.queryHash)]
);

export const cellMicroAnalyses = pgTable(
  'cell_micro_analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gridAnalysisId: uuid('grid_analysis_id')
      .notNull()
      .references(() => gridAnalyses.id, { onDelete: 'cascade' }),
    cellId: text('cell_id').notNull(),
    aiMicroResponse: jsonb('ai_micro_response')
      .$type<CellMicroAnalysisResponse>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_cell_micro_analyses_unique').on(
      table.gridAnalysisId,
      table.cellId
    ),
  ]
);

export const fishingSpots = pgTable(
  'fishing_spots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    waterBodyId: uuid('water_body_id')
      .notNull()
      .references(() => waterBodies.id, { onDelete: 'cascade' }),
    gridAnalysisId: uuid('grid_analysis_id').references(() => gridAnalyses.id, {
      onDelete: 'set null',
    }),
    cellId: text('cell_id').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    tacticalAdvice: jsonb('tactical_advice').$type<TacticalAdvice>().notNull(),
    targetSpeciesFit: jsonb('target_species_fit').$type<string[]>().notNull(),
    fishingType: text('fishing_type').notNull(),
    accessMode: text('access_mode').notNull(),
    restrictionStatus: text('restriction_status').notNull().default('allowed'),
    avgRating: doublePrecision('avg_rating').notNull().default(0),
    reviewCount: integer('review_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_fishing_spots_water_body').on(table.waterBodyId)]
);

export const spotReviews = pgTable(
  'spot_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    waterBodyId: uuid('water_body_id')
      .notNull()
      .references(() => waterBodies.id, { onDelete: 'cascade' }),
    spotId: uuid('spot_id').references(() => fishingSpots.id, {
      onDelete: 'set null',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    fishingTypeUsed: text('fishing_type_used').notNull(),
    speciesCaught: jsonb('species_caught').$type<SpeciesCatchEntry[]>().notNull(),
    fishedOn: date('fished_on').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_spot_reviews_water_body').on(table.waterBodyId)]
);

export const catchPhotos = pgTable('catch_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id')
    .notNull()
    .references(() => spotReviews.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  publicUrl: text('public_url').notNull(),
  photoType: text('photo_type').notNull().default('catch'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
