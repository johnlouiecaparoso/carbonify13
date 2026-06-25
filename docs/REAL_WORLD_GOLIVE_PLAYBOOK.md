# Carbonify — Real‑World Go‑Live Playbook (Real Projects + Real Money)

**Prepared:** June 2026 · **Status:** Strategy + actionable plan. Sandbox code can start now; live money/projects need the business/legal steps below.

> ⚠️ **Not legal/financial advice.** Real money + real carbon credits are regulated (BSP, AMLA, BIR, DPA in PH; plus carbon‑market integrity rules). Use this to brief a PH fintech lawyer, an accountant, and your chosen partners.

---

## 0. The honest framing

"Going live with real money and real projects" is **~40% software, ~60% business/legal/partnerships**. Software alone can't make credits real — a credit is only "real" if it exists on a recognized **registry** (Verra, Gold Standard, or the forthcoming PH national registry) and was verified by an accredited body. So the strategy is to **plug into that reality**, not recreate it.

There are **two tracks**. Most successful platforms run **A now for revenue, B in parallel for depth.**

| | **Track A — Aggregator / Marketplace** | **Track B — Originator / Registry** |
|---|---|---|
| What you sell | *Existing* registry‑verified credits (Verra/GS) via a supplier API | *Your own* PH local projects' credits |
| Time to real money | **Weeks–months** | **12–36 months** |
| Cost | Low–medium (rev‑share / API fees) | High (PDD, VVB audits, registry fees) |
| Who verifies | Already verified upstream | Accredited VVB + registry |
| Your existing build used | Marketplace, wallet, certificates, KYC, payments | **MRV module, validation, endorsements, scoring** |
| Risk | Low | High (methodology, permanence, fraud) |

**Recommendation:** Launch **Track A** to have real projects + real money quickly and legitimately, while using your already‑built **MRV/validation/LGU** features to incubate **Track B** PH projects toward Verra/Gold Standard listing.

---

## 1. Track A — Get REAL credits + REAL money fast (recommended first)

The unlock: **carbon‑credit supplier APIs** let you embed discovery, purchase, and **retirement of real, registry‑verified credits** *without becoming a registry yourself.*

