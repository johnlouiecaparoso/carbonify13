# Carbonify — Release Notes

## 2026-07-03 — Server-authoritative money path (complete & hardened)

**Headline:** the entire money path now runs on the server and is locked down. Every money
movement — buying with a card, GCash/Maya, or wallet balance; topping up the wallet;
checking out a cart; retiring credits; and subscribing — settles server-side and the books
reconcile to zero. This closes the platform's biggest production risk (client-controlled
payment amounts) and hardens the financial tables so the browser can no longer write them.

### Highlights
- **Server-authoritative checkout.** The client sends only `{ listing_id, quantity }`; the
  amount is recomputed on the server from the listing price. A client can no longer set the
  price it pays.
- **Signed webhook as the source of truth.** The PayMongo webhook verifies an HMAC-SHA256
  signature (with a replay window and event de-duplication) and settles each payment
  atomically via database functions. It fails closed.
- **Double-entry ledger + reconciliation.** Every settlement writes balanced ledger entries;
  `reconcile_financials()` reports drift and returns **0 rows** when healthy.
- **Financial tables are now server-write-only.** Row-Level Security keeps reads working but
  blocks all direct client writes to `credit_transactions`, `credit_ownership`,
  `wallet_accounts`, and `wallet_transactions`. Writes happen only through
  `SECURITY DEFINER` RPCs or the service-role webhook.
- **Sellers can get paid.** Escrow, a KYB-gated payout state machine, refunds, and disputes
  are all wired and proven.

### Verified flows (each with `reconcile_financials()` = 0 rows, after the RLS lockdown)
| Flow | Result |
|---|---|
| Card purchase | ✅ |
| Wallet top-up | ✅ |
| Wallet purchase | ✅ |
| Cart (2 items) | ✅ |
| Retire credits | ✅ |
| Subscription upgrade | ✅ |

### Fixes in this release
Four objects that existed only in the live database (never in version control) were surfaced
by the first real end-to-end runs and are now committed as idempotent migrations
(`20260703000000`–`20260703000200`):
- **`update_wallet_balance_atomic`** — the wallet top-up settlement function was called by the
  webhook but defined in no migration. Added.
- **`wallet_transactions.external_reference`** — a missing column that broke the top-up audit
  row and the callback confirmation. Added (with an index).
- **Retirement `project_id` bug** — the Retire page passed the wrong identifier to the retire
  function, causing a false "insufficient credits". Fixed.
- **Stray `credit_ownership_quantity_positive` (> 0) constraint** — blocked retirement's
  zero-out write; replaced with the intended `>= 0` guard.

Also: retiring credits now shows an in-app toast instead of a blocking browser alert.

### Documentation added
- **Per-role user guides** — step-by-step how-to for every role: [user-guide/](user-guide/README.md).
- **Developer docs** — setup, environment variables, architecture, database & RPCs, deployment,
  testing, contributing, and security: [dev/](dev/README.md).

### Verification
ESLint 0 · 145 unit tests passing · production build green · all six money flows reconcile to 0
after the lockdown.

### Known limitations (not code — need an external party or ops/legal)
- Real registry/supplier integration (Verra / Gold Standard / Carbonmark / Patch).
- AML / sanctions screening (needs a data vendor).
- Independent penetration test before using live payment keys; backups/PITR; observability.
- Legal entity, licensed PSP/EMI partnership, BIR registration, accredited third-party verifier.
- VAT invoices are **provisional** until the operating entity is BIR-registered.

> Tracking: branch `feature-user-onboarding-ux`, PR #2 → `main`. Full runbook in
> [YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md); status detail in
> [MONEY_CUTOVER_STATUS.md](MONEY_CUTOVER_STATUS.md).
