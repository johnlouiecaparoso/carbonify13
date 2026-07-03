# Local Development Setup

How to get Carbonify running on your machine, connected to a Supabase project and a PayMongo test account.

See also: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) · [../dev/README.md](README.md) · [../SYSTEM_GUIDE.md](../SYSTEM_GUIDE.md) · [../PAYMENTS_ARCHITECTURE.md](../PAYMENTS_ARCHITECTURE.md)

## Prerequisites

- **Node** `^20.19.0 || >=22.12.0` (see `engines` in `package.json`) and npm
- A **Supabase project** (free tier is fine) — you need its URL, anon key, and service-role key
- A **PayMongo test account** — for `PAYMONGO_SECRET_KEY` and, once you deploy the webhook, `PAYMONGO_WEBHOOK_SECRET`
- The **Supabase CLI** (bundled as a dev dependency, `supabase@^2`) — only needed to deploy edge functions; it is **not** used for migrations

## 1. Install dependencies

```bash
git clone <repo-url> ecolink
cd ecolink
npm install
```

## 2. Configure environment variables

Carbonify reads Vite `VITE_*` variables from a root `.env` / `.env.local`. The setup scripts (`scripts/setup/*.js`) read the root `.env` specifically. Create one with at least:

```bash
# Frontend (read via import.meta.env in src/config/*.js and src/services/*)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_REF=your-project-ref
# Optional: explicit functions base URL (otherwise derived from the project ref)
VITE_SUPABASE_FUNCTIONS_URL=https://your-project-ref.functions.supabase.co

# Used by scripts/setup/setup-test-accounts.js (server-side, NOT exposed to the browser)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

The anon key is public by design (it is shipped to the browser). The **service-role key is a secret** — it is only used by Node setup scripts and edge functions, never bundled into the frontend. See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) for the complete list, including optional analytics/monitoring vars.

`src/services/supabaseClient.js` validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at runtime and will warn (and run in a limited, no-database mode) if they are missing or still placeholders.

## 3. Point at Supabase and apply the database schema

> **Important — migrations are applied BY HAND.** There is no CLI migration tracking in this project, so the live database drifts from `supabase/migrations/`. **Do not run `supabase db push`.**

1. Open the **Supabase SQL Editor** for your project.
2. Apply the SQL from `supabase/migrations/` in filename (timestamp) order. Files are written to be idempotent so re-running is safe.
3. Verify the schema with the read-only diagnostic:
   - Run `supabase/diagnostics/schema_catchup_audit.sql` in the SQL Editor. It reports every expected table, drift-prone column, foreign key, and key function that is **missing**. An empty result means the schema is current. Map any missing item back to the migration that creates it.
   - `supabase/diagnostics/phase0_schema_check.sql` is an older, narrower check.
4. Financial-write lockdown lives in `supabase/cutover/lockdown_financial_writes.sql` — apply it as part of the money-path cutover (see `../MONEY_CUTOVER_STATUS.md`).

You can sanity-check the connection and expected core tables (read-only) with:

```bash
npm run setup:supabase
```

This script (`scripts/setup/setup-supabase.js`) tests the connection, checks for core tables, and points you at the SQL to run. It does **not** create schema.

## 4. Deploy / set edge functions and their secrets

The edge functions live in `supabase/functions/`: `paymongo-checkout`, `paymongo-webhook`, `process-payouts`, `account-deletion`, and `send-approval-email`.

Deploy the payment functions:

```bash
npm run deploy:paymongo   # supabase functions deploy paymongo-checkout --no-verify-jwt
npm run deploy:webhook    # supabase functions deploy paymongo-webhook  --no-verify-jwt
```

Set the function **secrets** in Supabase (Project Settings → Edge Functions → Secrets, or `supabase secrets set`). These are read via `Deno.env.get(...)` and are **never** committed:

| Secret | Used by |
| --- | --- |
| `PAYMONGO_SECRET_KEY` | `paymongo-checkout`, `paymongo-webhook` |
| `PAYMONGO_WEBHOOK_SECRET` | `paymongo-webhook` (signature verification) |
| `PAYOUT_WORKER_SECRET` | `process-payouts` |
| `ACCOUNT_DELETION_SECRET` | `account-deletion` |
| `SUPABASE_SERVICE_ROLE_KEY` | all functions (privileged DB writes) |
| `SUPABASE_URL` | all functions |
| `SUPABASE_ANON_KEY` | `paymongo-checkout` |
| `CREDIT_SUPPLIER` | `paymongo-webhook` (defaults to `mock`) |
| `ALLOW_UNSIGNED_WEBHOOKS` | `paymongo-webhook` — set `true` only for local/dev; default is fail-closed |

Register the deployed `paymongo-webhook` URL in your PayMongo dashboard so payment events reach it.

## 5. Seed test accounts

```bash
npm run setup:accounts
```

`scripts/setup/setup-test-accounts.js` uses `SUPABASE_SERVICE_ROLE_KEY` (falling back to the anon key if unset) to create four accounts, each with a profile and a wallet:

| Role | Email | Password |
| --- | --- | --- |
| admin | `admin@carbonify.test` | `admin123` |
| verifier | `verifier@carbonify.test` | `verifier123` |
| general_user | `user@carbonify.test` | `user123` |
| project_developer | `developer@carbonify.test` | `developer123` |

These are development credentials only — never seed them against a production project.

## 6. Run the app and tests

```bash
npm run dev          # http://localhost:5173

npm run test:run     # Vitest unit tests (145)
npm run test:e2e     # Playwright e2e (needs the app running / a base URL)
npm run lint:check   # ESLint without --fix
```

## Troubleshooting

- **App boots but nothing loads from the database / console warns about Supabase config.** `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing or still a placeholder. The client logs guidance and continues in a limited mode. Fix `.env.local` and restart `npm run dev` (Vite only reads env at start).
- **`setup:accounts` fails with "Missing Supabase environment variables".** It needs a root `.env` with `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Payments don't complete when testing locally.** PayMongo delivers webhook events to a public HTTPS URL — it **cannot reach `localhost`**. To test the full purchase/settlement flow you must exercise it against a **deployed preview** with the `paymongo-webhook` function deployed and its URL registered in PayMongo. Locally you can set `ALLOW_UNSIGNED_WEBHOOKS=true` on the function for manual/dev event replay, but never in production.
- **Schema errors (missing table/column/function) at runtime.** The hand-applied DB has drifted. Run `supabase/diagnostics/schema_catchup_audit.sql` and apply the missing migrations in the SQL Editor. Do not use `supabase db push`.
- **`npm run format` broke the build.** Prettier reformats multi-statement inline Vue handlers into shapes the compiler rejects. Don't run it casually — see `docs/DEFERRED_BACKLOG.md`.

## Related developer docs

[ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE_AND_RPCS.md](DATABASE_AND_RPCS.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [TESTING.md](TESTING.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md)
