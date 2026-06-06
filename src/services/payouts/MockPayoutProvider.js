import { PayoutProvider, validatePayoutRequest } from './PayoutProvider'

/**
 * Deterministic in-memory payout provider for development and tests.
 *
 * Records each payout so getPayoutStatus is consistent. By default payouts
 * settle immediately; a destination accountNumber of 'FAIL' simulates a failed
 * disbursement so the dead-letter/retry path (Phase 2.3) is testable.
 */
export class MockPayoutProvider extends PayoutProvider {
  constructor() {
    super()
    /** @type {Map<string, import('./PayoutProvider').PayoutResult>} */
    this._payouts = new Map()
    this._seq = 0
  }

  get id() {
    return 'mock'
  }

  isConfigured() {
    return true
  }

  async createPayout(request) {
    const errors = validatePayoutRequest(request)
    if (errors.length) {
      throw new Error(`invalid payout request: ${errors.join('; ')}`)
    }

    const providerPayoutId = `mock_payout_${++this._seq}_${request.payoutId ?? 'na'}`
    const failed = request.destination?.accountNumber === 'FAIL'
    const result = failed
      ? { providerPayoutId, status: 'failed', failureReason: 'simulated failure' }
      : { providerPayoutId, status: 'settled' }

    this._payouts.set(providerPayoutId, result)
    return result
  }

  async getPayoutStatus(providerPayoutId) {
    return (
      this._payouts.get(providerPayoutId) ?? {
        providerPayoutId,
        status: 'failed',
        failureReason: 'unknown payout',
      }
    )
  }

  getSupportedDestinations() {
    return [
      { id: 'bank', name: 'Bank Transfer' },
      { id: 'gcash', name: 'GCash' },
      { id: 'maya', name: 'Maya' },
    ]
  }
}
