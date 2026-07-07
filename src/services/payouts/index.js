import { MockPayoutProvider } from './MockPayoutProvider'

export { PayoutProvider, validatePayoutRequest, MIN_PAYOUT_AMOUNT } from './PayoutProvider'
export { MockPayoutProvider } from './MockPayoutProvider'

let _provider = null

/**
 * Resolve the active payout provider. Until a live payouts partner is wired,
 * this is the mock so the withdraw flow is fully buildable/testable.
 * Override with VITE_PAYOUT_PROVIDER='mock'.
 * @returns {import('./PayoutProvider').PayoutProvider}
 */
export function getPayoutProvider() {
  if (_provider) return _provider
  // Only the mock exists today; a real provider (PayMongo/Xendit payouts) plugs
  // in here once a payouts contract is signed (tracked in DEFERRED_BACKLOG.md).
  _provider = new MockPayoutProvider()
  return _provider
}

/** Test/seam helper: force a specific provider (or reset with null). */
export function setPayoutProvider(provider) {
  _provider = provider
}
