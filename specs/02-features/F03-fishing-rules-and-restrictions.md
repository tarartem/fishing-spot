# F03 — Fishing Rules & Restricted Zones (3-Layer Hybrid)

> **Status**: `Approved`  
> **Module**: `src/modules/restrictions/`

---

## 1. User Story
**As an** angler fishing in Poland, Spain, or elsewhere in Europe,  
**I want to** see restricted zones on the grid and read a clear summary of required permits and seasonal rules,  
**So that** I never accidentally fish in a prohibited reserve or without the proper local license.

## 2. Three-Layer Hybrid Restriction Engine ($0 MVP)

### Layer 1: Deterministic OpenStreetMap / Overpass Spatial Blocking
When resolving a water body and generating its spatial grid, the system checks OSM tags intersecting each grid cell:
- **Hard Prohibited Zones (`restriction_status = "prohibited"`)**:
  - Nature reserves & strict conservation zones (`leisure=nature_reserve`, `boundary=protected_area` with strict `protect_class`, `Natura 2000` sanctuary polygons, Polish *Rezerwat przyrody*, Spanish *Reserva Natural Integral*).
  - Infrastructure safety buffers (`50m` buffer around `waterway=dam`, `waterway=weir`, `waterway=lock_gate`, fish passes, military zones, commercial port docks).
  - Explicit no-fishing tags (`fishing=no`, `access=no`).
- **Permit / Conditional Zones (`restriction_status = "permit_required"`)**:
  - Tags `fishing=permit`, `fishing=private`, `access=private`, `leisure=fishing` club waters.
- **Grid Enforcement**: Any grid cell with `prohibited` status is shaded red on the map and deterministically excluded from AI spot recommendations.

### Layer 2: AI Country/Regional Regulatory Summary (Poland & Spain Focus)
In every `SpotRecommendationResponse`, the AI generates a `restriction_overview` tailored to the water body's country (`country_code`) and `target_species`:
- **Poland (`PL`)**: Reminds anglers of the mandatory **Karta Wędkarska** (State Angling Card), water manager permit (e.g., **PZW Okręg** *Zezwolenie* or state enterprise *Wody Polskie*), statutory closed seasons (*okresy ochronne* — e.g., Pike Jan 1–Apr 30, Zander Jan 1–May 31), and minimum protection sizes (*wymiary ochronne*).
- **Spain (`ES`)**: Reminds anglers of the mandatory Autonomous Community **Licencia de Pesca** (continental vs. marítima), checks if the stretch is a **Coto de Pesca** (requiring a daily permit), and highlights strict Spanish rules on invasive/exotic species (*especies exóticas invasoras* such as Black Bass, Pike, Zander, Wels Catfish where live bait or release rules apply by region).
- **Mandatory Legal Disclaimer**: Always displayed alongside AI regulatory guidance stating that local signage and official water manager bylaws take precedence.

### Layer 3: Community "Report Restriction" Flag (Registered Users)
- Registered anglers can click any grid cell or spot pin and submit a **Restriction Report** (`prohibited`, `permit_required`, `seasonal_restriction`) with a reason (e.g., *"Spawning sanctuary buoy line until June 1st"* or *"PZW No-Kill section"*) and optional photo of the regulation sign.

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F03-1 (Deterministic Prohibited Cell Blocking)**:
  - *Given* grid cell `A2` intersects an OSM `leisure=nature_reserve` or a `50m` dam buffer,
  - *When* the spatial grid is built,
  - *Then* cell `A2` is marked `prohibited` (red overlay) and cannot be selected by the AI as a recommended fishing spot.
- **AC-F03-2 (Poland & Spain Regulatory Guidance)**:
  - *Given* a water body in Poland (`PL`) or Spain (`ES`) and a target species (e.g., `pike` or `black_bass`),
  - *When* the water body / AI analysis is displayed,
  - *Then* the restriction panel shows the country-specific permit requirements, seasonal reminders for that species, and the legal disclaimer.
- **AC-F03-3 (Community Restriction Flagging)**:
  - *Given* a registered user views a water body grid cell or spot pin,
  - *When* they submit a community restriction report,
  - *Then* the report is saved in `restriction_zones` (`source = "community"`) and surfaced as a warning badge on that cell/spot.
