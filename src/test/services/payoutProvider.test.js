import { describe, it, expect, beforeEach } from 'vitest'
import { MockPayoutProvider } from '@/services/payouts/MockPayoutProvider'
import {
  PayoutProvider,
  validatePayoutRequest,
  MIN_PAYOUT_AMOUNT,
} from '@/services/payouts/PayoutProvider'
import { getPayoutProvider, setPayoutProvider } from '@/services/payouts'

const goodDestination = {
  method: 'gcash',
  accountName: 'Jane Seller',
  accountNumber: '09171234567',
}

describe('validatePayoutRequest', () => {
  it('passes a well-formed request', () => {
    expect(validatePayoutRequest({ amount: 500, destination: goodDestination })).toEqual([])
  })

  it('flags below-minimum and non-positive amounts', () => {
    expect(validatePayoutRequest({ amount: 0, destination: goodDestination })).toContain(
      'amount must be a positive number',
    )
    expect(validatePayoutRequest({ amount: MIN_PAYOUT_AMOUNT - 1, destination: goodDestination })).toContain(
      `amount must be at least ${MIN_PAYOUT_AMOUNT}`,
    )
  })

  it('requires a valid destination and bankCode for bank payouts', () => {
    expect(validatePayoutRequest({ amount: 500, destination: { method: 'paypal' } }).length).toBeGreaterThan(0)
    const bankErrors = validatePayoutRequest({
      amount: 500,
      destination: { method: 'bank', accountName: 'X', accountNumber: '123' },
    })
    expect(bankErrors).toContain('destination.bankCode is required for bank payouts')
  })
})

describe('PayoutProvider (base)', () => {
  it('throws for unimplemented methods', async () => {
    const base = new PayoutProvider()
    await expect(base.createPayout({})).rejects.toThrow(/not implemented/)
    expect(base.isConfigured()).toBe(false)
    expect(base.getSupportedDestinations()).toEqual([])
  })
})

describe('MockPayoutProvider', () => {
  let provider
  beforeEach(() => {
    provider = new MockPayoutProvider()
  })

  it('settles a valid payout and reports a consistent status', async () => {
    const result = await provider.createPayout({
      payoutId: 'po_1',
      amount: 500,
      currency: 'PHP',
      destination: goodDestination,
    })
    expect(result.status).toBe('settled')
    expect(result.providerPayoutId).toMatch(/^mock_payout_/)

    const status = await provider.getPayoutStatus(result.providerPayoutId)
    expect(status.status).toBe('settled')
  })

  it('rejects an invalid request', async () => {
    await expect(
      provider.createPayout({ payoutId: 'po_2', amount: 10, destination: goodDestination }),
    ).rejects.toThrow(/invalid payout request/)
  })

  it('simulates failure for the FAIL sentinel account (dead-letter path)', async () => {
    const result = await provider.createPayout({
      payoutId: 'po_3',
      amount: 500,
      currency: 'PHP',
      destination: { ...goodDestination, accountNumber: 'FAIL' },
    })
    expect(result.status).toBe('failed')
    expect(result.failureReason).toBeTruthy()
  })
})

describe('getPayoutProvider factory', () => {
  beforeEach(() => setPayoutProvider(null))

  it('returns a working provider and caches an injected one', () => {
    const provider = getPayoutProvider()
    expect(provider).toBeInstanceOf(PayoutProvider)
    const mock = new MockPayoutProvider()
    setPayoutProvider(mock)
    expect(getPayoutProvider()).toBe(mock)
  })
})
