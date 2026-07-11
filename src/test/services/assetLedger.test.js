import { describe, it, expect } from 'vitest'
import { aggregateAssetLedger } from '@/services/assetLedgerService'

describe('aggregateAssetLedger', () => {
  it('returns an empty ledger for no input', () => {
    const { rows, totals } = aggregateAssetLedger()
    expect(rows).toEqual([])
    expect(totals.projects).toBe(0)
    expect(totals.issued).toBe(0)
    expect(totals.soldValue).toBe(0)
  })

  it('rolls up the full lifecycle per project', () => {
    const out = aggregateAssetLedger({
      projects: [
        { id: 'p1', title: 'Rice Husk', status: 'validated', estimated_credits: 1000, credit_price: 50 },
        { id: 'p2', title: 'Bagasse', status: 'submitted', estimated_credits: 500, credit_price: 40 },
      ],
      pools: [
        { project_id: 'p1', total_credits: 800, credits_available: 300, price_per_credit: 55, currency: 'PHP' },
      ],
      sales: [
        { project_id: 'p1', quantity: 400, total_amount: 22000, status: 'completed' },
        { project_id: 'p1', quantity: 100, total_amount: 5500, status: 'completed' },
        { project_id: 'p1', quantity: 50, total_amount: 2750, status: 'pending' }, // ignored
      ],
      vers: [
        { project_id: 'p1', approved_quantity: 800, status: 'approved' },
        { project_id: 'p1', approved_quantity: 200, status: 'pending' },
      ],
      retirements: [{ project_id: 'p1', quantity: 120 }],
    })

    const p1 = out.rows.find((r) => r.projectId === 'p1')
    expect(p1.estimated).toBe(1000)
    expect(p1.issued).toBe(800) // from pool.total_credits
    expect(p1.pending).toBe(200) // pending VER
    expect(p1.sold).toBe(500) // only completed sales
    expect(p1.soldValue).toBe(27500)
    expect(p1.retired).toBe(120)
    expect(p1.inventory).toBe(300) // pool.credits_available
    expect(p1.pricePerCredit).toBe(55) // pool price wins over project credit_price
    expect(p1.inventoryValue).toBe(16500) // 300 * 55

    const p2 = out.rows.find((r) => r.projectId === 'p2')
    expect(p2.issued).toBe(0) // no pool, no VER
    expect(p2.sold).toBe(0)
    expect(p2.inventory).toBe(0)
    expect(p2.pricePerCredit).toBe(40) // falls back to project.credit_price
  })

  it('derives issued from approved VER and inventory from issued − sold when no pool exists', () => {
    const { rows } = aggregateAssetLedger({
      projects: [{ id: 'p1', title: 'X', credit_price: 10 }],
      vers: [{ project_id: 'p1', approved_quantity: 300, status: 'approved' }],
      sales: [{ project_id: 'p1', quantity: 100, total_amount: 1000, status: 'completed' }],
    })
    const p1 = rows[0]
    expect(p1.issued).toBe(300)
    expect(p1.inventory).toBe(200) // 300 − 100
  })

  it('degrades gracefully when MRV tables are absent (empty vers/retirements)', () => {
    const { rows, totals } = aggregateAssetLedger({
      projects: [{ id: 'p1', title: 'X', estimated_credits: 100, credit_price: 20 }],
      pools: [{ project_id: 'p1', total_credits: 90, credits_available: 40, price_per_credit: 20 }],
      sales: [{ project_id: 'p1', quantity: 50, total_amount: 1000, status: 'completed' }],
    })
    const p1 = rows[0]
    expect(p1.issued).toBe(90)
    expect(p1.pending).toBe(0)
    expect(p1.retired).toBe(0)
    expect(p1.inventory).toBe(40)
    expect(totals.inventoryValue).toBe(800) // 40 * 20
    expect(totals.soldValue).toBe(1000)
  })

  it('sorts rows by sold value, then inventory value, descending', () => {
    const { rows } = aggregateAssetLedger({
      projects: [
        { id: 'low', title: 'Low' },
        { id: 'high', title: 'High' },
      ],
      sales: [
        { project_id: 'low', quantity: 1, total_amount: 100, status: 'completed' },
        { project_id: 'high', quantity: 1, total_amount: 900, status: 'completed' },
      ],
    })
    expect(rows.map((r) => r.projectId)).toEqual(['high', 'low'])
  })

  it('sums grand totals across projects', () => {
    const { totals } = aggregateAssetLedger({
      projects: [
        { id: 'p1', title: 'A', estimated_credits: 100 },
        { id: 'p2', title: 'B', estimated_credits: 200 },
      ],
      pools: [
        { project_id: 'p1', total_credits: 80, credits_available: 30, price_per_credit: 10 },
        { project_id: 'p2', total_credits: 150, credits_available: 50, price_per_credit: 10 },
      ],
      sales: [
        { project_id: 'p1', quantity: 50, total_amount: 500, status: 'completed' },
        { project_id: 'p2', quantity: 100, total_amount: 1000, status: 'completed' },
      ],
    })
    expect(totals.projects).toBe(2)
    expect(totals.estimated).toBe(300)
    expect(totals.issued).toBe(230)
    expect(totals.sold).toBe(150)
    expect(totals.inventory).toBe(80)
    expect(totals.soldValue).toBe(1500)
    expect(totals.inventoryValue).toBe(800) // (30+50) * 10
  })
})

