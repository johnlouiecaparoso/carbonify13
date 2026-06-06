import { MockPaymentProvider } from './MockPaymentProvider'
import { PayMongoProvider } from './PayMongoProvider'

export { PaymentProvider, totalFromLineItems } from './PaymentProvider'
export { MockPaymentProvider } from './MockPaymentProvider'
export { PayMongoProvider } from './PayMongoProvider'

let _provider = null

/**
 * Resolve the active payment provider.
 *
 * Selection order:
 *  1. Explicit override via VITE_PAYMENT_PROVIDER ('mock' | 'paymongo').
 *  2. PayMongo when it is configured.
 *  3. Mock otherwise (dev / tests / unconfigured), so the purchase flow is
 *     always buildable and testable without a live contract.
 *
 * @returns {import('./PaymentProvider').PaymentProvider}
 */
export function getPaymentProvider() {
  if (_provider) return _provider

  const override = import.meta.env?.VITE_PAYMENT_PROVIDER
  if (override === 'mock') {
    _provider = new MockPaymentProvider()
    return _provider
  }
  if (override === 'paymongo') {
    _provider = new PayMongoProvider()
    return _provider
  }

  const paymongo = new PayMongoProvider()
  _provider = paymongo.isConfigured() ? paymongo : new MockPaymentProvider()
  return _provider
}

/** Test/seam helper: force a specific provider (or reset with null). */
export function setPaymentProvider(provider) {
  _provider = provider
}
