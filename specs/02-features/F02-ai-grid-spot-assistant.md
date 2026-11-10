# F02 — AI Spatial Grid & Exact Spot Assistant

> **Status**: `Approved`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)

---

## 1. User Story
**As a** registered angler who has selected a water body on the map,  
**I want to** configure my 4 fishing parameters so the AI overlays a spatial grid (`A1..H8`), pins the exact Top 3–5 fishing spots with tactical descriptions, and lets me click any individual grid cell for a sector deep-dive,  
**So that** I know the exact spots on the water body where I should go fishing.

## 2. Tiered AI Capabilities: Guest vs. Registered
1. **Guest Tier (Basic Water Body Info Only — Max 2 Runs)**:
   - Guests clicking an already-seeded Water Body Pin read its cached basic description, catchable fish list, and teaser feedback for free (`0` AI calls).
   - If a guest selects a water body and runs an AI analysis (limited to **2 runs max**), the API only returns **basic water-body-level info** (general description of the water body and what fish species can be caught there) + the **Registration CTA**.
   - **Exact fishing spots on the spatial grid (`A1..H8`) and tactical descriptions are strictly reserved for Registered Users.**
2. **Registered Tier (Full Spatial Grid & Exact Spots — Unlimited)**:
   - Unlocks the **Spatial Grid overlay (`A1..H8`)** on the map.
   - Unlocks the **4 Core Angler Inputs**:
     1. **Water Type (`waterType`)**: `freshwater` vs. `sea` (auto-detected, editable).
     2. **Fishing Technique (`fishingType`)**: `spinning`, `feeder_bottom`, `carp`, `float`, `fly`, or `surfcasting`.
     3. **Target Fish Species (`targetSpecies`)**: Multi-select from European freshwater/sea species or `any`.
     4. **Access Mode (`accessMode`)**: `shore` vs. `boat` (+ `season` auto-filled).
   - **Level 1 Grid Output**: Highlights and pins the **Top 3–5 exact fishing spots** inside valid grid cells with full descriptions (`why_this_spot`, `tactical_advice`: baits/lures, presentation, best time of day, and restriction status).
   - **Level 2 Single-Cell Micro-Analysis**: Registered anglers can click any individual grid cell (e.g., `D5`) for an on-demand AI deep-dive of that sector.

## 3. Strictly Structural Prompting & DB Caching ($0 MVP)
- Keyed in `grid_analyses` by `query_hash = SHA256(water_body_id + sector_bbox_key + water_type + fishing_type + sorted(target_species) + access_mode + season)`.
- Cache hits cost `0` LLM tokens; cache misses invoke **Google Gemini 2.5 Flash**, validate against `spot-recommendation.schema.json`, and persist the discovered spots.

## 4. Acceptance Criteria (Given / When / Then)
- **AC-F02-1 (Guest Cannot Access Grid Spots)**:
  - *Given* an unauthenticated guest user clicks a water body or runs one of their 2 basic AI checks,
  - *When* the response is rendered,
  - *Then* the user sees only the basic water body description, fish species available, sample feedback, and the Registration CTA; no spatial grid or exact spot coordinates are returned.
- **AC-F02-2 (Registered User Unlocks Grid & Exact Spots)**:
  - *Given* a registered user selects a water body and submits the 4 core inputs,
  - *When* the AI analysis completes,
  - *Then* the spatial grid (`A1..H8`) and 3–5 exact fishing spot pins are rendered on the map with full tactical descriptions.
- **AC-F02-3 (Single-Cell Deep-Dive for Registered Users)**:
  - *Given* an active spatial grid on the map for a registered user,
  - *When* the user clicks cell `D5` and requests a sector micro-analysis,
  - *Then* the AI returns a tactical breakdown specific to `D5`.
