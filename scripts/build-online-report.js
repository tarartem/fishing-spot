const fs = require('fs');
const path = require('path');

const pdfPath = path.resolve(__dirname, '../public/lago-de-carucedo-fishing-guide.pdf');
const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');

const markdownContent = `# Lago de Carucedo — Fishing Spot Guide
El Bierzo, Castile and León, Spain  •  Elevation: ~392m ASL  •  Satellite & Terrain Analysis

---

### Water Body Overview & Fish Species
A natural mountain lake featuring clean shallows, weed margins, and steep shoreline transitions.
* **Brown Trout:** Patrolling cooler, oxygenated narrows and shaded banks.
* **Black Bass:** Holding along shoreline points, coves, and shallow transition shelves.
* **Iberian Barbel & Chub:** Cruising bottom contours, gravel drop-offs, and overhanging bank edges.
* **Common Carp:** Feeding across warm, silty bay shallows and reed fringes.

---

### 🏆 Top Recommended Spots

#### #1. North Constriction Neck [Grid D2]  •  ⭐ 3.9/10  •  Target: Brown Trout, Iberian Barbel
**Why this spot:** The lake narrows here into a natural pinch-point between the northern arm and the main basin. Cruising trout and barbel funnel through this bottleneck as water and forage move between basins, creating the highest-percentage ambush corridor on the lake.
* **Tactics & Cast:** Fan-cast a single-hook inline spinner, drift a light float rig, or slow-roll a small soft plastic ~10m out across the narrowest channel cut.
* **Shore Access:** Gentle bank (~2m slope) reachable via clear shoreline walking paths off the north perimeter.

---

#### #2. West Peninsula Point [Grid C5]  •  ⭐ 3.9/10  •  Target: Black Bass, Brown Trout
**Why this spot:** A prominent point jutting out into open water breaks the lake's contour line. Predatory bass and trout use this structure to corral passing schools of baitfish against the shore, giving you a 180° casting arc into multiple depth zones from one standing position.
* **Tactics & Cast:** Stand on the point and cast suspending jerkbaits or lightly jigged soft plastics ~14m past the tip, working lures back down the underwater slope.
* **Shore Access:** Flat, accessible bank (~2m slope) with easy trail access from Camino a La Barosa.

---

#### #3. East Sheltered Cove [Grid F4]  •  ⭐ 3.5/10  •  Target: Black Bass, Iberian Chub
**Why this spot:** Tucked into the eastern shoreline, this cove is completely shielded from main-lake chop and wind. The warmer, calm water provides safe haven for fry and terrestrial insects, drawing active bass and chub into the shallows during midday feeding windows.
* **Tactics & Cast:** Quietly pitch weightless soft plastic worms or float-fish corn and worms ~10m into the calm cove pockets with minimal surface splash.
* **Shore Access:** Easy, flat grassy approach (~2m slope) with open casting room.

---

### 📍 Secondary & Shoreline Spots

#### #4. North Shore Margin [Grid A8]  •  ⭐ 2.1/10  •  Target: Iberian Chub, Black Bass
**Why this spot:** An open, gradual shoreline flat. While lacking dramatic underwater drops, roaming chub and cruising bass cruise parallel to the bank during dawn and dusk low-light hours.
* **Tactics & Cast:** Walk the bank and slow-roll a light inline spinner or weedless paddle-tail ~14m out, retrieving parallel to the shoreline.
* **Shore Access:** Gentle bank (~5m slope) with an unobstructed shoreline trail.

---

#### #5. Southeast Silt Bay [Grid E7]  •  ⭐ 2.1/10  •  Target: Common Carp, Iberian Chub
**Why this spot:** A quiet, silt-bottom shoreline pocket along the southeastern bend. Ideal territory for bottom-feeding carp rooting in the silt and chub cruising the margins.
* **Tactics & Cast:** Cast a light feeder or ledger rig with corn or boilies ~10m off the bank; keep bank footsteps and noise to a minimum.
* **Shore Access:** Low, level bank (~2m slope) with clear space for bank sticks or a seat box.

---

#### #6. Southwest Entry Bank [Grid A4]  •  ⭐ 2.1/10  •  Target: Iberian Chub, Black Bass
**Why this spot:** An expansive, shallow bank offering the gentlest slope and fastest access from the road. Perfect for making a few exploratory casts upon arrival before trekking further.
* **Tactics & Cast:** Fan-cast small shallow crankbaits or spinners across the open shallows (~28m out) to prospect for active cruisers.
* **Shore Access:** Easiest entry on the lake (~1m slope); immediate access from the roadside verge.

---

### 🧭 Suggested Game Plan
1. **Arrival & Quick Prospecting:** Step onto the bank at **Spot 6 (Grid A4)** for quick warm-up casts to check water clarity and surface activity.
2. **Prime Morning Feeding Window:** Walk the north path to **Spot 1 (North Constriction Neck, Grid D2)** to target transitioning trout and barbel, then work your way to the **West Peninsula Point (Spot 2, Grid C5)**.
3. **Midday / Rising Wind:** If afternoon winds create chop on the main lake, head to the **East Sheltered Cove (Spot 3, Grid F4)** to fish calm, warm pockets for bass and chub.

---

### 📋 Regulations & Terrain Note
* **Permits:** Requires the free *Licencia de Pesca de Castilla y León* (or Spanish Interautonómica). Free *Tramo Libre* angling rules apply unless signposted locally as an AREC / Coto.
* **Safety & Buffers:** Maintain mandatory safety buffers from dams, weirs, and marked waterfowl sanctuaries.
* **Data Note:** Underwater contours are inferred from satellite shoreline topography and elevation models. Always verify local bank footing and seasonal weed growth on arrival.`;

