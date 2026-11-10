# F01 — Interactive Map (Satellite / Terrain / Plain) & Screenshot Area Selection

> **Status**: `Approved`  
> **Module**: `src/modules/map-grid/`  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As a** user (Guest),  
**I want to** navigate an interactive map (switching between Satellite, Terrain, and Plain map styles) to any water body of my choice, select the area on the map to create a screenshot, and see that screenshot on my screen before initiating AI analysis,  
**So that** I can visually frame the exact water body sector I want to fish.

## 2. Functional Requirements
1. **Map Style Switcher (`Satellite` | `Terrain` | `Plain`)**:
   - Users can switch at any time between **Satellite** (ESRI World Imagery aerial view), **Terrain** (OpenTopoMap elevation & contours), and **Plain** (OpenFreeMap street/water vector map).
2. **Free Map Navigation & Location Search**:
   - Search bar and quick-jump buttons allow navigating to any water body or city (e.g., Valencia / Embalse de Cortes / Playa del Ral, Embalse de Tous, Ebro, Warsaw / Jezioro Zegrzyńskie).
3. **Area Selection & Screenshot Capture**:
   - **Option A — 1-Click Capture**: Click **"Capture Selected Area"** to snapshot the currently framed water body area on the map.
   - **Option B — Drag-to-Select Box**: Activate **"Drag Box on Map"** to draw a custom selection rectangle over the water body and capture that cropped area.
4. **Screenshot Preview**:
   - Immediately displays the captured screenshot on the screen so the user can inspect it and click **"Analyze with AI"**.
