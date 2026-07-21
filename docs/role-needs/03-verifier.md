# If I am a Verifier — What I Need from Carbonify

**Who I am:** A 3rd‑party or CSU/DENR technical reviewer who validates projects and verifies annual monitoring reports, approving or rejecting Verified Emission Reductions (VERs). My success = I can review thoroughly, consistently, and defensibly, and my decisions are auditable.

---

> **Reconciled 2026-07-22.** Statuses re-checked against the code. Items 1 and 3
> were marked ❌ but had already shipped; the SLA half of #5 had too. #2 and #11
> are now closed, and #6 gained a real control. The queue also had a bug that made
> the **Submitted** tab hide every first-time submission — fixed, see below.

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
| 1 | "Give me a **standardized review checklist/rubric**, not just a free‑text note." | ✅ | Consistent, defensible decisions across reviewers. | Shipped: weighted rubric with required items (`constants/verificationChecklist.js`, `ValidationChecklist.vue`), stored per project in `verification_assessments`, and validating with an incomplete rubric warns first. | — | — |
| 2 | "Show me **how the platform calculated** the emission reductions, and let me **adjust** before approving." | ✅ | I'm accountable for the issued amount. | Shipped: per‑metric breakdown (value × factor = tCO₂e) reproducing `calculate_report_vers()`, metrics with no factor flagged as contributing nothing, and an adjustment away from the calculated figure now requires a note. | — | — |
| 3 | "Let me **request a specific document or clarification** and track the response." | ✅ | Verification is iterative. | Shipped: `ProjectCommentThread` on each project, with a verifier‑only internal‑note toggle enforced by RLS. | — | — |
| 4 | "Show me a **per‑project verification timeline** (every action, who, when)." | 🟡 (audit exists, not surfaced) | I need the full history at a glance. | Build a **verification history/timeline view** per project. | 🟠 | S |
| 5 | "Manage my **queue**: assign projects to verifiers, see workload, filter/search, and **aging/SLA**." | 🟡 | Throughput + accountability. | Aging/SLA **shipped** (overdue badges, admin‑configurable `verification_sla_days`). Still missing: **assignment UI** and **search**. | 🟠 | M |
| 6 | "Support **independent third‑party VVB access levels** (granular permissions, independence)." | 🟡 | Real markets require accredited, independent verifiers. | Independence **shipped**: nobody can validate a project they own or approve VERs against it, enforced by DB triggers (20260722000100). Still missing: **granular per‑VVB permissions** and accreditation records. | 🟠 | M |
| 7 | "Let me **bulk‑act** and **search** across many submissions." | ❌ | Scale — I can't click one by one. | Add **bulk actions + global search/filters**. | 🟢 | S |
| 8 | "Validate **evidence integrity** — geotag/timestamp on photos, flag duplicates." | ❌ | Fraud prevention is my job. | Add **evidence metadata checks** (EXIF geotag/time, duplicate detection). | 🟠 | M |
| 9 | "Export a **verification report** for audit/regulators." | ❌ | DENR/CCC + my own records. | Add **verification report export** (PDF/CSV). | 🟠 | S |
| 10 | "Let me verify **in the field on mobile**." | 🟡 | Site visits happen off‑desk. | Mobile‑optimized review (or PWA) + field capture. | 🟢 | M |
| 11 | "Reference the **approved methodology** while reviewing." | ✅ | I check activity data against the method. | Shipped: the emission factor applied to each metric is shown inline in the review breakdown, read from `methodology_factors` — the same table the server‑side calculation joins against. | — | — |

---

## 🎯 Top 3 to build next (2026-07-22)

The original top 3 (rubric, calculation transparency, two‑way thread) have all
shipped. What's left, in order:

1. **Queue assignment + search** (#5, #7) — aging/SLA exists, but there is no way
   to assign a project to a named verifier, and no search at all. This is the
   throughput blocker once the queue is longer than one screen.
2. **Per‑project verification timeline** (#4) — the audit rows already exist and
   are written on every decision; nothing surfaces them per project.
3. **Verification report export** (#9) — DENR/CCC and the verifier's own records.

Also worth noting: the verifier panel renders all three dashboards at once
(~2,750 lines of component, three independent loads, one long scroll). Splitting
it into tabs is a small change with an outsized effect on how the role feels.
