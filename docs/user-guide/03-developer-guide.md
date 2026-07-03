# Project Developer Guide

Everything a Project Developer needs to list a climate project on Carbonify: applying for the role, submitting a project, tracking it through review, filing MRV monitoring reports, and getting paid.

> New to Carbonify? Start with [Getting Started](01-getting-started.md). Buyers should read the [Buyer Guide](02-buyer-guide.md). Verifiers should read the [Verifier Guide](04-verifier-guide.md). Admin tasks are in the [Admin Guide](05-admin-guide.md).

---

## What a Project Developer can do

Once your Project Developer role is approved, you unlock these pages (all require you to be logged in as a Project Developer):

| Page | Route | What it's for |
| --- | --- | --- |
| Submit a Project | `/submit-project` | Create and submit a new project for verification |
| My Project Submissions | `/developer/projects` | Track status, respond to verifiers, edit and resubmit |
| Monitoring Reports (MRV) | `/monitoring` | File periodic monitoring data on validated projects |
| Seller Earnings | `/sales` | See sales, balance, KYB status, and request withdrawals (available to all logged-in users) |
| Apply | `/apply` | Apply for a role (open to everyone) |

---

## 1. Apply to become a Project Developer

**Prerequisites:** none — you can even apply before creating an account.

1. Go to **`/apply`**.
2. Under **Choose your role focus**, click the **Project Developer** card (it shows a "Selected" badge when active).
3. Fill in the application form. Required fields:
   - **Full name** and **Contact email**.
   - **Account password** and **Confirm password** — these appear only if you are not already logged in, so your account can be created with the application.
   - **Company name**
   - **Business registration number** (digits only)
   - **Country** and **Business address**
   - **Contact person** name, email, and phone (phone is digits only)
   - **Certificate of Registration** (SEC/DTI, etc.)
   - **Articles of Incorporation / Business Permit**
   - **Tax Identification Number (TIN)** (digits only)
   - **Proof of legal existence**
   - **Company background / overview** (at least 20 characters)
   - **Years of operation** (digits only)
   - **Past or ongoing environmental projects** (at least 20 characters)
   - **Portfolio** (e.g., renewable energy, forestry, waste management)
4. Click **Submit application**. You'll see an "Application received" confirmation, and the Carbonify review team follows up by email at the address you provided.

> If you already have a pending application, the form tells you it's still under review rather than creating a duplicate.

Once approved, your account is switched to the Project Developer role and the developer pages above become available.

---

## 2. Submit a project

**Prerequisites:** logged in as a Project Developer.

Open **`/submit-project`**. The page shows the project form on the left and a Submission Guidelines / MRV Process sidebar on the right. Fields marked with `*` are required.

### Project details

- **Project Title*** — 3–100 characters (a live counter shows your length).
- **Project Image** (optional) — click the upload box or drag in a JPEG, PNG, or WebP up to 5 MB.
- **Project Type*** — pick one Philippine-eligible category from the dropdown. The choices are:
  - Biochar & Bio-briquettes
  - Biomass-to-Energy (WTE)
  - Reforestation & Agroforestry
  - Renewable Energy
  - Methane Avoidance
  - Industrial Decarbonization
  - Coastal & Watershed Protection
- **Project Location*** — free text in the form `City, Province, Country`.
- **Project Description*** — 10–1,000 characters.
- **Expected Impact*** — 10–500 characters; describe measurable outcomes where you can.

### Tag UN Sustainable Development Goals (SDGs)

Under **UN Sustainable Development Goals (SDGs)**, click the SDG chips your project contributes to. Selected chips turn green; click again to deselect. Buyers can filter the marketplace by these tags, so choose accurately.

### Draw the location pin and boundary on the map

In **Project Location Details**:

1. Enter **Geo-coordinates (lat,lon)*** manually (e.g. `14.5995,120.9842`), **or**
2. Use the map picker below the field:
   - **Click the map** to drop the location pin — this fills in the coordinates automatically.
   - **Draw the project boundary** as a polygon to outline the project area. The boundary is optional but strengthens your submission.
3. Enter **Barangay***, **Municipality / City***, **Start Date***, **End Date***, and **Host Entity*** (LGU / Private / Coop).

### Upload the required compliance documents

The **Required Technical & Compliance Documents** section shows one card per document. Tap a card to attach a PDF; a green check mark and the file name confirm it's attached. Nine documents are required (marked `*`) plus one optional Feasibility Study:

