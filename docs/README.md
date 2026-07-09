# Carbonify — Documentation Index

## Start here

| Doc | What it answers |
|---|---|
| [HANDOFF.md](HANDOFF.md) | Where we are right now, one screen. |
| [EXPANSION_FEATURE_AUDIT.md](EXPANSION_FEATURE_AUDIT.md) | The seven expansion features, scored bullet-by-bullet **against the code**. |
| [RUNTIME_VERIFICATION_RUNBOOK.md](RUNTIME_VERIFICATION_RUNBOOK.md) | 🔴 The click-through that proves any of it actually works. |
| [FARMER_CARBON_ATTRIBUTION.md](FARMER_CARBON_ATTRIBUTION.md) | Why a farmer's tCO₂e is calculated the way it is. |
| [CODE_AUDIT_2026-07-09.md](CODE_AUDIT_2026-07-09.md) | Whole-codebase audit: 4 bugs fixed, the rest ranked. Read the HIGH one. |
| [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) | What blocks real money (pentest, email confirmation). |


Start here. This folder mixes **current** docs with **historical** planning notes kept for
traceability. Use the current set below; anything under "Historical" carries a superseded banner.

## 🟢 Start here (current, authoritative)

| Doc | What it's for |
|---|---|
| [ABOUT_CARBONIFY.md](ABOUT_CARBONIFY.md) | Plain-language "what is this system" — product, roles, credit lifecycle, money model |
| [GO_LIVE_ROADMAP.md](GO_LIVE_ROADMAP.md) | **Implemented vs not, by priority, + what to do now** — the current plan with a go/no-go gate |
| [SECURITY_CLOSEOUT_CHECKLIST.md](SECURITY_CLOSEOUT_CHECKLIST.md) | **Security close-out status + the step-by-step TEST RUNBOOK** (what's done vs pending deploy/test) |
| [HANDOFF.md](HANDOFF.md) | Current state / handoff — where things stand and the next steps |
| [RELEASE_NOTES.md](RELEASE_NOTES.md) | Release summary for the 2026-07-03 server-authoritative money cutover |

## 📖 Use the app

- [user-guide/](user-guide/README.md) — step-by-step guides, one per role (getting started, buyer, developer, verifier, admin, LGU)

## 🛠 Build / operate it

- Root [../README.md](../README.md) — project overview + quickstart
- [dev/](dev/README.md) — setup, environment variables, architecture, database & RPCs, deployment, testing, contributing, **security**, **deployment readiness**
- [CARBONIFY_BUILD_PROMPT.md](CARBONIFY_BUILD_PROMPT.md) — reusable prompt to rebuild or finish a Carbonify-class system (spec + tech stack + enhancements)

## 💳 Money path

- [MONEY_CUTOVER_STATUS.md](MONEY_CUTOVER_STATUS.md) — status of the server-authoritative cutover (complete + hardened)
- [YOUR_CUTOVER_STEPS.md](YOUR_CUTOVER_STEPS.md) — the completed money-path runbook of record
- [PAYMENTS_ARCHITECTURE.md](PAYMENTS_ARCHITECTURE.md) — target money/wallet/ledger architecture

## 🔐 Security (read before real-user / live-key deployment)

- [dev/DEPLOYMENT_READINESS.md](dev/DEPLOYMENT_READINESS.md) — pre-launch security assessment + go/no-go checklist
- [dev/SECURITY.md](dev/SECURITY.md) — security model overview

## 📚 Reference / background (still useful)

- [SYSTEM_GUIDE.md](SYSTEM_GUIDE.md) — architecture & how the code fits together
- [ECOLINK_SYSTEM_ANALYSIS.md](ECOLINK_SYSTEM_ANALYSIS.md) — system analysis vs the SRD + market benchmark
- [REAL_WORLD_GOLIVE_PLAYBOOK.md](REAL_WORLD_GOLIVE_PLAYBOOK.md) — path to real credits + real money
- [VENDOR_SCORECARD_AND_TECH_DESIGN.md](VENDOR_SCORECARD_AND_TECH_DESIGN.md) — vendor evaluation + provider-agnostic design
- [role-needs/](role-needs/README.md) — per-role needs & gaps
- [AUTH_PROVIDER_SETUP.md](AUTH_PROVIDER_SETUP.md) · [POLICY_AND_USER_AGREEMENT.md](POLICY_AND_USER_AGREEMENT.md) · [DEFERRED_BACKLOG.md](DEFERRED_BACKLOG.md) · [ROADMAP_SIMPLE.md](ROADMAP_SIMPLE.md)

## 🗄️ Historical / superseded (kept for traceability — each carries a banner)

These predate the completed money cutover and the security review. Do not use them for current
status; they point back to the docs above.

- [SYSTEM_STATUS_OVERVIEW.md](SYSTEM_STATUS_OVERVIEW.md) · [SYSTEM_LATEST_UPDATE.md](SYSTEM_LATEST_UPDATE.md)
- [PRODUCTION_READINESS_TODO.md](PRODUCTION_READINESS_TODO.md) · [NOW_IMPLEMENTATION_PLAN.md](NOW_IMPLEMENTATION_PLAN.md) · [IMPLEMENTATION_ROADMAP_TIMELINE.md](IMPLEMENTATION_ROADMAP_TIMELINE.md) · [IMPLEMENTATION_TASKLIST.md](IMPLEMENTATION_TASKLIST.md)
- [YOUR_ACTION_ITEMS.md](YOUR_ACTION_ITEMS.md) · [NEXT_STEP_verify_money_path.md](NEXT_STEP_verify_money_path.md) · [PHASE1_VERIFICATION_RUNBOOK.md](PHASE1_VERIFICATION_RUNBOOK.md)
- [CONSOLE_ERRORS_AFTER_PAYMENT.md](CONSOLE_ERRORS_AFTER_PAYMENT.md) · [CARBONIFY_BOARD_UPDATED.md](CARBONIFY_BOARD_UPDATED.md)
