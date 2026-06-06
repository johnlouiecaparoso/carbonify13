import { describe, it, expect, beforeAll, vi } from 'vitest'

// Avoid pulling in real service side effects; PayMongoProvider only needs these
// modules to exist for its other methods, not for signature verification.
vi.mock('@/services/paymongoService', () => ({
  createCheckoutSession: vi.fn(),
  processPaymentCallback: vi.fn(),
  isPayMongoConfigured: () => false,
}))
vi.mock('@/services/paymentGatewayService', () => ({
  processRefund: vi.fn(),
  getSupportedPaymentMethods: () => [],
}))

import { PayMongoProvider } from '@/services/payments/PayMongoProvider'

const SECRET = 'whsec_test_123'
const PAYLOAD = JSON.stringify({ data: { id: 'evt_1' } })

/** Same algorithm the edge function uses: HMAC-SHA256 hex of `${t}.${payload}`. */
async function sign(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('PayMongoProvider.verifyWebhookSignature', () => {
  let provider
  beforeAll(() => {
    provider = new PayMongoProvider()
  })

  it('accepts a correctly-signed live (li) signature', async () => {
    const t = '1700000000'
    const sig = await sign(SECRET, `${t}.${PAYLOAD}`)
    const header = `t=${t},li=${sig}`
    expect(await provider.verifyWebhookSignature({ payload: PAYLOAD, signature: header, secret: SECRET })).toBe(true)
  })

  it('accepts a correctly-signed test (te) signature when li is absent', async () => {
    const t = '1700000000'
    const sig = await sign(SECRET, `${t}.${PAYLOAD}`)
    const header = `t=${t},te=${sig}`
    expect(await provider.verifyWebhookSignature({ payload: PAYLOAD, signature: header, secret: SECRET })).toBe(true)
  })

  it('rejects a tampered payload', async () => {
    const t = '1700000000'
    const sig = await sign(SECRET, `${t}.${PAYLOAD}`)
    const header = `t=${t},li=${sig}`
    const tampered = JSON.stringify({ data: { id: 'evt_EVIL' } })
    expect(await provider.verifyWebhookSignature({ payload: tampered, signature: header, secret: SECRET })).toBe(false)
  })

  it('rejects a wrong secret', async () => {
    const t = '1700000000'
    const sig = await sign('whsec_wrong', `${t}.${PAYLOAD}`)
    const header = `t=${t},li=${sig}`
    expect(await provider.verifyWebhookSignature({ payload: PAYLOAD, signature: header, secret: SECRET })).toBe(false)
  })

  it('rejects a malformed or empty header / missing secret', async () => {
    expect(await provider.verifyWebhookSignature({ payload: PAYLOAD, signature: 'garbage', secret: SECRET })).toBe(false)
    expect(await provider.verifyWebhookSignature({ payload: PAYLOAD, signature: '', secret: SECRET })).toBe(false)
    const t = '1700000000'
    const sig = await sign(SECRET, `${t}.${PAYLOAD}`)
    expect(await provider.verifyWebhookSignature({ payload: PAYLOAD, signature: `t=${t},li=${sig}`, secret: '' })).toBe(false)
  })
})
