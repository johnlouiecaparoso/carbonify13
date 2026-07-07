import { CreditSupplier } from './CreditSupplier'

/**
 * Deterministic in-memory credit supplier for development and tests.
 *
 * It records every order it places so getOrder/retire return consistent
 * results, and it assigns a deterministic registry serial at order time — so
 * the fulfillment saga can persist the serial onto the certificate early and
 * the retirement receipt once retire() runs. Mirrors MockPaymentProvider.
 *
 * Test seam: set `_failNext` to 'placeOrder' or 'retire' to force the next call
 * of that method to throw once, exercising the saga's compensation path
 * deterministically.
 */
export class MockCreditSupplier extends CreditSupplier {
  constructor() {
    super()
    /** @type {Map<string, { status: string, quantity: number, registrySerial: string, retirementReceiptUrl: string|null }>} */
    this._orders = new Map()
    this._seq = 0
    /** @type {null|'placeOrder'|'retire'} */
    this._failNext = null
  }

  get id() {
    return 'mock'
  }

  isConfigured() {
    return true
  }

  _maybeFail(method) {
    if (this._failNext === method) {
      this._failNext = null
      throw new Error(`mock supplier forced failure in ${method}`)
    }
  }

  async placeOrder({ referenceId, quantity, vintageYear, projectMeta = {} } = {}) {
    this._maybeFail('placeOrder')
    if (!(Number(quantity) > 0)) {
      throw new Error('placeOrder requires a positive quantity')
    }

    const n = ++this._seq
    const orderId = `mock_order_${n}_${referenceId ?? 'na'}`
    const registrySerial = `ECO-MOCK-REG-${n}`
    this._orders.set(orderId, {
      status: 'ordered',
      quantity: Number(quantity),
      vintageYear: vintageYear ?? null,
      projectMeta,
      registrySerial,
      retirementReceiptUrl: null,
    })

    return { orderId, status: 'ordered', registrySerial, retirementReceiptUrl: null }
  }

  async getOrder(orderId) {
    const order = this._orders.get(orderId)
    if (!order) {
      return { orderId, status: 'unknown', registrySerial: null, retirementReceiptUrl: null }
    }
    return {
      orderId,
      status: order.status,
      registrySerial: order.registrySerial,
      retirementReceiptUrl: order.retirementReceiptUrl,
    }
  }

  async retire(orderId) {
    this._maybeFail('retire')
    const order = this._orders.get(orderId)
    if (!order) {
      throw new Error(`retire called for unknown order ${orderId}`)
    }
    order.status = 'retired'
    order.retirementReceiptUrl = `https://mock.local/registry/retire/${orderId}`
    return {
      orderId,
      status: 'retired',
      registrySerial: order.registrySerial,
      retirementReceiptUrl: order.retirementReceiptUrl,
    }
  }
}
