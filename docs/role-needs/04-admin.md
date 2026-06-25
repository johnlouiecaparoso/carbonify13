# If I am an Admin — What I Need from Carbonify

**Who I am:** The platform owner/operator (DENR/CCC or system owner) managing users, overseeing trading and credit issuance, ensuring compliance and integrity. My success = I can run the platform safely, see everything, intervene when needed, and produce reports/evidence.

---

## ✅ What I can already do today
- Access the **Admin Dashboard** with platform overview stats.
- **User management** (view users, assign roles) and review **role applications**.
- Review and approve **KYC applications** (sets user KYC level).
- View **audit logs** of system actions.
- **Database management** tools and analytics charts.
- Notifications fire automatically on key events.

---

## 🧩 What I still need (gaps for the developer to implement)

| # | What I want (my voice) | Status | Why it matters to me | Developer action | Priority | Effort |
|---|---|---|---|---|---|---|
| 1 | "Give me **financial oversight**: transactions, revenue, fees, **payouts**, refunds, reconciliation." | ❌ | I 'oversee trading' — I'm blind to money today. | Build an **admin finance console** (transactions, ledger, payouts, refunds, reconciliation status). | 🔴 | L |
| 2 | "Let me **configure the system** (emission factors, methodologies, fees, KYC peso tiers) without code." | ❌ (hard‑coded/DB) | Rules change; I shouldn't need a developer each time. | Add an **admin settings/config UI** for factors, fees, tiers, project types. | 🔴 | M |
| 3 | "Generate **regulatory & business reports** (DENR/CCC, issuance, retirements, sales) and CSV exports." | 🟡 (charts only) | Reporting is a core admin duty. | Add **report builder + CSV/PDF exports**. | 🔴 | M |
| 4 | "Manage the **user lifecycle**: suspend/ban, reset, support impersonation, bulk ops." | 🟡 (roles only) | Abuse handling + support. | Add **suspend/ban/reactivate**, secure **impersonation**, bulk role ops. | 🟠 | M |
| 5 | "Give me a **fraud/risk dashboard** with anomaly alerts." | ❌ | Protect market integrity. | Add **risk signals + alerts** (velocity, oversell attempts, suspicious KYC). | 🟠 | M |
| 6 | "Compliance tooling: **AML screening results, DPA data requests (export/delete), data‑retention**." | ❌ | Legal obligation (AMLA, Data Privacy Act). | Add **AML review queue + DPA data‑subject request handling**. | 🔴 | M |
| 7 | "A **dispute‑resolution console** for buyer/seller issues + refunds." | ❌ | I'm the escalation point. | Add a **dispute/case management** view. | 🟠 | M |
| 8 | "**Broadcast announcements** / system notifications to users." | 🟡 | Communicate outages, policy changes. | Add **admin broadcast** + banner. | 🟢 | S |
| 9 | "Better **audit log**: search, filter, export, and money/security events." | 🟡 | Investigations + audits. | Add **audit search/filter/export**; ensure all money/security events logged. | 🟠 | S |
| 10 | "**Feature flags / maintenance mode** and visibility into **backups/DR**." | ❌ | Safe operations at scale. | Add **feature flags + maintenance mode**; surface backup/DR status. | 🟢 | M |
| 11 | "**Granular permissions / segregation of duties** (don't make every admin all‑powerful)." | 🟡 | Security best practice; multi‑admin teams. | Add **fine‑grained RBAC editing + SoD controls**. | 🟠 | M |
| 12 | "**Content/project oversight** beyond the verifier (takedowns, flags)." | ❌ | Final accountability for what's listed. | Add **admin project moderation** (flag/suspend a listing). | 🟢 | S |

---

## 🎯 Top 3 to build first (biggest value for admins)
1. **Admin finance console** (#1) — you "oversee trading" but currently have no money visibility; this is the biggest blind spot.
2. **System configuration UI** (#2) — factors/fees/tiers/types should be admin‑editable, not code changes.
3. **Compliance tooling — AML + DPA** (#6) — required to operate legally with real money + personal data.
