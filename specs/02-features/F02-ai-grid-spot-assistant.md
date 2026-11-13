# F02 — AI Water Body Recognition, Water-Only Containment, Terrain/Road Access & Optimized Report

> **Status**: `Implemented`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)  
> **Schema**: [`prompts/schemas/spot-recommendation.schema.json`](../../prompts/schemas/spot-recommendation.schema.json)  
> **Geographic Focus (MVP)**: Spain (`ES`)  
> **Last Updated**: 2026-11-11

---

## 1. User Story
**As a** user who has captured a gridded satellite screenshot of a Spanish water body,  
**I want** the AI assistant to recognize the water body and the fish species living in it, place spots **strictly on water/shoreline points (never inland)**, evaluate real terrain steepness and road surfaces (asphalt vs. dirt track vs. hike-in), verify Spanish fishing restrictions, and present a clean, scannable report,  
**So that** every spot on my annotated screenshot is genuinely fishable and I know before driving there what species to target and whether my car can reach the bank.

---

## 2. AI & Geospatial Analysis Pipeline

1. **Water Body Identification & Live Fish Species Lookup (English-Only UI)**:
   - Combines our curated Spanish water bodies DB (`db/seed/poland-spain-waters.ts`), **Spanish & English Wikipedia GeoSearch + Extracts**, **OpenStreetMap Nominatim** (`accept-language=en`), and live **$0 biological occurrence APIs** (**iNaturalist API v1** `/observations/species_counts` for *Actinopterygii* within a padded watershed box, plus **OBIS API v3** `/checklist` for coastal/marine water bodies) within/around `bbox`.
   - Live biological sightings are cross-filtered against an Iberian/European angling & native-species taxonomy map (excluding micro-pests or aquarium-release noise like *Gambusia*), cached in-memory with a short timeout fallback so offline or sparse areas seamlessly degrade to curated DB + regional defaults.
   - The entire application UI, summaries, fish species names, spot descriptions, region labels (`Spain`, never `España`), and game plans are written **strictly in English**. Spanish terms appear **only** inside the **Fishing Regulations & Allowed-Check** module (`restriction_check`) where local Spanish permits, *Coto* systems, and protected-area rules are verified.
   - Curated DB proximity matching must NOT mislabel dry nearby hills (within ±2.5 km) as a reservoir unless verified water exists inside the selected `bbox`.
   - Produces a structured **`species_present`** roster (`name`, `habitat_zone`, `recommended_approach`, `regulation_note`) in English when `has_fishable_water === true` so the user immediately knows **what fish live in this water body** (e.g., *Black Bass*, *Zander*, *Common Carp*, *Iberian Barbel*, *Wels Catfish*, *Northern Pike*).

