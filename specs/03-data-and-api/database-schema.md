# Database Schema Specification (PostgreSQL + PostGIS)

> **Status**: `Draft — Pending DB Stack Confirmation`  
> **Target DB**: Free-tier PostgreSQL (Supabase / Neon) with PostGIS extension

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ SPOT_REVIEWS : writes
    WATER_BODIES ||--o{ GRID_ANALYSES : has
    WATER_BODIES ||--o{ FISHING_SPOTS : contains
    WATER_BODIES ||--o{ RESTRICTION_ZONES : regulates
    GRID_ANALYSES ||--o{ FISHING_SPOTS : generates
    FISHING_SPOTS ||--o{ SPOT_REVIEWS : receives
    SPOT_REVIEWS ||--o{ CATCH_PHOTOS : includes

    USERS {
        uuid id PK
        string email
        string display_name
        string avatar_url
        timestamp created_at
    }

    WATER_BODIES {
        uuid id PK
        string osm_id UK
        string name
        string water_type "freshwater_still | freshwater_flowing | brackish | saltwater_coastal"
        jsonb bbox "[minLng, minLat, maxLng, maxLat]"
        geometry polygon "PostGIS Polygon/MultiPolygon"
        string country_code
        timestamp created_at
    }

    RESTRICTION_ZONES {
        uuid id PK
        uuid water_body_id FK
        string status "allowed | permit_required | seasonal_restriction | prohibited"
        string reason
        string source "osm | community | official"
        geometry polygon
        timestamp updated_at
    }

    GRID_ANALYSES {
        uuid id PK
        uuid water_body_id FK
        string query_hash UK "Hash of (water_body_id, fishing_type, target_species, access_mode)"
        string fishing_type
        string target_species
        string access_mode "shore | boat"
        jsonb grid_definition "Cells A1..Zn with bounds & metadata"
        jsonb ai_response "Validated JSON matching spot-recommendation.schema.json"
        timestamp created_at
    }

    FISHING_SPOTS {
        uuid id PK
        uuid water_body_id FK
        uuid grid_analysis_id FK
        string cell_id "e.g., C4"
        float latitude
        float longitude
        string title
        text description
        jsonb recommended_tactics
        string restriction_status
        float avg_rating
        int review_count
        timestamp created_at
    }

    SPOT_REVIEWS {
        uuid id PK
        uuid spot_id FK
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
- `idx_water_bodies_osm_id`: Fast lookup when a user clicks an already-indexed OSM water body.
- `idx_grid_analyses_query_hash`: Instant `O(1)` cache hit for repeated AI queries on the same water body, fishing style, and target fish.
- `idx_fishing_spots_water_body`: Fast retrieval of all AI-suggested and community-reviewed spots on a selected water body.
