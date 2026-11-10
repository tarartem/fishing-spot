# F02 — AI Grid & Fishing Spot Assistant

> **Status**: `Draft`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)

---

## 1. User Story
**As an** angler who has selected a water body on the map,  
**I want to** specify my water type, fishing technique, and target fish species so the AI assistant analyzes the spatial grid and pins the best fishing locations with descriptions,  
**So that** I know exactly where to go and how to fish each recommended spot.

## 2. Inputs to the AI Assistant
1. **Selected Water Body Metadata**:
   - Name, water type (`freshwater` / `saltwater`), area/dimensions, geographic region.
2. **Spatial Grid Summary**:
   - List of valid Grid Cells (`cell_id`, `center_lat`, `center_lng`, `zone_type`, OSM shoreline/water features such as piers, reed beds, river bends, inlets, bridges, beaches, rocky outcrops, and `restriction_status`).
3. **Angler Preferences**:
   - **Water Environment**: Sea / Saltwater vs. Freshwater (auto-detected from map, overridable by user).
   - **Fishing Technique**: e.g., Spinning, Feeder/Carp, Fly Fishing, Float, Surfcasting, Boat.
   - **Target Fish Species**: e.g., Pike, Zander, Perch, Carp, Trout, Sea Bass, Bream, etc.
   - **Access Mode**: Shore/Bank vs. Boat/Kayak.
4. **Community Context (Optional Enrichment)**:
   - Aggregated historical catch/review scores for cells on this water body if prior reviews exist.

## 3. Outputs Placed on the Map
1. **Highlighted Grid Cells**: Color-coded by suitability score (e.g., High Probability / Medium / Restricted).
2. **Spot Pins & Tactical Cards**:
   - Pin placed at `[lat, lng]` inside the recommended Grid Cell (`cell_id`).
   - **Spot Title & Rank** (e.g., `#1 — Cell C4: Northern Reed Drop-off`).
   - **Why Here (Tactical Description)**: Explanation of why the target fish holds in this cell given the water body structure.
   - **Recommended Approach**: Best lures/baits, presentation, depth, and time of day.
   - **Restriction Badge**: Clear indicator if permits or rules apply.

## 4. Acceptance Criteria (Given / When / Then)
- **AC-F02-1 (Structured Grid Recommendation)**:
  - *Given* a selected water body grid and angler filters (`FishingType`, `TargetSpecies`, `AccessMode`),
  - *When* the user requests AI spot suggestions,
  - *Then* the AI returns 3–6 ranked spots matching `prompts/schemas/spot-recommendation.schema.json`, and each spot's `cell_id` corresponds to a valid water/shoreline grid cell on the map.
- **AC-F02-2 (Map Rendering & Description)**:
  - *Given* a valid AI spot response,
  - *When* the user clicks a suggested spot pin or grid cell on the map,
  - *Then* a detail drawer opens showing the spot description, target species tactics, fishing type tips, and restriction status.
- **AC-F02-3 (Zero-Cost Caching)**:
  - *Given* an identical query `(water_body_id, grid_hash, fishing_type, target_species, access_mode)` was already analyzed recently,
  - *When* another user requests the same analysis,
  - *Then* the cached recommendation is served from the database without incurring a duplicate LLM call.
