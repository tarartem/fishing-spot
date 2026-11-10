# SDD & Git Workflow Process

## 1. Spec-Driven Development (SDD) Flow
Every feature or change follows this strict sequence:
1. **Spec Update (`specs/`)**: Define or update the feature specification, domain rules, database schema, and API contract.
2. **Prompt / Schema Sync (`prompts/`)**: If AI behavior is touched, update the prompt markdown and JSON schema first.
3. **Test Definition (`tests/`)**: Write unit, integration, or AI evaluation tests matching the spec's `Given / When / Then` acceptance criteria.
4. **Implementation (`src/`, `db/`)**: Write modular code to make all tests pass.
5. **Documentation Sync (`docs/`)**: Record any new ADRs or operational notes.

---

## 2. Git Branching & Commit Strategy
- **Main Branch (`main`)**: Always deployable, protected by CI checks.
- **Feature Branches**:
  - `spec/<feature-slug>` — Spec authoring & discovery updates.
  - `feat/<feature-slug>` — Feature implementation tied to a spec (e.g., `feat/F01-map-waterbody-selection`).
  - `fix/<issue-slug>` — Bug fixes with regression tests.
- **Conventional Commits**:
  - `spec(F02): define AI grid recommendation JSON schema`
  - `feat(map-grid): implement water body bounding box grid generator`
  - `test(ai-advisor): add schema validation evals for shore fishing`
  - `chore(ci): configure github actions test workflow`
