# Testing Strategy

Our testing pyramid ensures a reliable product while keeping CI execution fast and free.

## 1. Test Layers

| Layer | Directory | Purpose | Tools (Proposed) |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | `tests/unit/` | Pure domain logic: spatial grid math (`A1..H8`), coordinate bounds validation, restriction filtering, input validation. | Vitest |
| **Integration Tests** | `tests/integration/` | Database queries, caching logic for `grid_analyses`, API route handlers, review creation & aggregation. | Vitest + Local DB / Testcontainers |
| **AI Prompt Evals** | `tests/ai-evals/` | Validates that `prompts/spot-finder-grid.prompt.md` produces JSON matching `spot-recommendation.schema.json`, respects `prohibited` cells, and honors `shore` vs `boat` constraints. | Vitest + Ajv / Zod Schema Validator |
| **End-to-End (E2E)** | `tests/e2e/` | Critical user journeys: Select water body on map -> View AI grid & pins -> Read/Submit spot review with photo. | Playwright |

## 2. Mandatory Quality Gates
- **100% Schema Validation on AI Outputs**: No AI output is ever rendered on the map without passing JSON schema + coordinate boundary checks.
- **Zero Prohibited Spot Leaks**: Automated unit & eval tests must assert that cells flagged `prohibited` are never returned in `recommended_spots`.
