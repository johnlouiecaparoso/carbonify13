# Carbonify — Real‑Money Payments & Wallet Architecture (Brainstorm / Plan)

**Model chosen:** Partner‑custodied wallet · **Target:** Production‑scale (many users, automated payouts, full compliance)
**Prepared:** June 2026 · **Status:** Planning only — no code yet.

> ⚠️ **Not legal/financial advice.** Real money in the Philippines touches BSP, AMLA, BIR, and the Data Privacy Act. Engage a PH fintech lawyer + accountant before go‑live. This document is an engineering/architecture plan to brief them and the team.

---

## 1. What "partner‑custodied wallet" means here

You keep the **wallet experience** (balance, top‑up, history, payouts) in Carbonify, but a **licensed partner legally holds the funds** and is the regulated entity. Carbonify is the *application/orchestration layer*; it never custodies cash float itself.

Two common ways partners implement this:

- **Virtual accounts (VA) per user** — the partner issues each user a unique account number; money paid in is tracked by the partner against that VA; Carbonify mirrors the balance.
- **Sub‑ledger / sub‑accounts (BaaS/EMI)** — the partner runs a white‑label wallet sub‑ledger; each Carbonify user is a sub‑account; the partner holds the pooled trust funds.

**Carbonify's job:** identity (KYC/KYB), orchestration (initiate collections/payouts), a **mirror ledger** for reconciliation, escrow logic for marketplace trades, fees, receipts, and UX. **The partner's job:** custody, settlement, and the regulated money movement.

---

## 2. Reference architecture (production)

```
                       ┌─────────────────────────────────────────────┐
   Vue SPA (browser)   │  never sees secrets · never sets amounts      │
        │              └─────────────────────────────────────────────┘
        │ HTTPS (JWT)
        ▼
   ┌───────────────┐      ┌──────────────────────────────────────────┐
   │  API gateway   │────►│  Payments service (stateless, scalable)    │
   │  rate limiting │      │  • create collection/checkout             │
   └───────────────┘      │  • initiate payout/disbursement           │
        │                 │  • escrow hold/release                     │
        │                 │  • recompute amounts server-side          │
        │                 └──────────────┬───────────────────────────┘
        │                                │ API (secret keys, server-side)
        │                                ▼
        │                       ┌───────────────────┐
        │                       │ Licensed PSP / EMI │  ◄── holds the money
        │                       │ (VA / sub-ledger)  │
        │                       └─────────┬──────────┘
        │                                 │ signed webhooks
        ▼                                 ▼
   ┌───────────────┐        ┌──────────────────────────────────────────┐
   │ Postgres       │◄──────│ Webhook ingestion → queue → idempotent     │
   │ • mirror ledger│        │ workers (dead-letter queue on failure)    │
   │ • wallets      │        └──────────────────────────────────────────┘
   │ • escrow/holds │                         │
   │ • payouts      │        ┌──────────────────────────────────────────┐
   │ • webhook_log  │        │ Reconciliation job (daily): ledger vs PSP  │
   │ • idempotency  │        │ settlement report → flag drift/alert       │
   └───────────────┘        └──────────────────────────────────────────┘
```

**Where this lives in your stack today:** the "Payments service" and "Webhook workers" should be **server‑side** (Supabase Edge Functions to start; a dedicated Node/Go service when volume grows). The Vue client only renders state and kicks off partner‑hosted checkout. Your current in‑client `purchaseCredits` logic moves server‑side.

---

## 3. PH partner landscape (orchestrate, don't become the bank)

| Partner | Strength for this model | Notes |
|---|---|---|
| **Xendit (Xendit for Platforms)** | Marketplace **split payments, virtual accounts, automated disbursements/payouts, sub‑accounts** | Best fit for a marketplace that must collect from buyers and pay many sellers. |
| **Maya (PayMaya) / Maya Business** | E‑money issuer + acquiring; strong wallet rails | Good for wallet/e‑money partnership; discuss white‑label/sub‑wallet options. |
| **GCash (via partners/GCash for Business)** | Largest consumer wallet; collections | Great as a *payment method*; sub‑wallet custody is partnership‑dependent. |
| **PayMongo** (already integrated) | Cards, GCash, Maya, QR Ph collections; payouts | You already have it — strong for **collections**; evaluate its payout/marketplace features for seller disbursement. |
| **Licensed EMI / BaaS enabler** | White‑label sub‑ledger wallet where partner is the regulated custodian | The cleanest "partner‑custodied wallet"; due‑diligence the EMI's BSP license. |

**Pragmatic recommendation:** **collections via PayMongo/Xendit**, **payouts + sub‑accounts via Xendit (or an EMI partner)**. Keep the integration **provider‑abstracted** (a `PaymentProvider` interface) so you can switch/add rails without rewrites.

---

## 4. Core money flows (no code, just the contract)

