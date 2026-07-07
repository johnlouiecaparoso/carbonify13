/**
 * CreditSupplier — the single interface every carbon-credit supply backend
 * implements (Phase 3).
 *
 * Today Carbonify's credits are minted internally ("local"). To make credits
 * *real* (or clearly labeled), a purchase can instead place an order with an
 * external registry/supplier (Verra/Gold Standard via Carbonmark, Cloverly,
 * Patch, …) and retire it on the buyer's behalf, so the certificate carries a
 * real registry serial + retirement receipt.
 *
 * Mirroring Phase 1's PaymentProvider: the fulfillment flow talks to *this*
 * interface, never to a vendor SDK directly, so the whole saga is buildable and
 * testable against MockCreditSupplier before any real supplier contract exists
 * (a Phase 9 business gate).
 *
 * @typedef {Object} PlaceOrderRequest
 * @property {string} referenceId        Our internal reference (e.g. credit_transactions.id) for reconciliation + idempotency.
 * @property {number} quantity           Whole credits to order (>= 1). 1 credit = 1 tCO2e.
 * @property {number} [vintageYear]      Desired vintage, when the supplier supports it.
 * @property {Object} [projectMeta]      Best-effort hints for catalog mapping: { title, category, location, methodology, standard }.
 *
 * @typedef {Object} PlaceOrderResult
 * @property {string} orderId            Supplier-side order id (opaque).
 * @property {'ordered'|'failed'} status
 * @property {string|null} registrySerial         Registry serial once assigned (may be available at order time or only after retire).
 * @property {string|null} retirementReceiptUrl   Retirement receipt URL once retired (null until retire()).
 *
 * @typedef {Object} OrderRecord
 * @property {string} orderId
 * @property {'ordered'|'retired'|'failed'|'unknown'} status
 * @property {string|null} registrySerial
 * @property {string|null} retirementReceiptUrl
 *
 * @typedef {Object} RetireResult
 * @property {string} orderId
 * @property {'retired'|'failed'} status
 * @property {string|null} registrySerial
 * @property {string|null} retirementReceiptUrl
 */

export class CreditSupplier {
  /** @returns {string} stable supplier id, e.g. 'mock' | 'carbonmark'. */
  get id() {
    throw new Error('CreditSupplier.id not implemented')
  }

  /** @returns {boolean} whether this supplier has the credentials it needs. */
  isConfigured() {
    return false
  }

  /**
   * Place an order for real credits with the supplier.
   * @param {PlaceOrderRequest} _request
   * @returns {Promise<PlaceOrderResult>}
   */
  async placeOrder(_request) {
    throw new Error(`${this.id}.placeOrder not implemented`)
  }

  /**
   * Fetch the current state of a previously placed order.
   * @param {string} _orderId
   * @returns {Promise<OrderRecord>}
   */
  async getOrder(_orderId) {
    throw new Error(`${this.id}.getOrder not implemented`)
  }

  /**
   * Retire a placed order so the credit is permanently removed from circulation
   * and a registry retirement receipt is issued.
   * @param {string} _orderId
   * @returns {Promise<RetireResult>}
   */
  async retire(_orderId) {
    throw new Error(`${this.id}.retire not implemented`)
  }
}
