# F01 — Interactive Map (Satellite / Terrain), Multi-Source Imagery & Exact Screenshot Selection

> **Status**: `Implemented`  
> **Module**: `src/modules/map-grid/`  
> **Geographic Focus (MVP)**: Spain (`ES`)  
> **Last Updated**: 2026-11-11

---

## 1. User Story
**As a** user (Guest) exploring fishing waters in Spain,  
**I want to** navigate an uncluttered interactive map (switching between Satellite and Terrain views, and toggling between high-resolution Spanish PNOA orthophotos and Esri World Imagery when water glare appears) to any Spanish water body of my choice, select the exact area on the map, and capture a crisp satellite screenshot even if I was browsing in Terrain mode,  
**So that** I can evaluate terrain contours while browsing and still give the AI clear, glare-free satellite water imagery at the optimal scale.

---

## 2. Functional Requirements
1. **2-Mode Map Style Switcher (`Satellite` | `Terrain`) — Plain Map Removed**:
   - **`🛰️ Satellite` (Default)**: Displays high-resolution aerial imagery with a quick satellite provider selector:
     - **`IGN PNOA (Spain HD)`** (`https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg`) — free Spanish government `25–50 cm` orthophotos flown under strict sun-angle (`≥40°`) guidelines to minimize water glare, falling back to 10m Sentinel-2 at lower zooms / outside Spain.
     - **`Esri World Imagery (Alt)`** (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`) — alternate flight date / sun angle / reservoir water level when PNOA has glare, cloud, or outside-Spain coverage.
   - **`⛰️ Terrain`**: Displays **OpenTopoMap** topographic contours, elevation lines, and road/track classifications for assessing shore steepness and vehicle approaches.
   - **Plain Map Removed**: The `plain` OpenFreeMap street style is obsolete and removed from `MapStyleMode` and the UI switcher.

2. **Clean Map Screen & Dual Search (GPS Coordinates & Nominatim)**:
   - No pre-populated floating spot/water-body chip bars clutter the map canvas.
   - **GPS Coordinate Parsing**: When a user enters raw latitude/longitude coordinates (decimal degrees e.g. `39.248, -0.935`, space-separated `39.248 -0.935`, or DMS formats) in the top search bar, the app parses the coordinates client-side and immediately flies the map (`map.flyTo`) directly to that location with zero network latency and zero external API dependencies.
   - **Place Name Search**: When non-coordinate text is entered, the search checks curated Spanish water bodies first, followed by **OpenStreetMap Nominatim** (`countrycodes=es`), flying directly to the matching water body or town.

3. **Streamlined 1-Click Framed Area Capture (Always-Satellite `1024×1024`)**:
   - **Single Primary Action (`📸 Capture Framed Area`)**: The obsolete "Draw Custom Area" drag-box overlay has been removed to streamline the workflow into a single, intuitive 1-click capture. Anglers pan/zoom the map to position their target water body within the on-screen square reticle (`Frame your fishing area`) and click **Capture Framed Area**.
   - **Always-Satellite Guarantee**:
     - If the user is in `Satellite` mode, the compositor captures/stitches crisp satellite tiles for `bbox` (and can enhance water-feature contrast).
     - If the user is in `Terrain` mode when capturing, the compositor **stitches the corresponding Satellite tiles** (`IGN PNOA` or `Esri`, matching the user's selected satellite source) onto the `1024×1024` canvas for AI analysis, while optionally preserving the terrain metadata context.
   - **Water-Clarity / Glare Hint**: When zoomed tightly (`< 0.35 km` span) or if bright specular glare is detected over water pixels, the UI suggests switching between `IGN PNOA (Spain HD)` and `Esri (Alt)` for clearer underwater shelf visibility.

4. **Optimal Scale Guidance & Screenshot Preview**:
   - Computes the selected sector span (`widthKm × heightKm`) and classifies scale quality:
     - **Optimal Tactical Scale (`0.4–2.5 km`, Zoom `~14.5–16.5`)**: Best balance of underwater shelf color transitions, shoreline cover, and perimeter road/track context (`50–310m` per `A1–H8` cell).
     - **Over-Zoomed Warning (`< 0.35 km`)**: Warns that very tight zoom loses road context and increases wave/glare noise; recommends zooming slightly out or switching satellite source.
     - **Sector Scale (`2.5–8 km`)** & **Wide Basin Scale (`> 8 km`)**: Guides the user that AI will evaluate macro channel bends, peninsulas, and bay mouths.
   - Immediately displays the captured `A1–H8` gridded satellite screenshot, scale quality badge, and optional gear/target-species input before clicking **"Analyze with AI"**.

---

## 3. Testable Acceptance Criteria (Given / When / Then)
- **AC-F01-1 (No Plain Map)**: Given the map screen loads, When inspecting the map style switcher, Then only `Satellite` and `Terrain` modes are available (no `Plain Map` button).
- **AC-F01-2 (Satellite Source Switch)**: Given `Satellite` mode is active, When the user toggles between `IGN PNOA (Spain HD)` and `Esri (Alt)`, Then the map tile source switches without losing the current map center/zoom.
- **AC-F01-3 (Always-Satellite Capture from Terrain View)**: Given the user switches the map to `Terrain` view and captures an area, When the screenshot preview opens, Then the captured `1024×1024` image sent for AI analysis is **Satellite imagery** (stitched for the exact `bbox`), never a plain/topo-only drawing.
- **AC-F01-4 (Optimal Scale Guidance)**: Given the user selects a sector `< 0.35 km` or `> 8 km`, When the preview opens, Then the scale banner surfaces clear scale guidance (`Optimal 0.4–2.5 km` vs. `Over-Zoomed` vs. `Wide Basin`).
- **AC-F01-5 (GPS Coordinate Search Parsing)**: Given a user inputs valid GPS coordinates into the search bar (e.g., `39.248, -0.935` or `39.248 -0.935`), When the search is submitted, Then the map immediately flies to those exact coordinates without sending an external Nominatim network request.
- **AC-F01-6 (Single Primary Capture & Draw Custom Area Removed)**: Given the main map view is loaded, When checking the capture controls, Then `📸 Capture Framed Area` is the single prominent primary CTA, and no `Draw Custom Area` button or drag overlay exists.
