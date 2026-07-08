import { describe, it, expect } from 'vitest'
import {
  computeNpv,
  computeIrr,
  computePayback,
  computeProjectFinancials,
} from '@/services/investorAnalytics'
import { summarizePipeline, documentCount } from '@/services/investorService'

describe('computeNpv', () => {
  it('discounts future cashflows', () => {
    // -100 now, +110 in one year at 10% → NPV 0
    expect(computeNpv(0.1, [-100, 110])).toBeCloseTo(0, 6)
    // undiscounted at rate 0 = plain sum
    expect(computeNpv(0, [-100, 50, 60])).toBe(10)
  })
})

describe('computeIrr', () => {
  it('finds the rate that zeroes NPV', () => {
    expect(computeIrr([-100, 110])).toBeCloseTo(0.1, 4)
    // classic even series
    const irr = computeIrr([-1000, 400, 400, 400])
    expect(irr).toBeGreaterThan(0.09)
    expect(irr).toBeLessThan(0.1)
  })

  it('returns null with no sign change or too-short series', () => {
    expect(computeIrr([100, 200])).toBeNull()
    expect(computeIrr([-100, -50])).toBeNull()
    expect(computeIrr([-100])).toBeNull()
  })
})

describe('computePayback', () => {
  it('interpolates the crossing year', () => {
    // -100, then 60/yr → recovered partway through year 2
    expect(computePayback([-100, 60, 60])).toBeCloseTo(1.667, 2)
  })
  it('returns 0 when already non-negative at t0 and null when never recovered', () => {
    expect(computePayback([0, 10])).toBe(0)
    expect(computePayback([-100, 10, 10])).toBeNull()
  })
})

describe('computeProjectFinancials', () => {
  it('models a fully-specified project (IRR/NPV/payback)', () => {
    const f = computeProjectFinancials(
      {
        capex: 1000,
        opex: 100,
        project_lifetime_years: 5,
        estimated_credits: 2500, // 500/yr
        credit_price: 1, // ₱1/credit → 500/yr revenue, net 400/yr
        funding_target: 1200,
        funding_raised: 300,
      },
      0.1,
    )
    expect(f.hasFinancials).toBe(true)
    expect(f.grossRevenue).toBe(2500)
    expect(f.annualRevenue).toBe(500)
    expect(f.annualNet).toBe(400)
    expect(f.irr).toBeGreaterThan(0.28) // IRR of [-1000,400×5] ≈ 28.6%
    expect(f.irr).toBeLessThan(0.29)
    expect(f.paybackYears).toBeCloseTo(2.5, 1)
    expect(f.fundingGap).toBe(900) // 1200 - 300
  })

  it('degrades gracefully without capex/lifetime', () => {
    const f = computeProjectFinancials({ estimated_credits: 1000, credit_price: 2 })
    expect(f.hasFinancials).toBe(false)
    expect(f.grossRevenue).toBe(2000)
    expect(f.irr).toBeNull()
    expect(f.npv).toBeNull()
    expect(f.cashflows).toEqual([])
  })

  it('reports a funding gap even without a full model', () => {
    const f = computeProjectFinancials({ funding_target: 500, funding_raised: 200 })
    expect(f.fundingGap).toBe(300)
    expect(f.hasFinancials).toBe(false)
  })
})

describe('summarizePipeline', () => {
  it('aggregates totals, category breakdown, and average IRR', () => {
    const projects = [
      { category: 'Biochar', estimated_credits: 100, financials: { grossRevenue: 1000, hasFinancials: true, irr: 0.2, fundingTarget: 500, fundingGap: 300 } },
      { category: 'Biochar', estimated_credits: 50, financials: { grossRevenue: 500, hasFinancials: true, irr: 0.3, fundingTarget: 200, fundingGap: 0 } },
      { category: 'Solar', estimated_credits: 200, financials: { grossRevenue: 4000, hasFinancials: false, irr: null } },
    ]
    const s = summarizePipeline(projects)
    expect(s.projects).toBe(3)
    expect(s.credits).toBe(350)
    expect(s.grossRevenue).toBe(5500)
    expect(s.fundingTarget).toBe(700)
    expect(s.fundingGap).toBe(300)
    expect(s.withFinancials).toBe(2)
    expect(s.avgIrr).toBeCloseTo(0.25, 4) // (0.2 + 0.3)/2
    expect(s.byCategory[0]).toMatchObject({ category: 'Solar', grossRevenue: 4000 }) // highest revenue first
  })

  it('handles an empty pipeline', () => {
    const s = summarizePipeline([])
    expect(s.projects).toBe(0)
    expect(s.avgIrr).toBeNull()
    expect(s.byCategory).toEqual([])
  })
})

describe('documentCount', () => {
  it('counts supporting_documents whether JSON string or array', () => {
    expect(documentCount({ supporting_documents: '[{"name":"a"},{"name":"b"}]' })).toBe(2)
    expect(documentCount({ supporting_documents: [{ name: 'a' }] })).toBe(1)
    expect(documentCount({ supporting_documents: null })).toBe(0)
    expect(documentCount({})).toBe(0)
    expect(documentCount({ supporting_documents: 'not json' })).toBe(0)
  })
})
