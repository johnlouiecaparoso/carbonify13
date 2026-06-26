# Carbonify — Simple Roadmap

> **Updated:** 2026-06-26 · Plain-language plan. For the full detail see
> [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md) and [HANDOFF.md](HANDOFF.md).

## The one-line goal
Let a buyer pay for a carbon credit and have the money land safely — then make it trustworthy enough to go live.

## Where we are (2026-06-26)
Almost everything buildable is **done**, and the big one is now **proven**: ✅ **a real buyer
paid, the money settled, and the books balanced** (`reconcile_financials()` = 0 rows) on a live
Vercel preview. The verifier loop, buyer-trust features, DPA tooling, finance console, VAT
invoices, public registry, and the new offline service worker all shipped + were verified live.
What's left of the money work is the **edges** (subscription, payout, refund). The rest needs an
outside party (registry partner, sanctions data, PSP) or ops/legal. Net: **foundation proven —
finish the edges, then it's all validation + partners.**

---

## 🔴 RIGHT NOW (this week)

### 1. Prove money works  ✅ DONE (2026-06-26) — most important
A buyer pays → the money settles → the books balance (zero drift).
- ✅ Set the 3 secrets, deployed the fixed `paymongo-webhook`, ran a real test purchase on the
  Vercel preview — it settled and `reconcile_financials()` returned **0 rows**. Foundation proven.
- ⏳ **Edges still to confirm** (same setup, no new deploy): subscription (`/upgrade` → Pro),
  KYB-gated payout (Withdraw → run `process-payouts`), and cart + refund — each must keep
  `reconcile_financials()` at 0 rows.

### 2. Let users get/delete their data  ✅ code-complete (2026-06-26)
Our Privacy Policy already promises this, so the app must be able to do it.
- Built: **Profile → Privacy & Data** tab — "Download my data" (instant JSON export)
  and "Request account deletion" (recorded for admin processing, cancellable).
- Erasure worker (`account-deletion` edge function) is written; deploy it when the
  Supabase dashboard blocker (#1) is cleared.
- **Done when (runtime):** a user downloads their export and an admin runs the
  erasure worker on a deletion request.

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
- ✅ Public searchable registry (done 2026-06-26 — anyone can browse/verify issued &
  retired credits at /registry, no login; anon-granted RPCs).
- ⏳ Still to do: pentest before using live keys · backups · monitoring.

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
- ✅ items are built & committed (runtime-untested until you test them).

**Suggested order now:** ✅ migrations applied, ✅ core money-path test passed. Next:
(1) verify the 3 money-path **edges** (subscription, payout, refund — all 0-drift),
(2) deploy `account-deletion` + set `ACCOUNT_DELETION_SECRET`, (3) when ready, promote the
preview to `main` / open the PR. Then the only feature work left needs an external partner or
ops/legal — not more code.
