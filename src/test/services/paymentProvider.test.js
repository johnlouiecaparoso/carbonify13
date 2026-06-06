import { describe, it, expect, beforeEach } from 'vitest'
import { MockPaymentProvider } from '@/services/payments/MockPaymentProvider'
import { PaymentProvider, totalFromLineItems } from '@/services/payments/PaymentProvider'
import { setPaymentProvider, getPaymentProvider } from '@/services/payments'

describe('totalFromLineItems', () => {
  it('sums quantity * unitAmount and rounds to 2 decimals', () => {
    expect(totalFromLineItems([{ quantity: 3, unitAmount: 10.5 }])).toBe(31.5)
    expect(totalFromLineItems([{ quantity: 2, unitAmount: 1.005 }])).toBe(2.01)
    expect(totalFromLineItems([])).toBe(0)
  })

  it('ignores malformed items rather than producing NaN', () => {
    expect(totalFromLineItems([{ quantity: 'x', unitAmount: 5 }, { quantity: 2, unitAmount: 4 }])).toBe(8)
  })
})

describe('PaymentProvider (base)', () => {
  it('throws for unimplemented methods', async () => {
    const base = new PaymentProvider()
    await expect(base.createCheckout({})).rejects.toThrow(/not implemented/)
    expect(base.isConfigured()).toBe(false)
    expect(base.getSupportedMethods()).toEqual([])
  })
})

describe('MockPaymentProvider', () => {
  let provider
  beforeEach(() => {
    provider = new MockPaymentProvider()
  })

  it('computes the total from line items, never a passed-in amount', async () => {
    const checkout = await provider.createCheckout({
      referenceId: 'pi_1',
      lineItems: [{ name: 'Credits', quantity: 4, unitAmount: 25 }],
      // note: deliberately no top-level `amount` — the provider must derive it
    })
    expect(checkout.amount).toBe(100)
    expect(checkout.sessionId).toMatch(/^mock_session_/)
    expect(checkout.checkoutUrl).toContain(checkout.sessionId)
  })

  it('rejects empty or non-positive checkouts', async () => {
    await expect(provider.createCheckout({ lineItems: [] })).rejects.toThrow(/at least one line item/)
    await expect(
      provider.createCheckout({ lineItems: [{ name: 'x', quantity: 0, unitAmount: 0 }] }),
    ).rejects.toThrow(/non-positive/)
  })

  it('verifyPayment returns the recorded amount for a known session', async () => {
    const { sessionId } = await provider.createCheckout({
      lineItems: [{ name: 'Credits', quantity: 2, unitAmount: 50 }],
    })
    const result = await provider.verifyPayment(sessionId)
    expect(result.status).toBe('paid')
    expect(result.amount).toBe(100)
    expect(result.fee).toBe(2) // 2% of 100
    expect(result.paymentId).toContain(sessionId)
  })

  it('verifyPayment fails closed for an unknown session', async () => {
    const result = await provider.verifyPayment('does_not_exist')
    expect(result.status).toBe('failed')
    expect(result.amount).toBe(0)
  })

  it('verifyWebhookSignature accepts only the matching mock signature', () => {
    expect(provider.verifyWebhookSignature({ payload: 'abc', signature: 'mock-valid:abc' })).toBe(true)
    expect(provider.verifyWebhookSignature({ payload: 'abc', signature: 'mock-valid:xyz' })).toBe(false)
    expect(provider.verifyWebhookSignature({ payload: 'abc', signature: 'garbage' })).toBe(false)
  })

  it('refund returns a completed mock refund', async () => {
    const refund = await provider.refund({ paymentId: 'mock_pay_1', amount: 50 })
    expect(refund.status).toBe('completed')
    expect(refund.refundId).toContain('mock_pay_1')
  })
})

describe('getPaymentProvider factory', () => {
  beforeEach(() => setPaymentProvider(null))

  it('returns and caches an injected provider', () => {
    const mock = new MockPaymentProvider()
    setPaymentProvider(mock)
    expect(getPaymentProvider()).toBe(mock)
    expect(getPaymentProvider()).toBe(mock)
  })

  it('falls back to a working provider when none is injected', () => {
    const provider = getPaymentProvider()
    expect(provider).toBeInstanceOf(PaymentProvider)
    expect(typeof provider.createCheckout).toBe('function')
  })
})
