# Carbonify — Handoff (current state)

> **Updated:** 2026-07-03 · **Branch:** `feature-user-onboarding-ux` · **PR #2 → `main`**
> ✅ **Server-authoritative money cutover is COMPLETE and HARDENED.** All six money
> flows (card, wallet top-up, wallet buy, cart, retire, subscription) settle
> server-side and `reconcile_financials()` = 0 — **re-verified after** the P1 RLS
> lockdown (financial tables are now server-write-only). See
> [MONEY_CUTOVER_STATUS.md](MONEY_CUTOVER_STATUS.md) and
> [YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md) for the completed runbook, and
> [RELEASE_NOTES.md](RELEASE_NOTES.md) for the release summary. Pair with
> [ROADMAP_SIMPLE.md](ROADMAP_SIMPLE.md) and
> [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md).
>
> **User & developer docs:** step-by-step per-role guides live in
> [user-guide/](user-guide/README.md); developer onboarding/architecture/deploy
> docs live in [dev/](dev/README.md).

> ✅ **2026-07-03 — cutover done.** B–E passed after fixing four out-of-version-control
> DB objects the live flows surfaced (migrations `20260703000000`–`20260703000200`):
> `update_wallet_balance_atomic` (was in no migration), `wallet_transactions.external_reference`
> (missing column), the RetireView `project_id` mapping, and a stray
> `credit_ownership_quantity_positive` (> 0) constraint that blocked retirement. Then
> the RLS lockdown was applied and all six flows re-verified at reconcile = 0. Older
> "partially verified / B–E remain" notes below are historical.

## TL;DR

Phases 0–8 are **code-complete** and the **money path is fully proven** (purchase + subscription
+ **payout + refund**, all reconciling to 0 — verified 2026-07-01).
The 2026-06-26 session shipped DPA tooling, the edit/resubmit loop, project-detail page,
`local|supplier` + SDG filters, ESG export, finance console, VAT invoices, public registry,
a schema-drift catch-up, then a **codeable-backlog sweep** (scored rubric, boundary map, MRV
reminders, offline SW, mobile polish) and a **Phase 2–4 sweep** (payment-path tests → 114
tests, composite indexes + paginated history, `/market` dashboard + double-claim guard, buyer
portfolio P&L) and nav links. The **2026-07-01 session** then proved the money-path edges
(payout + refund), shipped the codeable backlog + admin action consoles, and runtime-verified
everything. Build green, ESLint 0, **145 tests** (~86 commits ahead of `main`).

> ✅ **2026-06-26 — THE CORE MONEY PATH IS PROVEN.** The §0 migrations were applied, the 3
> PayMongo secrets were set, the **bug-fixed `paymongo-webhook` was deployed**, and a real
> sandbox purchase (PayMongo test card on the Vercel preview) **settled cleanly** —
> `reconcile_financials()` returns **0 rows** after the sale, and **subscription** was verified
> too (`/upgrade` → Pro flipped `profiles.plan`). The #1 blocker the rest of this doc was built
> around is **cleared**. The registry, `/market` dashboard, and offline service worker were also
> verified live in the same session.

> ✅ **2026-07-01 — MONEY PATH FULLY PROVEN + click-through complete.** The remaining edges were
> verified: **KYB-gated payout** and **cart + refund** both settled with `reconcile_financials()`
> at **0 rows**. The `account-deletion` edge function was deployed (DPA erasure works). The
> session's new features (seller per-project earnings, purchases pagination, structured
> additionality/permanence, saved-search/price alerts) were all runtime-verified, and the admin
> KYB-review + refunds consoles + seller KYB form + KYC-level admin override were exercised.

**What's left of the money path:** ✅ **nothing** — as of 2026-07-03 the gated cutover is
**done**: the Buy/top-up/retire UI runs fully server-side and the financial-table RLS lockdown
has been applied and re-verified (all six flows reconcile to 0). Everything else depends on an
external partner (real registry, AML data, PSP) or ops/legal.

