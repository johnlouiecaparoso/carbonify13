# Carbonify — Latest System Update, Gaps & Constraints

> ⚠️ **Newer state available:** for the current status (2026-06-25 — Carbonify rebrand, UX fixes, and
> money-path verification progress) see **[HANDOFF.md](HANDOFF.md)**. This file remains the detailed
> reference for the Phase 0–2 architecture and the sequencing constraints below.

> **Snapshot date:** 2026-06-13
> **Current branch:** `phase-2-seller-payouts` (stacked: `phase-0-stabilize` → `phase-1-money-foundation` → `phase-2-seller-payouts`)
> **Sources:** `handoff.md`, `SYSTEM_STATUS_OVERVIEW.md`, `IMPLEMENTATION_ROADMAP_TIMELINE.md`, `DEFERRED_BACKLOG.md`, live code review.

**Legend:** ✅ Done & verified · 🆕 Code-complete, runtime verification pending · 🟡 Partial · ❌ Not implemented · ⏳ Future / business-legal

---

## 1. Latest Update — what changed this cycle

Roadmap **Phases 0, 1, and 2 are now code-complete and locally green** (ESLint = 0, **47 unit tests pass**, `npm run build` ✓). The financial schema is **applied to the live DB**. The three biggest original blockers — client-controlled payment amounts, no seller payouts, and a broken webhook — are **addressed in code**.

> ⚠️ **Critical caveat:** None of the Phase 1/2 money flow has **executed at runtime yet.** No sandbox purchase, no payout run, no Edge Function deployed. Everything below marked 🆕 is written and merged but **not yet proven end-to-end.**

### Phase 0 — Stabilize 🆕
- ✅ Removed `paymongo-webhook` Git conflict markers (was undeployable)
- ✅ Restored `scripts/setup/` layout + aligned `package.json` scripts
- ✅ Fixed **4 latent runtime bugs** (projectService `isAdmin`, walletService import, notificationService scope var, ProjectForm computed)
- ✅ ESLint **183 → 0**; CI fixed (branch `development`, Node 20/22, split E2E)
- ✅ Schema fixes applied live: `credit_ownership.updated_at`, `certificate_data`, `credit_transactions`→`profiles` FKs, `wallet_accounts.wallet_address` — **this resolves all 6 known post-payment console bugs**

### Phase 1 — Money Foundation 🆕
- 🆕 **Provider abstraction** — `PaymentProvider` + `MockPaymentProvider` + `PayMongoProvider` + factory (`src/services/payments/`)
- 🆕 **Server-authoritative checkout** — `create_marketplace_checkout` recomputes amount from `credit_listings.price_per_credit`; client sends only `{listing_id, quantity}`
- 🆕 **Signed webhook = source of truth** — HMAC-SHA256 verify + replay window + `webhook_events` dedup (replaced a `return true` stub)
- 🆕 **Double-entry ledger** — `payment_intents`, append-only `ledger_entries` (balanced-constraint trigger), `idempotency_keys`
- 🆕 **Atomic, oversell-safe purchase** — `process_marketplace_purchase` RPC (atomic + idempotent)
- 🆕 **Reconciliation** — `reconcile_financials()` + balances view

### Phase 2 — Get Sellers Paid 🆕
- 🆕 **Escrow** — `escrow_holds` hold seller net on purchase → `release_escrow` → `seller_payable`
- 🆕 **Payout abstraction** — `PayoutProvider` + `MockPayoutProvider` (`src/services/payouts/`)
- 🆕 **Payout state machine** — `payout_requests` (requested → processing → settled/failed) + reserve/settle/fail RPCs + dead-letter
- 🆕 **Withdraw backend** — `payoutService.js` + `process-payouts` worker Edge Function + rewired `Withdraw.vue`
- 🆕 **Seller KYB** — `kyb_applications`, `profiles.kyb_verified`; **payouts gated on KYB** (`kybService.js`)
- 🆕 **Refunds & disputes** — compensating ledger entries (never edit originals) + dispute flow (`disputeService.js`)
- 🆕 **Seller earnings dashboard** — `SellerEarningsView.vue` at `/sales` + listing pause/relist/price

**Ledger accounts:** `paymongo_clearing`, `escrow_held`, `seller_payable:<id>`, `payout_pending:<id>`, `platform_revenue`, `cash_out`. Platform fee = 0 for now (fee model deferred).

