# 01 — Domain Model & Business Rules

> **Status**: `Approved`  
> **Last Updated**: 2026-11-10

---

## 1. Domain Glossary

| Term | Definition |
| :--- | :--- |
| **Guest Angler** | Any user of the MVP application (no registration or login wall required). |
| **Selected Map Area** | The geographic bounding box (`[minLng, minLat, maxLng, maxLat]`) selected by the user on the Satellite, Terrain, or Plain map to create a screenshot. |
| **Gridded Screenshot** | The captured image of the selected map area overlaid with an `8×8` coordinate grid (`Columns A..H` × `Rows 1..8`, cells `A1..H8`). |
| **Spot Point (`1`–`6`)** | One of 6 numbered fishing locations placed on the Gridded Screenshot by the AI, color-coded as Red (`🔴 1–2`), Blue (`🔵 3–4`), or Orange (`🟠 5–6`). |
| **Tactical Summary & Game Plan** | Structured guide accompanying the annotated screenshot (`🎯 Where to Fish on the Grid:` and `🚗 Best Game Plan for This Area:`). |
| **User Artifact** | The saved package containing the recognized water body name, the annotated `A1–H8` screenshot with points `1–6`, and the tactical summary. |

---

## 2. Spot Color & Tier Rules
- **🔴 Spots 1 & 2 (`color: "red"`, Trophy / Primary Structure `🏆`)**:
  - Main crossroads peninsulas, steep rocky rims plunging into deep navy water, or pronounced underwater shelf color transitions (*escalón*).
- **🔵 Spots 3 & 4 (`color: "blue"`, Sheltered Bays & Shore/Car Access)**:
  - Wind-sheltered inlets, road-accessible banks, and flat gravelly beach coves that warm in the afternoon sun.
- **🟠 Spots 5 & 6 (`color: "orange"`, Bottlenecks & Gateway Points)**:
  - Canyon S-bends, powerline points, current bottlenecks, and steep rocky gateway points.
