# Deployment Readiness & Security Assessment

Assessment of whether Carbonify is safe to put in front of **real users with real money**, based on two adversarial security reviews (payment path + auth/RLS/secrets) run 2026-07-03. Read this before pointing the app at **live** PayMongo keys.

> **Bottom-line verdict:** the **core money path is well-designed and the proven controls are strong** (server-recomputed amounts, signed/idempotent webhook, oversell locks, correct RPC grants, RLS-locked financial tables). It is **not yet ready for live keys** until the **must-do** items below are done — chiefly the **profiles privilege-escalation lock (Critical)**, the **open email relay (High)**, **JWT-enforced checkout identity (High)**, and an **independent penetration test**. None require a redesign; they are targeted fixes.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## 1. What is already solid (verified controls)

- **Amounts are always server-recomputed** (marketplace from `credit_listings.price_per_credit`, subscription from `subscription_plans`, wallet purchase re-loads the listing). The client cannot set the price it pays.
- **Webhook is fail-closed and signed** — HMAC-SHA256 over `t.body`, constant-time compare, ±300s replay window; rejects unless a secret is configured. Settlement reads amount/user/plan from the stored `payment_intent`, never from webhook metadata.
- **Idempotent** — `webhook_events` dedup + per-RPC idempotency; oversell/double-spend prevented by `FOR UPDATE` row locks and availability checks.
- **RPC grant hygiene** — settlement RPCs are `service_role`-only; user RPCs (`process_wallet_purchase`, `ensure_wallet`, `request_payout`) are scoped to `auth.uid()` and can't touch another user's funds. Refunds are non-destructive (compensating entries). Worker functions (`process-payouts`, `account-deletion`) require a secret header.
- **No server secrets in the client bundle** — only the Supabase anon key + PayMongo public key ship to the browser; `dist/` contains no service-role or PayMongo secret key. `.env*` is gitignored.
- **Financial tables are server-write-only** (RLS lockdown applied + verified this cycle). Most user tables (KYC, KYB, disputes, MRV, data-subject requests) have owner/admin-scoped RLS. RPCs are parameterized plpgsql (no SQL injection).

---

## 2. Findings & status

| # | Finding | Sev | Status |
|---|---|---|---|
| A1 | **Privilege escalation** — a user could `PATCH profiles` to set their own `role='admin'` / raise `kyc_level` | 🔴 | **Fix written** → apply migration `20260703000300` + retest |
| A2 | **Open email relay** — `send-approval-email` has `verify_jwt=false`, no secret, trusts `to`/`from`/`html` → anyone can send spoofed mail from your domain | 🟠 | **Action required** (edge redeploy) — §4 |
| P2 | **Checkout trusts client `user_id`** when no JWT is presented → purchases/subscriptions attributable to any account | 🟠 | **Action required** (edge redeploy) — §4 |
| P3/P4 | **Legacy checkout/webhook branches** trust client metadata + allow an open redirect | 🟠 | Recommended removal (test-only callers) — §4 |
| A3 | **Email confirmation disabled** — unverified/spoofed signups | 🟡 | Dashboard action — §5 |
| A4 | **No CSP / security headers** | 🟡 | **Partly fixed** (headers added); CSP still to add — §6 |
| A5 | **XSS via `v-html`** in `ModernPrompt` (unescaped message) | 🟡 | ✅ **Fixed in code** |
| A6 | **MFA is client-side only** (router redirect, fails open) — not enforced at the API | 🟡 | Recommendation — §6 |
| P5 | `retire_credits_atomic` trusted `p_user_id` as a fallback | 🟡 | **Fix written** → apply migration `20260703000400` + retest E |
| P1/P8 | `demo` purchase path + dead client wallet mutators | 🟡 | Neutralized by RLS lockdown; remove for cleanliness — §4 |
| A7 | **PII in production console logs** (email, user id, profile) | 🟢 | ✅ **Fixed in code** (stripped from prod build) |
| A8 | Latent PayMongo **secret-key** read in the frontend | 🟢 | ✅ **Fixed in code** (never read into the browser) |
| P6 | No **self-purchase** guard (wash trading) | 🟢 | Recommended SQL — §3 |
| P7 | Reconciliation blind to non-intent transactions | 🟡 | Recommended SQL — §3 |
| A9 | No app-level **rate limiting** on public checkout/RPCs | 🟢 | Recommendation — §6 |

