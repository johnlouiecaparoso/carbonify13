import { describe, it, expect } from 'vitest'
import {
  validateOfftakeInput,
  agreementValue,
  summarizeOfftakes,
  CONTRACTED_STATUSES,
} from '@/services/offtakeService'
import { computeProjectFinancials } from '@/services/investorAnalytics'

describe('validateOfftakeInput', () => {
  const ok = { project_id: 'p1', counterparty_name: 'Acme', volume_credits: 100, price_per_credit: 700 }

  it('accepts a minimal valid agreement', () => {
    expect(validateOfftakeInput(ok)).toEqual([])
  })

  it('accepts a zero price (donated / bundled offtake)', () => {
    expect(validateOfftakeInput({ ...ok, price_per_credit: 0 })).toEqual([])
  })

  it('requires project, counterparty, volume, price', () => {
    const errs = validateOfftakeInput({})
    expect(errs).toContain('A project is required')
    expect(errs).toContain('A counterparty name is required')
    expect(errs).toContain('Enter a contracted volume greater than zero')
    expect(errs).toContain('Enter a price per credit of zero or more')
  })

  it('rejects a negative price and a non-positive volume', () => {
    expect(validateOfftakeInput({ ...ok, price_per_credit: -1 })).toContain(
      'Enter a price per credit of zero or more',
    )
    expect(validateOfftakeInput({ ...ok, volume_credits: 0 })).toContain(
      'Enter a contracted volume greater than zero',
    )
  })

  it('rejects an end date before the start date', () => {
    expect(
      validateOfftakeInput({ ...ok, start_date: '2027-01-01', end_date: '2026-01-01' }),
    ).toContain('The end date cannot be before the start date')
  })

  it('rejects an unknown status', () => {
    expect(validateOfftakeInput({ ...ok, status: 'bogus' })).toContain('Unknown agreement status')
  })
})

describe('agreementValue', () => {
  it('multiplies volume by price', () => {
    expect(agreementValue({ volume_credits: 100, price_per_credit: 7.5 })).toBe(750)
  })
  it('is zero for a missing agreement', () => {
    expect(agreementValue({})).toBe(0)
  })
})

describe('summarizeOfftakes', () => {
  it('counts only signed and active as contracted', () => {
    expect(CONTRACTED_STATUSES).toEqual(['signed', 'active'])
    const s = summarizeOfftakes([
      { status: 'signed', volume_credits: 100, price_per_credit: 700 },
      { status: 'active', volume_credits: 50, price_per_credit: 600 },
      { status: 'draft', volume_credits: 999, price_per_credit: 999 },
      { status: 'negotiating', volume_credits: 40, price_per_credit: 999 },
      { status: 'terminated', volume_credits: 999, price_per_credit: 999 },
      { status: 'completed', volume_credits: 999, price_per_credit: 999 },
    ])
    expect(s.contractedVolume).toBe(150)
    expect(s.contractedRevenue).toBe(100 * 700 + 50 * 600)
    expect(s.agreementCount).toBe(2)
  })

  it('tracks not-yet-contracted volume separately', () => {
    const s = summarizeOfftakes([
      { status: 'draft', volume_credits: 10, price_per_credit: 1 },
      { status: 'negotiating', volume_credits: 40, price_per_credit: 1 },
    ])
    expect(s.pipelineVolume).toBe(50)
    expect(s.contractedRevenue).toBe(0)
    expect(s.agreementCount).toBe(0)
  })

  it('excludes terminated agreements from every figure', () => {
    const s = summarizeOfftakes([{ status: 'terminated', volume_credits: 500, price_per_credit: 900 }])
    expect(s.contractedVolume).toBe(0)
    expect(s.contractedRevenue).toBe(0)
    expect(s.pipelineVolume).toBe(0)
  })

  it('handles empty and non-array input', () => {
    expect(summarizeOfftakes([]).contractedRevenue).toBe(0)
    expect(summarizeOfftakes(undefined).agreementCount).toBe(0)
  })
})

