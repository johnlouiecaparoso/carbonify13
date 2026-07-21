# Carbonify — Handoff (current state)

> ## 📍 Where we are — verified 2026-07-20 · doc reconciliation 2026-07-21
>
> **Feature-complete for the current product scope. The money path is hardened in code and verified against the live DB. Remaining work is mostly external, operational, or legal.**
>
> **The next step is the closed beta on PayMongo test keys** — see [SOFT_LAUNCH_RUNBOOK.md](SOFT_LAUNCH_RUNBOOK.md) (execution), [TESTING_PLAN.md](TESTING_PLAN.md) (what to test), and [UAT_TEST_SCRIPT.md](UAT_TEST_SCRIPT.md) (per-role scripts to hand to pilot users).
>
> Read [CARBONIFY_OVERVIEW.md](CARBONIFY_OVERVIEW.md) for the plain-language system map. Read [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) for the real-money launch gate.
>
> **Current build state:** build green, lint green, ~313 tests green at the last verified checkpoint.
>
> *2026-07-21 was a documentation-reconciliation pass only — no code, DB, or deploy change. It corrected stale "do this next" instructions that later entries in this same file had already superseded.*

## Current snapshot

- Carbonify is a Philippine carbon-credit registry and marketplace with role-based workflows for developers, verifiers, buyers, admins, and LGUs.
- The core product flow is in place: register -> validate -> MRV -> issue -> trade -> retire, and it has been run end-to-end against the live DB.
- The money path is server-authoritative: settlement is controlled by the backend, not the browser, and the financial tables are RLS-locked against client writes (**verified on live 2026-07-20**).
- `reconcile_financials()` returns **0 rows** on live — a clean baseline for the pilot.
- The most important remaining work is the pilot itself, then launch hardening, external integrations, and operations/legal readiness.

## Implemented now

- Auth, roles, router guards, and MFA/KYC/KYB gates.
- Project registration, MRV, verifier review, issuance, and QR-verifiable certificates.
- Marketplace, cart, wallet, retirement, receipts, seller earnings, payouts, and refunds/disputes.
- Public registry and market views, plus LGU and admin tooling.
- The seven expansion features (registry fields, carbon asset ledger, biomass marketplace, MRV dashboard, investor portal + data room, farmer portal); the AI assistant is interface-only.
- Developer docs, user guides, testing docs, deployment docs, and security docs.

## Not yet implemented or still external

**Gates before real money** (detail in [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) §5):
- **Independent penetration test** — the last P0 before live payment keys.
- **Email confirmation is OFF by choice** — anyone can sign up with an address they do not control. Needs an owned domain (~₱600–900/yr) verified in Resend.
- **Legal entity / licensed PSP / BIR-accredited receipts / AML-DPO program** — business track, runs in parallel.
- **Real credit-supplier integration** for live registry-retirement fulfillment (Carbonmark/Cloverly/Patch). Today a retirement produces a Carbonify certificate, not a Verra/Gold Standard registry receipt.

