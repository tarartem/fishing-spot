# 00 — Product Vision & MVP Scope

> **Status**: `Draft — Pending Discovery Input`  
> **Owner**: Product / Engineering  
> **Last Updated**: 2026-11-10

---

## 1. Problem Statement
Anglers exploring a new or unfamiliar water body (lake, river, reservoir, or coastal shoreline) struggle to answer three fundamental questions:
1. **Where on this water body should I actually cast or set up?** (Given the water type, my fishing technique, and the fish species I am targeting).
2. **Is it legal/permitted to fish in that specific zone?** (Protected reserves, private banks, seasonal bans, dam proximity rules).
3. **What have other anglers actually caught here?** (Verified community reviews, spot conditions, and catch photos).

## 2. Target Audience (Personas)
- **The Explorer Angler**: Visits a new lake, river, or coastline and wants immediate tactical guidance on high-probability sectors without spending hours scouting blind.
- **The Specialist Angler**: Targets specific species (e.g., pike on spinning lures, carp on feeder rigs, sea bass from rocky shores) and wants spots tailored to their gear and method.
- **The Community Contributor**: Shares catch photos, spot feedback, bank accessibility notes, and local restriction updates.

## 3. Core Value Proposition
1. **Select a Water Body on a Free Map**: Click or draw a region on an open map (OpenStreetMap / MapLibre / Leaflet).
2. **AI Tactical Grid Overlay**: The system divides the water body into a smart spatial grid (`A1..Zn`) and uses advanced AI prompting + environmental/map features to highlight top-ranked grid cells and exact pin locations with detailed fishing descriptions.
3. **Context-Aware Filtering**: Accounts for **Sea vs. Freshwater**, **Fishing Technique**, **Target Species**, and **Restricted Zones**.
4. **Community Proof**: Anglers leave reviews, ratings, and photos of their fishing results directly tied to spots.

## 4. MVP Scope ($0 Budget) vs. Post-MVP (Funded)

| Capability | MVP ($0 Budget) | Post-MVP (Budget Available) |
| :--- | :--- | :--- |
| **Map & Water Body Selection** | Free OSM vector/raster tiles + Overpass water polygon detection + bounding box grid | High-res satellite imagery, bathymetric depth contour maps (Navionics/C-Map integration) |
| **AI Spot Advisor** | Free-tier LLM (e.g., Gemini Flash) + spatial grid prompt + DB caching | Multi-agent weather/barometric pressure/tide live integration + fine-tuned vision analysis of satellite tiles |
| **Fishing Restrictions** | OSM protected area tags (`leisure=nature_reserve`, `access=no`) + community-reported flags + regional rules DB | Official government fishery API integrations & real-time license purchasing links |
| **Reviews & Photos** | Spot ratings, text feedback, client-compressed catch photos on free cloud storage | AI fish species recognition & size estimation from photos, leaderboards, social feed |
| **Platform** | **Next.js (TypeScript, Tailwind CSS) Mobile-First Web / PWA** on Vercel Free Tier | Native iOS & Android offline-capable mobile apps |

## 5. Locked-In Discovery Decisions & Remaining Questions
- **Target Geography (Locked)**: **Europe (EU countries)** — European freshwater & coastal species, OSM + European protected areas (`Natura 2000` / national reserves) + regional rules.
- **Primary Platform & Stack (Locked)**: **Next.js (TypeScript, App Router, Tailwind CSS) + Supabase (Postgres/PostGIS, Auth, Storage) + MapLibre GL JS (OpenFreeMap/OSM + Turf.js) + Gemini 2.5 Flash Free Tier**.
- `[TBD-01]` **Initial Launch Country/Countries in Europe**: Should we prioritize 1–3 specific EU countries first (e.g., Poland, Germany, Netherlands, Spain, Sweden, UK, etc.) for localized regulations & UI languages?
- `[TBD-02]` **Guest vs. Authenticated Flow**: Can anonymous visitors run AI water body analyses (e.g., 3 free searches/day) before signing in, while requiring login to leave reviews/photos?
- `[TBD-03]` **Grid Granularity & Interaction**: Should the AI select cells automatically across the entire water body, or can the angler also click a specific grid cell (e.g., `C4`) to ask the AI for a deep-dive analysis of that exact sector?
