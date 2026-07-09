# Carbonify — Expansion Feature Audit (bullet-by-bullet)

> **Audited:** 2026-07-09 · **Updated:** 2026-07-09 (first three gaps closed) · **Method:** each
> sub-item checked against the actual code, columns, and rendered UI — not against the summaries in
> [HANDOFF.md](HANDOFF.md). Where a doc claimed something was shipped and the code disagreed,
> **the code wins** and it is marked below.
>
> ✅ **Closed since the audit:** **buyer history** (#2e), **farmers participating** + **biomass
> collected** (#4a/e), **plantation hectares** (#4f), **black pellets** (#3). +18 unit tests.
>
> ⚠️ **The audit itself got one thing wrong.** It claimed farmers-participating and plantation-hectares
> were "a join away, no migration". Farmers-participating and biomass-collected were. **Hectares was
> not:** migration #25 made `farm_parcels` readable only by the owning farmer, so a developer could not
> see the area of the parcels supplying them. That needed **migration #26**
> ([`20260712000000_parcel_supply_visibility.sql`](../supabase/migrations/20260712000000_parcel_supply_visibility.sql)),
> a narrow policy letting a buyer read a parcel *only* when it supplied them a delivery they confirmed.
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
| 2 | Carbon Asset Management | **6 / 6** | ✅ buyer history shipped 2026-07-09 |
| 3 | Biomass Marketplace | **7 / 7** | ✅ black pellets shipped 2026-07-09 |
| 4 | MRV Dashboard | **3 / 8** fully | 🟡 farmers + biomass collected + hectares shipped; CO₂ avoided/removed split and satellite/IoT remain |
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
| **Buyer history** | ✅ | **Shipped 2026-07-09.** Sales now select `buyer_id` + `created_at`; a **Buyer history** section lists counterparties per project (credits, value, purchase count, last purchase), largest first. Repeat purchases collapse into one row. Buyer names resolve from `profiles`, degrading to "Unknown buyer" if that read is RLS-blocked. |
| Carbon inventory | ✅ | issued − sold, or the pool's available column |

**Closed.** Sales with no `buyer_id` bucket into a single "unattributed" row rather than inflating
the buyer count, and a buyer of two projects counts once portfolio-wide.

---

## 3. Biomass Marketplace

| Feedstock | Status |
|---|---|
| Black pellets | ✅ **shipped 2026-07-09** — `black_pellets` ("Black pellets (torrefied)") is now a first-class dropdown type. |
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
| Biomass collected | ✅ | **Shipped 2026-07-09.** Summed from **confirmed** farmer deliveries (pending/rejected excluded). `kg` converts to tonnes; sacks/bales/m³ are **excluded from the tonnage** and surfaced as a caveat line, because their mass depends on the feedstock's bulk density — summing them would invent a number. |
| CO₂ avoided | 🟡 | Only a **combined** proposed/verified tCO₂e total. Avoided is never separated from removed. |
| CO₂ removed | 🟡 | Same — no avoided-vs-removed split, which is the distinction buyers and registries care about. |
| Energy generated | 🟡 | `energy_kwh` exists as an optional activity metric and appears in a generic grid **only if a report happens to contain it**. No dedicated tile. |
| Farmers participating | ✅ | **Shipped 2026-07-09.** Distinct `farmer_id` across confirmed deliveries to this developer. |
| Plantation hectares | ✅ | **Shipped 2026-07-09**, needed **migration #26**. Sums `area_hectares` of parcels that supplied a confirmed delivery, excluding retired land. When #26 isn't applied the metric reads "—" and says so, rather than silently reporting **0** — a wrong number is worse than a missing one. |
| Satellite monitoring | ⏳ | Out of scope. External API + cost. |
| IoT integration | ⏳ | Same. |

A new **Farmer supply chain** panel renders these, and only appears once a farmer has actually
delivered — an all-zero panel would read as "we have no farmers" rather than "this isn't set up yet."

**Remaining gap:** splitting **CO₂ avoided vs removed** needs a flag on the VER/methodology
(migration). Satellite/IoT stay deferred.

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

Ranked by *investor-visible value per unit of work*.

- ~~**1. MRV: farmers participating + plantation hectares**~~ ✅ done (needed migration #26 for hectares)
- ~~**2. Asset ledger: buyer history**~~ ✅ done
- ~~**3. Black pellets**~~ ✅ done

**Next up:**

4. **Farmer carbon participation** — surface tCO₂e attributable to a farmer's deliveries. Needs a
   delivery→credit linkage decision: a delivery feeds a project, whose VERs mint credits, so the
   attribution rule (pro-rata by delivered mass over the reporting period?) is a **methodology
   choice, not just code**. Worth deciding deliberately.
5. **Methodology enum** + **development-status lifecycle field** — makes the registry filterable and credible. *(migration)*
6. **Offtake agreements / ERPAs** — the largest genuinely-new build; converts projected revenue into contracted revenue in the investor model. *(migration)*
7. **CO₂ avoided vs removed split** — needs a methodology/VER flag. *(migration)*
8. **AI assistant backend** — Claude API edge fn, RLS-scoped to the caller. *(external cost)*
9. **Satellite / IoT feeds** — external APIs + running cost. *(deferred)*
10. **Training module** — content problem more than a code problem.
