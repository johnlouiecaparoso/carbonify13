import { MockCreditSupplier } from './MockCreditSupplier'

export { CreditSupplier } from './CreditSupplier'
export { MockCreditSupplier } from './MockCreditSupplier'

let _supplier = null

/**
 * Resolve the active credit supplier.
 *
 * Selection order:
 *  1. Explicit override via VITE_CREDIT_SUPPLIER ('mock' | <vendor>).
 *  2. Mock otherwise (dev / tests / no contract), so the fulfillment flow is
 *     always buildable and testable without a real supplier agreement.
 *
 * No real vendor adapter exists yet — a commercial agreement is a Phase 9 gate.
 * When one is built (e.g. CarbonmarkSupplier), import it and add a branch +
 * `isConfigured()` fallback here, mirroring getPaymentProvider().
 *
 * @returns {import('./CreditSupplier').CreditSupplier}
 */
export function getCreditSupplier() {
  if (_supplier) return _supplier

  const override = import.meta.env?.VITE_CREDIT_SUPPLIER
  if (override === 'mock') {
    _supplier = new MockCreditSupplier()
    return _supplier
  }
  // else if (override === 'carbonmark') { _supplier = new CarbonmarkSupplier(); return _supplier }

  _supplier = new MockCreditSupplier()
  return _supplier
}

/** Test/seam helper: force a specific supplier (or reset with null). */
export function setCreditSupplier(supplier) {
  _supplier = supplier
}
