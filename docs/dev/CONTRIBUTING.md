# Contributing

How to make a change to Carbonify safely: branching, commit style, required gates, database changes, and the PR process.

Related: [TESTING.md](./TESTING.md) · [SECURITY.md](./SECURITY.md) · [SETUP.md](./SETUP.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATABASE_AND_RPCS.md](./DATABASE_AND_RPCS.md) · [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Branching

- Work on a **feature branch off `main`** (e.g. `feature-user-onboarding-ux`, `fix-cart-callback`).
- **Never commit financial logic straight to `main`.** Anything touching payments, wallet, ledger, RPCs, or the webhook goes through a branch + PR so it can be reviewed and sandbox-verified.
- PRs **target `main`**.

```bash
git checkout main && git pull
git checkout -b feature-<short-name>
```

---

## Commit messages (conventional commits)

Use a conventional-commit prefix. Keep the subject imperative and scoped.

```
<type>(<scope>): <summary>
```

Common types seen in this repo: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

Examples (real history):

```
fix(money): server-authoritative marketplace purchase settlement + webhook diagnostics
fix(retire): pass real project_id and retire across multiple ownership rows
fix(cart): store PayMongo session id on cart checkout so the callback can verify payment
docs: sync roadmap/status docs to 2026-07-02 cutover reality
```

---

## Required gates before opening a PR

All three must pass locally (they are CI-enforced too):

```bash
npm run lint:check   # ESLint — MUST be 0
npm run test:run     # Vitest — MUST be green
npm run build        # Vite — MUST pass
```

If your change touches the money path, also re-run the sandbox flows (A–F) per [TESTING.md](./TESTING.md#money-path-sandbox-runbook) and confirm `select * from reconcile_financials();` returns 0 rows.

### Prettier warning

**Do NOT run `npm run format`.** Prettier breaks the build — it reformats multi-statement inline Vue handlers and drops semicolons, which the build then rejects. ESLint uses `skip-formatting`, so Prettier is not enforced anyway. See [../DEFERRED_BACKLOG.md](../DEFERRED_BACKLOG.md) (item 5).

---

## Database changes

Migrations are **hand-applied** — there is no CLI migration tracking, so the live schema can drift from the migration files. Follow this discipline:

1. **Write idempotent SQL.** Use `create or replace function`, `create table if not exists`, `add column if not exists`, guard constraints/policies with existence checks. It may be applied more than once.
2. **Apply it via the Supabase SQL Editor** (copy-paste, click Run), not the CLI.
3. **Add a migration file for the record** under `supabase/migrations/` so the change is captured in version control (even though it was applied by hand).
4. **Run the schema audit** — `supabase/diagnostics/schema_catchup_audit.sql` — to detect drift between the live schema and the migration files.
5. **NEVER run `supabase db push`.** It assumes CLI-tracked migrations and will fight the hand-applied live schema.

> RPCs that touch money must be `security definer` with `set search_path = public` and must self-gate on `auth.uid()` / `is_admin()`. See [SECURITY.md](./SECURITY.md) and [DATABASE_AND_RPCS.md](./DATABASE_AND_RPCS.md).

---

## Money safety rule

**Never write financial tables from the browser.** Financial tables are server-write-only (RLS lockdown). All money writes go through:

- **SECURITY DEFINER RPCs** (e.g. `process_marketplace_purchase`, `process_wallet_purchase`, `update_wallet_balance_atomic`, `retire_credits_atomic`, `activate_subscription`, `refund_purchase`), or
- the **service-role PayMongo webhook** (`supabase/functions/paymongo-webhook`).

The client never sets amounts — the server derives them. If you find yourself writing an amount or a ledger/ownership row from a Vue component or a browser-side service, stop and route it through an RPC or the webhook instead.

---

## PR process

1. Push your branch and open a PR **targeting `main`**.
2. In the PR description, spell out any **operator steps a reviewer must run** that are not in the code:
   - SQL to apply in the Supabase SQL Editor (paste it, note it's idempotent).
   - Edge functions to redeploy (`npm run deploy:webhook`, `npm run deploy:paymongo`, or `supabase functions deploy <name> --no-verify-jwt`).
   - New/changed edge-function config (secrets) — name the keys; never paste secret values.
3. Confirm the gates: lint 0, `test:run` green, build passing (and money-path sandbox verified if applicable).
4. Call out schema drift risk if you changed the DB — link the migration file and note whether `schema_catchup_audit.sql` was clean.
