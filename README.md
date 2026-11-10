# Fishing Spot — AI-Powered Angler Assistant & Community

An **Agent-First**, **Spec-Driven (SDD)** application that helps anglers find optimal fishing spots on any water body using interactive open maps, spatial grid analysis, and AI-powered recommendations tailored to water type, fishing technique, target species, and local fishing restrictions—backed by community reviews and catch photos.

---

## Key Capabilities (MVP)
1. **Water Body Selection & Spatial Grid**: Pick a lake, river, pond, or coastal area on a free interactive map; automatically generate a tactical coordinate grid over the water body.
2. **AI Fishing Spot Advisor**: Analyzes the water body grid, shoreline features, water type (freshwater vs. saltwater), fishing style, and target fish species to plot recommended spots on the map with tactical descriptions.
3. **Restrictions & Regulations Awareness**: Highlights restricted zones, nature reserves, or seasonal rules so anglers fish responsibly and legally.
4. **Angler Reviews & Catch Photos**: Community-driven spot reviews, ratings, catch reports, and photo galleries.

---

## Project Methodology
- **Agent-First Architecture**: Configured via [`AGENTS.md`](./AGENTS.md) and `.agents/skills/` so AI coding agents operate with full context and strict guardrails.
- **Spec-Driven Development (SDD)**: All product requirements, domain rules, data models, and API contracts live in [`specs/`](./specs/) and drive implementation.
- **$0 MVP Budget**: Architected around zero-cost open-source mapping (OpenStreetMap / MapLibre / Leaflet) and generous free-tier cloud infrastructure (Database, Auth, Photo Storage, AI inference, and Hosting).

---

## Quick Links
- **Agent Constitution**: [`AGENTS.md`](./AGENTS.md)
- **Product Vision**: [`specs/00-product-vision.md`](./specs/00-product-vision.md)
- **Domain & Grid Rules**: [`specs/01-domain-and-rules.md`](./specs/01-domain-and-rules.md)
- **Feature Specs**: [`specs/02-features/`](./specs/02-features/)
- **Data & API Specs**: [`specs/03-data-and-api/`](./specs/03-data-and-api/)
- **AI Prompt & Schema**: [`prompts/`](./prompts/)
- **Engineering Processes**: [`docs/processes/`](./docs/processes/)
