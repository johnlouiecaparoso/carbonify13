# Carbonify — Live Deployment Guide (real money · real users)

> **Purpose:** step-by-step to take Carbonify from sandbox to **production with LIVE
> PayMongo keys and real users**, securely.
> **Platform:** Vue 3 frontend on **Vercel** · **Supabase** (Postgres + Edge Functions) ·
> **PayMongo** payments. Commands are written for **Windows PowerShell**.
> Companion: [SECURITY_CLOSEOUT_CHECKLIST.md](SECURITY_CLOSEOUT_CHECKLIST.md) ·
> [dev/ENVIRONMENT_VARIABLES.md](dev/ENVIRONMENT_VARIABLES.md) ·
> [PAYMENTS_ARCHITECTURE.md](PAYMENTS_ARCHITECTURE.md)

---

## 0. Do NOT skip — the go/no-go gate

Real money must not be enabled until **all** of these are true:

- [ ] All 6 money flows reconcile to **0** in sandbox (card, wallet top-up, wallet buy, cart, retire, subscription).
- [ ] `paymongo-reconcile` reports **`discrepancy_count: 0`** (after running `paymongo-resettle` to heal the 6 orphaned intents).
- [ ] Rate limiting + **velocity caps** deployed and proven to block. ✅ (done 2026-07-04/07)
- [ ] `profiles` role/KYC lock, retire-identity, self-purchase guard applied. ✅
- [ ] Email confirmation ON; `ALLOW_UNSIGNED_WEBHOOKS` unset; Sentry live. ✅
- [ ] **Independent penetration test passed.** ⛔ **This is the last hard blocker.**
- [ ] CSP switched to enforcing (Step 8).
- [ ] (Recommended) `project-documents` bucket switched to private + signed URLs — sensitive legal docs.

> **Business/legal (parallel track, required to lawfully hold funds in PH):** registered
> legal entity, licensed PSP/EMI arrangement with PayMongo, BIR registration, DPO/AMLA
> compliance, and (for issued credits) an accredited verifier (VVB). Confirm these with
> counsel before taking public money.

---

## 1. Rename the deployment to "carbonify" (Vercel dashboard)

The project is currently linked as the Vercel project **`ecolink`** (`.vercel/repo.json`).
Renaming is a dashboard action — it also changes the default `*.vercel.app` domain.

1. Vercel → your team → **Project `ecolink`** → **Settings → General**.
2. **Project Name** → change to `carbonify` → **Save**. The default domain becomes
   `carbonify-<hash>.vercel.app` (old `ecolink-*.vercel.app` URLs stop resolving).
3. (Recommended) **Settings → Domains** → add your real domain, e.g. `app.carbonify.com` or
   `carbonify.com`, and set it as **Production**. Point DNS as Vercel instructs.
4. After renaming, re-link locally so the CLI cache matches:
   ```powershell
   vercel link
   ```

> **Not changed in code (intentionally):** internal storage keys still contain `ecolink`
> in `src/services/supabaseClient.js`, `src/store/cartStore.js`, `src/constants/cart.js`.
> Renaming them would **sign out / empty the cart of every existing user** (they key
> browser localStorage). Leave them; they are invisible to users.

---

## 2. Supabase — database & storage

1. **Apply every migration** in `supabase/migrations/` in filename order via the SQL
   Editor (all are idempotent). Confirm the newest are applied:
   - `20260704000200_velocity_caps.sql` ✅
   - `20260707000000_project_documents_bucket.sql` ✅
2. **Verify no schema drift** — run `supabase/diagnostics/schema_catchup_audit.sql`.
   An **empty result = current**. If a table is reported missing, apply that table's migration.
3. **Confirm storage buckets exist**:
   ```sql
   select id, public from storage.buckets where id in ('avatars','project-documents');
   ```
4. **Auth settings** (Dashboard → Authentication):
   - Email confirmations **ON**; custom SMTP (Resend) configured and verified.
   - Add your production domain to **URL Configuration → Redirect URLs** (OAuth/password reset).
5. **Backups:** enable **Point-in-Time Recovery (PITR)** and daily backups (paid plan).
   Consider a connection pooler (Supavisor) if you expect concurrency.

---

## 3. Frontend environment variables (Vercel → Production)

Set these in **Vercel → Project → Settings → Environment Variables** (scope: **Production**).
All `VITE_*` are compiled into the browser bundle (public by design).

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your Supabase anon key |
| `VITE_SUPABASE_PROJECT_REF` | `<ref>` (e.g. `fmngptolarydbgrtltnd`) |
| `VITE_SENTRY_DSN` | your Sentry DSN (enables error tracking) |
| `VITE_SENTRY_ENVIRONMENT` | `production` |
| `VITE_ENABLE_ERROR_REPORTING` | `true` |

> Never put a real secret behind `VITE_` — anything `VITE_*` ships to the browser.
> After changing env vars you must **redeploy** for them to take effect.

---

## 4. Edge-function secrets — switch PayMongo to LIVE

Set in **Supabase → Project Settings → Edge Functions → Secrets** (or `supabase secrets set`).
**This is the actual "go live" switch** — replace the test PayMongo values with **LIVE** ones.

1. In the **PayMongo dashboard**, complete business activation/KYB and switch to **Live
   mode**, then copy the **live** secret key (`sk_live_...`).
2. Set / update secrets:

