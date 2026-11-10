---
name: sdd-workflow
description: >-
  Guides the agent through the Spec-Driven Development (SDD) lifecycle for the
  Fishing Spot project. Activate this skill whenever creating a new feature,
  modifying existing behavior, designing database migrations, or planning
  implementation tasks.
---

# Spec-Driven Development (SDD) Workflow Skill

This project strictly follows **Spec-Driven Development (SDD)**. Specifications in `specs/` are the primary artifact; source code in `src/` and schemas in `db/` are derived from those specifications.

## Workflow Steps

### Phase 1: Discovery & Spec Check
1. Read `AGENTS.md` and the relevant files in `specs/`.
2. Check if any section in the relevant spec is marked `[TBD]` or ambiguous.
3. If critical requirements are missing, formulate concise, structured questions for the user before writing code.

### Phase 2: Spec Authoring / Updating
1. Create or update the feature spec in `specs/02-features/FXX-<name>.md`.
2. Ensure the spec contains:
   - **User Story & Context**
   - **Inputs & Preconditions**
   - **System Behavior & Edge Cases**
   - **Data / API Impact** (link to `specs/03-data-and-api/`)
   - **Testable Acceptance Criteria (Given / When / Then)**
3. If data models or APIs change, update `specs/03-data-and-api/database-schema.md` and `specs/03-data-and-api/api-contracts.md`.

### Phase 3: Test-First Preparation (TDD)
1. Translate each **Given / When / Then** acceptance criterion into a test case stub or failing test inside `tests/unit/`, `tests/integration/`, `tests/ai-evals/`, or `tests/e2e/`.

### Phase 4: Modular Implementation
1. Implement the feature in the appropriate domain module under `src/modules/`:
   - `map-grid`: Map interactions, water body polygons, spatial grid math.
   - `ai-advisor`: Prompt construction, LLM invocation, schema validation.
   - `restrictions`: Regulatory checks, protected zone overlays.
   - `reviews`: Community reviews, ratings, catch reports, photo storage.
2. Keep modules loosely coupled with clear TypeScript/interface boundaries.

### Phase 5: Verification & Spec Sync
1. Run the test suite, typechecker, and linter.
2. Verify that the implementation satisfies every acceptance criterion in the spec.
3. Update the spec status (`Draft` -> `Approved` -> `Implemented`).
