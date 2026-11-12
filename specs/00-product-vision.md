# 00 — Product Vision & MVP Scope

> **Status**: `Approved`  
> **Owner**: Product / Engineering  
> **Geographic Focus (MVP)**: **Spain (`ES`)** (Embalses, Ríos, Albuferas & Coastal Waters across Spanish Autonomous Communities)  
> **Last Updated**: 2026-11-10

---

## 1. Core MVP Workflow (Guest-Only, Spain Focus, Zero Friction)
The MVP is a streamlined, **100% Guest-accessible** AI visual & geographical fishing advisor focused on **Spain**:

1. **Navigate & Select Exact Map Area (Uncluttered Map)**:
   - The user browses a clean interactive map of Spain (switching freely between **Satellite** — with **IGN PNOA-MA** high-resolution low-glare Spanish orthophotos or **Esri World Imagery** alternate coverage — and **Terrain** topographic contour view; Plain map view is removed) with no pre-cluttered spot chips on screen. Users can pan/zoom directly or use the top search bar (powered by live OpenStreetMap Nominatim geocoding prioritized for Spain) to jump to any Spanish reservoir (*embalse*), river (*río*), lagoon (*albufera*), or coast.
   - Regardless of whether the user captures in **Satellite** or **Terrain** view, the system always captures/stitches **Satellite imagery (`1024×1024`)** for AI visual feature analysis.
   - **Exact Cropped Selection (`1024×1024` High-DPI)**:
     - **Streamlined 1-Click Target Frame Capture**: Anglers frame their water body with the on-screen target reticle box and click the primary CTA `📸 Capture Framed Area` (the obsolete drag-select box has been removed for a cleaner, faster workflow).
     - The UI displays the selected area span (`km × km`) and scale guidance (highlighting the optimal **`0.4–2.5 km`** tactical window for underwater feature extraction).
2. **AI Water Body Recognition + Geographical, Road-Surface, Water-Mask & Restriction Analysis**:
   - **Water Body Identification & Fish Species Roster**: Identifies the official Spanish water body name, municipality, Autonomous Community (*Comunidad Autónoma*), and structured list of **fish species present** via OpenStreetMap Nominatim, Wikipedia Spain (`es.wikipedia.org`) GeoSearch, and the curated Spanish waters database.
   - **Water-Only Containment**: Uses OpenStreetMap water polygons (Overpass API) + Turf.js to restrict AI spot placement strictly to water/shoreline cells and snap/clamp any drifted coordinate out of dry land.
   - **Geographical & Road-Surface Context**: Queries elevation/slope profiles (Terrarium RGB elevation tiles / Open-Meteo 90m DEM) and OSM Overpass `highway` road networks (`asphalt`/`paved` vs. `dirt`/`gravel` track grades) to classify each spot's car, dirt-track, hike-in, or boat-only accessibility.
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
4. **User's Artifact, 1-Page PDF Report & Multi-Water-Body Loop**:
   - The app UI and all tactical/geographical/species descriptions are **entirely in English**; Spanish localization is used **only** inside the **Fishing Regulations & Allowed-Check** section to verify official Spanish permits, *Cotos*, and restricted zones.
   - The annotated screenshot + summary becomes the **user's artifact** (saved in their session/artifact gallery) and can be downloaded both as an **annotated PNG image** and as a **1-page PDF report** combining the gridded screenshot, species roster, terrain/road access, regulations check, spots, and game plan.
   - The user can return to the map at any time to navigate to another Spanish water body and analyze it.
