# Security Close-out — My Side (done) → Your Side → Test Together

> **Updated:** 2026-07-04 · **Branch:** `feature-user-onboarding-ux`
> Companion to [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) and [dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md).
> This tracks the concrete pre-launch hardening pass. **My-side code work is complete, lint 0, 145 tests pass, build green.** The remaining boxes are dashboard/deploy actions only you can do, then a joint test pass.

---

## 1. ✅ Done on my side (code — committed to the branch)

| # | Item | Sev | What changed | File(s) |
|---|---|---|---|---|
| P2 | Checkout trusts only the verified JWT | 🟠 | All three checkout actions (marketplace / subscription / wallet top-up) now **reject** if there's no verified user token; `body.user_id` is never trusted | `supabase/functions/paymongo-checkout/index.ts` |
| — | Legacy raw-checkout path removed | 🟠 | The old default branch that built a PayMongo session from a client-supplied `data` payload (client-controlled amount) is deleted | `supabase/functions/paymongo-checkout/index.ts` |
| A2 | Open email relay closed | 🟠 | `verify_jwt = true` for `send-approval-email`; the `from` sender is now fixed server-side (overridable only via the `APPROVAL_EMAIL_FROM` secret), so it can't be used to spoof mail | `supabase/config.toml`, `supabase/functions/send-approval-email/index.ts` |
| — | Legacy webhook branches removed | 🟠 | Deleted the metadata-driven `processWalletTopUp` / `processMarketplacePurchase` paths + their dead helpers; the webhook now settles **only** via a recorded `payment_intent` | `supabase/functions/paymongo-webhook/index.ts` |
| P1/P8 | Demo purchase + dead client-write tail removed | 🟡 | Removed the `demo` instant-completion branch and the ~220-line browser-side settlement tail (direct writes to `credit_purchases` / `credit_transactions` / `credit_ownership`) + the dead wallet mutators (`updateWalletBalance`, `initiateWithdrawal`, `checkAndCompletePayment`, `createTransaction`) | `src/services/marketplaceService.js`, `src/services/walletService.js` |
| P6 | Self-purchase guard | 🟢 | A seller can no longer buy their own listing (both card and wallet RPCs raise `cannot buy your own listing`) — **new migration** | `supabase/migrations/20260703000500_self_purchase_guard.sql` |
| P7 | Reconciliation widened | 🟡 | `reconcile_financials()` now also flags `transaction_unaccounted` — completed transactions with neither a `payment_intent` nor a ledger group — **new migration** | `supabase/migrations/20260703000600_reconcile_widen_unaccounted.sql` |
| A4 | Content-Security-Policy added | 🟡 | Shipped **Report-Only** first (does not block anything) so violations show in the console without breaking the app; allows Supabase (https+wss), Google Fonts + Material Symbols, OSM tiles, PayMongo. **Flip to enforcing after testing** (see step 3.4) | `vercel.json` |

**Already done in prior passes** (for reference): security headers, `v-html` XSS escape, prod-log stripping, no client secret key, and the two pending migrations `20260703000300` (profiles role/KYC lock) and `20260703000400` (retire identity) — both reviewed and ready to apply.

---

## 2. ⬜ Your side (dashboard / deploy — I have no access)

Apply in this order. All migrations are idempotent (safe to re-run).

1. **Apply migrations** in the Supabase SQL Editor, in order:
   - `20260703000300_harden_profiles_role_kyc.sql` (🔴 privilege-escalation lock)
   - `20260703000400_retire_credits_authuid.sql` (retire identity)
   - `20260703000500_self_purchase_guard.sql` (P6)
   - `20260703000600_reconcile_widen_unaccounted.sql` (P7)
2. **Redeploy the two edge functions** from the function editor / CLI:
   - `paymongo-checkout` (ships the JWT-only identity + removed raw path)
   - `send-approval-email` (ships `verify_jwt=true` + fixed sender)
   - *(Optional)* redeploy `paymongo-webhook` too so the smaller, legacy-free version is live — behaviour for the real flow is unchanged.
3. **Supabase dashboard config:**
   - Set up a **custom SMTP** provider, then turn on **email confirmation** (`enable_confirmations = true`). *(Requires SMTP first, or existing users get locked out.)*
   - *(Optional)* set `APPROVAL_EMAIL_FROM` to your verified sender (e.g. `Carbonify <noreply@yourdomain>`).
   - Confirm **`ALLOW_UNSIGNED_WEBHOOKS`** is unset / `false`.
   - Confirm all edge secrets present: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYOUT_WORKER_SECRET`, `ACCOUNT_DELETION_SECRET`, `RESEND_API_KEY`.
4. **Deploy the frontend** (Vercel preview) so it ships the CSP + code changes.

---

## 3. ⬜ Test together (on the deployed preview — webhooks can't reach localhost)

1. **Privilege-escalation check:** a normal user tries to `PATCH profiles {role:'admin'}` → must be **denied**; but can still edit name/phone; an admin can still change roles via User Management; KYC approval still raises `kyc_level`.
2. **All 6 money flows**, each must end with `reconcile_financials()` returning **0 rows**:
   A. card purchase · B. wallet top-up · C. wallet purchase · D. cart (2 items) · E. retire · F. subscription.
3. **Self-purchase:** as a seller, try to buy your own listing → must be rejected with `cannot buy your own listing`; nothing decremented.
4. **CSP:** with the deployed preview open, check the browser console for `Content-Security-Policy-Report-Only` violations. If clean across all pages (map, checkout redirect, fonts/icons), **rename the header key** in `vercel.json` from `Content-Security-Policy-Report-Only` → `Content-Security-Policy` and redeploy to enforce.
5. **Reconciliation note:** after applying `…000600`, the first `reconcile_financials()` run may list old `transaction_unaccounted` rows — those are **pre-existing legacy/direct-write transactions**, surfaced on purpose for review, not a regression.

---

## 4. Still external / not code (unchanged — the go-live gate)

- **Independent penetration test** before switching to live PayMongo keys.
- Real credit-supplier partner, AML/sanctions data vendor, licensed PSP/EMI, legal entity + BIR + DPO/AMLA, accredited verifier (VVB), backups/PITR, Sentry.

Until the 🔴/🟠 items above are applied **and** the pentest passes, run in **sandbox/test mode only.**
