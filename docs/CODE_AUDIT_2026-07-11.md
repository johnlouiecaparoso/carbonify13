# Carbonify — Code Audit & Fixes (2026-07-11)

> **Method:** a whole-codebase, code-level bug hunt (four parallel reviewers over the money path,
> the expansion features, the registry/investor layer, and auth/roles), with every material finding
> **adjudicated against the actual RPC/RLS SQL** — not just the service layer. Where a doc and the code
> disagreed, the code won.
>
> **Baseline throughout:** Build ✅ · ESLint 0 ✅ · **313 tests ✅** (was 312; the over-commitment fix
> corrected a test that had codified the bug, net +1). Everything below was latent — nothing broke the
> suite — which is exactly why it needed reading, not running, to find.

This session **fixed 17 findings** (5 HIGH, 6 MED, 6 LOW) and consolidated the long-standing
`project_credits` column drift. Three LOWs and one HIGH-residual were deliberately deferred (below).

> **Post-audit correction (2026-07-11, later — pre-apply).** A senior review caught that the H1 migration
> `20260718000000` reintroduced `v_user := coalesce(auth.uid(), p_user_id)` — the exact client-supplied
> identity fallback that `20260703000400_retire_credits_authuid.sql` had removed. Corrected in place to
> `v_user := auth.uid()` + null-reject while still un-applied (signature/grant unchanged). Not exploitable
> under the authenticated-only grant, but it silently undid a prior hardening. Same review also deleted the
> dead client-side money writers in `creditOwnershipService` (non-atomic `credit_ownership`/`credit_retirements`
> writes with a client-supplied userId — dead, but a double-retire vector if ever called) and 2 zero-byte
> service files. New findings (financial RLS not in version control; escrow silently reverted) are in
> [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md). Build ✅ · ESLint 0 ✅ · 313 tests ✅.

---

## Fixed — HIGH