| Document | Required | What it is |
| --- | --- | --- |
| **PDD** | Yes | Project Design Document — the full blueprint: what the project does, where, the methodology, and how carbon savings are measured |
| **Baseline Report** | Yes | The emissions that would happen *without* your project — the comparison point for your savings |
| **Additionality Justification** | Yes | Why the project genuinely needs carbon finance and wouldn't have happened on its own |
| **Leakage Assessment** | Yes | Whether the project merely shifts emissions elsewhere instead of truly reducing them |
| **Safeguards Checklist** | Yes | Confirms no social or environmental harm to the community or surroundings |
| **LGU Endorsement** | Yes | Official letter of support from your Local Government Unit |
| **Land Ownership / Lease** | Yes | Proof you own or legally lease the land (title, tax declaration, or lease contract) |
| **ECC / Permits** | Yes | Environmental Compliance Certificate and any other operating permits |
| **MOA / Agreements** | Yes | Signed Memorandum of Agreement with partners, landowners, or the community |
| **Feasibility Study** | Optional | Technical/financial study showing the project is realistic and viable |

Each card accepts a single PDF (up to 10 MB).

### Credit information

- **Estimated Credits*** — the number of carbon credits you expect the project to generate (1 to 1,000,000).
- **Price per Credit** — **you do not set this.** The price per credit is set by the verifier after they review and validate your project.

### Optional: credibility and extra documents

- **Credibility** (optional) — Additionality basis, Permanence (years), and Reversal risk. These are shown on the public project page to help buyers trust the credits.
- **Project Documents** (optional) — an extra drag-and-drop area for supporting files (PDF, DOC, DOCX, JPEG, PNG up to 10 MB each, max 5 files).

### Submit

Click **Create Project**. On success you'll see a **Project Submitted Successfully!** card explaining what happens next:

1. **Initial Screening** — completeness and MRV readiness check.
2. **MRV Review** — a verifier reviews monitoring data, baseline, and methodology.
3. **Validation & Issuance** — validated projects move to the active pool and can issue credits.

From that card you can browse the marketplace, go to your dashboard, or submit another project. Your project now has the status **Submitted**.

---

## 3. Track your projects

**Prerequisites:** logged in as a Project Developer.

Open **`/developer/projects`** ("My Project Submissions"). At the top, summary cards show counts for **Total**, **Pending**, **Needs Revision**, **Approved**, and **Rejected**, and status tabs let you filter the list. Use **Submit New Project** to jump back to the submission form.

Each project card shows a progress tracker, description, submission/review dates, the current status badge, and the two-way conversation thread with your verifier.

### Status meanings

| Status shown | Underlying state | What it means |
| --- | --- | --- |
| **Pending** | draft / submitted | Waiting for a verifier to pick it up |
| **Under Review** | in review | A verifier has started the MRV review |
| **Needs Revision** | needs_revision | The verifier asked for changes before they can validate |
| **Approved** | validated | Passed validation; eligible to issue credits via MRV |
| **Rejected** | rejected | Declined; the rejection reason is shown on the card |

### Responding to a verifier and resubmitting after "Needs Revision"

When a project is **Needs Revision**:

1. Read the **Revisions Requested** note on the card and the verifier's message in the conversation thread. You can reply in the thread to ask questions or clarify — the thread persists across the whole revise-and-resubmit cycle.
2. Click **Edit details** to reopen the submission form (it loads your existing project), make the requested changes, and save. Saving an edit returns you to the dashboard.
3. Back on the dashboard, click **Resubmit for review** to send it back to the verifier.
4. You can also **Delete** a submission you no longer want.

> Projects that are still Pending (or in Draft) can also be edited or deleted directly from their card. Once a project is Validated or Rejected, it's locked from developer edits.

---

## 4. File MRV monitoring reports

**Prerequisites:** logged in as a Project Developer with at least one **Validated** project.

Monitoring (MRV = Monitoring, Reporting, Verification) is how a validated project turns real-world activity into issued carbon credits. Open **`/monitoring`** ("Monitoring Reports (MRV)").

### Reporting reminders

If a report is due or overdue, a **Monitoring due** reminders card appears at the top listing each project, how many days until (or past) its due date, and whether a report has ever been filed. Click **Start report** to jump straight into a new report for that project. Overdue items also raise a bell notification.

### Create and submit a report

