# Session Handoff — Ecolink

**Date:** 2026-06-07
**Branches (stacked):** `phase-0-stabilize` → `phase-1-money-foundation` → `phase-2-seller-payouts` (current)
**Nature of session:** Implementation. Phases 0, 1, and 2 of the roadmap were built. Schema applied to the live DB; **no runtime/sandbox test has been run yet.**

---

## 1. The goal we're working toward

Move Ecolink from "excellent capstone" toward a production-credible carbon-credit marketplace, following `docs/IMPLEMENTATION_ROADMAP_TIMELINE.md`. This session: stabilize the codebase (Phase 0), build a safe money foundation (Phase 1), and get sellers paid (Phase 2). The biggest original blockers — client-side payment amounts, no seller payouts, broken webhook — are now addressed in code.

---

## 2. Current state — what was built

All three phases are **code-complete and locally green** (`eslint .` = 0, **47 unit tests pass**, `npm run build` ✓). Each sub-step is its own commit (see `git log`, commits `27b3f6b` → `073dc36`).

**Phase 0 — Stabilize (`phase-0-stabilize`):** removed webhook Git conflict markers; restored `scripts/setup/` layout; rewrote a rotted payment test; fixed **4 latent runtime bugs** (projectService.updateProject `isAdmin`, walletService `checkPaymentStatus` import, notificationService out-of-scope var, ProjectForm document-attach mis-pasted into a computed); ESLint **183 → 0** + CI config fixed (branch `develop`→`development`, Node 20/22, split E2E); schema fixes (credit_ownership.updated_at, certificate_data, credit_transactions→profiles FKs, wallet_accounts.wallet_address) — **applied live**.

**Phase 1 — Money Foundation (`phase-1-money-foundation`):** **Verified the linchpin** — payment amounts WERE client-controlled (pay ₱1 for anything). Fixed:
- `src/services/payments/` — PaymentProvider + Mock + PayMongo adapter + factory.
- Server-authoritative checkout: `create_marketplace_checkout` action recomputes amount from `credit_listings.price_per_credit`; client sends only `{listing_id, quantity}`.
- Real webhook: HMAC-SHA256 verify + replay window + `webhook_events` dedup (was a `return true` stub).
- Double-entry ledger: `payment_intents`, append-only `ledger_entries` (balanced-constraint trigger), `idempotency_keys`.
- `process_marketplace_purchase` RPC — oversell-safe, atomic, idempotent.
- `reconcile_financials()` + balances view.

**Phase 2 — Get Sellers Paid (`phase-2-seller-payouts`):**
- Escrow (`escrow_holds`): purchases hold seller net in escrow → `release_escrow` → `seller_payable`.
- `src/services/payouts/` — PayoutProvider + MockPayoutProvider (+8 tests).
- `payout_requests` state machine (requested→processing→settled/failed) + reserve/settle/fail RPCs (dead-letter).
- Withdraw backend (`payoutService.js`) + `process-payouts` worker Edge Function + rewired `Withdraw.vue`.
- Seller KYB (`kyb_applications`, `profiles.kyb_verified`) — **payouts gated on KYB**.
- Refunds via compensating ledger entries + disputes flow.
- `SellerEarningsView.vue` at `/sales` + listing pause/relist/price.

**Ledger accounts:** `paymongo_clearing`, `escrow_held`, `seller_payable:<id>`, `payout_pending:<id>`, `platform_revenue`, `cash_out`. Platform fee = 0 for now (fee model deferred).

---

## 3. Files created/edited this session

Too many to list individually — see `git log` and `git diff main...phase-2-seller-payouts`. Highlights:
- **Migrations:** `supabase/migrations/20260606000000` … `20260606000900` (10 files).
- **Edge Functions:** `paymongo-checkout` (server amount), `paymongo-webhook` (real verify + dedup + RPC call), new `process-payouts` worker.
- **Services:** `src/services/payments/*`, `src/services/payouts/*`, `payoutService.js`, `kybService.js`, `disputeService.js`.
- **UI:** `SellerEarningsView.vue` (new), `Withdraw.vue` (rewired), router `/sales`.
- **Docs:** `docs/DEFERRED_BACKLOG.md`, `supabase/cutover/lockdown_financial_writes.sql`, `supabase/diagnostics/phase0_schema_check.sql`.
- **Memory:** `ecolink-phase0-status`, `ecolink-phase1-money-foundation`, `ecolink-phase2-seller-payouts`, `supabase-migration-process`.

---

## 4. What was tried / verification status

- **Migrations APPLIED LIVE** (Supabase SQL Editor): Phase 0 consolidated block, `…000200` through `…000900`. Applied cleanly, no errors.
- **`reconcile_financials()`** initially flagged ~52 `transaction_no_ledger` rows — these are **legacy pre-ledger `credit_transactions`** from the old client flow, NOT a bug. Fixed by scoping the check to new-flow transactions (commit `073dc36`); **re-run `…000500` and reconciliation should return 0 rows.**
- **NOT yet done:** no Edge Function deployed, no sandbox purchase, no payout run. **Nothing in Phase 1/2 has executed at runtime.** This is the critical remaining verification.