| # | Issue | Fix | Ships as |
|---|-------|-----|----------|
| H1 | **Retirement not atomic** — the RPC burned credits, then a *separate* statement wrote `credit_retirements`; a failed insert left credits gone with no record. | `retire_credits_atomic` now burns **and** records in one transaction, returning the retirement row. | migration `20260718000000` + [marketplaceService.js](../src/services/marketplaceService.js#L885) |
| H2 | **Wallet top-up double-credit** — `update_wallet_balance_atomic('add')` isn't idempotent, and PayMongo's two paid-event types (distinct `event_id`s) both cleared dedup and read the intent as unpaid → credited twice. | Atomic claim: `UPDATE payment_intents SET status='paid' WHERE id=… AND status<>'paid'`; credit only if the claim won the row. Reverts the claim if crediting fails so PayMongo retries. | [paymongo-webhook](../supabase/functions/paymongo-webhook/index.ts) |
| H3 | **Any signed-in user could read/enumerate ALL project documents** (land titles, MOAs, permits) — the private-bucket SELECT policy was unscoped. | Scoped to owner / admin+verifier / documents a **validated** project published. (Residual below.) | migration `20260718000100` |
| H4 | **send-approval-email open relay** — arbitrary `to`/`subject`/`html` from any caller, sent from Carbonify's verified sender (phishing). | Function accepts **only** the structured `role_requested` path; recipients/subject/body derived server-side; applicant fields HTML-escaped. | [send-approval-email](../supabase/functions/send-approval-email/index.ts) |
| H5 | **Offtake project reassignment** — the UPDATE policy omitted the ownership check the INSERT enforces, so a developer could PATCH `project_id` onto a rival's validated project and fabricate its contracted revenue/IRR in the Investor Portal. | UPDATE `with check` now re-validates project ownership. | migration `20260718000200` |

## Fixed — MED

| # | Issue | Fix | Ships as |
|---|-------|-----|----------|
| M1 | **Double payout** — the worker disbursed without checking whether `mark_payout_processing` actually claimed the row; overlapping cron runs paid twice. | RPC now returns a boolean; worker skips when it didn't claim. | migration `20260718000300` + [process-payouts](../supabase/functions/process-payouts/index.ts) |
| M2 | **Over-commitment overstated returns** — contracted revenue wasn't clamped to issuable credits, so IRR/NPV/projected value were computed on undeliverable volume. | Clamp to the deliverable volume at the same avg negotiated price; expose raw `committedVolume` for display. | [investorAnalytics.js](../src/services/investorAnalytics.js) |
| M3 | **KYC applicant chose their own tier** — `level_requested` uncapped; an admin's "Approve" click could silently grant tier 3. | Clamp to ≤2 on submit **and** in `review_kyc_application`; CHECK backstop on the column. | migration `20260718000400` + [kycService.js](../src/services/kycService.js) |
| M4 | **Rejected/cancelled applicants locked out of login** — every non-approved status was treated as blocking, permanently bricking a user's base account. | Only `pending`/`under_review` block; a finished decision lets the user into their account. | [roleApplicationService.js](../src/services/roleApplicationService.js#L334) |
| M5 | **`verified_by: 'current_user()'`** — a literal string into a `uuid` column throws on any call (dead path today). | Pass the real reviewer id (param), else null. | [projectService.js](../src/services/projectService.js#L599) |
| M6 | **`project_credits` column drift** — new pools set only `available_credits` while the money path decrements `credits_available`. | See consolidation below. | migrations `20260718000600`/`000700` + 4 services |

## Fixed — LOW

- **L2** checkout records the intent amount as per-unit-centavos × qty, matching what PayMongo charges (no more spurious reconcile mismatch). — [paymongo-checkout](../supabase/functions/paymongo-checkout/index.ts)
- **L5** investor pipeline drops any absent optional column and retries, instead of 400-ing the whole query over one. — [investorService.js](../src/services/investorService.js)
- **L6** MRV dashboard lower-cases the delivery unit before lookup (matches the attribution SQL / farmerService), so a `'Tonnes'` delivery can't count on one screen and drop on another. — [mrvDashboardService.js](../src/services/mrvDashboardService.js)
- **L7** revoked default PUBLIC/anon EXECUTE on the three biomass RPCs (hardening parity). — migration `20260718000500`
- **L8** the Investor Portal category chart now uses blended revenue, matching the headline "Projected value". — [investorService.js](../src/services/investorService.js)
- **L9** a zero-priced (donated/prepaid) offtake is treated as contracted, not re-valued at the listed price. — [investorAnalytics.js](../src/services/investorAnalytics.js)

---

## `project_credits` column drift — RESOLVED (supersedes M6 interim)

Live schema confirmed **both** columns existed. `credits_available` (numeric) is **canonical** — the money
path decrements it. `available_credits` (integer) was a stale stray: a live query showed `2000` where the
true remaining was `1638`, and once the dead `assetLedgerService` fallback was removed it was read by no code.

> **⚠️ CORRECTION (2026-07-11, later).** This section claimed `available_credits` was "maintained by **no
> trigger**." **That was wrong.** Two SECURITY DEFINER issuance triggers write it —
> `activate_validated_project_trigger` (validation) and `mint_credits_on_ver_approval` (VER approval). So
> dropping the column (`000700`) broke validation live (`column available_credits does not exist`). Repaired
> by migration `20260718000900`, which redefines both trigger functions to write only `credits_available`.
> Lesson: the drift check searched the service layer but not the trigger/function bodies in SQL.

Fix: code now writes/reads only `credits_available` (projectWorkflowService, projectApprovalService,
assetLedgerService, marketplaceService). The stray is retired via **expand/contract** so there is no broken
window: `20260718000600` drops its NOT NULL (run before the frontend deploy), `20260718000700` drops the
column (run after). `listings` / `credit_listings` / `user_credits` each have their own `available_credits`
and are unaffected.

---

## Deferred (deliberately not touched)

- **L1 — displayed vs charged price.** The marketplace displays `project.credit_price` while checkout
  charges `credit_listings.price_per_credit`; a developer editing one without the other diverges the two.
  This is a pricing-precedence / data-model decision, not a blind edit.
- **L3 — `purchaseCredits` returns a client-computed receipt total.** Settlement is already
  server-authoritative; only the returned display figure can disagree.
- **L4 — `getTransactions` writes on a read path** (legacy pending→completed backfill). Changing it risks
  the payment-callback wait flow.
- **H3 residual — public project docs and private compliance PII share one bucket.** The scoped policy
  closes bulk enumeration of *unreferenced* PII and non-validated projects, but a document a developer
  publishes on a validated project is still viewable. The complete fix is a two-bucket split (public vs
  private) — a feature, tracked for a later pass.

---

## Deploy order (see HANDOFF.md for the full runbook)

Two hard pairing rules (deploy together or the live flow breaks):
- **H1** — migration `20260718000000` **with** the frontend (the old 3-arg `retire_credits_atomic` is dropped).
- **M1** — migration `20260718000300` **with** the `process-payouts` redeploy (RPC return type changed).

The `available_credits` drop is a two-phase expand/contract: run `…000600` → deploy frontend → run `…000700`.

**None of this has been exercised against the live DB yet** — apply + verify per
[RUNTIME_VERIFICATION_RUNBOOK.md](RUNTIME_VERIFICATION_RUNBOOK.md).
