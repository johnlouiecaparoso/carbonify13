# Carbonify — Expansion Feature Audit (bullet-by-bullet)

> **Audited:** 2026-07-09 · **Method:** each sub-item checked against the actual code, columns, and
> rendered UI — not against the summaries in [HANDOFF.md](HANDOFF.md). Where a doc claimed something
> was shipped and the code disagreed, **the code wins** and it is marked below.
>
> **Why this file exists:** the seven expansion features were tracked at *feature* granularity
> ("#5 Investor Portal — shipped"), which hid missing *sub-items* inside shipped features. Feature-level
> status was over-optimistic. This page tracks the original spec bullet-for-bullet.

**Legend:** ✅ implemented · 🟡 partial (something real exists, but not what the bullet asks for) ·
❌ missing · ⏳ deferred (needs an external service / running cost)

---

## Scorecard

| # | Feature | Bullets met | Honest status |
|---|---|---|---|
| 1 | Project Registry | 5 / 8 | 🟡 mostly there; methodology + dev-status + MRV docs are weaker than claimed |
| 2 | Carbon Asset Management | 5 / 6 | 🟡 **buyer history missing** |
| 3 | Biomass Marketplace | 6 / 7 | 🟡 black pellets not a first-class type |
| 4 | MRV Dashboard | 0 / 8 fully | 🔴 **weakest feature vs spec** — the "biggest differentiator" is the least complete |
| 5 | Investor Portal | 5 / 7 | 🟡 **offtake agreements missing**; data room is a link-out |
| 6 | Farmer Portal | 3 / 6 | 🟡 **carbon participation + training missing** |
| 7 | AI Project Assistant | 0 / 5 | 🔴 interface preview only; no backend |

> **Net:** the *plumbing* for all seven exists. The investor-facing and farmer-facing **storytelling
> layers** (buyer history, carbon participation, offtake, satellite/IoT) are the consistent gap —
> and those are exactly the parts that matter to Japan Energy Capital / Enechange-class diligence.

---

## 1. Project Registry

