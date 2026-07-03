# Carbonify — Deployment

> How to ship the frontend (Vercel) and the backend (Supabase migrations + Edge Functions + PayMongo webhook). For the system map see [ARCHITECTURE.md](ARCHITECTURE.md); for schema/RPCs see [DATABASE_AND_RPCS.md](DATABASE_AND_RPCS.md).

There are **two independently deployable surfaces**: the SPA on Vercel, and the Supabase backend (SQL + Edge Functions). They can be released separately, but respect the ordering notes in §4.

---

## 1. Frontend — Vercel

- Framework: **Vite** (config in `vercel.json`).
- **Build command:** `npm run build`  ·  **Output directory:** `dist/`.
- `vercel.json` already sets the SPA rewrite (`/(.*) → /index.html`) and cache headers. No server runtime — it's a static build.

### Frontend env vars (set in Vercel → Project → Settings → Environment Variables)

Only `VITE_`-prefixed vars reach the browser. **Never** put a secret key here.

| Var | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | yes | Supabase anon (public) key. |
| `VITE_PAYMONGO_PUBLIC_KEY` | yes | PayMongo **public** key (client-side only). |
| `VITE_SUPABASE_FUNCTIONS_URL` | optional | Override for the Edge Functions base URL. |
| `VITE_SUPABASE_PROJECT_REF` | optional | Project ref (used to derive URLs). |
| `VITE_API_BASE_URL` | optional | External API base, if configured. |
| `VITE_GA_TRACKING_ID`, `VITE_SENTRY_DSN`, `VITE_ENABLE_ANALYTICS`, `VITE_ENABLE_ERROR_REPORTING`, `VITE_ENABLE_PERFORMANCE_MONITORING` | optional | Telemetry toggles. |

> A companion `docs/dev/ENVIRONMENT_VARIABLES.md` should hold the authoritative, per-environment values; keep secrets out of the repo (`.env`/`.env.local` are git-ignored).

Deploy: push to the tracked branch (Vercel auto-builds), or `vercel --prod`. **PayMongo cannot reach `localhost`** — to test the real payment/webhook round-trip use a **Vercel preview deployment** (a public HTTPS origin) rather than the dev server.

---

## 2. Backend — Supabase migrations

