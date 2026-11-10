# F03 — Fishing Rules & Restricted Zones

> **Status**: `Draft`  
> **Module**: `src/modules/restrictions/`

---

## 1. User Story
**As an** angler planning a trip,  
**I want to** know whether fishing is allowed, restricted, or requires a permit at the selected water body and specific grid sectors,  
**So that** I avoid illegal fishing, fines, or trespassing in protected areas.

## 2. Data Sources for Restrictions ($0 MVP Strategy)
1. **OpenStreetMap / Overpass Regulatory Tags**:
   - Protected areas (`boundary=protected_area`, `leisure=nature_reserve`, `protect_class=*`).
   - Access & fishing tags (`fishing=no`, `fishing=permit`, `fishing=private`, `access=private`, `access=no`).
   - Infrastructure safety zones (automatic buffer around `waterway=dam`, `waterway=weir`, `landuse=military`, commercial ports).
2. **Community-Reported Restriction Flags**:
   - Anglers can flag a water body or grid cell as "Permit Required", "Seasonal Ban", "Private Bank", or "No Fishing" with photo proof (e.g., photo of a local regulation sign).
3. **AI Regional Regulation Summary**:
   - AI provides general regional seasonal/size-limit reminders with a mandatory legal disclaimer.

## 3. Acceptance Criteria (Given / When / Then)
- **AC-F03-1 (Restricted Zone Visualization)**:
  - *Given* a water body intersects or contains a restricted polygon (e.g., nature reserve or dam buffer),
  - *When* the spatial grid is generated,
  - *Then* affected grid cells are marked in red/amber on the map with a restriction reason tooltip.
- **AC-F03-2 (AI Exclusion of Prohibited Cells)**:
  - *Given* grid cells `A1` and `A2` are marked `prohibited`,
  - *When* the AI Spot Advisor generates recommendations,
  - *Then* `A1` and `A2` are excluded from recommended fishing spots and listed under `restriction_warnings`.
