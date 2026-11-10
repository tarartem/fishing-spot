# F01 — Interactive Map (Satellite / Terrain / Plain) & Exact Screenshot Area Selection

> **Status**: `Approved`  
> **Module**: `src/modules/map-grid/`  
> **Geographic Focus (MVP)**: Spain (`ES`)  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As a** user (Guest) exploring fishing waters in Spain,  
**I want to** navigate an uncluttered interactive map (switching between Satellite, Terrain, and Plain map styles) to any Spanish water body of my choice, select the exact area on the map to create a high-resolution screenshot, and see that screenshot on my screen before initiating AI analysis,  
**So that** I can visually frame the exact water body sector I want to fish without clutter or viewport distortion.

## 2. Functional Requirements
1. **Map Style Switcher (`Satellite` | `Terrain` | `Plain`)**:
   - Users can switch at any time between **Satellite** (ESRI World Imagery aerial view), **Terrain** (OpenTopoMap elevation & contours), and **Plain** (OpenFreeMap street/water vector map).
2. **Clean Map Screen (No Suggested Spot Chips)**:
   - No pre-populated floating spot/water-body chip bars clutter the map canvas.
   - Users navigate freely by panning/zooming or using the top search bar, which queries **OpenStreetMap Nominatim** (prioritizing Spain `countrycodes=es`, e.g., *Embalse de Cortes*, *Embalse de Tous*, *Mequinenza*, *Albufera de Valencia*, *Embalse de Buendía*, *Embalse de Cijara*) and flies the map directly to the selected result.
3. **Exact Cropped Area Selection & High-Resolution (`1024×1024`) Screenshot Capture**:
   - **Primary — Manual Drag-Box Selection (`✂️ Select Area (Drag Box)`)**: User drags a custom rectangle over the exact water body sector on the map. Both the screenshot pixels and the geographic `bbox` (`map.unproject`) are cropped strictly to that drawn rectangle.
   - **Secondary — Target Frame Capture (`📸 Capture Framed Box`)**: Crops strictly to the on-screen square target reticle (`reticleRef.current.getBoundingClientRect()`), never the full wide browser window.
   - **Capture Quality & Scale Indicator**: Captures at `1024×1024` High-DPI resolution and computes the selected sector span (`widthKm × heightKm`), displaying whether the capture is **High-Detail Tactical Scale (`< 2.5 km`)**, **Sector Scale (`2.5–8 km`)**, or **Wide Basin Scale (`> 8 km`)**.
4. **Screenshot Preview**:
   - Immediately displays the captured `A1–H8` gridded screenshot and area scale badge so the user can inspect it, optionally enter their lures/target species, and click **"Analyze with AI"**.
