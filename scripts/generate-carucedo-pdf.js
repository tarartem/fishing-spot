const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

function createCarucedoPdf() {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = 297;
  const pageH = 210;
  const margin = 8;

  // --- 1. Top Header Banner ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 17, 'F');

  // Accent emerald bar
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 16.5, pageW, 0.8, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('LAGO DE CARUCEDO — FISHING SPOT GUIDE', margin, 7);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    'El Bierzo, Castile and Leon, Spain   |   Elevation: ~392m ASL   |   Hydrographic Satellite & Terrain Analysis',
    margin,
    12.5
  );

  // Right-side badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text('SYNTHESIZED 2-TIER REPORT  •  v0.3.1', pageW - margin - 52, 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Grid: A1-H8  •  ID: FS-20261112-CARUCEDO', pageW - margin - 52, 12.5);

  // Layout Columns
  const leftX = margin;
  const leftW = 102;
  const rightX = leftX + leftW + 6;
  const rightW = pageW - margin - rightX; // ~173mm

  // ==================== LEFT COLUMN ====================
  let leftY = 21;

  // Overview & Fish Species Card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(leftX, leftY, leftW, 36, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('WATER BODY OVERVIEW & TARGET SPECIES', leftX + 3, leftY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(51, 65, 85);
  const overviewText = 'A natural mountain lake featuring clean shallows, weed margins, and steep shoreline transitions.';
  doc.text(doc.splitTextToSize(overviewText, leftW - 6), leftX + 3, leftY + 8.5);

  const speciesList = [
    { name: 'Brown Trout', desc: 'Patrolling cooler, oxygenated narrows & shaded banks.' },
    { name: 'Black Bass', desc: 'Holding along points, coves, and shallow transition shelves.' },
    { name: 'Iberian Barbel & Chub', desc: 'Cruising bottom contours, gravel drop-offs & bank edges.' },
    { name: 'Common Carp', desc: 'Feeding across warm, silty bay shallows and reed fringes.' },
  ];

  let spY = leftY + 13.5;
  speciesList.forEach((sp) => {
    doc.setFillColor(16, 185, 129);
    doc.circle(leftX + 4.5, spY - 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sp.name + ':', leftX + 6.5, spY);

    const nameWidth = doc.getTextWidth(sp.name + ':');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(sp.desc, leftX + 7.5 + nameWidth, spY);
    spY += 4.6;
  });

  leftY += 38.5;

  // Grid Map Illustration / Coordinates Visualizer Card
  const mapH = 68;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(leftX, leftY, leftW, mapH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(248, 250, 252);
  doc.text('HYDROGRAPHIC A1-H8 SPATIAL GRID MAP', leftX + 3, leftY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(148, 163, 184);
  doc.text('Spots Pinpointed: #1 (D2), #2 (C5), #3 (F4), #4 (A8), #5 (E7), #6 (A4)', leftX + 3, leftY + 9);

  // Draw simulated spatial grid inside the card
  const gridX = leftX + 6;
  const gridY = leftY + 11.5;
  const gridW = leftW - 12; // 90mm
  const gridH = 48; // 48mm
  const cellW = gridW / 8;
  const cellH = gridH / 8;

  // Water body polygon (lake shape simulation across grid)
  doc.setFillColor(14, 116, 144); // cyan-700
  doc.setDrawColor(6, 182, 212); // cyan-500
  doc.roundedRect(gridX + cellW * 1.5, gridY + cellH * 1.0, cellW * 5.2, cellH * 6.0, 4, 4, 'FD');

  // Secondary cove and arm shapes
  doc.setFillColor(8, 145, 178);
  doc.ellipse(gridX + cellW * 4.2, gridY + cellH * 2.1, cellW * 1.3, cellH * 1.1, 'F');
  doc.ellipse(gridX + cellW * 3.4, gridY + cellH * 5.1, cellW * 1.5, cellH * 1.3, 'F');

  // Draw Grid lines
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.1);
  for (let c = 0; c <= 8; c++) {
    doc.line(gridX + c * cellW, gridY, gridX + c * cellW, gridY + gridH);
  }
  for (let r = 0; r <= 8; r++) {
    doc.line(gridX, gridY + r * cellH, gridX + gridW, gridY + r * cellH);
  }

  // Draw Grid Labels (A..H, 1..8)
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  for (let c = 0; c < 8; c++) {
    doc.text(cols[c], gridX + c * cellW + cellW / 2 - 1, gridY - 0.8);
  }
  for (let r = 0; r < 8; r++) {
    doc.text(String(r + 1), gridX - 3.2, gridY + r * cellH + cellH / 2 + 1);
  }

  // Spot pins on grid:
  // #1 D2: col 3 (D), row 1 (2)
  // #2 C5: col 2 (C), row 4 (5)
  // #3 F4: col 5 (F), row 3 (4)
  // #4 A8: col 0 (A), row 7 (8)
  // #5 E7: col 4 (E), row 6 (7)
  // #6 A4: col 0 (A), row 3 (4)
  const spotPositions = [
    { rank: 1, col: 3.5, row: 1.5, cell: 'D2', color: [34, 197, 94] }, // green
    { rank: 2, col: 2.7, row: 4.3, cell: 'C5', color: [34, 197, 94] }, // green
    { rank: 3, col: 5.6, row: 3.4, cell: 'F4', color: [34, 197, 94] }, // green
    { rank: 4, col: 0.8, row: 7.3, cell: 'A8', color: [14, 165, 233] }, // sky
    { rank: 5, col: 4.8, row: 6.4, cell: 'E7', color: [14, 165, 233] }, // sky
    { rank: 6, col: 0.7, row: 3.4, cell: 'A4', color: [14, 165, 233] }, // sky
  ];

  spotPositions.forEach((sp) => {
    const px = gridX + sp.col * cellW;
    const py = gridY + sp.row * cellH;
    doc.setFillColor(sp.color[0], sp.color[1], sp.color[2]);
    doc.circle(px, py, 2.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(sp.rank), px - 0.9, py + 1.2);
  });

  // Map Legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(203, 213, 225);
  doc.setFillColor(34, 197, 94);
  doc.circle(leftX + 6, leftY + mapH - 3.8, 1.2, 'F');
  doc.text('Top Picks #1-#3 (Green)', leftX + 9, leftY + mapH - 3);

  doc.setFillColor(14, 165, 233);
  doc.circle(leftX + 44, leftY + mapH - 3.8, 1.2, 'F');
  doc.text('Secondary #4-#6 (Blue)', leftX + 47, leftY + mapH - 3);

  leftY += mapH + 2.5;

  // Regulations & Terrain Note Box (Single Clean Footnote Card)
  const regH = pageH - margin - leftY;
  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.roundedRect(leftX, leftY, leftW, regH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('REGULATIONS & HYDROGRAPHIC TERRAIN NOTE', leftX + 3, leftY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(30, 41, 59);

  const regNotes = [
    '• Permits: Requires free Licencia de Pesca de Castilla y Leon (or Spanish Interautonomica). Tramo Libre angling rules apply unless signposted locally as AREC / Coto.',
    '• Safety Buffers: Maintain mandatory safety buffers from dams, weirs, and marked waterfowl reserves.',
    '• Data Note: Depths & contours inferred from satellite shoreline topography & DEM models. Verify bank footing on arrival.',
  ];

  let rY = leftY + 8.5;
  regNotes.forEach((rn) => {
    const lines = doc.splitTextToSize(rn, leftW - 6);
    doc.text(lines, leftX + 3, rY);
    rY += lines.length * 2.8 + 1.2;
  });

  // ==================== RIGHT COLUMN (SPOTS & GAME PLAN) ====================
  let rightY = 21;

  // --- TIER 1: TOP RECOMMENDED SPOTS (#1–#3) ---
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.rect(rightX, rightY, rightW, 5.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text('TOP RECOMMENDED SPOTS (#1 - #3)', rightX + 2.5, rightY + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(4, 120, 87);
  doc.text('Primary ambush bottlenecks, breaklines & productive structures', rightX + 68, rightY + 3.8);

  rightY += 6.5;

  const topSpots = [
    {
      rank: 1,
      cell: 'D2',
      title: 'North Constriction Neck',
      rating: '3.9/10',
      target: 'Brown Trout, Iberian Barbel',
      why: 'The lake narrows here into a natural pinch-point between northern arm and main basin. Cruising trout and barbel funnel through this bottleneck as forage moves between basins, creating the highest-percentage ambush corridor.',
      tactics: 'Fan-cast single-hook inline spinner, drift a light float rig, or slow-roll small soft plastic ~10m out across the narrowest channel cut.',
      access: 'Gentle bank (~2m slope) reachable via clear shoreline walking paths off the north perimeter.',
    },
    {
      rank: 2,
      cell: 'C5',
      title: 'West Peninsula Point',
      rating: '3.9/10',
      target: 'Black Bass, Brown Trout',
      why: "Prominent point jutting out into open water breaks the lake's contour line. Predatory bass and trout use this structure to corral passing schools of baitfish against shore, providing a 180 deg casting arc into multiple depth zones.",
      tactics: 'Stand on the point and cast suspending jerkbaits or lightly jigged soft plastics ~14m past tip, working lures back down slope.',
      access: 'Flat, accessible bank (~2m slope) with easy trail access from Camino a La Barosa.',
    },
    {
      rank: 3,
      cell: 'F4',
      title: 'East Sheltered Cove',
      rating: '3.5/10',
      target: 'Black Bass, Iberian Chub',
      why: 'Tucked into the eastern shoreline, completely shielded from main-lake chop and wind. Warmer, calm water provides safe haven for fry and insects, drawing active bass and chub into shallows during midday windows.',
      tactics: 'Quietly pitch weightless soft plastic worms or float-fish corn and worms ~10m into calm pockets with minimal surface splash.',
      access: 'Easy, flat grassy approach (~2m slope) with open casting room.',
    },
  ];

  const topCardH = 20.8;
  topSpots.forEach((sp) => {
    // Card frame
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(rightX, rightY, rightW, topCardH - 1, 1, 1, 'FD');

    // Emerald accent strip on left edge
    doc.setFillColor(16, 185, 129);
    doc.rect(rightX, rightY, 1.8, topCardH - 1, 'F');

    // Header line: #1. Title [Grid D2] • Rating • Target: Species
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    const headText = `#${sp.rank}. ${sp.title} [Grid ${sp.cell}]   |   Rating: ${sp.rating}   |   Target: ${sp.target}`;
    doc.text(headText, rightX + 3.5, rightY + 3.4);

    // Why this spot
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(51, 65, 85);
    const whyLines = doc.splitTextToSize(`Why this spot: ${sp.why}`, rightW - 6);
    doc.text(whyLines.slice(0, 2), rightX + 3.5, rightY + 6.8);

    // Tactics bullet
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(15, 23, 42);
    doc.text('Tactics & Cast:', rightX + 3.5, rightY + 13.0);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const tacLines = doc.splitTextToSize(sp.tactics, rightW - 25);
    doc.text(tacLines[0], rightX + 22, rightY + 13.0);

    // Access bullet
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Shore Access:', rightX + 3.5, rightY + 16.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const accLines = doc.splitTextToSize(sp.access, rightW - 24);
    doc.text(accLines[0], rightX + 21, rightY + 16.5);

    rightY += topCardH;
  });

  rightY += 1.0;

  // --- TIER 2: SECONDARY & SHORELINE SPOTS (#4–#6) ---
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.rect(rightX, rightY, rightW, 5.0, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('SECONDARY & SHORELINE SPOTS (#4 - #6)', rightX + 2.5, rightY + 3.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Exploratory roaming margins, silt bays & quick access entries', rightX + 75, rightY + 3.6);

  rightY += 6.2;

  const secondarySpots = [
    {
      rank: 4,
      cell: 'A8',
      title: 'North Shore Margin',
      rating: '2.1/10',
      target: 'Iberian Chub, Black Bass',
      why: 'Open gradual shoreline flat. Roaming chub and cruising bass cruise parallel to the bank during dawn and dusk low-light hours.',
      tactics: 'Walk the bank and slow-roll a light inline spinner or weedless paddle-tail ~14m out, retrieving parallel to shore.',
      access: 'Gentle bank (~5m slope) with an unobstructed shoreline trail.',
    },
    {
      rank: 5,
      cell: 'E7',
      title: 'Southeast Silt Bay',
      rating: '2.1/10',
      target: 'Common Carp, Iberian Chub',
      why: 'Quiet, silt-bottom shoreline pocket along southeastern bend. Ideal territory for bottom-feeding carp rooting in silt and chub along margins.',
      tactics: 'Cast a light feeder or ledger rig with corn or boilies ~10m off bank; keep bank footsteps and noise to a minimum.',
      access: 'Low, level bank (~2m slope) with clear space for bank sticks or a seat box.',
    },
    {
      rank: 6,
      cell: 'A4',
      title: 'Southwest Entry Bank',
      rating: '2.1/10',
      target: 'Iberian Chub, Black Bass',
      why: 'Expansive shallow bank with gentlest slope and fastest access from the road. Perfect for warm-up prospecting casts upon arrival.',
      tactics: 'Fan-cast small shallow crankbaits or spinners across open shallows (~28m out) to prospect for active cruisers.',
      access: 'Easiest entry on the lake (~1m slope); immediate access from the roadside verge.',
    },
  ];

  const secCardH = 18.2;
  secondarySpots.forEach((sp) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(rightX, rightY, rightW, secCardH - 1, 1, 1, 'FD');

    // Sky accent strip on left edge
    doc.setFillColor(14, 165, 233);
    doc.rect(rightX, rightY, 1.8, secCardH - 1, 'F');

    // Header line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(30, 41, 59);
    const headText = `#${sp.rank}. ${sp.title} [Grid ${sp.cell}]   |   Rating: ${sp.rating}   |   Target: ${sp.target}`;
    doc.text(headText, rightX + 3.5, rightY + 3.2);

    // Why this spot
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(71, 85, 105);
    const whyLines = doc.splitTextToSize(`Why this spot: ${sp.why}`, rightW - 6);
    doc.text(whyLines[0], rightX + 3.5, rightY + 6.3);

    // Tactics
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(30, 41, 59);
    doc.text('Tactics & Cast:', rightX + 3.5, rightY + 10.3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const tacLines = doc.splitTextToSize(sp.tactics, rightW - 25);
    doc.text(tacLines[0], rightX + 21, rightY + 10.3);

    // Access
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Shore Access:', rightX + 3.5, rightY + 13.7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const accLines = doc.splitTextToSize(sp.access, rightW - 24);
    doc.text(accLines[0], rightX + 20, rightY + 13.7);

    rightY += secCardH;
  });

  rightY += 1.5;

  // --- SUGGESTED GAME PLAN BOX ---
  const gamePlanH = pageH - margin - rightY;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(52, 211, 153); // emerald-400
  doc.roundedRect(rightX, rightY, rightW, gamePlanH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(6, 95, 70);
  doc.text('SUGGESTED GAME PLAN FOR LAGO DE CARUCEDO', rightX + 3, rightY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);

  const planSteps = [
    '1. Arrival & Quick Prospecting: Step onto the bank at Spot 6 (Grid A4) for quick warm-up casts to check water clarity and surface activity.',
    '2. Prime Morning Feeding Window: Walk north path to Spot 1 (North Constriction Neck, Grid D2) for transitioning trout/barbel, then work to West Peninsula Point (Spot 2, Grid C5).',
    '3. Midday / Rising Wind: If afternoon wind creates chop on main lake, head to East Sheltered Cove (Spot 3, Grid F4) for calm, warm pockets.',
  ];

  let pY = rightY + 8.2;
  planSteps.forEach((step) => {
    const lines = doc.splitTextToSize(step, rightW - 6);
    doc.text(lines, rightX + 3, pY);
    pY += lines.length * 2.8 + 1.1;
  });

  return doc;
}

const doc = createCarucedoPdf();
const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

// Write to public folder and artifact folder
const publicPdfPath = path.resolve(__dirname, '../public/lago-de-carucedo-fishing-guide.pdf');
fs.writeFileSync(publicPdfPath, pdfBuffer);
console.log('Saved to:', publicPdfPath, 'Size:', pdfBuffer.byteLength, 'bytes');

const artifactDir = '/Users/tarartem/.gemini/antigravity/brain/30fc7825-9998-4990-b6b3-775646518b2b';
if (fs.existsSync(artifactDir)) {
  const artifactPdfPath = path.join(artifactDir, 'lago-de-carucedo-fishing-guide.pdf');
  fs.writeFileSync(artifactPdfPath, pdfBuffer);
  console.log('Saved to artifact dir:', artifactPdfPath);
}
