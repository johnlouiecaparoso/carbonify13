import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/supabaseClient', () => ({
  getSupabase: vi.fn(),
}))

import { getUserPurchaseHistoryPage } from '@/services/transactionHistoryService'
import { getSupabase } from '@/services/supabaseClient'

/**
 * Chainable supabase query-builder fake. The main purchase query resolves on
 * .range(); the follow-up certificates query resolves on .in() with `certResult`.
 */
function makeBuilder(result, certResult = { data: [], error: null }) {
  const calls = { eq: [], order: [], range: [], select: [], in: [] }
  const builder = {
    calls,
    select(sel, opts) {
      calls.select.push({ sel, opts })
      return builder
    },
    eq(col, val) {
      calls.eq.push([col, val])
      return builder
    },
    order(col, opts) {
      calls.order.push([col, opts])
      return builder
    },
    in(col, vals) {
      calls.in.push([col, vals])
      return Promise.resolve(certResult)
    },
    range(from, to) {
      calls.range.push([from, to])
      return Promise.resolve(result)
    },
  }
  return builder
}

describe('getUserPurchaseHistoryPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty without a userId (no DB call)', async () => {
    getSupabase.mockReturnValue({ from: vi.fn() })
    const res = await getUserPurchaseHistoryPage({ userId: null })
    expect(res).toEqual({ rows: [], total: 0, limit: 20, offset: 0 })
  })

  it('requests an exact count and the correct range window', async () => {
    const builder = makeBuilder({ data: [], count: 0, error: null })
    getSupabase.mockReturnValue({ from: () => builder })

    await getUserPurchaseHistoryPage({ userId: 'u1', limit: 10, offset: 20 })

    expect(builder.calls.select[0].opts).toEqual({ count: 'exact' })
    // range is inclusive: offset .. offset+limit-1
    expect(builder.calls.range[0]).toEqual([20, 29])
    expect(builder.calls.eq).toContainEqual(['buyer_id', 'u1'])
    expect(builder.calls.eq).toContainEqual(['status', 'completed'])
  })

  it('clamps limit to [1,100] and offset to >= 0', async () => {
    const builder = makeBuilder({ data: [], count: 0, error: null })
    getSupabase.mockReturnValue({ from: () => builder })

    const res = await getUserPurchaseHistoryPage({ userId: 'u1', limit: 9999, offset: -5 })
    expect(res.limit).toBe(100)
    expect(res.offset).toBe(0)
    expect(builder.calls.range[0]).toEqual([0, 99])
  })

  it('maps rows and returns the total count', async () => {
    const builder = makeBuilder({
      data: [
        {
          id: 'tx1',
          quantity: 3,
          total_amount: 1500,
          status: 'completed',
          completed_at: '2026-06-26T00:00:00Z',
          project_credits: { vintage_year: 2026, projects: { id: 'p1', title: 'Mangrove', category: 'Blue Carbon' } },
        },
      ],
      count: 42,
      error: null,
    })
    getSupabase.mockReturnValue({ from: () => builder })

    const res = await getUserPurchaseHistoryPage({ userId: 'u1' })
    expect(res.total).toBe(42)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0]).toMatchObject({
      transaction_id: 'tx1',
      project_title: 'Mangrove',
      credits_quantity: 3,
      vintage_year: 2026,
    })
  })

  it('attaches a certificate to the matching purchase row', async () => {
    const builder = makeBuilder(
      {
        data: [{ id: 'tx1', quantity: 1, total_amount: 500, status: 'completed', completed_at: '2026-06-26T00:00:00Z', project_credits: { projects: { id: 'p1', title: 'Mangrove' } } }],
        count: 1,
        error: null,
      },
      { data: [{ id: 'c1', transaction_id: 'tx1', certificate_number: 'CERT-001', status: 'issued' }], error: null },
    )
    getSupabase.mockReturnValue({ from: () => builder })

    const res = await getUserPurchaseHistoryPage({ userId: 'u1' })
    expect(builder.calls.in).toContainEqual(['transaction_id', ['tx1']])
    expect(res.rows[0].certificate_number).toBe('CERT-001')
    expect(res.rows[0].certificate).toMatchObject({ id: 'c1' })
  })

  it('lets the caller override the status filter', async () => {
    const builder = makeBuilder({ data: [], count: 0, error: null })
    getSupabase.mockReturnValue({ from: () => builder })

    await getUserPurchaseHistoryPage({ userId: 'u1', status: 'refunded' })
    expect(builder.calls.eq).toContainEqual(['status', 'refunded'])
  })

  it('returns empty on a query error', async () => {
    const builder = makeBuilder({ data: null, count: null, error: { message: 'boom' } })
    getSupabase.mockReturnValue({ from: () => builder })

    const res = await getUserPurchaseHistoryPage({ userId: 'u1' })
    expect(res.rows).toEqual([])
    expect(res.total).toBe(0)
  })
})
