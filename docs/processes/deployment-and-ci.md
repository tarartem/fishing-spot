# Deployment & CI/CD Pipeline ($0 MVP)

## 1. Continuous Integration (GitHub Actions)
Every push and pull request runs `.github/workflows/ci.yml` (within GitHub Actions' free tier):
1. **Spec & Schema Integrity Check**: Ensures JSON schemas in `prompts/schemas/` are valid.
2. **Lint & Typecheck**: Static analysis across `src/` and `tests/`.
3. **Unit & Integration Tests**: Runs fast deterministic tests (mocking live LLM calls in standard CI to preserve free token quotas).
4. **Build Verification**: Verifies production build succeeds.

## 2. Environments ($0 Budget)
- **Local Development**: Local app server + local/development Supabase/Postgres instance + `.env.local`.
- **Preview Deployments**: Automatic preview URL per Pull Request (via Vercel Hobby or Cloudflare Pages free tier).
- **Production**: Auto-deployed from `main` branch after CI passes.

## 3. Database Migrations
- All schema changes are versioned as SQL migrations inside `db/migrations/`.
- Applied automatically or via CLI prior to production release.
