---
name: ai-grid-prompting
description: >-
  Guides the design, refinement, and evaluation of the spatial grid and AI
  fishing spot recommendation system. Activate this skill when working on map
  grid generation, AI prompt engineering in prompts/, or parsing spot
  recommendations onto the map.
---

# AI Spatial Grid & Spot Recommendation Skill

The core innovation of **Fishing Spot** is combining deterministic **spatial grid partitioning** of a selected water body with **AI tactical angling knowledge**.

## Why a Spatial Grid?
LLMs alone frequently hallucinate raw latitude/longitude coordinates (e.g., placing a fishing spot on dry land 500 meters away from the lake). By overlaying a **deterministic coordinate grid** (e.g., cells `A1`, `A2`, `B3` with known water/shoreline intersection metadata) before calling the AI:
1. The system deterministically filters out land-only cells using water body polygons (OpenStreetMap / Overpass API).
2. Each valid cell carries rich context: cell ID, center `[lat, lng]`, distance to shore, shoreline features (inlets, reed beds, piers, drop-offs, river mouths, jetties), and restriction flags.
3. The AI selects the best **Grid Cell IDs** and explains *why* each cell works for the angler's chosen water type, fishing technique, and target fish species.
4. The frontend highlights the recommended grid cells and places pins at verified coordinates within those cells.

## Prompt Engineering Checklist
When editing `prompts/spot-finder-grid.prompt.md` or `src/modules/ai-advisor/`:
1. **Input Context Must Include**:
   - Water body name, type (`freshwater_lake`, `freshwater_river`, `freshwater_pond`, `sea_coastal`, `estuary`), and bounding box.
   - Candidate grid cells (`cell_id`, `center_lat`, `center_lng`, `zone_type`: shoreline / shallow / deep / inflow / structure, `is_restricted`).
   - Angler parameters: Fishing style (e.g., spinning, fly fishing, feeder/carp, surfcasting, boat trolling), target species, access mode (shore/bank vs. boat/kayak), and season/time of day.
2. **Hard Constraints in Prompt**:
   - NEVER recommend a cell where `is_restricted === true` as a fishable spot; instead, surface a warning in the response.
   - If the angler is fishing from the shore (`access_mode: "shore"`), only recommend shoreline-accessible cells or casting-range cells adjacent to shore.
   - Return strictly valid JSON matching `prompts/schemas/spot-recommendation.schema.json`.
3. **Evaluation**:
   - Add test fixtures in `tests/ai-evals/` with real water body grid snapshots to verify JSON schema compliance and zero out-of-bounds/restricted recommendations.
