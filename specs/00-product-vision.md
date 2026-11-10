# 00 — Product Vision & MVP Scope

> **Status**: `Approved`  
> **Owner**: Product / Engineering  
> **Geographic Focus (MVP)**: **Spain (`ES`)** (Embalses, Ríos, Albuferas & Coastal Waters across Spanish Autonomous Communities)  
> **Last Updated**: 2026-11-10

---

## 1. Core MVP Workflow (Guest-Only, Spain Focus, Zero Friction)
The MVP is a streamlined, **100% Guest-accessible** AI visual & geographical fishing advisor focused on **Spain**:

1. **Navigate & Select Exact Map Area (Uncluttered Map)**:
   - The user browses a clean interactive map of Spain (switching freely between **Satellite**, **Terrain**, and **Plain** map views) with no pre-cluttered spot chips on screen. Users can pan/zoom directly or use the top search bar (powered by live OpenStreetMap Nominatim geocoding prioritized for Spain) to jump to any Spanish reservoir (*embalse*), river (*río*), lagoon (*albufera*), or coast.
   - **Exact Cropped Selection (`1024×1024` High-DPI)**:
     - **Primary Mode — Manual Drag-Box Selection**: The user drags a rectangle directly over the exact water body sector they want to fish.
     - **Secondary Mode — Target Frame Capture**: Clicking the 1-click capture button crops strictly to the on-screen target reticle box (never the full wide viewport).
     - The UI displays the selected area span (`km × km`) and guides the user if a wide area is selected while still supporting both zoomed-in tactical analysis and macro basin analysis.
2. **AI Water Body Recognition + Geographical, Image & Restriction Analysis**:
   - **Water Body Identification**: Identifies the official Spanish water body name, municipality, and Autonomous Community (*Comunidad Autónoma*) via OpenStreetMap Nominatim, Wikipedia Spain (`es.wikipedia.org`) GeoSearch, and the curated Spanish waters database.
   - **Geographical & Topographical Context**: Queries 90m DEM elevation data (`Open-Meteo Elevation API`) and OSM perimeter road networks to determine water altitude (`m` ASL), bank slope steepness (`Flat Walkable Shore` vs. `Moderate Slope` vs. `Steep Canyon Cliff`), and road/track accessibility (*CV-*, *N-*, *A-* roads and dirt tracks).
   - **Spain Fishing Regulations & Restricted Area Check**: Checks our curated Spanish regulatory DB + live Wikipedia/OSM protected area & infrastructure lookups (*Parque Natural*, *Reserva Natural*, *Refugio de Pesca*, *Coto de Pesca*, *Presa / Central Hidroeléctrica / Central Nuclear* safety exclusion zones, and *Real Decreto 630/2013* invasive species regulations) alongside autonomous community license rules (*Licencia de Pesca Continental / Marítima*).
3. **Annotated Grid Screenshot + Tactical Summary**:
   - The user receives the **annotated `1024×1024` screenshot** of the exact selected map area with the **`A1–H8` grid** and **6 numbered, color-coded spot points (`1–6`)** drawn directly on the image:
     - 🔴 **Spots 1 & 2 (Red)**: Primary Trophy Points & Transition Lines (`🏆`)
     - 🔵 **Spots 3 & 4 (Blue)**: Sheltered Bays & Direct Car/Beach Access Coves
     - 🟠 **Spots 5 & 6 (Orange)**: Canyon S-Bends, Bottlenecks & Gateway Points
   - Alongside the screenshot, the user receives:
     - `⛰️ Geography, Altitude & Shore Access` (Elevation in `m`, bank slope profile, detected road access, and scale mode).
     - `⚖️ Spain Fishing Regulations & Restrictions Check` (Status badge, required Autonomous Community license / Coto rules, prohibited dam/reserve sectors, and legal disclaimer).
     - `🎯 Where to Fish on the Grid:` (Spot 1 through Spot 6 describing why it's great, terrain/accessibility, and how to fish it).
     - `🚗 Best Game Plan for This Area:` (Step-by-step parking, walking, and fishing sequence across accessible grid cells).
4. **User's Artifact & Multi-Water-Body Loop**:
   - The annotated screenshot + summary becomes the **user's artifact** (saved in their session/artifact gallery and downloadable as a PNG image).
   - The user can return to the map at any time to navigate to another Spanish water body and analyze it.
