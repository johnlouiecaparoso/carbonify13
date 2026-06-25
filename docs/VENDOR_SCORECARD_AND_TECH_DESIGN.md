# Carbonify — Vendor Evaluation Scorecard + Technical Design (Track A, provider‑agnostic)

**Prepared:** June 2026 · **Status:** Planning only — no code. Build starts after vendors are scored and this design is approved.
**Decisions locked:** Track A (aggregator) first · provider‑agnostic abstraction with a **mock supplier/PSP** so nothing is committed before contracts.

---

# PART 1 — Vendor Evaluation Scorecard

Two vendor classes to choose: a **Credit Supplier** (real verified credits + retirement) and a **Payment Provider / custodian** (real money, partner‑custodied wallet). Score each candidate **1–5** per criterion, multiply by weight, sum. Highest weighted total wins. Re‑use the same template internally.

## 1.1 Credit Supplier scorecard

Candidates: **Carbonmark · Cloverly · Patch · CNaught**

| # | Criterion | Weight | What "5" looks like |
|---|---|---|---|
| 1 | **Retirement API** (programmatic, returns registry serial + retirement receipt) | 20% | Full retire endpoint + verifiable receipt |
| 2 | **Catalog breadth & quality** (registries, project types, PH/SEA coverage) | 15% | Verra+GS, many types, some PH/SEA |
| 3 | **API maturity** (docs, sandbox, SDKs, webhooks) | 15% | Public docs + real sandbox |
| 4 | **Pricing/economics** (rev‑share vs markup, transparency, fees) | 15% | Transparent, healthy spread for you |
| 5 | **Commercial terms** (min volume, contract length, onboarding effort) | 10% | Low/no minimums, fast onboarding |
| 6 | **Data richness** (metadata you can show buyers: vintage, methodology, SDGs, location) | 10% | Full structured metadata |
| 7 | **Reliability/SLA & support** | 8% | Clear SLA + responsive support |
| 8 | **Reputation/integrity** (ICVCM alignment, quality screening) | 7% | Strong quality controls |
| | **Total** | **100%** | |

> Note from research: **Carbonmark** explicitly supports embedding discovery + orders + **retirement** in apps; **Cloverly** is API‑first with a verified catalog + developer tooling; **Patch** has 25,000+ projects (enterprise). Validate current sandbox availability + PH coverage during evaluation.

## 1.2 Payment Provider / custodian scorecard

Candidates: **PayMongo (already integrated) · Xendit · Maya Business · licensed EMI/BaaS partner**

| # | Criterion | Weight | What "5" looks like |
|---|---|---|---|
| 1 | **Partner custody / sub‑accounts** (they hold float; you orchestrate) | 20% | True sub‑ledger / VA custody |
| 2 | **Payouts / disbursements** (automated seller payouts, split) | 18% | Native marketplace split + payouts |
| 3 | **Collections coverage** (cards, GCash, Maya, QR Ph) | 12% | All major PH methods |
| 4 | **Webhooks + idempotency + signatures** | 12% | Signed, replayable, documented |
| 5 | **Fees** (MDR, payout fee, FX) | 12% | Competitive + transparent |
| 6 | **Licensing/compliance posture** (BSP license, AMLA support, KYC/KYB tooling) | 12% | Licensed + compliance tooling |
| 7 | **Sandbox + API maturity + SDKs** | 8% | Full sandbox + docs |
| 8 | **Settlement speed + reconciliation reports** | 6% | Daily machine‑readable reports |
| | **Total** | **100%** | |

## 1.3 Decision rule
- Pick the **highest weighted score** in each class; if within ~5%, prefer the one with the **better sandbox + lower onboarding friction** (faster proof).
- You may pick **one provider for both** (e.g., Xendit collect+payout) or **best‑of‑breed** (PayMongo collect + EMI custody). The abstraction layer (Part 2) makes either fine.

---

# PART 2 — Technical Design (provider‑agnostic, Track A)

