# Deferred Backlog — revisit after the phased roadmap

Items intentionally deferred during the phased implementation (`IMPLEMENTATION_ROADMAP_TIMELINE.md`).
Each is safe to defer but should be closed out before "production-credible" sign-off.
Come back to this list after the phases are implemented.

---

## From Phase 0 (Stabilize & Clean Up)

### 1. Dual `available_credits` / `credits_available` on `project_credits` ✅ RESOLVED (2026-07-11)
**Resolution:** Live schema confirmed both columns existed. `credits_available` (numeric) is
canonical — the money path decrements it; `available_credits` (integer) was a stale stray (observed
2000 where the true remaining was 1638), maintained by no trigger and read by no code once the dead
`assetLedgerService` fallback was removed. Code now writes/reads only `credits_available`
(projectWorkflowService, projectApprovalService, assetLedgerService, marketplaceService). The stray is
retired via expand/contract: migration `20260718000600` drops its NOT NULL (run before the frontend
deploy), `20260718000700` drops the column (run after). Original note kept below for history.


**What:** The `project_credits` table is referenced by two different column names:
- DB migrations + issuance triggers write **`available_credits`**
  (`20260604010100_decouple_issuance_mint_on_ver.sql`, `20260602001000_add_active_pool_on_validation.sql`).
- `src/services/marketplaceService.js` (and parts of `marketplaceIntegrationService.js`,
  `projectWorkflowService.js`) read/write **`credits_available`** on the same table.

(Note: `available_credits` on the separate `listings`/`credit_listings` table is correct — not part of this.)

**Why deferred:** Needs the **live `project_credits` schema** to fix safely (could be one column,
the other, or both with diverging data — likely, given manual-migration drift; see
`[[supabase-migration-process]]`).