> ✅ **Migrations applied + audit clean** (2026-06-26). The live DB had drifted behind the
> migrations all session; the §0 catch-up (`20260626000700`) + audit
> ([diagnostics/schema_catchup_audit.sql](../supabase/diagnostics/schema_catchup_audit.sql))
> resolved it. Re-run the audit anytime to confirm (empty result = good).

---

## 0. Pending migrations — apply via SQL Editor (idempotent, safe to re-run)

This session added migrations. Apply any not yet run, in this order (all use
`IF NOT EXISTS` / `NOT VALID` / `on conflict do nothing`, so re-running is harmless):

| # | Migration | Purpose |
|---|---|---|
| 1 | `20260626000700_schema_catchup.sql` | Ensures all drift-prone columns + the `credit_transactions→profiles` FKs + widened `projects` status constraint (supersedes the column-adds of 000100/000400). |
| 2 | `20260607000200_supplier_orders.sql` | `supplier_orders` table (audit flagged it missing). |
| 3 | `20260626000200_notify_project_submitted_trigger.sql` | Verifier bell on submit/resubmit. |
| 4 | `20260626000300_backfill_validated_listings.sql` | Publishes validated projects to the marketplace + backfills. |
| 5 | `20260626000500_fix_credit_pool_availability.sql` | Fixes the `credits_available` pool (false "sold out"). |
| 6 | `20260626000600_admin_finance_console.sql` | Admin finance RPCs (`is_admin`-gated). |
| 7 | `20260626000800_seed_tax_settings.sql` | Seeds VAT/company tax settings. |
| 8 | `20260626000900_public_registry.sql` | Public registry RPCs (anon-granted). |
| 9 | `20260626001000_performance_indexes.sql` | Hot-path indexes. |

Already applied earlier this session: `20260626000000` (DPA), `20260626000100` (status
constraint), `20260626000400` (marketplace reconcile). After applying, **re-run the audit**
to confirm an empty result.

> 🆕 **Two more migrations from the Phase 2–4 code sweep** (apply via SQL Editor; idempotent,
> drift-safe, no behaviour change to existing flows):
> | # | Migration | Purpose |
> |---|---|---|
> | 10 | `20260627000000_scale_composite_indexes.sql` | Composite hot-path indexes (sold-qty scan, history, seller listings). |
> | 11 | `20260627000100_market_integrity.sql` | Double-claim serial guard + `public_market_stats()` RPC (powers `/market`). |
> | 12 | `20260627000200_fix_admin_recent_transactions_casts.sql` | **Fixes a live 42804** — `admin_recent_transactions()` selected raw `credit_transactions` columns with no casts, so on a drifted DB (e.g. `quantity` integer ≠ declared numeric) the Finance Console RPC 400'd. Now casts each column to its declared type. |

---

## 1. What changed

### 2026-07-02 — server-authoritative cutover: first live sandbox pass (bug found + fixed; commit `a881294`)
The cutover money path was runtime-tested for the first time. It did **not** work
out of the box — the first purchase surfaced a hard blocker that had been latent
because this RPC path was never exercised against the live DB. Fixed and
**partially re-verified** the same session.

| Area | What | Notes |
|---|---|---|
| **Bug (critical)** | `process_marketplace_purchase` inserted `credit_ownership.status = 'active'`; the live `credit_ownership_status_check` allows only `'owned'`/`'retired'`/`'transferred'` → **every card/cart purchase rolled back**, webhook 500'd, intent stuck `pending`, and **PayMongo auto-disabled the webhook** after repeated failures | Fix: migration `20260702000000_fix_marketplace_ownership_status.sql` (`status = 'owned'`, matching sibling `process_wallet_purchase`). Safe — `status` is not a read filter (portfolio uses `ownership_type`; retire filters on user/project/qty) |
| **Ops** | PayMongo webhook had been auto-disabled → re-created it + reset `PAYMONGO_WEBHOOK_SECRET`; delivery restored | PayMongo has no dashboard "re-enable"; recreate or call the `/enable` API |
| **Diagnostics** | `paymongo-webhook` now records thrown handler errors to `webhook_events.error` (was silent — a failed handler just left the event at `received` and retried) | [paymongo-webhook/index.ts](../supabase/functions/paymongo-webhook/index.ts) |
| **UI** | `/upgrade` now confirms/polls the plan on return from PayMongo (`?status=success`) and shows success/pending/cancelled; previously it silently re-rendered "Free" even on a successful upgrade | [UpgradeView.vue](../src/views/UpgradeView.vue) |
| **DB** | Applied §0 `20260626000700_schema_catchup` (adds `credit_transactions → profiles` FKs); schema audit now empty → the receipt/certificate 400 join noise is gone | — |

