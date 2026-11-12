# 01 — Domain Model & Business Rules

> **Status**: `Approved`  
> **Last Updated**: 2026-11-11

---

## 1. Domain Glossary

| Term | Definition |
| :--- | :--- |
| **Guest Angler** | Any user of the MVP application (no registration or login wall required). |
| **Selected Map Area** | The geographic bounding box (`[minLng, minLat, maxLng, maxLat]`) selected by the user on the Satellite or Terrain map to create a screenshot (AI analysis always receives Satellite imagery). |
| **Gridded Screenshot** | The captured satellite image of the selected map area overlaid with an `8×8` coordinate grid (`Columns A..H` × `Rows 1..8`, cells `A1..H8`). |
| **Spot Point (`1`–`6`)** | One of `4–6` numbered fishing locations placed strictly on water/shoreline cells of the Gridded Screenshot by the AI, color-coded as Green (`🟢 1–2`), Blue (`🔵 3–4`), or Yellow (`🟡 5–6`). |
| **Tactical Summary & Game Plan** | Structured guide accompanying the annotated screenshot (`🎯 Where to Fish on the Grid:` and `🚗 Best Game Plan for This Area:`). |
| **User Artifact** | The saved package containing the recognized water body name, the annotated `A1–H8` screenshot with points `1–6`, and the tactical summary. |
| **"Multiple X's" Stacking Factor** | The core evaluation principle where the highest-percentage spots stack multiple ecological drivers: Macro Structure, Micro Cover, Environmental Edges/Transitions, Deep Water Access, and Hydrodynamic/Food Delivery. |

---

## 2. Spot Evaluation & Ranking Rules ("Multiple X's Mark the Spot")

Fish behavior is governed by three invariant biological needs: **Safety** (cover, shade, deep escape), **Food** (caloric efficiency, current conveyor), and **Reproduction** (seasonal nursery/spawning staging).
Single features (just a dock or just a flat) produce mediocre results. The ranking engine assigns rank based on **feature stacking density**:

- **🟢 Spot 1 (`color: "green"`, Trophy Point / The #1 Honey Hole `🏆`)**:
  - **Highest Stacking Density (4–5 Overlapping X's)**: Combines primary macro structure (e.g., protruding underwater point or river channel drop-off), micro cover (submerged weed bed, wood, or rock rim), clear edge/transition, immediate access to deep escape water ($<25\text{m}$), and food delivery (adjacent spawning cove or current break).
  - Displays a compact, user-facing bullet-point breakdown (`why_rank_summary`) explaining exactly which stacked features made it #1.
- **🟢 Spot 2 (`color: "green"`, Prime Transition Line `🏆`)**:
  - **3–4 Overlapping X's**: Major underwater shelf transition (*escalón*), opposite channel bank, or secondary point with deep water sanctuary.
- **🔵 Spots 3 & 4 (`color: "blue"`, Sheltered Bays & Shore/Car Access)**:
  - **2–3 Overlapping X's + High Bank/Road Accessibility**: Wind-sheltered inlets, gravel beach coves, or weed flats with verified gentle bank slope and nearby paved/unpaved track access.
- **🟡 Spots 5 & 6 (`color: "yellow"`, Bottlenecks & Specialized Structure)**:
  - **2 Overlapping X's**: Canyon S-bends, current bottlenecks, isolated rocky reefs, or bridge supports.

---

## 3. Ecological Features Taxonomy (Cover vs. Structure)

- **Macro Structure (Bottom Contours)**: Points (travel corridors), Drop-offs / Shelves (depth breaks), Channels (riverbed highways), Flats (forage & spawning grounds), Humps (offshore staging).
- **Micro Cover (Physical Objects)**: Weeds / Vegetation (ambush & oxygen), Submerged Timber / Wood (food chain magnet), Rocks / Boulders (crayfish & current breaks), Docks / Pilings (shade & vertical protection).
- **Edges & Transitions**: Weed-to-open-water edge, shallow-to-deep breaklines, current seams (fast water meeting slow water), bottom substrate changes.

## 5. Hydrology & Water Current Direction Rules ($0 Tier)
- **Flow Vector Extraction**: Derived from OSM `waterway=river|stream|canal` polylines (upstream -> downstream node convention) using length-weighted vector averaging across segments in/near `bbox`.
- **DEM Elevation Cross-Check**: When DEM elevation drop between upstream and downstream ends is `>= 2m`, DEM confirms or flips the flow vector. When `|Δelev| < 2m` (flat lowlands/canals), OSM node order is trusted to avoid SRTM noise reversals.
- **Stillwater vs. Flowing Water**: Enclosed reservoirs/lakes without nearby inflows are treated as `stillwater` (negligible river current). Where a river enters a reservoir, an **Inflow Zone** extends `200m–600m` depending on waterway class/width (`~200m` stream, `~350–500m` river, up to `600m` at wide river mouths).
- **Downstream Eddy & Seam Logic**: On flowing water or inside an inflow zone, `current_break` is confirmed and spots downstream of points/constrictions are preferred over exposed upstream faces; on stillwater outside inflow zones, river `current_break` is not claimed.
