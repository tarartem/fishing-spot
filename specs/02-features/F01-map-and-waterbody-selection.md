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

2. **Clean Map Screen (No Suggested Spot Chips)**:
   - No pre-populated floating spot/water-body chip bars clutter the map canvas.
   - Users navigate freely by panning/zooming or using the top search bar, which queries **OpenStreetMap Nominatim** (prioritizing Spain `countrycodes=es`) and flies the map directly to the selected result.

3. **Always-Satellite `1024×1024` Capture (Regardless of Active UI View)**:
   - **Primary — Manual Drag-Box Selection (`✂️ Select Area (Drag Box)`)**: User drags a custom rectangle over the exact water body sector. Both the screenshot pixels and geographic `bbox` (`map.unproject`) are cropped strictly to that rectangle.
   - **Secondary — Target Frame Capture (`📸 Capture Framed Box`)**: Crops strictly to the on-screen square target reticle (`reticleRef.current.getBoundingClientRect()`).
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