Migrations are **hand-applied in the Supabase SQL Editor** — there is no CLI tracking and the live schema drifts. **Do not run `supabase db push`.** See [DATABASE_AND_RPCS.md §4](DATABASE_AND_RPCS.md#4-migration-process-hand-applied--drift-is-expected).

Procedure:

1. Run `supabase/diagnostics/schema_catchup_audit.sql` (read-only) in the SQL Editor to see what's missing on the target DB. Empty result = current.
2. Apply any new migration file(s) from `supabase/migrations/` by pasting them into the SQL Editor, oldest-first. All are idempotent (safe to re-run).
3. If the audit flagged missing **columns/FKs**, apply `20260626000700_schema_catchup.sql`. If it flagged a missing **table**, apply that table's own migration.
4. Re-run the audit to confirm it's clean.

**RLS financial lockdown** (`supabase/cutover/lockdown_financial_writes.sql`) is **already applied to the live DB** — the financial tables are server-write-only. It is idempotent; only re-run it if the audit or `reconcile_financials()` suggests write policies reappeared.

---

## 3. Backend — Edge Functions

Deployed with the Supabase CLI. The two PayMongo functions have npm shortcuts (both use `--no-verify-jwt` — they verify auth themselves: the user JWT in checkout, the HMAC signature in the webhook):

```bash
npm run deploy:paymongo      # supabase functions deploy paymongo-checkout --no-verify-jwt
npm run deploy:webhook       # supabase functions deploy paymongo-webhook  --no-verify-jwt

# Worker functions (gated by a shared x-worker-secret, so also --no-verify-jwt):
supabase functions deploy process-payouts    --no-verify-jwt
supabase functions deploy account-deletion   --no-verify-jwt

# Reviewer notification email:
supabase functions deploy send-approval-email
```

### Edge Function secrets

Set with `supabase secrets set KEY=value` (or the dashboard → Edge Functions → Secrets). `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

| Secret | Used by | Purpose |
|---|---|---|
| `PAYMONGO_SECRET_KEY` | checkout, webhook | PayMongo secret key (create sessions / read payments). |
| `PAYMONGO_WEBHOOK_SECRET` | webhook | HMAC signing secret to verify webhook authenticity. |
| `ALLOW_UNSIGNED_WEBHOOKS` | webhook | `true` **only** for local dev (accept unsigned). Leave unset in prod — default is fail-closed. |
| `CREDIT_SUPPLIER` | webhook | Supplier adapter for the fulfillment saga (defaults to `mock`). |
| `PAYOUT_WORKER_SECRET` | process-payouts | Shared secret required in the `x-worker-secret` header. |
| `ACCOUNT_DELETION_SECRET` | account-deletion | Shared secret required in the `x-worker-secret` header. |
| `RESEND_API_KEY` | send-approval-email | Resend API key for outbound email. |
| `SUPABASE_SERVICE_ROLE_KEY` | all (platform-injected) | Service-role key — bypasses RLS to call the money RPCs. |

The worker functions (`process-payouts`, `account-deletion`) are meant to run **on a schedule (cron) or by an admin**, never publicly — they reject any request without the correct `x-worker-secret`.

---

## 4. PayMongo webhook registration

1. Deploy `paymongo-webhook` first (§3).
2. Webhook URL: **`https://<PROJECT_REF>.supabase.co/functions/v1/paymongo-webhook`**.
3. In the PayMongo dashboard (Developers → Webhooks) register that URL and subscribe to **`checkout_session.payment.paid`** (the handler also accepts `checkout.payment.paid` / `payment.paid`).
4. Copy the webhook's signing secret into the `PAYMONGO_WEBHOOK_SECRET` Edge Function secret.

Notes:
- **PayMongo cannot call `localhost`.** Use a deployed function URL (a Vercel preview origin for the redirect pages + the real Supabase function URL for the webhook).
- If the webhook throws repeatedly, PayMongo auto-disables it — check `webhook_events.error` and `reconcile_financials()` (`webhook_stuck`) to diagnose. See [../MONEY_CUTOVER_STATUS.md](../MONEY_CUTOVER_STATUS.md).

---

## 5. Release checklist

- [ ] Frontend builds clean: `npm run build` (and `npm run lint:check`, `npm run test:run`).
- [ ] Vercel env vars set for the target environment (§1); no secret keys among the `VITE_` vars.
- [ ] `schema_catchup_audit.sql` returns empty on the target Supabase DB (§2).
- [ ] Any new migrations applied idempotently, oldest-first, and re-audited clean.
- [ ] Financial-table RLS lockdown confirmed present (only SELECT policies on the four financial tables).
- [ ] Edge Functions deployed (`deploy:paymongo`, `deploy:webhook`, plus workers/email as needed).
- [ ] All Edge Function secrets set for this project (§3); `ALLOW_UNSIGNED_WEBHOOKS` **unset** in prod.
- [ ] PayMongo webhook registered for `checkout_session.payment.paid` and `PAYMONGO_WEBHOOK_SECRET` matches (§4).
- [ ] Smoke test the money path on a **preview/prod origin** (not localhost): card purchase, wallet purchase, wallet top-up, subscription.
- [ ] `reconcile_financials()` returns **zero rows** post-smoke-test.

**Related:** `docs/dev/SETUP.md` (local dev), `docs/dev/ENVIRONMENT_VARIABLES.md`, `docs/dev/TESTING.md`, `docs/dev/SECURITY.md`, and [../REAL_WORLD_GOLIVE_PLAYBOOK.md](../REAL_WORLD_GOLIVE_PLAYBOOK.md).
