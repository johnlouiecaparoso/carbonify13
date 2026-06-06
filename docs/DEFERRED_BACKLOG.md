# Deferred Backlog — revisit after the phased roadmap

Items intentionally deferred during the phased implementation (`IMPLEMENTATION_ROADMAP_TIMELINE.md`).
Each is safe to defer but should be closed out before "production-credible" sign-off.
Come back to this list after the phases are implemented.

---

## From Phase 0 (Stabilize & Clean Up)

### 1. Dual `available_credits` / `credits_available` on `project_credits` 🟠
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

## Carried into Phase 1
- **Consolidate the 3 payment services** (`paymentService`, `realPaymentService`, `paymongoService`)
  behind one interface — this is Phase 1's "provider abstraction" task, handled there rather than as Phase 0 cleanup.
