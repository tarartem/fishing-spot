# AGENTS.md — Agent-First Project Constitution

> **Project**: AI Fishing Spot Advisor & Angler Community  
> **Methodology**: Spec-Driven Development (SDD) & Test-Driven Development (TDD)  
> **Budget Constraint**: **$0 / month for MVP** (Free-tier services, open maps, zero-cost hosting/DB/AI tiers), scaling to paid tiers post-MVP.

---

## 1. Core Mission
We are building an AI-powered platform for anglers ("Fishing Spot"). Users select a water body on an interactive free map, specify their fishing parameters (freshwater vs. sea, fishing technique, target species), and the AI assistant overlays a **spatial grid** on the water body to pinpoint and describe the best fishing spots while accounting for **fishing restrictions/regulations**. Anglers can also review spots, log catches, and upload photos of their fishing results.

---

## 2. Agent-First Rules of Engagement

Every AI agent working in this repository MUST follow these rules:

1. **Spec-First (SDD Strictly Enforced)**
   - Never write or modify application code in `src/` or `db/` without a corresponding, up-to-date specification in `specs/`.
   - If a user request changes behavior, update the relevant spec in `specs/` **first**, verify alignment, and only then implement code and tests.
2. **Zero-Dollar MVP Guardrail**
   - Every architectural choice, library, API, map tile provider, database, storage bucket, and hosting target for the MVP **must operate within a $0 free tier** without requiring paid licenses.
   - Consult `.agents/skills/zero-cost-stack/SKILL.md` before introducing any external dependency or cloud service.
3. **Deterministic Spatial AI Outputs**
   - All LLM prompts reside in `prompts/` and are version-controlled.
   - AI responses that place grid cells or pins on the map must adhere strictly to `prompts/schemas/spot-recommendation.schema.json` and be validated at runtime (e.g., via Zod / JSON Schema) so coordinates never hallucinate outside the selected water body.
4. **Safety & Legal Disclaimer on Restrictions**
   - Fishing restriction indicators must clearly distinguish between verified regulatory data (e.g., protected nature reserves, OSM tags, official datasets) and AI-inferred guidance, reminding anglers to verify local permits.
5. **Testing & Verification**
   - Every feature requires unit tests (`tests/unit/`), integration/DB tests (`tests/integration/`), or AI prompt evaluations (`tests/ai-evals/`) before marking a task complete.

---

## 3. Repository Navigation Map (For Agents & Humans)

```text
.
├── AGENTS.md                        # Root Agent constitution & routing map (You are here)
├── README.md                        # Project overview & quickstart
├── .agents/                         # Antigravity Agent Customizations
│   └── skills/
│       ├── sdd-workflow/            # Skill: How to execute Spec-Driven Development
│       ├── ai-grid-prompting/       # Skill: Spatial grid generation & AI prompt engineering
│       └── zero-cost-stack/         # Skill: Enforcing the $0 MVP budget architecture
├── specs/                           # Single Source of Truth (SDD Specifications)
│   ├── 00-product-vision.md         # Personas, value proposition, MVP scope
│   ├── 01-domain-and-rules.md       # Domain glossary, water types, fishing styles, grid math
│   ├── 02-features/                 # Feature-level functional & acceptance specs
│   │   ├── F01-map-and-waterbody-selection.md
│   │   ├── F02-ai-grid-spot-assistant.md
│   │   ├── F03-fishing-rules-and-restrictions.md
│   │   └── F04-reviews-catches-and-photos.md
│   └── 03-data-and-api/             # Technical specifications
│       ├── database-schema.md       # Relational + Geospatial schema spec
│       └── api-contracts.md         # Endpoints, payloads, error codes
├── prompts/                         # Versioned AI Prompts & Structured Schemas
│   ├── spot-finder-grid.prompt.md   # Core prompt template for grid & spot selection
│   └── schemas/
│       └── spot-recommendation.schema.json
├── docs/                            # Engineering Documentation & Processes
│   ├── architecture/
│   │   ├── 00-system-overview.md
│   │   └── adr/
│   │       └── 0001-record-architecture-decisions.md
│   └── processes/
│       ├── sdd-and-git-workflow.md
│       ├── testing-strategy.md
│       └── deployment-and-ci.md
├── db/                              # Database migrations & seed data
│   ├── migrations/
│   └── seed/
├── src/                             # Application source code (Modular structure)
│   ├── modules/
│   │   ├── map-grid/                # Map rendering, water body polygon/bbox & grid overlay
│   │   ├── ai-advisor/              # Prompt builder, LLM client, response validator
│   │   ├── restrictions/            # Fishing regulations & restricted zone checks
│   │   └── reviews/                 # Spot reviews, ratings, catch logs & photo uploads
│   └── shared/                      # Shared UI, utilities, types, config
└── tests/                           # Automated Test Suites
    ├── unit/
    ├── integration/
    ├── e2e/
    └── ai-evals/
```

---

## 4. Development Lifecycle (SDD Loop)
1. **Discover**: Clarify open questions in `specs/` with the user.
2. **Specify**: Write/update feature and data specs in `specs/`.
3. **Design**: Record architectural decisions in `docs/architecture/adr/` and update `prompts/`.
4. **Test**: Write failing tests in `tests/` matching the acceptance criteria in `specs/02-features/`.
5. **Implement**: Build the feature inside `src/` and `db/`.
6. **Verify**: Run linter, typechecks, and test suites; ensure docs remain in sync.
