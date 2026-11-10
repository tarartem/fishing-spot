# F02 — AI Spatial Grid, Numbered Spot Points & Feature Legend

> **Status**: `Approved`  
> **Module**: `src/modules/ai-advisor/`  
> **Prompt Spec**: [`prompts/spot-finder-grid.prompt.md`](../../prompts/spot-finder-grid.prompt.md)  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As a** registered angler who has clicked a water body pin on the map,  
**I want to** see the `A1–H8` spatial grid overlaid on the water body with numbered circular fishing spot markers (`1` to `6`) and a clear **Spot Features Legend** describing each location,  
**So that** I can immediately match each numbered point on the water body grid to its structural features, target species, and fishing tactics.

## 2. Visual Grid & Numbered Spot Markers Specification
Matching the reference tactical grid layouts:
1. **Grid Coordinate Convention**:
   - `8` columns (`A, B, C, D, E, F, G, H` from left/West to right/East) × `8` rows (`1, 2, 3, 4, 5, 6, 7, 8` from top/North to bottom/South).
   - Cell IDs follow `<Col><Row>` (e.g., `A1`, `B1`, `C1` ... `E1`, `F6`, `C7`, `H8`), rendered in the top-left corner of each grid cell.
2. **Numbered Circular Spot Markers (`1`–`6`)**:
   - Placed at exact `[latitude, longitude]` coordinates on the water body (never on dry land).
   - Color-coded by tactical tier & feature type:
     - **Red Circle (`1`, `2`)**: **Primary Hot Spot** — Trophy structure, submerged island tip, or main channel rocky point (e.g., `F6`, `E2`).
     - **Orange / Amber Circle (`3`, `4`, `5`, `6`)**: **Drop-Off / Ledge Spot** — Steep bank transition, submerged terrace, or secondary peninsula point (e.g., `E4`, `E7`).
     - **Light Blue Circle (`3`, `4`, `5`, `6`)**: **Shore Access / Bay Spot** — Bank-accessible beach, sheltered feeder/carp bay, or inflow cove (e.g., `E1`, `C7`).
3. **Spot Features Legend**:
   - Displayed alongside/below the water body grid for registered users:
     - **Color Category Legend**: Explains Red (Primary Hot Spot), Amber (Drop-Off / Structure Ledge), Blue (Shore / Cove Access), and Prohibited Reserve zones.
     - **Spot-by-Spot Feature Breakdown**: Connects every numbered marker (`#1` through `#6`) + its Grid Cell (`e.g. Cell F6`) to its key hydro-structural features (e.g., *Submerged Rocky Point*, *9m Channel Drop-off*, *Sheltered Carp Bay*, *Submerged Island*), target fish, and recommended baits/lures.

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F02-1 (Guest Cannot Access Grid or Numbered Spot Points)**:
  - *Given* an unauthenticated guest user clicks a Water Body Pin,
  - *When* the water body drawer opens,
  - *Then* they see only the basic description, catchable fish species, teaser feedback, and Registration CTA.
- **AC-F02-2 (Registered User Sees A1–H8 Grid, Numbered Points 1–6 & Spot Features Legend)**:
  - *Given* a registered user clicks a Water Body Pin or runs the AI Grid Advisor,
  - *When* the water body view renders,
  - *Then* the `A1–H8` grid overlay, up to 6 numbered circular spot markers (`1..6`) color-coded Red/Amber/Blue at exact water coordinates, and the Spot Features Legend are displayed.
