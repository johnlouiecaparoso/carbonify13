# Farmer carbon participation — the attribution rule

> **Decided:** 2026-07-09 · **Status:** implemented (migration #31)
>
> A farmer delivers feedstock. The feedstock feeds a project. The project's monitoring reports are
> verified, and verified emission reductions (VERs) mint credits. **How many tCO₂e does the farmer
> get to say they contributed?**
>
> This is a *methodology* question, not a coding one. What a smallholder is told they contributed is
> a claim they will repeat — to their family, their cooperative, an LGU, a journalist. Getting it
> wrong is embarrassing in front of a farmer and indefensible in front of an auditor. So the rule is
> written here, in the open, before the code.

---

## The rule we implemented

**Pro-rata by delivered mass, per project, lifetime-to-date.**

```
farmer_attributed_tCO₂e(project)
    = project_verified_tCO₂e × (farmer_delivered_tonnes / project_delivered_tonnes)
```

where both mass figures count **only confirmed deliveries** to that project, and
`project_verified_tCO₂e` is the sum of that project's **approved** VERs.

It is presented to the farmer as an **estimated contribution**, never as a credit they own.

---

## Why this rule

**It is the only rule the data can actually support.** We know delivered mass and we know verified
tCO₂e. We do not know each delivery's moisture content, carbon fraction, or how much of a given
tonne ended up in a durable pool versus flue gas. Any rule that claims to know those things is
asserting precision the platform does not have.

**It is conservative in the right direction.** A farmer's share can never exceed the project's
verified total, because the shares sum to exactly 1. Nobody can claim carbon that was never verified.

**It is explicable in one sentence to a farmer.** *"You supplied a fifth of the biomass this project
verified, so a fifth of its verified carbon is attributed to you."* A rule a farmer cannot understand
is a rule they cannot trust.

---

## What we rejected, and why

**Per-delivery carbon factors** (`tCO₂e = tonnes × emission_factor(feedstock)`). Tempting, and wrong
here. The factors in `methodology_factors` convert *project activity* into reductions under a
methodology; they are not a licence to compute a **credit** for a delivery that was never separately
verified. It would also let the farmer figures sum to more — or less — than the project's actual
verified total, which is exactly the double-counting failure the platform exists to prevent.

**Period-matched attribution** (attribute each reporting period's VERs to that period's deliveries).
More correct in principle, and worth revisiting. Rejected for now because deliveries and monitoring
periods do not align in practice: feedstock delivered in March can be processed in June, and a farmer
who delivered in a quarter with no monitoring report would be told they contributed nothing. The
lifetime-to-date rule is coarser but does not punish a farmer for the developer's reporting cadence.

**Value-weighted attribution** (by peso paid rather than tonnes). Rejected: it would attribute more
carbon to whoever negotiated a better price, which has no physical meaning.

**Attributing across all of a developer's projects.** Rejected: it would credit a farmer for a project
their feedstock never touched. This is why migration #31 adds `farmer_deliveries.project_id` — the
buyer names the project when confirming receipt.

---

## The honest limitations, stated in the UI

1. **It is an estimate, not ownership.** The farmer holds no credit, cannot sell or retire it. The
   label says so.
2. **Only mass-denominated deliveries count.** Sacks, bales and m³ have no defensible tonnage without
   bulk-density factors we do not have, so those deliveries are **excluded from both sides of the
   ratio** and the farmer is told how many were excluded. Silently treating a sack as a tonne would
   corrupt every other farmer's share too, because the denominator is shared.
3. **Unattributed deliveries.** If the buyer never named a project, the delivery cannot be attributed
   at all. The farmer sees the count.
4. **It moves.** A farmer's share falls when another farmer delivers to the same project, and rises
   when new VERs are verified. It is a running estimate, not a settled entitlement.

---

## If you want to change the rule

The whole calculation lives in one SQL function, `public.farmer_carbon_participation()`
([migration #31](../supabase/migrations/20260717000000_farmer_carbon_participation.sql)), and one
pure JS helper, `attributeCarbon()` in [`farmerService.js`](../src/services/farmerService.js). Both
are unit-tested against the zero-denominator and over-attribution edge cases. Changing the rule means
changing those two places and the disclosure text in the Farmer Portal — not hunting through views.
