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

/**
 * Build a per-project financial model from the project's economic fields.
 *
 * Revenue model: `estimated_credits` is treated as the TOTAL credits issued over
 * the project lifetime, so annual credits = estimated_credits / lifetime, and
 * annual revenue = annual credits × credit_price. Annual net = revenue − opex.
 * Cashflows = [−capex, net, net, … (lifetime years)].
 *
 * @param {Object} project - a projects row (capex, opex, project_lifetime_years,
 *   estimated_credits, credit_price, funding_target, funding_raised)
 * @param {number} [discountRate=0.1] - annual discount rate for NPV
 * @returns {Object} model incl. hasFinancials flag; degrades gracefully.
 */
export function computeProjectFinancials(project = {}, discountRate = 0.1) {
  const capex = Number(project.capex) || 0
  const opex = Number(project.opex) || 0
  const lifetime = Math.floor(Number(project.project_lifetime_years) || 0)
  const credits = Number(project.estimated_credits) || 0
  const price = Number(project.credit_price) || 0

  const grossRevenue = round2(credits * price)

  const fundingTarget = project.funding_target != null ? Number(project.funding_target) : null
  const fundingRaised = project.funding_raised != null ? Number(project.funding_raised) : null
  const fundingGap =
    fundingTarget != null ? round2(Math.max(0, fundingTarget - (fundingRaised || 0))) : null

  // Enough to model a return series?
  const hasFinancials = capex > 0 && lifetime > 0 && grossRevenue > 0

  if (!hasFinancials) {
    return {
      hasFinancials: false,
      capex,
      opex,
      lifetimeYears: lifetime,
      grossRevenue,
      annualRevenue: lifetime > 0 ? round2(grossRevenue / lifetime) : 0,
      annualNet: null,
      npv: null,
      irr: null,
      paybackYears: null,
      fundingTarget,
      fundingRaised,
      fundingGap,
      cashflows: [],
    }
  }

  const annualRevenue = round2(grossRevenue / lifetime)
  const annualNet = round2(annualRevenue - opex)
  const cashflows = [-capex, ...Array.from({ length: lifetime }, () => annualNet)]

  const irr = computeIrr(cashflows)
  return {
    hasFinancials: true,
    capex,
    opex,
    lifetimeYears: lifetime,
    grossRevenue,
    annualRevenue,
    annualNet,
    npv: round2(computeNpv(discountRate, cashflows)),
    irr: irr == null ? null : Math.round(irr * 10000) / 10000,
    paybackYears: computePayback(cashflows),
    fundingTarget,
    fundingRaised,
    fundingGap,
    cashflows,
  }
}
