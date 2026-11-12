# API & Service Contracts Specification

> **Status**: `Approved`

---

## 1. Core Endpoints / Route Handlers

### 1.1 `GET /api/water-bodies/pins?bbox=minLng,minLat,maxLng,maxLat`
Called when any user (Guest or Registered) opens or pans the map.
- **Response (Visible to Guests & Registered Users)**:
  ```json
  {
    "waterBodyPins": [
      {
        "id": "uuid",
        "name": "Jezioro Zegrzyńskie",
        "waterType": "freshwater",
        "countryCode": "PL",
        "centerLat": 52.45,
        "centerLng": 21.03,
        "avgRating": 4.6,
        "reviewCount": 14
      }
    ]
  }
  ```

---

### 1.2 `GET /api/water-bodies/:waterBodyId` (or `POST /api/water-bodies/select`)
Triggered when a user clicks a **Water Body Pin** (or clicks a water body on the map).
- **If Guest User (Unauthenticated)**:
  - Returns **Basic Water Body Info Only**:
    - `name`, `waterType`, `countryCode`, `description`, `restrictionOverview`
    - `commonSpecies`: What fish can be caught in this water body (e.g., `["pike", "zander", "perch", "bream"]`)
    - `teaserFeedback`: Aggregate rating + 1–2 short review snippets attached to the water body
    - `cta`: Registration call-to-action object
    - `grid`: `null` (Locked)
    - `exactSpots`: `[]` (Locked)
- **If Registered User (Email Auth)**:
  - Returns everything above **plus**:
    - `grid`: The spatial grid (`A1..H8`) over the water body / tactical sector
    - `exactSpots`: All pre-seeded and previously discovered **Grid Fishing Spot Pins** with coordinates, cell IDs, and tactical descriptions
    - `fullReviews`: Complete community reviews and catch photo galleries.

---

### 1.3 `POST /api/ai-advisor/recommend-spots`
Generates or retrieves cached AI spatial grid spot recommendations on a water body.
- **Behavior & Auth Gating**:
  - **Guest User**:
    - Cannot access exact grid spots (`401/403` for full grid pins, or limited to 2 basic water-body-level overview generations if clicking an unindexed water body).
  - **Registered User**:
    - Unlimited access. Accepts the 4 core inputs (`waterType`, `fishingType`, `targetSpecies`, `accessMode`, plus `season`), checks `grid_analyses` cache by `query_hash`, invokes Gemini 2.5 Flash on cache miss, validates against [`prompts/schemas/spot-recommendation.schema.json`](../../prompts/schemas/spot-recommendation.schema.json), and returns the spatial grid (`A1..H8`) + **Top 3–5 exact Fishing Spot Pins** with full tactical descriptions.

---

### 1.4 `POST /api/ai-advisor/analyze-cell` (Registered Users Only)
On-demand Level 2 micro-analysis when a registered angler clicks a specific grid cell (e.g., `D5`).

---

### 1.5 `GET /api/water-bodies/:waterBodyId/reviews` & `POST /api/water-bodies/:waterBodyId/reviews` (Registered Users Only for Full/Write Access)
Fetches all reviews/photos or attaches a new angler review, star rating, species caught, and compressed WebP photo to a water body pin / grid spot.

---

### 1.6 `POST /api/ai-advisor/analyze-screenshot`
Analyzes a captured `1024×1024` gridded satellite screenshot (`bbox`, optional `griddedScreenshotBase64`, `anglerGearNote`, `hintWaterBodyId`, and optional `clientWaterMask` containing `waterCoveragePct`, `waterCells`, `sampledWaterPoints`, and `grid64Mask`).
- **Response (`WaterBodyArtifactAnalysis`)**:
  - `has_fishable_water: boolean` — `false` when no fishable water body exists in `bbox`/screenshot (`recommended_spots: []`, zero hallucination).
  - `water_coverage_pct?: number` and `no_water_reason?: string`.
  - `analysis_source?: 'gemini_vision' | 'geospatial_fallback' | 'no_water_detected'`.
  - `water_body_name`, `region_label` (strictly English via `accept-language=en`), `water_body_summary`, `imagery_freshness_note`, `extraction_limitations`, `screenshot_feature_inventory`, `species_present`, `geographical_context`, `restriction_check`, `recommended_spots` (each with canonical `extracted_features`, deterministic `1–10` `rating`, `rating_tier`, and concise `rating_justification`), `best_game_plan` conforming to [`prompts/schemas/spot-recommendation.schema.json`](../../prompts/schemas/spot-recommendation.schema.json).
