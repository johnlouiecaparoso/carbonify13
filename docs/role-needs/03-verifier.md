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
| 4 | "Show me a **per‑project verification timeline** (every action, who, when)." | ✅ | I need the full history at a glance. | Shipped. Three things were wrong, not just the UI: decisions wrote **no audit rows at all**; `audit_logs` was admin‑only to read (verifiers now read project‑scoped rows only); and every resource‑scoped reader queried columns that don't exist (`entity_type`/`entity_id`/`timestamp` vs `resource_type`/`resource_id`/`created_at`). | — | — |
| 5 | "Manage my **queue**: assign projects to verifiers, see workload, filter/search, and **aging/SLA**." | ✅ | Throughput + accountability. | Shipped: aging/SLA badges, `assigned_verifier_id` + assignment picker + "Take it", "Assigned to me (N)" toggle, and free‑text search over title/category/location/id. (The doc's claim that "assignment fields exist" was wrong — `verified_by` records who *decided*, after the fact.) | — | — |
| 6 | "Support **independent third‑party VVB access levels** (granular permissions, independence)." | 🟡 | Real markets require accredited, independent verifiers. | Independence **shipped**: nobody can validate a project they own or approve VERs against it, enforced by DB triggers (20260722000100). Still missing: **granular per‑VVB permissions** and accreditation records. | 🟠 | M |
| 7 | "Let me **bulk‑act** and **search** across many submissions." | 🟡 | Scale — I can't click one by one. | **Search shipped** (see #5). Still missing: **bulk actions** across many submissions. | 🟢 | S |
| 8 | "Validate **evidence integrity** — geotag/timestamp on photos, flag duplicates." | ❌ | Fraud prevention is my job. | Add **evidence metadata checks** (EXIF geotag/time, duplicate detection). | 🟠 | M |
| 9 | "Export a **verification report** for audit/regulators." | ✅ | DENR/CCC + my own records. | Shipped: PDF + CSV per project, carrying the decision, the full rubric (unassessed items reported as such, never as a zero) and the verification timeline. | — | — |
| 10 | "Let me verify **in the field on mobile**." | 🟡 | Site visits happen off‑desk. | Mobile‑optimized review (or PWA) + field capture. | 🟢 | M |
| 11 | "Reference the **approved methodology** while reviewing." | ✅ | I check activity data against the method. | Shipped: the emission factor applied to each metric is shown inline in the review breakdown, read from `methodology_factors` — the same table the server‑side calculation joins against. | — | — |

---

## 🎯 Top 3 to build next (2026-07-22)

Everything in the original top 3 has shipped, as has the queue work, the
timeline and report export. What's left, in order:

1. **Evidence integrity checks** (#8) — EXIF geotag/timestamp on MRV photos and
   duplicate detection. The one remaining 🟠, and the only item on this page
   that is about catching fraud rather than about throughput or presentation.
2. **Granular VVB permissions + accreditation records** (#6) — independence is
   now enforced (nobody validates a project they own), but there is still no way
   to record *which* accredited body a verifier belongs to, or to scope a
   verifier to particular project types.
3. **Bulk actions** (#7) — search shipped; acting on many submissions at once
   did not.

Also open: **mobile review** (#10). The verifier tables are not yet opted into
the card-stacking pattern that `src/styles/responsive-table.css` provides — that
is a per-table `data-label` pass, not new infrastructure.

The panel is now three tabs rather than one scroll, so the structural complaint
in the previous revision of this page is resolved.
