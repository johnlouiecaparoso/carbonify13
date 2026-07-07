# Phase 1 — Money-Path Verification Runbook

> ✅ **Historical / superseded (2026-07-03).** The money path is **done** — proven end-to-end and
> hardened (RLS lockdown applied; all six flows reconcile to 0). This early runbook is kept for
> history; the completed runbook of record is **[YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md)** and
> the status is **[MONEY_CUTOVER_STATUS.md](MONEY_CUTOVER_STATUS.md)**. For next steps see
> **[GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md)**.

> Goal: prove the financial core actually works end-to-end in sandbox before real users.
> Run top to bottom. SQL goes in the **Supabase SQL Editor** (runs as a privileged role, which the
> reconcile/balance objects require). Use PayMongo **test mode** keys + test cards throughout.

---

## Step 0 — Secrets & keys ✅ (git already clean)

`.env` is **not** tracked and **not** in git history; `.gitignore` covers it — so no key leak via git,
no rotation needed on that account.

Still confirm in the **Supabase dashboard → Edge Functions → Secrets** that these are set:
- [ ] `PAYMONGO_SECRET_KEY` (test key)
- [ ] `PAYMONGO_WEBHOOK_SECRET`
- [ ] `PAYOUT_WORKER_SECRET`
- (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — no action.)

---

## Step 1 — Apply migrations (in order)

In the SQL Editor, run any not-yet-applied migration **in this order**. Re-running is safe
(idempotent). The order matters because two of them re-create `process_marketplace_purchase` — the
later one must win:

1. `20260615000100_project_comments.sql`
2. `20260615000200_app_settings.sql`  ← re-creates the purchase RPC **with the fee** (must be after `…000000`)
3. `20260615000400_verification_checklist.sql`

(Already applied earlier: `…000000_subscriptions`, `…000300_watchlist`.)

**Confirm the fee-aware RPC is the live one:**
```sql
select pg_get_functiondef('public.process_marketplace_purchase(uuid,text)'::regprocedure)
  like '%platform_fee_percent%' as fee_logic_present;  -- expect: true
```

---

## Step 2 — Deploy edge functions

```bash
npm run deploy:paymongo      # paymongo-checkout
npm run deploy:webhook       # paymongo-webhook
supabase functions deploy process-payouts --no-verify-jwt
```
- [ ] In **PayMongo dashboard → Webhooks**, register the webhook URL
  `https://<project-ref>.supabase.co/functions/v1/paymongo-webhook` for event **`checkout.payment.paid`**.

---

## Step 3 — Sandbox purchase (the critical test)

1. Sign in as a buyer (KYC level high enough to trade — see `min_kyc_level_to_trade`).
2. Marketplace → add a listing to the **cart** → **Proceed to checkout** (or Buy on a single listing).
3. Pay with a PayMongo **test card** (e.g. `4343 4343 4343 4345`, any future expiry/CVC).
4. You should land back on the payment callback as success.

**Verify in SQL — expect each to be populated/consistent:**
```sql
-- the intent should be 'paid'
select id, purpose, amount, status, provider_payment_id, created_at
from payment_intents order by created_at desc limit 5;

-- a completed transaction tied to that intent
select id, status, total_amount, transaction_fee, platform_fee_percentage, payment_reference
from credit_transactions order by created_at desc limit 5;

-- buyer now owns the credits
select user_id, quantity, status, ownership_status, transaction_id
from credit_ownership order by created_at desc limit 5;

-- seller net held in escrow
select seller_id, amount, status, hold_until from escrow_holds order by created_at desc limit 5;

-- balanced double-entry legs for the purchase
select entry_id, account, direction, amount, ref_type, ref_id
from ledger_entries order by created_at desc limit 10;
```

**The two health checks — both must pass:**
```sql
-- 1) drift report: MUST return 0 rows
select * from public.reconcile_financials();

-- 2) account balances: inspect; paymongo_clearing debit should equal seller_payable + platform_revenue
select account, currency, total_debits, total_credits, balance
from public.ledger_account_balances order by account;
```

- [ ] `reconcile_financials()` returns **0 rows**
- [ ] credits appear in the buyer's portfolio in the app, **no console errors**
- [ ] if platform fee > 0 in System Config, a `platform_revenue` ledger credit appears

---

## Step 4 — Subscription activation

1. Go to `/upgrade`, choose **Pro**, pay with a test card.
2. After the webhook fires, verify:
```sql
select id, plan, plan_expires_at from profiles where id = '<your-user-id>';   -- plan='pro', expiry ~30d out
select purpose, status, metadata from payment_intents
where purpose = 'subscription' order by created_at desc limit 3;             -- status='paid'
```
- [ ] plan flips to `pro` with a future `plan_expires_at`

---

## Step 5 — KYB-gated payout

1. As admin, approve the seller's KYB (`profiles.kyb_verified = true` via the KYB flow).
2. As the seller, go to Wallet → **Withdraw** (should be blocked if KYB not verified).
3. Trigger the worker: `supabase functions invoke process-payouts` (or its scheduled run).
```sql
select id, status, amount, failure_reason from payout_requests order by created_at desc limit 5;
select * from public.reconcile_financials();   -- still 0 rows
```
- [ ] payout moves `requested → processing → settled` (or a clean `failed` with reason)

---

## Step 6 — Cart (multi-item) + refund/dispute

- [ ] Add **2 listings** to the cart → checkout → pay item 1 → returns to cart → pay item 2; both land in portfolio
- [ ] Process a **refund** (compensating ledger entries) and confirm `reconcile_financials()` stays at 0 rows

---

## Done when
- [ ] Every checkbox above is ticked
- [ ] `reconcile_financials()` returns 0 rows after each money movement
- [ ] No console errors during purchase / subscription / payout

➡️ Then proceed to **Phase 2** (Sentry + payment tests + the P2→P1 financial-write lockdown).

> Note: PayMongo webhooks can't reach `localhost`. Run this against the deployed app (Vercel) or use a
> tunnel (e.g. ngrok) pointed at the functions URL, otherwise settlement won't fire and only the
> checkout *initiation* will be testable locally.
