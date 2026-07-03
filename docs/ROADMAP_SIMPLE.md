# Carbonify — Simple Roadmap

> **Updated:** 2026-07-02 · Plain-language plan. For the full detail see
> [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md) and [HANDOFF.md](HANDOFF.md).

> 🚦 **2026-07-02 update:** the *server-authoritative money cutover* got its first
> real test. **Buying with a card and upgrading to Pro now work end-to-end** (money
> settles, books balance) — but this only worked after fixing a real bug that had
> blocked every purchase. **Still to test: wallet top-up, buying with wallet, cart
> (2 items), and retiring credits** (Step 4 B–E in
> [YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md)). The older "all of it, proven"
> lines below describe the *earlier* (pre-cutover) version and are kept as history.

## The one-line goal
Let a buyer pay for a carbon credit and have the money land safely — then make it trustworthy enough to go live.

## Where we are (2026-07-01)
**The money works — all of it, proven.** ✅ A real buyer paid, the money settled, and the books
balanced (`reconcile_financials()` = 0). And as of 2026-07-01 the **edges are proven too**:
**subscription, seller payout, and refund** all settled with zero drift. The verifier loop,
buyer-trust features, DPA tooling (erasure worker now deployed), finance console, VAT invoices,
public registry, and offline service worker are all live and verified.
The 2026-07-01 session also shipped + verified the last buildable extras — seller per-project
earnings, purchases pagination, structured additionality/permanence, saved-search price alerts,
and **admin consoles** for KYB review + refunds. Net: **the whole money path and feature set are
proven; what remains needs an outside party (registry partner, sanctions data, PSP) or ops/legal.**

> ✅ **2026-07-01 — money edges proven + gaps closed.** Payout + refund verified (zero drift);
> `account-deletion` deployed; admin KYB-review + refunds consoles, seller KYB form, and an admin
> KYC-level override all built and clicked through. Everything that was "built but not clickable"
> is now reachable.

---

## 🔴 RIGHT NOW (this week)

### 1. Prove money works  ✅ FULLY DONE (2026-07-01) — most important
A buyer pays → the money settles → the books balance (zero drift).
- ✅ Purchase settled, `reconcile_financials()` = **0 rows**. Foundation proven (2026-06-26).
- ✅ **Edges proven (2026-07-01):** subscription (`/upgrade` → Pro), KYB-gated payout (Withdraw →
  `process-payouts` → settled), and cart + refund — each kept `reconcile_financials()` at 0 rows.

### 2. Let users get/delete their data  ✅ DONE (2026-07-01)
Our Privacy Policy already promises this, so the app must be able to do it.
- Built: **Profile → Privacy & Data** tab — "Download my data" (instant JSON export)
  and "Request account deletion" (recorded for admin processing, cancellable).
- ✅ Erasure worker (`account-deletion` edge function) **deployed and verified**.

---

## 🟡 NEXT (after money is proven)

### 3. Finish the verifier loop
Developer fixes a rejected project and resubmits; verifier reviews again.
- ✅ Edit & resubmit after "needs revision" (done 2026-06-26 — resubmit re-enters the
  queue, alerts verifiers, and shows a revision badge).
- ✅ Scored rubric (done 2026-06-26 — verifiers rate each item Inadequate/Adequate/Strong
  with weights; an overall weighted score + band shows in the review panel).
- ✅ MRV reminders (done 2026-06-26 — validated projects show a due/overdue banner on the
  Monitoring page and get a bell notification when a report is overdue).
- ⏳ Still to do: verifier task queue depth (a fuller SLA-scored work queue).

### 4. Real credits & buyer trust
Make listings believable.
- ✅ Full project-detail page (done 2026-06-26 — hero image, verification/trust card,
  developer, timeline & location, map, documents, co-benefits, listings).
- ✅ `local | supplier` label + marketplace filter (done 2026-06-26 — badge on cards,
  detail page, and purchase modal; "All / Local / Registry" filter).
- ✅ ESG / offset report export (done 2026-06-26 — "ESG report (PDF)" + CSV buttons on the
  Credit Portfolio page, backed by the existing esgReportService).
- ✅ SDG filter (done 2026-06-26 — developers tag UN SDGs at submission, shown as chips on the
  detail page, and buyers filter the marketplace by goal).
- ✅ Project boundary map (done 2026-06-26 — developers click to drop the location pin and draw
  the project boundary on a map at submission; the boundary shows on the detail page).
- ✅ Portfolio gain/loss (done 2026-06-26 — the Portfolio shows a real peso value plus an
  up/down "vs market" figure instead of a placeholder).
- ⏳ Still to do: real registry/supplier integration (needs an external partner).

---

## 🟢 LATER (before public launch)

### 5. Admin & compliance
- ✅ Admin finance console (done 2026-06-26 — sales/fees/payouts + book reconciliation,
  admin-gated RPCs). ✅ Audit-log search (already built).
- ✅ VAT invoices (done 2026-06-26 — "VAT Invoice" PDF per receipt, 12% PH VAT backed out,
  admin-configurable tax identity; marked provisional until BIR-registered).
- ⏳ Still to do: AML screening (needs a real sanctions data source to be meaningful).

### 6. Scale & security
- ✅ Public searchable registry (done 2026-06-26 — browse/verify issued & retired credits at
  /registry, no login) + a public **/market dashboard** (supply, price range, retired vs issued).
- ✅ Double-claim guard (done 2026-06-26 — a registry serial can't back two certificates, so a
  non-retired credit can't be sold twice).
- ✅ Speed & safety nets (done 2026-06-26 — composite database indexes, server-side paginated
  purchase history, and a 114-test suite covering the money/feature logic).
- ⏳ Still to do: pentest before using live keys · backups/PITR · connection pooling ·
  error tracking (Sentry — needs a key) · monitoring.

### 7. Mobile & business setup
- ✅ Offline service worker (done 2026-06-26 — the app caches its shell and assets so it loads
  offline; live data still needs a connection).
- ✅ Mobile polish (done 2026-06-26 — the wide finance/earnings/config tables now scroll instead
  of overflowing on phones).
- ⏳ Still to do: installable-app niceties · web push (needs a deployed function + keys) ·
  legal entity, payment partner, accredited verifier.

---

## How to read this
- 🔴 = do this week · 🟡 = do next · 🟢 = before going live
- "You" = a dashboard/admin step only the owner can do.
- ✅ items are built & committed; most are now **runtime-verified** (2026-07-01).

**Suggested order now:** ✅ pre-cutover money path proven (purchase + subscription + payout + refund);
🚦 **server-authoritative cutover now verified for card + subscription (2026-07-02), wallet/cart/retire
(Step 4 B–E) still to test**; ✅ `account-deletion` deployed, ✅ 2026-07-01 features + admin consoles verified. Next:
(1) **open the PR** `feature-user-onboarding-ux` → `main` to capture the proven work,
(2) optional codeable hardening — the **money-path gated cutover** (server-authoritative Buy UI
then RLS lockdown) and code hygiene (see [NOW_IMPLEMENTATION_PLAN.md](NOW_IMPLEMENTATION_PLAN.md)),
(3) everything else needs an external partner or ops/legal — not more code.
