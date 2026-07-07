/**
 * PaymentProvider — the single interface every payment backend implements.
 *
 * Phase 1 goal: the purchase flow talks to *this* interface, never to a vendor
 * SDK directly, so the whole flow is buildable and testable against
 * MockPaymentProvider before any real PayMongo contract/sandbox is wired.
 *
 * IMPORTANT (server authority): `createCheckout` is designed to be called from
 * trusted server code (a Supabase Edge Function) with line items whose amounts
 * were recomputed from the listing — never with a client-supplied total. The
 * interface deliberately takes `lineItems` (name/quantity/unitAmount) rather
 * than a single opaque `amount`, so the caller is forced to be explicit.
 *
 * @typedef {Object} CheckoutLineItem
 * @property {string} name              Human-readable line label.
 * @property {number} quantity          Whole units (>= 1).
 * @property {number} unitAmount        Price per unit in MAJOR currency units (e.g. PHP), not centavos.
 *
 * @typedef {Object} CheckoutRequest
 * @property {string} referenceId       Our internal reference (e.g. payment_intent id) for reconciliation.
 * @property {CheckoutLineItem[]} lineItems
 * @property {string} [currency]        ISO code; defaults to 'PHP'.
 * @property {{ name?: string, email?: string, phone?: string }} [billing]
 * @property {string} successUrl
 * @property {string} cancelUrl
 * @property {Record<string, unknown>} [metadata]
 *
 * @typedef {Object} CheckoutResult
 * @property {string} sessionId
 * @property {string} checkoutUrl
 * @property {number} amount            Server-computed total (major units).
 * @property {string} currency
 * @property {string|null} expiresAt
 *
 * @typedef {Object} PaymentVerification
 * @property {'paid'|'pending'|'failed'} status
 * @property {string|null} paymentId
 * @property {number} amount            Amount actually charged (major units).
 * @property {string} currency
 * @property {number} fee               Provider fee (major units).
 * @property {string} paymentMethod     Normalized: 'card' | 'gcash' | 'maya' | ...
 *
 * @typedef {Object} RefundRequest
 * @property {string} paymentId
 * @property {number} amount
 * @property {string} [reason]
 *
 * @typedef {Object} RefundResult
 * @property {string} refundId
 * @property {'pending'|'completed'|'failed'} status
 */

export class PaymentProvider {
  /** @returns {string} stable provider id, e.g. 'mock' | 'paymongo'. */
  get id() {
    throw new Error('PaymentProvider.id not implemented')
  }

  /** @returns {boolean} whether this provider has the credentials it needs. */
  isConfigured() {
    return false
  }

  /**
   * Create a hosted checkout session.
   * @param {CheckoutRequest} _request
   * @returns {Promise<CheckoutResult>}
   */
  async createCheckout(_request) {
    throw new Error(`${this.id}.createCheckout not implemented`)
  }

  /**
   * Verify the outcome of a checkout/payment by session id.
   * @param {string} _sessionId
   * @returns {Promise<PaymentVerification>}
   */
  async verifyPayment(_sessionId) {
    throw new Error(`${this.id}.verifyPayment not implemented`)
  }

  /**
   * Refund a captured payment.
   * @param {RefundRequest} _request
   * @returns {Promise<RefundResult>}
   */
  async refund(_request) {
    throw new Error(`${this.id}.refund not implemented`)
  }

  /**
   * Verify a webhook signature. Pure/synchronous where possible.
   * @param {{ payload: string, signature: string, secret?: string }} _args
   * @returns {boolean|Promise<boolean>}
   */
  verifyWebhookSignature(_args) {
    throw new Error(`${this.id}.verifyWebhookSignature not implemented`)
  }

  /** @returns {Array<{ id: string, name: string }>} supported payment methods. */
  getSupportedMethods() {
    return []
  }
}

/**
 * Compute a checkout total from line items. Shared helper so every provider
 * (and the server) totals amounts identically. Rounds to 2 decimals.
 * @param {CheckoutLineItem[]} lineItems
 * @returns {number}
 */
export function totalFromLineItems(lineItems = []) {
  const total = lineItems.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0
    const unit = Number(item?.unitAmount) || 0
    return sum + qty * unit
  }, 0)
  return Math.round(total * 100) / 100
}