> **Step 4 status (see [YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md)):**
> ✅ **A. card purchase** (settles via webhook, certificate issued, reconcile = 0) ·
> ✅ **F. subscription** (`/upgrade` → Pro via `activate_subscription`) ·
> ⬜ **B. wallet top-up** · ⬜ **C. wallet purchase** · ⬜ **D. cart (2 items)** ·
> ⬜ **E. retire credits** — **not yet tested.** The **P1 RLS lockdown stays gated**
> until B–E pass. B–E run through `process_wallet_purchase` / `ensure_wallet` /
> `retire_credits_atomic` — the webhook now surfaces any failure in
> `webhook_events.error`.

### 2026-07-01 — money edges proven + codeable backlog + admin consoles (build green, ESLint 0, 145 tests)
The money path was proven end-to-end and the remaining "built-but-not-clickable" gaps were closed.
Everything below was **runtime-verified** this session (not just build-green). Four idempotent
migrations (`20260701000000–000300`) were applied.
| Area | What | Notes |
|---|---|---|
| **Money edges** | ✅ **payout + refund proven** — KYB-gated payout settled; cart + refund reversed; `reconcile_financials()` = 0 throughout | Phase 2 now PROVEN, not just code-complete |
| Backlog | Seller **per-project earnings** breakdown on `/sales` | pure `aggregateSalesByProject` + unit tests |
| Backlog | **Server-side pagination** on the buyer purchases tab | also un-orphaned `/retire` (redirected to `/wallet`, was unreachable) |
| Phase 3 | **Structured additionality + permanence** metadata (form → trust card) | migration `…000000`; persisted across all 3 write paths |
| Phase 6 | **Saved searches + price alerts** (marketplace) | migration `…000100`; bell alert on new/cheaper match |
| Nav | Surfaced **Retire Credits** (buyers) + **Seller Earnings** (developers) in nav | both existed but were linked nowhere |
| Phase 5 | **Admin KYB-review console** (`/admin/kyb`) + **Refunds/Disputes console** (`/admin/refunds`) | migration `…000200` (admin refund RPC); were backend-only RPCs |
| Phase 2 | **Seller KYB submission form** (from the Seller Earnings gate) | completes the click-driven payout path |
| Phase 5 | **Admin KYC-level override + level list** in User Management (fixes a 400) | migration `…000300`; KYC ≠ KYB clarified |
| DPA | **`account-deletion` edge function deployed** | erasure worker live |

> All 2026-07-01 work is committed on `feature-user-onboarding-ux` and pushed. Migrations
> `20260701000000–000300` are applied on the live DB.

