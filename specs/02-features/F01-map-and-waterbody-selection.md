# F01 — Full-Screen Map (Satellite / Terrain / Plain), Water Body Pins & Visual Grid

> **Status**: `Approved`  
> **Module**: `src/modules/map-grid/`  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As a** guest or registered angler,  
**I want to** freely browse an interactive map (switching between **Satellite**, **Terrain**, and **Plain** map views), see water bodies marked with geospatial pins (e.g., around Valencia, Ebro, or Warsaw), click a pin as a guest to read basic info, and as a registered user see the water body overlaid with an `A1–H8` coordinate grid, numbered fishing spot points (`1–6`), and a feature legend,  
**So that** I can visually locate the exact points on the water body where I should fish.

## 2. Map Layer Switcher (`Satellite` | `Terrain` | `Plain`)
The user can switch between three `$0`-cost map styles at any time via a floating map-layer switcher control:
1. **Satellite (`satellite`)**: High-resolution aerial/satellite imagery (ESRI World Imagery tiles) ideal for inspecting shorelines, submerged points, islands, coves, and vegetation (as shown in the reference screenshots).
2. **Terrain (`terrain`)**: Topographic & hillshade map (OpenTopoMap / terrain tiles) showing elevation contours, steep banks, and mountain access roads.
3. **Plain (`plain`)**: Clean vector street/water map (OpenFreeMap Liberty / OpenStreetMap standard view) for clear road and town navigation.

## 3. Geospatial Water Body Pins (Guest & Registered)
- Water bodies are marked directly on the MapLibre map at their true `[centerLng, centerLat]` coordinates with interactive map pins showing the water body name and rating.
- Users can freely pan and zoom around any region—for example, studying the map around **Valencia, Spain** (*Embalse de Cortes de Pallás / Cofrentes*, *Embalse de Tous*, *Embalse de Benagéber*, *Albufera / Cullera*) or **Poland** (*Jezioro Zegrzyńskie*, *Wisła*, *Zatoka Gdańska*)—and click any Water Body Pin on the map.
- **Guest Click on Water Body Pin**:
  - Opens the basic water body overview (description, catchable fish species, teaser feedback, and Email Registration Call to Action).
  - Does **not** display the `A1–H8` grid or the numbered fishing spot markers (`1–6`).

## 4. Registered User: On-Map `A1–H8` Grid & Numbered Spot Points (`1–6`)
When a **Registered User** clicks a Water Body Pin:
1. **Satellite / Map Framing**: The map flies to frame the water body (or displays the tactical water body grid view).
2. **8x8 Visual Coordinate Grid (`A1` to `H8`)**:
   - Columns are labeled **`A` through `H`** (left to right, West to East).
   - Rows are labeled **`1` through `8`** (top to bottom, North to South):
     - Row 1: `A1, B1, C1, D1, E1, F1, G1, H1`
     - Row 2: `A2, B2, C2, D2, E2, F2, G2, H2`
     - ...
     - Row 8: `A8, B8, C8, D8, E8, F8, G8, H8`
   - Each cell displays its label (`A1..H8`) in the top-left corner of the grid square over the satellite/map imagery.
3. **Numbered Spot Markers (`1` to `6`) & Feature Legend**:
   - Exact fishing spots are plotted at their true coordinates inside the water body as numbered circular markers (`1`, `2`, `3`, `4`, `5`, `6`), color-coded by spot category:
     - **Red (`#ef4444`) — Primary Hot Spot (Ranks 1–2)**: High-probability structural ambush points (e.g., submerged islands, main channel rocky points, primary drop-offs).
     - **Amber / Orange (`#f59e0b`) — Secondary Structure Spot (Ranks 3–4)**: Underwater ledges, secondary points, and transition shelves.
     - **Blue (`#38bdf8`) — Shore / Cove Access Spot (Ranks 5–6)**: Accessible bank beaches, sheltered coves, inflow mouths, and carp/feeder bays.
   - A **Spot Features Legend** accompanies the grid, listing each numbered point (`1–6`), its grid cell (`e.g., F6, E2, C7`), structural feature tags, and tactical summary.

## 5. Acceptance Criteria (Given / When / Then)
- **AC-F01-1 (Map Style Switcher)**:
  - *Given* any user is viewing the map,
  - *When* they click `Satellite`, `Terrain`, or `Plain` in the map switcher,
  - *Then* the map base layer immediately updates to the selected style.
- **AC-F01-2 (Free Map Browsing with Geospatial Water Body Pins)**:
  - *Given* a guest user pans/zooms the map (e.g., around Valencia, Spain),
  - *When* they view the map,
  - *Then* water bodies are marked with clickable pins on the map, and clicking a pin shows basic water body info, fish species, teaser feedback, and a registration CTA.
- **AC-F01-3 (Registered User Visual Grid A1–H8, Numbered Points 1–6 & Legend)**:
  - *Given* a registered user clicks a Water Body Pin,
  - *When* the water body loads,
  - *Then* the `A1–H8` grid (columns `A..H`, rows `1..8`), numbered circular spot points (`1..6`) positioned inside the water body, and the Spot Features Legend are displayed.
