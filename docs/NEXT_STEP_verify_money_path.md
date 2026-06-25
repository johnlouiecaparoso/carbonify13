# 👉 NEXT STEP — Verify the Money Path (do this before any new feature)

> **Why this is #1:** All of Phase 1 (checkout, ledger, escrow) and Phase 2 (payouts, refunds) are
> written and pass locally, but **have never run for real even once.** One successful sandbox cycle
> either proves the foundation or surfaces bugs — *before* everything else is built on top of it.
>
> This is **live ops**: it happens in the Supabase dashboard, PayMongo dashboard, and a deployed app.
> It can't be done from the code editor. Follow this top to bottom. Tick each box.
>
> Deep SQL reference: [PHASE1_VERIFICATION_RUNBOOK.md](PHASE1_VERIFICATION_RUNBOOK.md).

**Your project:** `fmngptolarydbgrtltnd`
**Your webhook URL:** `https://fmngptolarydbgrtltnd.supabase.co/functions/v1/paymongo-webhook`

---

## 📍 Progress (updated 2026-06-25)

- ✅ CLI logged in + linked to the project
- ✅ Deployed `process-payouts` (new) and `paymongo-checkout` (refreshed)
- ✅ Applied the 3 migrations (fee-aware purchase RPC confirmed live)
- ✅ PayMongo webhook registered (`checkout_session.payment.paid`)
- 🐛 **Fixed a critical bug** in `paymongo-webhook` (it was ignoring every payment) — **code fixed, not yet deployed**
- 🔴 **BLOCKED:** CLI returns `403` on `secrets set` and the `paymongo-webhook` re-deploy → finish these in the **Dashboard** (see below)

### ▶️ To finish (all in the Dashboard — sidesteps the `403`)
1. **Set the 3 secrets** — Edge Functions → Secrets:
   `PAYOUT_WORKER_SECRET` = `3abdaf78e9fb629b9dcd4d23a110a7cc803440335ad304da4b0271312b16bd1f`,
   `PAYMONGO_SECRET_KEY` = your `sk_test_…`, `PAYMONGO_WEBHOOK_SECRET` = the webhook's `whsk_…`.