---

## 5. The next step I'd take

**Finish the Phase 1/2 verification checkpoint before building Phase 3:**
1. Re-run `supabase/migrations/20260606000500_financial_reconciliation.sql`; confirm `select * from public.reconcile_financials();` returns 0 rows (clean baseline).
2. Deploy functions: `npm run deploy:paymongo`, `npm run deploy:webhook`, `supabase functions deploy process-payouts`. Set secrets `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYOUT_WORKER_SECRET`. Register the webhook URL (`https://fmngptolarydbgrtltnd.supabase.co/functions/v1/paymongo-webhook`) in PayMongo.
3. **Sandbox purchase via the new flow** (`createMarketplaceCheckout({listingId, quantity})`) → confirm `payment_intents` → `credit_transactions` → `escrow_holds` → `ledger_entries` populate and balance; re-run reconciliation (still 0).
4. Test a KYB-gated withdrawal + `process-payouts` worker; test a refund/dispute.

**Then resume the roadmap at Phase 3** (Real Credits & Buyer Trust).

**Gated cutover (do NOT skip, tracked in `docs/DEFERRED_BACKLOG.md`):**
- **P2** — switch the marketplace Buy UI to `createMarketplaceCheckout` and stop client-side `credit_transactions`/`credit_ownership` writes.
- **P1** — *then* run `supabase/cutover/lockdown_financial_writes.sql` (makes financial tables server-write-only). Running it before P2 breaks live purchases.
- **P3** — derive checkout `user_id` from the verified JWT (amount is already server-authoritative).

> **Single most important thing for the next session:** run the sandbox purchase end-to-end. Everything in Phases 1–2 is written and locally green but has never executed — a real purchase either proves the ledger/RPC foundation or surfaces issues before Phase 3+ stacks on top of it.

**Unresolved schema notes:** `project_credits` live column is `credits_available` (the migrations' `available_credits` was never applied — dual-column cleanup is deferred). `credit_ownership` has dual `project_credit_id`/`project_credits_id`. Listing management uses `user_credit_listings` while purchases use `credit_listings` — relationship between the two tables is unconfirmed. None block the verification; all are in the backlog.

---

## 6. What's Not Yet Implemented (The Backlog)

While the core functionality and the foundations for safe money handling (Phases 0-2) are in place, the system is missing the following major components to reach production readiness:

**Phase 3 — Real Credits & Buyer Trust:**
- **Real Credit Supplier API:** Integrating with a real registry (e.g., Verra/Gold Standard via Carbonmark/Patch) to replace simulated credits.
- **Detailed Buyer Views:** Full project detail pages (with methodologies, co-benefits, and map boundaries) and ESG/offset report exports.

**Phase 4 — Workflow Completeness (Developer ↔ Verifier):**
- **Communication & Revisions:** Two-way comment threads, edit/resubmit capabilities for developers after a "needs revision" status.
- **Verifier Tooling:** Structured validation checklists, adjustable VER calculation transparency, and a task queue with SLAs.

**Phase 5 — Admin & Compliance:**
- **System Config UI:** Admin screens for emission factors, fees, and KYC tiers.
- **Reporting & Governance:** Exportable regulatory reports, AML screening, Data Privacy Act (DPA) tooling, and fraud/risk dashboards.

**Phase 6 — Experience & LGU Extensions:**
- **Buyer Features:** Multi-item cart, bulk checkout, and watchlists.
- **LGU Tools:** Exportable city ESG reports, land-use carbon modeling, and community-project trackers.
- **Platform:** A public searchable registry (crucial for trust) and Mobile/PWA enhancements.

---

## 7. Recommended Task Plan (Next Steps for You)

If you are ready to continue updating the system, follow this structured plan:

**Task 1: Verify Phase 1 & 2 (Sandbox Testing)**
- **Goal:** Prove the ledger and payout functions work before building on top of them.
- **Action:** Run `supabase/migrations/20260606000500_financial_reconciliation.sql`. Deploy the PayMongo and payout edge functions. Run a sandbox purchase via `createMarketplaceCheckout` and verify the ledger balances. Test a KYB-gated withdrawal.
- **Blocker Resolution:** Execute the P1-P3 gated cutover steps listed in section 5 once tests pass.

**Task 2: Implement Real Credits Abstraction (Phase 3)**
- **Goal:** Prepare the system to handle real carbon credits.
- **Action:** Build the `CreditSupplier` abstraction layer. Create a mock implementation for testing, and outline the API integration service for a provider like Carbonmark.
- **UI:** Enhance the Buyer's project detail page to surface metadata (vintage, methodology, co-benefits) necessary for due diligence.

**Task 3: Complete Developer-Verifier Workflows (Phase 4)**
- **Goal:** Unblock the operational bottleneck between developers and verifiers.
- **Action:** Add the "edit & resubmit" flow. Build a persistent comment thread component attached to the project application. Create a structured validation rubric/checklist for Verifiers.

*Let me know which task you'd like to start with, or if you'd prefer me to dive straight into executing Task 1!*
