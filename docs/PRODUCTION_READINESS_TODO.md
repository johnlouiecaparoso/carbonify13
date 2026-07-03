# Carbonify — Production Readiness & Roadmap TODO

> Created 2026-06-15 from the system analysis · **Updated 2026-07-02.**
> Check items off as they're completed.
>
> **Verdict (2026-07-02):** Strong, well-architected MVP. The **pre-cutover** money core
> was proven at runtime (purchase + subscription + payout + refund, 0 drift). The
> **server-authoritative cutover** (server-side purchase/top-up/retirement RPCs) is now
> **partially runtime-verified**: ✅ card purchase + subscription settle via the webhook
> (0 drift, 2026-07-02, after fixing the `credit_ownership.status` blocker), ⬜ wallet
> top-up / wallet buy / cart / retire still to test. The **P1 RLS lockdown stays gated**
> until those pass. Still missing the *trust/registry layer*. Deployable to a
> **sandbox/closed beta** now; **real-money production** also needs the legal/compliance
> track + a real registry integration.

Legend: 🔴 blocker · 🟠 important · 🟢 minor · 🏛️ business/legal (not code)

---

## Phase 1 — Verify the money path (NOW, days)

The whole financial stack (subscriptions, fee model, escrow, payouts, cart) sits on a purchase RPC +
webhook that has **never settled a real sandbox transaction**. Prove it before anything else.

- [ ] 🔴 Confirm `.env` is NOT committed; if keys are in git history, **rotate** Supabase + PayMongo keys
- [ ] 🔴 Confirm `PAYMONGO_WEBHOOK_SECRET` (and `PAYMONGO_SECRET_KEY`, `PAYOUT_WORKER_SECRET`) are set in deployed functions
- [ ] 🔴 Run all pending migrations **in order**, then re-run `…000200_app_settings` last (it re-creates the purchase RPC with the fee)
  - [ ] `20260615000100_project_comments`
  - [ ] `20260615000200_app_settings`
  - [ ] `20260615000400_verification_checklist`
  - [ ] (already run: `…000000_subscriptions`, `…000300_watchlist`)
- [x] 🔴 Sandbox purchase end-to-end: `createMarketplaceCheckout` → webhook → `process_marketplace_purchase` → credits in portfolio ✅ (2026-06-26)
- [x] 🔴 Confirm `ledger_entries` balance and `reconcile_financials()` returns 0 rows ✅
- [x] 🔴 Verify escrow hold created, then a **KYB-gated payout** request → `process-payouts` worker ✅ (2026-07-01)
- [x] 🟠 Sandbox a **subscription** checkout → webhook → `activate_subscription` flips the plan ✅
- [x] 🟠 Sandbox the **cart** sequential checkout (2 items) and a **refund/dispute** ✅ (2026-07-01) — refund console at `/admin/refunds`

## Phase 2 — Beta hardening (1–2 weeks)

- [ ] 🔴 Integrate **error tracking** (Sentry or similar) + alerts on payment/ledger/payout failures _(needs a Sentry DSN — your key)_
- [x] 🟠 Add **payment-path tests** — VAT-invoice math, weighted rubric, seller-withdrawal validation, webhook signature; +paginated-history test _(2026-06-26; 114 tests total)_
- [x] 🔴 Finish **P2 client cutover** — no client code writes `credit_transactions`/`credit_ownership` directly; all buys route through the server RPCs (`process_marketplace_purchase` / `process_wallet_purchase`). _Code-complete + partially runtime-verified 2026-07-02 (card ✅; wallet/cart ⬜)_
- [ ] 🔴 Then run **`lockdown_financial_writes.sql`** (P1) to make financial tables server-write-only _(🔒 gated: finish Step 4 B–E first — see [MONEY_CUTOVER_STATUS.md](MONEY_CUTOVER_STATUS.md))_
- [x] 🟠 Derive checkout `user_id` from the **verified JWT** instead of request body (P3) _(done — `getVerifiedUserId` in paymongo-checkout)_
- [ ] 🟠 Add hot-path **indexes**: `credit_transactions(status, project_credit_id/created_at)`, `credit_listings(seller_id, status)`, `projects(status)`, `profiles(kyc_level)`, `wallet_transactions(account_id, created_at)`
- [ ] 🟢 Validate the `NOT VALID` FKs once orphan-free; remove receipt/certificate fallback crutches

