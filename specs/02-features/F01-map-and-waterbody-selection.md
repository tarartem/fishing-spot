# F01 — Interactive Map & Water Body Selection

> **Status**: `Draft`  
> **Module**: `src/modules/map-grid/`

---

## 1. User Story
**As an** angler,  
**I want to** browse a free interactive map and click or select a water body (lake, river stretch, or coastal area),  
**So that** the system can identify the water body boundaries and overlay a tactical fishing grid.

## 2. Functional Requirements
1. **Free Map Rendering**:
   - Render an interactive 2D/vector map using a $0-cost provider (e.g., MapLibre GL JS or Leaflet with OpenFreeMap / OpenStreetMap tiles).
   - Support geolocation ("Locate Me"), search by water body/place name (via Nominatim/Photon free geocoding), and pan/zoom.
2. **Water Body Selection**:
   - When the user clicks a point on a water body (or draws a bounding box on large rivers/coasts):
     - Query OpenStreetMap / Overpass API (or cached PostGIS water polygons) to resolve the water body geometry (`natural=water`, `waterway=river`, `natural=coastline`).
     - Highlight the selected water body boundary on the map.
3. **Spatial Grid Generation**:
   - Partition the selected water body bounding box into a readable grid (e.g., `8x8` or adaptive cell size between `50m x 50m` and `250m x 250m` depending on water body area).
   - Label rows `A..H` and columns `1..8` (`A1`, `A2`, etc.).
   - Discard cells that have 0% overlap with water/shoreline.
   - Classify remaining cells (`shoreline`, `open_water`, `inflow_outflow`, `island_structure`).

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F01-1 (Water Body Click)**:
  - *Given* the map is displayed at zoom level >= 11,
  - *When* the user clicks on a lake, river, or coastal water area,
  - *Then* the system highlights the water body polygon and displays its name and water type (Freshwater vs. Sea).
- **AC-F01-2 (Grid Overlay)**:
  - *Given* a water body is selected,
  - *When* the user triggers "Generate Fishing Grid",
  - *Then* the map renders labeled grid cells (`A1..Zn`) strictly covering the water body and its immediate shoreline.
- **AC-F01-3 (Non-Water Click Handling)**:
  - *Given* the user clicks on dry land far (>100m) from any water body,
  - *When* the system checks for water features,
  - *Then* it displays a friendly prompt asking the user to select a lake, river, or coastline.