### 2026-06-26 — UI/UX design pass + a Submit-Project fix (build green, ESLint 0, 114 tests)
A presentation-layer polish sweep across the most-used screens, kept brand-safe (green/white
Carbonify identity) and **logic-free** except for one genuine bug fix. Every change is CSS/markup
only and revertible per-file with `git checkout`.
| Area | What | Notes |
|---|---|---|
| Header / nav | Profile dropdown + mobile menu rebuilt into **role-aware grouped sections** (Workspace / Account / Shopping / Records / Tools / More) with icons + identity header; top-nav links got pill hover + animated underline | [Header.vue](../src/components/layout/Header.vue); routes unchanged |
| Header | Removed the name/role **text block** from the bar — now just the **bell + avatar**; name/role still shown inside the dropdown | per request |
| Page heroes | Unified the **green hero gradient** across Market, Registry, Finance Console, About to match the Marketplace hero (they were teal/light before) | [MarketDashboardView](../src/views/MarketDashboardView.vue), [RegistryView](../src/views/RegistryView.vue), [FinanceConsoleView](../src/views/FinanceConsoleView.vue), [AboutView](../src/views/AboutView.vue) |
| Profile | Brand-gradient header, **role pill** (colour-tinted per role), phone/website shown, tinted Role & Access card | [ProfileView.vue](../src/views/ProfileView.vue) |
| Admin dashboard | Gradient header, **floating stat cards with tinted icons**, green tool-card hovers (was off-brand blue), accented section headers + pill "Open Full Role Applications" | [AdminDashboard.vue](../src/components/admin/AdminDashboard.vue) |
| Project detail | Pill back-button, richer hero (overlay + zoom), accented card headers, hover lifts, listing rows, gradient "Go to marketplace" button | [ProjectDetailView.vue](../src/views/ProjectDetailView.vue) |
| **Submit Project (bug fix)** | The **Required Technical & Compliance Documents** inputs were `display:none` with no `for`/`id` and no click handler — **they were not clickable at all**. Rebuilt each as a `<label>`-wrapped **card with a plain-language description** of the document (PDD, Baseline, Additionality, Leakage, Safeguards, LGU Endorsement, Land/Lease, ECC, MOA) + an attached/required status. Clicking now opens the file picker natively | [ProjectForm.vue](../src/components/ProjectForm.vue); `handleSingleDocUpload` + refs unchanged. **Runtime-verify** an actual upload |

> ⚠️ The document-input fix is exactly the "code-complete but runtime-untested" class — those
> required-doc fields had never been clickable, so confirm a real PDF attaches on submit.

### 2026-06-26 session — features shipped (build green, ESLint 0)
| Area | What | Commit |
|---|---|---|
| Phase 5 | DPA tooling — self-service data export + account-deletion request + erasure worker | `3d14b5e` |
| Phase 4 | Edit/resubmit-after-revision loop complete (queue re-entry, verifier bell, revision badge) | `d7d0055`, `95be6f3` |
| Phase 3 | Full buyer-facing project-detail page (trust card, developer, map, docs, co-benefits) | `d993521` |
| Phase 3 | `local\|supplier` provenance badge + marketplace filter | `977ce39` |
| Phase 3 | ESG / offset report export (PDF + CSV) on the Credit Portfolio | `73f7c97` |
| Phase 3 | SDG tagging (submit form) → display → marketplace filter, end-to-end | `1ab3785` |
| Phase 5 | Admin finance console (sales/fees/payouts + book reconciliation, admin-gated RPCs) | `9790dc3` |
| Phase 5 | Provisional VAT invoices (12% PH VAT, admin-configurable tax identity) | `742305e` |
| Phase 7 | Public searchable carbon registry (`/registry`, anon-accessible) | `81792ac` |
| Phase 7 | Hot-path DB indexes | `5683731` |
| Nav/UX | Portfolio link in top nav; verifier panel scroll fix; misc | `87a5e84`, `b765b63` |
| DB | Schema-drift fixes + consolidated **catch-up** migration + read-only audit | `a99ce91`, `80416b1`, `2e00a40`, `df62627`, `a378e6f`, `4991a64` |

> Several "missing" roadmap items turned out to be **already built** (verification checklist,
> SLA aging, audit-log search) — verified, not rebuilt. The recurring theme this session was
> the live DB **lagging the migrations**; §0's catch-up + audit close that out.

