import { jsPDF } from 'jspdf';
import {
  APP_VERSION,
  formatReportTimestamp,
} from '@/shared/app-version';
import type {
  SpotAccessMode,
  UserScreenshotArtifact,
} from '@/shared/types/domain';

function asciiSafe(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u00d7/g, 'x')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function accessLabelText(mode: SpotAccessMode): string {
  switch (mode) {
    case 'car_asphalt':
      return 'CAR/ASPHALT';
    case 'dirt_track':
      return 'DIRT TRACK';
    case 'boat_only':
      return 'BOAT/CLIFF';
    default:
      return 'HIKE-IN';
  }
}

export function cleanSpotTitle(title: string, waterBodyName?: string): string {
  let cleaned = title;
  if (waterBodyName) {
    const esc = waterBodyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\s*\\(${esc}[^)]*\\)`, 'gi'), '');
  }
  // Strip repetitive lake tags e.g. (Carucedo (El Bierzo)), (Cortes de Pallás (Sector))
  cleaned = cleaned.replace(/\s*\([^)]*(?:Lake|Lago|Embalse|Bierzo|Cortes|Sector)[^)]*\)/gi, '');
  // Strip meter distances in parentheses e.g. (~14m to south bank) or (~27m off shore)
  cleaned = cleaned.replace(/\s*\(~?\d+m[^)]*\)/gi, '');
  return cleaned.trim();
}

export function cleanSpotText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s*\(depth unmeasured without bathymetry\)/gi, '')
    .replace(/Live Gemini Vision analysis was unavailable[^.]*\./gi, '')
    .replace(/Rated \d+(?:\.\d+)?\/10.*?:/gi, '')
    .replace(/Stacks \d+ features?.*?[—–-]/gi, '')
    .replace(/\(inferred from [^)]+\)/gi, '')
    .replace(/\bwithin [^)]+\(Sector\)/gi, '')
    .replace(/\(~?\d+m ASL DEM est\., \+\d+m local relief\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Builds a single-page A4 landscape PDF containing the annotated A1-H8 screenshot
 * and the complete practical fishing report (species, access, regulations, spots, game plan).
 */
export function buildOnePageFishingPdfDoc(
  artifact: UserScreenshotArtifact,
  options?: { doc?: jsPDF }
): jsPDF {
  const doc =
    options?.doc ??
    new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

  const pageW = 297;
  const pageH = 210;
  const margin = 9;
  const analysis = artifact.analysis;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(
    asciiSafe(`${analysis.water_body_name} - Fishing Spot Report`),
    margin,
    7.5
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const elev =
    typeof analysis.geographical_context?.water_elevation_m === 'number'
      ? `${analysis.geographical_context.water_elevation_m}m ASL`
      : 'Unverified (DEM timeout)';
  const relief = analysis.geographical_context?.relief_range_m ?? '-';
  const sourceLabel =
    analysis.analysis_source === 'geospatial_fallback'
      ? 'Geospatial Fallback (OSM+DEM)'
      : analysis.analysis_source === 'no_water_detected'
        ? 'No Water Detected'
        : 'AI Vision';
  const reportId = analysis.report_id || artifact.report_id || artifact.id;
  const appVersion = analysis.app_version || APP_VERSION;
  const generatedAt =
    analysis.generated_at || formatReportTimestamp(artifact.createdAt);
  doc.text(
    asciiSafe(
      `v${appVersion} | ID: ${reportId} | ${analysis.region_label} | Elevation: ~${elev}m ASL (DEM est., Relief +${relief}m) | Source: ${sourceLabel} | ${generatedAt}`
    ),
    margin,
    13.5
  );

  // Left Column: Annotated Screenshot + Legend + Geography + Regulations
  const leftX = margin;
  const leftW = 104;
  let leftY = 22;

  if (artifact.annotatedScreenshotDataUrl) {
    try {
      doc.addImage(
        artifact.annotatedScreenshotDataUrl,
        'PNG',
        leftX,
        leftY,
        104,
        104
      );
      doc.setDrawColor(100, 116, 139);
      doc.rect(leftX, leftY, 104, 104);
    } catch {
      // Skip image if unreadable in test mock
    }
  }
  leftY += 106.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(30, 41, 59);
  const legendLines = doc.splitTextToSize(
    'Pins: [1-2 GREEN] Top Ranked | [3-4 BLUE] Mid Ranked | [5-6 YELLOW] Secondary Spots',
    leftW
  );
  doc.text(legendLines, leftX, leftY);
  leftY += legendLines.length * 2.9 + 1.5;

  // Geography & Road Access Box
  if (analysis.geographical_context) {
    doc.setFillColor(240, 249, 255);
    doc.setDrawColor(125, 211, 252);
    doc.rect(leftX, leftY, leftW, 25.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(3, 105, 161);
    doc.text('GEOGRAPHY, ROADS & SHORE ACCESS', leftX + 2, leftY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(30, 41, 59);
    const geoLines = doc
      .splitTextToSize(
        asciiSafe(
          `Roads: ${analysis.geographical_context.road_access_summary}\nSlope: ${analysis.geographical_context.shore_accessibility_summary}`
        ),
        leftW - 4
      )
      .slice(0, 6);
    doc.text(geoLines, leftX + 2, leftY + 8);
    leftY += 27;
  }

  // Fishing Regulations & Allowed Check Box (only section with Spanish legal/permit names)
  if (analysis.restriction_check) {
    const remainingH = Math.max(22, pageH - margin - leftY);
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(251, 191, 36);
    doc.rect(leftX, leftY, leftW, remainingH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text(
      'SPAIN FISHING REGULATIONS (ALLOWED CHECK)',
      leftX + 2,
      leftY + 4
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(30, 41, 59);
    const limitationsLine =
      analysis.extraction_limitations && analysis.extraction_limitations.length > 0
        ? `\nLimits (${sourceLabel}): ${analysis.extraction_limitations[0]}`
        : '';
    const freshnessLine = analysis.imagery_freshness_note
      ? `\nImagery Note: Static satellite snapshot; flora, shadows & water levels vary seasonally.`
      : '';
    const regText = asciiSafe(
      `Status: ${analysis.restriction_check.status_label}\nPermits: ${analysis.restriction_check.permits_required}\nRestricted: ${analysis.restriction_check.prohibited_zones_warning}${limitationsLine}${freshnessLine}`
    );
    const regLines = doc
      .splitTextToSize(regText, leftW - 4)
      .slice(0, Math.floor((remainingH - 6) / 3.05));
    doc.text(regLines, leftX + 2, leftY + 8.2);
  }

  // Right Column: Summary + Species + Spots 1-6 + Game Plan
  const rightX = leftX + leftW + 6;
  const rightW = pageW - margin - rightX;
  let rightY = 22;

  // Water Body Summary & Fish Species
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('FISH SPECIES IN THIS WATER BODY', rightX, rightY);
  rightY += 3.5;

  const speciesSummary = (analysis.species_present ?? [])
    .slice(0, 5)
    .map((sp) => `${sp.name} (${sp.habitat_zone})`)
    .join(' | ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  const spLines = doc
    .splitTextToSize(asciiSafe(speciesSummary || analysis.water_body_summary), rightW)
    .slice(0, 3);
  doc.text(spLines, rightX, rightY);
  rightY += spLines.length * 3.3 + 2.5;

  // Spots 1..6
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('WHERE TO FISH ON THE GRID (SPOTS)', rightX, rightY);
  rightY += 3.5;

  const spots = analysis.recommended_spots.slice(0, 6);
  const hasTiers = spots.length >= 4;
  const gamePlanReserve = 22;
  const availableForSpots = pageH - margin - gamePlanReserve - rightY;
  const tierHeadersReserve = hasTiers ? 8 : 0;
  const perSpotHeight = (availableForSpots - tierHeadersReserve) / Math.max(1, spots.length);

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];

    if (hasTiers && i === 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(6, 95, 70);
      doc.text('TOP RECOMMENDED SPOTS (#1 - #3)', rightX, rightY + 3);
      rightY += 4;
    } else if (hasTiers && i === 3) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      doc.text('SECONDARY & SHORELINE SPOTS (#4 - #6)', rightX, rightY + 3);
      rightY += 4;
    }

    const isTop = spot.rank <= 3;
    doc.setFillColor(isTop ? 240 : 248, isTop ? 253 : 250, isTop ? 244 : 252);
    doc.setDrawColor(isTop ? 167 : 203, isTop ? 243 : 213, isTop ? 208 : 225);
    doc.rect(rightX, rightY, rightW, perSpotHeight - 1.2, 'FD');

    // Colored left indicator strip
    doc.setFillColor(isTop ? 34 : 14, isTop ? 197 : 165, isTop ? 94 : 233);
    doc.rect(rightX, rightY, 1.5, perSpotHeight - 1.2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    const ratingTag =
      typeof spot.rating === 'number' ? ` [${spot.rating.toFixed(1)}/10]` : '';
    const cleanTitle = cleanSpotTitle(spot.title, analysis.water_body_name);
    const headerLine = asciiSafe(
      `#${spot.rank}${ratingTag} [${spot.cell_id}] ${cleanTitle}  |  ${accessLabelText(spot.access_mode)}  |  Target: ${(spot.target_species ?? []).join(', ')}`
    );
    const headerLines = doc
      .splitTextToSize(headerLine, rightW - 6)
      .slice(0, 2);
    doc.text(headerLines, rightX + 3, rightY + 3.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    const whyContent = spot.why_this_spot
      ? spot.why_this_spot
      : spot.why_rank_summary && spot.why_rank_summary.length > 0
        ? spot.why_rank_summary.join(' • ')
        : spot.rating_justification || '';
    const cleanWhy = cleanSpotText(whyContent);
    const cleanTactics = cleanSpotText(spot.how_to_fish ?? '');
    const cleanAccess = cleanSpotText(spot.access_summary);
    const bodyText = asciiSafe(
      `${cleanWhy} | How to fish: ${cleanTactics} | Access: ${cleanAccess}`
    );
    const bodyOffsetY = 3.2 + headerLines.length * 2.8 + 0.3;
    const maxBodyLines = Math.max(
      2,
      Math.floor((perSpotHeight - 1.8 - bodyOffsetY) / 2.65)
    );
    const bodyLines = doc
      .splitTextToSize(bodyText, rightW - 6)
      .slice(0, maxBodyLines);
    doc.text(bodyLines, rightX + 3, rightY + bodyOffsetY);

    rightY += perSpotHeight;
  }

  // Best Game Plan Box at bottom right
  const planY = Math.max(rightY + 1, pageH - margin - gamePlanReserve + 1);
  const planH = pageH - margin - planY;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(52, 211, 153);
  doc.rect(rightX, planY, rightW, planH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 95, 70);
  doc.text('BEST GAME PLAN FOR THIS AREA', rightX + 2, planY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(15, 23, 42);
  const planText = analysis.best_game_plan
    .slice(0, 3)
    .map((step, i) => `${i + 1}. ${asciiSafe(step)}`)
    .join('\n');
  const planLines = doc
    .splitTextToSize(planText, rightW - 4)
    .slice(0, Math.max(3, Math.floor((planH - 6) / 3.1)));
  doc.text(planLines, rightX + 2, planY + 8);

  return doc;
}

export function buildPdfFilename(
  waterBodyName: string,
  reportId?: string
): string {
  const slug = waterBodyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const idSuffix = reportId ? `-${reportId}` : '';
  return `fishing-spot-${slug || 'area'}${idSuffix}.pdf`;
}

export function downloadOnePageFishingPdfReport(
  artifact: UserScreenshotArtifact
): void {
  const doc = buildOnePageFishingPdfDoc(artifact);
  const reportId = artifact.analysis.report_id || artifact.report_id;
  doc.save(buildPdfFilename(artifact.analysis.water_body_name, reportId));
}