2. **Deploy the fixed `paymongo-webhook`** — Edge Functions → `paymongo-webhook` → edit code → paste the local
   file → Deploy. (Or confirm you're org **Owner/Administrator** and retry the CLI.)
3. Then continue to **Step D** below (the sandbox purchase).

---

## ⚠️ Before you start — prerequisites (these block everything)

- [ ] **PayMongo account in TEST mode.** Get the **test** keys (Developers → API Keys): the secret
      key starts `sk_test_...`. Note your **webhook signing secret** when you create the webhook (Step C).
- [ ] **Owner access to the Supabase project** `fmngptolarydbgrtltnd` (dashboard).
- [ ] **Log the CLI into the owning account.** We previously hit a `403` because the linked CLI lacked
      privileges. Fix it once:
      ```bash
      npx supabase login          # opens browser, log in as the project owner
      npx supabase link --project-ref fmngptolarydbgrtltnd
      ```
- [ ] **A reachable app URL.** PayMongo webhooks **cannot reach `localhost`**. Use **either**:
      - your deployed app (e.g. Vercel), **or**
      - a tunnel: `npx ngrok http 5173` (run the app with `npm run dev` first) — but the **webhook itself
        always points at the Supabase functions URL above**, which is public, so a deployed *frontend*
        is only needed so the buyer can complete checkout. The function URL is reachable either way.

---

## Step A — Set the function secrets

Supabase Dashboard → **Edge Functions → Secrets**. Confirm these three exist (add if missing):

- [ ] `PAYMONGO_SECRET_KEY`  → your `sk_test_...`
- [ ] `PAYMONGO_WEBHOOK_SECRET`  → set in Step C (the value PayMongo gives you)
- [ ] `PAYOUT_WORKER_SECRET`  → any strong random string (used to protect the payout worker)

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't add them.)

---

## Step B — Apply the 3 pending migrations (in this exact order)

Supabase Dashboard → **SQL Editor**. Open each file from `supabase/migrations/`, paste its contents, Run.
**Order matters** — the 2nd one re-creates the purchase function *with the platform fee*, so it must run
after the others:

- [ ] 1. `20260615000100_project_comments.sql`
- [ ] 2. `20260615000200_app_settings.sql`   ← re-creates the purchase RPC **with the fee**
- [ ] 3. `20260615000400_verification_checklist.sql`

Then confirm the fee-aware version is live (should return **true**):
```sql
select pg_get_functiondef('public.process_marketplace_purchase(uuid,text)'::regprocedure)
  like '%platform_fee_percent%' as fee_logic_present;
```

> Tip: instead of pasting, you can run `npx supabase db push` to apply all pending migrations — but
> review `npx supabase migration list` first so you know exactly what will run.

---

## Step C — Deploy the edge functions + register the webhook

From the project folder:
```bash
npm run deploy:paymongo                                  # paymongo-checkout
npm run deploy:webhook                                   # paymongo-webhook
npx supabase functions deploy process-payouts --no-verify-jwt
```

- [ ] In **PayMongo Dashboard → Developers → Webhooks → Add endpoint**:
      - URL: `https://fmngptolarydbgrtltnd.supabase.co/functions/v1/paymongo-webhook`
      - Event: **`checkout.payment.paid`**
      - Copy the **signing secret** it shows you → put it in `PAYMONGO_WEBHOOK_SECRET` (Step A).

---

## Step D — 🎯 The critical test: one sandbox purchase

1. Open the app, sign in as a **buyer** (KYC level high enough to trade).
2. Marketplace → add a listing to the **cart** → **Proceed to checkout** (or Buy a single listing).
3. Pay with a PayMongo **test card**: `4343 4343 4343 4345`, any future expiry, any CVC.
4. You should land back on the success/callback page.

Then in **SQL Editor**, run the two health checks — **both must pass**:
```sql
-- 1) Drift report — MUST return 0 rows
select * from public.reconcile_financials();

-- 2) Balances — paymongo_clearing debit should equal seller_payable + platform_revenue
select account, currency, total_debits, total_credits, balance
from public.ledger_account_balances order by account;
```

- [ ] `reconcile_financials()` returns **0 rows**
- [ ] The credits show up in the buyer's **portfolio** in the app, with **no console errors**
- [ ] `payment_intents`, `credit_transactions`, `credit_ownership`, `escrow_holds`, `ledger_entries`
      all populated (full queries in the runbook, Step 3)

**If this one step passes, the foundation is proven.** The rest below confirm the edges.

---

## Step E — Subscription, payout, cart/refund (confirm the edges)

- [ ] **Subscription:** `/upgrade` → choose **Pro** → pay test card → `profiles.plan` flips to `pro`
      with a future `plan_expires_at`.
- [ ] **KYB-gated payout:** approve the seller's KYB → seller Wallet → **Withdraw** → run the worker
      `npx supabase functions invoke process-payouts` → `payout_requests` goes
      `requested → processing → settled`.
- [ ] **Cart + refund:** add **2 listings**, checkout both; then process a **refund** and confirm
      `reconcile_financials()` is **still 0 rows**.

After **every** money movement above, re-run `select * from public.reconcile_financials();` → **0 rows**.

---

## ✅ Done when

- [ ] Every box above is ticked
- [ ] `reconcile_financials()` returns 0 rows after each money movement
- [ ] No console errors during purchase / subscription / payout

➡️ **Then, and only then:** do the gated cutover (switch the Buy UI fully to the server RPC, *then* run
`supabase/cutover/lockdown_financial_writes.sql`), and resume the roadmap at **Phase 3 — Real Credits**.

---

## 🛟 If something breaks

| Symptom | Likely cause / fix |
|---|---|
| `403` on `supabase ... deploy` / `db push` | CLI not logged in as owner → redo `npx supabase login` (prerequisites) |
| Paid, but nothing in `payment_intents` / no credits | Webhook not firing → check the URL + event in PayMongo, and `PAYMONGO_WEBHOOK_SECRET` matches |
| Webhook works on deploy but not locally | Expected — webhooks can't reach `localhost`; use the deployed app or ngrok |
| `reconcile_financials()` returns rows | Stop — drift detected. Capture the rows and the `ledger_account_balances` output before any more tests |
| Checkout blocked for the buyer | Buyer KYC below `min_kyc_level_to_trade` → raise their KYC level |

---

### What I (Claude) can and can't do here
- **Can:** fix any code/SQL bug this surfaces, adjust functions, write follow-up migrations, explain output.
- **Can't:** click in the Supabase/PayMongo dashboards, hold your test-mode keys, or deploy on your behalf
  (the CLI here lacks owner privileges — that's the `403` we hit). Run the steps; paste me any error or
  unexpected SQL output and I'll diagnose it.
