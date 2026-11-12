import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import {
  buildOnePageFishingPdfDoc,
  buildPdfFilename,
} from '@/modules/map-grid/pdf-report';
import type { UserScreenshotArtifact } from '@/shared/types/domain';

describe('F02 — 1-Page PDF Report Export', () => {
  const sampleArtifact: UserScreenshotArtifact = {
    id: 'artifact-test-1',
    createdAt: '10:30',
    bbox: [-0.972, 39.222, -0.92, 39.262],
    mapStyle: 'satellite',
    satelliteSource: 'pnoa',
    // Minimal 1x1 transparent PNG data URL
    rawScreenshotDataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    annotatedScreenshotDataUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    analysis: {
      has_fishable_water: true,
      water_coverage_pct: 22.5,
      analysis_source: 'gemini_vision',
      water_body_name: 'Embalse de Cortes (Valencia)',
      region_label: 'Valencia, Spain',
      water_body_summary:
        'Canyon reservoir at 380m ASL with clear underwater shelves and steep limestone walls.',
      species_present: [
        {
          name: 'Black Bass',
          habitat_zone: 'Rocky points & shelves (1-7m)',
          recommended_approach: 'Texas-rigged craws, jerkbaits',
          regulation_note: 'No live bait permitted',
        },
        {
          name: 'Zander',
          habitat_zone: 'Deep channel ledges (5-14m)',
          recommended_approach: '10-18g jigged soft shads',
        },
      ],
      geographical_context: {
        water_elevation_m: 380,
        relief_range_m: 95,
        scale_mode: 'meso',
        scale_label: 'Sector Selection (4.5 km x 4.4 km)',
        road_access_summary: 'Paved CV-428 + unpaved bank tracks',
        shore_accessibility_summary: 'Gentle northern coves; steep southern cliff walls',
      },
      restriction_check: {
        status: 'permit_required',
        status_label: 'Permit Required — Recreational Angling Allowed in Designated Zones',
        permits_required: 'Licencia de Pesca Recreo (Comunidad Valenciana)',
        prohibited_zones_warning: '100m buffer around hydroelectric dam wall',
        regulations_list: ['No live bait under Real Decreto 630/2013'],
        verified_sources: ['Generalitat Valenciana'],
        disclaimer: 'Verify local Coto signage before fishing.',
      },
      recommended_spots: [1, 2, 3, 4, 5, 6].map((rank) => ({
        rank,
        color: (rank <= 2 ? 'green' : rank <= 4 ? 'blue' : 'yellow') as any,
        cell_id: `D${rank}`,
        grid_cells_label: `Grid D${rank}`,
        title: `Spot ${rank} Structure`,
        x_percent: 45,
        y_percent: rank * 12,
        target_species: ['Black Bass', 'Zander'],
        access_mode: rank <= 2 ? 'car_asphalt' : 'dirt_track',
        access_summary: 'Asphalt CV-428 road · 80m gentle walk',
        depth_structure: '2m-9m rocky ledge',
        why_label: "Why it's great:",
        why_this_spot: 'Prime ambush transition edge.',
        how_to_fish: 'Cast along the ledge and slow-roll.',
        rating: 8.4 - rank * 0.6,
        rating_tier: rank <= 2 ? 'Strong Structure' : 'Solid Candidate',
        rating_justification:
          'Rated from visible point, drop-off, and channel transition cues.',
      })),
      best_game_plan: [
        'Park off CV-428 at Spot 4 for flat gravel shore access.',
        'Walk south to Spot 2 and fan-cast the shelf break.',
      ],
    },
  };

  it('generates a valid single-page (1-pager) PDF document containing the screenshot and report', () => {
    const doc = buildOnePageFishingPdfDoc(sampleArtifact);
    expect(doc.getNumberOfPages()).toBe(1);

    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5));
    expect(header).toBe('%PDF-');
  });

  it('renders accurate green/blue/yellow legend and wraps long spot headers without mid-word truncation (AC-F02-11)', () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });
    const renderedStrings: string[] = [];
    const origText = doc.text.bind(doc) as (...args: any[]) => jsPDF;
    const textSpy = vi
      .spyOn(doc, 'text')
      .mockImplementation(((text: any, ...rest: any[]) => {
        if (Array.isArray(text)) {
          renderedStrings.push(...text.map(String));
        } else {
          renderedStrings.push(String(text));
        }
        return origText(text, ...rest);
      }) as typeof doc.text);

    const longHeaderArtifact: UserScreenshotArtifact = {
      ...sampleArtifact,
      analysis: {
        ...sampleArtifact.analysis,
        recommended_spots: [
          {
            ...sampleArtifact.analysis.recommended_spots[0],
            title:
              'Primary Channel Point & Drop-Off (Parque natural Lago de Sanabria y Sierras Segundera y de Porto)',
            target_species: ['Pumpkinseed Sunfish', 'Brown / Rainbow Trout'],
          },
        ],
      },
    };

    try {
      const resultDoc = buildOnePageFishingPdfDoc(longHeaderArtifact, { doc });
      expect(resultDoc.getNumberOfPages()).toBe(1);
      const joined = renderedStrings.join('\n');
      expect(joined).toContain('GREEN');
      expect(joined).toContain('BLUE');
      expect(joined).toContain('YELLOW');
      expect(joined).not.toContain('1-2 RED');
      expect(joined).not.toContain('5-6 ORANGE');
      expect(joined).toContain('Brown / Rainbow Trout');
      expect(joined).toContain('DEM est.');
      expect(joined).toContain('AI Vision');
      // Regulations box preserves line breaks before Permits: and Restricted:
      expect(renderedStrings.some((s) => s.startsWith('Permits:'))).toBe(true);
      expect(renderedStrings.some((s) => s.startsWith('Restricted:'))).toBe(true);
      // Legend should be wrapped cleanly across lines without truncation
      expect(joined).toContain('Secondary');
      expect(joined).toContain('Spots');
      const legendIdx = renderedStrings.findIndex((s) => s.includes('Pins:'));
      expect(legendIdx).toBeGreaterThanOrEqual(0);
      expect(doc.getTextWidth(renderedStrings[legendIdx])).toBeLessThanOrEqual(104);
    } finally {
      textSpy.mockRestore();
    }
  });

  it('renders report_id, app_version, human-friendly timestamp, embeds report_id in filename, and avoids clipping Slope/Tactics (AC-F02-12)', () => {
    expect(buildPdfFilename('Embalse de Cortes', 'FS-20261112-A3F9')).toBe(
      'fishing-spot-embalse-de-cortes-FS-20261112-A3F9.pdf'
    );

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: false,
    });
    const renderedStrings: string[] = [];
    const origText = doc.text.bind(doc) as (...args: any[]) => jsPDF;
    const textSpy = vi
      .spyOn(doc, 'text')
      .mockImplementation(((text: any, ...rest: any[]) => {
        if (Array.isArray(text)) {
          renderedStrings.push(...text.map(String));
        } else {
          renderedStrings.push(String(text));
        }
        return origText(text, ...rest);
      }) as typeof doc.text);

    const sixSpots = Array.from({ length: 6 }, (_, idx) => ({
      ...sampleArtifact.analysis.recommended_spots[0],
      rank: idx + 1,
      cell_id: `A${idx + 1}`,
      grid_cells_label: `Grid A${idx + 1}`,
      title: `Shoreline Peninsula Point (~${12 + idx * 3}m off shore)`,
      rating_justification:
        'Single-Feature / Limited (1 feature): visual_depth_change; capped below 4.5.',
      how_to_fish:
        'Long-range inline spinners or drifting natural nymphs along the drop-off edge during low-light hours.',
    }));

    const fullArtifact: UserScreenshotArtifact = {
      ...sampleArtifact,
      report_id: 'FS-20261112-A3F9',
      createdAt: '12 Nov 2026, 13:24',
      analysis: {
        ...sampleArtifact.analysis,
        report_id: 'FS-20261112-A3F9',
        app_version: '0.2.0',
        generated_at: '12 Nov 2026, 13:24',
        geographical_context: {
          ...sampleArtifact.analysis.geographical_context!,
          road_access_summary:
            'Nearest mapped roads: Unnamed Track (~167m), Unnamed Track (~174m).',
          shore_accessibility_summary:
            'Moderate-to-steep slopes (~+10m to +16m) near shore; check safe footing.',
        },
        recommended_spots: sixSpots,
      },
    };

    try {
      buildOnePageFishingPdfDoc(fullArtifact, { doc });
      const joined = renderedStrings.join('\n');
      expect(joined).toContain('ID: FS-20261112-A3F9');
      expect(joined).toContain('v0.2.0');
      expect(joined).toContain('12 Nov 2026, 13:24');
      expect(joined).toContain('check safe footing.');
      expect(joined).toContain('during low-light hours.');
    } finally {
      textSpy.mockRestore();
    }
  });
});
