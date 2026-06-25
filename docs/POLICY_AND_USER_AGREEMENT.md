# Carbonify — User Agreement, Policies & Platform Disclosures

> **Last updated:** 2026-06-13
> **Status of this document:** Working draft, aligned to the actual build state (see `SYSTEM_LATEST_UPDATE.md`). **Not yet legal-reviewed.** Before any real-money or public launch this must be reviewed by counsel and a Data Protection Officer (see Phase 9 / Constraint 5).
> **Contact:** support@carbonify.com

---

## ⚠️ 0. Platform Status Notice — read first

Carbonify is currently a **pre-production / demonstration platform** (academic capstone stage). Several capabilities are **simulated or in sandbox** and are **not yet live financial or carbon-registry services.** By using Carbonify in its current state you acknowledge:

- **Carbon credits on Carbonify are currently simulated** for demonstration. They are **not yet** backed by, registered with, or retired against a recognized external registry (Verra/VCS, Gold Standard, Climate Action Reserve, American Carbon Registry). **They must not be used for regulatory compliance, official offset claims, ESG reporting, or resale as real-world carbon instruments.**
- **Payments run against a sandbox / test gateway.** The server-side payment, ledger, escrow, and payout systems are **newly built and not yet runtime-verified end-to-end.** Do not transact with real money until the platform publicly confirms live status.
- **Carbonify is not a licensed financial institution, payment service provider, e-money issuer, or investment adviser.** Nothing here is financial, investment, tax, or legal advice.
- Sections marked **🔜 Planned** below describe features that are **not yet implemented** and create **no obligation** until announced as live.

If any term below conflicts with this Section 0 while the platform is in pre-production, **Section 0 controls.**

---

## 1. User Agreement (Terms of Service)

### 1.1 Acceptance
By creating an account or using Carbonify, you agree to this Agreement, the Privacy Policy (§2), and the Carbon Credits Policy (§3). If you do not agree, do not use the platform.

### 1.2 Eligibility & Accounts
- You must be of legal age and capacity in your jurisdiction.
- You must provide accurate registration, KYC, and (for sellers) KYB information, and keep it current.
- You are responsible for safeguarding your credentials. **2FA/MFA (TOTP)** is supported and strongly recommended.
- One person/entity per account unless expressly permitted. Misuse may result in suspension.

### 1.3 Roles & Permitted Use
Carbonify supports six roles — general user, buyer/investor, project developer, verifier, admin, and LGU. You may use only the functions granted to your role. Role applications (developer/verifier) are subject to review and approval.

### 1.4 Marketplace & Transactions
- All credits must be **verified/issued in-platform** before listing.
- Pricing is displayed transparently; the **purchase amount is computed server-side** from the listing — you confirm quantity, not price.
- **All sales are final once payment is confirmed**, except as provided by the Refund & Dispute terms (§1.6).
- Market manipulation, wash trading, and collusive pricing are prohibited.

### 1.5 Seller Payouts
- Sellers (project developers) may request withdrawal of available earnings.
- **Payouts are gated on completed KYB (business verification).**
- Earnings are held in **escrow** until release; payouts move through a tracked state machine (requested → processing → settled/failed) and may be subject to hold periods.
- You are responsible for the taxes applicable to your earnings.

### 1.6 Refunds & Disputes
- Refunds are issued only for **verified technical errors**, and (where applicable) within the stated window after the transaction.
- Refunds and disputes are handled via **compensating ledger entries** — original records are never altered.
- 🔜 **Planned:** a buyer-facing dispute console and a full admin dispute-resolution workflow.

### 1.7 Prohibited Conduct
No fraud, money laundering, double-counting/double-claiming of credits, circumvention of KYC/KYB, scraping/abuse, reverse engineering of security controls, or uploading false project evidence.

### 1.8 Suspension & Termination
We may suspend or terminate accounts for breach, suspected fraud, or legal requirement. Records are retained for audit and compliance.

### 1.9 Liability & Warranty (pre-production)
Carbonify is provided **"as is" and "as available," without warranties.** To the maximum extent permitted by law, Carbonify and its operators are not liable for losses arising from use of a pre-production platform, simulated credits, or sandbox transactions.

### 1.10 Changes
We may update this Agreement; material changes will be notified in-app and/or by email. Continued use after the effective date constitutes acceptance.

---

## 2. Privacy Policy

### 2.1 Data we collect
- **Account & profile:** name, email, role, organization details.
- **Identity verification:** KYC (and KYB for sellers) documents and status.
- **Transactional:** purchases, listings, wallet/payout activity, certificates, audit-log events.
- **Project & MRV:** submissions, uploaded documents, monitoring reports and evidence.
- **Technical:** authentication/session data, basic usage and device/log data.

### 2.2 How we use it
To operate accounts and roles, process verification and transactions, issue and verify certificates, maintain an audit trail, secure the platform, and meet legal/regulatory obligations.

### 2.3 Storage & security
Data is stored in **Supabase (PostgreSQL)** protected by Row-Level Security, with MFA, role-based access control, and audit logging. KYC/KYB documents are held in restricted storage. Transport is over TLS.

### 2.4 Sharing
We do not sell personal data. We share only with service providers necessary to operate (e.g., the payment gateway), or where required by law. 🔜 **Planned:** formal data-processing terms with each third-party provider.

