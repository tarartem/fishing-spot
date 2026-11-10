# API & Service Contracts Specification

> **Status**: `Draft`

---

## 1. Core Endpoints / Actions

### 1.1 `POST /api/water-bodies/resolve`
Resolves a map click `[lat, lng]` or bounding box into a water body polygon and generates its spatial grid + restriction flags.
- **Request**:
  ```json
  {
    "latitude": 52.2297,
    "longitude": 21.0122,
    "boundingBox": [20.98, 52.20, 21.05, 52.25]
  }
  ```
- **Response**:
  - Water body metadata (`id`, `name`, `waterType`, `polygon`).
  - Spatial grid cells (`cells: [{ cellId, centerLat, centerLng, bounds, zoneType, restrictionStatus }]`).

---

### 1.2 `POST /api/ai-advisor/recommend-spots`
Takes the resolved water body grid and angler parameters, checks the DB cache, and invokes the AI Advisor to recommend spots on the grid.
- **Request**:
  ```json
  {
    "waterBodyId": "uuid",
    "waterType": "freshwater_still",
    "fishingType": "spinning",
    "targetSpecies": ["pike", "perch"],
    "accessMode": "shore",
    "season": "autumn"
  }
  ```
- **Response**:
  - Adheres strictly to [`prompts/schemas/spot-recommendation.schema.json`](../../prompts/schemas/spot-recommendation.schema.json).

---

### 1.3 `GET /api/spots/:spotId/reviews` & `POST /api/spots/:spotId/reviews`
Fetches or creates angler reviews, catch reports, and uploaded photo references for a specific spot.
- **POST Payload**:
  ```json
  {
    "rating": 5,
    "comment": "Great morning bite near the reed edge in cell C4!",
    "fishingTypeUsed": "spinning",
    "speciesCaught": [
      { "species": "pike", "count": 2, "lengthCm": 72 }
    ],
    "fishedOn": "2026-11-08",
    "photoUrls": ["https://.../catches/webp-compressed-1.webp"]
  }
  ```
