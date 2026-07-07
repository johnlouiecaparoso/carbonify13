# 👉 Your Action Items (owner-only steps)

> 🗄️ **Superseded (2026-07-03).** The owner steps here are done or rolled into the current plan.
> For the live owner action list (security close-out + launch), use **[GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md)**
> §4 and **[dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md)** §9 (go/no-go checklist).
> Current state: **[HANDOFF.md](HANDOFF.md)**.

> ## ✅ 2026-07-01 items complete · 🚦 new cutover testing open (2026-07-02)
> §1 (4 features click-through), §2 (payout + refund edges, reconcile = 0), and
> §3 (account-deletion deploy) are all **done and verified** on the pre-cutover path.
>
> 🚦 **New (2026-07-02):** the *server-authoritative money cutover* is now being
> tested. ✅ **card purchase + subscription** verified end-to-end (0 drift, after
> fixing the `credit_ownership.status` blocker + re-enabling the auto-disabled
> PayMongo webhook). ⬜ **Still to do — Step 4 B–E:** wallet top-up, buy with
> wallet, cart (2 items), retire credits. See [YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md).
> The **P1 RLS lockdown stays gated** until B–E pass.
>
> **Still to run:** migrations `20260701000200` (admin refund) and `20260701000300`
> (admin KYC/role set) if not yet applied. _(Cutover migrations `20260701000400`,
> `20260701000500`, `20260702000000` are applied.)_

> **Created:** 2026-07-01. These are the things only you can do — they need a
> running app, real accounts/roles, or the Supabase/PayMongo dashboards. Claude
> can't click dashboards or hold your keys. Do them top-to-bottom; paste back any
> error and it gets diagnosed.

---

## 1. Click-through the 4 new features (do first — cheapest, highest value)

These are built + unit-tested but **never run in a real browser**. One pass each
turns them from "code-complete" into "verified" (or surfaces a bug cheaply).

**Run the app locally** — it talks to the real Supabase, so auth + data work:
```bash
npm run dev          # open the printed URL, usually http://localhost:5173
```
(Local dev is enough for all four — only real payments/webhooks need the deployed app.)

### 1a. Seller earnings by project
- **Sign in as:** a seller (developer) who has **at least one completed sale**.
- **Go to:** `/sales` (Seller Earnings).
- **Expect:** a new **"Earnings by project"** table — one row per project with
  sales count, credits sold, gross earned, and last-sale date; sorted by gross.
- **If you have no sales yet:** it should read *"No completed sales yet."* (that's
  correct, not a bug) — come back after a sandbox purchase in step 2/3 below.

### 1b. Purchases pagination
- **Sign in as:** a buyer with some completed purchases.
- **Go to:** **Retire Credits** in the top nav (or profile menu → Credits → Retire
  Credits) → **Purchases** tab. *(Fixed 2026-07-01: `/retire` was redirecting to
  `/wallet` and was unreachable; it now opens the real Retire page.)*
- **Expect:** the tab label shows the **true total** (e.g. "Purchases (23)"); if
  there are **more than 10**, a **Previous / Next** bar appears (10 per page).
- **Check:** click Next/Previous — rows change; the **"View Certificate"** button
  still shows on purchases that have a certificate.
- **Note:** with ≤10 purchases you won't see the pager (expected). It still
  confirms the page loads from the server.

### 1c. Structured additionality / permanence
- **Sign in as:** a project developer.
- **Go to:** Submit Project → scroll to **"Credibility (Optional)"**.
- **Do:** pick an **Additionality basis**, type a **Permanence (years)** (e.g. 100),
  pick a **Reversal risk**, then submit.
- **Expect:** on the project's **detail page**, the **Verification** trust card now
  shows **Additionality / Permanence / Reversal risk** rows.
- **Also test edit:** open the project in edit mode → the three fields are
  pre-filled → change one → save → detail page reflects the change.

### 1d. Saved searches + price alerts
- **Sign in as:** any buyer.
- **Go to:** `/marketplace`. Set a filter (a category, or a max price, or a keyword).
- **Do:** click **"Save search"** → a success toast appears and a **chip** shows up
  under the filters. Click the chip to re-apply it; click the **×** to delete it.