### 2026-06-26 — codeable-backlog sweep (no dashboard/partner needed, build green, ESLint 0)
A pass to clear the items that could ship as pure code, with **zero new migrations**
(every feature reuses existing columns/tables) — so nothing here is blocked on the
dashboard or an external party:
| Area | What | Notes |
|---|---|---|
| Phase 4 | **Weighted scored rubric** on the validation checklist (Inadequate/Adequate/Strong × per-item weight → overall score + band) | Score stored in the existing `verification_assessments.checklist` JSONB; `checked` kept in sync |
| Phase 4 | **Project boundary map** — draw the location pin + boundary polygon at submit/edit | Writes `projects.geo_coordinates` + `projects.boundary` (cols already exist); detail view already rendered them. Also fixes a latent bug where **geo was never saved on create** |
| Phase 4 | **MRV reporting reminders** — due/overdue banner on the Monitoring page + deduped bell notification | Derived from `projects` + `monitoring_reports` vs admin cadence `mrv_reporting_days` (default 365); no schema change |
| Phase 8 | **Offline-capable service worker** — app-shell precache, network-first nav with offline fallback, stale-while-revalidate assets | Same-origin GET only; never caches Supabase/PayMongo/OSM |
| Phase 8 | **Mobile polish** — wide tables (finance console, seller earnings, emission factors) now scroll + 640px breakpoints | No behavior change |

> All five are **runtime-untested** (🆕) — they're committed and build-green but, like the
> rest of the session, want a real click-through. None require the §0 migrations or the
> dashboard blocker; they can be tested as soon as the app is running.

