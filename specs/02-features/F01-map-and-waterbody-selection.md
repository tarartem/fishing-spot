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
     - **Zoom Ceiling & Dark Screen Prevention**: `maxzoom: 17` is specified on the OpenTopoMap raster source to permit clean MapLibre tile overzooming. When in `Terrain` mode, the map dynamically sets `map.setMaxZoom(17.2)` to eliminate `#071722` dark screen dropouts. When switching back to `Satellite`, `map.setMaxZoom(20)` is restored.
     - **Max Terrain Zoom Toast**: When zoom reaches `≥ 16.8` in `Terrain` mode, an unobtrusive toast notifies the angler: *"⛰️ Maximum terrain detail reached · Switch to Satellite for closer zoom"*.
   - **Plain Map Removed**: The `plain` OpenFreeMap street style is obsolete and removed from `MapStyleMode` and the UI switcher.

2. **Clean Map Screen & Dual Search (GPS Coordinates & Nominatim)**:
   - No pre-populated floating spot/water-body chip bars clutter the map canvas.
   - **GPS Coordinate Parsing**: When a user enters raw latitude/longitude coordinates (decimal degrees e.g. `39.248, -0.935`, space-separated `39.248 -0.935`, or DMS formats) in the top search bar, the app parses the coordinates client-side and immediately flies the map (`map.flyTo`) directly to that location with zero network latency and zero external API dependencies.
   - **Place Name Search**: When non-coordinate text is entered, the search checks curated Spanish water bodies first, followed by **OpenStreetMap Nominatim** (`countrycodes=es`), flying directly to the matching water body or town.

3. **Streamlined 1-Click Framed Area Selection (Always-Satellite `1024×1024` with Terrain Preview Option)**:
   - **Single Floating Primary CTA (`🎯 Select This Area`)**: The obsolete "Draw Custom Area" drag-box overlay and dark box wrapper around the button have been removed. Anglers pan/zoom the map to position their target water body within the on-screen square reticle (`Frame your fishing area`) and click the cleanly floating green button **Select This Area**.
   - **Always-Satellite Guarantee & Imagery Selection**:
     - By default, the compositor captures/stitches crisp satellite tiles for `bbox` (IGN PNOA HD or Esri World).
     - In the preview modal, the imagery switcher includes `[🛰️ IGN PNOA HD]`, `[🌍 Esri World]`, and `[⛰️ Terrain]`, allowing anglers to toggle between aerial views and topographic contours on demand.
   - **Water-Clarity / Glare Hint**: If bright specular glare is detected over water pixels, the UI suggests switching between `IGN PNOA HD` and `Esri Alt` for clearer underwater shelf visibility.

4. **Smart Scale Classification & 1-Click "Optimize Area"**:
   - Replaces technical math dimensions (`7.5 × 7.5 km (~7.35 m/px)`) with intuitive angler status categories:
     - **🟢 Optimal**: Ideal tactical resolution (`0.4–1.8 km`) for shoreline points, weed edges, drop-offs, and bottom structure.
     - **🟡 Too tight**: View is zoomed in too close (`< 0.35 km`) — road access, trails, and surrounding water structure are cut off.
     - **🟠 Wide area**: View is too wide (`> 1.8 km`) — fine structures like weed lines, brush cover, and shallow drop-offs cannot be resolved.
   - **1-Click Optimize Area Action**: When the selection is `Too tight` or `Wide area`, an **"✨ Optimize Area"** button is surfaced. Clicking it instantly re-centers and resizes the crop to the optimal tactical scale (`~1.0 km × 1.0 km`), re-renders the gridded preview, and provides a **"↩️ Revert to Original Area"** undo button.

---

## 3. Testable Acceptance Criteria (Given / When / Then)
- **AC-F01-1 (No Plain Map)**: Given the map screen loads, When inspecting the map style switcher, Then only `Satellite` and `Terrain` modes are available (no `Plain Map` button).
- **AC-F01-2 (Satellite Source Switch)**: Given `Satellite` mode is active, When the user toggles between `IGN PNOA (Spain HD)` and `Esri (Alt)`, Then the map tile source switches without losing the current map center/zoom.
- **AC-F01-3 (Terrain Zoom Cap & Toast)**: Given `Terrain` mode is active, When zooming in, Then MapLibre enforces `maxZoom = 17.2` (preventing black screen), OpenTopoMap source overzooms, and reaching zoom `≥ 16.8` displays the maximum terrain toast.
- **AC-F01-4 (Smart Scale Classification & Optimize Action)**: Given the preview modal opens, Then the scale is classified as `Optimal`, `Too tight`, or `Wide area`, and if not optimal, an `✨ Optimize Area` button auto-adjusts to optimal scale (~1 km span) with an immediate `↩️ Revert` option.
- **AC-F01-5 (GPS Coordinate Search Parsing)**: Given a user inputs valid GPS coordinates into the search bar (e.g., `39.248, -0.935` or `39.248 -0.935`), When the search is submitted, Then the map immediately flies to those exact coordinates without sending an external Nominatim network request.
- **AC-F01-6 (Floating CTA Select This Area)**: Given the main map view is loaded, When checking the capture controls, Then `🎯 Select This Area` is the single prominent floating primary CTA without a surrounding black container box.
- **AC-F01-7 (Terrain in Preview Imagery Selector)**: Given the Selected Area Preview modal is open, When inspecting the imagery selector, Then `IGN PNOA HD`, `Esri World`, and `Terrain` are all selectable.