- **Test the alert:** with a saved search active, have a **new matching listing
  appear** (list one from another developer account, or lower an existing
  listing's price to under your saved ceiling), then **reload `/marketplace`** →
  you should get a **bell notification** ("New match for …"). Reloading again does
  **not** re-alert for the same listing (dedupe by design).

**Done when:** each of 1a–1d behaves as described, no console errors.

---

## 2. Money-path edges (payout + refund) — where to approve KYB & refund

> ✅ **Now clickable (2026-07-01):** admins have **KYB Review** (`/admin/kyb`) and
> **Refunds & Disputes** (`/admin/refunds`) consoles — both in the profile menu →
> Workspace. Requires the `20260701000200_admin_refund_rpc.sql` migration.
> The SQL below is kept as a fallback.

### Approve KYB (to unblock a seller payout)
1. **Seller submits (now clickable):** as the seller, **Seller Earnings** (`/sales`)
   → the "Business verification required" banner → **Verify your business** → fill
   the form → **Submit for review**.
2. **Admin approves:** profile menu → **KYB Review** (`/admin/kyb`) → find the
   application → **Approve**. This sets `kyb_verified` and unlocks their withdrawals.

Fallback / seed an application directly in SQL (no longer required):

```sql
-- 1. Find the seller's user id (profiles.id) — e.g. by email:
select id, email, role from public.profiles where email = 'seller@example.com';

-- 2. Create a KYB application for them (skip if one already exists):
insert into public.kyb_applications (user_id, business_name, business_type, status)
values ('<seller_user_id>'::uuid, 'Test Business', 'corporation', 'pending')
returning id;

-- 3. Approve it (sets profiles.kyb_verified = true, which the Withdraw gate checks):
select public.review_kyb_application('<application_id>'::uuid, true, 'approved for testing');
```
Then, as the seller: **Seller Earnings** (top nav) → **Withdraw** → run the worker
`npx supabase functions invoke process-payouts` → `payout_requests` should go
`requested → processing → settled`.

### Refund a purchase
- **UI:** profile menu → **Refunds & Disputes** (`/admin/refunds`) → **Transactions**
  tab → find a `completed` transaction → **Refund** → confirm. The **Open disputes**
  tab lets you resolve buyer-opened disputes (Refund / Reject).

Fallback — refund a completed transaction directly in SQL:

```sql
-- 1. Find a completed transaction to refund:
select id, buyer_id, seller_id, total_amount, status
from public.credit_transactions where status = 'completed'
order by created_at desc limit 20;

-- 2. Refund it (compensating reversal — never edits the original rows):
select public.refund_purchase('<transaction_id>'::uuid, 'test refund');
```
*(A full buyer-dispute → admin-resolve path also exists via `open_dispute` /
`resolve_dispute(dispute_id, true, notes)`, but the direct call above is enough
to test the money math.)*

### After every money movement
```sql
select * from public.reconcile_financials();   -- MUST return 0 rows
```

**Done when:** payout settles, refund reverses, and `reconcile_financials()` stays
at **0 rows** throughout. (Deeper reference: [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md) → Step E.)

---

## 3. Deploy the account-deletion worker (DPA)

The erasure worker is written but **not deployed**.

> **You hit `403 … does not have the necessary privileges` on the CLI deploy.**
> That's the same privilege issue as the earlier `paymongo-webhook` deploy — the
> logged-in CLI account isn't an **Owner/Administrator** of the project. (The
> "Docker is not running" warning is harmless — platform deploys don't use local
> Docker.) Two ways to fix:

**Option A — deploy from the Dashboard (sidesteps the 403):**
1. Supabase Dashboard → **Edge Functions** → **Deploy a new function** (via the
   editor).
2. Name it exactly **`account-deletion`**.
3. Paste the contents of [`supabase/functions/account-deletion/index.ts`](../supabase/functions/account-deletion/index.ts) → **Deploy**.

**Option B — fix CLI privileges:** log the CLI into the project **Owner** account,
then retry:
```bash
npx supabase login          # log in as the project Owner/Administrator
npx supabase link --project-ref fmngptolarydbgrtltnd
npx supabase functions deploy account-deletion --no-verify-jwt
```

**Then, either way:**
- Set the secret: Dashboard → Edge Functions → **Secrets** →
  `ACCOUNT_DELETION_SECRET` = any strong random string.
- Test: as a user, **Profile → Privacy & Data → Request account deletion**
  (type `DELETE`) → as admin, run the worker on that request → the auth user is
  removed and personal rows are erased (financial rows are retained by design).

**Done when:** a deletion request is processed end-to-end.

---

## Priority order

1. **§1 click-throughs** — no dashboards, ~30 min, converts 4 features to verified.
2. **§2 money edges** — needs a seller/admin account + the dashboards.
3. **§3 account-deletion deploy** — quick, unblocks the DPA promise.

Everything after this needs an external partner (registry, AML data, PSP) or
ops/legal — see [NOW_IMPLEMENTATION_PLAN.md](NOW_IMPLEMENTATION_PLAN.md).
Paste back any error or unexpected output and it'll be diagnosed.