2. **Dual-Layer Water Masking & Zero-Hallucination "No Water" Gate (Zero Inland Pins)**:
   - **OSM Overpass + Multipolygon Ring Stitching + Non-Fishable Filtering**: Queries OpenStreetMap Overpass API (with mirror fallback) for permanent fishable water bodies (`natural=water`, `waterway=riverbank|river|canal`, `landuse=reservoir`), excluding `intermittent=yes`, `seasonal=yes`, `dry=yes`, `tunnel=yes|culvert`, `covered=yes`, `leisure=swimming_pool`, artificial concrete tanks/wastewater (`water=basin|wastewater|reflecting_pool|fountain|fishpond`), and tiny unnamed isolated polygons `< 3,500 m²` (Spanish agricultural *balsas de riego*). Stitches unclosed `relation` `outer` way segments end-to-end into closed polygons instead of closing partial arcs individually, and tracks `'ok' | 'empty' | 'unavailable'` explicitly.
   - **Client Raster Water Mask (`64×64` OSM Map-Tile Water Mask with Connected-Component Filtering)**: During screenshot capture, fetches CORS-enabled OSM base tiles (`#aad3df` water palette with `3×3` neighborhood filtering) onto an offscreen canvas and runs **8-connected component filtering** so only genuine fishable water bodies survive (large lakes/reservoirs `area >= 45` px in `128×128` OR continuous rivers `span >= 24 && area >= 22`), automatically discarding backyard pools, farm tanks, and intermittent creek dashes. Cells `A1..H8` require interior water density (`>= 4` water blocks or `interiorScore >= 11`) before becoming fallback spot anchors.
   - **Zero-Hallucination "No Water Body" Rejection (`has_fishable_water: false`)**:
     - If verified permanent fishable water geometry is absent/empty (`< 0.8%` surviving clustered/component-filtered raster water **and** no valid OSM water feature, or if Gemini Vision sets `has_fishable_water: false` / `recommended_spots: []`), the pipeline **MUST NOT** trigger fallback spot placement, render pins `1–6`, or export a spot PDF. Instead, it returns `has_fishable_water: false`, `recommended_spots: []`, and a clear plain-English `no_water_reason` asking the user to pan/zoom onto water.
   - **Deterministic Post-LLM Water Gate, Interior Auto-Snap, Grid-Line Clearance & De-Stacking**:
     - Recomputes `cell_id` deterministically from `(x_percent, y_percent)` (`percentToCellId`) so pin numbers never disagree with their grid label.
     - Validates every spot strictly **inside** active water polygons (`booleanPointInPolygon`) and/or interior raster water pixels (`grid64Mask` with cardinal-neighbor preference) rather than stopping on `0m` outer dry shoreline edges where rendered pins visually spill onto land. When `waterPolygons` are present, strictly requires vector-verified points (no bypass back to unverified raster points) and outputs `2–6` verified water spots honestly on narrow/edge captures rather than padding dry land. Only when `waterPolygons` are empty (e.g., Overpass timeout) may the pipeline fall back to strict OSM Carto `#aad3df` raster water masking while disclosing this in `extraction_limitations`. Never falls back to `cellIdToPercentCenter()` on corner-grazing cells.
     - Enforces **grid-line & label clearance**: keeps pin centers away from `12.5%` cell boundaries (`>= 1.8%` interior margin inside the assigned cell whenever interior water exists in that cell) so rendered `16px`-radius circles on the `1024×1024` grid do not visually straddle into adjacent cells (e.g., `E6`/`F6`) or overlap cell labels.
     - Any anti-overlap nudge **must re-verify** that the nudged pin remains strictly inside water and does not stack onto an occupied coordinate when multiple water cells exist.
     - Fallback mode (if Gemini returns `503`/timeout **when water IS verified**) classifies water coordinates using scale-aware Turf.js polygon/shoreline geometry and metric-scaled 64×64 raster angular/radial probes (peninsula/point tip, sheltered cove/bay, steep shoreline bank, straight bank margin, channel narrowing, or open-basin water) rather than hardcoded spot templates or invented numeric meter depths. It uses greedy farthest-point spacing (`>= 18%` frame separation where geometry allows), prioritizes shore-castable coordinates (`<= 75m` from nearest bank) first, caps `> 75m` open-basin spots at max `1–2`, reserves `channel` for true narrowings/corridors (using `depth_change`/`flat` for wide open water), and marks `analysis_source: 'geospatial_fallback'` clearly in UI/PDF. If neither Gemini nor any verified water mask confirms water, returns an honest unavailability/no-water response instead of fabricating pins.
     - Single crisp shore/offshore boundary: spots `<= 75m` from nearest shore are shore/long-cast candidates (`car_asphalt` / `dirt_track` / `hike_in`), whereas spots `> 75m` offshore are tagged `boat_only` (requiring permitted watercraft/float-tube; never `hike_in`), with human-facing text stating exact distance & cardinal bank direction (e.g., *"~35m off the east bank"*).
     - Regional freshwater species baselines incorporate northern/montane Autonomous Communities (Galicia, Asturias, Cantabria, País Vasco, Navarra, La Rioja, Castilla y León) and reservoir altitude (`>= 450m` ASL) so trout/barbel waters include **Brown Trout**, **Iberian Barbel**, **Iberian Chub**, **Common Carp**, and **Black Bass** without over-defaulting lowland Zander.

