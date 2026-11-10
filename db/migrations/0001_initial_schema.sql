-- 0001_initial_schema.sql
-- Fishing Spot ($0 MVP) — PostgreSQL + PostGIS Schema Migration

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  preferred_locale TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS water_bodies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  osm_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  water_type TEXT NOT NULL CHECK (water_type IN ('freshwater', 'sea')),
  country_code TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  description TEXT NOT NULL,
  common_species JSONB NOT NULL DEFAULT '[]'::jsonb,
  bbox JSONB NOT NULL,
  polygon_geojson JSONB NOT NULL,
  polygon GEOMETRY(Geometry, 4326),
  avg_rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_bodies_center ON water_bodies (center_lat, center_lng);
CREATE UNIQUE INDEX IF NOT EXISTS idx_water_bodies_osm_id ON water_bodies (osm_id);
CREATE INDEX IF NOT EXISTS idx_water_bodies_polygon_gist ON water_bodies USING GIST (polygon);

CREATE TABLE IF NOT EXISTS restriction_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
  reported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  cell_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'permit_required', 'seasonal_restriction', 'prohibited', 'unknown')),
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'osm' CHECK (source IN ('osm', 'community', 'official')),
  bounds JSONB,
  polygon GEOMETRY(Geometry, 4326),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restriction_zones_water_body ON restriction_zones (water_body_id);

CREATE TABLE IF NOT EXISTS grid_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL UNIQUE,
  sector_bbox JSONB NOT NULL,
  water_type TEXT NOT NULL,
  fishing_type TEXT NOT NULL,
  target_species JSONB NOT NULL,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('shore', 'boat')),
  season TEXT NOT NULL CHECK (season IN ('spring', 'summer', 'autumn', 'winter')),
  grid_definition JSONB NOT NULL,
  ai_response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grid_analyses_query_hash ON grid_analyses (query_hash);

CREATE TABLE IF NOT EXISTS cell_micro_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grid_analysis_id UUID NOT NULL REFERENCES grid_analyses(id) ON DELETE CASCADE,
  cell_id TEXT NOT NULL,
  ai_micro_response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cell_micro_analyses_unique ON cell_micro_analyses (grid_analysis_id, cell_id);

CREATE TABLE IF NOT EXISTS fishing_spots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
  grid_analysis_id UUID REFERENCES grid_analyses(id) ON DELETE SET NULL,
  cell_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tactical_advice JSONB NOT NULL,
  target_species_fit JSONB NOT NULL,
  fishing_type TEXT NOT NULL,
  access_mode TEXT NOT NULL,
  restriction_status TEXT NOT NULL DEFAULT 'allowed',
  avg_rating DOUBLE PRECISION NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fishing_spots_water_body ON fishing_spots (water_body_id);

CREATE TABLE IF NOT EXISTS spot_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  water_body_id UUID NOT NULL REFERENCES water_bodies(id) ON DELETE CASCADE,
  spot_id UUID REFERENCES fishing_spots(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  fishing_type_used TEXT NOT NULL,
  species_caught JSONB NOT NULL DEFAULT '[]'::jsonb,
  fished_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spot_reviews_water_body ON spot_reviews (water_body_id);

CREATE TABLE IF NOT EXISTS catch_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES spot_reviews(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'catch' CHECK (photo_type IN ('catch', 'spot_view', 'regulation_sign')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
