# F02 — AI Water Body Recognition, Geographical/Terrain Analysis & Annotated Screenshot Artifact

> **Status**: `Approved`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)  
> **Geographic Focus (MVP)**: Spain (`ES`)  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As a** user who has captured a screenshot of a Spanish water body on the map,  
**I want to** initiate an AI analysis that recognizes the name of the water body, evaluates the screenshot image at the selected scale, checks geographical features (altitude, bank steepness, road and shore accessibility), verifies Spanish fishing restrictions (from our DB and live internet sources), and returns my screenshot annotated with an `A1–H8` grid, numbered points (`1–6`), and a complete tactical & regulatory summary,  
**So that** I know exactly where to fish, how to access the shore safely, and whether fishing is permitted.

## 2. AI & Geospatial Analysis Pipeline
1. **Water Body Name & Internet Context Recognition (Spain Focus)**:
   - Queries our curated Spanish water bodies DB (`db/seed/poland-spain-waters.ts`), **Spanish & English Wikipedia GeoSearch + Extracts (`es.wikipedia.org`, `en.wikipedia.org`)**, and **OpenStreetMap Nominatim (`zoom=12–14`)** within the selected `bbox` to identify the official water body name (e.g., *Embalse de Cortes-La Muela*, *Embalse de Tous*, *Río Júcar*, *L'Albufera de Valencia*) and Autonomous Community (*Comunidad Valenciana*, *Aragón*, *Cataluña*, *Extremadura*, *Andalucía*, etc.).
2. **Geographical Features: Altitude, Bank Slope & Road/Shore Accessibility**:
   - Queries the **Open-Meteo 90m DEM Elevation API** across a 9-point matrix (center water surface + North/South/East/West banks) to compute:
     - **Water Altitude (`m` above sea level)**.
     - **Shoreline Steepness / Relief (`Δm`)**: Classifies each sector as `Flat / Gentle Walkable Shore (<15m rise)`, `Moderate Bank Slope (15–50m rise)`, or `Steep Canyon Cliff (>50m rise — boat or hike-in only)`.
   - Queries **OSM Nominatim (`zoom=16–17`)** along the shoreline perimeter to identify actual road and track access (e.g., `CV-428`, `CV-580`, paved roads vs. 4x4 dirt tracks).
3. **Scale-Adaptive Multimodal Image Analysis on the `A1–H8` Grid**:
   - **Tactical / Micro Scale (`< 2.5 km`)**: Analyzes fine terrain features (underwater shelf color changes from tan/green to navy blue, limestone points, bush overhangs, gravel beaches).
   - **Sector / Macro Scale (`> 2.5 km`)**: Judges based on macro features visible at the larger scale (major river bends, tributary bays, island saddles, canyon narrows, highway bridges, and main basin points).
4. **Fishing Restrictions & Regulatory Lookup**:
   - Combines our curated DB + live Wikipedia/OSM detection of **Protected Nature Reserves** (*Parque Natural*, *Reserva Natural*, *Refugio de Pesca*, *Natura 2000*), **Dam/Power Infrastructure Buffers** (*Presa*, *Central Hidroeléctrica*, *Central Nuclear*), and **Spanish Autonomous Community Fishing Laws** (*Licencia de Pesca*, *Coto de Pesca*, *Real Decreto 630/2013* invasive species rules).
5. **Annotated Screenshot & Summary Output**:
   - Draws the `A1–H8` grid and the 6 numbered colored circles (`🔴 1, 2`, `🔵 3, 4`, `🟠 5, 6`) onto the `1024×1024` screenshot image.
   - Outputs:
     - `⛰️ Geography, Altitude & Shore Access`
     - `⚖️ Fishing Regulations & Restrictions Check`
     - `🎯 Where to Fish on the Grid:` (Spots 1–6)
     - `🚗 Best Game Plan for This Area:`