1. Under **Validated Project**, pick the project to report on. (If you have none, you'll see a note that projects must be validated first.)
2. Click **+ New** to create a report, or open an existing one from the Reports list.
3. Fill in the report:
   - **Period Type** (e.g. yearly), **Period Start**, and **Period End**.
   - **Activity Data** — enter values for the metrics defined for your project type (each with its unit).
   - **Evidence** — attach photos or logs (JPEG/PNG/PDF up to 2 MB each). Remove any with the × button.
   - **Notes** — context for the verifier.
4. Click **Save & Calculate**. The platform computes **Proposed Emission Reductions** (in tCO₂e) from your activity data using the project's methodology.
5. Click **Submit for Verification**. Confirm when prompted — **once submitted, the report is locked and can't be edited.**

Reports you can still edit are in **draft** or **needs_revision** status; submitted/approved reports are read-only. If a verifier leaves **Verifier notes**, they appear on the report.

---

## 5. How credits get issued

You never mint credits yourself. The flow is:

1. A verifier **validates** your project (and sets the price per credit at that point).
2. You file an **MRV monitoring report** and submit it for verification.
3. A verifier reviews the report and **approves the VER** (Verified Emission Reduction). Approving the report **mints the carbon credits** and **publishes a listing** on the marketplace at the verifier-set price.

The proposed reductions you calculate are a starting point — the verifier confirms the final approved quantity.

---

## 6. Seller earnings

**Prerequisites:** logged in (this page, `/sales`, is open to any logged-in user).

Open **`/sales`** ("Seller Earnings"). At the top, three balance cards show:

- **Available to withdraw** — cleared funds you can cash out (with the **Withdraw** button).
- **Held in escrow** — funds still within the hold period; released later.
- **Total earned** — lifetime completed earnings, plus your total credits sold.

Below that:

- **Earnings by project** — a per-project breakdown: number of sales, credits sold, gross earnings, and last sale date.
- **Recent sales** — each sale's date, credits, unit price, total, and status.
- **Withdrawals** — your payout history, with amount, status, and any failure note.

---

## 7. Unlock payouts with KYB (business verification)

**Prerequisites:** logged in on `/sales`.

Before you can withdraw, you must complete **KYB (Know Your Business)** verification. If you haven't, a yellow **Business verification required** banner appears and the **Withdraw** button stays disabled.

1. On `/sales`, click **Verify your business** (or **Resubmit verification** if a previous attempt was rejected).
2. Fill in the KYB form:
   - **Business name** (required)
   - Business type (Sole Proprietorship / Partnership / Corporation / Cooperative)
   - Registration no. (SEC / DTI / CDA)
   - Tax ID (BIR TIN)
   - Business address
   - Authorized representative
   - Registration document URL and Tax document URL
   - (Only business name is strictly required, but the other fields speed up review.)
3. Click **Submit for review**. An admin reviews your submission; the banner shows **pending review** while it's being processed, and any rejection note if it's declined.

Once an admin approves your KYB, your account is flagged verified and the **Withdraw** button unlocks.

---

## 8. Request a payout (withdrawal)

**Prerequisites:** KYB verified, and an available balance greater than zero.

1. On `/sales`, click **Withdraw** to open the withdrawal form. It shows your available balance and optional **Quick Amount** buttons (including **All**).
2. Enter the **Withdrawal Amount** — minimum **₱100**, maximum **₱25,000**, and not more than your available balance.
3. Choose where to send it — **GCash**, **Maya**, **BPI**, or **BDO**.
4. Enter the **Account Name** and **Account / Mobile Number** for the destination.
5. Click **Withdraw**. 

Withdrawal terms shown on the form:

- Minimum ₱100, maximum ₱25,000
- Processing time 1–2 business days
- A ₱25 withdrawal fee is deducted from the amount

Your new payout appears in the **Withdrawals** table on `/sales` with its status.

---

## 9. Managing your listings

When credits are minted (on VER approval), a listing is published to the marketplace at the price the verifier set. On your listings you can:

- **Pause** a listing — hides it from the marketplace without cancelling it.
- **Relist** (reactivate) a paused listing.
- **Edit the price per credit** — the new price must be greater than zero.
- **Cancel** a listing you no longer want to sell.

A listing's status is one of **active**, **paused**, **sold**, or **cancelled**.

> **Free-plan limit:** free accounts can keep only a limited number of **active** listings at once. If you hit the cap, the platform tells you your current count and prompts you to **upgrade to Pro** for unlimited listings.

---

## Quick reference

- Apply for the role: **`/apply`** → Project Developer card
- Submit a project: **`/submit-project`** (9 required compliance docs; verifier sets the price)
- Track / revise / resubmit: **`/developer/projects`**
- File monitoring reports: **`/monitoring`** (validated projects only)
- Earnings, KYB, withdrawals: **`/sales`**

Related guides: [Getting Started](01-getting-started.md) · [Buyer Guide](02-buyer-guide.md) · [Verifier Guide](04-verifier-guide.md) · [Admin Guide](05-admin-guide.md)
