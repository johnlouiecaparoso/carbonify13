# If I am an Admin — What I Need from Carbonify

**Who I am:** The platform owner/operator (DENR/CCC or system owner) managing users, overseeing trading and credit issuance, ensuring compliance and integrity. My success = I can run the platform safely, see everything, intervene when needed, and produce reports/evidence.

---

> **Reconciled 2026-07-22.** Statuses re-checked against the code. **Both of this
> page's top two priorities were already built**: the finance console (#1) and the
> system config UI (#2) exist and work. The dispute console (#7) had shipped too.
>
> The real gap was one this page ranked third and described only in passing: the
> DPA half of #6. Every link in that chain existed — user-facing request capture,
> a table with `notes`/`processed_at`/`processed_by`, RLS granting admins read and
> update, an index built specifically for the pending queue, and an erasure
> worker — **except an admin surface**. `dataPrivacyService` exported five
> functions, all user-facing. There was an index serving a queue nobody could
> read, while the Data Privacy Act clock ran.

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
| 1 | "Give me **financial oversight**: transactions, revenue, fees, **payouts**, refunds, reconciliation." | ✅ | I 'oversee trading' — I'm blind to money today. | Shipped: `/admin/finance` with gross sales, fees, platform revenue, payout state, recent transactions and book‑reconciliation drift. Now loads with `allSettled`, so a failing reconciliation scan no longer blanks the whole console. | — | — |
| 2 | "Let me **configure the system** (emission factors, methodologies, fees, KYC peso tiers) without code." | ✅ | Rules change; I shouldn't need a developer each time. | Shipped: `/admin/config` edits platform fee, minimum KYC level to trade, KYC peso tiers and methodology factors. | — | — |
| 3 | "Generate **regulatory & business reports** (DENR/CCC, issuance, retirements, sales) and CSV exports." | 🟡 | Reporting is a core admin duty. | **CSV export shipped** for transactions and audit logs (`adminExportService`). Still missing: a **report builder** with date ranges and issuance/retirement roll‑ups. | 🟠 | M |
| 4 | "Manage the **user lifecycle**: suspend/ban, reset, support impersonation, bulk ops." | 🟡 | Abuse handling + support. | Still roles only — there is no `is_active`, no suspend/ban, no impersonation anywhere. The single biggest remaining admin gap. | 🟠 | M |
| 5 | "Give me a **fraud/risk dashboard** with anomaly alerts." | ❌ | Protect market integrity. | Add **risk signals + alerts** (velocity, oversell attempts, suspicious KYC). | 🟠 | M |
| 6 | "Compliance tooling: **AML screening results, DPA data requests (export/delete), data‑retention**." | 🟡 | Legal obligation (AMLA, Data Privacy Act). | **DPA half shipped**: `/admin/privacy` lists every data‑subject request with requester, age and an over‑30‑days flag, and `process_data_subject_request` moves one through triage (rejection requires a reason). It deliberately does **not** erase — the `account-deletion` worker holds the service role behind a shared secret a browser must never carry. Still missing: **AML screening**. | 🔴 | M |
| 7 | "A **dispute‑resolution console** for buyer/seller issues + refunds." | ✅ | I'm the escalation point. | Shipped: `/admin/refunds` lists transactions and disputes with a refund RPC. Now degrades per‑panel instead of failing silently with no error at all. | — | — |
| 8 | "**Broadcast announcements** / system notifications to users." | 🟡 | Communicate outages, policy changes. | Add **admin broadcast** + banner. | 🟢 | S |
| 9 | "Better **audit log**: search, filter, export, and money/security events." | ✅ | Investigations + audits. | Search and filters existed; **CSV export added**, exporting the filtered set rather than the whole table. Project verification decisions were also writing **no audit rows at all** until `20260722000300` — fixed there. | — | — |
| 10 | "**Feature flags / maintenance mode** and visibility into **backups/DR**." | ❌ | Safe operations at scale. | Add **feature flags + maintenance mode**; surface backup/DR status. | 🟢 | M |
| 11 | "**Granular permissions / segregation of duties** (don't make every admin all‑powerful)." | 🟡 | Security best practice; multi‑admin teams. | Verifier independence shipped (`20260722000100`) with no admin exemption. Admins themselves remain all‑powerful: self role‑assignment, self KYC approval and refunds all carry no second signature. | 🟠 | M |
| 12 | "**Content/project oversight** beyond the verifier (takedowns, flags)." | ❌ | Final accountability for what's listed. | Add **admin project moderation** (flag/suspend a listing). | 🟢 | S |

---

## 🎯 What's left (2026-07-22)

Six of twelve items are done. What remains, in the order I would take it:

1. **Suspend / ban / reactivate** (#4, 🟠) — the only abuse-handling tool an
   operator has today is changing someone's role. Needs an `is_active` column,
   guards across the auth path, and a decision about what a suspended user can
   still see (their own receipts? a retired certificate?).
2. **Segregation of duties** (#11, 🟠) — verifier independence now exists
   (nobody validates a project they own, enforced by trigger), but an admin can
   still assign themselves any role, approve their own KYC and issue refunds with
   no second signature anywhere on the money path.
3. **Fraud / risk signals** (#5, 🟠) — velocity caps and oversell guards already
   fire server-side; nothing surfaces them as alerts for a human to look at.
4. **AML screening** (the other half of #6, 🔴) — KYC/KYB capture identity but
   nothing screens against sanctions or PEP lists.
5. **Broadcast** (#8), **feature flags / maintenance mode** (#10) and **project
   moderation** (#12) — all still unbuilt, all 🟢.

**Still unverified at runtime.** `20260722000700` (the DPA admin RPC) has not been
applied or exercised against a live database.