---

## 3. ✅ Fixed in this pass (already on the branch)

Effective on the next **frontend build/deploy** — no DB or edge work:

- **Security headers** on all routes (`X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`) — [vercel.json](../../vercel.json).
- **XSS hardening** — `ModernPrompt.formatMessage` now HTML-escapes the message before formatting — [ModernPrompt.vue](../../src/components/ui/ModernPrompt.vue).
- **Production log stripping** — `console.log/info/debug` (which logged session email, user ids, profiles) are dropped from the prod bundle; `error`/`warn` kept — [vite.config.js](../../vite.config.js).
- **PayMongo secret key** is never read into the browser config — [paymongoService.js](../../src/services/paymongoService.js).

### Apply these migrations in the SQL Editor, then retest (priority)

1. **`20260703000300_harden_profiles_role_kyc.sql`** (🔴 A1) — blocks direct client writes to `profiles.role` / `kyc_level` via column privileges; admin RPCs (owner-privileged) still work. **After applying, test:** a normal user can still edit their profile; an admin can still change roles; a role application can still be approved; KYC approval still raises the level.
2. **`20260703000400_retire_credits_authuid.sql`** (🟡 P5) — binds retirement identity to `auth.uid()`. **Retest flow E** (retire) → `reconcile_financials()` = 0.

### Recommended additional SQL (apply when ready, then retest a purchase)

- **P6 — block self-purchase** (add to `process_marketplace_purchase` and `process_wallet_purchase`, right after loading the listing):
  ```sql
  if v_listing.seller_id = v_buyer then
    raise exception 'cannot buy your own listing';
  end if;
  ```
  (In `process_marketplace_purchase` the buyer is `v_intent.user_id`.)
- **P7 — widen reconciliation:** add a check in `reconcile_financials()` for `status='completed'` transactions that have neither a matching `payment_intent` nor a `wallet_`-scoped ledger group, so fabricated/legacy rows can't hide.

---

## 4. ⚠️ Edge-function changes required before go-live (redeploy + retest)

These touch the proven money/email functions, so apply them deliberately and re-run the sandbox flows afterward. They are **not** auto-applied.

### A2 — close the open email relay (do this before any public launch)
In [supabase/config.toml](../../supabase/config.toml), require auth for the email function:
```toml
[functions.send-approval-email]
verify_jwt = true
```
Redeploy it. Also override any caller-supplied `from` with a fixed sender and prefer server-deriving the recipient. Without this, anyone on the internet can send spoofed "Carbonify" email from your domain (phishing + reputation damage).

### P2 — enforce verified identity in `paymongo-checkout`
In [paymongo-checkout/index.ts](../../supabase/functions/paymongo-checkout/index.ts), in each action replace:
```ts
const userId = verifiedUserId ?? body.user_id ?? null
```
with:
```ts
if (!verifiedUserId) throw new Error('Authentication required')
const userId = verifiedUserId
```
The app always sends the user's JWT via `supabase.functions.invoke`, so legitimate checkout is unaffected; this stops attributing paid state to arbitrary accounts. Redeploy + retest A–F.

### P3/P4/P1/P8 — remove dead/legacy paths (optional cleanliness; test-only callers)
- Delete the legacy default branch in `paymongo-checkout` (the `const { data } = body` fallback) and the legacy `isWalletTopUp`/`transactionId` branches + `processWalletTopUp`/`processMarketplacePurchase` in `paymongo-webhook`. The live flow uses only the `payment_intent_id` path; the raw path's only caller (`PayMongoProvider`) is test-only.
- Remove the `demo` branch + the dead client-write tail in `marketplaceService.purchaseCredits`, and the dead `updateWalletBalance`/`initiateWithdrawal`/`checkAndCompletePayment` mutators in `walletService.js`. These are already neutralized by the RLS lockdown but should go before launch to shrink the attack surface. Retest A–F after.

