# Carbonify — Analytics: what exists, per role, and what to use

> **Updated:** 2026-07-07. Covers the analytics/dashboard surfaces, the real data
> sources behind them, and the recommended tooling for building more.

---

## 1. Homepage headline stats — now LIVE

The four hero stats (Carbon Credits Retired / Active Projects / Credits Available /
CO2 Reduced) were **hardcoded placeholders** (2.3M, 150+, 45, 5.2M). They now read
**real figures** from the anon-granted `public_market_stats()` RPC via
`registryService.getMarketStats()` ([HomepageView.vue](../src/views/HomepageView.vue)).
They show `—` until data loads and never display fake numbers. Note: "Countries" was
dropped (no country data — the platform is PH-focused) and replaced with
"Credits Available".

---

## 2. Analytics dashboards per role (current state)

| Role | Where | Status | Contents |
|---|---|---|---|
| **Buyer / general / LGU** | `/analytics` (Buying tab) | ✅ re-enabled 2026-07-07 | Portfolio value, monthly spend chart, category breakdown, carbon impact. Free. |
| **Buyer** | `/credit-portfolio` | ✅ | Holdings + gain/loss vs market (P&L). |
| **Project developer / seller** | `/analytics` (Selling tab) | ✅ **Pro-gated** (`advanced_analytics`) | Monthly sales revenue, credits sold, seller balance. |
| **Project developer** | `/sales` (Seller Earnings) | ✅ | Per-project earnings, payouts, KYB. |
| **Admin** | `/admin/finance` (Finance Console) | ✅ | Sales, fees, payouts, book reconciliation (is_admin RPCs). |
| **Admin / public** | `/market` (Market Dashboard) | ✅ | Public market snapshot (supply, price, impact). |
| **Admin** | `/admin/audit-logs` | ✅ | Audit-log search. |
| **Verifier** | `/verifier` | ⚠️ queue only | Review queue + SLA aging badges — **no dedicated analytics yet.** |

> The `/analytics` route is live (`requiresAuth`) and linked for **every** role in the
> profile dropdown under **Insights → Analytics**.
>
> **Freemium model** (`FEATURES.ADVANCED_ANALYTICS`, [plans.js](../src/constants/plans.js)):
> - **Free (small access):** the four summary metric cards on the Buying tab (Portfolio
>   Value, Credits Purchased, CO₂ Offset, Projects Supported) + a "Upgrade to Pro" note.
> - **Pro:** everything above **plus** the trend charts, category breakdown, full purchase
>   history, and the entire **Selling** tab (revenue, escrow, payouts).
>
> Gating is client UX only; deeper data is fetched only for entitled users. As always,
> anything sensitive must also be enforced server-side.

### Gaps worth building
- **Verifier analytics:** throughput (reviews/week), avg time-to-decision, approval vs
  revision rate, SLA compliance %, MRV backlog. Data already exists in `projects`,
  `verification_assessments`, `monitoring_reports`.
- **Admin platform analytics:** GMV over time, active users, new projects, conversion
  (listings → sales), take-rate. Extends the Finance Console.

---

## 3. Data sources you already have

All aggregates come from Postgres so they stay RLS-safe:

- **`public_market_stats()`** — anon, headline market figures (migration `20260627000100`).
- **Admin finance RPCs** (`admin_recent_transactions`, sales/fees/payouts) — `is_admin`-gated.
- **`registryService`** — `getRegistryStats()`, `getMarketStats()`, registry search.
- **`portfolioAnalytics` / `salesByProject` / `esgReportService`** — client-side aggregation
  helpers (unit-tested).
- **`generateCarbonImpactReport()`** ([receiptService](../src/services/receiptService.js)) —
  per-user buying impact (powers the Analytics Buying tab).

---

## 4. Recommended tooling

**In-app dashboards (the default — no new dependencies):**
- **Chart.js** is already a dependency; reusable chart components live in
  [src/components/charts/](../src/components/charts/) (`PortfolioChart`, `CategoryChart`).
  ⚠️ Chart.js v4 is tree-shaken — you **must `Chart.register()` the controller** for each
  chart type (`LineController`, `DoughnutController`, `BarController`, …), not just the
  element/scale, or the chart throws `"<type>" is not a registered controller` at runtime.
- Back each dashboard with a **`SECURITY DEFINER` aggregate RPC** that returns only
  aggregates (the `public_market_stats()` pattern) — never raw PII, and role-gate with
  `is_admin()` / `auth.uid()` as appropriate.
- For heavy aggregations as data grows: **materialized views** refreshed by **`pg_cron`**,
  queried by the RPC (keeps dashboards fast).

**Optional, add only if you need them:**
- **Product analytics** (funnels, retention, feature usage): **PostHog** (self-host or cloud)
  or **Plausible** (privacy-friendly, lightweight). Add via a small `VITE_`-gated snippet;
  keep it out of the CSP-sensitive money path.
- **Internal BI / ad-hoc queries:** **Metabase** or **Grafana** connected to a Supabase
  **read replica** (never the primary) for the ops/finance team.
- **Error & performance:** **Sentry** — already live (`VITE_SENTRY_DSN`).

**Build order suggestion:** (1) verifier analytics RPC + tab, (2) admin platform-analytics
tab on the Finance Console, (3) PostHog only if you want behavioural funnels. Everything
stays in Chart.js + Postgres RPCs — no heavy new stack required.
