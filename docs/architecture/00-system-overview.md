# 00 — System Architecture Overview ($0 MVP Stack)

> **Status**: `Proposed — Pending User Stack Confirmation`

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    User["Angler (Web / Mobile Browser)"]
    
    subgraph Frontend["Client Layer ($0 Hosting)"]
        MapUI["Interactive Free Map (MapLibre / Leaflet + OSM)"]
        GridEngine["Spatial Grid Generator (Turf.js)"]
        ImgComp["Client-Side WebP Photo Compressor"]
    end

    subgraph Backend["Application & API Layer"]
        WaterService["Water Body & Overpass Resolver"]
        AIAdvisor["AI Spot Advisor Service"]
        RestrictionService["Restrictions & Regulations Checker"]
        ReviewService["Reviews & Catch Log Service"]
    end

    subgraph ExternalFree["Free External Services ($0 MVP)"]
        OSM["OpenStreetMap / Overpass API"]
        LLM["Free-Tier LLM API (Gemini Flash / Groq)"]
        DB[("PostgreSQL + PostGIS (Supabase / Neon Free)")]
        Storage[("Object Storage (Supabase Storage / Cloudflare R2 Free)")]
    end

    User --> MapUI
    MapUI --> GridEngine
    GridEngine --> WaterService
    WaterService --> OSM
    WaterService --> RestrictionService
    GridEngine --> AIAdvisor
    AIAdvisor <-->|"Check Cache First"| DB
    AIAdvisor -->|"Cache Miss Only"| LLM
    User --> ImgComp
    ImgComp --> Storage
    User --> ReviewService
    ReviewService --> DB
```

## 2. $0 Budget Engineering Principles
1. **Compute on the Edge/Client Where Possible**: Generating the coordinate grid (`A1..H8`) over a water body polygon using `Turf.js` costs $0 in client/serverless CPU.
2. **Cache-First AI**: Water body analyses are cached in PostgreSQL (`grid_analyses` table) keyed by `(water_body_id, fishing_type, target_species, access_mode, season)`.
3. **Aggressive Media Optimization**: Photos are compressed in the browser to `<200KB` WebP before touching cloud storage, allowing ~5,000 catch photos per 1GB of free storage.
