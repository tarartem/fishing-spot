# F02 — AI Water Body Recognition, Image Analysis & Annotated Screenshot Artifact

> **Status**: `Approved`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As a** user who has captured a screenshot of a water body on the map,  
**I want to** initiate an AI analysis that recognizes the name of the water body, analyzes the screenshot image and internet data, and returns my screenshot annotated with an `A1–H8` grid, numbered points (`1–6`), a detailed spot-by-spot summary (`🎯 Where to Fish on the Grid`), and a step-by-step route (`🚗 Best Game Plan for This Area`),  
**So that** I keep a complete visual and tactical artifact for my fishing trip and can then navigate to analyze other water bodies.

## 2. AI Analysis Pipeline
1. **Water Body Name & Internet Context Recognition**:
   - Queries OpenStreetMap / Overpass / Nominatim using the selected map bounding box + Gemini 2.5 Flash vision/search grounding to identify the water body name (e.g., *Embalse de Cortes de Pallás — Cofrentes, Valencia*) and local shore landmarks (e.g., *Playa del Ral*, *Dehesa de Cortes*, *Carpa Cofrentes*).
2. **Multimodal Image Analysis on the `A1–H8` Grid**:
   - Overlays the `8×8` coordinate grid (`A1..H8`) onto the captured screenshot.
   - Analyzes shoreline color transitions (shallow tan/green shelves dropping into deep navy water), peninsula tips, sheltered coves, road/track access, and canyon bottlenecks.
3. **Annotated Screenshot & Summary Output**:
   - Draws the `A1–H8` grid and the 6 numbered colored circles (`🔴 1, 2`, `🔵 3, 4`, `🟠 5, 6`) directly onto the screenshot image.
   - Produces the structured summary:
     - `🎯 Where to Fish on the Grid:` (Spots 1–6 with grid cells, trophy badges, why it's great, terrain/fish behavior, and how to fish it).
     - `🚗 Best Game Plan for This Area:` (Step-by-step parking, walking, and casting plan).
4. **User Artifact Persistence**:
   - Saves the annotated screenshot + summary as the user's artifact (downloadable as PNG and accessible in **My Artifacts** while browsing other water bodies).