describe('computeProjectFinancials — contracted vs speculative', () => {
  // 1000 credits, listed ₱500, capex 200k, opex 20k/yr, 10-year life.
  // Sized so each scenario below is genuinely viable — with a heavier opex the
  // contracted-only cashflow turns negative in every year and IRR is legitimately
  // undefined (covered by its own test).
  const project = {
    estimated_credits: 1000,
    credit_price: 500,
    capex: 200_000,
    opex: 20_000,
    project_lifetime_years: 10,
  }

  it('falls back to the listed price when there is no offtake', () => {
    const f = computeProjectFinancials(project)
    expect(f.revenueBasis).toBe('listed')
    expect(f.totalRevenue).toBe(500_000)
    expect(f.contractedRevenue).toBe(0)
    expect(f.speculativeRevenue).toBe(500_000)
    expect(f.irrContracted).toBeNull()
  })

  it('blends the negotiated price with the listed price for the remainder', () => {
    // 600 credits contracted at ₱700 = 420,000; 400 left at ₱500 = 200,000.
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 600,
      contractedRevenue: 420_000,
      agreementCount: 1,
    })
    expect(f.revenueBasis).toBe('blended')
    expect(f.contractedRevenue).toBe(420_000)
    expect(f.speculativeVolume).toBe(400)
    expect(f.speculativeRevenue).toBe(200_000)
    expect(f.totalRevenue).toBe(620_000)
    // Blended beats the listed-only gross because the ERPA price is above list.
    expect(f.totalRevenue).toBeGreaterThan(f.grossRevenue)
  })

  it('reports contracted share of revenue', () => {
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 600,
      contractedRevenue: 420_000,
      agreementCount: 1,
    })
    expect(f.contractedShare).toBeCloseTo(420_000 / 620_000, 4)
  })

  it('computes a downside IRR on contracted revenue alone, below the blended IRR', () => {
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 600,
      contractedRevenue: 420_000,
      agreementCount: 1,
    })
    expect(f.irrContracted).not.toBeNull()
    expect(f.irrContracted).toBeLessThan(f.irr)
  })

  it('returns a null contracted IRR when nothing is contracted', () => {
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 0,
      contractedRevenue: 0,
      agreementCount: 0,
    })
    expect(f.irrContracted).toBeNull()
    expect(f.npvContracted).toBeNull()
    // No contract at all — distinct from "contract fails to cover opex".
    expect(f.contractedCoversOpex).toBeNull()
    expect(f.contractedAnnualNet).toBeNull()
  })

  it('distinguishes "no contract" from "contract does not cover opex"', () => {
    // 600 credits at ₱700 = 420,000 over 10y = 42,000/yr against 50,000 opex.
    // Every year is negative, so no real IRR exists — but that is a solvency
    // warning, not an absent contract, and must not render the same way.
    const f = computeProjectFinancials(
      { ...project, opex: 50_000 },
      0.1,
      { contractedVolume: 600, contractedRevenue: 420_000, agreementCount: 1 },
    )
    expect(f.irrContracted).toBeNull()
    expect(f.contractedCoversOpex).toBe(false)
    expect(f.contractedAnnualNet).toBe(-8000)
    expect(f.npvContracted).toBeLessThan(0)
  })

  it('flags over-commitment and never lets speculative volume go negative', () => {
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 1500, // more than the 1000 estimated credits
      contractedRevenue: 900_000,
      agreementCount: 2,
    })
    expect(f.overCommitted).toBe(true)
    expect(f.speculativeVolume).toBe(0)
    expect(f.speculativeRevenue).toBe(0)
    expect(f.totalRevenue).toBe(900_000)
  })

  it('does not flag over-commitment when volume exactly matches issuance', () => {
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 1000,
      contractedRevenue: 500_000,
      agreementCount: 1,
    })
    expect(f.overCommitted).toBe(false)
    expect(f.speculativeVolume).toBe(0)
  })

  it('a fully-contracted project has identical headline and contracted IRR', () => {
    const f = computeProjectFinancials(project, 0.1, {
      contractedVolume: 1000,
      contractedRevenue: 500_000,
      agreementCount: 1,
    })
    expect(f.irrContracted).toBe(f.irr)
    expect(f.contractedShare).toBe(1)
  })

  it('still degrades gracefully without capex/lifetime', () => {
    const f = computeProjectFinancials(
      { estimated_credits: 100, credit_price: 10 },
      0.1,
      { contractedVolume: 50, contractedRevenue: 600, agreementCount: 1 },
    )
    expect(f.hasFinancials).toBe(false)
    expect(f.irr).toBeNull()
    // Offtake context survives even when the return series can't be modelled.
    expect(f.contractedRevenue).toBe(600)
  })
})
