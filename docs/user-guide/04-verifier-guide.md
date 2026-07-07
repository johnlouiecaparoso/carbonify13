# Verifier Guide

How to review projects, score the validation rubric, set the credit price, approve MRV reports (which mint credits), and review Project Developer applications from the Verifier Panel.

> Related guides: [Getting Started](01-getting-started.md) · [Buyer Guide](02-buyer-guide.md) · [Project Developer Guide](03-developer-guide.md) · [Admin Guide](05-admin-guide.md)

---

## Accessing the Verifier Panel

**Prerequisites:** logged in with the **Verifier** role.

Go to **`/verifier`**. The panel checks your access:

- If you're not signed in, you're asked to log in.
- If your account doesn't have verifier access, you'll see an "Access Denied" message — contact an administrator if that's unexpected.

With verifier access, the panel loads three stacked sections:

1. **Project Management Panel** — review and decide on submitted projects.
2. **MRV Report Verification** — review monitoring reports and issue credits.
3. **Project Developer Applicants** — review people applying to become developers.

---

## 1. The review queue (Project Management Panel)

The panel opens on the project queue. Filter tabs across the top group projects by status, each with a live count:

**All Projects · Submitted · In Review · Needs Revision · Validated · Rejected**

The left column lists projects; click one to open its full details on the right. Each queue item can carry badges:

- A **status badge** (Submitted, In Review, Needs Revision, Validated, Rejected).
- A **revision badge** (`↻ rev N`) when a project was resubmitted after a revision request.
- An **SLA / aging badge** (`Nd · overdue`) when a project has been waiting longer than the review SLA (5 days by default). The detail view also shows how many days ago it was submitted and flags overdue items.

Use the SLA and revision badges to prioritize — overdue and resubmitted projects should be looked at first.

---

## 2. Reviewing a project

Select a project to open the detail pane. From top to bottom you'll see:

- **Header** — title, current status, and a "Resubmitted · rev N" badge if applicable.
- **Meta** — category, location, submission date and age (with an overdue flag if past SLA).
- **Expected Impact** and **Description**.
- **Submitted Media & Documents** — the project image and a list of the developer's attached documents (each opens in a new tab).
- **Rejection Notes** — shown if the project was previously rejected.

Below the details sit the assessment tools, the price field, the decision buttons, and the comment thread.

### Risk & feasibility scoring

The **Risk & Feasibility Assessment** panel captures optional scores that are shown to buyers to convey project quality:

- **Feasibility (1–5)**
- **Social impact (1–5)**
- **Climate risk** (Low / Medium / High)

Set the values and click **Save Assessment**. These can be saved independently of your final decision.

### The scored validation rubric

The **Validation Rubric** is the structured checklist to work through before validating. It's grouped into three sections:

| Section | Items |
| --- | --- |
| **Documentation** | Required documents attached & legible (required); Baseline & methodology clearly described (required) |
| **Eligibility** | Additionality demonstrated (required); No double-counting (required); Location & ownership/host consent verified |
| **MRV** | Monitoring plan with measurable metrics (required); Emission factors/calculations appropriate (required); Supporting data sufficient & credible |

For each item, choose a level — **Inadequate**, **Adequate**, or **Strong** — and optionally add a note. Levels map to weighted points:

- **Inadequate = 0**, **Adequate = 1**, **Strong = 2**, multiplied by each item's weight.

The rubric header shows:

- **Required progress** (`done/total required`) — how many required items reach at least "Adequate".
- An **overall weighted score** as a percentage, with a band:
  - **Strong** — 80% or higher
  - **Adequate** — 55%–79%
  - **Weak** — below 55%
  - **Not scored** — nothing scored yet

Click **Save rubric** to store your scores and notes. The rubric is a decision aid — it guides, but you still choose the final action.

### Set the credit price at validation

**Developers do not set the credit price — you do.** For a project that is Submitted, Pending, or In Review, a **Price per Credit** field appears (in PHP, ₱). Enter the price buyers will pay per carbon credit. It is **saved when you click Validate**. If you leave it blank, the project falls back to the category default price.

---

## 3. Making a decision

