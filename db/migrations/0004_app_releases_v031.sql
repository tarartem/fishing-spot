-- 0004_app_releases_v031.sql
-- Adds v0.3.1 human-friendly release notes for stillwater constriction naming and spot diversity cap.

INSERT INTO app_releases (version, released_at, summary, release_notes)
VALUES
  (
    '0.3.1',
    '2026-11-12T14:52:00Z',
    'Stillwater Constriction Tactics & Bottleneck Diversity Cap',
    '[
      "Replaced river-specific current edge tactics and channel labels with Constriction Neck and Cove Mouth Pass guidance on calm stillwater lakes.",
      "Capped narrow bottleneck spots to a maximum of two per report so closed lakes showcase a balanced mix of coves, points, and shoreline margins."
    ]'::jsonb
  )
ON CONFLICT (version) DO UPDATE
SET
  released_at = EXCLUDED.released_at,
  summary = EXCLUDED.summary,
  release_notes = EXCLUDED.release_notes;
