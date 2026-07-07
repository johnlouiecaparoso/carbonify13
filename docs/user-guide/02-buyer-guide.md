# Buyer Guide

*How to browse, buy, retire, and report on carbon credits in Carbonify. This guide is for **Buyers/Investors** and **General Users**.*

Related: [User Guide index](README.md) · [Getting Started](01-getting-started.md)

> **Prerequisites for buying:** a signed-in account **and KYC Level 1 (Basic) or higher**. Browsing is open to everyone, but completing a purchase requires identity verification — see [The KYC gate](#the-kyc-gate-before-buying).

---

## 1. Browse the marketplace

**Where:** **`/marketplace`** (top nav → **Marketplace**). Page heading: **"Carbon Credit Marketplace"**.

Use the controls in the header to narrow results:

| Control | Options |
|---------|---------|
| **Search** | Type in the **Search projects** box. |
| **Category** | **All Categories** plus the project categories available. |
| **Credit source** | **All Sources**, **Local**, **Registry** (registry-backed / supplier credits). |
| **SDG** | **All SDGs** plus individual UN Sustainable Development Goal tags. |
| **Availability** | **All Availability**, **Available**, **Not Available**. |
| **Sort** | **Name (A-Z)**, **Cheapest to Expensive**, **Expensive to Cheapest**. |

Extras:
- **Save search** — saves your current filters and gives you a bell alert when a new matching listing appears. Saved searches show as chips under **Saved searches**; click one to re-apply it, or delete it.
- **Grid / List** toggle changes the results layout. The count reads **"Showing N credit listings"**.

**Each project card** shows a source badge (**Registry** or **Local**), score badges (Feasibility, Impact, risk rating), and how many **credits left** (or **Not available** if sold out). Card buttons:
- **Purchase** — opens the purchase dialog (see [Section 4](#4-buy-credits)).
- **Add to cart** (the cart icon; toggles to **In cart**) — see [Section 5](#5-use-the-cart-for-multiple-items).
- **View project details →** — opens the project page.

## 2. The project map

**Where:** **`/map`** (top nav → **Project Map**). **Prerequisite:** signed in.

The map is a full **Leaflet** map of projects. Individual **project detail pages** also include a **Location** map when the project has coordinates.

## 3. Open a project's detail page

**Where:** **`/projects/{id}`** — reached via **View project details →** on a marketplace card.

The detail page is **informational**. It shows:
- **Verification** — status (Validated / Under review / Needs revision / Rejected), standard, vintage, credit source, additionality, permanence, reversal risk, and verifier notes.
- **Project Details**, **Expected Impact**, **Co-benefits & SDGs**, and **Documents**.
- **Developer**, **Timeline & Location**, a **Location** map, and **Available Listings** (each showing `₱ price/credit · quantity available`).

> To actually buy, use **Purchase** on the marketplace card or the **Cart** — the detail page itself has no buy button. It links back with **Go to marketplace →**.

## The KYC gate before buying

Buying is gated on identity verification. You must reach **KYC Level 1 (Basic)**. If you try to complete a purchase before you're verified, checkout stops with:

> *"KYC verification required before trading. Please complete identity verification on the KYC page."*

Complete verification at **`/kyc`** first (see [Getting Started → KYC](01-getting-started.md#6-complete-identity-verification-kyc)). This gate is enforced on the server, so it can't be bypassed.

## 4. Buy credits

**Prerequisites:** signed in + KYC Level 1.

1. On the marketplace, click **Purchase** on a project card. The **"Purchase Carbon Credits"** dialog opens.
2. Enter the **Quantity (credits)** — the help text shows how many are **Available**.
3. Review the summary: **Price per credit**, **Quantity**, and **Total**.
4. Choose a **Payment Method**:
   - **Wallet Balance** — pays instantly from your Carbonify wallet. Your balance is shown; if it's less than the total you'll see **Insufficient funds** (top up first — see [Section 6](#6-top-up-your-wallet)).
   - **Credit/Debit Card**
   - **GCash**
5. Click **Complete Purchase**.
   - **Wallet** payments settle immediately.
   - **Card / GCash** redirect you to the **PayMongo** checkout page to finish paying. On PayMongo you can also pay by **Maya**. Sandbox test card: **4343 4343 4343 4345**.
6. On success you'll see **"Purchase Successful!"**, and the credits appear in your [portfolio](#7-view-your-portfolio).

> Payments are settled server-side after PayMongo confirms them, so your balance and portfolio update once the payment is verified.

## 5. Use the cart for multiple items

**Where:** **`/cart`** (profile menu → **Shopping → Cart**). Page heading: **"Your Cart"**.

1. Add items with the cart icon on marketplace cards.
2. Open the cart. Adjust quantities with the **−/+** stepper, or **Remove** an item. The **Order Summary** shows **Items** and **Subtotal**.
3. Click **Proceed to checkout**.
4. **Checkout is sequential** — you pay for **one item at a time** on PayMongo, then you're returned to the cart to continue with the next. A banner reads *"Checkout continues one item at a time — N item(s) left to pay for."*
5. Use **Clear cart** to empty it.

> With the cart, you choose your payment method on the PayMongo checkout page (card, GCash, or Maya).

## 6. Top up your wallet

**Where:** **`/wallet`** (profile menu → **Account → Wallet**). Page heading: **"My Wallet"**.
**Prerequisite:** signed in. *(Wallet is a buyer feature — Administrators, Verifiers, and Project Developers can't access it.)*

The **Wallet Balance** card shows your balance in PHP. Buttons: **+ Top Up** and **− Withdraw** (Withdraw is disabled at ₱0).

To top up:
1. Click **+ Top Up**. The **"Top Up Wallet"** dialog opens.
2. Pick a **Quick Amount** (₱100, ₱500, ₱1,000, ₱2,000, ₱5,000) or type an **Amount** (minimum **₱10**, maximum **₱50,000**).
3. Choose a **Payment Method**: **GCash**, **Maya**, **BPI**, or **BDO**.
4. Click **Top Up ₱{amount}**. You're redirected to **PayMongo** to pay. Processing typically takes 1–3 minutes, with no top-up fees.

The **Transaction History** section lists your top-ups, withdrawals, and payments with amounts and status (completed / pending / failed). Use **Refresh** to update it.

## 7. View your portfolio

**Where:** **`/credit-portfolio`** (top nav → **Portfolio**). Page heading: **"Credit Portfolio"**.

At the top, four stat cards: **Total Credits Owned**, **Credits Retired**, **Projects Supported**, and **Portfolio Value**. Portfolio Value includes a **gain/loss** indicator — e.g. **▲ ₱amount (+%) vs market** (green) or **▼** (red) — comparing your holdings to current market prices.

**Your Credit Holdings** lists each holding with **Credits Owned**, **Status** (Active / Retired), and **Purchase Date**. Per-holding actions:
- **Retire Credits** → takes you to the retire page.
- **Manage in Wallet** → opens your wallet.

Further down, **insights** show **Category Allocation**, **Geographic Spread**, and **Retirement Progress**.

### Export an ESG / offset report

In the portfolio header:
- **ESG report (PDF)** — downloads your offset/ESG report as a PDF.
- **CSV** — downloads the same report as a spreadsheet.

Both show **"Preparing…"** while generating and then download automatically.

## 8. Retire credits and get a certificate

**Where:** **`/retire`** (top nav → **Retire Credits**). Page heading: **"Retire Carbon Credits"**.

Retiring permanently removes credits from circulation to offset emissions, and issues you a **retirement certificate**.

1. In the **Retire Credits** card, choose a project under **Select Project** (each option shows how many credits you have available).
2. Enter **Credits to Retire** (1 up to your available amount).
3. Pick a **Retirement Purpose**: **Corporate Carbon Neutrality**, **Event Offset**, **Product Carbon Footprint**, **Personal Carbon Footprint**, or **Other**.
4. Optionally add a **Retirement Statement**.
5. Check the **Retirement Summary** (credits, project, purpose), then click **Retire {N} Credits**.
6. You'll see a success message, and a certificate is issued for the retirement.

**Transaction History** (right side) has two tabs — **Purchases** and **Retirements** — each item with a **View Certificate** button. If a past purchase is missing its certificate, use **Generate Missing Certificates**.

> If you have no credits yet, this page shows *"No credits available for retirement. Purchase some credits first!"*

## 9. View and download certificates

**Where:** **`/certificates`** (profile menu → **Records → Certificates**). Page heading: **"My Certificates"**.
*(Certificates is a buyer feature; finance-restricted roles can't access it.)*

Select a certificate from the list to see its details: beneficiary, project, tonnes of CO₂ retired, purpose, transaction ID, on-chain verification, serial, vintage year, standard, and status.

Per-certificate actions:
- **Download PDF** — generates the certificate PDF (if PDF generation isn't available it falls back to a text file).
- **Download Receipt** — downloads the matching purchase receipt.
- **Verify** — opens the public verification page (`/verify/{number}`) in a new tab.

## 10. View receipts

**Where:** **`/receipts`** (profile menu → **Records → Receipts**). Page heading: **"My Receipts"**.
*(Receipts is a buyer feature; finance-restricted roles can't access it.)*

Each receipt card shows the transaction ID, project location, credits purchased, total amount, payment method, and status. Actions:
- **Download PDF**
- **VAT Invoice** — generates and downloads a VAT invoice.
- **View Details** — opens a modal with the full purchase and project breakdown.

## 11. Watchlist (saved listings)

**Where:** **`/watchlist`** (profile menu → **Shopping → Saved**). Page heading: **"My Watchlist"**.

This page lists listings you've saved. Each card shows the image, location, price, and how many credits are left, with:
- **Details** → the project page.
- **Buy on marketplace** → the marketplace.
- **Remove from watchlist** (the X).

If a saved listing is gone, the card says *"This listing is no longer available."*

> **Price alerts:** these are set on the **Marketplace** via **Save search** (it sends a bell alert when a new matching listing appears), not on the watchlist page.

## 12. Carbon footprint calculator

**Where:** **`/carbon-calculator`** (top nav → **Carbon Calculator**). Page heading: **"Carbon Credit Calculator"**.
*(A buyer feature; finance-restricted roles can't access it.)*

Estimate your annual emissions, then see how many credits offset them.

1. Under **Your activity (per year)**, enter:
   - **Electricity consumption** (kWh/year)
   - **Fuel consumption** (liters/year) and fuel type — **Diesel**, **Gasoline**, or **LPG**
   - **Waste generated** (tonnes/year)
   - **Other emissions** (optional, tonnes CO₂e/year)
2. **Results** show a breakdown by source, your **Total emissions (CO₂e)**, and **Credits to buy** (1 credit ≈ 1 tonne CO₂e).
3. Click **Buy {N} credits in Marketplace** to jump to the marketplace, or **Reset** to start over.

## 13. Verify any certificate (public)

**Where:** **`/verify/{certificateNumber}`** — this is the target of the QR code printed on Carbonify certificates. **No sign-in required.**

1. Enter a **Certificate Number** (e.g. `CERT-1700000000000-ABC123XYZ`) and click **Verify** — or simply **scan the QR code** on a certificate.
2. If found, the page shows an authenticity banner (**Authentic certificate**) plus the certificate details: number, type, beneficiary, project, category, location, carbon credits (tonnes CO₂), vintage year, standard, issue date, registry serial, retirement receipt link, and digital signature.
3. A **QR code** captioned **"Scan to re-verify"** lets anyone re-check it.

If the number doesn't match, you'll see *"No matching certificate — We couldn't find an active certificate with that number."*

---

Need something else? Head back to the **[User Guide index](README.md)**.