### 2.5 Your rights (Data Privacy Act of 2012 / RA 10173)
You may request access to, correction of, or deletion of your personal data, and may withdraw consent subject to legal retention requirements.
- 🔜 **Planned (Phase 5):** self-service **consent capture, data export, and deletion tooling**, and an appointed **Data Protection Officer (DPO)**. Until then, submit requests to support@carbonify.com and they will be handled manually.

### 2.6 Retention
Financial, audit, and compliance records are retained for the period required by applicable law; other data is retained while your account is active.

---

## 3. Carbon Credits Policy

### 3.1 Definition
On Carbonify, **1 credit = 1 metric tonne CO₂e** reduced or removed.

### 3.2 Current nature of credits — important
- Credits are presently **generated and tracked within Carbonify's own MRV and issuance system** using simplified, IPCC-style emission factors.
- They are **NOT** currently:
  - registered with or retired against an external registry (Verra/VCS, Gold Standard, CAR, ACR);
  - validated by an **accredited third-party VVB** (Carbonify uses an internal verifier role);
  - based on accredited, peer-reviewed methodologies.
- **Therefore Carbonify credits are not, at this stage, recognized real-world carbon offsets** and must not be represented as such.

### 3.3 Issuance & integrity
- Credits are minted **only on verifier approval** of a monitoring report (decoupled issuance).
- Each unit carries a **unique serial number**, a **QR code, and a SHA-256 tamper-evident signature**, verifiable on a public certificate page.
- **Retirement is permanent** — retired credits cannot be traded, resold, or reused; anti-double-counting is enforced atomically.

### 3.4 Developer obligations
Developers must use the platform's approved project types and methodologies, submit required documents, and provide periodic monitoring. Non-compliance may result in delisting.

### 3.5 Fees
Platform fees are displayed at checkout. **The platform fee is currently 0** while the fee model is finalized; this may change with notice.

---

## 4. Not-Yet-Implemented — disclosures tied to the next phases

The following are **planned but not yet available.** Each creates **no service obligation** until announced as live. This list mirrors the roadmap (`IMPLEMENTATION_ROADMAP_TIMELINE.md`) and current gaps (`SYSTEM_LATEST_UPDATE.md`).

### 🔜 Phase 3 — Real Credits & Buyer Trust (next)
- Integration with a **real credit-supplier / registry API** so certificates carry a **verifiable external registry serial + retirement receipt** (this is what would make §3.2's disclaimer no longer necessary).
- A `local | supplier` source label so simulated and real credits are shown **honestly side by side**.
- Full project detail pages (methodology, map boundary, vintage, co-benefits) and **ESG / offset report export** for buyer disclosure.

### 🔜 Phase 4 — Developer ↔ Verifier Workflow
- Edit & resubmit after "needs revision," document versioning, two-way comment threads, validation checklists/rubrics, adjustable VER transparency, and a verifier task queue with SLAs.

### 🔜 Phase 5 — Admin & Compliance *(directly affects these policies)*
- **DPA tooling** (self-service consent, data export, deletion) and an appointed **DPO** — see §2.5.
- **AML** screening / transaction monitoring / velocity caps by KYC tier.
- **BIR-compliant invoices / official receipts with VAT** — see also §1.4.
- System-config UI (fees, KYC tiers), regulatory report exports, fraud/risk dashboard, dispute console, audit-log search/export.

### 🔜 Phase 6 — Buyer & LGU Experience
- Cart / multi-item checkout, watchlists & price alerts, recurring auto-offset, shareable retirement badge; LGU ESG exports and benchmarking.

### 🔜 Phase 7 — Scale, Transparency & Security
- **Public searchable registry** of all projects/credits/retirements (key transparency commitment).
- Independent **penetration test before live keys**, rate-limiting, secrets management, full RLS audit; backups/PITR and tested restores.
- **Published methodology documentation** with cited emission-factor sources.

### 🔜 Phase 8 — Mobile / PWA
- Installable PWA, mobile wallet/marketplace/certificate viewer, and push notifications.

### ⏳ Phase 9 — Institutional / Legal (gates "real" status)
- Legal entity registration; partnership with a **licensed PH payment service provider / e-money issuer** that custodies funds; carbon-supplier commercial agreement.
- **AMLA program, DPO appointment, BIR registration, formal ToS / consumer-protection / carbon-claims policy** (this document is a precursor, not a substitute).
- Accredited **VVB** model and approved, peer-reviewed methodologies.

---

## 5. Operational constraints affecting these policies (internal note)

> This section is for the Carbonify team, not end users. Remove before publishing the public-facing version.

- These policies **cannot be presented as final/binding** until: (a) the Phase 1/2 money flow is **runtime-verified in sandbox**; (b) §2.5 DPA tooling and a DPO exist; (c) a **licensed PSP/EMI** custodies funds; and (d) counsel + DPO sign off. (Constraints 1 & 5 in `SYSTEM_LATEST_UPDATE.md`.)
- The **in-app policy modal in `src/App.vue` is now inconsistent with this document** — it asserts credits meet "VCS/Verra, Gold Standard…" standards, which is **not currently true** (§3.2). It should be updated to reflect the simulated-credit disclaimer, or it risks being a material misrepresentation. The three footer links (Terms / Privacy / Carbon Credits) currently open the same single modal and should be split to mirror §§1–3.
- Keep §3.2 and §3.5 (fee = 0) and §0 in sync with the build as Phase 3 lands and the fee model is set.

---

*This document supersedes the inline policy text where they conflict, except that the Platform Status Notice (§0) controls during pre-production. It is a working draft pending legal and DPO review.*