| Bullet | Status | Reality |
|---|---|---|
| GPS location | ✅ | `geo_coordinates` + `boundary` drawn on a Leaflet map ([ProjectDetailView.vue:262](../src/views/ProjectDetailView.vue#L262)). Coordinates are plotted, not shown as text. |
| Project developer | ✅ | Developer card: name, organization, type ([ProjectDetailView.vue:122](../src/views/ProjectDetailView.vue#L122)). |
| Methodology (Verra, Gold Standard, Puro, ISO…) | 🟡 | Captured and displayed, but it is a **free-text input**, not a dropdown. Verra/Gold Standard/Puro/ISO appear only as *placeholder hint text* ([ProjectForm.vue:1273](../src/components/ProjectForm.vue#L1273)). No enum exists, so two projects can spell "Gold Standard" differently and nothing can filter or group by methodology. |
| Feedstock | ✅ | [ProjectDetailView.vue:75](../src/views/ProjectDetailView.vue#L75) |
| Capacity | ✅ | `capacity` + `capacity_unit` ([ProjectDetailView.vue:76](../src/views/ProjectDetailView.vue#L76)) |
| Expected carbon reductions | ✅ | `estimated_credits` + `expected_impact` |
| Development status | 🟡 | What's displayed is the **validation-workflow status** (draft → submitted → validated → rejected). There is **no project development-lifecycle stage** (feasibility / financing / construction / operational). No `development_status` column exists. |
| Documents (PDD, feasibility, MRV reports) | 🟡 | **PDD ✅** and **feasibility ✅** are uploadable + viewable. **MRV reports ❌ are not a project document type** — MRV lives in a separate monitoring module and is not surfaced in the registry's document list. |

**Gap to close:** a methodology **enum** (unlocks filtering + registry credibility), a real
`development_status` lifecycle field, and surfacing MRV reports as registry documents.

---

## 2. Carbon Asset Management

| Bullet | Status | Reality |
|---|---|---|
| Issued credits | ✅ | [assetLedgerService.js:88](../src/services/assetLedgerService.js#L88) |
| Pending credits | ✅ | from VERs with `status='pending'` |
| Sold credits | ✅ | completed `credit_transactions` |
| Retired credits | ✅ | `credit_retirements` |
| **Buyer history** | ❌ | **Missing.** The sales query never selects `buyer_id` ([assetLedgerService.js:207](../src/services/assetLedgerService.js#L207)); the ledger shows only aggregate sold quantity and value. A developer cannot see **who** bought their credits. |
| Carbon inventory | ✅ | issued − sold, or the pool's available column |

**Gap to close:** buyer history. This is the bullet that matters for **ERPAs and institutional
buyers** — the stated reason for the feature. Needs `buyer_id` joined to `profiles` in the sales
query plus a per-project buyer table in the ledger view.

---

## 3. Biomass Marketplace

| Feedstock | Status |
|---|---|
| Black pellets | ❌ **not in the dropdown** — only `wood_pellets`. Enterable via "Other biomass" free text, so it can't be filtered or browsed as a category. |
| Biochar | ✅ |
| Rice husks | ✅ |
| Coconut biomass | ✅ (`coconut_husk`, `coconut_shell`) |
| Bana Grass | ✅ |
| Sugarcane bagasse | ✅ |
| Buyers request quotations directly | ✅ | full RFQ → quote → accept/decline flow ([biomassService.js:163](../src/services/biomassService.js#L163)) |

**Gap to close:** one line in [biomass.js](../src/constants/biomass.js) — `black_pellets`. Trivial,
and it's a named RRCC product.

---

## 4. MRV Dashboard — the weakest feature against its spec

Positioned as "one of the biggest differentiators," this is the feature furthest from its bullets.
The dashboard aggregates **whatever `monitoring_activity_data` rows happen to exist**, keyed by
`metric_key`; it does not compute the named metrics.

| Bullet | Status | Reality |
|---|---|---|
| Biomass collected | ❌ | No such metric key exists in [mrv.js](../src/constants/mrv.js). Nearest are `waste_tonnes` / `biochar_tonnes`. |
| CO₂ avoided | 🟡 | Only a **combined** proposed/verified tCO₂e total. Avoided is never separated from removed. |
| CO₂ removed | 🟡 | Same — no avoided-vs-removed split, which is the distinction buyers and registries care about. |
| Energy generated | 🟡 | `energy_kwh` exists as an optional activity metric and appears in a generic grid **only if a report happens to contain it**. No dedicated tile. |
| Farmers participating | ❌ | Not computed. The dashboard **never reads `farm_parcels` / `farmer_deliveries`** — even though those tables now exist (migration #25). |
| Plantation hectares | ❌ | Same: `farm_parcels.area_hectares` exists and is **not** read by the MRV dashboard. |
| Satellite monitoring | ⏳ | Explicitly out of scope ([mrvDashboardService.js:12](../src/services/mrvDashboardService.js#L12)). External API + cost. |
| IoT integration | ⏳ | Same. |

**Gap to close (highest leverage in the whole audit):** the farmer tables shipped yesterday make
**farmers participating** and **plantation hectares** cheap to compute — a join away, no migration
needed. Splitting **CO₂ avoided vs removed** needs a flag on the VER/methodology. Those three turn
the dashboard from "a report roll-up" into the differentiator it's described as.

---

## 5. Investor Portal

| Bullet | Status | Reality |
|---|---|---|
| Financial model | ✅ | `computeProjectFinancials` — NPV, annual net, lifetime |
| IRR | ✅ | bisection solver ([investorAnalytics.js:23](../src/services/investorAnalytics.js#L23)) |
| Project pipeline | ✅ | cross-developer validated projects |
| Carbon revenue | ✅ | `estimated_credits × credit_price` |
| **Offtake agreements** | ❌ | **Missing entirely.** A whole-repo grep for offtake / ERPA / purchase-agreement returns **zero functional code** — two descriptive words in a comment. No table, no field, no UI. |
| Funding requirements | ✅ | `funding_target` / `funding_raised` → funding gap |
| Due-diligence documents | 🟡 | The portal shows a **document count badge** and links out to the project page ([investorService.js:107](../src/services/investorService.js#L107)). There is no data room *inside* the portal — no in-context viewer, no access log, no per-investor permissioning. |

**Gap to close:** offtake agreements are the single most investor-relevant missing item — an ERPA is
what converts "projected carbon revenue" into contracted revenue. Without it, every IRR in the portal
is built on an *assumed* credit price.

---

## 6. Farmer Portal

| Bullet | Status | Reality |
|---|---|---|
| Register | ✅ | `farmer` role, applyable at `/apply`, admin-assignable |
| Upload deliveries | ✅ | `record_farmer_delivery` RPC + proof upload to the private bucket |
| Track payments | 🟡✅ | Works, but **bookkeeping only** by design — a buyer-set flag, deliberately not wired to ledger/escrow/payouts. Farmers see pesos owed and paid, but no money moves through Carbonify. |
| **View carbon participation** | ❌ | **Missing.** No mention of tCO₂e, credits, or carbon anywhere in [FarmerPortalView.vue](../src/views/FarmerPortalView.vue). `farmer_deliveries` has **no link to credit issuance**. A farmer sees sacks and pesos, never how their feedstock became a carbon credit. |
| Receive training | ❌ | **Missing.** No training module, content, route, or table anywhere. |
| Monitor plantation performance | 🟡 | A **static register**: parcels store `expected_yield_tonnes`, and totals are summed. There is **no actual-yield capture, no actual-vs-expected, no trend**. Deliveries record real quantities but are never reconciled back to the parcel that produced them. |

**Gap to close:** carbon participation is the emotional core of the farmer proposition and the
reason a smallholder would care. Deliveries already carry `parcel_id` — reconciling delivered
quantity against `expected_yield_tonnes` gives plantation performance almost for free.

---

## 7. AI Project Assistant

Interface preview only ([AiAssistantView.vue](../src/views/AiAssistantView.vue)). The composer is
disabled, nothing is sent anywhere, and no answers are generated. Every spec bullet — credits
generated, feedstock available, investment-ready projects, draft PDD, financing proposal — is ❌
pending the Claude API edge function.

---

## Positioning claims vs reality

| Claim | Reality |
|---|---|
| National biomass registry | 🟡 the marketplace + farmer parcels exist; nothing makes it *national* (no DENR/CCC registry linkage, no public biomass registry page) |
| Carbon project marketplace | ✅ |
| Carbon MRV platform | 🟡 capture ✅, roll-up ✅, but the headline metrics above are missing |
| Project development portal | ✅ |
| Investor data room | 🟡 doc count + link-out, not a real data room |
| Feedstock marketplace | ✅ |
| ESG reporting platform | 🟡 **buyer-side only** — [esgReportService.js](../src/services/esgReportService.js) exports PDF/CSV from the *credit portfolio*. Developers, farmers, and verifiers have no ESG export. LGU reports are a separate, unrelated thing. |

---

## Recommended order to close the gaps

Ranked by *investor-visible value per unit of work*. The first three need **no migration**.

1. **MRV: farmers participating + plantation hectares** — join the farmer tables the MRV dashboard already could read. Turns the "biggest differentiator" into one. *(no migration)*
2. **Asset ledger: buyer history** — add `buyer_id` to the sales query, join `profiles`. Directly serves the stated ERPA / institutional-buyer use case. *(no migration)*
3. **Black pellets** in the feedstock dropdown — one line, and it's a named RRCC product. *(no migration)*
4. **Farmer carbon participation** — surface tCO₂e attributable to a farmer's deliveries. Needs a delivery→credit linkage decision.
5. **Methodology enum** + **development-status lifecycle field** — makes the registry filterable and credible. *(migration)*
6. **Offtake agreements / ERPAs** — the largest genuinely-new build; converts projected revenue into contracted revenue in the investor model. *(migration)*
7. **CO₂ avoided vs removed split** — needs a methodology/VER flag. *(migration)*
8. **AI assistant backend** — Claude API edge fn, RLS-scoped to the caller. *(external cost)*
9. **Satellite / IoT feeds** — external APIs + running cost. *(deferred)*
10. **Training module** — content problem more than a code problem.
