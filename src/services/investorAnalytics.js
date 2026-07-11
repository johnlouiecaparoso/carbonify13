/**
 * Investor financial math (expansion feature #5) — pure, unit-tested helpers.
 *
 * There is no financial-calculation module elsewhere in the app, so IRR / NPV /
 * payback are implemented here from scratch. All functions are side-effect free.
 *
 * Cashflow convention: an array indexed by period, where index 0 is t0 (the
 * up-front CAPEX outflow, negative) and indices 1..n are annual net cashflows.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/** Net present value of a cashflow series at a per-period discount rate. */
export function computeNpv(rate, cashflows = []) {
  const r = Number(rate)
  return (cashflows || []).reduce((acc, cf, t) => acc + (Number(cf) || 0) / Math.pow(1 + r, t), 0)
}

/**
 * Internal rate of return (decimal, e.g. 0.15 = 15%) via bisection. Returns null
 * when the series has no sign change (no real IRR in a sensible range).
 */
export function computeIrr(cashflows = []) {
  const cf = (cashflows || []).map((x) => Number(x) || 0)
  if (cf.length < 2) return null
  const hasPos = cf.some((x) => x > 0)
  const hasNeg = cf.some((x) => x < 0)
  if (!hasPos || !hasNeg) return null

  const npvAt = (r) => computeNpv(r, cf)
  let lo = -0.9999
  let hi = 10
  let flo = npvAt(lo)
  let fhi = npvAt(hi)
  if (flo * fhi > 0) return null // no root bracketed in [-100%, 1000%]

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    const fmid = npvAt(mid)
    if (Math.abs(fmid) < 1e-7 || (hi - lo) / 2 < 1e-9) return mid
    if (flo * fmid < 0) {
      hi = mid
      fhi = fmid
    } else {
      lo = mid
      flo = fmid
    }
  }
  return (lo + hi) / 2
}

/**
 * Undiscounted payback period in years (fractional), or null if never recovered.
 * Interpolates within the year the cumulative cashflow crosses zero.
 */
export function computePayback(cashflows = []) {
  const cf = (cashflows || []).map((x) => Number(x) || 0)
  let cum = 0
  for (let t = 0; t < cf.length; t++) {
    const before = cum
    cum += cf[t]
    if (cum >= 0) {
      if (t === 0) return 0
      const yearFlow = cf[t]
      if (yearFlow <= 0) continue
      return round2(t - 1 + -before / yearFlow)
    }
  }
  return null
}

const asRate = (irr) => (irr == null ? null : Math.round(irr * 10000) / 10000)

/**
 * Build a per-project financial model from the project's economic fields, split
 * into contracted and speculative revenue when offtake agreements exist.
 *
 * Revenue model: `estimated_credits` is treated as the TOTAL credits issued over
 * the project lifetime, so annual credits = estimated_credits / lifetime, and
 * annual revenue = annual credits × credit_price. Annual net = revenue − opex.
 * Cashflows = [−capex, net, net, … (lifetime years)].
 *
 * With offtakes, revenue becomes **blended**: the contracted volume earns its
 * negotiated price, and only the *remaining* credits are valued at the listed
 * `credit_price`. That is strictly more truthful than the listed-price-for-
 * everything model, because an ERPA price is a real number and a listed price is
 * an assumption.
 *
 * `irrContracted` re-runs the model on contracted revenue ALONE — the downside
 * case where not a single speculative credit sells. That is the number a
 * diligence team trusts, and it is why this split exists.
 *
 * @param {Object} project - a projects row (capex, opex, project_lifetime_years,
 *   estimated_credits, credit_price, funding_target, funding_raised)
 * @param {number} [discountRate=0.1] - annual discount rate for NPV
 * @param {{contractedVolume?:number, contractedRevenue?:number, agreementCount?:number}} [offtake]
 *   aggregate from `summarizeOfftakes` / the `offtake_summary` RPC. Omit for none.
 * @returns {Object} model incl. hasFinancials flag; degrades gracefully.
 */