## 2.1 Design principles
1. **Abstraction first.** All external money/credit calls go through two interfaces — `CreditSupplier` and `PaymentProvider`. Concrete adapters (Carbonmark, Xendit, …) and **mocks** implement them. Swapping vendors = new adapter, no business‑logic change.
2. **Server authority.** Amounts, fees, order placement, retirement, and state transitions run server‑side (Supabase Edge Functions → dedicated service later). The Vue client only renders + initiates hosted checkout.
3. **Webhook = source of truth.** Credit delivery and balance changes happen only on signed, idempotent webhook confirmation — never on a browser redirect.
4. **Double‑entry ledger.** Every money movement is two balanced rows; balances are derived, never edited.
5. **Idempotent everywhere.** Every external call + webhook carries a dedup key.
6. **Sandbox‑by‑config.** A single env flag flips test ↔ live; mocks are used in local/dev.

## 2.2 The two interfaces (contracts, described — not code)

**`CreditSupplier`** (real verified credits)
- `searchProjects(filters)` → list of catalog projects (id, name, registry, type, vintage, location, price, metadata)
- `getProject(externalId)` → full detail + documents
- `getQuote(externalId, quantity)` → firm price + fees + expiry
- `placeOrder(quoteId | externalId, quantity, idempotencyKey)` → orderId + status
- `getOrder(orderId)` → status (pending/confirmed/failed)
- `retire(orderId, beneficiary, reason, idempotencyKey)` → retirement record (**registry serial + receipt URL**)
- `getRetirement(retirementId)` → verifiable status
- Adapters: `CarbonmarkSupplier`, `CloverlySupplier`, `PatchSupplier`, **`MockCreditSupplier`** (dev/demo).

**`PaymentProvider`** (real money, partner custody)
- `createCheckout({amount, currency, ref, idempotencyKey})` → hosted checkout URL / intent
- `getPayment(intentId)` → status
- `verifyWebhook(payload, signature)` → typed, verified event (or reject)
- `createPayout({sellerAccount, amount, idempotencyKey})` → payout id/status (Track B)
- `getPayout(id)` / `refund({paymentId, amount, idempotencyKey})`
- `getOrCreateWalletAccount(userId)` → partner sub‑account/VA (partner‑custodied wallet)
- Adapters: `PayMongoProvider`, `XenditProvider`, `EmiProvider`, **`MockPaymentProvider`**.

> Because both have **Mock** adapters, the *entire* flow (catalog → buy → pay → retire → certificate) can be built, demoed, and tested **before** any contract is signed — then a real adapter is dropped in.

## 2.3 Data model additions (conceptual — extends current Supabase schema)

Reuses existing `wallet_accounts`, `credit_transactions`, `certificates`, `kyc_applications`. Adds:

| Table | Purpose |
|---|---|
| `ledger_entries` | Append‑only double‑entry money ledger (account, debit, credit, ref). |
| `payment_intents` | Provider intent/checkout id, amount, idempotency key, status. |
| `webhook_events` | Raw signed events + dedup key + processed flag (idempotent + audit). |
| `idempotency_keys` | Guards duplicate operations. |
| `supplier_orders` | Track A order + retirement: external_id, registry, **registry_serial**, receipt_url, status. |
| `escrow_holds` | (Track B) per‑trade held funds. |
| `payouts` | (Track B) seller disbursements + state machine. |
| listings extension | `source` (`local` \| `supplier`), `external_id`, `registry`, supplier metadata — so the marketplace shows local + supplier credits together. |

All financial/order tables: **server‑write‑only**; RLS lets a user read their own rows only.

## 2.4 Sequence — Track A purchase (real credit, real money, sandbox‑identical to live)

