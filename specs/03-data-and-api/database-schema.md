# Database Schema Specification (Supabase PostgreSQL + PostGIS + Drizzle ORM)

> **Status**: `Approved`  
> **Target DB**: Supabase Free Tier (PostgreSQL + PostGIS) managed via **Drizzle ORM** (`db/migrations/`)

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ SPOT_REVIEWS : writes
    USERS ||--o{ RESTRICTION_ZONES : reports
    WATER_BODIES ||--o{ GRID_ANALYSES : has
    WATER_BODIES ||--o{ FISHING_SPOTS : contains
    WATER_BODIES ||--o{ SPOT_REVIEWS : receives_feedback
    WATER_BODIES ||--o{ RESTRICTION_ZONES : regulates
    GRID_ANALYSES ||--o{ FISHING_SPOTS : generates
    GRID_ANALYSES ||--o{ CELL_MICRO_ANALYSES : drills_into
    FISHING_SPOTS ||--o{ SPOT_REVIEWS : receives
    SPOT_REVIEWS ||--o{ CATCH_PHOTOS : includes

    USERS {
        uuid id PK "Matches Supabase auth.users.id"
        string email UK
        string display_name
        string preferred_locale "Default: en (future: pl, es)"
        timestamp created_at
    }

    WATER_BODIES {
        uuid id PK
        string osm_id UK
        string name "Displayed on the map Water Body Pin"
        string water_type "freshwater | sea"
        string country_code "PL | ES | EU ISO-2"
        float center_lat "Latitude for the Water Body Pin on map load"
        float center_lng "Longitude for the Water Body Pin on map load"
        text description "Basic water body description shown on click"
        jsonb common_species "Array of fish species catchable in this water body"
        jsonb bbox "[minLng, minLat, maxLng, maxLat]"
        geometry polygon "PostGIS Polygon/MultiPolygon"
        float avg_rating
        int review_count
        timestamp created_at
    }

    RESTRICTION_ZONES {
        uuid id PK
        uuid water_body_id FK
        uuid reported_by_user_id FK "Nullable for OSM-sourced rules"
        string cell_id "Nullable if applies to whole polygon"
        string status "allowed | permit_required | seasonal_restriction | prohibited"
        string reason
        string source "osm | community | official"
        geometry polygon "Optional sub-polygon"
        timestamp updated_at
    }

    GRID_ANALYSES {
        uuid id PK
        uuid water_body_id FK
        string query_hash UK "SHA256(water_body_id, sector_bbox, water_type, fishing_type, target_species, access_mode, season)"
        jsonb sector_bbox "[minLng, minLat, maxLng, maxLat]"
        string water_type "freshwater | sea"
        string fishing_type "spinning | feeder_bottom | carp | float | fly | surfcasting"
        jsonb target_species "Array of species slugs"
        string access_mode "shore | boat"
        string season "spring | summer | autumn | winter"
        jsonb grid_definition "Cells A1..H8 with bounds & OSM structure metadata"
        jsonb ai_response "Validated JSON matching spot-recommendation.schema.json"
        timestamp created_at
    }

    CELL_MICRO_ANALYSES {
        uuid id PK
        uuid grid_analysis_id FK
        string cell_id "e.g., D5"
        jsonb ai_micro_response "Detailed sector breakdown for clicked cell"
        timestamp created_at
    }

    FISHING_SPOTS {
        uuid id PK
        uuid water_body_id FK
        uuid grid_analysis_id FK "Nullable for pre-seeded grid pins"
        string cell_id "e.g., C4"
        float latitude
        float longitude
        string title
        text description
        jsonb tactical_advice "{recommended_baits_or_lures, presentation_tips, best_time_of_day}"
        jsonb target_species_fit "Array of species slugs"
        string fishing_type
        string access_mode "shore | boat"
        string restriction_status
        float avg_rating
        int review_count
        timestamp created_at
    }

    SPOT_REVIEWS {
        uuid id PK
        uuid water_body_id FK "Always linked to the Water Body Pin"
        uuid spot_id FK "Optional specific grid spot pin"
        uuid user_id FK
        int rating "1 to 5"
        text comment
        string fishing_type_used
        jsonb species_caught "Array of {species, count, weight_kg, length_cm}"
        date fished_on
        timestamp created_at
    }

    CATCH_PHOTOS {
        uuid id PK
        uuid review_id FK
        string storage_path
        string public_url
        string photo_type "catch | spot_view | regulation_sign"
        timestamp created_at
    }
```

## 2. Indexing & Performance Strategy ($0 Tier)
- `idx_water_bodies_center`: Fast bounding-box retrieval of named **Water Body Pins** (`center_lat`, `center_lng`, `name`) when the map loads or pans.
- `idx_water_bodies_osm_id`: Instant lookup for OSM water bodies.
- `idx_grid_analyses_query_hash`: `O(1)` cache hit for repeated AI grid queries (`0` LLM tokens spent).
- `idx_fishing_spots_water_body`: Fast retrieval of exact grid spot pins for **registered users**.
