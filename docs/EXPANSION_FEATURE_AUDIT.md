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
| 1 | Project Registry | **8 / 8** | ✅ complete |
| 2 | Carbon Asset Management | **6 / 6** | ✅ buyer history shipped 2026-07-09 |
| 3 | Biomass Marketplace | **7 / 7** | ✅ black pellets shipped 2026-07-09 |
| 4 | MRV Dashboard | **6 / 8** fully | 🟡 only satellite + IoT remain (both external, deferred) |
| 5 | Investor Portal | **7 / 7** | ✅ complete — offtake agreements + real data room shipped 2026-07-09 |
| 6 | Farmer Portal | **5 / 6** | 🟡 only training remains (content, not code) |
| 7 | AI Project Assistant | 0 / 5 | 🔴 interface preview only; no backend |

> **Net (2026-07-09, after the close-out pass):** features **#1, #2, #3 and #5 are complete**; **#4 is
> 6/8 and #6 is 5/6**. Everything still open needs something other than code: **training content**
> (#6e), an **API key + running cost** (#7 AI backend), **external feeds** (#4 satellite/IoT), or an
> **actual-vs-expected yield** design (#6f, the last codeable item).
>
> The original finding still holds as a lesson: feature-level "shipped" labels hid missing sub-items,
> and the missing ones clustered precisely in the investor- and farmer-facing surfaces that matter
> most to Japan Energy Capital / Enechange-class diligence.

---

## 1. Project Registry

| Bullet | Status | Reality |
|---|---|---|
| GPS location | ✅ | `geo_coordinates` + `boundary` drawn on a Leaflet map ([ProjectDetailView.vue:262](../src/views/ProjectDetailView.vue#L262)). Coordinates are plotted, not shown as text. |
| Project developer | ✅ | Developer card: name, organization, type ([ProjectDetailView.vue:122](../src/views/ProjectDetailView.vue#L122)). |
| Methodology (Verra, Gold Standard, Puro, ISO…) | ✅ | **Shipped 2026-07-09.** A grouped enum in [`projectRegistry.js`](../src/constants/projectRegistry.js) — Verra (VCS), Gold Standard, Puro.earth, ISO 14064, CDM, ACR, CAR, Plan Vivo, ISCC, PH national, Carbonify Standard, **Other**. The Investor Portal filters by standard. Legacy free text ("Verra VM0044") renders as-is and maps to **Other** on edit rather than being discarded. |
| Feedstock | ✅ | [ProjectDetailView.vue:75](../src/views/ProjectDetailView.vue#L75) |
| Capacity | ✅ | `capacity` + `capacity_unit` ([ProjectDetailView.vue:76](../src/views/ProjectDetailView.vue#L76)) |
| Expected carbon reductions | ✅ | `estimated_credits` + `expected_impact` |
| Development status | ✅ | **Shipped 2026-07-09** (migration #28). `development_status`: concept → feasibility → financing → construction → operational → decommissioned. Deliberately **orthogonal** to `projects.status` (the validation workflow) — a test asserts the two vocabularies never share a value, since conflating them was the original bug. Nullable, because defaulting existing projects to 'concept' would assert something untrue about them. |
| Documents (PDD, feasibility, MRV reports) | ✅ | **Shipped 2026-07-09.** PDD and feasibility were already uploadable + viewable; **MRV Report** is now an optional project document type, so a published monitoring report reaches the public project page. |

**Closed.** All eight bullets are met.

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

**Closed.** All seven bullets are met.

---

## 4. MRV Dashboard

**Was** the weakest feature against its spec — originally 0/8 bullets fully met, despite being
positioned as "one of the biggest differentiators." It aggregated whatever `monitoring_activity_data`
rows happened to exist and computed none of the named metrics. Now **6/8**: only satellite and IoT
remain, both external and deferred from the start.

| Bullet | Status | Reality |
|---|---|---|
| Biomass collected | ✅ | **Shipped 2026-07-09.** Summed from **confirmed** farmer deliveries (pending/rejected excluded). `kg` converts to tonnes; sacks/bales/m³ are **excluded from the tonnage** and surfaced as a caveat line, because their mass depends on the feedstock's bulk density — summing them would invent a number. |
| CO₂ avoided | ✅ | **Shipped 2026-07-09** (migration #29). `reduction_type` on each VER, asserted by the **verifier at approval** — pre-selected from the project category, never auto-applied. |
| CO₂ removed | ✅ | Same. The dashboard shows **removed / avoided / unclassified**; legacy VERs stay unclassified rather than being retro-guessed into a type nobody asserted. |
| Energy generated | ✅ | **Shipped 2026-07-09.** A dedicated tile summing `energy_kwh`, scaled to MWh/GWh. Deliberately **not** merged with `energy_saved_kwh` — energy saved is avoided consumption, a different claim, and adding them would overstate what the project produced. |
| Farmers participating | ✅ | **Shipped 2026-07-09.** Distinct `farmer_id` across confirmed deliveries to this developer. |
| Plantation hectares | ✅ | **Shipped 2026-07-09**, needed **migration #26**. Sums `area_hectares` of parcels that supplied a confirmed delivery, excluding retired land. When #26 isn't applied the metric reads "—" and says so, rather than silently reporting **0** — a wrong number is worse than a missing one. |
| Satellite monitoring | ⏳ | Out of scope. External API + cost. |
| IoT integration | ⏳ | Same. |

A new **Farmer supply chain** panel renders these, and only appears once a farmer has actually
delivered — an all-zero panel would read as "we have no farmers" rather than "this isn't set up yet."

**Remaining gap:** satellite monitoring and IoT integration only — both need external APIs with a
running cost, and both were deferred from the start.

---

## 5. Investor Portal

| Bullet | Status | Reality |
|---|---|---|
| Financial model | ✅ | `computeProjectFinancials` — NPV, annual net, lifetime |
| IRR | ✅ | bisection solver ([investorAnalytics.js:23](../src/services/investorAnalytics.js#L23)) |
| Project pipeline | ✅ | cross-developer validated projects |
| Carbon revenue | ✅ | `estimated_credits × credit_price` |
| **Offtake agreements** | ✅ | **Shipped 2026-07-09** (migration #27). Developers record ERPAs at [`/developer/offtakes`](../src/views/OfftakeAgreementsView.vue). The portal splits **contracted vs speculative** revenue, blends the negotiated price with the listed price for uncontracted credits, and shows a **downside IRR on contracted revenue alone**. Owner-only RLS; investors see aggregates via `offtake_summary()`, never a counterparty or price. |
| Funding requirements | ✅ | `funding_target` / `funding_raised` → funding gap |
| Due-diligence documents | ✅ | **Shipped 2026-07-09** (migration #30). Documents open **inside** the portal via short-lived signed URLs, every open is logged, and developers see who is reading what at `/developer/data-room`. Viewers are **counted, not named** — an investor doing diligence isn't published as a lead list. Per-investor *permissioning* remains out of scope: today every validated project's documents are readable by any authenticated user, as they already were on the project page. |

**Closed.** Only `signed`/`active` count as contracted — a draft, negotiation, completed or
terminated agreement contributes nothing, or speculative revenue would be restated as contracted.
Over-commitment (contracted volume > estimated issuance) is flagged rather than allowed to drive
speculative volume negative. `irrContracted` distinguishes "nothing contracted" from "contracted
revenue ≤ OPEX" — the latter is a solvency warning, not a missing number.

**Closed.** All seven bullets are met. Note the one thing NOT built: **per-investor permissioning**.
Documents on a validated project are readable by any authenticated user — that was already true of the
public project page, and the data room did not change it. If a developer needs to gate a specific
document to a specific investor, that is a new feature, not a bug in this one.

---

## 6. Farmer Portal

| Bullet | Status | Reality |
|---|---|---|
| Register | ✅ | `farmer` role, applyable at `/apply`, admin-assignable |
| Upload deliveries | ✅ | `record_farmer_delivery` RPC + proof upload to the private bucket |
| Track payments | 🟡✅ | Works, but **bookkeeping only** by design — a buyer-set flag, deliberately not wired to ledger/escrow/payouts. Farmers see pesos owed and paid, but no money moves through Carbonify. |
| **View carbon participation** | ✅ | **Shipped 2026-07-09** (migration #31). A **Carbon** tab attributes verified tCO₂e pro-rata by delivered mass per project. Rule written down first: [FARMER_CARBON_ATTRIBUTION.md](FARMER_CARBON_ATTRIBUTION.md). Presented as an **estimate**, never as credit ownership. |
| Receive training | ❌ | **Missing.** No training module, content, route, or table anywhere. |
| Monitor plantation performance | 🟡 | Still a **static register** plus expected-yield totals. Deliveries carry `parcel_id` but are not reconciled against a parcel's expected yield, so there is no actual-vs-expected or trend. |

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
- ~~**6. Offtake agreements / ERPAs**~~ ✅ done (migration #27)
- ~~**7b. Real in-portal data room**~~ ✅ done (migration #30)

**Next up:**

- ~~**4. Farmer carbon participation**~~ ✅ done (migration #31; rule in
  [FARMER_CARBON_ATTRIBUTION.md](FARMER_CARBON_ATTRIBUTION.md))

**Next up:**
- ~~**5. Methodology enum + development-status lifecycle**~~ ✅ done (migration #28)

- ~~**7. CO₂ avoided vs removed split**~~ ✅ done (migration #29)

- ~~**7c. MRV reports as a registry document type**~~ ✅ done
- ~~**Energy-generated tile**~~ ✅ done
8. **AI assistant backend** — Claude API edge fn, RLS-scoped to the caller. *(external cost)*
9. **Satellite / IoT feeds** — external APIs + running cost. *(deferred)*
10. **Training module** — content problem more than a code problem.
