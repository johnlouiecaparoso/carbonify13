import { PaymentProvider, totalFromLineItems } from './PaymentProvider'
import {
  createCheckoutSession,
  processPaymentCallback,
  isPayMongoConfigured,
} from '@/services/paymongoService'
import { processRefund, getSupportedPaymentMethods } from '@/services/paymentGatewayService'

/**
 * PayMongo-backed provider. Thin adapter over the existing paymongoService /
 * paymentGatewayService functions so the rest of Phase 1 can depend on the
 * PaymentProvider interface instead of those concrete modules.
 *
 * NOTE: createCheckout here still flows through the browser today. Phase 1.2
 * moves the authoritative amount computation into the Edge Function; this
 * adapter already totals from line items (not a passed-in amount) so callers
 * are interface-correct ahead of that move.
 */
export class PayMongoProvider extends PaymentProvider {
  get id() {
    return 'paymongo'
  }

  isConfigured() {
    try {
      return isPayMongoConfigured()
    } catch {
      return false
    }
  }

  async createCheckout({ lineItems = [], currency = 'PHP', billing, metadata = {} }) {
    if (!lineItems.length) {
      throw new Error('createCheckout requires at least one line item')
    }
    const amount = totalFromLineItems(lineItems)
    if (amount <= 0) {
      throw new Error('createCheckout computed a non-positive amount')
    }

    const first = lineItems[0]
    const result = await createCheckoutSession({
      amount,
      description: first?.name,
      billing,
      metadata: {
        ...metadata,
        quantity: metadata.quantity ?? first?.quantity,
        price_per_credit: metadata.price_per_credit ?? first?.unitAmount,
      },
    })

    return {
      sessionId: result.sessionId,
      checkoutUrl: result.checkoutUrl,
      amount: result.amount ?? amount,
      currency: result.currency ?? currency,
      expiresAt: result.expiresAt ?? null,
    }
  }

  async verifyPayment(sessionId) {
    const result = await processPaymentCallback(sessionId)
    const payment = result?.payment ?? {}
    const rawStatus = payment.status
    const status = rawStatus === 'paid' ? 'paid' : rawStatus === 'failed' ? 'failed' : 'pending'

    return {
      status,
      paymentId: payment.id ?? null,
      amount: Number(payment.amount) || 0,
      currency: payment.currency ?? 'PHP',
      fee: Number(payment.fee) || 0,
      paymentMethod: result?.paymentMethod ?? payment.payment_method ?? 'unknown',
    }
  }

  async refund({ paymentId, amount, reason }) {
    const refund = await processRefund(paymentId, amount, reason)
    return {
      refundId: refund.id,
      status: refund.status === 'completed' ? 'completed' : 'pending',
    }
  }

  /**
   * Verify a PayMongo webhook signature.
   * Header format: `t=<unix_ts>,te=<test_sig>,li=<live_sig>`; the signed message
   * is `${t}.${rawBody}`, HMAC-SHA256 with the webhook secret, hex-encoded.
   * @param {{ payload: string, signature: string, secret?: string }} args
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature({ payload, signature, secret }) {
    if (!secret || !signature || !payload) return false
    const parts = Object.fromEntries(
      signature.split(',').map((kv) => kv.split('=').map((s) => s.trim())),
    )
    const timestamp = parts.t
    const provided = parts.li || parts.te
    if (!timestamp || !provided) return false

    const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`)
    return timingSafeEqual(expected, provided)
  }

  getSupportedMethods() {
    try {
      return getSupportedPaymentMethods().map((m) => ({ id: m.id, name: m.name }))
    } catch {
      return []
    }
  }
}

/** HMAC-SHA256 hex digest using Web Crypto (browser + Deno). */
async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sigBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time-ish string comparison to avoid timing leaks. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
