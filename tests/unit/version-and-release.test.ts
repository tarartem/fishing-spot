import { describe, it, expect } from 'vitest';
import pkg from '../../package.json';
import {
  APP_VERSION,
  generateReportId,
  formatReportTimestamp,
} from '@/shared/app-version';
import { APP_RELEASES } from '@db/seed/app-releases';

describe('App Versioning, Report ID, Timestamp & DB Release Notes', () => {
  it('keeps APP_VERSION, package.json, and latest DB release seed in sync', () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_RELEASES.length).toBeGreaterThan(0);
    expect(APP_RELEASES[0].version).toBe(APP_VERSION);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('generates short readable Report IDs in FS-YYYYMMDD-XXXX format', () => {
    const fixedDate = new Date('2026-11-12T13:24:00Z');
    const id = generateReportId(fixedDate);
    expect(id).toMatch(/^FS-20261112-[A-F0-9]{4}$/);
  });

  it('formats timestamps in human-friendly DD MMM YYYY, HH:mm 24h format', () => {
    const formatted = formatReportTimestamp(new Date(2026, 10, 12, 13, 24));
    expect(formatted).toBe('12 Nov 2026, 13:24');
  });

  it('stores human-friendly one-sentence release notes in every DB release record', () => {
    for (const release of APP_RELEASES) {
      expect(release.summary.length).toBeGreaterThan(5);
      expect(release.release_notes.length).toBeGreaterThan(0);
      for (const note of release.release_notes) {
        expect(note.endsWith('.')).toBe(true);
        // Should be a single concise sentence (no multi-sentence periods inside)
        expect(note.slice(0, -1)).not.toMatch(/\.\s+[A-Z]/);
      }
    }
  });
});