**A. Top‑up (fund the wallet)**
1. Server creates a collection/VA payment with an **idempotency key**.
2. User pays via partner‑hosted checkout.
3. **Signed webhook** confirms funds received → worker writes a **ledger credit** to the user's mirror wallet. (Balance is *derived from the ledger*, never edited directly.)

**B. Purchase credits (escrow trade)**
1. Server **recomputes the price** from the listing (never trust the client).
2. Funds move into an **escrow hold** (buyer's balance or fresh charge → platform escrow at the partner).
3. **Atomic** state change: race‑safe decrement of available credits, record transaction, transfer ownership, write ledger entries (buyer debit, escrow credit). All‑or‑nothing.
4. On finalization (transfer confirmed + refund window passed): **release escrow** → seller balance (minus platform fee), write ledger entries, generate certificate + receipt.

**C. Seller payout (cash out)**
1. Seller must be **KYB‑verified** with payout details.
2. Server initiates a **disbursement** via the partner (idempotent), applies hold period.
3. Webhook confirms payout → ledger debit of seller wallet; mark payout settled. Handle failures via dead‑letter + retry.

**D. Refund / chargeback**
- Reverse via the partner; write **compensating ledger entries** (never edit originals); reclaim/clawback credits if already transferred; alert ops.

**E. Retire credits (ESG claim)**
- **No money moves.** Pure credit‑ledger operation (you already have this) — keep it separate from the cash ledger.

---

## 5. Data model additions (conceptual)

You already have `wallet_accounts`, `wallet_transactions`, `credit_transactions`. For production add/clarify:

- **`ledger_entries`** — append‑only, double‑entry (entry_id, account, debit, credit, currency, ref_type, ref_id, created_at). Balances are sums over this. Never UPDATE/DELETE.
- **`wallets`** — mirror of partner balance per user (derived/cached; reconciled against ledger + partner).
- **`escrow_holds`** — per‑trade held funds with state (held/released/refunded).
- **`payouts`** — seller disbursements with state machine (requested→processing→settled/failed).
- **`payment_intents` / `collections`** — provider intent id, idempotency key, status.
- **`webhook_events`** — raw signed events, dedup key, processed flag (idempotent processing + audit).
- **`idempotency_keys`** — guard against duplicate operations.
- **KYB fields** on sellers (extends your KYC).

All financial tables: **server‑write‑only** via service role; RLS lets a user *read their own* rows only.

---

## 6. Security & integrity (production bar)

- **PCI scope = SAQ‑A**: partner‑hosted checkout/tokenization; **never** touch raw card data.
- **Webhook = source of truth**, signature‑verified, replay‑protected (timestamp + nonce), idempotent.
- **Secrets** in a secret manager / Supabase secrets; **never** in the client bundle.
- **Server authority**: amounts, fees, state transitions computed server‑side; clients can't mark "paid."
- **Least privilege**: financial writes only by Edge Functions/service; RLS read‑own.
- **Encryption**: at rest (managed Postgres) + in transit (TLS); tokenize sensitive KYC docs in a restricted bucket.
- **AML controls**: sanctions/PEP screening at onboarding, transaction monitoring, velocity limits, amount caps tiered by KYC level (you already have KYC levels).
- **Observability & alerting**: payment success rate, webhook lag, reconciliation drift, failed payouts → alerts + dashboards.
- **Independent security review / pentest** before go‑live; periodic thereafter.

---

## 7. Scalability (many users)

- **Stateless payment/webhook services** behind the gateway → horizontal autoscale.
- **Queue + idempotent workers** for webhooks (spikes, retries) with a **dead‑letter queue**.
- **DB**: connection **pooler (PgBouncer)**; indexes on hot paths; **time‑partition** `ledger_entries`/transactions as they grow; **read replicas** for reporting/analytics so checkout never contends with dashboards.
- **Caching** marketplace reads (already done) with invalidation on purchase.
- **Rate limiting** per user/IP on payment + auth endpoints.
- **Multi‑AZ / DR**: automated backups + PITR, tested restores, documented RTO/RPO runbook.
- **Provider abstraction** so you can add rails or fail over.

---

## 8. Compliance program (PH) — plan with professionals

| Area | What's needed | Who owns |
|---|---|---|
| **BSP** | Partner is the licensed EMI/PSP custodian. Assess whether Carbonify needs **OPS registration** given its role. | Lawyer + partner |
| **AMLA** | Customer Due Diligence (CDD/EDD), sanctions/PEP screening, transaction monitoring, **STR/CTR reporting**, recordkeeping. | Compliance officer |
| **Data Privacy Act (RA 10173)** | Consent, **data‑subject access/export/delete**, privacy notice, breach notification, DPO. | DPO + eng |
| **BIR / tax** | Official receipts, VAT, withholding on payouts, books of account. | Accountant |
| **BSP Financial Consumer Protection Act** | Disclosures, complaints handling, dispute resolution. | Ops + legal |
| **Carbon‑specific** | DENR/CCC alignment; eventual national registry / Article 6 (separate from payment rails). | Domain lead |

> The whole point of partner‑custody is to make the **partner the regulated money entity**, shrinking your direct licensing burden — but you still own **AMLA hygiene, DPA, tax, and consumer protection** at the application layer.

---

## 9. Production data readiness ("real data")

Going from sample/demo data to production:
- **Environment separation**: dev / staging / prod projects with separate keys and **PSP sandbox vs live** modes.
- **Remove test accounts / seed data** from prod; gate dev‑only login paths.
- **RLS audit** across every table touching money or PII (deny by default).
- **Migrations discipline**: versioned, reviewed, reversible; no ad‑hoc console edits in prod.
- **Backups + PITR** enabled and **restore‑tested**.
- **Data retention & deletion** policy (DPA) + audit‑log retention.
- **Reconciliation from day one** so "real data" is always provably correct.

---

## 10. Delivery roadmap (production, but still incremental)

| Workstream | Milestone |
|---|---|
| **0. Foundations** | Provider abstraction, secrets mgmt, env separation, move payment logic server‑side. |
| **1. Collections** | Server‑created intents, hosted checkout, signed webhooks, **double‑entry ledger**, idempotency, receipts (sandbox first). |
| **2. Wallet (partner‑custodied)** | VA/sub‑accounts, balance mirror + reconciliation, top‑up UX. |
| **3. Escrow trading** | Atomic purchase + escrow hold/release, platform fee, oversell hardening, refunds. |
| **4. Payouts** | Seller **KYB**, disbursements, hold periods, failure handling, dead‑letter queue. |
| **5. Compliance** | AML screening + monitoring, DPA tooling, BIR invoicing, consumer‑protection flows. |
| **6. Scale & assurance** | Queue/workers, partitioning, read replicas, DR runbook, **pentest + audit**, observability. |
| **7. Go‑live** | Limited rollout → monitor → expand. |

---

## 11. Build‑vs‑partner cheat sheet

| Capability | Build | Partner |
|---|---|---|
| Holding customer funds (custody) | ❌ never | ✅ licensed EMI/PSP |
| Card/GCash/Maya/QR collection | ❌ | ✅ PSP hosted checkout |
| Seller payouts/disbursement | orchestrate only | ✅ PSP payouts |
| KYC/KYB identity | ✅ (you have KYC) | ✅ optionally PSP‑assisted |
| Ledger / escrow logic / fees | ✅ your core IP | — |
| Reconciliation | ✅ | (uses partner reports) |
| Fraud/AML monitoring | ✅ app‑level | ✅ partner tooling |

---

## 12. Cost model to budget for

- **Per‑transaction MDR** (collections, ~2–4% + fixed, varies by method).
- **Payout/disbursement fees** (per transfer).
- **KYC/KYB verification** costs (per check).
- **Infra** (compute, DB tier with PITR, read replicas, queue).
- **Compliance** (legal, DPO, AML tooling, audits/pentest) — recurring.
- **FX** only if you ever take international buyers.

---

## 13. Top risks & mitigations

| Risk | Mitigation |
|---|---|
| Holding float without a license | **Partner custody** (chosen) — never hold cash yourself. |
| Double‑charge / double‑issue | Idempotency keys + webhook‑as‑truth + atomic transactions. |
| Oversell / double‑spend of credits | Race‑safe decrement + double‑entry ledger + retirement locks. |
| Webhook loss/spikes | Queue + idempotent workers + dead‑letter + replay. |
| Money drift | Daily reconciliation vs partner settlement + alerts. |
| Chargebacks/fraud | Hold periods, velocity/amount caps by KYC tier, monitoring. |
| Regulatory exposure | Partner is regulated; you cover AMLA/DPA/BIR/consumer‑protection. |
| Vendor lock‑in | Provider abstraction layer. |

---

## 14. Open decisions to resolve next

1. **Partner selection** — single provider (e.g., Xendit for both collect + payout) vs. best‑of‑breed (PayMongo collect + EMI custody). Run a short vendor evaluation against the cheat sheet in §11.
2. **Escrow finality rule** — what event marks a trade "final" and releases seller funds (instant on credit transfer? T+N days?).
3. **Platform fee model** — flat %, tiered, or per‑transaction.
4. **KYC/KYB tiers** — limits per tier (you already have `kyc_level`; map peso caps to tiers).
5. **International buyers?** — if yes, FX + cross‑border compliance enters scope.
6. **Service topology** — start on Supabase Edge Functions vs. stand up a dedicated payments service now.

> Suggested immediate action: a **2‑week vendor evaluation** (Xendit vs PayMongo vs an EMI partner) on custody model, payout support, fees, KYC/KYB, and PH licensing — that single decision unlocks the rest of the build.
