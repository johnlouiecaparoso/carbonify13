# Carbonify — "Build Now" Implementation Plan

> **Created:** 2026-07-01 · **Branch:** `feature-user-onboarding-ux`
> Companion to [HANDOFF.md](HANDOFF.md) §3 (implemented vs not) and
> [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md). This doc takes everything marked
> **❌ not implemented** and sorts it into what we can **start in code today** vs what is
> **blocked** on you (a key/account) or an outside party (partner/ops/legal).

## The sorting rule

Every remaining item falls into one of three buckets:

| Bucket | Meaning | Who acts |
|---|---|---|
| 🟢 **Buildable now** | Pure code, no external dependency | us, this branch |
| 🟡 **Needs a key/account, then code** | You obtain one credential, then it's codeable | you → us |
| 🔴 **Blocked** | Needs an external partner, ops/infra, or legal | not code |

The plan below runs the 🟢 waves in order. 🟡 items are queued behind the one input they need.
🔴 items are parked at the bottom so we don't pretend they're on the near-term path.

---

## Wave 0 — Verify what's already built (do first, almost no new code)

Everything shipped in the last cycle is 🆕 (build-green + 114 unit tests, but **runtime-untested**).
Verifying it is higher-value than writing more, because it either confirms done or surfaces the
real next task. Needs **you** (a running app + test accounts) — no partner.

- [ ] **Money-path edges** (runbook Step E, [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md)):
      KYB-gated payout and cart + refund — each must keep `reconcile_financials()` at **0 rows**.
- [ ] **Deploy `account-deletion`** edge fn + set `ACCOUNT_DELETION_SECRET`; run it against one
      pending deletion request.
- [ ] **Click-through pass** on the 🆕 features: Submit-Project document upload (attach a real PDF),
      boundary map draw/save, MRV reminder banner, scored rubric, VAT invoice PDF, portfolio P&L.

**Done when:** the three money edges reconcile to zero, deletion erasure runs, and the 🆕 list has
been exercised once in a real browser. Anything that breaks becomes a bug ticket ahead of Wave 1.

---

## Wave 1 — Codeable backlog (🟢 pure code, zero external blockers)

These are the HANDOFF §3 "codeable backlog" items. No new external dependency; most reuse existing
tables/RPCs.

1. **Marketplace + portfolio list pagination wiring** *(smallest, do first)*
   - The server-side paginated RPC already exists (`getUserPurchaseHistoryPage()` with exact count).
     This is **UI wiring only** — page controls on the marketplace + portfolio/history lists.
   - *Done when:* long lists paginate server-side (no full-table fetch) with correct total counts.

2. **Seller per-project earnings / issuance history**
   - Extend the seller earnings view (`SellerEarningsView.vue`, `/sales`) with a per-project
     breakdown: issued vs sold vs available, gross/fees/net per project, issuance timeline.
   - Reuses `credit_transactions` + `project_credits`; likely one read-only RPC.
   - *Done when:* a seller can see earnings and issuance broken down by project.

3. **Saved-search / price alerts**
   - Persist a buyer's marketplace filter as a saved search; notify (bell) when a new listing
     matches or a watched listing's price drops.
   - New small table (`saved_searches`) + a check on listing insert/price-update; reuses the
     existing notification service.
   - *Done when:* a buyer saves a search and gets a bell notification on a matching new/cheaper listing.

4. **Structured additionality + permanence metadata**
   - Replace free-text additionality/permanence with structured fields at submit → display on the
     project-detail trust card.
   - Additive columns on `projects` (idempotent migration) + form + detail rendering.
   - *Done when:* a developer picks structured additionality/permanence values and they render on detail.

**Suggested order:** 1 → 2 → 3 → 4 (ascending effort; #1 is a quick win that also closes a Phase 7 loop).

---

## Wave 2 — Code hygiene & safety nets (🟢 pure code)

From [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) Phase 0 + general cleanup. Lower user-visible value
but removes drift risk and makes later work safer.

1. **Canonicalize the dual `available_credits` / `credits_available` column** (Backlog #1) — **run the
   live schema query first** (SQL in the backlog doc), pick `available_credits` as canonical, backfill,
   point all code at it, drop the stray. *Do this before Wave 1 #2, which reads the same table.*
2. **Remove the receipt/certificate FK fallback crutch** (Backlog #3) — the FKs now exist; delete the
   dormant fallback path in `receiptService.js` / `certificateService.js`.
3. **`VALIDATE` the `NOT VALID` FKs** (Backlog #4) — after the orphan check confirms zero orphans.
4. **Split the largest view files** — improves reviewability; no behavior change.
5. **Prettier enablement** (Backlog #5) — refactor multi-statement inline Vue handlers into named
   methods first, then add the format step to CI.

---

## Wave 3 — Money-path cutover (🟢 code, but gated & careful)

From [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) Phase 1 follow-ups. Codeable now, but touches live
purchases — sequence matters, and re-verify `reconcile_financials()` = 0 after each step.

1. **P2 — Client cutover to server-authoritative purchase:** switch the "Buy" UI to
   `createMarketplaceCheckout({ listingId, quantity })`; remove browser inserts into
   `credit_transactions` / `credit_ownership` (the webhook RPC owns those now).
2. **P3 — Derive `payment_intents.user_id` from the verified JWT** (not the request body).
3. **P5 — Wallet top-up via `payment_intents`** (purpose `wallet_topup`) for consistent reconciliation.
4. **P1 — Financial-table RLS lockdown** (`supabase/cutover/lockdown_financial_writes.sql`) — **only
   after P2 lands**, or it breaks live purchases.

**Done when:** no money logic remains in the browser, financial tables are server-write-only, and a
sandbox purchase still reconciles to zero.

---

## Wave 4 — Codeable *after you supply one key* (🟡)

Each is a small amount of code gated on a single credential you can obtain without a partner contract.

- **Error tracking (Sentry) + alerts** — you provide a **Sentry DSN**; then wire the SDK + release
  tagging + a couple of alerts (payment failure %, webhook lag). *(Phase 2/7)*
- **Web push notifications** — you provide **VAPID keys** + we deploy a push edge fn; then subscribe
  + send on key events. *(Phase 8)*

---

## 🔴 Parked — not code, don't schedule as build work

These stay off the near-term plan until an external dependency lands (tracked in HANDOFF §3):

- **Real registry/supplier integration** — external registry partner (Verra / Gold Standard /
  Carbonmark / Patch). The `CreditSupplier` interface + `MockCreditSupplier` *can* be built now to
  hold the seam, but real fulfillment is blocked.
- **AML / sanctions screening** — a sanctions/PEP data vendor.
- **Pentest · backups/PITR · connection pooling · observability** — ops/infra + provider keys.
- **Legal entity · PSP/EMI · BIR/DPO · accredited VVB** — business/legal track (Phase 9).

---

## Recommended execution order

```
Wave 0 (verify)  ──►  Wave 2 #1 (canonicalize column)  ──►  Wave 1 (backlog features)
                                                              │
                        Wave 2 #2–5 (hygiene) in parallel ────┤
                                                              ▼
                                                   Wave 3 (money cutover, gated)
                                                              ▼
                                          Wave 4 when you hand over a DSN / VAPID keys
```

**Start here:** Wave 0 (you) + Wave 2 #1 (us, one schema query). Then Wave 1 #1 is the fastest
first shipped feature. Say the word and I'll begin with the schema query + the pagination wiring.
