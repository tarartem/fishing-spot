# ADR 0001: Record Architecture Decisions

- **Status**: Accepted
- **Date**: 2026-11-10

## Context
We are building the **Fishing Spot** application using an **Agent-First** and **Spec-Driven Development (SDD)** methodology with a strict **$0 MVP budget**. Both human developers and AI agents need a clear audit trail of why specific technologies, APIs, and patterns were chosen.

## Decision
We will keep Architecture Decision Records (ADRs) in `docs/architecture/adr/` numbered sequentially (`0001`, `0002`, etc.) for every significant technical decision (Frontend/Backend framework, Map SDK, Database provider, AI model provider, Auth, and Deployment target).

## Consequences
- Agents can read ADRs to understand technical constraints before proposing changes.
- When transitioning from the $0 MVP to the post-MVP funded phase, we can supersede MVP ADRs cleanly.
