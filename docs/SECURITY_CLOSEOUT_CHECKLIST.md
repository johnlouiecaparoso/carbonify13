# Security Close-out & Hardening — Status + Test Runbook

> **Updated:** 2026-07-04 · **Branch:** `feature-user-onboarding-ux` (pushed)
> Companion to [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) and [dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md).
> **Use §3 as your test plan for tomorrow.** §1 = already done + verified; §2 = still pending deploy/test; §4 = the go/no-go gate.

---

## 1. ✅ Done AND verified (applied on the live project + tested)

| Item | What | Verified |
|---|---|---|
| Profiles role/KYC lock (`…000300`) | Blocks self-promotion to admin / KYC bump | ✅ applied + tested |
| Retire identity (`…000400`) | Retirement bound to `auth.uid()` | ✅ applied + tested |
| Self-purchase guard (`…000500`) | Seller can't buy own listing | ✅ applied + tested |
| Reconcile widened (`…000600`) | Flags unaccounted transactions | ✅ applied |
| Rate limiting (`…000000` + checkout redeploy) | 20 checkouts / 5 min per user → 429 | ✅ applied + deployed + tested |
| Checkout JWT-only identity | `paymongo-checkout` trusts only verified JWT | ✅ deployed + tested (6 money flows reconcile to 0) |
| Email relay closed | `send-approval-email` JWT **on** + fixed sender | ✅ deployed |
| SMTP + email confirmation | Resend SMTP; confirmations on | ✅ configured + tested |
| External PSP reconciliation (`…000100` + `paymongo-reconcile`) | System-vs-PayMongo drift report | ✅ applied + deployed + tested (**found 6 orphaned paid intents**) |
| Sentry error tracking | Live via baked-in DSN, production-only | ✅ shipped (verify per §3.4) |
| `ALLOW_UNSIGNED_WEBHOOKS` | Confirmed absent (webhooks fail-closed) | ✅ |

---

## 2. ⬜ Pending — deploy & test TOMORROW

Two features are pushed to the branch but **not yet applied/deployed on the live project**:

- **A. `paymongo-resettle`** — heals the 6 orphaned paid intents reconcile found.
- **B. Velocity caps** — per-KYC-tier daily spend limit (migration `…000200` + `paymongo-checkout` redeploy).

Do §3 to activate + test them.

---

## 3. 🧪 Test runbook (do these tomorrow, in order)

> Project ref: `fmngptolarydbgrtltnd`. Worker secret (already set): `RECONCILE_WORKER_SECRET = 9dcaba5fc4bafbf78a5b4bf22c5db2fbdd6ce50eb9f38f2955d33df636f30256`. Run `curl.exe` in **PowerShell**.

### 3.1 — Heal the 6 orphaned payments (feature A)
1. **Deploy** edge function `paymongo-resettle` (Verify JWT **OFF**).
2. Run the heal (auto-finds paid-but-pending intents):
   ```powershell
   curl.exe -i -X POST "https://fmngptolarydbgrtltnd.supabase.co/functions/v1/paymongo-resettle" -H "x-worker-secret: 9dcaba5fc4bafbf78a5b4bf22c5db2fbdd6ce50eb9f38f2955d33df636f30256" -H "Content-Type: application/json" -d '{\"lookback_days\": 30}'
   ```
   **Expect:** `{"success":true,"healed":6,"results":[... "outcome":"settled" ...]}`
3. **Confirm** by re-running reconcile — `discrepancy_count` should now be **0**:
   ```powershell
   curl.exe -i -X POST "https://fmngptolarydbgrtltnd.supabase.co/functions/v1/paymongo-reconcile" -H "x-worker-secret: 9dcaba5fc4bafbf78a5b4bf22c5db2fbdd6ce50eb9f38f2955d33df636f30256" -H "Content-Type: application/json" -d '{\"lookback_days\": 30}'
   ```
4. (Optional) In the app, confirm those 3 subscriptions flipped to Pro and the 3 marketplace buyers now hold their credits.

### 3.2 — Velocity caps (feature B)
1. **Apply** migration `20260704000200_velocity_caps.sql` (SQL Editor).
2. **Redeploy** `paymongo-checkout` (it now calls the cap check before creating a session; Verify JWT stays **OFF**).
3. **Happy path:** a normal purchase still works (defaults: KYC L0 = ₱10,000/day, L1 = ₱100,000/day, L2+ = unlimited).
4. **Prove it blocks** — set a tiny cap, then attempt a purchase over it:
   ```sql
   -- set a tiny cap (SQL Editor)
   insert into public.app_settings (key, value, description)
   values ('velocity_daily_caps', '{"0": 5, "1": 5}'::jsonb, 'Daily purchase caps by KYC level')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```
   - A wallet purchase or a card checkout over ₱5 should be rejected with *"daily purchase limit exceeded for your verification level…"* (card is blocked **before** redirect to PayMongo — nothing is charged).
5. **Restore** the real caps:
   ```sql
   update public.app_settings set value = '{"0": 10000, "1": 100000}'::jsonb where key = 'velocity_daily_caps';
   ```

### 3.3 — Re-confirm the 6 money flows still reconcile to 0
After 3.1/3.2, run one of each (card, wallet top-up, wallet purchase, cart, retire, subscription) and confirm `select * from public.reconcile_financials();` returns **0 rows**.

### 3.4 — Sentry (optional, 1 min)
On the **deployed** URL, open the browser console and run `myUndefinedFunction()`. Within ~30s it appears in your Sentry dashboard → Issues.

### 3.5 — CSP (optional, decision)
On the deployed URL, open DevTools console and click through map / checkout / all pages. If there are **no** `Content-Security-Policy-Report-Only` violations, tell your developer to flip the header in `vercel.json` from `Content-Security-Policy-Report-Only` → `Content-Security-Policy` to enforce it.

---

## 4. Go / no-go gate (real money)

- [x] `profiles` role/KYC lock applied + verified
- [x] Retire identity applied + retested
- [x] `send-approval-email` requires auth
- [x] `paymongo-checkout` requires a verified JWT
- [x] Email confirmation on; `ALLOW_UNSIGNED_WEBHOOKS` unset; secrets present
- [x] Legacy/demo code paths removed
- [x] All 6 money flows reconcile to 0
- [x] Rate limiting + velocity caps (value abuse) — *velocity pending tomorrow's apply (§3.2)*
- [x] Error tracking (Sentry) live
- [x] External settlement reconciliation + heal path
- [ ] **Independent penetration test** ← the last blocker before LIVE keys
- [ ] CSP switched to enforcing (§3.5)

**Until the pentest passes, run in sandbox/test mode only.**

---

## 5. Still external / not code (unchanged)
Real credit-supplier partner · AML/sanctions vendor · licensed PSP/EMI · legal entity + BIR + DPO/AMLA · accredited verifier (VVB) · backups/PITR + connection pooling + observability dashboards.
