# Carbonify Developer Docs

Index of developer documentation for Carbonify (repo name **ecolink**). Start with the root [README.md](../../README.md) for the project overview, then use the docs below.

## Getting started

- **[SETUP.md](SETUP.md)** — local development setup: install, `.env.local`, apply the DB schema (hand-applied SQL), deploy edge functions, seed test accounts, run the app and tests.
- **[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)** — complete reference for frontend `VITE_*` variables and Edge-function secrets, plus what's public vs. secret.

## Reference

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system architecture and how the pieces fit together.
- **[DATABASE_AND_RPCS.md](DATABASE_AND_RPCS.md)** — schema, RLS, and `SECURITY DEFINER` RPCs.
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — build and deploy (frontend + edge functions).
- **[TESTING.md](TESTING.md)** — Vitest unit tests and Playwright e2e.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — workflow, linting, and conventions.
- **[SECURITY.md](SECURITY.md)** — security model, secrets, and the server-authoritative money path.

## Elsewhere in the repo

- User guide: [../user-guide/README.md](../user-guide/README.md)
- System overview: [../SYSTEM_GUIDE.md](../SYSTEM_GUIDE.md)
- Payments architecture: [../PAYMENTS_ARCHITECTURE.md](../PAYMENTS_ARCHITECTURE.md)
- Money cutover: [../MONEY_CUTOVER_STATUS.md](../MONEY_CUTOVER_STATUS.md), [../YOUR_CUTOVER_STEPS.md](../YOUR_CUTOVER_STEPS.md)

> **Migrations are applied by hand** in the Supabase SQL Editor — there is no CLI migration tracking, and the live DB drifts from `supabase/migrations/`. Do not run `supabase db push`; use `supabase/diagnostics/schema_catchup_audit.sql` to detect drift. See [SETUP.md](SETUP.md).