---

## 5. Dashboard / configuration actions (only you can do)

- **A3 — turn email confirmation back on.** Configure a **custom SMTP** provider in Supabase Auth, then set `enable_confirmations = true`. Track existing unconfirmed accounts.
- **Confirm edge-function secrets are set** in the hosted project: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYOUT_WORKER_SECRET`, `ACCOUNT_DELETION_SECRET`, and (for A2) the email function's requirements.
- **Confirm `ALLOW_UNSIGNED_WEBHOOKS` is NOT set** (or is `false`) in production — if it's ever `true`, anyone can forge a paid webhook and mint credits/wallet balance.

## 6. Before you switch to LIVE PayMongo keys (non-negotiable)

- **Independent penetration test.** No self-review substitutes for this on a real-money system. Prioritize: the checkout/webhook endpoints, the `profiles`/role model, RLS on every user-owned table, and the payout/refund flows.
- **Add a Content-Security-Policy** and test it against the running app (Leaflet tiles, Supabase, PayMongo redirect). Starter (tighten after testing):
  ```
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:; font-src 'self' data: https:;
  connect-src 'self' https://*.supabase.co; frame-ancestors 'none';
  base-uri 'self'; form-action 'self' https://*.paymongo.com
  ```
- **Rate limiting** (A9) on the public `paymongo-checkout` function and the auth surface (per-IP/per-user), to blunt abuse and cost amplification.
- **A6 — consider AAL2 enforcement in RLS** for admin operations (check `auth.jwt()->>'aal' = 'aal2'`), so MFA protects the API and not just the router.
- **Error tracking** (Sentry DSN) so real-user failures are visible.

## 7. Verify on the live database (repo can't confirm — schema has drifted)

1. After applying `20260703000300`, confirm a non-admin **cannot** `PATCH profiles {role:'admin'}` (should be permission-denied) and **can** still update name/phone.
2. `profiles` **SELECT** policy — ensure it does not expose every user's email/PII to all authenticated users (should be owner-or-admin, or minimal public columns only).
3. `projects` INSERT `WITH CHECK` binds `owner_id = auth.uid()`.
4. Live RPC **grants** match the migrations (hand-applied drift risk).

---

## 8. Feasibility & longevity notes

- **Adopt migration discipline.** The recurring root cause of the cutover bugs was hand-applied migrations drifting from `supabase/migrations/`. Move to a tracked flow (or at least always run `supabase/diagnostics/schema_catchup_audit.sql` after changes). This is the single biggest long-term-maintainability win. See [DATABASE_AND_RPCS.md](DATABASE_AND_RPCS.md).
- **Keep money logic server-side only.** The provider abstractions (`payments/`, `payouts/`) and the RPC/webhook settlement model are the right shape for swapping PayMongo or adding a real credit supplier later without touching the browser.
- **External-party track (unchanged):** real registry/supplier integration, AML/sanctions screening, licensed PSP/EMI + BIR registration + accredited verifier. These gate "real carbon market" status more than code does — see [ABOUT_CARBONIFY.md](../ABOUT_CARBONIFY.md) and [../PRODUCTION_READINESS_TODO.md](../PRODUCTION_READINESS_TODO.md).

---

## 9. Go / no-go checklist

- [ ] Apply `20260703000300` (profiles lock) + verify §7.1
- [ ] Apply `20260703000400` (retire identity) + retest E
- [ ] Redeploy `send-approval-email` with `verify_jwt=true` (A2)
- [ ] Redeploy `paymongo-checkout` enforcing verified identity (P2) + retest A–F
- [ ] Turn on email confirmation with custom SMTP (A3)
- [ ] Confirm `ALLOW_UNSIGNED_WEBHOOKS` unset + all secrets present
- [ ] Add + test CSP; add rate limiting
- [ ] **Independent penetration test**
- [ ] Deploy the frontend (ships the §3 fixes)

Until the 🔴/🟠 items are done, run only in **sandbox/test** mode.
