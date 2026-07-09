# Carbonify — Go-Live Roadmap (Real Users)

> 🧭 **2026-07-09 — this page predates the seven expansion features.** For their honest,
> bullet-by-bullet status read **[EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md)**; for the
> current one-screen summary read the top of **[HANDOFF.md](HANDOFF.md)**. Net change since this page
> was written: features #1, #2, #3 and #5 are complete; #4 is 6/8 and #6 is 5/6; #7 is an interface
> preview with no backend. All 31 migrations are applied. The **P0 blockers below are unchanged** —
> an independent penetration test, and email confirmation is currently **off by choice**.


> **Updated:** 2026-07-04 · **Branch:** `feature-user-onboarding-ux` (PR #2 → `main`)
> The single source of truth for **what is ready, what is not, and what to do next** to put Carbonify in front of **real users with real money.** Companion to [DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md) (security detail), [SECURITY_CLOSEOUT_CHECKLIST.md](SECURITY_CLOSEOUT_CHECKLIST.md) (status + test runbook) and [RELEASE_NOTES.md](RELEASE_NOTES.md).
>
> **2026-07-04 update:** the P0 security items are **applied + tested live** (profiles/retire locks, JWT checkout, closed email relay + SMTP, self-purchase guard, widened reconcile). Added + verified: **rate limiting**, **Sentry**, **external PSP reconciliation** (+ **resettle/heal**), and **velocity caps by KYC tier** (last two pending tomorrow's deploy — see the runbook). **Only P0 blocker left: an independent penetration test.**

---

## 1. Where we are (summary of this cycle)

- **The whole feature set is built** (Phases 0–8): auth/roles/2FA/KYC, projects + documents, MRV, verification with a scored rubric, issuance + QR-verifiable certificates, marketplace + cart + portfolio + retirement, wallet, seller payouts + KYB, refunds/disputes, admin/finance/compliance consoles, public registry, LGU tools, PWA/offline.
- **The money path is proven AND hardened.** All six money flows (card, wallet top-up, wallet purchase, cart, retire, subscription) settle server-side and reconcile to **zero**, re-verified **after** the RLS lockdown that makes the financial tables server-write-only.
- **A full documentation set was written** — per-role user guides, developer docs (setup/architecture/DB/deploy/testing/security), a product overview, release notes, and a build/finish prompt.
- **Two adversarial security reviews were run.** Frontend hardening is applied; DB/edge/dashboard fixes are written and queued. **This is what gates real-money go-live.**

**One-line status:** *feature-complete and money-safe in sandbox; not yet cleared for live payment keys until the security P0 items + an independent penetration test are done.*

---

## 2. Implemented — ready for real users ✅

| Area | Status |
|---|---|
| Auth, 6 roles + RLS, password reset, TOTP 2FA, audit logging | ✅ |
| KYC (buy gate) + KYB (payout gate) | ✅ |
| Project registration, documents, boundary map, status workflow, edit/resubmit | ✅ |
| MRV: monitoring reports, server-side calculation, VER approval → mint | ✅ |
| Verifier: review queue, scored rubric, comment thread, verifier-set price | ✅ |
| Certificates: serials, QR + signature, public verification, PDF | ✅ |
| Marketplace, cart, portfolio (P&L), watchlist/alerts, retirement | ✅ |
| **Money path: server-authoritative, signed webhook, ledger, escrow, payouts, refunds — proven + reconciles to 0 + RLS-locked** | ✅ |
| Admin: finance console, KYC/KYB review, refunds/disputes, system config, audit search, VAT invoices (provisional) | ✅ |
| DPA tooling (data export + account deletion) | ✅ |
| Public registry, market dashboard, double-claim guard | ✅ |
| LGU tools; PWA/offline; 145 unit tests, lint 0, build green | ✅ |
| Frontend security hardening (headers, XSS escape, prod-log stripping, no client secret) | ✅ |

---

## 3. Not implemented / must close before real money — by priority

### 🔴 P0 — Blockers (do before ANY real user pays real money)
| Item | Type | Where |
|---|---|---|
| Apply `20260703000300` — lock `profiles.role`/`kyc_level` (privilege escalation) | DB migration + retest | fix written |
| Apply `20260703000400` — retirement identity = `auth.uid()` | DB migration + retest | fix written |
| Redeploy `send-approval-email` with `verify_jwt=true` (open email relay) | Edge redeploy | change specified |
| Redeploy `paymongo-checkout` to require a verified JWT (stop trusting client `user_id`) | Edge redeploy | change specified |
| Turn on email confirmation with a custom SMTP provider | Dashboard | — |
| Confirm `ALLOW_UNSIGNED_WEBHOOKS` unset + all edge secrets present | Dashboard | — |
| Remove legacy/demo code paths (raw checkout branch, legacy webhook branches, `demo` purchase, dead wallet mutators) | Code + retest | recommended |
| **Independent penetration test before switching to live keys** | External | — |

### 🟠 P1 — High (before scaling / to be genuinely credible)
| Item | Type |
|---|---|
| Real credit-supplier integration (Carbonmark/Cloverly/Patch) — registry serials + retirement receipts | Code + external partner |
| External PSP settlement reconciliation (system-vs-PayMongo, not just system-vs-self) | Code |
| CSP + rate limiting on public functions + Sentry error tracking | Code/infra + keys |
| Self-purchase guard + velocity caps by KYC tier | DB |
| AML / sanctions screening | External data vendor |
| Licensed PSP/EMI partnership, legal entity, BIR registration + accredited receipts, DPO/AMLA program, accredited verifier (VVB) | Business/legal (runs in parallel) |
| Backups/PITR + tested restore, connection pooling, observability dashboards | Ops/infra |

### 🟡 P2 — Medium (quality, adoption, maintainability)
| Item | Type |
|---|---|
| Adopt tracked migrations (`supabase db push`) — stop schema drift | Process |
| Adopt TypeScript in the money/services layer; consolidate dual-column quirks | Refactor |
| Verifier task-queue depth (assignment/SLA), evidence-integrity checks (EXIF/dupes) | Code |
| ESG/offset report exports (PDF/CSV), shareable retirement badges, recurring auto-offset | Code |
| Web push notifications; MRV reminders polish | Code + keys |
| Make Playwright e2e required in CI on a seeded backend | CI |

### 🟢 P3 — Low / later
| Item |
|---|
| Native mobile app (PWA already covers most needs) |
| Blockchain tokenization, Article 6 / national-registry interoperability |
| LGU benchmarking, land-use carbon modeling, trend analytics |

---

## 4. The roadmap — what to do now

### Phase 0 — Security close-out (this week) 🔴
Goal: make the app safe to expose. All P0 code/DB/dashboard items.
1. Apply the two migrations (`…000300`, `…000400`) in the SQL Editor; verify: a normal user can't self-promote to admin, and retirement still reconciles to 0.
2. Redeploy the two edge functions (email `verify_jwt=true`; checkout require verified JWT); re-run the 6 sandbox money flows → reconcile 0 each.
3. Enable email confirmation + custom SMTP; confirm secrets + `ALLOW_UNSIGNED_WEBHOOKS` unset.
4. Remove the legacy/demo code paths; re-run flows.
5. **Book the independent penetration test.**

### Phase 1 — Launch prep 🔴→🟠
6. Merge **PR #2** to `main`; deploy `main` (frontend ships the applied fixes; DB/edge already live).
7. Add Sentry + a CSP (tested) + basic rate limiting.
8. Stand up a staging environment and monitoring (payment success %, webhook lag, reconciliation drift, failed-payout alerts).

### Phase 2 — Soft launch (test mode) 🟠
9. Invite a small group of real users on **PayMongo test keys**; watch reconciliation and logs daily.
10. Fix what real usage surfaces; run the P2 maintainability items opportunistically.

### Phase 3 — Real money + real credits 🟠 (gated by pentest)
11. Only after the pentest passes: switch to **live PayMongo keys** with a licensed PSP arrangement.
12. Integrate a real credit supplier; attach registry serials/retirement receipts; add external reconciliation.
13. Complete the business/legal track (entity, BIR, AML/DPO) — this runs in parallel from Phase 0 and gates "real carbon market" claims.

### Phase 4 — Scale & compliance 🟡
14. Backups/PITR + restore drills, connection pooling, ledger partitioning; verifier queue depth, evidence integrity, exports; e2e-in-CI.

### Phase 5 — Growth 🟢
15. Web push, richer buyer-trust/ESG surfaces, LGU analytics; native mobile / blockchain only if the market demands it.

---

## 5. The go / no-go gate (print this)

**Do NOT accept real money until ALL of these are true:**
- [ ] `profiles` role/KYC lock applied + verified (no self-escalation)
- [ ] Retirement identity migration applied + retested
- [ ] `send-approval-email` requires auth (relay closed)
- [ ] `paymongo-checkout` requires a verified JWT
- [ ] Email confirmation on; `ALLOW_UNSIGNED_WEBHOOKS` unset; secrets present
- [ ] Legacy/demo code paths removed
- [ ] All 6 money flows reconcile to 0 after every change
- [ ] **Independent penetration test passed**
- [ ] Sentry + reconciliation/webhook monitoring live

Until every box is checked, run in **sandbox/test mode only.**
