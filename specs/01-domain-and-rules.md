# 01 — Domain Model & Business Rules

> **Status**: `Approved`  
> **Last Updated**: 2026-11-10

---

## 1. Domain Glossary

| Term | Definition |
| :--- | :--- |
| **Angler** | A user of the application (`guest` or `registered` via Email auth). |
| **Water Body** | A hydrological feature selected on the map (lake, pond, reservoir/*embalse*, river segment, canal, or sea coastal stretch). |
| **Tactical Sector** | For small lakes (`< 5km` diameter), the entire water body polygon; for large reservoirs, rivers, or sea coastlines, a clipped `~2–3km` radius / viewport sector around the user's clicked point. |
| **Spatial Grid** | A 2D coordinate matrix of labeled cells (`A1` through `H8`, each `100m–300m` wide) generated deterministically by `Turf.js` over the Tactical Sector. |
| **Grid Cell** | A single square cell of the Spatial Grid carrying deterministic metadata: center `[lat, lng]`, polygon bounds, water/shoreline intersection, OSM structural tags, and restriction status. |
| **Water Body Pin (Spot)** | A specific fishing location on a Water Body (placed inside a Grid Cell by the AI Advisor or pre-seeded/reviewed by the community). |
| **Spot Review / Catch Log** | Feedback attached to a Water Body Pin by a registered angler, including star rating (1–5), text notes, fish caught, and client-compressed WebP catch photos. |

---

## 2. Taxonomy & Classification Rules

### 2.1 Water Types (`WaterType` — Core Input #1)
- `freshwater`: Lakes, ponds, reservoirs (*embalses*), rivers, streams, canals (auto-detected from OSM `natural=water` / `waterway=*`).
- `sea`: Coastal beaches, rocky shores, cliffs, piers, jetties, harbors, estuaries (auto-detected from OSM `natural=coastline` / marine bounds).

### 2.2 Fishing Techniques (`FishingType` — Core Input #2)
- `spinning`: Lure fishing / predator angling (soft plastics, crankbaits, spoons, jigs, surface lures, rockfishing).
- `feeder_bottom`: Feeder, method feeder, ledgering, bottom rigs.
- `carp`: Specialist carp angling (boilies, hair rigs, long-session ledgering).
- `float`: Match, waggler, pole, bolognese, or bobber fishing.
- `fly`: Fly fishing (dry fly, nymphing, streamers).
- `surfcasting`: Beach / coastal long-distance shore casting.

### 2.3 Target Fish Species (`TargetSpecies` — Core Input #3, Focus: Poland & Spain)
- **Freshwater Predators**:
  - Northern Pike (`pike`), Zander / Pike-perch (`zander`), European Perch (`perch`), Largemouth Black Bass (`black_bass` — major in Spain), Brown/Rainbow Trout (`trout`), Wels Catfish (`catfish`), Asp (`asp`), Chub (`chub`), Grayling (`grayling`).
- **Freshwater Coarse & Carp**:
  - Common/Mirror Carp (`carp`), Common Bream (`bream`), Tench (`tench`), Roach (`roach`), Barbel (`barbel`), Crucian Carp (`crucian_carp`).
- **Sea & Coastal (Spain Mediterranean/Atlantic & Poland Baltic)**:
  - European Sea Bass (`sea_bass`), Gilthead Seabream (`dorada`), Atlantic Mackerel (`mackerel`), White Seabream (`sargo`), Bluefish (`bluefish`), Garfish (`garfish`), Sea Trout (`sea_trout`), European Flounder (`flounder`), Atlantic Cod (`cod`), Grey Mullet (`mullet`).
- **Wildcard**:
  - `any` ("Any species suitable for my fishing technique").

### 2.4 Access Mode (`AccessMode` — Core Input #4)
- `shore`: Fishing from the bank, beach, rocky shore, pier, or wading.
- `boat`: Fishing from a boat, kayak, or belly boat.

### 2.5 Season (`Season` — Auto-Filled from Current Date, Editable)
- `spring` | `summer` | `autumn` | `winter`

### 2.6 Restriction Status (`RestrictionStatus`)
- `allowed`: Open for recreational fishing (standard national/regional license still required).
- `permit_required`: Specific fishery permit required (e.g., Polish PZW district permit / *Zezwolenie*, Spanish *Coto de Pesca*, or private commercial fishery).
- `seasonal_restriction`: Subject to spawning season closures (*okresy ochronne* / *vedas*) or catch-and-release mandates.
- `prohibited`: Strictly forbidden (`Natura 2000` strict reserve, *Rezerwat przyrody*, *Reserva Natural*, dam/weir 50m–100m safety zone, military/port zone, or `fishing=no`).
- `unknown`: No verified spatial restriction tag found; angler must verify local signage.

---

## 3. Core Business Invariants
1. **Guest vs. Registered Visibility**:
   - Guests clicking a water body see its polygon, description, and restriction overview, plus up to 2 basic AI grid runs. Guests never receive pre-seeded community spots or full tactical advice payloads from the API.
   - Registered users clicking a water body immediately see all existing/pre-seeded spot pins and community reviews on that water body.
2. **No Prohibited Spot Recommendations**:
   - Any grid cell intersecting a `prohibited` zone is deterministically flagged before AI invocation and can never be recommended as a fishable spot.
3. **Water-Bound & Shore-Consistent Coordinates**:
   - Every spot pin `[lat, lng]` must reside inside a valid water/shoreline grid cell.
   - When `access_mode === "shore"`, recommended cells must have `shore_accessible === true`.
4. **Purely Structural + Community Context Prompting (MVP)**:
   - MVP AI prompts rely strictly on deterministic map structure, water body metadata, angler inputs, and aggregated community reviews—maximizing PostgreSQL cache hit rates (`grid_analyses`) and keeping LLM costs at `$0`.