3. **Detailed Terrain Steepness & Road-Surface Accessibility**:
   - **Road & Track Network (OSM Overpass `way["highway"]`)**: Fetches roads/tracks inside `bbox` (+500m margin), extracting `highway` type, `surface` (`asphalt`, `paved`, `concrete`, `unpaved`, `dirt`, `gravel`, `ground`), `tracktype` (`grade1`–`grade5`), and `access` (`private`/`agricultural`).
   - **Elevation & Slope Profile (7-Second Resilience & Neutral Fallback)**:
     - Samples elevation across bbox sectors and verified water/spot coordinates using **Open-Meteo 90m Copernicus DEM** (`DEM est.`) with a resilient `7000ms` network timeout to prevent cloud latency drops.
     - If the DEM service times out or is unreachable, `water_elevation_m` degrades gracefully to `null` (displayed as `Elevation: ~Unverified (DEM timeout)`), while surrounding relief defaults to a neutral `10m` baseline (`relief_range_m: 10`), preventing false 95m canyon cliff hallucinations.
   - **Road-First Access Classification Priority**:
     - Evaluates drivable road proximity **before** slope relief so anglers are never told a spot is an inaccessible canyon cliff when an asphalt or gravel road sits 50m away:
       1. **Offshore Open Water**: Spots with `shoreDistanceM > 75m` are classified as `boat_only` (watercraft/float-tube required).
       2. **Drivable Roads First**:
          - Paved/asphalt road within `200m` -> `car_asphalt` (drive-in shore access).
          - Dirt/gravel track within `300m` -> `dirt_track`.
          - Road within `1.5 km` -> `hike_in` (`~Xm walk from road`).
       3. **Steep Cliff Caveat**: `boat_only` for steep banks is strictly reserved for spots with **no road within 1.5 km AND verified steep relief (> 40m)**.
       4. **Preserving Vision Intelligence**: When Gemini Vision identifies specific visual access features (such as parking lots, docks, boat ramps, or footpaths), that description is preserved and augmented rather than overwritten with a canned heuristic template.

4. **Optimal Scale, Resolution Gating, Non-Hardcoded Tactics & 12-Feature Extraction Engine**:
   - **Exact Ground Resolution & Sharp Tile Stitching**: Computes `metersPerPixel = (maxSpanKm * 1000) / 1024` in `scale-utils.ts` and uses `Math.ceil` tile zoom selection (`z12–z18` for PNOA HD, `z12–z17` for Esri) in `screenshot-compositor.ts` so `1024×1024` imagery is never downsampled unnecessarily.
   - **3-Tier Scale Honesty & Feature Gating**:
     - **Optimal Micro Scale (`0.30 – 1.50 km`, `~0.3–1.5 m/px`)**: Full **12-feature canonical extraction** enabled: `point`, `flat`, `drop_off`, `channel`, `shadow`, `cover`, `depth_change`, `weed_line`, `weed_edge`, `current_break`, `bottom_transition`, `multiple_points`.
     - **Sector / Meso Scale (`1.50 – 5.0 km`, `~1.5–5.0 m/px`)**: Macro structures and broad shelf/weed belts allowed; fine shoreline cover and small shadows flagged as limited by zoom.
     - **Wide Macro Scale (`> 5.0 km`, `> 5.0 m/px`)**: Hard-gates micro-features (`weed_line`, `weed_edge`, `shadow`, `cover`, `bottom_transition`) **off** in both prompt and post-processing; permits only macro features (`point`, `flat`, `drop_off`, `channel`, `depth_change`, `current_break`, `multiple_points`) and discloses the scale limitation honestly.
   - **Zero-Hallucination & Honest Observation Typing**:
     - Never forces a minimum feature count (e.g., if a simple canal or flat bank only shows 1–2 features, reports 1–2 honestly).
     - Never invents exact numeric underwater depths (e.g., `3–11m`, `5–12m`) when no bathymetry data exists; fallback descriptions state qualitative structure with depth explicitly marked unmeasured.
     - Every extracted feature carries `observation_type`: `'directly_visible'` (clearly visible in RGB pixels) vs. `'topographic_inference'` (inferred from canyon/bend geometry when turbidity or glare obscures the bottom), plus a concrete `visual_cue`.
     - In `geospatial_fallback` (when Gemini is unavailable), never fabricates unseen flora, shadows, underwater weed edges, or hardcoded brand tackle; derives per-spot `target_species` and structure-matched tactics dynamically (using optional `anglerGearNote` only if explicitly provided by the user) and builds `best_game_plan` by picking the lowest-slope shoreline entry first, skipping trivial `< 120m` hops between identical-tier spots, never routing `"Walk ... along bank paths"` to/from `boat_only` or offshore spots or across open water, and mentioning floatation/watercraft rules only when watercraft spots are present.
   - **Static Satellite Imagery vs. Dynamic Flora Honesty**:
     - Seasonal/time-dependent features (`weed_line`, `weed_edge`, `shadow`, and shoreline brush `cover`) are flagged `is_seasonal_or_dynamic: true` and paired with an `imagery_freshness_note` reminding anglers that satellite orthophotos are historical snapshots while permanent contours (points, channels, drop-offs) remain reliable.
   - **Deterministic `1–10` Feature-Based Rating & Justification Summary**:
     - `src/modules/ai-advisor/spot-rating.ts` computes each spot's `rating` (`1.0 – 10.0`), `rating_tier` (`Prime Convergence` / `Strong Structure` / `Solid Candidate` / `Moderate / Inferred Candidate` / `Single-Feature / Limited`), and concise `rating_justification` (1–2 sentence summary for UI and 1-page PDF) deterministically from the deduplicated `extracted_features`, weighting multi-category convergence (Structure + Transition + Ambush/Current) and capping single/dual-feature spots (`<= 4.5` for 1 feature, `<= 6.8` for 2 features). `'Single-Feature / Limited'` is reserved strictly for `0–1` feature spots; spots with `>= 2` features scoring `< 4.8` are labeled `'Moderate / Inferred Candidate'`.
     - Spots are sorted descending by computed `rating` so `Spot #1` is always the highest-rated candidate.
   - Optional lightweight Canvas 2D preprocessing/diagnostics on the captured satellite image detects extreme specular water glare inside water cells so the user can switch imagery sources without heavy WASM dependencies.

