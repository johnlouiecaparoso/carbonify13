/**
 * PayoutProvider — the single interface every disbursement backend implements
 * (e.g. PayMongo/Xendit payouts). Sellers withdraw via this interface, never a
 * vendor SDK directly, so the withdraw/payout flow is buildable and testable
 * against MockPayoutProvider before a live payouts contract exists.
 *
 * @typedef {Object} PayoutDestination
 * @property {'bank'|'gcash'|'maya'} method
 * @property {string} accountName
 * @property {string} accountNumber        Bank account no. or e-wallet mobile number.
 * @property {string} [bankCode]           Required for method 'bank'.
 *
 * @typedef {Object} PayoutRequest
 * @property {string} payoutId             Our internal payout id (for idempotency/reconciliation).
 * @property {number} amount               Major currency units (e.g. PHP).
 * @property {string} currency
 * @property {PayoutDestination} destination
 * @property {string} [reference]
 *
 * @typedef {Object} PayoutResult
 * @property {string} providerPayoutId
 * @property {'pending'|'processing'|'settled'|'failed'} status
 * @property {string} [failureReason]
 */

export class PayoutProvider {
  /** @returns {string} stable provider id, e.g. 'mock' | 'paymongo' | 'xendit'. */
  get id() {
    throw new Error('PayoutProvider.id not implemented')
  }

  /** @returns {boolean} whether this provider has the credentials it needs. */
  isConfigured() {
    return false
  }

  /**
   * Initiate a disbursement.
   * @param {PayoutRequest} _request
   * @returns {Promise<PayoutResult>}
   */
  async createPayout(_request) {
    throw new Error(`${this.id}.createPayout not implemented`)
  }

  /**
   * Poll the status of a previously-created payout.
   * @param {string} _providerPayoutId
   * @returns {Promise<PayoutResult>}
   */
  async getPayoutStatus(_providerPayoutId) {
    throw new Error(`${this.id}.getPayoutStatus not implemented`)
  }

  /** @returns {Array<{ id: string, name: string }>} supported destination methods. */
  getSupportedDestinations() {
    return []
  }
}

/** Minimum payout amount guard shared by providers (major units). */
export const MIN_PAYOUT_AMOUNT = 100

/**
 * Validate a payout request shape. Returns an array of error strings (empty = ok).
 * @param {Partial<import('./PayoutProvider').PayoutRequest>} request
 * @returns {string[]}
 */
export function validatePayoutRequest(request = {}) {
  const errors = []
  const amount = Number(request.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('amount must be a positive number')
  } else if (amount < MIN_PAYOUT_AMOUNT) {
    errors.push(`amount must be at least ${MIN_PAYOUT_AMOUNT}`)
  }
  const dest = request.destination
  if (!dest || !dest.method) {
    errors.push('destination.method is required')
  } else {
    if (!['bank', 'gcash', 'maya'].includes(dest.method)) {
      errors.push(`unsupported destination method: ${dest.method}`)
    }
    if (!dest.accountNumber) errors.push('destination.accountNumber is required')
    if (!dest.accountName) errors.push('destination.accountName is required')
    if (dest.method === 'bank' && !dest.bankCode) {
      errors.push('destination.bankCode is required for bank payouts')
    }
  }
  return errors
}
