# If I am a Project Developer — What I Need from Carbonify

**Who I am:** An RRCC/LGU/cooperative/MSME that registers climate projects, submits monitoring data, earns carbon credits, and sells them. My success = I can get my project validated, prove my impact through MRV, get credits issued, **sell them, and actually receive the money**.

---

## ✅ What I can already do today
- Submit a project with **all required fields + documents** (PDD, baseline, additionality, leakage, safeguards, feasibility, LGU endorsement, land ownership, ECC, MOA) and a **predefined PH project type**.
- Track my projects on a **dashboard** with a **progress tracker** (Registration → Validation → Verification → Issuance → Trading).
- Submit **MRV monitoring reports** (activity data + photo/log evidence); the platform **auto‑calculates emission reductions** server‑side.
- Get **credits issued** when a verifier approves my reductions; they auto‑**list on the marketplace**.
- See **verifier notes**, status changes, and **notifications**.

---

## 🧩 What I still need (gaps for the developer to implement)

| # | What I want (my voice) | Status | Why it matters to me | Developer action | Priority | Effort |
|---|---|---|---|---|---|---|
| 1 | "**Pay me.** Let me withdraw my earnings from sales." | ❌ | The whole point — I can't get paid today. | Build **seller payouts**: KYB, payout details, disbursement via PSP, hold periods, payout history. | 🔴 | L |
| 2 | "Show me a **sales dashboard** — who bought, how much, my revenue, remaining inventory." | 🟡 | I run this as a business; I need to track sales. | Add a **seller sales/earnings dashboard** (transactions, buyers, revenue, balance). | 🔴 | M |
| 3 | "Let me **set and edit my credit price** and manage inventory/listing status." | 🟡 | Pricing is my decision and changes over time. | Add **listing price/inventory management** (edit price, pause/relist). | 🔴 | M |
| 4 | "When my project **needs revision**, let me easily **edit and resubmit**." | 🟡 | The feedback loop is core to validation. | Wire a clean **edit → resubmit** flow from 'needs_revision' (re‑enter review). | 🔴 | S |
| 5 | "Let me **talk to the verifier** — ask questions, respond to requests." | ❌ (one‑way notes only) | Validation is a dialogue, not a single note. | Add a **per‑project comment thread** between developer and verifier. | 🟠 | M |
| 6 | "**Remind me** when my next monitoring report is due." | ❌ | I'll miss deadlines without nudges (SRD asks for MRV reminders). | Add **scheduled MRV reminders** (email + dashboard). | 🟠 | S |
| 7 | "Capture my **financials** (CAPEX/OPEX) and **carbon‑yield projection** and show them to buyers." | 🟡 (fields exist, not used) | Investors/buyers ask for these. | Persist + display **financials + yield projection**; add financial‑projection upload. | 🟠 | M |
| 8 | "Define my **project boundary** (map polygon) and pick an approved **methodology**." | ❌ | Required for credible, registry‑grade projects. | Add **boundary drawing** + **methodology selection/guidance**. | 🟠 | M |
| 9 | "Help me get **registry‑listed** (Verra/Gold Standard) — guide the journey." | ❌ | That's how my credits become globally sellable (Track B). | Add a **registry‑readiness checklist + export pack** for a VVB/registry. | 🟠 | L |
| 10 | "Let me add **custom monitoring metrics** beyond the defaults." | 🟡 | My project may measure things the template doesn't. | Allow **custom activity metrics** per report. | 🟢 | M |
| 11 | "Give me **projected vs issued** analytics and a timeline." | ❌ | I plan cash flow around issuance. | Add **developer analytics** (projected vs issued credits, history). | 🟢 | M |
| 12 | "Let me **clone a project / use a template** for similar sites." | ❌ | I run multiple similar projects. | Add **project templates/cloning**. | 🟢 | S |
| 13 | "Give my project a **public, shareable profile page**." | 🟡 | Marketing + transparency to buyers. | Add a **public project page**. | 🟢 | S |
| 14 | "Let me **re‑upload / version documents** after the first submission." | 🟡 | Documents get updated. | Add **document re‑upload/versioning**. | 🟠 | S |

---

## 🎯 Top 3 to build first (biggest value for developers)
1. **Seller payouts** (#1) — developers literally cannot get paid today; this is the #1 blocker to a real marketplace.
2. **Sales/earnings dashboard** (#2) — they need to see and trust their sales.
3. **Edit & resubmit after 'needs revision'** (#4) — completes the validation feedback loop.