| Secret | Live value |
| --- | --- |
| `PAYMONGO_SECRET_KEY` | **`sk_live_...`** (was `sk_test_...`) |
| `PAYMONGO_WEBHOOK_SECRET` | set in Step 5 after creating the live webhook |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (highly sensitive) |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key (used by `paymongo-checkout`) |
| `PAYOUT_WORKER_SECRET` | strong random string |
| `RECONCILE_WORKER_SECRET` | strong random string (reconcile + resettle) |
| `ACCOUNT_DELETION_SECRET` | strong random string |
| `RESEND_API_KEY` | Resend key (email) |
| `CREDIT_SUPPLIER` | leave unset (`mock`) until a real registry partner is wired |

3. **Confirm `ALLOW_UNSIGNED_WEBHOOKS` is NOT set** (webhooks must fail-closed in prod).

---

## 5. Deploy Edge Functions + recreate the LIVE webhook

Deploy each function (log in + link first: `supabase login`, `supabase link --project-ref <ref>`).
**Verify-JWT flags matter** — keep them as below:

```powershell
# User-facing / provider-called: validate identity or signature INTERNALLY → no gateway JWT
supabase functions deploy paymongo-checkout   --no-verify-jwt
supabase functions deploy paymongo-webhook    --no-verify-jwt
# Worker functions: authorized by their own shared secret header → no gateway JWT
supabase functions deploy process-payouts     --no-verify-jwt
supabase functions deploy paymongo-reconcile  --no-verify-jwt
supabase functions deploy paymongo-resettle   --no-verify-jwt
supabase functions deploy account-deletion    --no-verify-jwt
# Authenticated-only: keep gateway JWT ON (closes the old open email relay)
supabase functions deploy send-approval-email
```

**Recreate the webhook against your LIVE PayMongo account** (test-mode webhooks do NOT fire
for live payments):
1. Create a webhook in PayMongo (live) pointing to
   `https://<ref>.supabase.co/functions/v1/paymongo-webhook`, event
   **`checkout_session.payment.paid`**.
2. Copy the returned webhook **signing secret** into `PAYMONGO_WEBHOOK_SECRET` (Step 4) and
   redeploy `paymongo-webhook`.
3. Health check (should return HTTP 401/400 for an unsigned request — i.e. it's fail-closed):
   ```powershell
   curl.exe -i -X POST "https://<ref>.supabase.co/functions/v1/paymongo-webhook" -H "Content-Type: application/json" -d "{}"
   ```

---

## 6. Deploy the frontend to production

1. Merge **PR #2** (`feature-user-onboarding-ux` → `main`).
2. Vercel auto-deploys `main` to Production (or `vercel deploy --prod`). Confirm the build
   uses the Production env vars from Step 3.
3. Open the production URL and confirm the app loads, login works, and the marketplace renders.

---

## 7. 🔴 First live-money smoke test (do once, with a tiny real amount)

On the **production** site, signed in as a real test user:
1. Buy the cheapest possible credit (or top up ₱20) with a **real card**.
2. Confirm it settles: certificate/ownership appears, and in SQL Editor:
   ```sql
   select * from public.reconcile_financials();  -- expect 0 rows
   ```
3. If it settled but nothing appears, run the heal:
   ```powershell
   curl.exe -i -X POST "https://<ref>.supabase.co/functions/v1/paymongo-resettle" -H "x-worker-secret: <RECONCILE_WORKER_SECRET>" -H "Content-Type: application/json" -d "{\"lookback_days\": 1}"
   ```
4. **Refund** the test purchase from the admin Refunds console; re-check `reconcile_financials()` = 0.
5. Confirm the payment shows in your **PayMongo live** dashboard.

Only after this passes should you invite real users.

---

## 8. Flip CSP to enforcing

1. On the production URL, open DevTools console and click through every page (map, checkout,
   registry, all role dashboards).
2. If there are **no** `Content-Security-Policy-Report-Only` violations, edit
   [`vercel.json`](../vercel.json): rename the header key
   `Content-Security-Policy-Report-Only` → **`Content-Security-Policy`**, commit, redeploy.
3. Re-test checkout and the map after enforcing (these use PayMongo + OSM/Sentry origins
   already allow-listed in the policy).

---

## 9. Ongoing operations (after launch)

- **Daily reconciliation:** schedule `paymongo-reconcile` (cron / Supabase scheduled job)
  and alert if `discrepancy_count > 0`; heal with `paymongo-resettle`.
- **Monitoring:** watch Sentry Issues; set up an alert rule for new/error spikes.
- **Payouts:** run/schedule `process-payouts` for seller withdrawals (KYB-gated).
- **Backups:** verify PITR is retaining snapshots; test a restore once.
- **Velocity caps:** review `app_settings.velocity_daily_caps` for your real risk appetite.
- **Secrets hygiene:** rotate worker secrets periodically; never commit them.

---

## 10. Rollback plan

- **Frontend:** in Vercel → Deployments, **Promote** the previous good deployment (instant).
- **Payments kill-switch:** if something is wrong with live money, set
  `PAYMONGO_SECRET_KEY` back to the **test** key and redeploy `paymongo-checkout` +
  `paymongo-webhook` (new checkouts revert to sandbox; nothing new is charged). Disable the
  live PayMongo webhook.
- **Database:** use PITR to restore to a timestamp before the incident (last resort — this
  affects all data).

---

## Quick reference — the minimal "flip to live" sequence

1. Pentest passed ✅ + business/legal cleared.
2. PayMongo → Live mode → copy `sk_live_...`.
3. Supabase secrets: set `PAYMONGO_SECRET_KEY = sk_live_...`.
4. Create live webhook → set `PAYMONGO_WEBHOOK_SECRET` → redeploy `paymongo-webhook` + `paymongo-checkout`.
5. Merge to `main` → Vercel production deploy.
6. ₱20 real purchase → `reconcile_financials()` = 0 → refund.
7. Flip CSP to enforcing.
8. Open the doors. 🎉
