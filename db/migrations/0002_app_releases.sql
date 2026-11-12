-- 0002_app_releases.sql
-- Stores versioned application release metadata and human-friendly release notes.

CREATE TABLE IF NOT EXISTS app_releases (
  version VARCHAR(32) PRIMARY KEY,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary TEXT NOT NULL,
  release_notes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_releases_released_at
  ON app_releases (released_at DESC);

INSERT INTO app_releases (version, released_at, summary, release_notes)
VALUES
  (
    '0.1.0',
    '2026-11-11T18:00:00Z',
    'Initial MVP & Geospatial Spot Grid',
    '[
      "Launched the interactive 8x8 fishing spot grid with OSM water masking and Gemini Vision fallback.",
      "Added farthest-point spot spacing, shore-first casting prioritization, and 12-bearing shoreline geometry.",
      "Introduced 1-page printable PDF reports with elevation estimates, road access, and regional fishing regulations."
    ]'::jsonb
  ),
  (
    '0.2.0',
    '2026-11-12T13:45:00Z',
    'Report Identity, Versioning & Geospatial/PDF Polish',
    '[
      "Added unique report IDs (FS-YYYYMMDD-XXXX), human-friendly timestamps, and consistent app versioning across the UI and PDF exports.",
      "Fixed PDF text clipping in the Geography & Shore Access box and spot tactics cards so all slopes and lure guidance remain readable.",
      "Tightened channel bottleneck detection to avoid misclassifying wide bends and replaced directional bank prefixes with clearer shoreline naming.",
      "Added database-backed release tracking to store short human-friendly release notes for every iteration."
    ]'::jsonb
  )
ON CONFLICT (version) DO UPDATE
SET
  released_at = EXCLUDED.released_at,
  summary = EXCLUDED.summary,
  release_notes = EXCLUDED.release_notes;
