# ADR 0002: $0 MVP Tech Stack & Regional Target

- **Status**: Accepted
- **Date**: 2026-11-10

## Context
To build a production-grade MVP of **Fishing Spot** with a **$0/month budget** while maintaining an **Agent-First, Spec-Driven (SDD)** architecture that can scale when post-MVP budget becomes available, we needed to lock in our core application stack, mapping engine, AI inference provider, and initial geographic market.

## Decisions

1. **Application Framework & Hosting**:
   - **Next.js (App Router, TypeScript, Tailwind CSS)** deployed on **Vercel (Free Hobby Tier)**.
   - Responsive Mobile-First Web / PWA experience so anglers can use it seamlessly in the field on their phones as well as on desktop when planning trips.

2. **Database, Geospatial, Auth & Media Storage**:
   - **Supabase Free Tier**:
     - **PostgreSQL + PostGIS** for relational data (`users`, `water_bodies`, `grid_analyses`, `fishing_spots`, `spot_reviews`) and geospatial polygon queries.
     - **Supabase Auth** for angler authentication (Email/OAuth).
     - **Supabase Storage** for angler catch photos (with mandatory client-side WebP compression `<200KB` before upload).

3. **Mapping & Spatial Grid Engine**:
   - **MapLibre GL JS** + **OpenFreeMap / OpenStreetMap** vector tiles (100% free, no API key or per-load billing traps).
   - **Overpass API** for querying water body polygons (`natural=water`, `waterway=*`, `natural=coastline`) and regulatory/protected area tags (`boundary=protected_area`, `leisure=nature_reserve`, `fishing=*`).
   - **Turf.js** (`@turf/square-grid`, `@turf/boolean-point-in-polygon`, `@turf/boolean-intersects`) for deterministic client/edge spatial grid generation (`A1..Zn`).

4. **AI Model Provider**:
   - **Google Gemini API Free Tier (`gemini-2.5-flash`)** behind a **provider-agnostic AI adapter** (`src/modules/ai-advisor/`), enforcing structured JSON output matching `prompts/schemas/spot-recommendation.schema.json`.
   - Backed by deterministic PostgreSQL caching (`grid_analyses` table) to prevent duplicate LLM calls for the same `(water_body_id, fishing_type, target_species, access_mode, season)`.

5. **Initial Geographic Target**:
   - **Europe (EU countries)** — Focusing on European freshwater species (Pike, Zander, Perch, Carp, Bream, Tench, Trout, Wels Catfish, Chub, Roach) and European sea/coastal species (European Sea Bass, Gilthead Seabream, Mackerel, Cod, Garfish, Flounder, Mullet), alongside European nature reserve (`Natura 2000`, `leisure=nature_reserve`) and local angling permit frameworks.