---

## 2. Not Yet Implemented — the gap list

### 🔴 Phase 3 — Real Credits & Buyer Trust (NEXT)
- ❌ `CreditSupplier` interface + `MockCreditSupplier`; purchase → `placeOrder` → `retire` saga
- ❌ Real credit-supplier API (Carbonmark / Cloverly / Patch) — registry serial + retirement receipt on certificates
- ❌ `source` (`local` | `supplier`) flag on listings
- 🟡 Full project detail page (documents, methodology, map, vintage, co-benefits)
- ❌ ESG / offset report export (PDF/CSV)
- ❌ Real SDG / co-benefit filter (current filter is cosmetic)

### 🟠 Phase 4 — Developer ↔ Verifier Workflow
- ❌ Edit & resubmit after "needs revision" + document re-upload / versioning
- ❌ Two-way comment / request thread (developer ↔ verifier)
- ❌ Validation checklist / scored rubric + adjustable VERs before approval
- ❌ Verifier task queue — assignment, filters, aging/SLA
- ❌ Evidence integrity checks (EXIF geotag/timestamp, duplicate detection)
- ❌ MRV reminders (scheduled email + dashboard nudges)
- ❌ Methodology selection/reference + project-boundary map polygon
- 🟡 Financials persisted/displayed (fields exist, not surfaced)

### 🔴/🟠 Phase 5 — Admin & Compliance
- ❌ System-config UI (emission factors, fees, KYC tiers, project types — currently hardcoded in migrations)
- ❌ Admin **finance console** UI (revenue, payouts, refunds, reconciliation view)
- ❌ Regulatory & business reports + CSV/PDF export
- ❌ AML screening / transaction monitoring / velocity caps by KYC tier
- ❌ Data Privacy Act (DPA) tooling — consent capture, data export/delete
- ❌ BIR-compliant invoices / official receipts (with VAT)
- ❌ User lifecycle (suspend/ban/reactivate, impersonation, bulk ops)
- ❌ Fraud/risk dashboard, dispute console, audit-log search/filter/export

### 🟢 Phase 6 — Buyer & LGU Experience
- ❌ Buyer: cart / multi-item checkout, RFQ/bulk quote, watchlist + price alerts, price history, recurring auto-offset, one-click calculator → checkout, shareable retirement badge
- ❌ LGU: ESG report export, community-project tracker, trend charts, evidence upload, land-use modeling, benchmarking

### 🟠 Phase 7 — Scale, Transparency & Security Hardening
- ❌ **Public searchable registry** (all projects/credits/retirements) — biggest single trust signal
- ❌ Independent pentest + security review before live keys; rate-limiting; secrets manager; full RLS audit
- ❌ PgBouncer pooling; hot-path indexes; partitioned `ledger_entries`; read replica
- ❌ Backups / PITR + tested restore + RTO/RPO runbook; observability (payment success %, webhook lag, drift, failed-payout alerts)
- ❌ Published methodology documentation

### 🟢 Phase 8 — Mobile / PWA
- ❌ Responsive PWA shell (installable, offline-aware reads, manifest)
- ❌ Mobile login / wallet / marketplace / certificate viewer
- ❌ Web push notifications

### ⏳ Phase 9 — Future / Institutional (business-legal, not code)
- ⏳ Legal entity (SEC), PSP/EMI partnership + KYB of *your* company, carbon-supplier commercial agreement
- ⏳ AMLA program, DPO appointment, BIR registration, ToS / carbon-claims policy
- ⏳ Accredited VVB → Verra/Gold Standard pilot listing (12–36 months)
- ⏳ Blockchain tokenization, Article 6 interoperability, double-claim registry

---

## 3. Constraints — what must be done (and in what order)

These are hard sequencing rules and gates. Skipping or reordering them breaks live purchases or builds on unproven foundations.

