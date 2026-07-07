# If I am a Buyer / Investor — What I Need from Carbonify

**Who I am:** A corporation, SME, or individual buying carbon credits to offset emissions, meet ESG/CSR goals, or invest. My success = I can find *trustworthy* credits, buy them easily, prove I bought them, and report the offset.

---

## ✅ What I can already do today
- Register, log in (with **2FA**), reset my password, manage my profile.
- Complete **KYC verification** (required before buying).
- Browse the **marketplace**, filter by location and price, and see projects on an **interactive map**.
- Use the **carbon calculator** to estimate my footprint.
- **Purchase** credits (real PayMongo payment), with my **wallet/portfolio**, **receipts**, and **transaction history**.
- Receive a **certificate** with a serial number, **QR code, digital signature**, and a **public verification page**.
- **Retire** credits and get a retirement certificate.
- Get **dashboard + email notifications** and a role‑aware **onboarding guide**.

---

## 🧩 What I still need (gaps for the developer to implement)

| # | What I want (my voice) | Status | Why it matters to me | Developer action | Priority | Effort |
|---|---|---|---|---|---|---|
| 1 | "Are these credits **real**? Show me they're registry‑verified (Verra/Gold Standard)." | ❌ | I won't risk money/reputation on credits I can't trust. | Integrate a **credit‑supplier API** (Track A) so listings carry a real **registry serial + retirement receipt**; show the registry badge. | 🔴 | L |
| 2 | "Let me **see the project's documents and methodology** before I buy (PDD, additionality, photos, location)." | 🟡 | Due diligence — I need to justify the purchase internally. | Build a full **project detail page** with documents, methodology, map, vintage, co‑benefits. | 🔴 | M |
| 3 | "Filter by **SDG impact / co‑benefits**, not just price/location." | ❌ (filter is cosmetic) | I buy for specific impact stories (jobs, biodiversity, community). | Capture **SDG/co‑benefit data** per project + make the filter real. | 🟠 | M |
| 4 | "Give me an **ESG / offset report** I can download for disclosure." | ❌ | I must report offsets for CSR/ESG/CDP/regulators. | Generate a **portfolio/ESG report** (PDF/CSV): credits bought, retired, projects, tCO₂e, vintages. | 🔴 | M |
| 5 | "I'm a business — I need an **official receipt / BIR invoice** with VAT." | ❌ | Required for accounting/tax. | Add **tax‑compliant invoices/OR** to purchases. | 🟠 | M |
| 6 | "Let me **buy from several projects at once** (a cart) or **bulk‑request a quote**." | ❌ | Corporates buy in volume across a portfolio. | Add a **cart/multi‑item checkout** and a **request‑for‑quote / bulk** flow. | 🟠 | M |
| 7 | "Let me **save favorites / get alerts** on new projects or price changes." | ❌ | I track opportunities over time. | Add **watchlist + notifications** for new listings/price drops. | 🟢 | S |
| 8 | "Offer **recurring / auto‑offset**." | ❌ | I want to offset monthly without re‑buying manually. | Add **subscription offsetting**. | 🟢 | M |
| 9 | "Let me **share a public proof** of my retirement / a verifiable claim badge." | 🟡 (verify page exists) | Marketing/ESG storytelling; transparency. | Add a **shareable public retirement/claim page + badge**. | 🟠 | S |
| 10 | "Show **price history / comparison** so I know I'm paying fairly." | ❌ | Price confidence. | Add **price history + comparison** on the detail page. | 🟢 | S |
| 11 | "Make **refunds / disputes** clear if something goes wrong." | ❌ | Trust in spending real money. | Add a **refund/dispute** flow + policy surfaced in UI. | 🟠 | M |
| 12 | "Connect the **calculator directly to buying** the exact offset." | 🟡 | Reduce friction from 'know footprint' → 'offset it'. | One‑click **calculator → checkout** for the computed tonnes. | 🟢 | S |
| 13 | "Great **mobile experience** / app." | 🟡 | I act on the go. | Audit/improve mobile responsiveness (or PWA). | 🟢 | M |

---

## 🎯 Top 3 to build first (biggest trust/value for buyers)
1. **Real registry‑verified credits** (#1) — without this, buyers can't trust the marketplace.
2. **Full project detail page with documents** (#2) — enables due diligence.
3. **Downloadable ESG/offset report** (#4) — the reason most corporates buy at all.
