# Source Code Directory (`src/`)

Application code is organized into domain modules aligned with `specs/02-features/`:

- `src/modules/map-grid/` — Map rendering, water body polygon resolution, and spatial grid (`A1..Zn`) generation (`F01`).
- `src/modules/ai-advisor/` — AI prompt assembly, LLM client, JSON schema validation, and caching (`F02`).
- `src/modules/restrictions/` — Fishing regulations, OSM protected area checks, and community restriction flags (`F03`).
- `src/modules/reviews/` — Angler spot reviews, star ratings, catch logs, and client-side WebP photo compression/uploads (`F04`).
- `src/shared/` — Shared UI components, types, database client, and configuration utilities.
