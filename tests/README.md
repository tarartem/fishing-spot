# Test Suites (`tests/`)

Organized according to [`docs/processes/testing-strategy.md`](../docs/processes/testing-strategy.md):

- `tests/unit/` — Spatial grid math, coordinate bounds checking, restriction filtering.
- `tests/integration/` — Database queries, AI cache hit/miss behavior, API endpoints.
- `tests/ai-evals/` — Prompt evaluation tests validating `prompts/spot-finder-grid.prompt.md` against `prompts/schemas/spot-recommendation.schema.json`.
- `tests/e2e/` — End-to-end user flows (map water body selection -> AI grid spots -> review & photo upload).