```
Buyer clicks Buy
   │
   ▼
Server: getQuote(supplier, qty)  ── firm price ──►  show buyer total
   │
Buyer confirms
   ▼
Server: createCheckout(amount, idemKey)  ──►  PaymentProvider hosted checkout
   │                                            (buyer pays)
   ▼
PaymentProvider ── signed webhook: payment.succeeded ──►  Webhook handler (verify sig, dedup)
                                                              │
                                                              ▼
                                  Ledger: debit buyer / credit platform (double entry)
                                                              │
                                                              ▼
                          CreditSupplier.placeOrder(idemKey) → confirmed
                                                              │
                                                              ▼
                          CreditSupplier.retire(beneficiary) → registry_serial + receipt
                                                              │
                                                              ▼
                 credit_transactions + supplier_orders written; certificate issued
                 (certificate now carries the REAL registry serial + retirement receipt)
                                                              │
                                                              ▼
                              Notify buyer · receipt · audit log
   ── if order/retire fails after payment → automatic refund + alert ──
```

## 2.5 Cross‑cutting concerns
- **Idempotency:** one key per logical action; webhook handler is safe to run N times.
- **Failure handling:** payment‑then‑fulfilment is a saga — if `placeOrder`/`retire` fails, **refund** and alert; never leave money taken without a credit.
- **Reconciliation:** daily job compares `ledger_entries` + `supplier_orders` against provider settlement + supplier reports; flags drift.
- **Security:** PCI SAQ‑A (hosted checkout), secrets server‑side, signature verification, RLS, least privilege, rate limiting, audit on every money/credit event.
- **Observability:** metrics (payment success %, retire success %, webhook lag, drift), alerts, dead‑letter queue for webhooks.
- **Feature flags:** `PAYMENTS_LIVE`, `SUPPLIER_LIVE` — default off; mocks in dev; sandbox in staging; live only after compliance sign‑off.

## 2.6 Proposed module/file plan (for when you greenlight — not created yet)
```
src/services/payments/
  PaymentProvider.js        # interface contract (JSDoc)
  providers/mockProvider.js
  providers/paymongoProvider.js   # later
  providers/xenditProvider.js     # later
src/services/credits/
  CreditSupplier.js         # interface contract (JSDoc)
  suppliers/mockSupplier.js
  suppliers/carbonmarkSupplier.js # later
supabase/functions/
  payments-create-checkout/
  payments-webhook/         # signed, idempotent
  credits-fulfill/          # placeOrder + retire saga
  reconcile/                # scheduled
supabase/migrations/
  <ts>_payments_ledger.sql  # ledger, intents, webhook_events, idempotency, supplier_orders
```
Existing `marketplaceService.purchaseCredits` is refactored to call the server flow instead of doing money logic in the browser. `certificateService` gains a real `registry_serial` + receipt for supplier credits.

## 2.7 Test & rollout strategy
1. **Unit:** interface adapters against mocks (happy + failure + duplicate‑webhook paths).
2. **Integration (sandbox):** real supplier + PSP sandboxes end‑to‑end; force failures (declined card, failed retire) to prove refunds + idempotency.
3. **Reconciliation test:** inject drift, confirm detection.
4. **Security review/pentest** before live keys.
5. **Cutover:** flip feature flags per environment; pilot allowlist; monitor; expand.

## 2.8 Open questions to finalize before coding
1. Final **supplier** + **PSP** picks (from Part 1 scoring).
2. **Fee model** (markup on supplier price vs flat platform fee).
3. **Escrow finality** rule (Track B): when seller funds release.
4. **KYC peso tiers** mapped to your existing `kyc_level`.
5. **Service topology:** Edge Functions now vs dedicated payments service.
6. **International buyers?** (adds FX + cross‑border compliance.)

---

## 3. How to use these scorecards (next action)
1. Fill **Part 1** with 2–3 real quotes/sandbox trials per vendor class (≈1–2 weeks).
2. Lock supplier + PSP.
3. Approve **Part 2** design (adjust open questions).
4. Greenlight the **mock‑first build** so the full flow is demoable before contracts finalize; swap in real adapters after.
