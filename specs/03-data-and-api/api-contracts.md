# API & Service Contracts Specification

> **Status**: `Approved`

---

## 1. Core Endpoints / Route Handlers

### 1.1 `POST /api/water-bodies/select`
Triggered when a user clicks a water body on the map.
- **Request**:
  ```json
  {
    "latitude": 52.2297,
    "longitude": 21.0122,
    "viewportBounds": [20.98, 52.20, 21.05, 52.25]
  }
  ```
- **Behavior & Auth Gating**:
  - Resolves water body from DB or Overpass API (`< 5km` full lake; `>= 5km` clips to `~2.5km` tactical sector around `[latitude, longitude]`).
  - Builds the deterministic `Turf.js` spatial grid (`A1..H8`) and runs Layer 1 OSM restriction checks (`prohibited` vs `permit_required` vs `allowed`).
  - **If Guest (unauthenticated)**: Returns `waterBody` (name, waterType, countryCode, description), `restrictionOverview`, and `gridCells`, with `spots: []` (pre-seeded spots withheld).
  - **If Registered User (Email Auth)**: Also returns `spots: FishingSpotPin[]` (all pre-seeded and community-reviewed spot pins on that water body with their ratings and review counts).

---

### 1.2 `POST /api/ai-advisor/recommend-spots`
Generates or retrieves cached AI spatial grid spot recommendations based on the 4 core inputs.
- **Request**:
  ```json
  {
    "waterBodyId": "uuid",
    "sectorBbox": [20.99, 52.21, 21.03, 52.24],
    "waterType": "freshwater",
    "fishingType": "spinning",
    "targetSpecies": ["pike", "perch"],
    "accessMode": "shore",
    "season": "autumn"
  }
  ```
- **Behavior & Auth Gating**:
  - **Guest User**:
    - Checks guest usage counter (`max 2 analyses`). If `count >= 2`, returns `403 { "code": "GUEST_LIMIT_REACHED", "message": "Register with your email for unlimited AI spot analyses." }`.
    - If `count < 2`, runs/fetches the analysis and returns a **redacted Basic Response** (grid overlay + top pin coordinate, title, and basic summary; `tactical_advice` and additional spot details are locked).
  - **Registered User**:
    - Unlimited access. Checks `grid_analyses` cache by `query_hash` first; on cache miss invokes Gemini 2.5 Flash, validates against [`prompts/schemas/spot-recommendation.schema.json`](../../prompts/schemas/spot-recommendation.schema.json), persists spots to `fishing_spots`, and returns the full response.

---

### 1.3 `POST /api/ai-advisor/analyze-cell` (Registered Users Only)
On-demand Level 2 micro-analysis when an angler clicks a specific grid cell (e.g., `D5`).
- **Request**:
  ```json
  {
    "gridAnalysisId": "uuid",
    "cellId": "D5"
  }
  ```
- **Response**:
  ```json
  {
    "cellId": "D5",
    "suitabilityScore": 68,
    "structuralAnalysis": "Shallow wind-sheltered bay with submerged vegetation...",
    "howToFishThisCell": "Use weedless soft plastics or shallow twitchbaits along the outer reed margin...",
    "restrictionStatus": "allowed"
  }
  ```

---

### 1.4 `GET /api/spots/:spotId/reviews` & `POST /api/spots/:spotId/reviews` (Registered Users Only)
Fetches or attaches angler reviews, ratings, catch logs, and compressed WebP photos to a Water Body Pin.
- **POST Payload**:
  ```json
  {
    "rating": 5,
    "comment": "Caught two pike along the drop-off in cell C4!",
    "fishingTypeUsed": "spinning",
    "speciesCaught": [
      { "species": "pike", "count": 2, "lengthCm": 74, "weightKg": 3.1 }
    ],
    "fishedOn": "2026-11-08",
    "photos": [
      { "storagePath": "catches/u123/c4-pike.webp", "publicUrl": "https://...", "photoType": "catch" }
    ]
  }
  ```

---

### 1.5 `POST /api/restrictions/report` (Registered Users Only)
Allows a registered angler to flag a water body grid cell or spot pin with a local restriction update.
- **POST Payload**:
  ```json
  {
    "waterBodyId": "uuid",
    "cellId": "A2",
    "status": "prohibited",
    "reason": "Spawning reserve buoy line marked on bank sign."
  }
  ```