**Open engineering items that do not block the pilot but must be settled before live keys:**
- **Escrow was silently reverted** ([DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) #14) — sellers are immediately withdrawable with no dispute/chargeback hold window. Decide instant-payout-by-design vs. restore the hold.
- **The money-table RLS posture is not in version control** ([DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) #13c) — the live policies are correct and verified, but a fresh env (staging/DR/local) rebuilds from migrations that never create them. The repo cannot yet *prove* the money tables are locked down.
- **Migration `20260718001100`** (receipt FK schema-cache reload) — still pending on live. Non-fatal; clears a console 400/406 on receipts.
- **Testing gaps** ([TESTING_PLAN.md](TESTING_PLAN.md)) — no automated RPC/RLS integration tests, Playwright e2e not required in CI and not run on a seeded backend, no load test, accessibility pass partial.
- **Externally-blocked feature work** — MRV satellite/IoT feeds (#4), AI assistant backend (#7, needs an API key + running cost), farmer training content (#6e).

## 🔜 Do these next, in order

1. **Run the pilot pre-flight** — [SOFT_LAUNCH_RUNBOOK.md](SOFT_LAUNCH_RUNBOOK.md) §1, all seven checks green (reconcile 0 · no errored `webhook_events` · 7 edge functions deployed · PayMongo in **test** mode with the webhook enabled · `ALLOW_UNSIGNED_WEBHOOKS` unset · Sentry receiving · frontend deployed).
2. **Decide the beta database** — [TESTING_PLAN.md](TESTING_PLAN.md) §3. Recommendation: reuse the current live project now that reconcile is clean, but purge or clearly label leftover test projects/listings first.
3. **Confirm the `20260718000000`–`000700` batch is fully applied on live** — see the apply-status note below. One query settles it.
4. **Run the closed beta** — invite ~8–15 users covering every role, disclose the runbook §2 limitations, hand out [UAT_TEST_SCRIPT.md](UAT_TEST_SCRIPT.md), and check `reconcile_financials()` = 0 daily.
5. **In parallel, close the two code-side items above** — capture the live money-table RLS into a versioned migration (#13c) and make the escrow call (#14). Both are required before live keys regardless of pilot outcome.
6. **Then start the real-money gate** — email confirmation on, independent penetration test, legal/PSP track.

### ⚠️ Apply-status note (2026-07-21) — `20260718000000`–`000700`

The 2026-07-11 entries below say this seven-migration batch was written but **NOT applied**. Later
entries in this same file contradict that: validation failed live with
`column "available_credits" of relation "project_credits" does not exist`, which is only possible if
**`000700` (the column drop) had already landed**. So the batch was at least partly applied, and the
historical "apply these 7 next" instruction is stale — do not follow it blindly.

Settle it with one read-only query before the pilot rather than re-running migrations:

```sql
-- expect: no 'available_credits' row (000600/000700 landed)
select column_name, is_nullable from information_schema.columns
 where table_schema='public' and table_name='project_credits';

-- expect: the 4-arg signature only (000000 landed)
select p.proname, pg_get_function_identity_arguments(p.oid) as args
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='retire_credits_atomic';
```

Status of the later migrations is not ambiguous: **`000800` verified applied on live 2026-07-20**;
**`000900` + `001000` applied 2026-07-11**; **`001100` still pending**.

## Doc map

- [SOFT_LAUNCH_RUNBOOK.md](SOFT_LAUNCH_RUNBOOK.md) — the active next step: pre-flight, pilot click-through, daily monitoring, abort criteria.
- [TESTING_PLAN.md](TESTING_PLAN.md) — the layered what-to-test map and the beta plan.
- [UAT_TEST_SCRIPT.md](UAT_TEST_SCRIPT.md) — per-role, tick-box test scripts for pilot users.
- [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) — the real-money gate and priority tiers.
- [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) — everything knowingly postponed, with the reasoning.
- `docs/dev/` — setup, architecture, database/RPCs, deployment, testing, security.

> ## Historical notes below
>
> The remainder of this file preserves the detailed audit trail and older snapshots for traceability.
>
> ### ✅ 2026-07-11 (live testing) — END-TO-END FLOW NOW WORKS; drift fixed migration-by-migration
> A full live run (developer submits → verifier validates → buy → retire) surfaced a chain of
> **live-DB-vs-code drift** bugs, each fixed by a small migration. Apply status on the live DB:
> - ✅ **`000900`** issuance triggers → `credits_available` (validation + auto-listing work). *Applied.*
> - ✅ **`001000`** certificates schema catch-up (retirement/purchase certs generate). *Applied.*
> - ⬜ **`001100`** receipt FK cache reload (below). *Pending — or run `notify pgrst, 'reload schema';`.*
> - ✅ **`000800`** RLS write-lockdown (the security one). **VERIFIED APPLIED on live 2026-07-20** —
>   a read-only `pg_policies` check confirms all three blanket-write holes (project_credits,
>   credit_listings, credit_retirements) are gone and the `project_credits_owner_or_admin_delete`
>   marker policy exists. The #1 launch blocker is closed.
>
> Confirmed working live after `000900`+`001000`: validate → project auto-lists → purchase → retire →
> certificate. See per-fix notes below.
>
> ### ✅ 2026-07-20 — BOOKS VERIFIED BALANCED (`reconcile_financials()` = 0 on live)
> Ran the reconciliation against live. It flagged **4 `transaction_unaccounted` rows** — all ₱1.00,
> all between the owner's own test accounts (`louiecaparoso12` ↔ `johnlouiecaparoso12`), created
> **2026-06-26 to 2026-07-01**, i.e. pre-cutover client-side writes that never created a payment_intent
> or ledger group (exactly the legacy residue check #6 was built to surface — not a regression, and
> impossible to recreate now that the RLS lockdown is verified live). Footprint check showed **zero**
> dependent certificates / ledger entries / payment intents, so the four rows were **deleted**.
> `reconcile_financials()` now returns **0 rows** — a clean baseline for the test-key soft launch
> (see [SOFT_LAUNCH_RUNBOOK.md](SOFT_LAUNCH_RUNBOOK.md) §1a).
>
> ### 🛠️ 2026-07-11 — RECEIPT JOIN 400 (`credit_transactions ↔ profiles` not in PostgREST cache)
> The receipt embeds `buyer/seller:profiles!credit_transactions_*_id_fkey(...)` and 400'd with "Could not
> find a relationship … in the schema cache", then the per-profile fallback 406'd under `profiles` RLS — so
> the receipt rendered without counterparty names. The buyer/seller→`profiles(id)` FKs exist
> (`20260606000100`/`20260626000700`); **PostgREST's relationship cache was stale.** **Fix:** migration
> **`20260718001100_credit_tx_profile_fk_reload.sql`** re-asserts both FKs (idempotent, NOT VALID) and
> reloads the schema cache. Non-fatal (receipt already worked), but clears the console 400/406. Caveat:
> after the reload, `profiles` RLS still governs which embedded rows are visible, so a counterparty's name
> may still be blank by design — showing it would need a small `SECURITY DEFINER` name-only RPC (not a
> `profiles` RLS loosening, which we deliberately hardened).
>
> ### 🛠️ 2026-07-11 — CERTIFICATES SCHEMA CATCH-UP (retirement/purchase certs failed silently)
> After a retirement, certificate generation 400'd ("creating certificate with all fields" / retirement
> cert lookups by `retirement_id`). The `certificates` table predated version control and its live shape was
> **missing 11 columns** certificateService writes: `retirement_id` (the retirement↔certificate link the
> lookups filter on), `project_description`, `tonnes_co2`, `beneficiary_email`, `purpose`,
> `transaction_id_ref`, `payment_reference`, `wallet_address`, `purchase_date`, `purchase_datetime`,
> `timestamp`. The retirement itself is unaffected (burn+record are atomic); only the certificate row failed.
> **Fix:** migration **`20260718001000_certificates_schema_catchup.sql`** adds the columns (idempotent) and
> captures the full table into version control from the live dump. *(Applied — certs now generate.)*
>
> ### 🛠️ 2026-07-11 — DRIFT REPAIR: issuance triggers still wrote the dropped `available_credits`
> Validating a project failed live with `column "available_credits" of relation "project_credits" does not
> exist`. **Root cause:** the M6 consolidation dropped `available_credits` (migration `000700`) on the
> premise it was "maintained by NO trigger" — **that premise was wrong.** Two SECURITY DEFINER issuance
> triggers write it: `activate_validated_project_trigger` (fires on validation, latest body from
> `20260626000500`) and `mint_credits_on_ver_approval`. After the column drop, the validation trigger throws
> and the whole `projects` status UPDATE rolls back — a **DB** failure surfacing as a frontend error, which
> is why no redeploy fixed it.
> **Fix:** migration **`20260718000900_issuance_triggers_use_credits_available.sql`** redefines both trigger
> functions to write only the canonical `credits_available` (same pool/listing logic otherwise). Also fixed
> a real client bug: the verifier's price-save called `updateProject` without `isAdmin`, 406-ing on a
> non-owned project (PR #9).
> **Note on the real flow:** the LIVE DB issues on **validation** — `activate_validated_project_trigger`
> creates the pool **and** an active listing the moment a project is validated, so a validated project goes
> straight to the marketplace. (The `20260604010100` "decouple, mint-on-VER" model was superseded on live by
> `20260626000500`, which re-established validation-time issuance.) **⚠️ Apply `000900` in the SQL Editor;
> then validating a project should succeed and list it.**
>
> ### 🔴 2026-07-11 (earlier) — LIVE RLS AUDIT: 3 CREDIT-INTEGRITY HOLES FOUND + CLOSED
> Merged the 2026-07-11 batch to `main` via **PR #7**, then audited the live `pg_policies` for the money
> tables. **Good:** the four ledger tables (`credit_ownership`, `wallet_accounts`, `wallet_transactions`,
> `credit_transactions`) are already client-SELECT-only. **Bad — three live, exploitable write holes:**
> - `project_credits` had a `USING(true) WITH CHECK(true)` ALL policy → **any user could mint
>   `credits_available`**.
> - `credit_listings` had the same → **any user could rewrite any listing's `price_per_credit`**, which
>   checkout reads to compute the charge (buy real credits for ₱0.01 — defeats server-authoritative pricing).
> - `credit_retirements` had a client INSERT policy → **forge a retirement + certificate with no burn**.
>
> Closed by new migration **`20260718000800_lock_credit_pool_and_listing_writes.sql`** (writes now go only
> through the SECURITY DEFINER issuance trigger + service_role RPCs, which are RLS-exempt; sellers keep own
> listings; staff keep all). **✅ VERIFIED APPLIED on live 2026-07-20** (read-only `pg_policies` check:
> all three blanket-write policies dropped, `project_credits_owner_or_admin_delete` present). Remaining
> capture work (codify the money-table RLS posture into a versioned migration) tracked in
> [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) #13.
>
> ### 🔎 2026-07-11 (later) — SENIOR REVIEW + 3 FOLLOW-UP CHANGES ON TOP OF THE 17 FIXES
> A senior-dev pass over architecture + security, on top of the audit below. **3 concrete changes made
> (working tree, uncommitted, still part of the same un-applied batch):**
> - **H1 regression corrected — do this BEFORE applying the batch.** Migration
>   `20260718000000_retire_credits_atomic_with_record.sql` had reintroduced
>   `v_user := coalesce(auth.uid(), p_user_id)` — the client-supplied-identity fallback that
>   `20260703000400` had deliberately removed. Now bound to `auth.uid()` with a null-reject (the 4-arg
>   signature/grant are unchanged, so the client caller is unaffected). Not exploitable under the
>   authenticated-only grant, but it silently undid a prior hardening; corrected while still un-applied.
> - **Dead client-side money writers deleted** — `addCreditsToPortfolio` / `removeCreditsFromPortfolio`
>   (290 lines) removed from `creditOwnershipService.js`. They did **un-transacted** browser writes to
>   `credit_ownership` + `credit_retirements` with a **client-supplied userId** (the TOCTOU/double-retire
>   pattern the atomic RPC replaced) and were called by no view. The read methods (`getUserCreditPortfolio`
>   / `getUserCreditStats`, used by `CreditPortfolioView` + `esgReportService`) are untouched.
> - **2 zero-byte dead files deleted** — `services/adminService.js`, `services/verifierService.js`
>   (imported nowhere). Progress against backlog #8.
>
> **Two review findings recorded, not yet actioned** (see [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md)):
> - **🔴 The financial-table RLS posture is not in version control.** There is no `create policy` for
>   `credit_ownership` / `wallet_accounts` / `wallet_transactions` / `credit_transactions` anywhere in
>   `supabase/migrations/`; the only lockdown lives in the gated `supabase/cutover/` script (backlog P1).
>   Any fresh env (staging/DR/local) rebuilds with client-writable money tables. **The repo cannot prove
>   the money tables are locked down** — capture the live `pg_policies` into a versioned migration.
> - **🟠 Escrow was silently reverted.** `escrow_holds` has had no writer since `20260606000600`; every
>   later `process_marketplace_purchase` credits `seller_payable` directly. Sellers are immediately
>   withdrawable with **no dispute/chargeback hold window** — a real fraud exposure on the card rail once
>   live keys are on. Decide instant-payout-by-design vs. restore the hold.
>
> Build ✅ · ESLint 0 ✅ · **313 tests ✅** after all three changes.
>
> ### 🛠️ 2026-07-11 — WHOLE-CODEBASE CODE AUDIT + 17 FIXES → [CODE_AUDIT_2026-07-11.md](CODE_AUDIT_2026-07-11.md)
> A four-reviewer code-level bug hunt (money path · expansion features · registry/investor · auth/roles),
> every finding adjudicated against the actual RPC/RLS SQL. **Fixed 17** (5 HIGH, 6 MED, 6 LOW) and
> consolidated the `project_credits` column drift. Highlights:
> - **H1 retirement is now atomic** — the burn + `credit_retirements` insert happen in one RPC
>   transaction (the HIGH previously "left unfixed on purpose" is closed).
> - **H2 wallet top-up double-credit** and **M1 double payout** — idempotency/claim guards added.
> - **H3 (NEW)** — any signed-in user could read/enumerate **every** project's compliance PII; the
>   bucket read policy is now scoped. **H4** send-approval-email relay closed. **H5 (NEW)** offtake
>   project-reassignment closed.
> - **`project_credits` drift RESOLVED** — `credits_available` (numeric) is canonical; the stale
>   `available_credits` stray is retired via expand/contract migrations.
>
> **7 new migrations (`20260718000000`–`000700`) + 4 edge-fn redeploys are written but NOT yet applied
> to the live DB.** Deploy order + pairing rules are in §"2026-07-11 deploy runbook" below. Three LOWs
> and one H3 residual (public/private bucket split) were deliberately deferred.
>
> ---
>
> #### Earlier baseline — 2026-07-09
>
> **All 31 migrations applied. Build ✅ · ESLint 0 ✅ · 312 tests ✅.**
>
> The seven expansion features, scored **bullet-by-bullet against the code** (not against these notes)
> in **[EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md)**:
>
> | # | Feature | First audit | Now |
> |---|---|---|---|
> | 1 | Project Registry | 5/8 | **8/8** ✅ |
> | 2 | Carbon Asset Management | 5/6 | **6/6** ✅ |
> | 3 | Biomass Marketplace | 6/7 | **7/7** ✅ |
> | 4 | MRV Dashboard | **0/8** | **6/8** 🟡 |
> | 5 | Investor Portal | 5/7 | **7/7** ✅ |
> | 6 | Farmer Portal | 3/6 | **5/6** 🟡 |
> | 7 | AI Assistant | 0/5 | **0/5** 🔴 interface only |
>
> **Nothing codeable remains in #1–#6.** What's open needs training *content* (#6e), an **API key +
> running cost** (#7), or **external feeds** (#4 satellite/IoT).
>
> ### 🔎 Codebase audits
> - **[CODE_AUDIT_2026-07-11.md](CODE_AUDIT_2026-07-11.md)** (latest) — whole-codebase, 17 fixed. The
>   retirement-atomicity HIGH and the `send-approval-email` relay noted below are now **fixed** (pending
>   live apply/redeploy). Two NEW HIGHs were found and fixed: unscoped project-document reads (PII) and
>   offtake project-reassignment.
> - **[CODE_AUDIT_2026-07-09.md](CODE_AUDIT_2026-07-09.md)** — earlier pass (empty /analytics charts ·
>   the 15s marketplace refresh wiping the grid · a load race · one unpriced listing reporting ₱0).
>
> ### 🔴 Do these next, in order *(SUPERSEDED 2026-07-21 — kept for history)*
>
> **⚠️ This list is stale. The current next steps are in "🔜 Do these next, in order" at the top of this
> file.** Items 1 and 2 below are contradicted or overtaken by later entries: the migration batch was at
> least partly applied (see the apply-status note at the top), `000800` was verified applied on live
> 2026-07-20, and the runtime verification in item 3 was exercised end-to-end on 2026-07-11.
>
> 1. **Apply the 2026-07-11 fixes to the live DB** — 7 new migrations + 4 edge-fn redeploys, written but
>    not yet applied. Order + pairing rules in the "2026-07-11 deploy runbook" note below. The
>    `20260718000000` H1 migration already carries the `auth.uid()` correction (above) — no extra step,
>    just apply the current file. *(Stale — confirm with the query at the top instead.)*
> 2. **Capture the live financial-table RLS into a versioned migration** (backlog P1). Dump
>    `select * from pg_policies where tablename in ('credit_ownership','wallet_accounts','wallet_transactions','credit_transactions')`
>    and codify it, so the migration chain — not an out-of-band cutover script — *is* the security posture.
> 3. **[RUNTIME_VERIFICATION_RUNBOOK.md](RUNTIME_VERIFICATION_RUNBOOK.md)** — nothing here has been
>    exercised against the live DB. Unit tests prove the pure math; they prove nothing about RLS
>    policies or RPC grants. **Start with §1, the privilege-escalation check.**
> 4. **Independent penetration test** — last P0 before live payment keys.
> 5. **Email confirmation** — OFF by choice (needs a domain, ~₱600–900/yr; Resend's free tier is
>    3,000 emails/mo). Until then **anyone can sign up with an address they do not control.**
>
> ### Two honest caveats about the positioning
> - **"National biomass registry"** — the public [`/registry`](../src/views/RegistryView.vue) is a
>   *certificate table*. It never shows methodology, development status, feedstock, or capacity;
>   that data lives only on each project's own page. And there is no DENR/CCC linkage.
> - **"ESG reporting platform"** — the ESG export is **credit-owner side only**. Developers,
>   farmers, and verifiers have no ESG export.
>
> ---
>
> <details><summary>Session-by-session notes (newest first)</summary>
>
> 🛠️ **2026-07-11 — WHOLE-CODEBASE AUDIT + 17 FIXES (deploy runbook).** Full findings in
> [CODE_AUDIT_2026-07-11.md](CODE_AUDIT_2026-07-11.md). Build ✅ · ESLint 0 ✅ · **313 tests ✅**. All
> code is in the working tree; **the DB/edge changes are NOT yet applied to the live project.**
>
> **① Run these 7 migrations in the SQL Editor** (`supabase/migrations/`):
> `20260718000000_retire_credits_atomic_with_record` (H1) · `…000100_scope_project_documents_read`
> (H3) · `…000200_offtake_update_ownership_guard` (H5) · `…000300_payout_processing_returns_claim`
> (M1) · `…000400_kyc_level_clamp` (M3) · `…000500_biomass_rpc_grant_hygiene` (L7) ·
> `…000600_available_credits_nullable` (M6 phase 1).
>
> **② Redeploy 4 edge functions:** `paymongo-webhook` (H2) · `paymongo-checkout` (L2) ·
> `send-approval-email` (H4) · `process-payouts` (M1). *(`npm run deploy:webhook` /
> `deploy:paymongo` cover the first two; the other two: `supabase functions deploy <name>`.)*
>
> **③ Deploy the frontend** (normal build) — carries H1-client, M2, M3, M4, M5, M6, L5, L6, L8, L9.
>
> **④ Then run the final migration:** `…000700_drop_available_credits` (M6 phase 2) — **only after ③**.
>
> **Hard pairing rules:** H1 migration must land **with** the frontend (old 3-arg
> `retire_credits_atomic` is dropped); M1 migration must land **with** the `process-payouts` redeploy
> (RPC return type changed `void→boolean`). The `available_credits` drop is expand/contract: `…000600`
> before the frontend, `…000700` after — no broken window.
>
> **Deferred (not touched):** L1 displayed-vs-charged price · L3 client-computed receipt total · L4
> `getTransactions` writing on a read path · H3 residual (a doc a validated project publishes is still
> viewable; the full fix is a public/private bucket split). **Then verify live** per
> [RUNTIME_VERIFICATION_RUNBOOK.md](RUNTIME_VERIFICATION_RUNBOOK.md).
>
> 🧪 **2026-07-09 — ALL 31 MIGRATIONS APPLIED. THE GAP IS NOW RUNTIME, NOT CODE.**
> All seven expansion features are code-complete to the limit of what code can do (#1 8/8 · #2 6/6 ·
> #3 7/7 · #4 6/8 · #5 7/7 · #6 5/6 · #7 interface-only). Build ✅ · ESLint 0 ✅ · **312 tests ✅**.
> **Nothing has been exercised against the live database.** Unit tests prove the pure math; they prove
> nothing about RLS policies, RPC grants, or drift fallbacks.
> 👉 **Do this next: [RUNTIME_VERIFICATION_RUNBOOK.md](RUNTIME_VERIFICATION_RUNBOOK.md)** — a
> step-by-step click-through with the expected result at each step and, when it fails, which layer
> broke. It starts with the **privilege-escalation check**, because nothing else matters if that hole
> is open.
>
> 📈 **2026-07-09 — PLANTATION PERFORMANCE MONITORING (#6f). No migration.** The parcel register was
> static: it stored `expected_yield_tonnes` and never compared it to anything. Deliveries now carry
> `parcel_id` (migration #31), so each parcel card shows **actual vs expected**, colour-coded.
> Build ✅ · ESLint 0 ✅ · **312 tests ✅** (+9).
>
> **The subtlety that shapes it:** `expected_yield_tonnes` is an **annual** figure, so actuals are
> summed over the **trailing 12 months**, not lifetime. A three-year-old parcel compared against one
> year's expectation would report **300% performance** and mean nothing. Lifetime tonnage is shown
> separately, as context rather than as the ratio.
>
> A parcel with no expected yield reports `performance: null` — **not zero, and not 100%**. An absent
> target is not a met one. Over-performance is reported honestly (130%), never capped at 100%.
> Non-mass units (sacks/bales/m³) are excluded, as everywhere else in the farmer math.
>
> 🌾 **2026-07-09 — FARMER CARBON PARTICIPATION (#6 now 5/6).** A farmer could see sacks and pesos,
> never how their feedstock became carbon. Migration **#31** adds `farmer_deliveries.project_id` — the
> missing link that made attribution impossible — plus `farmer_carbon_participation()`, and the Farmer
> Portal gains a **Carbon** tab. Build ✅ · ESLint 0 ✅ · **303 tests ✅** (+15).
>
> **The attribution rule is written down before the code** in
> [FARMER_CARBON_ATTRIBUTION.md](FARMER_CARBON_ATTRIBUTION.md): *pro-rata by delivered mass, per
> project, lifetime-to-date* — `verified_tCO₂e × farmer_tonnes / project_tonnes`, over **confirmed**
> deliveries and **approved** VERs. Shares sum to exactly 1, so a farmer can never be attributed carbon
> the project never verified. What a smallholder is told they contributed is a claim they will repeat;
> the doc records why this rule and not per-delivery carbon factors (which would let farmer totals
> exceed the project's verified total — the double-counting failure this platform exists to prevent).
>
> **Presented as an ESTIMATE, never as credit ownership** — the farmer cannot sell or retire it, and
> the UI says so first, not in a footnote. Deliveries in **sacks/bales/m³ are excluded from both sides
> of the ratio** (no bulk density → treating a sack as a tonne would corrupt *every other farmer's*
> share, since the denominator is shared), and the farmer is told how many were excluded and why.
> Deliveries the buyer never attributed to a project are counted and surfaced too.
>
> Buyers now name the project when confirming receipt. `confirm_farmer_delivery()` validates the buyer
> **owns** that project — otherwise a buyer could attribute feedstock to a rival's project, or inflate
> one farmer's share of it. The 3-arg version is dropped first: a defaulted 4th parameter would create
> an ambiguous overload for existing callers.
>
> **Migrations #30 + #31 APPLIED (2026-07-09).** All 31 migrations are live.
>
> 🗂️ **2026-07-09 — INVESTOR DATA ROOM SHIPPED (#5 COMPLETE, 7/7).** The portal showed a document
> *count badge* linking out to the project page. A data room is not a link: it is documents you open
> in context, plus a record of who opened them. Investors now open documents inside
> [`/investor`](../src/views/InvestorPortalView.vue) via short-lived signed URLs; developers see
> **who is reading what** at [`/developer/data-room`](../src/views/DataRoomActivityView.vue).
> Migration **#30**. Build ✅ · ESLint 0 ✅ · **288 tests ✅** (+16).
>
> **Three deliberate calls.** (1) The access log is written **only** through
> `log_data_room_access()`, a SECURITY DEFINER RPC that derives *both* the viewer (`auth.uid()`) and
> the developer (`projects.user_id`) server-side — with a plain INSERT policy the client supplies
> `developer_id` and could forge either side, or erase a row that incriminates them. (2) **Viewers are
> counted, never named.** An investor doing diligence reasonably expects not to be published as a
> named lead list; "is anyone reading my PDD?" is answered by distinct-viewer counts. (3) **Distinct
> viewers, not raw views** — one investor refreshing a PDD ten times is one interested party, and
> "10 viewers" would flatter the developer with a meaningless number. Self-views aren't recorded.
>
> **Migration #30 APPLIED (2026-07-09).**
>
> 🔓 **2026-07-09 — EMAIL CONFIRMATION IS OFF, DELIBERATELY (accepted risk, not an oversight).**
> Supabase Auth "Confirm email" stays **disabled** because the custom-SMTP sender needs a paid domain
> the owner isn't buying yet. Consequence: **anyone can sign up with an email address they do not
> control.** That is tolerable for demos and testing; it is **not** tolerable once real users hold
> real money, because account recovery and every notification route through an unverified address.
> **Before real users:** register a domain → verify it in Resend → set the Supabase SMTP sender +
> creds → re-enable confirmation. Steps in [TODAY_2026-07-07.md](TODAY_2026-07-07.md) §1c. No code
> change needed; signup is a standard `supabase.auth.signUp()`.
>
> 📑 **2026-07-09 — #1 COMPLETE (8/8) · #4 now 6/8.** Two small closers, **no migration**:
> **MRV Report** is now an optional project document type (a published monitoring report reaches the
> public project page — #1's last bullet), and the MRV dashboard gained a dedicated **Energy
> generated** tile (kWh → MWh → GWh). The tile sums `energy_kwh` only and **deliberately excludes
> `energy_saved_kwh`** — energy *saved* is avoided consumption, a different claim, and adding them
> would overstate what the project produced. Build ✅ · ESLint 0 ✅ · **272 tests ✅**.
>
> **Scorecard:** #1 **8/8** · #2 **6/6** · #3 **7/7** · #4 **6/8** (only satellite + IoT, both
> external) · #5 **6/7** (data room is a link-out) · #6 3/6 · #7 0/5.
> Full detail: [EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md).
>
> 🌱 **2026-07-09 — CO₂ REMOVED vs AVOIDED SPLIT (closes #4b + #4c).** The MRV dashboard summed every
> verified reduction into one tCO₂e figure. Registries and buyers price removals and avoidances very
> differently — a durable removal (biochar, afforestation) is not interchangeable with an avoided
> emission (methane capture, clean energy displacing coal) — so collapsing them hid the distinction a
> carbon buyer looks for first. Migration **#29** adds `reduction_type` to
> `verified_emission_reductions`; the **verifier now asserts it at approval** (pre-selected from the
> project category, never auto-applied); the dashboard shows **removed / avoided / unclassified**.
> Build ✅ · ESLint 0 ✅ · **269 tests ✅** (+11).
>
> **Nothing is backfilled, and that is the point.** Legacy VERs were approved without anyone being
> asked. Guessing from the project category would stamp an assertion onto an already-issued credit
> that no verifier made — a registry-grade error. They stay NULL and surface in an explicit
> **Unclassified** bucket. The category only *pre-selects* the verifier's dropdown
> ([`suggestedReductionType`](../src/constants/mrv.js)) because a category isn't decisive either: a
> biochar project removes carbon *and* the bio-briquettes burnt alongside it avoid emissions.
>
> Drift-safety matters more than usual here: **issuance must never fail because a classification
> column is missing**, so `approveReport` retries the VER insert without `reduction_type` and mints
> the credits unclassified. The dashboard read falls back the same way.
>
> **Migration #29 APPLIED (2026-07-09).** **⬜ To finish:** approve an MRV report → pick
> Removal/Avoidance → the dashboard splits it.
>
> 🏷️ **2026-07-09 — REGISTRY CREDIBILITY PASS (closes #1c + #1g).** **Methodology is now an enum**
> ([`projectRegistry.js`](../src/constants/projectRegistry.js)): Verra (VCS), Gold Standard,
> Puro.earth, ISO 14064, CDM, ACR, CAR, Plan Vivo, ISCC, a PH national methodology, and the interim
> Carbonify Standard — plus **Other**, so no developer is forced into a wrong standard. It was a
> free-text box, so "Gold Standard", "gold standard" and "GS" were three different projects to any
> filter. **`development_status` is a new column** (migration **#28**): concept → feasibility →
> financing → construction → operational → decommissioned. It is **orthogonal to `projects.status`**,
> which is the Carbonify *validation* workflow — a project can be fully `validated` on the platform
> and still be nothing but a feasibility study in the real world, and conflating the two was the bug.
> The Investor Portal now **filters by standard and by stage**. Build ✅ · ESLint 0 ✅ ·
> **258 tests ✅** (+11).
>
> Care taken: `methodology` stays **TEXT with no CHECK** — legacy rows hold free text like
> "Verra VM0044", and a constraint would reject them on any later UPDATE, including ones unrelated to
> methodology. Editing an old project maps its free text into **Other** with the text preserved rather
> than silently discarding it. `development_status` is **nullable** — defaulting existing projects to
> 'concept' would assert something untrue about every project already in the registry. And the
> Investor Portal's query **falls back** if the column is absent, rather than 400-ing the whole
> pipeline over one optional field.
>
> **Migration #28 APPLIED (2026-07-09).**
>
> 🤝 **2026-07-09 — OFFTAKE AGREEMENTS / ERPAs SHIPPED (closes #5's biggest gap).** Until now every
> IRR in the Investor Portal rested on an **assumed** credit price for every credit the project might
> ever issue. An ERPA is what turns a slice of that into **contracted** revenue. New
> [`/developer/offtakes`](../src/views/OfftakeAgreementsView.vue) lets a developer record agreements
> (counterparty, volume, price, term, status); the Investor Portal now splits **contracted vs
> speculative** revenue, blends the negotiated price with the listed price for the remainder, and
> shows a **downside IRR on contracted revenue alone**. Migration **#27**. 22 new tests.
> Build ✅ · ESLint 0 ✅ · **247 tests ✅**.
>
> **Confidentiality is the load-bearing design call.** Counterparty names and negotiated prices are
> commercially sensitive, so full rows are **owner-only** under RLS. Investors reach only aggregates
> via `offtake_summary()` — a SECURITY DEFINER RPC that returns contracted volume/value/count per
> project and **never** a counterparty, price, or document. Insert is doubly guarded (you must claim
> yourself as developer **and** own the project), or a developer could attach an agreement to someone
> else's project and inflate its contracted revenue.
>
> **Only `signed`/`active` count as contracted.** A draft, a negotiation, a completed or a terminated
> agreement contributes nothing — counting any of them would restate speculative revenue as
> contracted, the precise error this feature exists to prevent.
>
> Two correctness details found while building: **`irrContracted` is null for two different reasons**
> — nothing contracted, *or* contracted revenue ≤ OPEX (every year negative, so no real IRR exists).
> The second is a **solvency warning**, not a missing number, so `contractedCoversOpex` disambiguates
> and the portal renders them differently. And **over-commitment** (contracted volume > estimated
> issuance) is flagged in both the developer view and the portal rather than letting speculative
> volume go negative.
>
> **Migration #27 APPLIED (2026-07-09).** **⬜ To finish:** a developer records a signed agreement →
> the Investor Portal shows contracted % and the downside IRR.
>
> ✅ **2026-07-09 — TOP 3 AUDIT GAPS CLOSED.** **#2 buyer history** (a Buyer history section on
> [`/developer/ledger`](../src/views/CarbonAssetLedgerView.vue): counterparties per project with
> credits, value, purchase count, last purchase — the ERPA use case), **#4 farmers participating +
> biomass collected + plantation hectares** (a new *Farmer supply chain* panel on the MRV dashboard,
> wiring expansion #6 into #4), and **#3 black pellets** as a first-class feedstock type. Build ✅ ·
> ESLint 0 ✅ · **225 tests ✅** (+18).
>
> **Migration #26 (`20260712000000_parcel_supply_visibility.sql`) APPLIED (2026-07-09)** — plantation
> hectares now resolve. The audit wrongly called hectares "no migration": migration #25 made
> `farm_parcels` readable only by the owning farmer, so a developer couldn't see the area of parcels
> supplying them. #26 adds a narrow policy — a buyer may read a parcel **only** if it supplied them a
> delivery **they confirmed**. The "—" fallback remains as a drift-safe degrade path.
>
> Two correctness notes worth keeping: **biomass tonnage excludes sacks/bales/m³** (their mass depends
> on bulk density — summing them would invent a number) and counts **confirmed deliveries only**;
> **buyer names degrade to "Unknown buyer"** if `profiles` reads are RLS-blocked, rather than erroring.
>
> 🔍 **2026-07-09 — BULLET-BY-BULLET AUDIT OF THE 7 EXPANSION FEATURES → [EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md).**
> The features were tracked at *feature* granularity ("#5 Investor Portal — shipped"), which hid
> missing **sub-items inside shipped features**. Audited against the code, the feature-level status
> below was **over-optimistic**. Real per-bullet score: **#1 5/8 · #2 5/6 · #3 6/7 · #4 0/8 fully ·
> #5 5/7 · #6 3/6 · #7 0/5.** The plumbing for all seven exists; the **investor- and farmer-facing
> storytelling layers** are the consistent gap. Concretely missing, despite the feature being marked
> shipped:
> - **#2 buyer history** — the developer ledger never selects `buyer_id`; only aggregate sold totals.
>   This is the exact ERPA / institutional-buyer use case the feature was built for.
> - **#4 farmers participating + plantation hectares** — the MRV dashboard **never reads**
>   `farm_parcels`/`farmer_deliveries`, even though migration #25 created them. Also no
>   avoided-vs-removed CO₂ split, and no "biomass collected" metric. The stated "biggest
>   differentiator" is the least complete feature.
> - **#5 offtake agreements** — zero functional code repo-wide. Every IRR in the Investor Portal
>   therefore rests on an *assumed* credit price, not contracted revenue.
> - **#6 carbon participation + training** — a farmer sees sacks and pesos, never how their feedstock
>   became a carbon credit. Plantation "monitoring" is a static register with no actual-vs-expected.
> - **#1 methodology is free text**, not an enum — Verra/Gold Standard/Puro/ISO are only placeholder
>   hint text, so nothing can filter or group by methodology. "Development status" is the validation
>   workflow status, not a project lifecycle stage. MRV reports aren't a registry document type.
> - **#3 black pellets** is not a first-class feedstock type (only `wood_pellets`).
>
> **Top 3 gaps need no migration** (MRV farmer join · ledger buyer history · black pellets). Full
> ranked close-out list is in the audit doc.
>
> 🤖 **2026-07-09 — EXPANSION FEATURE #7: INTERFACE ONLY (AI Project Assistant).** A discoverable
> [`/assistant`](../src/views/AiAssistantView.vue) preview so users can see the assistant is coming:
> chat surface, role-aware example questions, and a "what it will do" panel. **The backend does not
> exist** — the composer is disabled, nothing is sent anywhere, and no answers are generated. Linked
> in the profile dropdown under **Insights**, ungated (the Pro-gate decision waits for the backend).
> No migration, no new dependency. Build ✅ · ESLint 0 ✅ · **207 tests ✅**.
> **⬜ To finish #7:** a Supabase edge fn → Claude API with tool access to the project/credit/MRV
> tables. That needs an API key + running cost, and should stay RLS-scoped to the caller.
>
> 🧭 **2026-07-09 — EXPANSION FEATURE #6 SHIPPED (Farmer Portal).** The last big code lift of the
> expansion series. Introduces the **`farmer` role** and the smallholder supply side of the biomass
> chain: [`/farmer`](../src/views/FarmerPortalView.vue) — a plantation **parcel register** (crop,
> area, GPS, expected yield) and **delivery logging** against an *accepted* biomass RFQ, with proof
> uploads, buyer confirmation, and **payment tracking**. The buyer half is a new **Deliveries tab**
> on [`/biomass/rfqs`](../src/views/BiomassRfqsView.vue) (confirm receipt → mark paid). New pure
> [`farmerService`](../src/services/farmerService.js) (23 unit tests). Migration **#25** adds
> `farm_parcels` + `farmer_deliveries` + 3 SECURITY DEFINER RPCs, and widens the two role gates.
> Build ✅ · ESLint 0 ✅ · **207 tests ✅**.
>
> **Two deliberate design calls, both worth knowing:**
> 1. **Farmer payments are record-keeping, not settlement.** `payment_status` is a bookkeeping flag;
>    it never touches `ledger_entries`/`escrow_holds`/`payout_requests`. The proven money path
>    (`reconcile_financials()` = 0) is untouched by this feature.
> 2. **Farmers bypass the KYB gate on `/biomass/sell`.** KYB gates *payouts* (real money leaving the
>    platform); no platform money moves for feedstock, and farmers are admin-approved via the role
>    application. Requiring a business registration from a smallholder was friction with no safety
>    payoff. KYB is unchanged everywhere else.
>
> **Migration #25 APPLIED (2026-07-09).** **⬜ To finish:** a runtime click-through — admin approves a
> `farmer` role application (or sets the role in User Management) → farmer registers a parcel →
> lists feedstock → a buyer requests + accepts a quote → farmer logs a delivery → buyer confirms +
> marks paid.
> **Remaining expansion work: #7 (AI Assistant) only.** Earlier #1–#5 notes follow.
>
> 🧭 **2026-07-08 — EXPANSION FEATURE #5 SHIPPED (Investor Portal).** A Pro-gated
> [`/investor`](../src/views/InvestorPortalView.vue) portal for `buyer_investor` accounts: the
> cross-developer **pipeline** of validated projects, projected gross value, **funding gap**, a
> by-category value chart, and a per-project **financial model — IRR / NPV / payback** — from a
> fresh pure [`investorAnalytics`](../src/services/investorAnalytics.js) module (11 unit tests; no
> financial helper existed before). New `FEATURES.INVESTOR_PORTAL` gates it (Pro/Business). Migration
> **#24** persists `capex`/`opex`/`project_lifetime_years`/`funding_target`/`funding_raised` — the
> submit form collected CAPEX/OPEX but silently dropped them; now there's a "Financials (Optional)"
> subsection and they persist. Financials degrade gracefully to “—” when a project hasn't provided
> them. Build ✅ · ESLint 0 ✅ · **184 tests ✅**. **⬜ To finish:** apply migration #24, then a
> developer fills a project's Financials → the portal shows its IRR/NPV. **Remaining expansion work:
> #6 (Farmer Portal, needs role migration) · #7 (AI Assistant).** Earlier #1–#4 notes follow.
>
> 🧭 **2026-07-08 — EXPANSION FEATURE #4 SHIPPED (MRV roll-up Dashboard).** A developer-facing
> MRV dashboard at [`/developer/mrv-dashboard`](../src/views/MrvDashboardView.vue): verified /
> proposed / pending **tCO₂e** cards, a monthly **proposed-vs-verified trend** line chart, per-metric
> **measured-activity** sums (biomass, energy, hectares…), and a **per-project reporting-compliance**
> table (overdue / due-soon / on-track vs the admin cadence). Pure [`aggregateMrvDashboard`](../src/services/mrvDashboardService.js)
> over `monitoring_reports` / `verified_emission_reductions` / `monitoring_activity_data` (drift-safe),
> reusing the existing PortfolioChart/CategoryChart (no Chart.js re-registration). **No migration
> needed.** 6 unit tests. Build ✅ · ESLint 0 ✅ · **173 tests ✅**. Satellite/IoT feeds deferred
> (external). **Remaining expansion work: #6 (Farmer Portal, needs role migration) · #5 (Investor
> Portal) · #7 (AI Assistant).** Earlier #1–#3 notes follow.
>
> 🧭 **2026-07-08 — EXPANSION FEATURE #3 SHIPPED (Biomass Marketplace / feedstock RFQ).** A full
> feedstock marketplace: suppliers list biomass products, buyers submit a request-for-quotation,
> suppliers quote, buyers accept/decline. New migration **#22** (`biomass_products` + `biomass_rfqs`
> + 3 SECURITY DEFINER RPCs, RLS, no new role — listing is **KYB-gated**), [`biomassService`](../src/services/biomassService.js)
> (11 unit tests), and three views: public browse [`/biomass`](../src/views/BiomassMarketplaceView.vue),
> KYB-gated [`/biomass/sell`](../src/views/BiomassSellView.vue), and [`/biomass/rfqs`](../src/views/BiomassRfqsView.vue)
> (buyer + supplier tabs). Notifications wired on submit/quote/response. Build ✅ · ESLint 0 ✅ ·
> **167 tests ✅**. **⬜ To finish:** apply migration **#22** (§0), then a runtime click-through
> (list feedstock → request a quote as a second user → quote → accept). **Next up: #6 (Farmer
> Portal) or #4 (MRV dashboard).** Earlier #1/#2 notes follow.
>
> 🧭 **2026-07-08 — EXPANSION FEATURES #1 + #2 SHIPPED.** Two of the seven proposed PH-market
> expansion features are **code-complete** (🆕, runtime-unverified). **#2 — Carbon Asset
> Management:** a developer asset-ledger at [`/developer/ledger`](../src/views/CarbonAssetLedgerView.vue)
> that rolls up estimated/issued/pending/sold/retired/inventory (+ inventory & sold value) per
> project via the pure, drift-safe [`aggregateAssetLedger`](../src/services/assetLedgerService.js)
> (6 unit tests) — **no migration needed**. Linked in the developer top-nav + profile menu
> ("Carbon Assets"). Build ✅ · ESLint 0 ✅ · **156 tests ✅**. **Next up: #3 — Biomass Marketplace
> (feedstock RFQ).** The earlier #1 note follows.
>
> 🧭 **2026-07-08 — EXPANSION FEATURE #1 SHIPPED (Project Registry fields).** First of the
> seven proposed PH-market expansion features is **code-complete** (🆕, runtime-unverified).
> Added investor-facing registry fields to the project page: **feedstock**, **capacity**
> (+unit), and wired **methodology** into the submit form (the column existed since
> `20260607000400` but was never captured — only settable on edit). End-to-end across 5 files:
> new migration `20260707000200_project_registry_fields.sql` (+ `feedstock` / `capacity` /
> `capacity_unit` on `projects`), [ProjectForm.vue](../src/components/ProjectForm.vue) new
> "Registry Details" subsection, both insert whitelists + drift-guards
> ([projectService.js](../src/services/projectService.js),
> [projectWorkflowService.js](../src/services/projectWorkflowService.js)), and Feedstock/Capacity
> rows on [ProjectDetailView.vue](../src/views/ProjectDetailView.vue). Build ✅ · ESLint 0 ✅ ·
> **150 tests ✅**. **Migration #21 APPLIED (2026-07-08)** — the form now persists
> `feedstock`/`capacity`/`capacity_unit`/`methodology`. **⬜ To finish:** a runtime click-through
> (submit a project with the new fields → confirm they render on the detail page).
> **In progress:** expansion feature **#2 — Carbon Asset Management**
> (developer asset-ledger view). See §3 "Proposed expansion features" for the full status table.

> 📧 **2026-07-07 (latest) — SIGNUP EMAIL BLOCKER (config, not code).** Account creation
> was returning `500: Error sending confirmation email`. Auth logs showed
> `550 "yourdomain.com domain is not verified"` — the Supabase custom SMTP (Resend) still
> had the **placeholder `…@yourdomain.com` sender**, so every confirmation email was rejected.
> **Temp fix (DONE):** "Confirm email" is now turned **OFF** in Supabase Auth — signups work
> again for testing (must be re-enabled before real users). **Permanent fix (P0 before launch):**
> register an owned domain → verify it in Resend → set the Supabase SMTP sender + creds →
> re-enable confirmation. Full steps in [TODAY_2026-07-07.md](TODAY_2026-07-07.md) §1c. No repo
> change — signup code is a standard `supabase.auth.signUp()`.
>
> ⬜ **Next: apply the 4 pending DB migrations (§0 #17–20).** Paste-ready consolidated SQL for all
> four (profiles role/KYC lock, retire-identity, project-documents bucket + private) has been
> prepared for the Supabase SQL Editor. **Still pending apply + verify** — until then the
> privilege-escalation hole is open and developer compliance-doc uploads have no bucket.

> 🚀 **2026-07-07 (earlier) — MERGED TO `main` + DEAD-CODE CLEANUP.** The full
> `feature-user-onboarding-ux` branch (Phases 0–8, the proven money cutover, security
> close-out, role-interface hardening, freemium analytics) was **merged into `main`**
> via **PR #2** (merge `d3ee30d`) — `main` is no longer stale. Then a **dead-code sweep**
> removed **23 verified-unimported files** (the entire `src/_hidden/` tree, the three
> unused `MarketplaceView*.vue` variants — only `MarketplaceViewEnhanced.vue` is routed —
> and `Header_backup.vue`) plus the stale `MarketplaceView.vue` entry in `vite.config`
> `manualChunks`; merged via **PR #3** (merge `fb14e42`). Debug utils
> (`debugAdminQueries`/`diagnoseAdminDashboard`/`verifyTestAccounts`) were **kept** — they
> are still imported by `AdminDashboard.vue`/dev components. Build ✅ ESLint 0 ✅ **150 tests ✅**.
> **No code/migrations were changed by the merge** — the 4 pending DB migrations below
> (🔴 profiles role/KYC lock + project-documents bucket) are **still unapplied** and remain
> the gate for real usage. Console-log emojis were intentionally left (dev-facing only).

> 🖤 **2026-07-07 (earlier) — FREEMIUM ANALYTICS + UI POLISH.** (1) **Analytics is now on
> for every role** (profile menu → Insights → Analytics) with a **freemium split**: free
> users get the summary metric cards; **Pro** unlocks the trend charts, category breakdown,
> full history, and the Selling tab. (2) **Fixed the analytics crash** — Chart.js v4
> needed the controllers registered (`LineController`/`DoughnutController`); this also fixed
> `/market` and the LGU ESG chart. (3) **Replaced all rendered emojis with monochrome
> Material Symbols icons** across the UI (dev console logs + dead `_hidden/` views left as
> is). Build ✅ ESLint ✅ 150 tests ✅. See [ANALYTICS.md](ANALYTICS.md).

> 📊 **2026-07-07 (later) — LIVE STATS + ANALYTICS.** The homepage hero stats were
> **hardcoded placeholders** (2.3M / 150+ / 45 / 5.2M) — now wired to **real data** via
> `public_market_stats()` (Retired / Active Projects / Credits Available / CO2 Reduced;
> show `—` until loaded). The prebuilt **Analytics dashboard was disabled** (route
> redirected to `/`) — now **re-enabled at `/analytics`** (Buying tab free; Selling tab
> Pro-gated) and linked in the profile menu. Document storage was also hardened to a
> **private bucket + signed URLs** (migration `20260707000100`). Full analytics map +
> tooling guidance: **[ANALYTICS.md](ANALYTICS.md)**. Build ✅ ESLint ✅ 150 tests ✅.

> 🎨 **2026-07-07 — ROLE-INTERFACE HARDENING (this session).** Audited + fixed the
> **Project Developer, Verifier, and LGU** interfaces so we can onboard real project
> developers. **Critical fix:** compliance documents now actually upload to storage (they
> were never saved before — links were dead). Also: enforced required docs on submit,
> fixed verifier status badges + silent price-save failure, developer Contact Support +
> Seller Earnings error state, LGU diverted-tonnage clamp, brand-green unification,
> role-aware landing, rubric-gated Validate, MRV reject confirm, and developer/LGU empty +
> error states. Build ✅ ESLint ✅ **150 tests ✅**. **One new migration to apply:**
> `20260707000000_project_documents_bucket.sql` (creates the `project-documents` bucket).
> 👉 **Full changelog + today's test plan: [TODAY_2026-07-07.md](TODAY_2026-07-07.md).**
> LGU self-application was intentionally deferred (LGU stays admin-provisioned).

> 🔒 **2026-07-04 — SECURITY CLOSE-OUT + INTEGRITY HARDENING (this session).**
> The P0 security items are now **applied + tested on the live project**: profiles
> role/KYC lock (`20260703000300`), retire identity (`…000400`), self-purchase
> guard (`…000500`), widened reconcile (`…000600`), **rate limiting**
> (`20260704000000` + checkout redeploy), JWT-only checkout identity, closed email
> relay + **SMTP/email confirmation live**, and legacy/demo code removed. New
> capabilities shipped + verified: **Sentry error tracking** (live), **external PSP
> settlement reconciliation** (`paymongo-reconcile` — already caught 6 orphaned
> paid intents in sandbox). **Two features are pushed but await tomorrow's
> deploy/test:** (A) **`paymongo-resettle`** (heals orphaned paid intents) and
> (B) **velocity caps by KYC tier** (`20260704000200` + checkout redeploy).
> 👉 **The step-by-step test plan for tomorrow is
> [SECURITY_CLOSEOUT_CHECKLIST.md](SECURITY_CLOSEOUT_CHECKLIST.md) §3.**
> Only P0 item left before LIVE keys: an **independent penetration test**.

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

> 🔐 **2026-07-03 — SECURITY REVIEW DONE; NOT YET CLEARED FOR LIVE PAYMENT KEYS.**
> Two adversarial reviews (payment path + auth/RLS/secrets) ran before real-user
> deployment. Frontend hardening is **applied** (security headers, `v-html` XSS
> escape, prod-log stripping, no client secret key). Higher-severity fixes are
> **written and queued** — chiefly a **Critical** `profiles` privilege-escalation
> lock (migration `20260703000300`), retirement identity (`20260703000400`), an
> **open email relay** (`send-approval-email`), and **JWT-enforced checkout
> identity**. **Full findings, exact fixes, and the go/no-go checklist:**
> [dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md). **What to do now, by
> priority:** [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md). Run in **sandbox mode only**
> until the 🔴/🟠 items + an independent penetration test are done.

> 📚 **New docs this session:** product overview [ABOUT_CARBONIFY.md](ABOUT_CARBONIFY.md);
> per-role user guides [user-guide/](user-guide/README.md); developer docs
> [dev/](dev/README.md); rebuild/finish prompt [CARBONIFY_BUILD_PROMPT.md](CARBONIFY_BUILD_PROMPT.md);
> deployment readiness [dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md);
> go-live roadmap [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md). Also removed a dead
> `/register/lgu` link + unwired listing methods.

</details>

---

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

> 🆕 **2026-07-03 migrations.** The cutover fixes (13–16) were **applied + verified live** this
> session. The security fixes (17–18) are **NEW and NOT yet applied** — apply them and re-test
> before real users (see [dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md)).
> | # | Migration | Status | Purpose |
> |---|---|---|---|
> | 13 | `20260703000000_update_wallet_balance_atomic.sql` | ✅ applied | Wallet top-up settlement fn (was defined in no migration). |
> | 14 | `20260703000100_wallet_transactions_external_reference.sql` | ✅ applied | Adds the missing top-up audit column + index. |
> | 15 | `20260703000200_fix_credit_ownership_quantity_constraint.sql` | ✅ applied | Drops stray `> 0` constraint (blocked retirement); asserts `>= 0`. |
> | 16 | `20260702000000_fix_marketplace_ownership_status.sql` | ✅ applied | `credit_ownership.status = 'owned'` (was `'active'`, rejected by constraint). |
> | 17 | `20260703000300_harden_profiles_role_kyc.sql` | ✅ **applied (2026-07-04)** | 🔴 Blocks direct client writes to `profiles.role`/`kyc_level` (privilege escalation). Admin RPCs still work. **Verify a normal user can't self-promote.** |
> | 18 | `20260703000400_retire_credits_authuid.sql` | ✅ **applied (2026-07-04)** | Binds retirement identity to `auth.uid()`. **Retest flow E → reconcile 0.** |

> 🆕 **2026-07-07 migration** (apply via SQL Editor; idempotent). See
> [TODAY_2026-07-07.md](TODAY_2026-07-07.md).
> | # | Migration | Status | Purpose |
> |---|---|---|---|
> | 19 | `20260707000000_project_documents_bucket.sql` | ✅ **applied (2026-07-09)** | 🔴 Creates the `project-documents` storage bucket + RLS so developer compliance PDFs actually upload and are retrievable (were never stored before — dead links). Also backs farmer delivery-proof uploads (#25). |
> | 20 | `20260707000100_project_documents_private.sql` | ✅ **applied (2026-07-09)** | Makes that bucket **private** (compliance PDFs = sensitive PII) + authenticated SELECT for signed URLs. App resolves short-lived signed URLs; anon can no longer open raw docs. |

> 🆕 **2026-07-08 migration** (apply via SQL Editor; idempotent, additive, drift-safe).
> | # | Migration | Status | Purpose |
> |---|---|---|---|
> | 21 | `20260707000200_project_registry_fields.sql` | ✅ **applied (2026-07-08)** | Adds `feedstock`, `capacity`, `capacity_unit` to `projects` (+ non-negative `capacity` check) for the investor-facing Project Registry. Applied live; the form now persists these + `methodology`. ⬜ Remaining: a runtime click-through (submit a project with the new fields → confirm they render on the detail page). |
> | 22 | `20260708000000_biomass_marketplace.sql` | ✅ **applied (2026-07-08)** | Expansion #3. Creates `biomass_products` (supplier feedstock catalog) + `biomass_rfqs` (buyer request + folded quote) with RLS (public browse of active products; owner writes; buyer-or-seller-or-admin reads RFQs) and 3 SECURITY DEFINER RPCs for status transitions (`submit_biomass_quote` / `respond_biomass_quote` / `close_biomass_rfq`). Applied live. ⬜ Remaining: runtime click-through (list feedstock KYB-gated → request a quote as another user → quote → accept). |
> | 24 | `20260710000000_project_financials.sql` | ✅ **applied (2026-07-09)** | Expansion #5. Adds `capex`, `opex`, `project_lifetime_years`, `funding_target`, `funding_raised` to `projects` (non-negative checks) so the Investor Portal can model IRR/NPV/payback + funding gap. The submit form now captures them (new "Financials" subsection). ⬜ Remaining: a developer edits a project → fills Financials → the Investor Portal shows IRR/NPV. |
> | 31 | `20260717000000_farmer_carbon_participation.sql` | ✅ **applied (2026-07-09)** | Expansion #6's carbon bullet. Adds `farmer_deliveries.project_id` (the link whose absence made attribution impossible), re-creates `confirm_farmer_delivery()` with a 4th `p_project_id` param **validating the buyer owns that project**, and adds `farmer_carbon_participation()` (SECURITY DEFINER, so a farmer never needs read access to `verified_emission_reductions` or to other farmers' deliveries). Rule: `verified × farmer_tonnes / project_tonnes` over confirmed deliveries + approved VERs — see [FARMER_CARBON_ATTRIBUTION.md](FARMER_CARBON_ATTRIBUTION.md). **Apply, then a buyer confirms a delivery naming a project → the farmer's Carbon tab shows their attributed tCO₂e.** |
> | 30 | `20260716000000_data_room_access_log.sql` | ✅ **applied (2026-07-09)** | Expansion #5's last bullet. Creates `data_room_access_log` (project, developer, viewer, document, action) with **no INSERT/UPDATE/DELETE policy** — writes go only through `log_data_room_access()`, a SECURITY DEFINER RPC deriving viewer from `auth.uid()` and developer from `projects.user_id`, so neither identity can be forged and a log row can't be erased by the person it incriminates. Reads are limited to the two parties + admin (one investor must not see which rivals are doing diligence). Self-views and non-validated projects are skipped. **Apply, then an investor opens a document in `/investor` → the developer sees it at `/developer/data-room`.** |
> | 29 | `20260715000000_ver_reduction_type.sql` | ✅ **applied (2026-07-09)** | Adds `verified_emission_reductions.reduction_type` (`removal` / `avoidance`, **nullable**, CHECK-constrained + partial index on approved rows). Closes #4's CO₂-avoided-vs-removed bullet. **Deliberately not backfilled** — a legacy VER was approved without anyone asserting a type, and guessing from the project category would fake a verifier's assertion on an issued credit. The MRV dashboard shows an explicit **Unclassified** bucket instead. **Apply, then approve an MRV report → pick Removal/Avoidance → the dashboard splits it.** |
> | 28 | `20260714000000_project_development_status.sql` | ✅ **applied (2026-07-09)** | Adds `projects.development_status` (concept / feasibility / financing / construction / operational / decommissioned, nullable, CHECK-constrained + partial index) — the **real-world lifecycle**, distinct from `projects.status` (the Carbonify validation workflow). Closes #1's "development status" bullet. `methodology` intentionally stays free TEXT (the UI drives it from a canonical list; a CHECK would reject legacy rows like "Verra VM0044" on any later UPDATE). **Apply, then Submit/Edit Project offers a Development Status dropdown and the Investor Portal gains a stage filter.** |
> | 27 | `20260713000000_offtake_agreements.sql` | ✅ **applied (2026-07-09)** | Expansion #5's missing bullet. Creates `offtake_agreements` (project, counterparty, volume, price, term, status) — **owner-only RLS**, since counterparty + price are commercially sensitive — plus `offtake_summary(uuid[])`, a SECURITY DEFINER RPC returning only contracted volume/value/count per validated project (never a counterparty or price) so investors can see contracted share without seeing terms. Insert is doubly guarded: `developer_id = auth.uid()` **and** the caller owns the project. **Apply, then a developer records a signed agreement → the Investor Portal shows contracted % + downside IRR.** |
> | 26 | `20260712000000_parcel_supply_visibility.sql` | ✅ **applied (2026-07-09)** | Unblocks **plantation hectares** on the MRV dashboard. #25 made `farm_parcels` owner-private, so a developer couldn't read the area of parcels supplying them. Adds a narrow SELECT policy: a buyer may read a parcel **only** where it supplied them a delivery with `status='confirmed'` (a pending/rejected delivery grants nothing, so a farmer can't be exposed by merely logging one). Owner INSERT/UPDATE/DELETE from #25 untouched. Plus a `(parcel_id, buyer_id, status)` index. **Apply, then the MRV dashboard's “Plantation hectares” stops showing “—”.** |
> | 25 | `20260711000000_farmer_portal.sql` | ✅ **applied (2026-07-09)** | Expansion #6. Adds `farm_parcels` (plantation register, owner-private RLS) + `farmer_deliveries` (delivery against an accepted RFQ, with proof docs, buyer confirmation, and a bookkeeping `payment_status`) + 3 SECURITY DEFINER RPCs (`record_farmer_delivery` / `confirm_farmer_delivery` / `mark_farmer_delivery_paid` — no INSERT/UPDATE policy, so a farmer can't mark their own delivery paid). Also **widens the two role gates**: `assign_user_role()` now admits `'farmer'`, `role_applications.role_requested` CHECK now admits `'farmer'`, and `notify_role_application_trigger()` routes farmer applications to admins. **Apply, then run the click-through in the header note.** |
> | 23 | `20260709000000_admin_set_kyb_verified.sql` | ✅ **applied (2026-07-08)** | Adds `admin_set_kyb_verified(uuid, boolean)` (is_admin-gated) so an admin can manually verify a business from **User Management** — clears the "Business verification required" gate for a developer who never filed a KYB application (previously only `review_kyb_application` could set `kyb_verified`, and only against an existing application). Also revokes client `update(kyb_verified)` so users can't self-verify. **Apply, then: Admin → User Management → edit a user → tick "Business verified (KYB)" → Save → that account's Sell-Feedstock gate disappears.** |

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
| **LGU self-application flow** (LGU can't self-request the role; admin-provisioned for now) | 5 | codeable — needs role-application service + admin-approval + DB constraint changes. See [TODAY_2026-07-07.md](TODAY_2026-07-07.md) §4 |
| **Full accessibility pass** (`for`/`id` on all MRV/assessment/LGU form fields) | 7 | codeable now — partial done 2026-07-07 |

> ✅ **2026-07-01 — DONE this session (built + runtime-verified):** seller per-project earnings ·
> purchases pagination · structured additionality/permanence · saved-search/price alerts · admin
> KYB-review console · refunds/disputes console · seller KYB submission form · admin KYC-level
> override + level list. Migrations `20260701000000–000300` applied. All the codeable-backlog +
> "built-but-not-clickable" gaps are closed.

---

### 🧭 Proposed expansion features (scoped 2026-07-07) — implemented vs not

Seven product-expansion features were proposed (national biomass registry / MRV / investor
data-room positioning for the PH market). This is their **real status** against the current
codebase — roughly ~60% is already built as extensions of existing modules, not greenfield.

> ⚠️ **The "code-complete" labels below are FEATURE-level, and they hide missing sub-items.**
> For the honest bullet-by-bullet picture — including the buyer history, offtake agreements, farmer
> carbon participation, and MRV farmer/hectare metrics that are **not built** despite their features
> being marked shipped — read **[EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md)**. Where the
> two disagree, the audit is right: it was checked against the code.

| # | Feature | Status | What exists today | Gap to build |
|---|---|---|---|---|
| 1 | **Project Registry page** | 🆕 **code-complete (2026-07-08)** — migration #21 pending apply + runtime check | [ProjectDetailView.vue](../src/views/ProjectDetailView.vue) + `projects` table carry **GPS** (`geo_coordinates` + `boundary` GeoJSON, drawn on the map), **methodology** (now captured on the submit form), **feedstock**, **capacity** (+unit), **development status** (`projects.status`), **expected reductions** (`estimated_credits`), **documents** (real [`project-documents` bucket](../supabase/migrations/20260707000000_project_documents_bucket.sql): PDD/feasibility/MRV), co-benefits, additionality/permanence; **project developer** shown via the Developer profile card | ✅ shipped: `feedstock`/`capacity`/`capacity_unit` cols ([mig #21](../supabase/migrations/20260707000200_project_registry_fields.sql)) + form subsection + detail rows. **⚠️ Weaker than claimed (5/8 bullets):** methodology is a **free-text input, not an enum** — Verra/Gold Standard/Puro/ISO are only placeholder hint text, so nothing can filter or group by it; **"development status" is the validation-workflow status**, not a project lifecycle stage (no such column); **MRV reports are not a registry document type**. **Remaining:** methodology enum, lifecycle field, MRV docs, runtime-verify |
| 2 | **Carbon Asset Management** | 🆕 **code-complete (2026-07-08)** — no migration needed; runtime-unverified | Credit **serials**, issued/pending **pool**, **sold** (`credit_transactions`), **retired** (atomic multi-row), **buyer history**, **inventory** (`credit_ownership`), [CreditPortfolioView](../src/views/CreditPortfolioView.vue), [SellerEarningsView](../src/views/SellerEarningsView.vue) | ✅ shipped: developer **asset-ledger view** [`/developer/ledger`](../src/views/CarbonAssetLedgerView.vue) rolling up estimated/issued/pending/sold/retired/inventory (+value) per project via pure [`aggregateAssetLedger`](../src/services/assetLedgerService.js) over `projects`/`project_credits`/`credit_transactions`/`verified_emission_reductions`/`credit_retirements` (MRV tables drift-safe). 6 unit tests. **⚠️ Missing vs spec: BUYER HISTORY** — the sales query never selects `buyer_id`, so a developer sees aggregate sold totals but not *who* bought. That was the stated ERPA/institutional-buyer rationale. **Remaining:** buyer history (no migration needed) + runtime click-through |
| 3 | **Biomass Marketplace** (feedstock RFQ) | 🆕 **code-complete (2026-07-08)** — migration #22 pending apply; runtime-unverified | Marketplace was **credits only**; `supplier_orders` is external-registry fulfillment, not feedstock | ✅ shipped: [mig #22](../supabase/migrations/20260708000000_biomass_marketplace.sql) (`biomass_products` + `biomass_rfqs` + 3 RPCs), [`biomassService`](../src/services/biomassService.js), public browse [`/biomass`](../src/views/BiomassMarketplaceView.vue) + RFQ modal, KYB-gated [`/biomass/sell`](../src/views/BiomassSellView.vue), [`/biomass/rfqs`](../src/views/BiomassRfqsView.vue) buyer+supplier tabs. 11 unit tests, notifications wired. **⚠️ `black_pellets` is not a first-class feedstock type** (only `wood_pellets`); it can only be entered as free-text "Other biomass", so it can't be browsed or filtered — a named RRCC product. One-line fix. **Remaining:** black pellets + runtime click-through |
| 4 | **MRV Dashboard** | 🆕 **roll-up shipped (2026-07-08)** — no migration; runtime-unverified. Satellite/IoT still external (deferred) | [MRV module](../supabase/migrations/20260604010000_create_mrv_module.sql) + [MonitoringReportView](../src/views/MonitoringReportView.vue) + [mrv.js](../src/constants/mrv.js) capture biomass, energy, CO₂ avoided/removed, hectares, methodology factors | ✅ shipped: developer **roll-up dashboard** [`/developer/mrv-dashboard`](../src/views/MrvDashboardView.vue) — verified/proposed/pending tCO₂e, monthly proposed-vs-verified trend, per-metric activity sums, per-project reporting-compliance vs cadence — via pure [`aggregateMrvDashboard`](../src/services/mrvDashboardService.js) over `monitoring_reports`/`verified_emission_reductions`/`monitoring_activity_data` (drift-safe), reusing PortfolioChart/CategoryChart. 6 unit tests. **⚠️ Weakest feature vs spec (0/8 bullets fully).** Missing: **biomass collected** (no such metric key), **farmers participating** + **plantation hectares** (the dashboard never reads `farm_parcels`/`farmer_deliveries` — they exist since mig #25 and are a join away, no migration), and **CO₂ avoided vs removed is never split** (only a combined tCO₂e). Energy generated appears only if a report happens to carry `energy_kwh`. **Deferred:** satellite + IoT feeds (external API + cost) |
| 5 | **Investor Portal** | 🆕 **code-complete (2026-07-08)** — migration #24 pending apply; runtime-unverified | `buyer_investor` role + document/data-room foundation + [FeatureGate](../src/components/ui/FeatureGate.vue) plan gating existed | ✅ shipped: Pro-gated [`/investor`](../src/views/InvestorPortalView.vue) — cross-developer **pipeline** of validated projects, projected value, **funding gap**, and a per-project **financial model (IRR/NPV/payback)** via fresh pure [`investorAnalytics`](../src/services/investorAnalytics.js) (11 tests). New `FEATURES.INVESTOR_PORTAL` (Pro/Business). [mig #24](../supabase/migrations/20260710000000_project_financials.sql) persists `capex`/`opex`/`project_lifetime_years`/`funding_target`/`funding_raised` (the form collected CAPEX/OPEX but dropped them — now wired into a new "Financials" form subsection). **⚠️ Missing vs spec: OFFTAKE AGREEMENTS** — zero functional code repo-wide (no table, field, or UI), so every IRR rests on an *assumed* credit price rather than contracted revenue. The "data room" is a document **count badge + link-out** to the project page, not an in-portal viewer. **Remaining:** offtake/ERPA model, a real data room, developers enter financials, runtime-verify |
| 6 | **Farmer Portal** | 🆕 **code-complete (2026-07-09)** — migration #25 pending apply; runtime-unverified | No `farmer` role existed; `profiles.role` has **no CHECK constraint** — the real gates were `assign_user_role()`'s allow-list and `role_applications.role_requested`'s CHECK | ✅ shipped: `farmer` role end-to-end (constants, `roleService` permissions map, `userStore.isFarmer`, `createFarmerGuard`, `/farmer` landing, applyable at `/apply`, assignable in User Management); [mig #25](../supabase/migrations/20260711000000_farmer_portal.sql) (`farm_parcels` + `farmer_deliveries` + 3 RPCs); [`farmerService`](../src/services/farmerService.js) (23 tests); [`/farmer`](../src/views/FarmerPortalView.vue) parcel register + delivery logging with proof upload; buyer **Deliveries tab** on [`/biomass/rfqs`](../src/views/BiomassRfqsView.vue) (confirm → mark paid). Farmers bypass the KYB listing gate. **⚠️ Missing vs spec (3/6 bullets): CARBON PARTICIPATION** (a farmer sees sacks and pesos — `farmer_deliveries` has no link to credit issuance, and the word tCO₂e appears nowhere in the portal) and **TRAINING** (no module at all). **Plantation "monitoring" is a static register** — expected yield is stored but never reconciled against actual delivered quantity, despite deliveries carrying `parcel_id`. **Remaining:** carbon participation, actual-vs-expected yield, training, runtime click-through |
| 7 | **AI Project Assistant** | 🟡 **interface only (2026-07-09)** — no backend, no LLM dep | No LLM integration (no `anthropic`/`openai` dep) | ✅ shipped: discoverable [`/assistant`](../src/views/AiAssistantView.vue) preview — chat surface, role-aware example questions, planned-capability panel. **Composer is disabled and nothing is sent anywhere; no answers are generated.** Linked in the profile dropdown under Insights, ungated. **Remaining:** the actual Supabase edge fn → Claude API with tool access to project/credit/MRV tables (external API cost); decide then whether to Pro-gate it via `FEATURES.AI_ASSISTANT` |

> **All seven features have shipped code, but none is 100% against its spec bullets.** The next pass
> is *depth, not breadth* — see [EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md) for the
> ranked close-out list. The top three need **no migration**:
> 1. **MRV: farmers participating + plantation hectares** — join `farm_parcels`/`farmer_deliveries`
>    into `aggregateMrvDashboard`. Turns the "biggest differentiator" into one.
> 2. **Asset ledger: buyer history** — select `buyer_id`, join `profiles`. Serves the ERPA use case.
> 3. **Black pellets** in the feedstock dropdown — one line.
>
> Then: farmer carbon participation → methodology enum + lifecycle status → **offtake/ERPA model**
> (largest new build; converts projected into contracted revenue) → CO₂ avoided/removed split →
> **#7 AI backend** (Claude API edge fn, external cost) → satellite/IoT (deferred, external) →
> training content.

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

Feature work and the money cutover are **done**. The priority now is **security close-out
before real users**, then launch. The authoritative, prioritized plan is
**[GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md)** (implemented vs not, by priority, with a printable
go/no-go gate); the security detail is **[dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md)**.

### A. 🔴 P0 — security close-out (do before ANY real user pays)
1. Apply migration `20260703000300` (lock `profiles.role`/`kyc_level`) → verify a normal user
   can't self-promote to admin, and admin/verifier/KYC flows still work.
2. Apply `20260703000400` (retirement identity = `auth.uid()`) → retest flow E, reconcile = 0.
3. Redeploy `send-approval-email` with `verify_jwt=true` (close the open email relay).
4. Redeploy `paymongo-checkout` to require the verified JWT (stop trusting client `user_id`) →
   re-run the 6 money flows, reconcile = 0 each.
5. Enable email confirmation + custom SMTP; confirm `ALLOW_UNSIGNED_WEBHOOKS` unset + secrets set.
6. Remove the legacy/demo code paths (raw checkout branch, legacy webhook branches, `demo`
   purchase, dead wallet mutators) → re-run flows.
7. **Book an independent penetration test** before switching to live PayMongo keys.

### B. Capture the work — ✅ done
- **PR #2 is MERGED** (2026-07-07) — `feature-user-onboarding-ux` → `main` (merge `d3ee30d`),
  ~121 commits. `main` now carries the full app. A follow-up **PR #3** (merge `fb14e42`) removed
  23 dead files. `gh` is authenticated. The branch and `main` are in sync (0 unmerged commits).
  Note: merging code does **not** apply the pending DB migrations (§0 #17–20) — do those separately.

### C. Remaining work — external party or ops/legal (parallel track)
- **Real registry/supplier fulfillment** — needs an external registry partner (Carbonmark/Cloverly/Patch).
- **AML screening** — needs a sanctions/PEP data vendor.
- **Backups/PITR · connection pooling · observability (Sentry) · CSP · rate limiting** — ops/infra + keys.
- **Legal entity · licensed PSP/EMI · BIR registration · DPO/AMLA · accredited verifier (VVB)** — business/legal.
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
