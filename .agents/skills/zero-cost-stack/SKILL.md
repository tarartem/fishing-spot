---
name: zero-cost-stack
description: >-
  Enforces the $0 MVP budget constraint across infrastructure, mapping, AI
  models, database, storage, and hosting. Activate this skill when selecting
  libraries, cloud providers, APIs, or configuring deployment pipelines.
---

# Zero-Cost ($0 Budget) MVP Architecture Skill

The project mandate is a **$0/month budget for the MVP**, with a clean upgrade path once post-MVP budget becomes available.

## Approved $0-Tier Component Matrix

| Layer | $0 MVP Recommended Options | Cost Guardrails & Caching Rules |
| :--- | :--- | :--- |
| **Maps & Tiles** | **MapLibre GL JS** or **Leaflet** + **OpenStreetMap** / **OpenFreeMap** / **Carto Free Basemaps** | Never use paid-per-load Google Maps JS SDK or Mapbox paid tiles without strict free-tier hard caps. Use **Overpass API** (OSM) for free water body polygons & shoreline features. |
| **Spatial Grid Math** | **Turf.js** (`@turf/square-grid`, `@turf/boolean-point-in-polygon`) | Runs 100% client-side or in serverless functions at $0 cost—no paid GIS server needed. |
| **AI / LLM API** | **Google Gemini API (Free Tier - Gemini Flash)**, **Groq Free Tier**, or **OpenRouter Free Models** | Cache AI grid analyses in the database by `(water_body_id, fishing_type, target_species, season)` so repeated queries for the same lake/species cost 0 tokens. |
| **Database & Geo** | **Supabase (Free Tier PostgreSQL + PostGIS)** or **Neon (Free Tier Postgres + PostGIS)** | Keep within free storage limits (500MB). Store geospatial geometries efficiently. |
| **Auth** | **Supabase Auth** / **Better-Auth** (Free) | Email/Password + Google OAuth on free tier. |
| **Photo Storage** | **Supabase Storage** (1GB free) or **Cloudflare R2** (10GB/month free, zero egress) | Compress & resize angler catch photos client-side (WebP, max 1200px, <200KB) before upload to multiply free storage capacity by 10x. |
| **Hosting & CI/CD** | **Vercel (Hobby Free)** or **Cloudflare Pages / Workers (Free)** + **GitHub Actions** | Avoid paid background workers or dedicated VMs during MVP. |

## Mandatory Cost-Saving Practices
1. **Client-Side Image Compression**: Always convert uploaded catch photos to WebP before hitting storage buckets.
2. **AI Response Caching**: Store generated grid recommendations in the DB and serve cached results before invoking the LLM again.
3. **Rate Limiting**: Protect AI endpoints against abuse using per-user/IP rate limits.
