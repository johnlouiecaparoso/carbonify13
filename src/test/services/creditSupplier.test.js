import { describe, it, expect, beforeEach } from 'vitest'
import { CreditSupplier } from '@/services/credits/CreditSupplier'
import { MockCreditSupplier } from '@/services/credits/MockCreditSupplier'
import { setCreditSupplier, getCreditSupplier } from '@/services/credits'

describe('CreditSupplier (base)', () => {
  it('throws for unimplemented methods', async () => {
    const base = new CreditSupplier()
    await expect(base.placeOrder({})).rejects.toThrow(/not implemented/)
    await expect(base.getOrder('x')).rejects.toThrow(/not implemented/)
    await expect(base.retire('x')).rejects.toThrow(/not implemented/)
    expect(base.isConfigured()).toBe(false)
  })
})

describe('MockCreditSupplier', () => {
  let supplier
  beforeEach(() => {
    supplier = new MockCreditSupplier()
  })

  it('placeOrder returns an order id + registry serial', async () => {
    const res = await supplier.placeOrder({ referenceId: 'txn_1', quantity: 3 })
    expect(res.orderId).toMatch(/^mock_order_/)
    expect(res.status).toBe('ordered')
    expect(res.registrySerial).toMatch(/^ECO-MOCK-REG-/)
    expect(res.retirementReceiptUrl).toBeNull()
  })

  it('placeOrder rejects a non-positive quantity', async () => {
    await expect(supplier.placeOrder({ referenceId: 'txn_1', quantity: 0 })).rejects.toThrow(
      /positive quantity/,
    )
  })

  it('getOrder returns the record, and fails closed for unknown ids', async () => {
    const { orderId } = await supplier.placeOrder({ referenceId: 'txn_1', quantity: 1 })
    const found = await supplier.getOrder(orderId)
    expect(found.status).toBe('ordered')
    const unknown = await supplier.getOrder('does_not_exist')
    expect(unknown.status).toBe('unknown')
  })

  it('retire flips the order to retired and yields a receipt url', async () => {
    const { orderId } = await supplier.placeOrder({ referenceId: 'txn_1', quantity: 1 })
    const res = await supplier.retire(orderId)
    expect(res.status).toBe('retired')
    expect(res.retirementReceiptUrl).toContain(orderId)
  })

  it('retire throws for an unknown order', async () => {
    await expect(supplier.retire('nope')).rejects.toThrow(/unknown order/)
  })

  it('_failNext forces a single failure of the named method', async () => {
    supplier._failNext = 'placeOrder'
    await expect(supplier.placeOrder({ referenceId: 'txn_1', quantity: 1 })).rejects.toThrow(/forced failure/)
    // cleared after one failure
    const ok = await supplier.placeOrder({ referenceId: 'txn_1', quantity: 1 })
    expect(ok.status).toBe('ordered')
  })
})

describe('getCreditSupplier factory', () => {
  beforeEach(() => setCreditSupplier(null))

  it('returns and caches an injected supplier', () => {
    const mock = new MockCreditSupplier()
    setCreditSupplier(mock)
    expect(getCreditSupplier()).toBe(mock)
    expect(getCreditSupplier()).toBe(mock)
  })

  it('falls back to a working supplier when none is injected', () => {
    const supplier = getCreditSupplier()
    expect(supplier).toBeInstanceOf(CreditSupplier)
    expect(typeof supplier.placeOrder).toBe('function')
  })
})
