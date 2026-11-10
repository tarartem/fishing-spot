# ADR 0002: $0 MVP Tech Stack, Auth & Regional Target

- **Status**: Accepted
- **Date**: 2026-11-10

## Context
Through our Spec-Driven Development (`/grill-me`) discovery session, we finalized all architectural, product, and domain decisions for the **$0/month MVP** of **Fishing Spot**.

## Decisions

1. **Application Framework, UI & Hosting**:
   - **Next.js (App Router, TypeScript, Tailwind CSS)** deployed on **Vercel (Free Hobby Tier)**.
   - **Full-Screen Map-First UI**: `100%` viewport interactive map with a floating search bar and collapsible side drawer (desktop) / swipeable bottom sheet (mobile).
   - **Language & i18n**: **English** UI and AI outputs for MVP, structured with translation keys and locale parameters for future localization (Polish, Spanish, etc.).

2. **Database, ORM, Auth & Photo Storage**:
   - **Supabase Free Tier (PostgreSQL + PostGIS)** accessed via **Drizzle ORM** + **Zod** runtime schema validation, with versioned SQL migrations in `db/migrations/`.
   - **Email-Only Authentication (Supabase Auth)**: Email + Password / Magic Link registration (avoiding third-party OAuth registration overhead for MVP).
   - **Tiered Access Model**:
     - **Guests**: See water body boundaries, descriptions, and restriction overviews on map click (no pre-seeded spots shown). Can run up to **2 AI grid analyses** with basic output only.
     - **Registered Users**: Immediately see pre-seeded/existing spot pins and community reviews on water body click; get unlimited full AI grid analyses, single-cell (`D5`) micro-analyses, review/photo posting, and restriction reporting.
   - **Supabase Storage**: Stores angler catch photos compressed client-side to `<200KB` WebP before upload.

3. **Mapping, Adaptive Grid & 3-Layer Restrictions**:
   - **MapLibre GL JS** + **OpenFreeMap / OpenStreetMap** vector tiles (`$0`, no API key required).
   - **Overpass API** + **Turf.js**:
     - Small lakes (`< 5km`) are gridded in full; large reservoirs, long rivers (e.g., Vistula, Ebro), and sea coastlines are clipped to the viewport / `~2.5km` tactical sector around the clicked point so grid cells (`A1..H8`) stay `100m–300m`.
   - **3-Layer Hybrid Restrictions**:
     1. Deterministic OSM blocking of nature reserves (`Natura 2000`, `leisure=nature_reserve`), dams/weirs (`50m` buffer), and `fishing=no` tags.
     2. AI regulatory summary for **Poland (`PL`)** and **Spain (`ES`)** permits & seasonal rules with mandatory legal disclaimer.
     3. Community restriction reporting on cells/pins.

4. **AI Model Provider & Strictly Structural Caching**:
   - **Google Gemini API Free Tier (`gemini-2.5-flash`)** behind a provider-agnostic AI adapter.
   - **Strictly Structural MVP Prompt**: Uses map structure, water type, fishing technique, target species, access mode, season, and community review summaries (no external live weather API calls in MVP), maximizing PostgreSQL cache hits (`grid_analyses` & `cell_micro_analyses`).

5. **Testing Pyramid**:
   - **Vitest** for Unit Tests (`tests/unit/`), Integration Tests (`tests/integration/`), and AI Prompt Schema Evals (`tests/ai-evals/`).
   - **Playwright** for End-to-End Tests (`tests/e2e/`).