**How to close:** Run in Supabase SQL Editor:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'project_credits'
order by ordinal_position;
```
Then pick **`available_credits`** as canonical (what the triggers maintain), backfill values if both
exist, point all code at it, and drop the stray column. Diagnostic helper: `supabase/diagnostics/phase0_schema_check.sql`.

### 2. Phase 0 acceptance gates not yet verified (need live env) 🔴
- **Test purchase** puts credits in the portfolio with **no console errors** (confirms the applied
  migrations: `credit_ownership.updated_at`, `wallet_accounts.wallet_address`, `certificate_data`,
  `credit_transactions`→`profiles` FKs).
- **Webhook deploys**: `supabase functions deploy paymongo-webhook` actually runs clean.

### 3. Remove the receipt/certificate FK **fallback crutch** 🟢
`receiptService.js` and `certificateService.js` still try the join then fall back to separate queries.
Now that the `credit_transactions`→`profiles` FKs exist, the fallback is dormant and can be removed.

### 4. VALIDATE the `NOT VALID` foreign keys 🟢
`credit_transactions_buyer_id_fkey` / `_seller_id_fkey` were added `NOT VALID` for safety. Once the
orphan check (in `20260606000100_*.sql`) confirms zero orphans, run `VALIDATE CONSTRAINT`.

### 5. Prettier formatting pass — blocked 🟢
`npm run format` (Prettier) **breaks the build**: it reformats multi-statement inline Vue handlers
(e.g. `@input="fn(); errors.x = ''"`) across lines and drops the `;`, which the Vue template parser
rejects. ESLint uses `skipFormatting`, so Prettier isn't enforced anyway. To enable Prettier safely,
first refactor those inline handlers into named methods, then add the format step.

### 6. Playwright **E2E green in CI** 🟢
`.github/workflows/ci.yml` runs E2E as a separate `continue-on-error` job. It needs a live backend
(Supabase + dev server + secrets) wired into CI before it can be made required.

### 7. Adopt CLI migration tracking 🟠
Migrations are applied by hand → live schema drifts from `supabase/migrations/`. Move to
`supabase db push` / `migration up` as the only way schema changes land. See `[[supabase-migration-process]]`.

---

## From Phase 1 (Money Foundation) — gated / follow-up

### P1. Financial-table RLS lockdown (cutover) 🔴
`supabase/cutover/lockdown_financial_writes.sql` makes `credit_transactions`,
`credit_ownership`, `wallet_accounts`, `wallet_transactions` **server-write-only**.
**Gated:** run ONLY after the marketplace/wallet UI is switched to the
server-authoritative flow (`createMarketplaceCheckout` → webhook →
`process_marketplace_purchase`) and no longer writes those tables from the
browser. Running early breaks live purchases.

### P2. Client cutover to server-authoritative purchase 🔴
Switch the marketplace "Buy" UI from the legacy client-amount checkout to
`createMarketplaceCheckout({ listingId, quantity })`, and remove client-side
inserts into `credit_transactions` / `credit_ownership` (the webhook RPC now owns
those). Precondition for P1.

### P3. Derive `payment_intents.user_id` from the verified JWT 🟠
The checkout Edge Function currently takes `user_id` from the request body; it
should come from the verified Supabase JWT. (The amount is already server-authoritative.)

### P4. External settlement reconciliation 🟠
`reconcile_financials()` reconciles the system against itself. Add a scheduled job
that pulls PayMongo's settlement/payout report and reconciles real money in/out
against the ledger. Needs the PayMongo API.

### P5. Wallet top-up via payment_intents 🟠
Wallet top-ups still use the legacy client-`data` checkout path. Migrate them to
record a `payment_intent` (purpose `wallet_topup`) for consistent reconciliation.

## Carried into Phase 1
- **Consolidate the 3 payment services** (`paymentService`, `realPaymentService`, `paymongoService`)
  behind one interface — this is Phase 1's "provider abstraction" task, handled there rather than as Phase 0 cleanup.

---

## From the 2026-07-09 whole-codebase audit ([CODE_AUDIT_2026-07-09.md](CODE_AUDIT_2026-07-09.md))

### 8. Delete 30 verified-dead files 🟢 (partially done 2026-07-11)
Zero imports, not routed, not test fixtures. Includes `services/authServiceSimple.js` — a **mock auth
service with a `demo@carbonify.io / demo123` login** sitting in the repo.

**Done 2026-07-11:** deleted zero-byte `services/adminService.js` + `services/verifierService.js`, and
removed the dead `addCreditsToPortfolio` / `removeCreditsFromPortfolio` writers from
`creditOwnershipService.js` (290 lines — non-atomic, client-userId money writes; a double-retire vector
if ever called). Remainder of the list still pending; mind the two traps below before deleting more.

**Two traps before deleting:**
- `components/search/AdvancedSearch.vue` is dead but **pinned by `vite.config.js` manualChunks** —
  remove that line in the same commit or the build breaks.
- `services/credits/`, `services/payments/`, `services/payouts/` are imported **only by unit tests**.
  They are the Phase 1–2 provider abstractions. Decide *abandoned vs pending wiring* before deleting;
  the live path is `realPaymentService`/`paymongoService`.

Also: `/mobile-test` is a **live route** in production routing. `vue-chartjs` is a dependency imported
nowhere.

### 9. Consolidate duplicated formatters 🟢
`peso()` × 11, `round2()` × 9, `shortDate()` × 8, `formatCurrency()` × 6. Two competing currency
conventions mean inconsistent formatting across the app. One `src/utils/format.js` fixes it.

### 10. Route hand-rolled modals through `AccessibleModal.vue` 🟠
26 raw `.modal-overlay` divs bypass the existing accessible modal (focus trap, Escape, `role="dialog"`).
Keyboard users cannot Escape a payment dialog.

### 11. Two tables back "transaction history" 🟠
`creditOwnershipService` reads `credit_purchases`; `transactionHistoryService` reads
`credit_transactions`. Same feature, different sources. `getUserTransactionHistory` also slices the
merged list to `limit`, so a heavy trader's **retirements disappear** from the combined view.

### 12. Grant hygiene on ~10 SECURITY DEFINER RPCs 🟠
They grant EXECUTE to `authenticated` without first revoking the Postgres default `PUBLIC` grant. Not
exploitable today (each self-gates on `is_admin()`/`auth.uid()`), but inconsistent with the financial
RPCs and one regression away from being a hole. One migration.

---

## From the 2026-07-11 senior review

### 13. Financial-table RLS posture is not in version control 🔴 (highest-leverage)
There is **no `create policy`** for `credit_ownership`, `wallet_accounts`, `wallet_transactions`, or
`credit_transactions` anywhere in `supabase/migrations/` — those tables predate version control and the
only write-lockdown lives in the **gated, out-of-band** `supabase/cutover/lockdown_financial_writes.sql`
(same as P1). Consequence: the repo **cannot prove** the money tables are server-write-only, and any fresh
environment (staging, DR, a new region, a fresh local stack) rebuilds with **client-writable** money
tables. This is what makes the deleted-but-callable client writers (#8) and P2 latent rather than closed.
**Close:** dump the live posture —
`select tablename, policyname, cmd, qual, with_check from pg_policies where tablename in ('credit_ownership','wallet_accounts','wallet_transactions','credit_transactions','credit_listings','project_credits','credit_retirements')` —
and codify it as a declarative migration (RLS enabled, read-own SELECT only, no client write policies,
service_role bypasses). Then the migration chain *is* the security posture, and the cutover script retires.

### 14. Escrow was silently reverted — sellers withdrawable with no hold window 🟠 (business + fraud)
`20260606000600_escrow_and_seller_balance.sql` routed seller net into `escrow_holds` + an `escrow_held`
ledger account, but **every later** `CREATE OR REPLACE process_marketplace_purchase` (`20260615000200`,
`20260702000000`, `20260703000500`) credits `seller_payable:<id>` **directly** and never inserts an
`escrow_holds` row. `grep escrow_holds` confirms no writer after `20260606000600`; the table + `release_escrow`
RPC are dead for card purchases. **Effect:** sellers are immediately withdrawable with **no dispute /
chargeback hold** — on the card rail this is a fraud path (list → self-buy with a stolen card → withdraw
before the chargeback lands, loss lands on the platform). **Decide before live keys:** instant-payout by
design (document it, drop the dead escrow table/RPC) **or** restore the hold window through settlement.

### 15. Root-cause cleanups behind the review symptoms 🟠
Recorded so they aren't re-discovered each audit:
- **Nullable async Supabase client** → the `const s = getSupabase(); if (!s) return` guard is copy-pasted
  ~233× across 49 files. Fix at the root: `await initSupabase()` before mount; make `getSupabase()`
  throw-or-return; delete the guards.
- **Schema-probing at runtime** (the 5-attempt insert loop / "retry without `updated_at`" fallbacks) exists
  because migrations aren't authoritative. Once #13 + CLI migration tracking (#7) land, run
  `supabase gen types` and delete the probes.
- **Fulfillment saga exists twice** (`services/credits/fulfillmentSaga.js` + a hand-ported copy inside
  `paymongo-webhook`) "kept in sync by hand." The webhook copy is the one that settles money — make it the
  only one and test it directly (Deno test).
- **Error handling is three systems, none on** — `errorStore` + `ErrorBoundary` are commented out in
  `App.vue`; services `console.error` + inconsistently swallow/throw; `main.js` monkeypatches `window.fetch`
  + `console.error` globally (which can eat unrelated errors). Pick one contract and turn the boundary on.