| Provider | What it gives Carbonify | Why it fits |
|---|---|---|
| **Carbonmark API** | Programmatic **discovery, pricing, orders, and retirements** of real credits; built specifically to embed carbon buying/retiring into your app. ([docs](https://docs.carbonmark.com/)) | Cleanest "drop‑in real credits + retirement" for a software product. |
| **Cloverly** | API‑first marketplace + **verified project catalog**; also "Catalyst" software for developers (inventory, sales). ([cloverly.com](https://cloverly.com/)) | Good catalog + developer‑side tooling if you later host sellers. |
| **Patch** | Enterprise procurement, **25,000+ projects**; partnered with Cloverly. ([patch.io](https://www.patch.io/)) | Scale + corporate‑buyer credibility. |
| **CNaught** | Diversified portfolio offsetting via API. ([cnaught.com](https://www.cnaught.com/blog/the-best-carbon-credit-platforms-in-2025)) | Simple "one portfolio" buying. |

**How it maps to what you already have:**
- Your **marketplace** lists supplier credits (pulled via API) alongside any local projects.
- Your **purchase flow** calls the supplier API to place a real order + retirement; your **certificate** records the supplier's real **serial number + retirement receipt** (your QR/verify page now points to a *real* retirement).
- Your **KYC + wallet + receipts** stay as‑is; **real money** flows through your PH PSP (see §3).
- Net effect: **real verified credits, real retirements, real money** — in weeks, legitimately.

**Business steps for Track A:**
1. Sign up + commercial agreement with a supplier API (Carbonmark/Cloverly/Patch).
2. Decide markup/fee model (your revenue = spread or platform fee).
3. Map their catalog → your marketplace schema (project metadata, price, vintage, registry serial).
4. Sandbox integration → test purchase + retirement → reconcile.
5. Go live with PSP in live mode.

---

## 2. Track B — Originate REAL PH projects (your deep value, slower)

This is exactly what your **MRV module, validation workflow, project scoring, and LGU endorsements** were built for. RE, cookstove, reforestation, and waste‑methane projects are **already registered from the Philippines** under Verra/Gold Standard, so the path is proven. ([mtstonegate](https://www.mtstonegate.com/post/why-the-philippines-is-southeast-asia-next-carbon-market-hotspot))

**The real‑world lifecycle (what Carbonify helps developers do):**
1. **Account** on a registry (Verra/Gold Standard). ([Verra registry](https://verra.org/registry/overview/))
2. **PDD** (Project Design Document) under an **approved methodology**. ← Carbonify already collects PDD + baseline + additionality + leakage + safeguards.
3. **Validation** by an accredited **VVB** (independent third party). ← Carbonify's verifier role becomes "VVB liaison," not the VVB itself.
4. **Monitoring** → **Verification** (periodic VVB audits). ← Carbonify's **MRV module** produces the monitoring reports/evidence the VVB reviews.
5. **Issuance** of serialized credits on the registry.
6. **Listing/sale** — back in Carbonify's marketplace (now as registry‑issued credits).

**Where Carbonify adds value in Track B (and earns trust):**
- Pre‑registration project management, document vault, MRV data capture, LGU **host endorsements**, feasibility/risk scoring, and a developer dashboard — i.e., the **"project preparation + MRV software"** layer (like Cloverly Catalyst), feeding into Verra/GS.
- Gold Standard suits **community/social** PH projects; Verra suits **forestry/energy/industrial**. Pick per project type. ([AQUILA](https://aquila.is/2025/verra-vs-gold-standard-which-certification-is-right-for-your-project/))

**Reality check for Track B:** approved methodologies, VVB audit fees, registry fees, and multi‑month timelines are unavoidable. Start with **one pilot project** (e.g., a biochar or reforestation site with a willing LGU/cooperative) and shepherd it end‑to‑end.

---

## 3. Real money (production, partner‑custodied) — recap & tie‑in

(Full detail in `PAYMENTS_ARCHITECTURE.md`.) For go‑live:
- **Partner‑custodied wallet** — licensed PH PSP/EMI holds funds (Xendit / PayMongo / Maya / EMI partner). You orchestrate.
- **Server‑side authority** + **signed webhooks as source of truth** + **double‑entry ledger** + **idempotency** + **escrow** for marketplace trades + **reconciliation**.
- For **Track A**, money + credit delivery are tightly coupled: only place the supplier order/retirement **after** payment is confirmed by webhook; if retirement fails, refund.
- For **Track B**, add **seller payouts** (developer KYB + disbursements + hold periods).

---

## 4. Legal / business setup checklist (PH)

| Item | Why | Owner |
|---|---|---|
| **Legal entity** (corp/partnership, SEC) | Sign supplier + PSP contracts, hold accounts | Founder + lawyer |
| **PSP/EMI partnership** (Xendit/PayMongo/Maya/EMI) | Real money, partner custody | Founder + partner |
| **Carbon supplier agreement** (Track A) | Real credits + retirement | Founder + supplier |
| **AMLA program** (CDD/EDD, screening, monitoring, STR/CTR) | Required with real money/payouts | Compliance officer |
| **Data Privacy Act** (DPO, consent, DSAR, breach) | Personal + KYC data | DPO |
| **BIR registration + tax** (OR/invoice, VAT, withholding) | Revenue + payouts | Accountant |
| **Terms of Service / Buyer disclosures / refund policy** | Consumer protection (BSP FCPA) | Lawyer |
| **Carbon claims policy** | Avoid greenwashing/double‑claim; align ICVCM CCP | Domain lead |
| **Insurance / dispute handling** | Operational risk | Ops |

---

## 5. Phased go‑live plan (what to do, in order)

| Phase | Outcome | Code (I can build) | Business (you/lawyer/partners) |
|---|---|---|---|
| **P0 — Foundations** | Production‑safe base | Provider abstraction, secrets mgmt, env separation (dev/stage/prod), move payment logic server‑side | Incorporate; open sandbox accounts |
| **P1 — Real credits (sandbox)** | Embed real catalog + retirement in test mode | Integrate supplier API (Carbonmark/Cloverly) in sandbox; map catalog → marketplace; wire purchase→order→retirement; certificates show real serials | Sign supplier agreement; set markup |
| **P2 — Real money (sandbox)** | End‑to‑end paid flow in test | PSP live‑grade integration in sandbox; webhook‑as‑truth; double‑entry ledger; idempotency; escrow; reconciliation | PSP onboarding/KYB of your entity |
| **P3 — Compliance layer** | Legally operable | AML screening hooks, DPA tooling (consent/export/delete), BIR invoicing, ToS/disclosures in‑app | AMLA program; DPO; tax setup; legal review |
| **P4 — Limited live** | First real transactions | Flip to live keys behind a feature flag; monitoring/alerts; pilot allowlist | Soft launch to a small buyer/seller set |
| **P5 — Track B pilot** | First originated PH project | Project‑prep + MRV export packaged for a VVB; seller KYB + payouts | Onboard 1 pilot project → VVB → registry |
| **P6 — Scale** | Many users | Queue/workers, partitioning, read replicas, DR runbook, pentest | Ongoing compliance, audits |

---

## 6. Realistic timeline & cost signals

- **Track A real money live:** ~2–4 months (mostly partner onboarding + compliance, not code).
- **Track B first issued credit:** ~12–36 months (registry + VVB timelines).
- **Recurring costs:** PSP MDR (~2–4%), payout fees, supplier rev‑share/markup, KYC/KYB per‑check, infra (DB w/ PITR + replicas + queue), compliance (legal/DPO/AML/audits).
- **Market tailwind:** VCM projected to grow from ~$1.4B (2024) toward $7–35B by 2030. ([SOVCM 2025](https://3298623.fs1.hubspotusercontent-na1.net/hubfs/3298623/SOVCM%202025/Ecosystem%20Marketplace%20State%20of%20the%20Voluntary%20Carbon%20Market%202025.pdf))

---

## 7. What I (the dev side) can start building immediately — safely

All in **sandbox/test mode**, production‑grade, zero regulatory exposure:
1. **Provider abstraction layer** (`PaymentProvider`, `CreditSupplier` interfaces) so rails/suppliers are swappable.
2. **Supplier API integration (sandbox)** — pull a real catalog into the marketplace; wire purchase → order → **retirement**; record real serials on certificates.
3. **Server‑side payment flow (sandbox)** — Edge Function payment intents, **signed webhook handler**, **double‑entry ledger**, idempotency, escrow, reconciliation job.
4. **Seller KYB + payout (sandbox)** for Track B.
5. **Compliance hooks** — consent capture, data export/delete (DPA), AML screening stubs, BIR‑ready invoices/receipts.

What I **cannot** do for you (business/legal): incorporate the entity, sign partner contracts, pass the partner's KYB of *you*, obtain methodologies/VVB engagement, or flip the switch to live funds. Those are yours (with your lawyer/accountant/partners).

---

## 8. Decision needed to start coding

1. **Which track first?** (Recommend **A** — real credits via supplier API — for fastest real money.)
2. **Which supplier API?** (Carbonmark for clean embed + retirement; Cloverly for catalog + developer tooling; Patch for scale.)
3. **Which PSP for real money?** (PayMongo already integrated; Xendit for marketplace payouts; an EMI for true partner‑custody wallet.)
4. **Sandbox first?** (Strongly yes — build + prove the full flow in test mode before any live key.)

---

## 9. Sources
- [Carbonmark API docs](https://docs.carbonmark.com/) · [Carbonmark — Retire Carbon](https://docs.carbonmark.com/carbonmark-api/retire-carbon)
- [Cloverly](https://cloverly.com/) · [Cloverly — Guide to Carbon Project Registries](https://cloverly.com/blog/the-ultimate-guide-to-carbon-project-registries)
- [Patch](https://www.patch.io/) · [Patch + Cloverly partnership](https://carbonherald.com/patch-and-cloverly-partner-to-streamline-carbon-credit-procurement/)
- [CNaught — Best carbon credit platforms 2025](https://www.cnaught.com/blog/the-best-carbon-credit-platforms-in-2025)
- [Verra — Registry Overview](https://verra.org/registry/overview/) · [Verra — Investing in Carbon Projects 2025](https://verra.org/verra-views/investing-in-carbon-projects-what-you-need-to-know-in-2025/)
- [Gold Standard — Impact Registry](https://www.goldstandard.org/project-developers/impact-registry) · [Verra vs Gold Standard (AQUILA)](https://aquila.is/2025/verra-vs-gold-standard-which-certification-is-right-for-your-project/)
- [Why the Philippines is SEA's next carbon hotspot](https://www.mtstonegate.com/post/why-the-philippines-is-southeast-asia-next-carbon-market-hotspot)
- [Ecosystem Marketplace — State of the VCM 2025](https://3298623.fs1.hubspotusercontent-na1.net/hubfs/3298623/SOVCM%202025/Ecosystem%20Marketplace%20State%20of%20the%20Voluntary%20Carbon%20Market%202025.pdf)
