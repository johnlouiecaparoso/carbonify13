# Carbonify — Handoff (current state)

> **Updated:** 2026-06-26 · **Branch:** `feature-user-onboarding-ux`
> Supersedes the 2026-06-25 handoff. Pair with [ROADMAP_SIMPLE.md](ROADMAP_SIMPLE.md)
> (plain-language roadmap), [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md)
> (money-path steps), and [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md) (full roadmap).

## TL;DR

Phases 0–7 are now **code-complete**. The 2026-06-26 session shipped DPA tooling, the
edit/resubmit loop, a buyer-facing project-detail page, `local|supplier` + SDG filters,
ESG export, an admin finance console, provisional VAT invoices, a public carbon registry,
and a **schema-drift catch-up** that brought the live DB back in sync. Build green, ESLint 0
throughout (~22 commits this session).

**The one thing left that delivers value is not code:** run the **money-path sandbox test**.
It's blocked only on a **Supabase dashboard step** (set the PayMongo secrets + deploy the
fixed `paymongo-webhook`). Everything else either depends on that test, on an external partner
(real registry, AML data, PSP), or on ops/legal.

> ⚠️ **Apply the pending migrations first** — see §0. The live DB had drifted behind the
> migrations all session; the catch-up (`20260626000700`) + audit
> ([diagnostics/schema_catchup_audit.sql](../supabase/diagnostics/schema_catchup_audit.sql))
> resolve that. Run the audit anytime to confirm the schema is current (empty result = good).

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

---

## 1. What changed

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

## 2. 🔴 Active blocker (dashboard-resolvable, blocks only the money-path test)

**Supabase CLI returns `403 "necessary privileges"`** for:
- `supabase secrets set` (all secrets)
- `supabase functions deploy paymongo-webhook` (the re-deploy with the bug fix)
- `supabase config push` (earlier)

…yet `functions deploy process-payouts` and `paymongo-checkout` **succeeded** earlier. So it's either a
**deploy throttle** or the CLI account isn't the project **Owner/Administrator**.

**To clear it (any one):**
1. **Set the secrets in the Dashboard** (Edge Functions → Secrets): `PAYMONGO_SECRET_KEY` (`sk_test_…`),
   `PAYMONGO_WEBHOOK_SECRET` (the webhook's `whsk_…`), `PAYOUT_WORKER_SECRET`
   (`3abdaf78e9fb629b9dcd4d23a110a7cc803440335ad304da4b0271312b16bd1f`).
2. **Deploy `paymongo-webhook` from the Dashboard** function editor (paste the fixed local file).
3. Or confirm the account is **Owner/Administrator** (Organization → Settings → Members) and retry the CLI.

---

## 3. Roadmap — implemented vs not yet implemented

Legend: ✅ done & verified · 🆕 code-complete, runtime unverified · 🟡 partial · ❌ not started

### ✅ / 🆕 Implemented (code-complete)
| Phase | Status |
|---|---|
| **0 — Stabilize** | ✅ webhook conflict markers, 4 latent bugs, ESLint 0, live schema fixes |
| **1 — Money Foundation** | 🆕 provider abstraction, server-authoritative checkout, signed webhook (now **bug-fixed**), double-entry ledger, atomic purchase RPC, reconciliation |
| **2 — Seller Payouts** | 🆕 escrow, payout state machine + worker, seller KYB gating, refunds/disputes, earnings dashboard |
| **Branding & UX** | ✅ Carbonify rebrand, login/map/policies/LGU/submit-project fixes (this cycle) |
| **Buyer cart + watchlist** | ✅ sequential cart checkout + saved/watchlist (shipped; predates these docs) |
| **3 — Buyer Trust** | 🆕 project-detail page, `local\|supplier` badge + filter, ESG/offset export, SDG tagging + filter (real registry/supplier still pending a partner) |
| **4 — Developer ↔ Verifier** | 🆕 comment thread + notifications, verifier sets price at validation, edit/resubmit-after-revision loop, **weighted scored rubric** 🆕, SLA aging, **project boundary map (draw + display)** 🆕, **MRV reporting reminders** 🆕 |
| **5 — Admin & Compliance** | 🆕 DPA tooling (export/delete + erasure worker), admin finance console, provisional VAT invoices, audit-log search, system-config UI |
| **7 — Scale (partial)** | 🆕 public searchable carbon registry, hot-path DB indexes, **offline-capable PWA service worker** 🆕 |

### ❌ Not yet implemented
| Phase | Highlights |
|---|---|
| **3 — Real Credits & Buyer Trust** (NEXT after verification) | real registry/supplier integration (needs external partner), ~~`local\|supplier` flag~~ (✅), ~~full project-detail page~~ (✅), ~~ESG/offset export~~ (✅), ~~real SDG filter~~ (✅ collect→display→filter this cycle) |
| **4 — Developer ↔ Verifier Workflow** (partial — see above) | ✅ edit/resubmit-after-revision loop, ~~scored checklist/rubric~~ (✅), ~~MRV reminders~~ (✅ in-app + bell), ~~methodology/boundary map~~ (✅ draw + display). ⏳ remaining: verifier task queue + SLA scoring depth |
| **5 — Admin & Compliance** | ~~system-config UI~~ (✅ already built — fee %, KYC tier, emission factors), ~~admin finance console~~ (✅), AML screening, ~~DPA data export/delete tooling~~ (✅), ~~BIR/VAT invoices~~ (✅ provisional, this cycle), ~~audit-log search~~ (already built) |
| **7 — Scale & Security** | ~~public searchable registry~~ (✅), ~~hot-path indexes~~ (✅ this cycle), pentest before live keys, connection pooling, backups/PITR, observability |
| **8 — Mobile / PWA** | ~~offline service worker~~ (✅), ~~mobile view polish (heavy tables)~~ (✅), installable PWA (manifest ✅), web push (⏳ needs deployed edge fn + VAPID keys) |
| **9 — Business / Legal** 🏛️ | legal entity, PSP/EMI partner, AMLA/DPO/BIR, accredited VVB |

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

Feature work is essentially done (Phases 0–7 code-complete). What remains delivers value only
via **you** or an **external dependency** — so the priority is now **validation, not building**.

### A. 🔴 The #1 thing — run the money-path sandbox test (your dashboard step)
1. Apply the §0 pending migrations + run the schema audit (confirm empty).
2. Set the 3 PayMongo secrets in the **Supabase Dashboard** (Edge Functions → Secrets):
   `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYOUT_WORKER_SECRET`.
3. Deploy the fixed **`paymongo-webhook`** from the Dashboard function editor.
4. Run the **sandbox purchase** (test card `4343 4343 4343 4345`) → then open the new
   **Admin → Finance Console**: the sale should appear and reconciliation should read
   "books balanced" (`reconcile_financials()` = 0 rows).
5. Then: subscription, KYB-gated payout, cart + refund (all 0-drift).
   Full steps: [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md).
   Also deploy the **`account-deletion`** edge function + set `ACCOUNT_DELETION_SECRET`
   so DPA deletion requests can actually be processed.

### B. Capture the work
- Branch is **~67 commits ahead of `main`** — open a PR (`feature-user-onboarding-ux` → `main`)
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
