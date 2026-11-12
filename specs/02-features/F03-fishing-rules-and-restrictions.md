# F03 — Spain Fishing Rules, Protected Areas & Restricted Zones (3-Tier Hybrid)

> **Status**: `Approved`  
> **Module**: `src/modules/restrictions/`  
> **Geographic Focus (MVP)**: **Spain (`ES`)**  
> **Last Updated**: 2026-11-10

---

## 1. User Story
**As an** angler fishing in Spain,  
**I want to** know the exact name of the water body being reviewed and see whether it (or any sector inside my selected grid) is a restricted area, nature reserve, dam safety zone, or permit-controlled *Coto de Pesca*,  
**So that** I always fish legally and safely in compliance with Spanish national and Autonomous Community regulations.

## 2. Three-Tier Spain Restriction Lookup Engine ($0 MVP)

### Tier 1: Curated Spanish Waters & Autonomous Community Database
Checks [`db/seed/poland-spain-waters.ts`](../../db/seed/poland-spain-waters.ts) and [`src/modules/restrictions/restriction-service.ts`](../../src/modules/restrictions/restriction-service.ts) for:
- Specific reservoir/river restrictions (e.g., *Presa de Cortes*, *Presa de Tous*, *Reserva Natural Fluvial*, *Parque Natural de L'Albufera*, *Embalse de Mequinenza*).
- Autonomous Community (*Comunidad Autónoma*) license rules (supporting both Spanish and English Nominatim state names, e.g., `Castile and León` → `Castilla y León`, `Galicia`, `Catalonia` → `Cataluña`, `Andalusia` → `Andalucía`, `Aragon` → `Aragón`, `Valencian Community` → `Comunidad Valenciana`, without ever defaulting unmatched regions to `Comunidad Valenciana`, and clearly separating free regional licenses from the paid €25 *Licencia Interautonómica*):
  - **Comunidad Valenciana**: *Licencia de Pesca Recreo* (Continental / Marítima) or *Licencia Interautonómica*, *Acotados / Zonas de Pesca Controlada (ZPC)*, Orden Veda Anual.
  - **Aragón**: *Licencia de Aragón* (or *Licencia Interautonómica*) + *Coto Social / Deportivo* ticket (e.g., Mar de Aragón / Mequinenza rules on Siluro, Lucioperca, Black Bass, night fishing prohibition).
  - **Castilla y León**: Free regional *Licencia de Pesca de Castilla y León* (*gratuita*; distinct from €25 *Licencia Interautonómica*); distinguish *Tramos Libres*, *Cotos de Pesca*, *Escenarios Deportivos-Sociales (EDS)*, and *Aguas en Régimen Especial Controlado (AREC)* requiring a free *pase de control*; include single-hook/barbless trout rules and *aparatos de flotación* (floatation device) prohibitions where applicable.
  - **Cataluña, Andalucía, Extremadura, Castilla-La Mancha, Madrid, Galicia**: Accurate regional *Licencia de Pesca* + local regime (*Coto* / *ZPC* / *AREC* / *Tramo Libre*) requirements without assuming paid *Coto/ZPC* on every water body.
- **National Invasive Species Law (*Real Decreto 630/2013 — Catálogo Español de Especies Exóticas Invasoras*)**:
  - Applies to **Black Bass (*Micropterus salmoides*)**, **Pike (*Lucio*)**, **Zander (*Lucioperca*)**, **Wels Catfish (*Siluro*)**, **Rainbow Trout (*Trucha arcoíris*, outside exempted zones)**, and **Bleak (*Alburno*)**: strict prohibition on using live fish/vertebrates as bait (*prohibido el uso de pez vivo como cebo*) and prohibition on transporting live invasive specimens between waters.

### Tier 2: Live Internet & Geospatial Protected-Area / Infrastructure Discovery
For any selected `bbox` in Spain, the system queries **Spanish & English Wikipedia GeoSearch + Article Extracts (`es.wikipedia.org` / `en.wikipedia.org`)**, **OpenStreetMap Overpass (`waterway=dam`, `man_made=dam`, `boundary=protected_area`, `boundary=administrative` + `admin_level=4`)**, and **OpenStreetMap Nominatim (`extratags`)** to detect:
1. **Protected Nature Reserves & Parks (`status = "prohibited"` or `"seasonal_restriction"`)**:
   - *Parque Nacional*, *Parque Natural*, *Reserva Natural*, *Reserva Fluvial*, *Refugio de Pesca*, *Espacio Natural Protegido*, *ZEPA / Natura 2000* — phrased using each Autonomous Community's own fishing regime (e.g., *Cotos / Tramos Libres / Vedados* in Galicia, *AREC / Cotos / Tramos Libres* in Castilla y León, and *Zonas de Pesca Controlada (ZPC)* only where used such as Valenciana, Cataluña, or Andalucía).
2. **Cross-Community Border Waters**:
   - When Nominatim points or Overpass `admin_level=4` boundary ways indicate the selected crop spans an Autonomous Community boundary (e.g., Galicia / Castilla y León on Sil reservoirs), warn anglers to confirm which bank they fish from before relying on a single regional license or regime (*Tramo Libre* vs *AREC*).
3. **Hydroelectric Dams, Weirs & Nuclear/Industrial Safety Zones (`status = "prohibited"`)**:
   - *Presa*, *Embalse (muro de presa)*, *Aliviadero* (spillway), *Azud*, *Central Hidroeléctrica*, *Central Nuclear* (e.g., *Central Nuclear de Cofrentes* — strict 100m–500m security exclusion buffer; general CyL 15m / reservoir-specific 50–200m dam exclusion buffer).

### Tier 3: AI Regulatory Synthesis & Mandatory Legal Disclaimer
- The AI receives the verified water body name, Autonomous Community, and Tier 1 + Tier 2 restriction findings, and outputs a structured `restriction_check` block (`status`, `summary`, `permits_required`, `prohibited_zones_warning`, `regulations_list`, `verified_sources`, and mandatory `disclaimer`).
- Any detected dam wall or strict nature reserve is flagged so the AI never places a recommended fishing spot inside a prohibited safety buffer.
