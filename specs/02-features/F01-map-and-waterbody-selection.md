# F01 — Full-Screen Map, Water Body Pins & Spatial Grid

> **Status**: `Approved`  
> **Module**: `src/modules/map-grid/`

---

## 1. User Story
**As a** guest or registered angler,  
**I want to** open the app and immediately see an interactive map with named pins over water bodies, click a water body pin to read its basic description, catchable fish species, and community feedback, and (once registered) overlay a tactical spatial grid with exact fishing spots,  
**So that** I can quickly discover fishing waters and unlock exact grid locations when I sign up.

## 2. UI/UX Layout Specification
- **Full-Screen Map-First Interface**:
  - `100vw x 100vh` **MapLibre GL JS** canvas using free **OpenFreeMap / OpenStreetMap** vector tiles.
  - **Water Body Pins (Visible on Load to All Users)**:
    - Pre-seeded and indexed water bodies in Poland, Spain, and across Europe are rendered as **named pins** over each water body on the map.
  - **Floating Top Search & Filter Bar**: Search water bodies by name + "Locate Me" GPS button + Sign In / Register CTA.
  - **Responsive Contextual Panel (Drawer on Desktop / Bottom Sheet on Mobile)**:
    - Opens when a user clicks a Water Body Pin on the map.

## 3. Water Body Click Behavior: Guest vs. Registered
1. **Guest User Clicks a Water Body Pin**:
   - The water body polygon is highlighted on the map.
   - The side drawer / bottom sheet displays:
     - **Water Body Name & Type** (`Freshwater` / `Sea`).
     - **Basic Description & Restriction Summary** (whether fishing is allowed/permit required).
     - **What Fish You Can Catch Here**: Badges of fish species present in this water body (e.g., Pike, Zander, Perch, Carp).
     - **Community Feedback Preview**: Rating summary and sample feedback attached to the water body pin.
     - **Call to Action (CTA)**: *"Want to see the exact fishing spots on our AI Spatial Grid and unlock full community catch reports? Register free with your email."*
   -*(Note: If a guest clicks an unindexed water body on the map, they can use up to 2 AI basic water-body checks to generate this basic overview, while the spatial grid and exact spots remain locked until registration).*
2. **Registered User Clicks a Water Body Pin**:
   - Sees everything above **plus**:
     - Unlocked **AI Spatial Grid Controls** (Water Type, Fishing Technique, Target Species, Shore/Boat) to generate and view the **Spatial Grid (`A1..H8`)** and **exact Fishing Spot Pins** on the water body.
     - Immediate access to previously discovered/pre-seeded **exact Fishing Spot Pins** on the grid and all full community reviews & catch photos.

## 4. Adaptive Spatial Grid Sizing (`Turf.js` — Registered Users)
- **Small/Medium Lakes (`max_dimension < 5km`)**: Generates a labeled grid (`A1..H8`) over the entire water body bounding box.
- **Large Reservoirs, Long Rivers (e.g. Vistula, Ebro), or Sea Coastlines (`max_dimension >= 5km`)**: Clips the water body polygon to the current map viewport or a `~2.5km` radius tactical sector centered on the water body pin / clicked point so every grid cell stays `100m–300m`.

## 5. Acceptance Criteria (Given / When / Then)
- **AC-F01-1 (Initial Map Load — Named Water Body Pins)**:
  - *Given* a guest or registered user opens the application,
  - *When* the map finishes loading,
  - *Then* named pins are displayed over water bodies in the current map viewport.
- **AC-F01-2 (Guest Water Body Pin Click)**:
  - *Given* an unauthenticated guest user clicks a Water Body Pin on the map,
  - *When* the water body drawer opens,
  - *Then* it displays the basic description, catchable fish species, teaser feedback, and a registration CTA, while **hiding** the spatial grid (`A1..H8`) and exact fishing spot coordinates.
- **AC-F01-3 (Registered User Full Grid & Spot Access)**:
  - *Given* an authenticated registered user clicks a Water Body Pin,
  - *When* the water body drawer opens,
  - *Then* they can view the spatial grid, exact fishing spot pins on the grid, full tactical descriptions, and all community reviews/photos.