const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lago de Carucedo — Fishing Spot Guide (Interactive Online Report)</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    @media print {
      body { background: #ffffff !important; color: #0f172a !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .print-border { border: 1px solid #cbd5e1 !important; background: #ffffff !important; color: #0f172a !important; }
      .print-shadow-none { box-shadow: none !important; }
      .spot-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px !important; }
      .page-break { page-break-before: always; }
    }
    .custom-scroll::-webkit-scrollbar { width: 6px; }
    .custom-scroll::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.6); }
    .custom-scroll::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.8); border-radius: 4px; }
    .active-pin { transform: scale(1.3); filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.9)); }
    .spot-highlight { ring: 2px solid #10b981; animation: pulseGlow 1.8s ease-in-out; }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
      50% { box-shadow: 0 0 25px 4px rgba(16, 185, 129, 0.45); }
    }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-emerald-500 selection:text-slate-950 p-3 sm:p-6 lg:p-8">

  <!-- Main Container -->
  <div class="mx-auto max-w-7xl space-y-6">

    <!-- Top Navigation / Actions Bar -->
    <header class="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-5 shadow-2xl">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 font-semibold text-emerald-300">
              <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Hydrographic Spot Guide
            </span>
            <span class="rounded-md bg-slate-800 px-2.5 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-700">
              ID: FS-20261112-CARUCEDO
            </span>
            <span class="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-sky-400 border border-slate-700">
              v0.3.1
            </span>
            <span class="text-slate-400">
              El Bierzo, Castile and León, Spain
            </span>
          </div>

          <div class="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Lago de Carucedo
            </h1>
            <span class="text-sm font-medium text-emerald-400">
              • Elevation: ~392m ASL • Satellite & Terrain Spatial Grid
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center gap-2.5 no-print">
          <button
            id="downloadPdfBtn"
            onclick="downloadPrebuiltPdf()"
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Download the standalone vector PDF"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Download PDF
          </button>

          <button
            onclick="window.print()"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2.5 text-xs transition"
            title="Print or Save as PDF via Browser"
          >
            <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
            Print
          </button>

          <button
            id="copyMdBtn"
            onclick="copyMarkdownReport()"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2.5 text-xs transition"
          >
            <svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
            </svg>
            <span id="copyBtnText">Copy Markdown</span>
          </button>
        </div>
      </div>

      <!-- Water Body Overview & Fish Species -->
      <div class="mt-5 border-t border-slate-800 pt-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p class="text-sm text-slate-300 leading-relaxed max-w-3xl">
            <strong class="text-emerald-400 font-semibold">Water Body Profile:</strong> A natural mountain lake featuring clean shallows, weed margins, and steep shoreline transitions.
          </p>
          <div class="flex items-center gap-1.5 text-xs text-slate-400 no-print">
            <span>Filter spots:</span>
          </div>
        </div>

        <!-- Interactive Species Filter Tags -->
        <div class="mt-3 flex flex-wrap items-center gap-2 no-print" id="speciesFilters">
          <button onclick="filterSpecies('all')" data-species="all" class="species-btn active rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition">
            All Species (6 Spots)
          </button>
          <button onclick="filterSpecies('Brown Trout')" data-species="Brown Trout" class="species-btn rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 transition">
            🐟 Brown Trout
          </button>
          <button onclick="filterSpecies('Black Bass')" data-species="Black Bass" class="species-btn rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 transition">
            🎣 Black Bass
          </button>
          <button onclick="filterSpecies('Iberian Barbel & Chub')" data-species="Iberian Barbel & Chub" class="species-btn rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 transition">
            🌊 Iberian Barbel & Chub
          </button>
          <button onclick="filterSpecies('Common Carp')" data-species="Common Carp" class="species-btn rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 transition">
            🌾 Common Carp
          </button>
        </div>

        <!-- Species Habitat Summary Cards -->
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div class="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-amber-300">Brown Trout</span>
              <span class="text-[10px] text-slate-400">Cold Water</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-normal">Patrolling cooler, oxygenated narrows and shaded banks.</p>
          </div>

          <div class="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-emerald-300">Black Bass</span>
              <span class="text-[10px] text-slate-400">Ambush Predator</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-normal">Holding along shoreline points, coves, and transition shelves.</p>
          </div>

          <div class="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-sky-300">Iberian Barbel & Chub</span>
              <span class="text-[10px] text-slate-400">Native Cyprinids</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-normal">Cruising bottom contours, gravel drop-offs, and bank edges.</p>
          </div>

          <div class="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 space-y-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-orange-300">Common Carp</span>
              <span class="text-[10px] text-slate-400">Silt Feeder</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-normal">Feeding across warm, silty bay shallows and reed fringes.</p>
          </div>
        </div>
      </div>
    </header>

    <!-- Two-Column Interactive Layout: Left Side Interactive Map + Right Side 2-Tier Spot Cards -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

      <!-- LEFT COLUMN: Interactive A1-H8 Grid Map & Legal Footnote (lg:col-span-5) -->
      <div class="lg:col-span-5 space-y-5 lg:sticky lg:top-6">

        <!-- Interactive Vector Grid Map -->
        <div class="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl p-4 shadow-xl space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span>🗺️</span> Spatial Grid Map (A1–H8)
            </h2>
            <span class="text-[11px] text-emerald-400 font-mono">Interactive Pins</span>
          </div>

          <!-- SVG Simulated Hydrographic Map -->
          <div class="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden aspect-[4/3] flex items-center justify-center p-2">
            <svg class="w-full h-full" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#0e7490" />
                  <stop offset="60%" stop-color="#0891b2" />
                  <stop offset="100%" stop-color="#0284c7" />
                </linearGradient>
                <radialGradient id="deepGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#0369a1" />
                  <stop offset="100%" stop-color="#0e7490" />
                </radialGradient>
              </defs>

              <!-- Grid Background Lines -->
              <!-- 8x8 Grid: width 400/8 = 50, height 300/8 = 37.5 -->
              <!-- Columns A..H -->
              <g stroke="#334155" stroke-width="0.75" stroke-dasharray="2,2">
                <line x1="50" y1="0" x2="50" y2="300" />
                <line x1="100" y1="0" x2="100" y2="300" />
                <line x1="150" y1="0" x2="150" y2="300" />
                <line x1="200" y1="0" x2="200" y2="300" />
                <line x1="250" y1="0" x2="250" y2="300" />
                <line x1="300" y1="0" x2="300" y2="300" />
                <line x1="350" y1="0" x2="350" y2="300" />

                <!-- Rows 1..8 -->
                <line x1="0" y1="37.5" x2="400" y2="37.5" />
                <line x1="0" y1="75.0" x2="400" y2="75.0" />
                <line x1="0" y1="112.5" x2="400" y2="112.5" />
                <line x1="0" y1="150.0" x2="400" y2="150.0" />
                <line x1="0" y1="187.5" x2="400" y2="187.5" />
                <line x1="0" y1="225.0" x2="400" y2="225.0" />
                <line x1="0" y1="262.5" x2="400" y2="262.5" />
              </g>

              <!-- Grid Coordinate Labels -->
              <!-- Columns A=25, B=75, C=125, D=175, E=225, F=275, G=325, H=375 -->
              <g font-family="monospace" font-size="10" fill="#64748b" text-anchor="middle">
                <text x="25" y="14">A</text><text x="75" y="14">B</text><text x="125" y="14">C</text><text x="175" y="14">D</text>
                <text x="225" y="14">E</text><text x="275" y="14">F</text><text x="325" y="14">G</text><text x="375" y="14">H</text>

                <text x="8" y="22" text-anchor="start">1</text>
                <text x="8" y="60" text-anchor="start">2</text>
                <text x="8" y="97" text-anchor="start">3</text>
                <text x="8" y="135" text-anchor="start">4</text>
                <text x="8" y="172" text-anchor="start">5</text>
                <text x="8" y="210" text-anchor="start">6</text>
                <text x="8" y="247" text-anchor="start">7</text>
                <text x="8" y="285" text-anchor="start">8</text>
              </g>

              <!-- Water Body Outer Polygon & Shallows -->
              <!-- Lago de Carucedo geometry: natural hourglass/basin with north arm & coves -->
              <path d="M 60 140 
                       C 50 100, 110 50, 170 52 
                       C 185 52, 195 65, 185 85
                       C 175 105, 230 115, 275 125
                       C 320 135, 310 180, 270 205
                       C 240 225, 210 245, 160 235
                       C 110 225, 80 180, 60 140 Z" 
                    fill="url(#waterGrad)" opacity="0.85" stroke="#38bdf8" stroke-width="1.5" />

              <!-- Deep Core Basin Area -->
              <path d="M 120 140 
                       C 130 90, 180 75, 185 110 
                       C 190 145, 250 150, 240 185 
                       C 210 205, 150 200, 120 140 Z" 
                    fill="url(#deepGrad)" opacity="0.65" />

              <!-- Surrounding Walking Trail / Camino -->
              <path d="M 40 135 Q 80 30 190 40 T 320 110 T 290 235 T 140 260 T 40 135" 
                    fill="none" stroke="#eab308" stroke-width="1" stroke-dasharray="4,3" opacity="0.6" />

              <!-- Compass Rose in bottom right corner -->
              <g transform="translate(365, 265)">
                <circle cx="0" cy="0" r="14" fill="#0f172a" stroke="#475569" stroke-width="1"/>
                <polygon points="0,-12 3,-3 0,0 -3,-3" fill="#ef4444"/>
                <polygon points="0,12 3,3 0,0 -3,3" fill="#94a3b8"/>
                <text x="0" y="-14" font-size="7" font-weight="bold" fill="#f87171" text-anchor="middle">N</text>
              </g>

              <!-- SPOT PINS (Interactive) -->
              <!-- Spot #1: D2 -> col D(175), row 2(56) -->
              <g id="pin-1" class="cursor-pointer transition-transform" onclick="scrollToSpot(1)" onmouseenter="hoverPin(1)" onmouseleave="unhoverPin(1)">
                <circle cx="178" cy="62" r="11" fill="#16a34a" stroke="#ffffff" stroke-width="2" class="shadow-lg"/>
                <text x="178" y="66" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">1</text>
                <text x="178" y="47" font-size="9" font-weight="bold" fill="#4ade80" text-anchor="middle">#1 D2</text>
              </g>

              <!-- Spot #2: C5 -> col C(125), row 5(168) -->
              <g id="pin-2" class="cursor-pointer transition-transform" onclick="scrollToSpot(2)" onmouseenter="hoverPin(2)" onmouseleave="unhoverPin(2)">
                <circle cx="128" cy="165" r="11" fill="#16a34a" stroke="#ffffff" stroke-width="2"/>
                <text x="128" y="169" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">2</text>
                <text x="128" y="150" font-size="9" font-weight="bold" fill="#4ade80" text-anchor="middle">#2 C5</text>
              </g>

              <!-- Spot #3: F4 -> col F(275), row 4(132) -->
              <g id="pin-3" class="cursor-pointer transition-transform" onclick="scrollToSpot(3)" onmouseenter="hoverPin(3)" onmouseleave="unhoverPin(3)">
                <circle cx="278" cy="135" r="11" fill="#16a34a" stroke="#ffffff" stroke-width="2"/>
                <text x="278" y="139" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">3</text>
                <text x="278" y="120" font-size="9" font-weight="bold" fill="#4ade80" text-anchor="middle">#3 F4</text>
              </g>

              <!-- Spot #4: A8 -> col A(25), row 8(280) -->
              <g id="pin-4" class="cursor-pointer transition-transform" onclick="scrollToSpot(4)" onmouseenter="hoverPin(4)" onmouseleave="unhoverPin(4)">
                <circle cx="45" cy="275" r="9.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
                <text x="45" y="278.5" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">4</text>
                <text x="45" y="262" font-size="8.5" font-weight="bold" fill="#38bdf8" text-anchor="middle">#4 A8</text>
              </g>

              <!-- Spot #5: E7 -> col E(225), row 7(243) -->
              <g id="pin-5" class="cursor-pointer transition-transform" onclick="scrollToSpot(5)" onmouseenter="hoverPin(5)" onmouseleave="unhoverPin(5)">
                <circle cx="232" cy="235" r="9.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
                <text x="232" y="238.5" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">5</text>
                <text x="232" y="222" font-size="8.5" font-weight="bold" fill="#38bdf8" text-anchor="middle">#5 E7</text>
              </g>

              <!-- Spot #6: A4 -> col A(25), row 4(132) -->
              <g id="pin-6" class="cursor-pointer transition-transform" onclick="scrollToSpot(6)" onmouseenter="hoverPin(6)" onmouseleave="unhoverPin(6)">
                <circle cx="40" cy="135" r="9.5" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
                <text x="40" y="138.5" font-size="10" font-weight="bold" fill="#ffffff" text-anchor="middle">6</text>
                <text x="40" y="122" font-size="8.5" font-weight="bold" fill="#38bdf8" text-anchor="middle">#6 A4</text>
              </g>
            </svg>
          </div>

          <!-- Map Legend -->
          <div class="flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2 border-t border-slate-800/80 pt-2">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <strong class="text-emerald-400 font-semibold">1–3:</strong> Top Picks
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2.5 w-2.5 rounded-full bg-sky-500"></span>
                <strong class="text-sky-400 font-semibold">4–6:</strong> Secondary
              </span>
            </div>
            <span class="text-[11px] text-amber-400/90 font-mono">
              - - - Camino Perimeter Path
            </span>
          </div>
        </div>

        <!-- Regulations & Terrain Note Box (Single Clean Global Note) -->
        <div class="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2.5 shadow-lg">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <span>📋</span> Regulations & Terrain Note
            </h3>
            <span class="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              Castilla y León
            </span>
          </div>

          <ul class="space-y-2 text-xs leading-relaxed text-slate-200">
            <li class="flex items-start gap-2">
              <span class="text-amber-400 font-bold">•</span>
              <div>
                <strong class="text-white">Permits:</strong> Requires the free <em>Licencia de Pesca de Castilla y León</em> (or Spanish Interautonómica). Free <em>Tramo Libre</em> angling rules apply unless signposted locally as an AREC / Coto.
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-amber-400 font-bold">•</span>
              <div>
                <strong class="text-white">Safety & Buffers:</strong> Maintain mandatory safety buffers from dams, weirs, and marked waterfowl sanctuaries.
              </div>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-amber-400 font-bold">•</span>
              <div>
                <strong class="text-white">Data Note:</strong> Underwater contours are inferred from satellite shoreline topography and elevation models. Always verify local bank footing and seasonal weed growth on arrival.
              </div>
            </li>
          </ul>
        </div>

      </div>

      <!-- RIGHT COLUMN: 2-Tier Spot Cards & Game Plan (lg:col-span-7) -->
      <div class="lg:col-span-7 space-y-6">

        <!-- ==================== TIER 1: TOP RECOMMENDED SPOTS (#1–#3) ==================== -->
        <section class="space-y-3.5">
          <div class="flex items-center justify-between border-b border-emerald-500/30 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">🏆</span>
              <h2 class="text-base font-extrabold tracking-tight text-white">
                Top Recommended Spots (#1–#3)
              </h2>
            </div>
            <span class="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
              High-Percentage Ambush Zones
            </span>
          </div>

          <!-- Spot #1 -->
          <article
            id="spot-1"
            data-spot-species="Brown Trout, Iberian Barbel"
            class="spot-card group rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl transition-all duration-200 hover:border-emerald-400 hover:shadow-emerald-500/10 space-y-3"
          >
            <!-- Card Header -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 px-2.5 py-0.5 font-mono text-xs font-black shadow-sm">
                  #1 Top Pick
                </span>
                <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-sky-300">
                  Grid D2
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                  ⭐ 3.9/10
                </span>
                <h3 class="text-base font-bold text-white tracking-tight">
                  North Constriction Neck
                </h3>
              </div>

              <!-- Target Species Badge upfront in Header Line -->
              <div class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300">
                <span class="text-slate-400">Target:</span>
                <span class="font-bold text-emerald-200">Brown Trout, Iberian Barbel</span>
              </div>
            </div>

            <!-- Why This Spot Narrative -->
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong class="text-emerald-400 font-semibold">Why this spot:</strong> The lake narrows here into a natural pinch-point between the northern arm and the main basin. Cruising trout and barbel funnel through this bottleneck as water and forage move between basins, creating the highest-percentage ambush corridor on the lake.
            </p>

            <!-- Two Punchy Bullets -->
            <div class="grid grid-cols-1 gap-2 pt-1">
              <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <span>🎯</span> Tactics & Cast:
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Fan-cast a single-hook inline spinner, drift a light float rig, or slow-roll a small soft plastic ~10m out across the narrowest channel cut.
                </p>
              </div>

              <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <span>🚶</span> Shore Access:
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Gentle bank (~2m slope) reachable via clear shoreline walking paths off the north perimeter.
                </p>
              </div>
            </div>
          </article>

          <!-- Spot #2 -->
          <article
            id="spot-2"
            data-spot-species="Black Bass, Brown Trout"
            class="spot-card group rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl transition-all duration-200 hover:border-emerald-400 hover:shadow-emerald-500/10 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 px-2.5 py-0.5 font-mono text-xs font-black shadow-sm">
                  #2 Top Pick
                </span>
                <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-sky-300">
                  Grid C5
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                  ⭐ 3.9/10
                </span>
                <h3 class="text-base font-bold text-white tracking-tight">
                  West Peninsula Point
                </h3>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300">
                <span class="text-slate-400">Target:</span>
                <span class="font-bold text-emerald-200">Black Bass, Brown Trout</span>
              </div>
            </div>

            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong class="text-emerald-400 font-semibold">Why this spot:</strong> A prominent point jutting out into open water breaks the lake's contour line. Predatory bass and trout use this structure to corral passing schools of baitfish against the shore, giving you a 180° casting arc into multiple depth zones from one standing position.
            </p>

            <div class="grid grid-cols-1 gap-2 pt-1">
              <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <span>🎯</span> Tactics & Cast:
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Stand on the point and cast suspending jerkbaits or lightly jigged soft plastics ~14m past the tip, working lures back down the underwater slope.
                </p>
              </div>

              <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <span>🚶</span> Shore Access:
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Flat, accessible bank (~2m slope) with easy trail access from Camino a La Barosa.
                </p>
              </div>
            </div>
          </article>

          <!-- Spot #3 -->
          <article
            id="spot-3"
            data-spot-species="Black Bass, Iberian Chub"
            class="spot-card group rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl transition-all duration-200 hover:border-emerald-400 hover:shadow-emerald-500/10 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 text-slate-950 px-2.5 py-0.5 font-mono text-xs font-black shadow-sm">
                  #3 Top Pick
                </span>
                <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-sky-300">
                  Grid F4
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                  ⭐ 3.5/10
                </span>
                <h3 class="text-base font-bold text-white tracking-tight">
                  East Sheltered Cove
                </h3>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-300">
                <span class="text-slate-400">Target:</span>
                <span class="font-bold text-emerald-200">Black Bass, Iberian Chub</span>
              </div>
            </div>

            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong class="text-emerald-400 font-semibold">Why this spot:</strong> Tucked into the eastern shoreline, this cove is completely shielded from main-lake chop and wind. The warmer, calm water provides safe haven for fry and terrestrial insects, drawing active bass and chub into the shallows during midday feeding windows.
            </p>

            <div class="grid grid-cols-1 gap-2 pt-1">
              <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <span>🎯</span> Tactics & Cast:
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Quietly pitch weightless soft plastic worms or float-fish corn and worms ~10m into the calm cove pockets with minimal surface splash.
                </p>
              </div>

              <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <span>🚶</span> Shore Access:
                </div>
                <p class="text-xs text-slate-300 leading-relaxed">
                  Easy, flat grassy approach (~2m slope) with open casting room.
                </p>
              </div>
            </div>
          </article>
        </section>

        <!-- ==================== TIER 2: SECONDARY & SHORELINE SPOTS (#4–#6) ==================== -->
        <section class="space-y-3.5 pt-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">📍</span>
              <h2 class="text-base font-extrabold tracking-tight text-slate-200">
                Secondary & Shoreline Spots (#4–#6)
              </h2>
            </div>
            <span class="rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-400">
              Low-Light Roamers & Easy Access
            </span>
          </div>

          <!-- Spot #4 -->
          <article
            id="spot-4"
            data-spot-species="Iberian Chub, Black Bass"
            class="spot-card group rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg transition-all duration-200 hover:border-slate-700 space-y-2.5"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 px-2.5 py-0.5 font-mono text-xs font-bold">
                  #4 Secondary
                </span>
                <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                  Grid A8
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-amber-300/90">
                  ⭐ 2.1/10
                </span>
                <h3 class="text-sm font-bold text-white tracking-tight">
                  North Shore Margin
                </h3>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-300">
                <span class="text-slate-400">Target:</span>
                <span class="font-semibold text-slate-200">Iberian Chub, Black Bass</span>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed">
              <strong class="text-slate-200 font-semibold">Why this spot:</strong> An open, gradual shoreline flat. While lacking dramatic underwater drops, roaming chub and cruising bass cruise parallel to the bank during dawn and dusk low-light hours.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              <div class="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 space-y-0.5">
                <div class="font-bold text-slate-300 flex items-center gap-1">
                  <span>🎯</span> Tactics & Cast:
                </div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  Walk the bank and slow-roll a light inline spinner or weedless paddle-tail ~14m out, retrieving parallel to the shoreline.
                </p>
              </div>

              <div class="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 space-y-0.5">
                <div class="font-bold text-slate-300 flex items-center gap-1">
                  <span>🚶</span> Shore Access:
                </div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  Gentle bank (~5m slope) with an unobstructed shoreline trail.
                </p>
              </div>
            </div>
          </article>

          <!-- Spot #5 -->
          <article
            id="spot-5"
            data-spot-species="Common Carp, Iberian Chub"
            class="spot-card group rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg transition-all duration-200 hover:border-slate-700 space-y-2.5"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 px-2.5 py-0.5 font-mono text-xs font-bold">
                  #5 Secondary
                </span>
                <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                  Grid E7
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-amber-300/90">
                  ⭐ 2.1/10
                </span>
                <h3 class="text-sm font-bold text-white tracking-tight">
                  Southeast Silt Bay
                </h3>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-300">
                <span class="text-slate-400">Target:</span>
                <span class="font-semibold text-slate-200">Common Carp, Iberian Chub</span>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed">
              <strong class="text-slate-200 font-semibold">Why this spot:</strong> A quiet, silt-bottom shoreline pocket along the southeastern bend. Ideal territory for bottom-feeding carp rooting in the silt and chub cruising the margins.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              <div class="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 space-y-0.5">
                <div class="font-bold text-slate-300 flex items-center gap-1">
                  <span>🎯</span> Tactics & Cast:
                </div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  Cast a light feeder or ledger rig with corn or boilies ~10m off the bank; keep bank footsteps and noise to a minimum.
                </p>
              </div>

              <div class="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 space-y-0.5">
                <div class="font-bold text-slate-300 flex items-center gap-1">
                  <span>🚶</span> Shore Access:
                </div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  Low, level bank (~2m slope) with clear space for bank sticks or a seat box.
                </p>
              </div>
            </div>
          </article>

          <!-- Spot #6 -->
          <article
            id="spot-6"
            data-spot-species="Iberian Chub, Black Bass"
            class="spot-card group rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg transition-all duration-200 hover:border-slate-700 space-y-2.5"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 px-2.5 py-0.5 font-mono text-xs font-bold">
                  #6 Secondary
                </span>
                <span class="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-slate-300">
                  Grid A4
                </span>
                <span class="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-amber-300/90">
                  ⭐ 2.1/10
                </span>
                <h3 class="text-sm font-bold text-white tracking-tight">
                  Southwest Entry Bank
                </h3>
              </div>

              <div class="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-300">
                <span class="text-slate-400">Target:</span>
                <span class="font-semibold text-slate-200">Iberian Chub, Black Bass</span>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed">
              <strong class="text-slate-200 font-semibold">Why this spot:</strong> An expansive, shallow bank offering the gentlest slope and fastest access from the road. Perfect for making a few exploratory casts upon arrival before trekking further.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              <div class="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 space-y-0.5">
                <div class="font-bold text-slate-300 flex items-center gap-1">
                  <span>🎯</span> Tactics & Cast:
                </div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  Fan-cast small shallow crankbaits or spinners across the open shallows (~28m out) to prospect for active cruisers.
                </p>
              </div>

              <div class="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 space-y-0.5">
                <div class="font-bold text-slate-300 flex items-center gap-1">
                  <span>🚶</span> Shore Access:
                </div>
                <p class="text-slate-400 text-[11px] leading-relaxed">
                  Easiest entry on the lake (~1m slope); immediate access from the roadside verge.
                </p>
              </div>
            </div>
          </article>
        </section>

        <!-- ==================== SUGGESTED GAME PLAN ==================== -->
        <section class="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-xl space-y-4">
          <div class="flex items-center justify-between border-b border-emerald-500/30 pb-3">
            <h3 class="text-base font-bold text-emerald-300 flex items-center gap-2">
              <span>🧭</span> Suggested Game Plan for Lago de Carucedo
            </h3>
            <span class="text-xs text-emerald-400 font-mono">3 Strategic Phases</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <!-- Phase 1 -->
            <div class="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-sky-300">Phase 1</span>
                <span class="text-[11px] text-slate-400">07:00 – 08:00</span>
              </div>
              <h4 class="text-xs font-bold text-white">Arrival & Warm-up</h4>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                Step onto the bank at <strong class="text-emerald-300 font-semibold">Spot 6 (Grid A4)</strong> for quick warm-up casts to check water clarity and surface activity.
              </p>
            </div>

            <!-- Phase 2 -->
            <div class="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">Phase 2</span>
                <span class="text-[11px] text-emerald-400 font-semibold">08:30 – 11:30</span>
              </div>
              <h4 class="text-xs font-bold text-white">Prime Feeding Window</h4>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                Walk north to <strong class="text-emerald-300 font-semibold">Spot 1 (North Constriction Neck, D2)</strong> for trout & barbel, then work to <strong class="text-emerald-300 font-semibold">West Peninsula Point (Spot 2, C5)</strong>.
              </p>
            </div>

            <!-- Phase 3 -->
            <div class="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">Phase 3</span>
                <span class="text-[11px] text-slate-400">12:00 – 15:00</span>
              </div>
              <h4 class="text-xs font-bold text-white">Midday / Rising Wind</h4>
              <p class="text-[11px] text-slate-300 leading-relaxed">
                If afternoon winds create chop on the main lake, head to <strong class="text-emerald-300 font-semibold">East Sheltered Cove (Spot 3, F4)</strong> for calm, warm pockets for bass and chub.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t border-slate-800 pt-4 pb-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
      <div>
        Fishing Spot • Spec-Driven Development ($0 MVP Architecture)
      </div>
      <div>
        Clean Synthesized Version • Single Page Ready • No Redundant Warnings
      </div>
    </footer>

  </div>

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 pointer-events-none rounded-xl border border-emerald-500/40 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-emerald-300 shadow-2xl flex items-center gap-2">
    <span>✓</span> <span id="toastMsg">Action complete</span>
  </div>

  <script>
    // Embedded PDF Base64
    const PDF_BASE64 = "${pdfBase64}";
    const MARKDOWN_TEXT = ${JSON.stringify(markdownContent)};

    function downloadPrebuiltPdf() {
      try {
        const byteCharacters = atob(PDF_BASE64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lago-de-carucedo-fishing-guide.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('PDF downloaded successfully!');
      } catch (e) {
        window.open('/lago-de-carucedo-fishing-guide.pdf', '_blank');
      }
    }

    function copyMarkdownReport() {
      navigator.clipboard.writeText(MARKDOWN_TEXT).then(() => {
        showToast('Full Markdown report copied to clipboard!');
        const btn = document.getElementById('copyBtnText');
        if (btn) {
          btn.innerText = 'Copied!';
          setTimeout(() => { btn.innerText = 'Copy Markdown'; }, 2000);
        }
      });
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toastMsg');
      if (toast && toastMsg) {
        toastMsg.innerText = msg;
        toast.classList.remove('translate-y-20', 'opacity-0');
        setTimeout(() => {
          toast.classList.add('translate-y-20', 'opacity-0');
        }, 2500);
      }
    }

    function scrollToSpot(rank) {
      const el = document.getElementById('spot-' + rank);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('spot-highlight');
        setTimeout(() => { el.classList.remove('spot-highlight'); }, 2200);
      }
    }

    function hoverPin(rank) {
      const pin = document.getElementById('pin-' + rank);
      if (pin) pin.classList.add('active-pin');
    }

    function unhoverPin(rank) {
      const pin = document.getElementById('pin-' + rank);
      if (pin) pin.classList.remove('active-pin');
    }

    function filterSpecies(target) {
      const cards = document.querySelectorAll('.spot-card');
      const buttons = document.querySelectorAll('.species-btn');

      buttons.forEach(btn => {
        if (btn.getAttribute('data-species') === target) {
          btn.className = 'species-btn active rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition';
        } else {
          btn.className = 'species-btn rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 transition';
        }
      });

      cards.forEach(card => {
        if (target === 'all') {
          card.style.opacity = '1';
          card.style.transform = 'scale(1)';
        } else {
          const speciesList = card.getAttribute('data-spot-species') || '';
          if (speciesList.includes(target) || (target === 'Iberian Barbel & Chub' && (speciesList.includes('Barbel') || speciesList.includes('Chub')))) {
            card.style.opacity = '1';
            card.style.transform = 'scale(1.01)';
          } else {
            card.style.opacity = '0.35';
            card.style.transform = 'scale(0.99)';
          }
        }
      });
    }
  </script>
</body>
</html>
`;

// Save to public directory
const publicHtmlPath = path.resolve(__dirname, '../public/reports/lago-de-carucedo.html');
fs.mkdirSync(path.dirname(publicHtmlPath), { recursive: true });
fs.writeFileSync(publicHtmlPath, html);
console.log('Saved to:', publicHtmlPath);

// Save to artifact directory
const artifactDir = '/Users/tarartem/.gemini/antigravity/brain/30fc7825-9998-4990-b6b3-775646518b2b';
if (fs.existsSync(artifactDir)) {
  const artifactHtmlPath = path.join(artifactDir, 'lago_de_carucedo_online_report.html');
  fs.writeFileSync(artifactHtmlPath, html);
  console.log('Saved to artifact dir:', artifactHtmlPath);
}
