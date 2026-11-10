# F02 — AI Spatial Grid & Fishing Spot Assistant

> **Status**: `Approved`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)

---

## 1. User Story
**As an** angler who has clicked a water body on the map,  
**I want to** configure my 4 fishing parameters so the AI overlays a spatial grid, highlights and pins the Top 3–5 spots, and lets me click any individual grid cell for a sector deep-dive,  
**So that** I get accurate, structure-backed fishing locations tailored to my gear and target species.

## 2. The 4 Core Angler Inputs
Before triggering the AI Spatial Grid analysis, the angler confirms 4 parameters in the drawer/bottom sheet:
1. **Water Type (`waterType`)**: `freshwater` vs. `sea` (auto-detected from the water body, overridable).
2. **Fishing Technique (`fishingType`)**: `spinning`, `feeder_bottom`, `carp`, `float`, `fly`, or `surfcasting`.
3. **Target Fish Species (`targetSpecies`)**: Multi-select from European freshwater/sea species or `any`.
4. **Access Mode (`accessMode`)**: `shore` (bank/beach/pier) vs. `boat` (boat/kayak), plus `season` auto-filled from current date.

## 3. Strictly Structural Prompting & DB Caching ($0 MVP)
- **No Live Weather API Calls in MVP**: To guarantee high cache-hit rates and `$0` operational cost, the AI prompt is strictly structural (water body geometry, OSM shoreline/inflow/island/pier/reed tags, angler's 4 inputs, season, restriction status, and existing community review summaries for that water body).
- **Deterministic Cache (`grid_analyses`)**:
  - Keyed by `query_hash = SHA256(water_body_id + sector_bbox_key + water_type + fishing_type + sorted(target_species) + access_mode + season)`.
  - If a matching analysis exists in PostgreSQL, return the cached spots immediately (`0` LLM tokens consumed).
  - On cache miss, invoke **Google Gemini 2.5 Flash** via the provider-agnostic AI adapter, validate with Zod against `spot-recommendation.schema.json`, persist the analysis and newly discovered `fishing_spots` pins in PostgreSQL, and return the result.

## 4. Two-Level Grid Interaction & Guest vs. Registered Gating
1. **Level 1 — Full-Grid Top 3–5 Recommendations**:
   - The AI highlights the top 3–5 grid cells (`cell_id`, e.g., `C4`, `E2`) on the map and places interactive Spot Pins at their coordinates.
   - **Registered Angler Output**: Full spot title, confidence score, `why_this_spot` structural breakdown, full `tactical_advice` (recommended baits/lures, presentation tips, best time of day), and restriction badges.
   - **Guest Output (Max 2 Analyses)**: Enforced server-side via HTTP-only signed cookie + IP rate limit (`max 2 analyses`). Returns the grid overlay, top spot pin coordinates, spot title, and a truncated basic summary—redacting `tactical_advice` (baits/lures/presentation) and locking spots `#2..#5` details behind a "Register free with Email to unlock full AI tactics & unlimited spots" banner.
2. **Level 2 — On-Demand Single-Cell Micro-Analysis (Registered Users Only)**:
   - A registered angler can click **any individual valid water/shoreline cell** on the grid (e.g., `D5`, even if it wasn't in the Top 5) and click **"Analyze Cell D5"**.
   - The AI returns a targeted micro-analysis explaining how to fish cell `D5` specifically, or why it is secondary compared to the top cells.

## 5. Acceptance Criteria (Given / When / Then)
- **AC-F02-1 (Top 3–5 Grid Recommendations & Persistence)**:
  - *Given* a registered user selects a water body and submits the 4 core inputs,
  - *When* the AI analysis completes,
  - *Then* 3–5 ranked spots are pinned inside valid non-prohibited grid cells on the map and persisted to `fishing_spots` so future registered users see them on water body click.
- **AC-F02-2 (Guest Quota & Basic Output Redaction)**:
  - *Given* an unauthenticated guest user,
  - *When* they run their 1st or 2nd AI analysis, *Then* the API returns only basic spot info (`tactical_advice` redacted);
  - *When* they attempt a 3rd AI analysis, *Then* the API returns `403 GUEST_LIMIT_REACHED` and the UI opens the Email registration modal.
- **AC-F02-3 (Single-Cell Deep-Dive)**:
  - *Given* an active spatial grid on the map for a registered user,
  - *When* the user clicks cell `D5` and requests a sector micro-analysis,
  - *Then* the AI returns a tactical breakdown specific to `D5` (and caches it by `(grid_analysis_id, cell_id)`).
