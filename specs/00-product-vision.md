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

## 3. Core User Journey: Guest vs. Registered Angler

> [!IMPORTANT]
> There is a clear two-level pin hierarchy on the map:
> 1. **Water Body Pins (Level 1 — Visible to Everyone)**: Pins placed over water bodies showing their names.
> 2. **Grid Fishing Spot Pins (Level 2 — Registered Users Only)**: The spatial grid (`A1..H8`) and exact fishing spot pins inside the water body showing where to catch fish.

| Stage / Capability | Guest User (Unauthenticated) | Registered Angler (Email Auth) |
| :--- | :--- | :--- |
| **1. Open the App (Map View)** | Sees the full-screen map with **Water Body Pins and their names** placed over water bodies. | Sees the full-screen map with **Water Body Pins and their names**, plus quick indicators of saved/analyzed spots. |
| **2. Click a Water Body Pin** | Sees **Basic Water Body Info**: <br>• Water body description & restriction overview<br>• **What fish species** can be caught there<br>• **Some teaser community feedback/reviews** attached to the water body<br>• **Call to Action (CTA)** to register for exact grid spots & full access.<br>*(If selecting an unindexed water body, guests can trigger up to 2 AI water-body basic summaries).* | Sees full Water Body Info **plus** immediate access to the **Spatial Grid (`A1..H8`)**, **pre-seeded / existing exact Fishing Spot Pins**, full tactical descriptions, and all community reviews & catch photos. |
| **3. Exact Fishing Spots on the Spatial Grid** | **Locked behind Email Registration CTA** (Guests cannot see the exact grid spot coordinates/pins or tactical lure/bait advice). | **Full Unlimited Access**: Generate AI spatial grids for any water type, fishing technique, target fish, and access mode; view exact spot pins on the grid; click any individual grid cell (`D5`) for a micro-analysis. |
| **4. Reviews, Feedback & Catch Photos** | Sees only a limited preview/summary of feedback on the water body pin. Cannot post reviews or view full photo galleries. | **Full Access**: Read all reviews & catch photos, and post new reviews, star ratings, and catch photos. |

---

## 4. MVP Scope ($0 Budget) vs. Post-MVP (Funded)

| Capability | MVP ($0 Budget — Locked Stack) | Post-MVP (Budget Available) |
| :--- | :--- | :--- |
| **UI Layout** | **Full-screen Map-First Web/PWA** (100% viewport map + floating search bar + side drawer on desktop / bottom sheet on mobile) | Native iOS & Android offline-capable mobile apps |
| **Map & Spatial Grid** | **MapLibre GL JS** + **OpenFreeMap/OSM** vector tiles + **Overpass API** + **Turf.js** adaptive grid (whole lake if `<5km`; viewport/`2-3km` sector clip for rivers, large reservoirs & sea coasts) | High-res satellite imagery, bathymetric depth contour maps (Navionics/C-Map integration) |
| **AI Spot Advisor** | **Google Gemini 2.5 Flash (Free Tier)** via provider-agnostic adapter + **strictly structural prompt** + **Drizzle/Postgres caching** | Live weather/wind/barometric pressure (Open-Meteo) + tide APIs + satellite vision analysis |
| **Fishing Restrictions** | **3-Layer Hybrid**: (1) Deterministic OSM reserve/dam/no-fishing tag blocking, (2) AI summary of Poland/Spain permit & seasonal rules + legal disclaimer, (3) Community restriction flags | Official government fishery API integrations & real-time permit links |
| **Reviews & Photos** | Attached to water body pins / spots, client-side WebP compression (`<200KB`) stored in **Supabase Storage Free Tier** | AI fish recognition & length/weight estimation from photos, leaderboards |
