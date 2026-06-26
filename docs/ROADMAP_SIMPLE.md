# Carbonify — Simple Roadmap

> **Updated:** 2026-06-26 · Plain-language plan. For the full detail see
> [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md) and [HANDOFF.md](HANDOFF.md).

## The one-line goal
Let a buyer pay for a carbon credit and have the money land safely — then make it trustworthy enough to go live.

---

## 🔴 RIGHT NOW (this week)

### 1. Prove money works  ⬅️ most important
A buyer pays → the money settles → the books balance (zero drift).
- **You (dashboard):** set 3 secrets, deploy the fixed `paymongo-webhook`, run one test purchase.
- **Why it's blocked:** the CLI lacks privileges; it's a 15-min dashboard job, not a code job.
- **Done when:** test card `4343 4343 4343 4345` pays and `reconcile_financials()` returns 0 rows.

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
- ⏳ Still to do: scored checklist · verifier task queue + SLA.

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
- ⏳ Still to do: real registry/supplier integration (needs an external partner).

---

## 🟢 LATER (before public launch)

### 5. Admin & compliance
Admin finance console · invoices (BIR/VAT) · AML screening · audit-log search.

### 6. Scale & security
Public searchable registry · pentest before using live keys · backups · monitoring.

### 7. Mobile & business setup
Installable app (PWA) · mobile views · legal entity, payment partner, accredited verifier.

---

## How to read this
- 🔴 = do this week · 🟡 = do next · 🟢 = before going live
- "You" = a dashboard/admin step only the owner can do.
- Everything else is code I can build.

**My suggested order:** you unblock #1, I build #2 in parallel, then we do #3 → #4.
