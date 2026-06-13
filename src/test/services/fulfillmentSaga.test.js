import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runFulfillment } from '@/services/credits/fulfillmentSaga'
import { MockCreditSupplier } from '@/services/credits/MockCreditSupplier'

/**
 * Minimal in-memory fake of the supabase-js surface the saga uses:
 *   from('supplier_orders').upsert(row, {onConflict, ignoreDuplicates})
 *   from('supplier_orders').select('*').eq('transaction_id', id).single()
 *   from('supplier_orders').update(patch).eq('transaction_id', id).select('*').single()
 *   rpc('refund_purchase', { p_transaction_id, p_reason })
 */
function makeFakeSupabase({ refundFails = false } = {}) {
  const rows = new Map() // transaction_id -> row
  const refundCalls = []

  function table() {
    let pendingPatch = null
    let txnFilter = null
    const api = {
      upsert(row, opts = {}) {
        const key = row.transaction_id
        if (rows.has(key) && opts.ignoreDuplicates) return Promise.resolve({ error: null })
        rows.set(key, { attempts: 0, ...(rows.get(key) || {}), ...row })
        return Promise.resolve({ error: null })
      },
      select() {
        return api
      },
      update(patch) {
        pendingPatch = patch
        return api
      },
      eq(_col, val) {
        txnFilter = val
        return api
      },
      single() {
        if (pendingPatch) {
          const existing = rows.get(txnFilter) || { transaction_id: txnFilter }
          const updated = { ...existing, ...pendingPatch }
          rows.set(txnFilter, updated)
          pendingPatch = null
          return Promise.resolve({ data: updated, error: null })
        }
        const found = rows.get(txnFilter)
        return Promise.resolve({ data: found || null, error: found ? null : { message: 'not found' } })
      },
    }
    return api
  }

  return {
    _rows: rows,
    _refundCalls: refundCalls,
    from: () => table(),
    rpc: (name, args) => {
      if (name === 'refund_purchase') {
        refundCalls.push(args)
        return Promise.resolve({ error: refundFails ? { message: 'refund rpc failed' } : null })
      }
      return Promise.resolve({ data: null, error: null })
    },
  }
}

describe('runFulfillment saga', () => {
  let supplier
  let attachRegistry
  beforeEach(() => {
    supplier = new MockCreditSupplier()
    attachRegistry = vi.fn().mockResolvedValue({})
  })

  it('happy path: order → retire → certificate updated, no refund', async () => {
    const supabase = makeFakeSupabase()
    const result = await runFulfillment({
      supabase,
      supplier,
      transactionId: 'txn_1',
      quantity: 2,
      certificateId: 'cert_1',
      attachRegistry,
    })

    expect(result.status).toBe('retired')
    expect(result.registrySerial).toMatch(/^ECO-MOCK-REG-/)
    expect(result.retirementReceiptUrl).toContain('mock_order_')
    expect(supabase._rows.get('txn_1').status).toBe('retired')
    expect(attachRegistry).toHaveBeenCalledOnce()
    expect(supabase._refundCalls).toHaveLength(0)
  })

  it('placeOrder failure → compensates via refund_purchase, returns refunded', async () => {
    const supabase = makeFakeSupabase()
    supplier._failNext = 'placeOrder'
    const result = await runFulfillment({
      supabase,
      supplier,
      transactionId: 'txn_2',
      quantity: 1,
      certificateId: 'cert_2',
      attachRegistry,
    })

    expect(result.status).toBe('refunded')
    expect(supabase._refundCalls).toHaveLength(1)
    expect(supabase._refundCalls[0].p_transaction_id).toBe('txn_2')
    expect(supabase._rows.get('txn_2').status).toBe('refunded')
    expect(attachRegistry).not.toHaveBeenCalled()
  })

  it('retire failure → compensates via refund_purchase', async () => {
    const supabase = makeFakeSupabase()
    supplier._failNext = 'retire'
    const result = await runFulfillment({
      supabase,
      supplier,
      transactionId: 'txn_3',
      quantity: 1,
      certificateId: 'cert_3',
      attachRegistry,
    })

    expect(result.status).toBe('refunded')
    expect(supabase._refundCalls).toHaveLength(1)
  })

  it('refund itself failing leaves the order failed for manual review', async () => {
    const supabase = makeFakeSupabase({ refundFails: true })
    supplier._failNext = 'placeOrder'
    const result = await runFulfillment({
      supabase,
      supplier,
      transactionId: 'txn_4',
      quantity: 1,
      attachRegistry,
    })

    expect(result.status).toBe('failed')
    expect(supabase._rows.get('txn_4').status).toBe('failed')
  })

  it('is idempotent: a retired order short-circuits without re-ordering', async () => {
    const supabase = makeFakeSupabase()
    supabase._rows.set('txn_5', {
      transaction_id: 'txn_5',
      status: 'retired',
      supplier_order_id: 'mock_order_existing',
      registry_serial: 'ECO-MOCK-REG-99',
      retirement_receipt_url: 'https://mock.local/registry/retire/mock_order_existing',
    })
    const spy = vi.spyOn(supplier, 'placeOrder')

    const result = await runFulfillment({
      supabase,
      supplier,
      transactionId: 'txn_5',
      quantity: 1,
      attachRegistry,
    })

    expect(result.status).toBe('retired')
    expect(result.registrySerial).toBe('ECO-MOCK-REG-99')
    expect(spy).not.toHaveBeenCalled()
  })
})
