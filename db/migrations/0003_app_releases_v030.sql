-- 0003_app_releases_v030.sql
-- Adds v0.3.0 human-friendly release notes for water current direction intelligence.

INSERT INTO app_releases (version, released_at, summary, release_notes)
VALUES
  (
    '0.3.0',
    '2026-11-12T14:30:00Z',
    'Water Current Direction, Downstream Eddies & Inflow Intelligence',
    '[
      "Added zero-cost river and inflow current direction detection using OpenStreetMap waterway vectors cross-checked against DEM elevation gradients.",
      "Biased spot placement toward downstream eddy pockets behind points and verified reservoir inflows while preventing false current claims on calm stillwater.",
      "Updated tactics and game plans with upstream/downstream casting instructions and safe downstream-to-upstream river stalking routes."
    ]'::jsonb
  )
ON CONFLICT (version) DO UPDATE
SET
  released_at = EXCLUDED.released_at,
  summary = EXCLUDED.summary,
  release_notes = EXCLUDED.release_notes;