## Phase 3 — Scale & schema discipline (2–4 weeks)

- [x] 🟠 **Server-side pagination** — buyer purchase history (`getUserPurchaseHistoryPage`) + purchases-tab UI wiring done (2026-07-01, `/retire` un-orphaned)
- [x] 🟠 **Composite hot-path indexes** added (`20260627000000`) — sold-qty scan, buyer/seller history, seller listings, KYC gate _(2026-06-26)_
- [ ] 🟠 Replace the per-load `credit_transactions` scan with an index or a denormalized `sold_qty` (trigger-maintained)
- [ ] 🟠 Add a **connection pooler** (PgBouncer) before ~100 concurrent users
- [ ] 🟠 Resolve `project_credits` **dual-column** drift (`credits_available` vs `available_credits`) — pick canonical, backfill, drop the other
- [ ] 🟠 Move to **CLI migrations** (`supabase db push`) as the only way schema changes land; add a fresh-deploy schema test
- [ ] 🟠 **PayMongo settlement reconciliation** job (P4) — reconcile real money in/out vs the ledger
- [ ] 🟢 Image **CDN/transforms** (Cloudinary/Imgix) to cap egress
- [ ] 🟢 Split the largest SFCs (`MarketplaceViewEnhanced`, `ProfileView`)

## Phase 4 — Carbon-market credibility (1–3 months)

- [ ] 🔴 **Real registry/supplier integration** (replace `MockCreditSupplier` with Verra/Gold Standard/Carbonmark/Patch) — gated on a commercial agreement 🏛️
- [x] 🟠 **Public searchable registry** (projects / credits / retirements) _(shipped 2026-06-26; verified live)_ — plus a **`/market` public dashboard** (`public_market_stats`)
- [x] 🟠 **Double-claim prevention** — unique `certificates.registry_serial` guard so a non-retired credit can't back two certificates _(2026-06-26, `20260627000100`)_
- [x] 🟠 Deeper **due-diligence metadata** — co-benefits/SDGs ✅, project boundaries (map polygon) ✅, **permanence + structured additionality ✅** _(2026-07-01)_
- [ ] 🏛️ **Independent (VVB) verifier** model — external accreditation/governance
- [ ] 🏛️ **Approved/peer-reviewed methodologies** (vs the current simplified factors)

---

## Feature backlog by role (post-beta)

### Admin
- [~] Marketplace/transaction oversight — **refunds + disputes console done** (`/admin/refunds`, 2026-07-01); chargebacks still to do
- [ ] Verifier performance metrics; project-lifecycle analytics with drill-down
- [ ] Emission-factor **versioning/history** + rollback

### Verifier
- [ ] SLA **alerts/escalation** (not just badges); bulk approve/reject
- [ ] Personal performance dashboard; resubmission **diff** view
- [ ] Project-type-specific checklist templates

### Project Developer
- [~] Credit **issuance + earnings visibility** — **per-project earnings breakdown done** (`/sales`, 2026-07-01); per-project mint history still to do
- [ ] MRV reminders/schedule; impact/ESG export; team/co-developer access

### LGU
- [ ] Emission **baselines & targets** with YoY tracking; peer benchmarking
- [ ] Link MSW achievements to marketplace projects

### Buyer / Investor
- [~] Portfolio **gain/loss vs market** ✅ + **saved-search price alerts** ✅ (2026-07-01); recurring buys still to do
- [ ] Corporate offset inventory + GHG reporting export; buyer-protection/dispute path

### General user
- [ ] Newsletter/price-alert opt-in; project comparison/favorites; downloadable briefs

---

## Carbon-market analytics to add
- [ ] Price trends & history (per category/type) — needs a price-history table
- [ ] Market depth / volume (issued vs retired vs available over time)
- [ ] Impact analytics (tCO₂e retired over time, by category/SDG)
- [ ] Public market dashboard (totals, avg price) — trust + marketing asset
- [ ] Per-listing conversion analytics for sellers

---

## Legal / compliance track (parallel, business-led) 🏛️
- [ ] BSP / AMLA / Data Privacy Act program; BIR invoicing
- [ ] Terms of Service, carbon-claims policy, refund policy
- [ ] Backup/DR runbook + incident playbooks