### 🔴 CONSTRAINT 1 — Verify Phases 1 & 2 in sandbox *before any new feature work*
Everything in Phases 1–2 is written but has **never executed.** A real run either proves the ledger/RPC foundation or surfaces issues before Phase 3+ stacks on top.
1. Re-run `supabase/migrations/20260606000500_financial_reconciliation.sql`; confirm `select * from public.reconcile_financials();` returns **0 rows** (clean baseline).
2. Deploy functions: `npm run deploy:paymongo`, `npm run deploy:webhook`, `supabase functions deploy process-payouts`.
3. Set secrets: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYOUT_WORKER_SECRET`. Register the webhook URL (`https://fmngptolarydbgrtltnd.supabase.co/functions/v1/paymongo-webhook`) in PayMongo.
4. **Sandbox purchase** via `createMarketplaceCheckout({ listingId, quantity })` → confirm `payment_intents` → `credit_transactions` → `escrow_holds` → `ledger_entries` populate **and balance**; re-run reconciliation (still 0).
5. Test a **KYB-gated withdrawal** + `process-payouts` worker; test a **refund/dispute**.

### 🔴 CONSTRAINT 2 — Gated cutover order (do NOT reorder — tracked in `DEFERRED_BACKLOG.md`)
The browser still writes financial tables via the legacy flow. Lock it down in this exact order:
- **P2 first** — switch the marketplace Buy UI to `createMarketplaceCheckout` and **stop** client-side `credit_transactions` / `credit_ownership` writes.
- **P1 next** — *then* run `supabase/cutover/lockdown_financial_writes.sql` (makes financial tables server-write-only). **Running it before P2 breaks live purchases.**
- **P3** — derive checkout `user_id` from the verified JWT (amount is already server-authoritative).

### 🟠 CONSTRAINT 3 — Schema drift / unresolved data-model questions
Manual migrations have drifted from `supabase/migrations/`. These don't block verification but must be closed before "production-credible" sign-off:
- **Dual columns on `project_credits`:** live column is `credits_available`; migrations' `available_credits` was never applied. Triggers maintain one, services read the other. Pick `available_credits` as canonical, backfill, repoint code, drop the stray (backlog #1).
- **`credit_ownership`** has dual `project_credit_id` / `project_credits_id`.
- **Listing tables:** management uses `user_credit_listings` while purchases use `credit_listings` — relationship unconfirmed.
- **Adopt CLI migration tracking** (`supabase db push`) so schema stops drifting (backlog #7).
- **VALIDATE** the `NOT VALID` FKs once the orphan check confirms zero orphans (backlog #4).

### 🟠 CONSTRAINT 4 — Platform / infrastructure limits to plan around
- **Supabase Edge Functions** have CPU/memory caps and cold starts — keep them thin; move heavy/batch jobs (reconciliation, batch payouts, reports) to a dedicated worker when volume grows. (This is why Phase 1 isolates payments behind a provider interface.)
- **Postgres connection limits** — configure Supavisor/PgBouncer (transaction mode); cap function concurrency.
- **Vercel** is a frontend host only — **never** put money/business logic in Vercel serverless functions; keep it in Supabase / a real backend.
- **No deep queue/cron** — `pg_cron` is basic; add an external broker + dead-letter when webhook volume grows. Don't rely on `pg_cron` for critical money jobs.

### ⏳ CONSTRAINT 5 — Business / legal gates (run in parallel, not code)
Real-money operation is **~60% non-code.** These run on partners' / regulators' timelines, not yours, and gate "real" status more than software does:
- Licensed PH PSP/EMI partnership + KYB of your own entity; partner must custody funds.
- AMLA program, DPO + DPA compliance, BIR registration + VAT-compliant receipts, ToS / carbon-claims policy.
- Carbon-supplier commercial agreement (for Phase 3 real credits).
- **Independent pentest before live keys** (Phase 7) — the biggest avoidable mistake is skipping this.

### 🟢 CONSTRAINT 6 — Build hygiene blockers
- **Prettier `npm run format` breaks the build** — it reformats multi-statement inline Vue handlers and drops `;`. Refactor those into named methods before enabling the format step (backlog #5).
- **Playwright E2E** runs `continue-on-error` in CI — needs a live backend + secrets wired in before it can be made required (backlog #6).
- **Receipt/certificate FK fallback crutch** can be removed now that the FKs exist (backlog #3).

---

## 4. The single most important next step

**Run the sandbox purchase + payout end-to-end (Constraint 1).** Everything in Phases 1–2 is written and locally green but has never run. One real sandbox cycle either proves the ledger/RPC/escrow/payout foundation or surfaces issues — *before* Phase 3 and everything after it stacks on top. Only after that: execute the gated cutover (Constraint 2), then resume the roadmap at **Phase 3 (Real Credits & Buyer Trust).**
