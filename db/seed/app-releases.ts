export interface AppReleaseRecord {
  version: string;
  released_at: string;
  summary: string;
  release_notes: string[];
}

/**
 * Versioned release history kept in sync with db/migrations/0002_app_releases.sql
 * and package.json. Each release note is a single human-friendly sentence.
 */
export const APP_RELEASES: AppReleaseRecord[] = [
  {
    version: '0.3.1',
    released_at: '2026-11-12T14:52:00Z',
    summary: 'Stillwater Constriction Tactics & Bottleneck Diversity Cap',
    release_notes: [
      'Replaced river-specific current edge tactics and channel labels with Constriction Neck and Cove Mouth Pass guidance on calm stillwater lakes.',
      'Capped narrow bottleneck spots to a maximum of two per report so closed lakes showcase a balanced mix of coves, points, and shoreline margins.',
    ],
  },
  {
    version: '0.3.0',
    released_at: '2026-11-12T14:30:00Z',
    summary: 'Water Current Direction, Downstream Eddies & Inflow Intelligence',
    release_notes: [
      'Added zero-cost river and inflow current direction detection using OpenStreetMap waterway vectors cross-checked against DEM elevation gradients.',
      'Biased spot placement toward downstream eddy pockets behind points and verified reservoir inflows while preventing false current claims on calm stillwater.',
      'Updated tactics and game plans with upstream/downstream casting instructions and safe downstream-to-upstream river stalking routes.',
    ],
  },
  {
    version: '0.2.0',
    released_at: '2026-11-12T13:45:00Z',
    summary: 'Report Identity, Versioning & Geospatial/PDF Polish',
    release_notes: [
      'Added unique report IDs (FS-YYYYMMDD-XXXX), human-friendly timestamps, and consistent app versioning across the UI and PDF exports.',
      'Fixed PDF text clipping in the Geography & Shore Access box and spot tactics cards so all slopes and lure guidance remain readable.',
      'Tightened channel bottleneck detection to avoid misclassifying wide bends and replaced directional bank prefixes with clearer shoreline naming.',
      'Added database-backed release tracking to store short human-friendly release notes for every iteration.',
    ],
  },
  {
    version: '0.1.0',
    released_at: '2026-11-11T18:00:00Z',
    summary: 'Initial MVP & Geospatial Spot Grid',
    release_notes: [
      'Launched the interactive 8x8 fishing spot grid with OSM water masking and Gemini Vision fallback.',
      'Added farthest-point spot spacing, shore-first casting prioritization, and 12-bearing shoreline geometry.',
      'Introduced 1-page printable PDF reports with elevation estimates, road access, and regional fishing regulations.',
    ],
  },
];
