# If I am an LGU User — What I Need from Carbonify *(bonus role)*

**Who I am:** A local government unit (city/municipality/barangay) tracking community emissions, monitoring waste diversion, reporting city ESG, and endorsing local projects. My success = I can quantify and report my jurisdiction's climate progress and back credible local projects.

---

> **Reconciled 2026-07-22.** Statuses re-checked against the code. #2 and #3 were
> marked as gaps but had already shipped. The role also had a correctness bug
> that undercut its whole premise: **endorsements were not scoped to
> jurisdiction**, because nothing recorded which municipality an LGU governs.
> Fixed — see #4.

## ✅ What I can already do today
- Access **LGU Tools** with a **municipal solid waste (MSW) emissions calculator** (IPCC factors).
- Save **emissions/diversion records** and track **waste‑diversion** over time.
- View a **City ESG summary** (totals, diversion rate, emissions avoided).
- **Endorse / decline** validated community projects (host‑endorsement system).
- Manage an **organization profile**.

---

## 🧩 What I still need (gaps for the developer to implement)

| # | What I want (my voice) | Status | Why it matters to me | Developer action | Priority | Effort |
|---|---|---|---|---|---|---|
| 1 | "**Land‑use carbon modeling** (forests, mangroves, land‑cover change)." | ❌ | A big part of LGU emissions/sequestration. | Add a **land‑use carbon module** (areas, factors, sequestration). | 🟠 | L |
| 2 | "Export an **official city ESG report** (PDF) for council/DENR/CCC." | ✅ | I report to officials and agencies. | Shipped: CSV **and** PDF export from the City ESG tab (`lguReportService`). | — | — |
| 3 | "**Charts/graphs** of emissions and diversion trends over time." | ✅ | Visuals communicate progress to non‑technical officials. | Shipped: avoided‑vs‑net trend by period. Periods now sort chronologically — labels were sorted as strings, so a city reporting monthly saw *Apr, Aug, Dec, Feb, Jan…* | — | — |
| 4 | "Track **community‑based projects** in my jurisdiction beyond endorsing." | ✅ | I 'track community projects' per my role. | Shipped: a **Projects in My Area** tab covering every stage, not just validated. Required adding `profiles.municipality` — the platform previously had no idea which municipality an LGU governs, which is also why endorsements were unscoped nationwide. A DB trigger now rejects cross‑jurisdiction endorsements. | — | — |
| 5 | "Upload supporting **data files** (waste hauler logs, MRF records)." | ✅ | Evidence backs my numbers. | Shipped: attach documents to an emissions record; they appear in the records table. Stored on the record itself, so they inherit its owner‑scoped RLS. | — | — |
| 6 | "Compare against **other LGUs / benchmarks**." | ❌ | Motivates improvement; useful for grants. | Add **benchmarking** (opt‑in, anonymized). Now feasible: `profiles.municipality` gives LGUs an identity to compare on, which did not exist before. | 🟢 | M |
| 7 | "Turn diverted waste into a **carbon project** (path to credits)." | ❌ | Diversion could become sellable credits. | Link LGU diversion → **project origination** (Track B). | 🟢 | L |

---

## 🎯 What's left (2026-07-22)

The original top 3 (ESG export, project tracker, trend charts) have all shipped,
as has evidence upload. Two items remain:

1. **Land‑use carbon modeling** (#1, 🟠, L) — forests, mangroves and land‑cover
   change are a large share of a real LGU's carbon picture, and the platform
   currently models only municipal solid waste. The biggest genuine gap in this
   role.
2. **Benchmarking against other LGUs** (#6, 🟢) — now unblocked by
   `profiles.municipality`, but needs an opt‑in and an anonymisation policy
   before any LGU's figures are shown to another.

**Also worth knowing:** #7 (turn diversion into a sellable carbon project) is
still open and is deliberately parked — it is a Track B origination question,
not a dashboard feature.

**Still unverified at runtime.** The two LGU migrations (20260722000500–000600)
and the flows they support have not been exercised against a live database.
