# If I am a Verifier — What I Need from Carbonify

**Who I am:** A 3rd‑party or CSU/DENR technical reviewer who validates projects and verifies annual monitoring reports, approving or rejecting Verified Emission Reductions (VERs). My success = I can review thoroughly, consistently, and defensibly, and my decisions are auditable.

---

## ✅ What I can already do today
- Access the **Verifier Panel** with role‑gated permissions.
- Review submitted projects and set status: **validate / request revision / reject / re‑review**, with notes.
- Review **MRV monitoring reports** (activity data + evidence) and **approve VERs**, which issues credits.
- Set a **risk/feasibility assessment** (feasibility, social impact, climate risk) on a project.
- Review **developer role applications**.
- Everything is recorded in **time‑stamped audit logs**.

---

## 🧩 What I still need (gaps for the developer to implement)

| # | What I want (my voice) | Status | Why it matters to me | Developer action | Priority | Effort |
|---|---|---|---|---|---|---|
| 1 | "Give me a **standardized review checklist/rubric**, not just a free‑text note." | ❌ | Consistent, defensible decisions across reviewers. | Add a **structured validation checklist** (criteria, pass/fail/score) saved per project. | 🔴 | M |
| 2 | "Show me **how the platform calculated** the emission reductions, and let me **adjust** before approving." | 🟡 | I'm accountable for the issued amount. | Surface the **calculation breakdown** (factors × activity) + allow adjustment with reason. | 🔴 | M |
| 3 | "Let me **request a specific document or clarification** and track the response." | ❌ (one‑way notes) | Verification is iterative. | Add a **two‑way comment/request thread** + document‑request flow. | 🔴 | M |
| 4 | "Show me a **per‑project verification timeline** (every action, who, when)." | 🟡 (audit exists, not surfaced) | I need the full history at a glance. | Build a **verification history/timeline view** per project. | 🟠 | S |
| 5 | "Manage my **queue**: assign projects to verifiers, see workload, filter/search, and **aging/SLA**." | 🟡 (assignment fields exist) | Throughput + accountability. | Add **assignment UI + queue filters + aging indicators**. | 🟠 | M |
| 6 | "Support **independent third‑party VVB access levels** (granular permissions, independence)." | 🟡 | Real markets require accredited, independent verifiers. | Add **granular verifier permissions** + conflict‑of‑interest/independence flags. | 🟠 | M |
| 7 | "Let me **bulk‑act** and **search** across many submissions." | ❌ | Scale — I can't click one by one. | Add **bulk actions + global search/filters**. | 🟢 | S |
| 8 | "Validate **evidence integrity** — geotag/timestamp on photos, flag duplicates." | ❌ | Fraud prevention is my job. | Add **evidence metadata checks** (EXIF geotag/time, duplicate detection). | 🟠 | M |
| 9 | "Export a **verification report** for audit/regulators." | ❌ | DENR/CCC + my own records. | Add **verification report export** (PDF/CSV). | 🟠 | S |
| 10 | "Let me verify **in the field on mobile**." | 🟡 | Site visits happen off‑desk. | Mobile‑optimized review (or PWA) + field capture. | 🟢 | M |
| 11 | "Reference the **approved methodology** while reviewing." | ❌ | I check activity data against the method. | Show **methodology reference** alongside the report. | 🟠 | S |

---

## 🎯 Top 3 to build first (biggest value for verifiers)
1. **Standardized validation checklist/rubric** (#1) — consistency + defensibility of decisions.
2. **Calculation transparency + adjustable VERs** (#2) — verifiers own the issued number, so they must see and tune it.
3. **Two‑way request/clarification thread** (#3) — turns one‑shot notes into real verification dialogue.