The action buttons available depend on the project's current status:

| Action | When it's available | Effect |
| --- | --- | --- |
| **Start MRV Review** | Submitted / Pending | Moves the project to **In Review** |
| **Validate Project** | Submitted / Pending / In Review | Marks it **Validated** and saves your price per credit; the project becomes eligible to file MRV reports |
| **Request Revision** | Submitted / Pending / In Review | Sends it back as **Needs Revision** with your notes |
| **Reject Project** | Submitted / Pending / In Review | Marks it **Rejected** with your notes |
| **Re-review** | Validated / Needs Revision / Rejected / Approved | Reopens it into **In Review** |
| **Delete Project** | Admin/verifier | Permanently deletes the project (verifiers cannot delete a *validated* project — only an admin can, because it may have issued credits) |

**Validating a project does not itself mint credits.** It confirms the project is sound and locks in the price. Credits are only minted later when you approve an MRV report (see section 4).

### Requesting revision vs. rejecting

- **Request Revision** and **Reject** both open a dialog that requires a note (at least 5 characters):
  - For a revision, describe exactly what the developer must change before resubmitting.
  - For a rejection, explain why it's declined and what should improve.
- A revision note is also mirrored into the project's comment thread so the developer can reply and the exchange stays in one place.

### The two-way comment thread with the developer

Every project detail includes a **comment thread** shared with the developer. As a verifier you have an **internal** notes option in addition to messages the developer sees. Use it to ask for clarifications, record context, and carry the conversation through the Needs Revision → resubmit → re-review cycle.

---

## 4. Reviewing MRV reports and approving VERs

Scroll to the **MRV Report Verification** section (or use **Refresh** to reload it). This is where approving a report **mints carbon credits**.

The left **queue** lists monitoring reports awaiting verification (project title, category, period, and status). Click one to open it. The detail view shows:

- **Activity Data** — the metrics, values, and units the developer submitted.
- **Evidence** — photos and logs (each opens in a new tab).
- **Developer notes**.
- **Platform-calculated reductions** — the system's tCO₂e figure from the activity data.

### Decision fields and actions

- **Approved credits (tCO₂e)** — defaults to the platform calculation; adjust it if your review differs.
- **Vintage year** — defaults to the current year.
- **Notes** — verification notes or the rejection reason.

Then choose an action:

- **Start Review** — (for a report still in "submitted") marks it under review.
- **Reject** — declines the report with your notes.
- **Approve & Issue Credits** — confirms the report. This **issues the carbon credits to the project and lists them on the marketplace** (at the price set when the project was validated). You're asked to confirm because it can't be undone.

> This is the single point where credits are minted: a verifier approving a VER (Verified Emission Reduction) on an MRV report.

---

## 5. Reviewing Project Developer applications

Verifiers **can** review role applications. The **Project Developer Applicants** section lists people applying for the Project Developer role.

1. Use the **status filter** (All / Pending / Under Review / Approved / Rejected) and **Refresh** to load applications. A **Pending** counter is shown in the header.
2. The table shows submission date, applicant, email, company, and status. Click **View** to open the detail drawer.
3. The drawer shows the applicant's contact details and their **Project Developer Details** (business registration, country, address, contact person, TIN, company background, years of operation, portfolio), plus a notes field.
4. Decide using the footer buttons:
   - **Mark Under Review**
   - **Reject** — requires a reason (at least 5 characters) in the notes field.
   - **Approve & Assign Role** — approves the applicant and assigns them the Project Developer role.

---

## Quick reference

- Access: **`/verifier`** (Verifier role required)
- Review & decide on projects: **Project Management Panel** — score the rubric, set the ₱ price, then Validate / Request Revision / Reject
- Bands: Strong ≥ 80% · Adequate 55–79% · Weak < 55%
- Issue credits: **MRV Report Verification** → **Approve & Issue Credits**
- Review developer applicants: **Project Developer Applicants** → **Approve & Assign Role**

Related guides: [Getting Started](01-getting-started.md) · [Buyer Guide](02-buyer-guide.md) · [Project Developer Guide](03-developer-guide.md) · [Admin Guide](05-admin-guide.md)