export function computeProjectFinancials(project = {}, discountRate = 0.1, offtake = null) {
  const capex = Number(project.capex) || 0
  const opex = Number(project.opex) || 0
  const lifetime = Math.floor(Number(project.project_lifetime_years) || 0)
  const credits = Number(project.estimated_credits) || 0
  const price = Number(project.credit_price) || 0

  // Value of every estimated credit at the *listed* price — the legacy basis.
  const grossRevenue = round2(credits * price)

  const agreementCount = Number(offtake?.agreementCount) || 0
  const rawContractedVolume = Math.max(0, Number(offtake?.contractedVolume) || 0)
  const rawContractedRevenue = round2(Math.max(0, Number(offtake?.contractedRevenue) || 0))

  // A developer can contract MORE volume than the project is estimated to issue.
  // That is a real integrity signal, and the excess is not realizable revenue: the
  // project can only ever deliver `credits`. Value the excess at the negotiated
  // price would model income from credits that cannot exist, overstating projected
  // value, IRR and NPV. So clamp the contracted position to the deliverable volume
  // at the same average negotiated price, and surface the over-commitment flag.
  const overCommitted = rawContractedVolume > credits && credits > 0
  const deliverableFraction =
    overCommitted && rawContractedVolume > 0 ? credits / rawContractedVolume : 1
  const contractedVolume = round2(overCommitted ? credits : rawContractedVolume)
  const contractedRevenue = round2(rawContractedRevenue * deliverableFraction)

  const speculativeVolume = round2(Math.max(0, credits - contractedVolume))
  const speculativeRevenue = round2(speculativeVolume * price)

  // Any signed/active agreement makes this a blended model — including a legitimately
  // zero-priced (donated/prepaid) offtake. Gating on contractedRevenue > 0 wrongly
  // re-valued already-committed volume at the listed speculative price.
  const hasOfftake = agreementCount > 0
  const totalRevenue = hasOfftake ? round2(contractedRevenue + speculativeRevenue) : grossRevenue
  // A ratio, not a peso amount — round2 here would quantize 67.7% to 68%.
  const contractedShare = totalRevenue > 0 ? asRate(contractedRevenue / totalRevenue) : 0

  const fundingTarget = project.funding_target != null ? Number(project.funding_target) : null
  const fundingRaised = project.funding_raised != null ? Number(project.funding_raised) : null
  const fundingGap =
    fundingTarget != null ? round2(Math.max(0, fundingTarget - (fundingRaised || 0))) : null

  const offtakeFields = {
    contractedVolume,
    // Raw volume the developer actually signed, before clamping to deliverable
    // issuance — so the UI can show HOW over-committed a project is, not just that
    // it is. Equals contractedVolume unless overCommitted.
    committedVolume: round2(rawContractedVolume),
    contractedRevenue,
    speculativeVolume,
    speculativeRevenue,
    contractedShare,
    agreementCount,
    overCommitted,
    revenueBasis: hasOfftake ? 'blended' : 'listed',
  }

  // Enough to model a return series?
  const hasFinancials = capex > 0 && lifetime > 0 && totalRevenue > 0

  if (!hasFinancials) {
    return {
      hasFinancials: false,
      capex,
      opex,
      lifetimeYears: lifetime,
      grossRevenue,
      totalRevenue,
      annualRevenue: lifetime > 0 ? round2(totalRevenue / lifetime) : 0,
      annualNet: null,
      npv: null,
      irr: null,
      irrContracted: null,
      npvContracted: null,
      paybackYears: null,
      fundingTarget,
      fundingRaised,
      fundingGap,
      cashflows: [],
      ...offtakeFields,
    }
  }

  const annualRevenue = round2(totalRevenue / lifetime)
  const annualNet = round2(annualRevenue - opex)
  const cashflows = [-capex, ...Array.from({ length: lifetime }, () => annualNet)]

  // Downside case: only contracted revenue materialises.
  //
  // `irrContracted` is null in TWO different situations, and a reader must not
  // confuse them, so `contractedCoversOpex` disambiguates:
  //   • nothing contracted        → contractedAnnualNet null, coversOpex null
  //   • contracted, but annual contracted revenue ≤ opex → every year is negative,
  //     there is no sign change, so no real IRR exists. coversOpex false. This is
  //     a solvency warning, not a missing number, and rendering it as "—" alongside
  //     the no-contract case would hide it.
  let irrContracted = null
  let npvContracted = null
  let contractedAnnualNet = null
  let contractedCoversOpex = null
  if (contractedRevenue > 0) {
    contractedAnnualNet = round2(round2(contractedRevenue / lifetime) - opex)
    contractedCoversOpex = contractedAnnualNet > 0
    const contractedFlows = [-capex, ...Array.from({ length: lifetime }, () => contractedAnnualNet)]
    irrContracted = asRate(computeIrr(contractedFlows))
    npvContracted = round2(computeNpv(discountRate, contractedFlows))
  }

  return {
    hasFinancials: true,
    capex,
    opex,
    lifetimeYears: lifetime,
    grossRevenue,
    totalRevenue,
    annualRevenue,
    annualNet,
    npv: round2(computeNpv(discountRate, cashflows)),
    irr: asRate(computeIrr(cashflows)),
    irrContracted,
    npvContracted,
    contractedAnnualNet,
    contractedCoversOpex,
    paybackYears: computePayback(cashflows),
    fundingTarget,
    fundingRaised,
    fundingGap,
    cashflows,
    ...offtakeFields,
  }
}
