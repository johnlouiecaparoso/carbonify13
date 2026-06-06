import { PaymentProvider, totalFromLineItems } from './PaymentProvider'

/**
 * Deterministic in-memory payment provider for development and tests.
 *
 * It records every checkout it creates so verifyPayment/refund can return
 * consistent results, and it computes the total from the line items (never a
 * client-supplied amount) — mirroring how the real server-authoritative flow
 * must behave.
 */
export class MockPaymentProvider extends PaymentProvider {
  constructor() {
    super()
    /** @type {Map<string, { amount: number, currency: string, refunded: boolean }>} */
    this._sessions = new Map()
    this._seq = 0
  }

  get id() {
    return 'mock'
  }

  isConfigured() {
    return true
  }

  async createCheckout({ referenceId, lineItems = [], currency = 'PHP' }) {
    if (!lineItems.length) {
      throw new Error('createCheckout requires at least one line item')
    }
    const amount = totalFromLineItems(lineItems)
    if (amount <= 0) {
      throw new Error('createCheckout computed a non-positive amount')
    }

    const sessionId = `mock_session_${++this._seq}_${referenceId ?? 'na'}`
    this._sessions.set(sessionId, { amount, currency, refunded: false })

    return {
      sessionId,
      checkoutUrl: `https://mock.local/checkout/${sessionId}`,
      amount,
      currency,
      expiresAt: null,
    }
  }

  async verifyPayment(sessionId) {
    const session = this._sessions.get(sessionId)
    if (!session) {
      return { status: 'failed', paymentId: null, amount: 0, currency: 'PHP', fee: 0, paymentMethod: 'unknown' }
    }
    return {
      status: 'paid',
      paymentId: `mock_pay_${sessionId}`,
      amount: session.amount,
      currency: session.currency,
      fee: Math.round(session.amount * 0.02 * 100) / 100, // flat 2% mock fee
      paymentMethod: 'gcash',
    }
  }

  async refund({ paymentId, amount }) {
    return {
      refundId: `mock_refund_${paymentId}_${amount}`,
      status: 'completed',
    }
  }

  /**
   * Mock signature check: deterministic and exercisable from tests.
   * Treats `mock-valid:<payload>` (or the literal 'mock-valid' for empty
   * payloads) as the only valid signature.
   */
  verifyWebhookSignature({ payload = '', signature = '' }) {
    return signature === `mock-valid:${payload}` || signature === 'mock-valid'
  }

  getSupportedMethods() {
    return [
      { id: 'gcash', name: 'GCash' },
      { id: 'maya', name: 'Maya' },
      { id: 'card', name: 'Card' },
    ]
  }
}