### 2026-06-26 — Phase 2–4 + backlog code sweep (after the money path was proven)
Advanced the unimplemented phases with pure-code work (build green, ESLint 0, **114 unit
tests**, +40 this sweep). Two new idempotent migrations (§0 #10–11); everything else is
additive and leaves the proven money path untouched.
| Phase | What | Notes |
|---|---|---|
| **2 — Beta hardening** | Payment-path tests: VAT-invoice math, weighted rubric, seller-withdrawal validation | Locks the money/feature logic against regression (the silent-webhook-bug class) |
| **3 — Scale** | Composite hot-path indexes + `getUserPurchaseHistoryPage()` (server-side paginated history with exact count) | Additive; existing marketplace loader untouched |
| **4 — Credibility** | Double-claim **serial guard** (unique `certificates.registry_serial`) + **`/market` public dashboard** (`public_market_stats`) | Mirrors the registry's anon pattern |
| **Backlog** | Buyer **portfolio gain/loss vs market** (real value, replaces the fake `×25` placeholder) | Pure `computePortfolioPnl` + cost basis surfaced from `purchase_price` |

> ⏳ Still open in the backlog (not yet built): seller per-project earnings/issuance history,
> saved-search/price alerts. The `/market` dashboard and paginated history are not yet linked
> in the nav (reachable by URL); wiring is a small follow-up.

### 2026-06-25 cycle — Branding & UX (build green)
- ✅ **Rebrand EcoLink → Carbonify** across ~105 files (app, views, services, config, docs, `index.html`,
  `manifest.json`, edge functions). Internal storage keys + applied DB migrations intentionally preserved.
- ✅ **Logo** — new `public/carbonify-logo.png` wired into header, login, register, mobile menu, favicon, manifest.
- ✅ **Login fix** — surfaced the real "Email not confirmed" error; root cause was unconfirmed accounts +
  `[auth.email] enable_confirmations` (handled in `config.toml` / dashboard).
- ✅ **Project Map fix** — map never rendered (Leaflet init ran before the container existed); also added a
  stacking context so the map can't paint over the sticky header. Uses free OpenStreetMap tiles (no key).
- ✅ **Legal policies** — split the single modal into real **Terms / Privacy / Carbon Credits** docs with the
  pre-production disclaimer, matching `POLICY_AND_USER_AGREEMENT.md`.
- ✅ **Profile menu** — moved About / Saved / Cart into the profile dropdown (About for every role).
- ✅ **LGU Tools** — fixed input box-sizing/overflow + doubled row spacing on the MSW calculator.
- ✅ **Submit Project** — removed the developer's "Price per Credit" field; the **verifier sets the price**
  at review (also fixed a latent bug where editing would blank a verifier-set price).

### Money-path verification progress
- ✅ CLI logged in + linked to project `fmngptolarydbgrtltnd`.
- ✅ Deployed edge functions: **`process-payouts`** (was missing) and **`paymongo-checkout`** (refreshed).
- ✅ Applied the 3 pending migrations in the SQL Editor: `project_comments`, `app_settings`,
  `verification_checklist` (fee-aware purchase RPC confirmed live).
- ✅ PayMongo webhook registered: `…/functions/v1/paymongo-webhook`, event `checkout_session.payment.paid`.
- 🐛 **Found + fixed a critical webhook bug** ([paymongo-webhook/index.ts](../supabase/functions/paymongo-webhook/index.ts)):
  it read the event name from the wrong field (`data.attributes.event`) and compared to the wrong value
  (`checkout.payment.paid`), so **every payment would be silently ignored** — buyer pays, nothing settles.
  Now reads `data.attributes.type` and accepts `checkout_session.payment.paid`; also fixed `sessionId`/`amount`
  extraction. **Code fixed; not yet deployed (see blocker).**

### Verifier workflow — Phase 4 (this cycle, committed)
- ✅ **Developer ↔ verifier comment thread** — was already built; unblocked by the applied `project_comments`
  migration. Added **comment notifications** ([notificationService.js](../src/services/notificationService.js))
  so the other party is alerted via the bell (reviewer→owner, owner→reviewers, internal notes→reviewers only).
- ✅ **Verifier price input** — the verifier now sets the price per credit at validation
  ([ProjectApprovalPanel.vue](../src/components/admin/ProjectApprovalPanel.vue)); persisted to
  `projects.credit_price` (blank falls back to the category default). Completes the submit-project change.

> Commits: `f39cf51` (rebrand + fixes + comment notifications); verifier price input committed after.

### Phase 5 — DPA tooling (data export / account deletion) — this cycle, code-complete 🆕
- ✅ **Self-service data export** — **Profile → Privacy & Data** tab → "Download my data"
  gathers everything we hold for the signed-in user (profile, transactions, holdings,
  certificates, activity, …) into a single JSON file. RLS scopes every read to the user;
  the source list is drift-proof (skips missing tables/columns).
  ([dataPrivacyService.js](../src/services/dataPrivacyService.js),
  [PrivacyDataPanel.vue](../src/components/account/PrivacyDataPanel.vue))
- ✅ **Account-deletion request** — same tab; a typed-`DELETE` confirmation records a
  request in the new `data_subject_requests` table (owner-or-admin RLS), idempotent per
  user, cancellable while pending.
- 🆕 **Erasure worker** — [account-deletion edge function](../supabase/functions/account-deletion/index.ts)
  deletes the auth user (cascades profile-keyed personal data; retains legally-required
  financial rows). **Code-complete; deploy when the dashboard blocker below is cleared.**
- Migration: [20260626000000_dpa_data_subject_requests.sql](../supabase/migrations/20260626000000_dpa_data_subject_requests.sql)
  (apply via SQL Editor). Fulfils the Privacy Policy's §2.5 promise. Build green, ESLint 0.

---

## 2. ✅ Money-path blocker — CLEARED (2026-06-26)

The Supabase CLI `403 "necessary privileges"` was sidestepped via the **Dashboard**: the 3
secrets (`PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYOUT_WORKER_SECRET`) were set
and the **bug-fixed `paymongo-webhook` was deployed** from the function editor. A real sandbox
purchase (PayMongo test card `4343 4343 4343 4345`, on the Vercel **preview** deploy of
`feature-user-onboarding-ux`) **settled cleanly** — `reconcile_financials()` = **0 rows**.

**Still needs the same Dashboard flow when you get to them:**
- Deploy the **`account-deletion`** edge function + set `ACCOUNT_DELETION_SECRET` (so DPA
  deletion requests can be processed).
- The money-path **edges** (subscription, payout, refund) — no new deploy, just app/SQL steps
  (runbook Step E).

> Testing setup used: pushed `feature-user-onboarding-ux` to GitHub, linked the repo to the
> `ecolink` Vercel project, and ran `vercel deploy` for a **preview** URL (production `main`
> intentionally untouched). The webhook posts to the public Supabase functions URL, so the
> preview front-end is enough to drive the test.

---

## 3. Roadmap — implemented vs not yet implemented

Legend: ✅ done & verified · 🆕 code-complete, runtime unverified · 🟡 partial · ❌ not started

### ✅ / 🆕 Implemented (as of 2026-06-26)
| Phase / area | Status |
|---|---|
| **0 — Stabilize** | ✅ webhook conflict markers, 4 latent bugs, ESLint 0, live schema fixes |
| **1 — Money Foundation** | ✅ **PROVEN** — real sandbox **purchase** settled (`reconcile_financials()` = 0) **and subscription** verified (`/upgrade` → Pro flipped `profiles.plan`). Provider abstraction, server-authoritative checkout, bug-fixed signed webhook, double-entry ledger, atomic purchase RPC, reconciliation |
| **2 — Seller Payouts** | ✅ **PROVEN (2026-07-01)** — escrow, payout state machine + worker, seller KYB gating, refunds/disputes, earnings dashboard; **payout + refund settled with `reconcile_financials()` = 0**. Now click-driven: seller KYB submission form, admin KYB-review (`/admin/kyb`) + refunds console (`/admin/refunds`) |
| **Branding & UX** | ✅ Carbonify rebrand; login/map/policies/LGU/submit-project fixes; mobile polish on heavy tables |
| **Buyer cart + watchlist** | ✅ sequential cart checkout + saved/watchlist |
| **3 — Buyer Trust** | 🆕 project-detail page, `local\|supplier` badge + filter, ESG/offset export, SDG tagging + filter, **project boundary map (draw + display)**, **buyer portfolio gain/loss vs market** — (real registry/supplier still pending a partner) |
| **4 — Developer ↔ Verifier** | 🆕 comment thread + notifications, verifier sets price at validation, edit/resubmit-after-revision loop, **weighted scored rubric**, SLA aging, **MRV reporting reminders** |
| **5 — Admin & Compliance** | 🆕 DPA tooling (export/delete + erasure worker), admin finance console, provisional VAT invoices, audit-log search, system-config UI |
| **7 — Scale & Security** | 🆕 public searchable registry, **`/market` public dashboard**, hot-path + **composite indexes**, **server-side paginated purchase history**, **double-claim serial guard**, offline service worker, **payment-path test suite (114 tests)** |
| **8 — Mobile / PWA** | 🆕 installable manifest, offline service worker, mobile view polish |

> Money path = ✅ **fully proven** (purchase + subscription + payout + refund, all reconcile to 0, 2026-07-01). The 2026-07-01 session also runtime-verified the codeable-backlog features + admin consoles below.

### ❌ Not yet implemented (what's actually left)
| Item | Phase | Blocked on |
|---|---|---|
| **Real registry/supplier integration** | 3 | 🌐 external registry partner (Verra / Gold Standard / Carbonmark / Patch) |
| **AML / sanctions screening** | 5 | 🌐 a sanctions/PEP data vendor |
| **Error tracking (Sentry) + alerts** | 2 | you — a Sentry DSN; then codeable |
| **Web push notifications** | 8 | you — a deployed edge fn + VAPID keys |
| **Pentest · backups/PITR · connection pooling · observability** | 7 | ops/infra + a provider key |
| **Legal entity · PSP/EMI · BIR/DPO · accredited VVB** | 9 🏛️ | business/legal |
| **Money-path gated cutover** (server-authoritative Buy UI + RLS lockdown) | 1 | codeable now — see NOW_IMPLEMENTATION_PLAN Wave 3 |
| **Code hygiene** (dual-column canonicalization, FK-fallback removal, split large views) | — | codeable now — Wave 2 |

> ✅ **2026-07-01 — DONE this session (built + runtime-verified):** seller per-project earnings ·
> purchases pagination · structured additionality/permanence · saved-search/price alerts · admin
> KYB-review console · refunds/disputes console · seller KYB submission form · admin KYC-level
> override + level list. Migrations `20260701000000–000300` applied. All the codeable-backlog +
> "built-but-not-clickable" gaps are closed.

---

### Schema drift — catch-up tooling (this cycle)
The live DB predates the tracked migrations and has been applied piecemeal, which
repeatedly surfaced as "missing column" 400s and broken PostgREST joins. Two new files:
- [schema_catchup_audit.sql](../supabase/diagnostics/schema_catchup_audit.sql) — **read-only**;
  run it in the SQL Editor to list every expected table/column/FK/function that is **missing**
  on this DB. Empty result = fully current.
- [20260626000700_schema_catchup.sql](../supabase/migrations/20260626000700_schema_catchup.sql) —
  one **idempotent** migration that ensures all drift-prone columns + the credit_transactions→
  profiles FKs + the widened status constraint. Apply it to fix the column/FK/join class of
  drift in one shot. If the audit reports a missing **table**, apply that table's own migration.

## 4. Next steps

Feature work is essentially done (Phases 0–8 code-complete; money path proven for purchase +
subscription). What remains delivers value mostly via **you** or an **external dependency** —
the priority is **validation** plus a thin codeable backlog (see §3's "codeable backlog" row).

### A. ✅ The #1 thing — money-path sandbox test — DONE (2026-06-26)
1. ✅ Applied the §0 migrations + ran the schema audit (clean).
2. ✅ Set the 3 PayMongo secrets in the Dashboard.
3. ✅ Deployed the fixed **`paymongo-webhook`** from the Dashboard.
4. ✅ Ran the **sandbox purchase** (test card `4343 4343 4343 4345`) on the Vercel preview →
   **`reconcile_financials()` = 0 rows** (books balanced). Core money path **PROVEN**.

5. ✅ **Subscription** also verified — `/upgrade` → Pro paid → `profiles.plan` = `pro`.

   **⏳ Remaining money-path edges** (same setup, no new deploy — runbook Step E):
   - **KYB-gated payout:** approve seller KYB → Wallet → Withdraw → run `process-payouts` →
     `payout_requests`: requested → processing → settled.
   - **Cart + refund:** buy 2 listings, refund one → `reconcile_financials()` still 0 rows.

   Also still to do: deploy the **`account-deletion`** edge function + set `ACCOUNT_DELETION_SECRET`
   so DPA deletion requests can be processed. Full steps: [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md).

### B. Capture the work
- Branch is **~75 commits ahead of `main`** — open a PR (`feature-user-onboarding-ux` → `main`)
  or merge. A ready PR body is in the session scratchpad; `gh` is installed but unauthenticated,
  so push + `gh pr create` (or the web UI) is a manual step.

### C. Remaining work — all needs you or an external party
- **Real registry/supplier fulfillment** (Phase 3) — needs an external registry partner.
- **AML screening** (Phase 5) — needs a real sanctions/PEP data source to be meaningful.
- **Pentest · backups/PITR · connection pooling · observability** (Phase 7) — ops/infra + a
  monitoring provider key.
- **Mobile / PWA** (Phase 8) — codeable, but lower value than testing what exists.
- **BIR accreditation · legal entity · PSP/EMI partner** (Phase 9) — business/legal.
- **Favicon set** — generate square favicons from the logo (`scripts/create-favicons.js`).

---

## 5. Notes for whoever picks this up
- All session work is **committed** on `feature-user-onboarding-ux` (build green, ESLint 0).
- **Apply the §0 migrations** before testing; the schema had drifted behind all session.
  Run [schema_catchup_audit.sql](../supabase/diagnostics/schema_catchup_audit.sql) anytime to
  check (empty = current). As of the last audit only `supplier_orders` + 2 certificate columns
  were missing — both covered by the §0 list.
- VAT invoices are **provisional** (not BIR-accredited until the entity is registered).
- The public registry, finance console, and DPA RPCs are **SECURITY DEFINER** and self-gate
  (anon for the registry; `is_admin()` for finance; `auth.uid()` for DPA) — the underlying
  tables stay RLS-protected.
- PayMongo webhooks can't reach `localhost` — run the money-path test against the deployed app or a tunnel.
- Don't use `supabase db push` here (known schema drift) — apply migrations via the SQL Editor.
