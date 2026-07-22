# Carbonify — Role‑by‑Role Needs & Gaps

These documents describe, **from each user role's point of view**, what they want from Carbonify, what the system **already provides**, and **what's still lacking** — written so a developer can pick up each gap and implement it.

| Role | Doc | "If I am…" |
|---|---|---|
| Buyer / Investor / General user | [01-buyer.md](01-buyer.md) | …someone buying carbon credits to offset emissions. |
| Project Developer | [02-project-developer.md](02-project-developer.md) | …a developer submitting projects and earning credits. |
| Verifier | [03-verifier.md](03-verifier.md) | …a verifier validating projects and approving credits. |
| Admin | [04-admin.md](04-admin.md) | …the platform owner/operator overseeing everything. |
| LGU User *(bonus)* | [05-lgu.md](05-lgu.md) | …a local government unit using climate tools. |

**How to read each doc**
- **What I can already do** — features that exist today (so you don't rebuild them).
- **What I still need** — the gap list. Each item has: the **need** (in the user's voice), **status** (❌ missing / 🟡 partial), **why it matters**, the **developer action**, and a **priority**.

> ## ⚠️ Reconciled 2026-07-22 — read this before trusting a status column
>
> All five pages were re-checked **against the code**, not against their own
> previous revision. Every one of them **understated what had already shipped** —
> in the worst case (buyer) 10 of 13 items were marked as gaps while fully built.
> Several statuses have been corrected, and each page now carries a header note
> saying what it got wrong.
>
> Three claims these pages made that were simply false, recorded here so they are
> not re-trusted:
> * *"assignment fields exist"* (verifier #5) — they did not. `verified_by`
>   records who **decided**, after the fact.
> * *"everything is recorded in time-stamped audit logs"* (verifier) — project
>   verification decisions wrote **none**.
> * *"the SDG filter is cosmetic"* (buyer #3) — it genuinely filters on
>   `co_benefits`.
>
> Each role also carried exactly one structural bug that undercut its premise;
> all five are fixed. See [../HANDOFF.md](../HANDOFF.md) for the table and for the
> migrations this work depends on.

**Priority legend:** 🔴 High (blocks core value / trust) · 🟠 Medium (expected, improves adoption) · 🟢 Low (nice‑to‑have / future)
**Effort legend:** S (small) · M (medium) · L (large/with external dependency)

> Cross‑reference: platform‑wide gaps and market benchmark live in [`../CARBONIFY_SYSTEM_ANALYSIS.md`](../CARBONIFY_SYSTEM_ANALYSIS.md); real‑money/real‑project path in [`../REAL_WORLD_GOLIVE_PLAYBOOK.md`](../REAL_WORLD_GOLIVE_PLAYBOOK.md).
