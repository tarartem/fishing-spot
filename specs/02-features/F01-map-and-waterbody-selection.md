# F01 — Full-Screen Map, Water Body Selection & Spatial Grid

> **Status**: `Approved`  
> **Module**: `src/modules/map-grid/`

---

## 1. User Story
**As an** angler (guest or registered),  
**I want to** open a full-screen interactive map, click on a water body (lake, river, reservoir, or coastal shoreline in Poland, Spain, or across Europe), see its description and (if registered) existing spots, and generate an adaptive spatial grid,  
**So that** I can immediately understand the water body and prepare a tactical fishing sector.

## 2. UI/UX Layout Specification
- **Full-Screen Map-First Interface**:
  - `100vw x 100vh` **MapLibre GL JS** canvas using free **OpenFreeMap / OpenStreetMap** vector tiles.
  - **Floating Top Search & Filter Bar**: Search water bodies/locations by name (via free Nominatim/Photon geocoding) + quick "Locate Me" GPS button + User Auth indicator.
  - **Responsive Contextual Panel**:
    - **Desktop**: Collapsible slide-over drawer (`420px` width) on the left/right.
    - **Mobile**: Swipeable bottom sheet (`collapsed` / `half` / `expanded`).

## 3. Water Body Click & Selection Behavior
1. **Resolving the Water Body**:
   - When the user clicks `[lat, lng]` on the map:
     - Check PostgreSQL (`water_bodies`) for an existing cached polygon containing `[lat, lng]`.
     - On cache miss, query **Overpass API** for the enclosing or nearest water feature (`natural=water`, `water=*`, `waterway=river|canal`, `natural=coastline`) within `100m`.
     - Highlight the water body boundary on the map.
2. **Tiered Data Display on Click**:
   - **Both Guest & Registered**: Display water body name, auto-detected water type (`freshwater` vs `sea`), country/region (`PL`, `ES`, etc.), general water body description, and restriction overview.
   - **Registered Users Only**: Immediately load and render all **existing / pre-seeded Water Body Spot Pins** on the map along with their average star ratings and community review counts.
   - **Guests**: Do **not** receive or render pre-seeded spot pins; see a prompt inviting them to run one of their 2 free basic AI analyses or register with Email for full spot access.
3. **Adaptive Spatial Grid Sizing (`Turf.js`)**:
   - **Small/Medium Lakes (`max_dimension < 5km`)**: Generate a grid over the entire water body bounding box.
   - **Large Reservoirs, Long Rivers (e.g. Vistula, Ebro), or Sea Coastlines (`max_dimension >= 5km`)**: Clip the water body polygon to the current map viewport or a `~2.5km` radius tactical sector centered on the user's clicked point so every grid cell remains tactical (`100m–300m` cell width).
   - Label rows `A..H` and columns `1..8` (e.g., `A1..H8`), discarding dry-land-only cells (`0%` water/shoreline intersection).

## 4. Acceptance Criteria (Given / When / Then)
- **AC-F01-1 (Water Body Click — Registered vs. Guest)**:
  - *Given* a water body has 3 existing spot pins in the database,
  - *When* a **registered user** clicks the water body, *Then* the water body boundary, description, and all 3 spot pins are displayed on the map;
  - *When* a **guest user** clicks the same water body, *Then* only the water body boundary and general description are displayed (0 pre-seeded pins shown).
- **AC-F01-2 (Adaptive Tactical Sector Grid)**:
  - *Given* the user selects a small lake (`< 5km`), *When* the grid is built, *Then* it covers the entire lake;
  - *Given* the user clicks a point on a 500km river (e.g., Vistula or Ebro) or sea coast, *When* the grid is built, *Then* it clips a `~2.5km` radius tactical sector around the clicked point with cell sizes between `100m` and `300m`.
- **AC-F01-3 (Land Click Rejection)**:
  - *Given* the user clicks dry land `> 100m` from any water feature,
  - *When* Overpass/PostGIS finds no water body,
  - *Then* the UI shows a non-blocking toast prompting the angler to click a lake, river, reservoir, or coastline.
