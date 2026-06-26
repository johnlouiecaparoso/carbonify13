# Carbonify — Handoff (current state)

> **Updated:** 2026-06-25 · **Branch:** `feature-user-onboarding-ux`
> Supersedes the 2026-06-15 Phase-1 handoff. Pair with
> [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md) (the executable next steps),
> [PHASE1_VERIFICATION_RUNBOOK.md](PHASE1_VERIFICATION_RUNBOOK.md) (deep SQL), and
> [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md) (the full roadmap).

## TL;DR

Two tracks are in flight:
1. **UX / branding polish** — done this cycle: full **EcoLink → Carbonify rebrand**, login/email-confirmation
   fix, project-map fix, split legal policies, LGU form fix, and submit-project pricing moved to the verifier.
2. **Money-path verification** (the #1 priority) — **in progress.** Migrations applied, functions deployed,
   and a **critical webhook bug was found and fixed in code**. **Blocked** on one thing: the Supabase CLI
   returns `403` for secret-management and the webhook re-deploy (account-role or deploy-throttle issue).
   That blocker is **dashboard-resolvable** and does **not** block any other work.

---

## 1. What changed this cycle (2026-06-25)

### Branding & UX (all merged on `feature-user-onboarding-ux`, build green)
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
| **4 — Developer ↔ Verifier (partial)** | ✅ two-way comment thread + notifications; verifier sets price per credit at validation; **edit/resubmit-after-revision loop complete** (resubmit notifies reviewers in-app + revision badge) |
| **5 — DPA tooling (partial)** | 🆕 self-service data export + account-deletion request (UI live); erasure worker code-complete, awaiting deploy |

### ❌ Not yet implemented
| Phase | Highlights |
|---|---|
| **3 — Real Credits & Buyer Trust** (NEXT after verification) | real registry/supplier integration, `local\|supplier` flag, full project-detail page, ESG/offset export, real SDG filter |
| **4 — Developer ↔ Verifier Workflow** (partial — see above) | ✅ edit/resubmit-after-revision loop done. ⏳ remaining: scored checklist/rubric, verifier task queue + SLA, MRV reminders, methodology/boundary map |
| **5 — Admin & Compliance** | system-config UI, admin finance console, AML screening, ~~DPA data export/delete tooling~~ (✅ code-complete this cycle), BIR/VAT invoices, audit-log search |
| **7 — Scale & Security** | **public searchable registry**, pentest before live keys, pooling/indexes, backups/PITR, observability |
| **8 — Mobile / PWA** | installable PWA, mobile views, web push |
| **9 — Business / Legal** 🏛️ | legal entity, PSP/EMI partner, AMLA/DPO/BIR, accredited VVB |

---

## 4. Next steps

### A. Blocked on the dashboard (the money-path test) — do when ready
1. Set the 3 secrets (Dashboard).
2. Deploy the fixed `paymongo-webhook` (Dashboard editor).
3. Run the **sandbox purchase** (test card `4343 4343 4343 4345`) → `reconcile_financials()` must return 0 rows.
4. Then: subscription, KYB-gated payout, cart + refund (all 0-drift).
Full steps: [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md).

### B. Unblocked — can be done right now (no Supabase-admin needed)
- ✅ **Committed** the rebrand + fixes (`f39cf51`).
- ✅ **Developer↔verifier comment thread + notifications** (Phase 4).
- ✅ **Verifier price input** at validation (Phase 4).
- ✅ **Phase 5 — DPA tooling** (data export / account-delete request) — **done this cycle**
  (apply migration `20260626000000` via SQL Editor; deploy `account-deletion` to enable erasure).
- **`local | supplier` listing flag** (Phase 3 groundwork) — pure schema + UI label, no payments needed.
- ✅ **Edit & resubmit after "needs revision"** (Phase 4) — **done this cycle** (resubmit
  re-enters the verifier queue, notifies reviewers in-app, and shows a revision badge).
- **Favicon set** — generate proper square favicons from the new logo (`scripts/create-favicons.js`).

> Next recommended: the **`local | supplier` flag** (Phase 3 groundwork) or a **scored
> verification checklist/rubric** (Phase 4). These move the product forward while the
> money-path test waits on the dashboard step. (DPA tooling + edit/resubmit loop ✅ done this cycle.)
>
> When the dashboard blocker clears, also deploy the **`account-deletion`** edge function and set
> its `ACCOUNT_DELETION_SECRET` so deletion requests can actually be processed.

---

## 5. Notes for whoever picks this up
- Working changes are on `feature-user-onboarding-ux` and **not yet committed**.
- The `'EcoLink Standard'` credit label still lives in the live DB mint function
  ([migration 20260604010100](../supabase/migrations/20260604010100_decouple_issuance_mint_on_ver.sql)); existing
  rows were updated by hand, but a new migration should `CREATE OR REPLACE` the function to emit `'Carbonify Standard'`.
- PayMongo webhooks can't reach `localhost` — run the money-path test against the deployed app or a tunnel.
- Don't use `supabase db push` here (known schema drift) — apply migrations via the SQL Editor.