5. **Fishing Restrictions & Regulatory Lookup**:
   - Retains multi-source Spain checks (curated DB + Wikipedia/OSM protected reserves + dam/power-plant 100m exclusion buffers + Autonomous Community license & *Real Decreto 630/2013* invasive species laws).

6. **Professional Minimalist Report UI & 1-Page PDF Export — Tactical Angler (Verhunt Field Edition)**:
   - **Main Screen Brand Identity & Angler First Impression**:
     - Main top header title is **FISHING SPOT** with a high-vis Caldero rust `Fish` vector badge and clean subtitle: *"Find top fishing spots using satellite & terrain data"*.
     - Redundant non-interactive mode pills (`Shore & Boat`, `Multi-Species`) and the `· Tactical Recon` suffix are removed from the header to keep the interface uncluttered and focused on search.
     - Global search input allows finding any lake, river, town, or direct GPS coordinates worldwide.
     - Header includes the **"My spots (N) ▾"** dropdown button (with Lucide `Bookmark` vector icon), displaying saved reports and revealing previous water analyses with hotspot counts and relative timestamps.
   - **Map Landing & Selection Preview (Verhunt Field Edition)**:
     - Viewfinder reticle features clean Caldero rust corner brackets (`┌ ┐ / └ ┘`) and center crosshairs with structure hint (`Aim at bays, points & weed edges`), omitting redundant text labels.
     - Floating primary Verhunt Caldero CTA `SCAN FISHING WATERS` (with Lucide `Crosshair` or `Scan` icon, `#d96b27` blaze rust styling) without surrounding dark wrapper box.
     - Selection Preview modal: segmented imagery selector (`PNOA HD` | `Esri World` | `Terrain`), stable smart scale classification (`Optimal` / `Too tight` / `Wide area` with `shrink-0 whitespace-nowrap` to prevent layout resizing), removed static casting arc pill, and 1-click `Optimize Area` (Lucide `Sparkles`) + `Revert` (Lucide `Undo2`) controls.
   - **Artifact Dossier UI Report (Angler Focus)**:
     - Vector Iconography: Uses Lucide `Fish` icon for "Where to Fish on the Grid", spot card target species badges, and "Analyze Another Location" button, replacing target/crosshair icons.
     - Non-resizing metadata labels: "Access & Road Surface:" and "Structure:" labels use flex layout with `shrink-0 whitespace-nowrap` so they never resize, wrap awkwardly, or cause layout shifts.
   - **1-Page PDF Export (Verhunt Field Edition Palette)**:
     - Header band in Deep Olive (`rgb(21, 28, 22)`) with a 1mm Verhunt Caldero Rust (`rgb(217, 107, 39)`) accent underline strip, Warm Sand Fleece Khaki title, and Muted Stone metadata.
     - Screenshot framed in Ripstop Seam (`rgb(44, 58, 47)`).
     - Geography and Regulations callouts styled with tactical muted field olive and Caldero accents.
     - Spot cards: Top Recommended Spots (#1–#3) highlighted with Caldero Rust indicator strips and subtle warm field backgrounds; Secondary Spots (#4–#6) styled with Structure Green indicator strips.
     - Best Game Plan callout styled with Structure Green border and Caldero header.
   - **Preparation State (Single-Feature Sequential Stepper)**: While analysis runs, a dedicated dialog demonstrates **1 concise capability at a time** across all 6 checkpoints sequentially in authentic field guide scouting language:
     - 1: `Scanning water boundary & permanent reservoir contours...`
     - 2: `Overlaying 100m tactical casting grid & bathymetry sectors...`
     - 3: `Querying local fish species roster (Bass, Pike, Zander, Carp, Barbel)...`
     - 4: `Analyzing bank gradient, track surfaces & shore approaches...` (compliant terminology protecting against Spanish *Ley de Montes* vehicle off-road violations).
     - 5: `Verifying Spanish regional fishing permits & restricted zones...`
     - 6: `Pinpointing top trophy spots & generating tactical game plan...`
     - Precision vector icons from Lucide (`Scan`, `Layers`, `Fish`, `Footprints`, `Scale`, `Crosshair`) replacing raw emojis.
   - **Sticky Analysis Header & Ordered 2-Row Layout (Zero Height Jitter)**:
     - The artifact header is sticky (`sticky top-0 z-30 bg-[#151c16]/95 backdrop-blur-md border-b border-[#2c3a2f]`) with two dedicated, ordered rows:
       - **Row 1 (Title)**: `<h2>` Title (e.g., `Vallequillas (Sector)`). If no fishable water exists, shows a `No Fishable Water Detected` badge beside the title.
       - **Row 2 (Subtitle & GPS)**: Subtitle `region_label` followed by `·` and GPS coordinates pill with a standard 2-rectangles clipboard SVG copy button.
     - **Top-Right Action Buttons**:
       - `[ PDF Report ]` (Secondary action: olive card surface with Lucide `FileText` icon)
       - `[ Map PNG ]` (Secondary action: olive card surface with Lucide `Image` icon)
       - `[ Analyze Another Location ]` (Primary CTA: Verhunt Caldero `#d96b27` with Lucide `Compass` icon) or `[ Reposition Map Over Water ]` if no fishable water exists.
   - **Removal of Redundant "Spot Rank & Structure Legend"**:
     - Eliminates the confusing and redundant legend card under the map screenshot, elevating **Fish Species Present**, **Hydrographic Conditions**, and **Fishing Regulations** cards by ~75px so they are immediately visible without vertical scrolling.
   - **Water Body & Fish Species Card**: Name, region, altitude/scale, and structured **Fish Species Present** in English with feeding depths and recommended rigs.
   - **Scannable Field Dossier Spot Cards (`1–6`)**:
     - Clean semantic rank indicator: **Verhunt Caldero Rust** (`#d96b27`) for Spots 1–2 (Prime Trophy waypoints), **Lichen / Reeds Olive** (`#688a5b`) for Spots 3–4 (Sheltered Holding Zones), and **Slate Olive** (`#2c3a2f`) for Spots 5–6 (Secondary Corridors).
     - Grid cell coordinate in monospace (e.g. `[C4]`), Title, and compliant access badge with Lucide transport icons (`Car`, `Truck`, `Sailboat`, `Footprints`) using `Vehicle Tracks & Footpaths` / `Shore Approach & Bank Access` phrasing.
     - Structured key-values (`Target Species`, `Depth / Structure`) and subtle neutral `influencing_features` tags.
     - Compact tactical approach & technique notes without visual clutter or nested boxes.
   - **Practical Access & Tactical Master Plan (`best_game_plan`)**: Ordered parking/road approach → footpath route → bank casting advice.
   - **Spain Regulations Card**: Concise status/permit/exclusion summary verifying whether fishing is allowed.
   - **Dedicated Minimalist Metadata Footer**:
     - Clean warm khaki and weathered earth topo styling without internal PNG filename clutter.
     - Displays clean, purposeful metadata:
       - Report ID (`ID: FS-xxx`)
       - Generated timestamp (`📅 {date}`)
       - App version (`v{app_version}`)

---

## 3. Testable Acceptance Criteria (Given / When / Then)
- **AC-F02-1 (Zero Inland Spots)**: Given any water polygon covering only part of `bbox` (e.g., water only in columns `A–D` while `E–H` are dry land with dirt roads), When `analyzeWaterBodyScreenshot` normalizes or falls back on spots, Then 100% of `recommended_spots` have `(x_percent, y_percent)` inside water/shoreline (`<= 15m` from water) and `cell_id` strictly matching `percentToCellId(x_percent, y_percent)`.
- **AC-F02-2 (Road Surface & Access Mode)**: Given OSM highway segments near `bbox` with `surface=asphalt` vs `highway=track, tracktype=grade3`, When geospatial context & spot access are computed, Then each spot includes a practical `access_mode` (`car_asphalt` / `dirt_track` / `hike_in` / `boat_only`) and `access_summary` citing the road/track type and distance.
- **AC-F02-3 (English-Only Fish Species Roster)**: Given any recognized water body, When `analyzeWaterBodyScreenshot` returns, Then `species_present` contains at least 2 structured English fish species entries (`name`, `habitat_zone`, `recommended_approach`) and no non-English UI labels outside `restriction_check`.
- **AC-F02-4 (Schema & Gemini Vision Structured Output)**: Given `GEMINI_API_KEY` is configured, When calling Gemini Vision (`gemini-2.5-flash` / configurable `GEMINI_VISION_MODEL`), Then the request passes `systemInstruction`, `allowed_water_cells`, and a strict `responseSchema` aligned with `prompts/schemas/spot-recommendation.schema.json`, and any model/API failure is logged before degrading to `geospatial_fallback`.
- **AC-F02-5 (1-Page PDF Report Download & Source Transparency)**: Given a completed artifact, When the user clicks **"Download 1-Page PDF Report"**, Then a single-page PDF document (`1` page total) containing the annotated screenshot, `analysis_source` badge (`AI Vision` vs. `Geospatial Fallback`), `DEM est.` elevation label, and complete report description is generated and downloaded.
- **AC-F02-6 (No-Water-Body Zero-Hallucination Rejection)**: Given a screenshot/bbox containing only dry land (e.g., mountain hills and forest roads with `< 1%` clustered water and no OSM water feature) OR when Gemini Vision reports `has_fishable_water: false`, When `analyzeWaterBodyScreenshot` runs, Then it returns `has_fishable_water: false`, `recommended_spots: []`, never triggers fallback spots, and the UI renders no map pins or PDF download button.
- **AC-F02-7 (OSM Multipolygon Stitching & Raster Water Mask Fallback)**: Given a large reservoir represented as multiple unclosed `outer` segments in an OSM `relation`, When `fetchOsmWaterAndRoads` parses the relation or when `clientWaterMask` (`grid64Mask`) is provided while Overpass is unavailable, Then outer rings are stitched into valid polygons, vector-present paths never bypass back to unverified raw raster points, and raster-only fallback enforces strict `#aad3df` water containment and zero stacked coordinates.
- **AC-F02-8 (English-Only Region Labels & Tightened Species Halo)**: Given OSM Nominatim reverse geocoding and iNaturalist lookup in Spain, When `buildEnrichedGeospatialContext` builds `regionLabel` and `speciesPresentDefaults`, Then country names resolve in English (`Spain`, never `España`), watershed species halo stays tight (`0.05°` ~5 km), and Brown Trout (*Salmo trutta*) is distinguished from invasive Rainbow Trout (*Oncorhynchus mykiss*).
- **AC-F02-9 (12-Feature Extraction, Deterministic 1–10 Rating & Justification Summary)**: Given any fishable water body analysis, When recommended spots are returned, Then each spot includes validated canonical `extracted_features` (from the 12 angler features with `observation_type` and `visual_cue`), a deterministic `rating` (`1.0–10.0`) where single-feature spots are capped (`<= 4.5`) and `'Single-Feature / Limited'` applies only when `features.length <= 1`, descending `rank` order matching `rating`, a concise `rating_justification` summary rendered in both UI and PDF, per-spot access/species/tactics differentiation (no hardcoded brand lures), and an `imagery_freshness_note` warning that flora/shadows change over time.
- **AC-F02-10 (Scale-Gated Zero-Hallucination on Macro Captures)**: Given a wide macro bounding box (`> 5.0 km`), When `analyzeWaterBodyScreenshot` processes or normalizes spots, Then micro-features (`weed_line`, `weed_edge`, `shadow`, `cover`, `bottom_transition`) are gated out and `extraction_limitations` honestly states the resolution limit.
- **AC-F02-11 (Grid-Line Clearance & Accurate PDF Legend / Wrapping)**: Given spots snapped onto water inside `A1..H8` and exported to the 1-page PDF report, When `constrainSpotsToWaterMask` and `buildOnePageFishingPdfDoc` run, Then pins keep clear of cell boundary lines (`>= 1.8%` interior margin where cell water allows), `pdf-report.ts` renders a wrapped legend inside `leftW` matching the actual map pin colors (`1-2 GREEN`, `3-4 BLUE`, `5-6 YELLOW`), preserves line breaks before `Permits:` / `Restricted:` in the regulations panel, and spot headers wrap cleanly without mid-word `.slice(...)` truncation.
- **AC-F02-12 (Report Versioning, ID, Human-Friendly Timestamp, Non-Clipping PDF & Accurate Channel/Bank Naming)**: Given any generated fishing spot report and its 1-page PDF export, When the analysis and PDF are built, Then:
  - Each report carries a unique short readable `report_id` (`FS-YYYYMMDD-XXXX`), the single-source-of-truth `app_version` from `package.json` (e.g., `v0.2.0`), and a human-friendly `generated_at` timestamp (`DD MMM YYYY, HH:mm`, 24h `en-GB`, e.g., `12 Nov 2026, 13:24`), all displayed in both the report UI and PDF header.
  - The exported PDF filename embeds the `report_id` (`fishing-spot-<water-slug>-<report_id>.pdf`).
  - `GEOGRAPHY, ROADS & SHORE ACCESS` and spot card tactics render cleanly without clipping `Slope:` or tactics lines on dense 6-spot reports.
  - `Channel Bottleneck` uses a tightened opposing-wall probe (`~30m` when vector polygons exist) so wide bends/arms (`>= 60m`) are not misclassified as tight bottlenecks, and shoreline titles use sector-neutral phrasing (`Shoreline Peninsula Point`, `Sheltered Cove`, `Steep Bank Contour`) with relative bank cues instead of misleading `North-Bank` / `West-Bank` prefixes.
- **AC-F02-13 (Flow-Aware Placement, Rating, Tactics & Game Plan)**: Given OSM `waterway=river|stream|canal` segments and DEM elevations for a `bbox`, When `analyzeWaterBodyScreenshot` runs, Then:
  - Flow direction (`flowBearingDeg`, `flowCardinal`, `flowLabel`, `isFlowingWater`, `inflowPoints`) is computed using length-weighted OSM vectors and DEM cross-check (`|Δelev| >= 2m` threshold), while stillwater basins away from scaled inflow plumes (`200m–600m`) remain `stillwater`.
  - On flowing water or inside verified inflow zones, points/channels confirm `current_break` (with downstream-eddy/inflow tie-breaker preference and directional cast/drift tactics citing upstream/downstream flow); on calm stillwater away from inflows, `current_break` is omitted rather than inflated, narrows are titled `Constriction Neck` / `Cove Mouth Pass` with stillwater tactics (never citing `"current edge"`), and `channel_narrowing` spots are capped at max `2` per report when other structures exist.
  - On flowing rivers, `buildDynamicGamePlan` prefers downstream-to-upstream progression among **safe, shore-accessible** spots (terrain safety/slope overrides upstream routing).
- **AC-F02-14 (Sticky Top-Right Actions & Unified Button Hierarchy)**: Given the analysis report modal is open, When scrolling through spot recommendations and regulations, Then the header remains sticky at the top, the action buttons (`PDF Report`, `Map PNG`, `Analyze Another Location`) remain permanently anchored in the top-right corner with Lucide vector icons, and `Analyze Another Location` is styled as the primary oceanic cyan/amber CTA while export buttons follow secondary slate styling.
- **AC-F02-15 (Header GPS Coordinates & Google Maps Link with Copy)**: Given an analyzed sector bounding box, When the analysis header renders, Then it displays the sector center GPS coordinates as a clickable hyperlink opening Google Maps in a new tab (`target="_blank"`), paired with a copy button that copies the coordinates to the clipboard and shows transient `✓ Copied!` confirmation.
- **AC-F02-16 (Card Footer Metadata)**: Given an analysis report modal, When reviewing technical metadata (Version, Date, Report ID, File Name), Then this metadata is rendered inside the dedicated footer at the bottom of the card, keeping the header clean.
