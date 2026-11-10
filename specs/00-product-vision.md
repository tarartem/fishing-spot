# 00 — Product Vision & MVP Scope

> **Status**: `Approved`  
> **Owner**: Product / Engineering  
> **Last Updated**: 2026-11-10

---

## 1. Problem Statement
Anglers exploring a water body (lake, river, reservoir, or coastal shoreline) struggle to answer three fundamental questions:
1. **Where on this water body should I actually cast or set up?** (Given the water type, my fishing technique, and the fish species I am targeting).
2. **Is it legal/permitted to fish in that specific zone?** (Protected reserves, private banks, dam buffers, seasonal bans, regional permits).
3. **What have other anglers actually caught here?** (Verified community reviews, spot conditions, and catch photos).

---

## 2. Target Audience & Initial Market
- **Initial Launch Countries**: **Spain** and **Poland** (built on Pan-European OpenStreetMap/Overpass geospatial coverage).
  - **Poland**: Rich freshwater lakes, lowland rivers (Vistula, Oder, Bug), reservoirs, PZW districts, nature reserves (*Rezerwaty przyrody*), and species like Pike, Zander, Perch, Carp, Bream, Tench, Trout.
  - **Spain**: Major inland reservoirs (*embalses* like Ebro, Orellana, Cijara for Black Bass, Zander, Carp, Wels Catfish), mountain trout rivers, and Mediterranean/Atlantic coastal sea fishing (Sea Bass, Gilthead Seabream, Mackerel, Surfcasting & Rock Spinning), plus regional *Licencias* and *Cotos de Pesca*.
- **Language Strategy**: **English** UI and AI outputs for the MVP, built with an **i18n-ready architecture** (translation keys & locale-aware AI prompts) for future localization into Polish, Spanish, and other European languages.

---

## 3. User Tiers: Guest vs. Registered Angler

| Capability | Guest (Unauthenticated) | Registered Angler (Email Auth) |
| :--- | :--- | :--- |
| **Authentication Method** | Anonymous session (Cookie / IP rate-limited) | **Email Registration** (Supabase Email/Password or Magic Link — zero OAuth setup overhead) |
| **Click Water Body on Map** | Sees water body boundary, general description, and restriction overview. **Does NOT see pre-seeded/existing spot pins.** | Immediately sees water body boundary, description, restriction overview, **AND all pre-seeded / previously discovered spot pins & community reviews**. |
| **AI Spatial Grid Analyses** | Limited to **2 AI grid analyses total**; output restricted to **basic info** (grid overlay + top pin location & brief summary; tactical lure/bait advice locked). | **Unlimited AI grid analyses** with full tactical descriptions, bait/lure presentation tips, and confidence scores. |
| **Single-Cell (`D5`) Micro-Analysis** | Locked (Prompts Email registration) | **Unlocked**: Click any individual grid cell on the water body for an on-demand AI deep-dive of that sector. |
| **Spot Reviews & Catch Photos** | Locked (Prompts Email registration) | **Unlocked**: View all community reviews/photos and attach new reviews, ratings, and catch photos to water body pins. |
| **Restriction Reporting** | View-only | **Unlocked**: Flag cells/spots with community restriction updates. |

---

## 4. MVP Scope ($0 Budget) vs. Post-MVP (Funded)

| Capability | MVP ($0 Budget — Locked Stack) | Post-MVP (Budget Available) |
| :--- | :--- | :--- |
| **UI Layout** | **Full-screen Map-First Web/PWA** (100% viewport map + floating search bar + side drawer on desktop / bottom sheet on mobile) | Native iOS & Android offline-capable mobile apps |
| **Map & Spatial Grid** | **MapLibre GL JS** + **OpenFreeMap/OSM** vector tiles + **Overpass API** + **Turf.js** adaptive grid (whole lake if `<5km`; viewport/`2-3km` sector clip for rivers, large reservoirs & sea coasts) | High-res satellite imagery, bathymetric depth contour maps (Navionics/C-Map integration) |
| **AI Spot Advisor** | **Google Gemini 2.5 Flash (Free Tier)** via provider-agnostic adapter + **strictly structural prompt** (shoreline, inflows, reeds, technique, species, season, community reviews) + **Drizzle/Postgres caching** | Live weather/wind/barometric pressure (Open-Meteo) + tide APIs + satellite vision analysis |
| **Fishing Restrictions** | **3-Layer Hybrid**: (1) Deterministic OSM reserve/dam/no-fishing tag blocking, (2) AI summary of Poland/Spain permit & seasonal rules + legal disclaimer, (3) Community restriction flags | Official government fishery API integrations & real-time permit links |
| **Reviews & Photos** | Attached to water body spot pins, client-side WebP compression (`<200KB`) stored in **Supabase Storage Free Tier** | AI fish recognition & length/weight estimation from photos, leaderboards |