describe('aggregateAssetLedger — buyer history', () => {
  const base = {
    projects: [{ id: 'p1', title: 'Rice husk', estimated_credits: 100, credit_price: 500 }],
    buyerProfiles: {
      b1: { full_name: 'Ana Cruz', organization_name: 'Acme Offsets' },
      b2: { full_name: 'Ben Reyes' },
    },
  }

  it('groups repeat purchases by the same buyer into one row', () => {
    const { rows } = aggregateAssetLedger({
      ...base,
      sales: [
        { project_id: 'p1', buyer_id: 'b1', quantity: 10, total_amount: 5000, status: 'completed', created_at: '2026-01-05' },
        { project_id: 'p1', buyer_id: 'b1', quantity: 5, total_amount: 2500, status: 'completed', created_at: '2026-03-09' },
      ],
    })
    expect(rows[0].buyers).toHaveLength(1)
    expect(rows[0].buyers[0]).toMatchObject({ quantity: 15, value: 7500, purchases: 2 })
    expect(rows[0].buyerCount).toBe(1)
  })

  it('keeps the most recent purchase date', () => {
    const { rows } = aggregateAssetLedger({
      ...base,
      sales: [
        { project_id: 'p1', buyer_id: 'b1', quantity: 5, total_amount: 1, status: 'completed', created_at: '2026-03-09' },
        { project_id: 'p1', buyer_id: 'b1', quantity: 5, total_amount: 1, status: 'completed', created_at: '2026-01-05' },
      ],
    })
    expect(rows[0].buyers[0].lastPurchaseAt).toBe('2026-03-09')
  })

  it('prefers organization name, falls back to full name', () => {
    const { rows } = aggregateAssetLedger({
      ...base,
      sales: [
        { project_id: 'p1', buyer_id: 'b1', quantity: 9, total_amount: 1, status: 'completed' },
        { project_id: 'p1', buyer_id: 'b2', quantity: 1, total_amount: 1, status: 'completed' },
      ],
    })
    expect(rows[0].buyers[0].name).toBe('Acme Offsets')
    expect(rows[0].buyers[1].name).toBe('Ben Reyes')
  })

  it('degrades to "Unknown buyer" when the profile is unreadable', () => {
    const { rows } = aggregateAssetLedger({
      projects: base.projects,
      sales: [{ project_id: 'p1', buyer_id: 'ghost', quantity: 1, total_amount: 1, status: 'completed' }],
    })
    expect(rows[0].buyers[0].name).toBe('Unknown buyer')
  })

  it('sorts buyers by quantity, largest counterparty first', () => {
    const { rows } = aggregateAssetLedger({
      ...base,
      sales: [
        { project_id: 'p1', buyer_id: 'b2', quantity: 3, total_amount: 1, status: 'completed' },
        { project_id: 'p1', buyer_id: 'b1', quantity: 30, total_amount: 1, status: 'completed' },
      ],
    })
    expect(rows[0].buyers.map((b) => b.buyerId)).toEqual(['b1', 'b2'])
  })

  it('excludes non-completed sales from buyer history', () => {
    const { rows } = aggregateAssetLedger({
      ...base,
      sales: [{ project_id: 'p1', buyer_id: 'b1', quantity: 10, total_amount: 1, status: 'pending' }],
    })
    expect(rows[0].buyers).toEqual([])
    expect(rows[0].buyerCount).toBe(0)
  })

  it('counts a buyer of two projects once in the portfolio total', () => {
    const { totals } = aggregateAssetLedger({
      projects: [{ id: 'p1' }, { id: 'p2' }],
      sales: [
        { project_id: 'p1', buyer_id: 'b1', quantity: 1, total_amount: 1, status: 'completed' },
        { project_id: 'p2', buyer_id: 'b1', quantity: 1, total_amount: 1, status: 'completed' },
      ],
    })
    expect(totals.buyers).toBe(1)
  })

  it('buckets sales with no buyer_id as a single unattributed row', () => {
    const { rows, totals } = aggregateAssetLedger({
      projects: base.projects,
      sales: [
        { project_id: 'p1', quantity: 2, total_amount: 1, status: 'completed' },
        { project_id: 'p1', quantity: 3, total_amount: 1, status: 'completed' },
      ],
    })
    expect(rows[0].buyers).toHaveLength(1)
    expect(rows[0].buyers[0].buyerId).toBeNull()
    expect(rows[0].buyers[0].quantity).toBe(5)
    expect(totals.buyers).toBe(1)
  })
})
