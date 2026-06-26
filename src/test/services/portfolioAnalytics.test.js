import { describe, it, expect } from 'vitest'
import { computePortfolioPnl } from '@/services/portfolioAnalytics'

describe('computePortfolioPnl', () => {
  it('returns zeros for an empty portfolio', () => {
    const r = computePortfolioPnl([], 100)
    expect(r).toEqual({
      ownedCredits: 0,
      costBasis: 0,
      marketValue: 0,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      pricedCredits: 0,
      unpricedCredits: 0,
    })
  })

  it('computes cost basis, market value and gain', () => {
    const holdings = [{ quantity: 10, purchase_price: 50 }] // paid 500
    const r = computePortfolioPnl(holdings, 80) // worth 800
    expect(r.ownedCredits).toBe(10)
    expect(r.costBasis).toBe(500)
    expect(r.marketValue).toBe(800)
    expect(r.unrealizedPnl).toBe(300)
    expect(r.unrealizedPnlPct).toBe(60)
  })

  it('reports a loss when the market price drops below cost', () => {
    const r = computePortfolioPnl([{ quantity: 4, purchase_price: 100 }], 75)
    expect(r.unrealizedPnl).toBe(-100)
    expect(r.unrealizedPnlPct).toBe(-25)
  })

  it('excludes retired holdings from the live position', () => {
    const holdings = [
      { quantity: 5, purchase_price: 50, ownership_status: 'owned' },
      { quantity: 5, purchase_price: 50, ownership_type: 'retired' },
    ]
    const r = computePortfolioPnl(holdings, 60)
    expect(r.ownedCredits).toBe(5)
    expect(r.costBasis).toBe(250)
  })

  it('counts unpriced holdings toward owned/market value but not the P&L %', () => {
    const holdings = [
      { quantity: 10, purchase_price: 50 }, // priced
      { quantity: 5 }, // no purchase price
    ]
    const r = computePortfolioPnl(holdings, 100)
    expect(r.ownedCredits).toBe(15)
    expect(r.pricedCredits).toBe(10)
    expect(r.unpricedCredits).toBe(5)
    expect(r.marketValue).toBe(1500) // all 15 × 100
    // P&L only over the 10 priced: 10×100 - 500 = 500
    expect(r.unrealizedPnl).toBe(500)
    expect(r.unrealizedPnlPct).toBe(100)
  })

  it('handles a zero / missing market price safely', () => {
    const r = computePortfolioPnl([{ quantity: 3, purchase_price: 40 }], 0)
    expect(r.marketValue).toBe(0)
    expect(r.unrealizedPnl).toBe(-120) // 0 - 120
    expect(r.unrealizedPnlPct).toBe(-100)
  })

  it('ignores zero/negative quantities', () => {
    const r = computePortfolioPnl([{ quantity: 0, purchase_price: 50 }], 100)
    expect(r.ownedCredits).toBe(0)
  })
})
