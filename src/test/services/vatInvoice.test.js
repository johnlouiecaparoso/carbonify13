import { describe, it, expect } from 'vitest'
import { computeVatBreakdown } from '@/services/vatInvoiceService'

/**
 * VAT is backed OUT of a VAT-inclusive gross price (PH 12% default).
 * These lock in the arithmetic so the provisional invoice can't silently drift.
 */
describe('computeVatBreakdown', () => {
  it('backs 12% VAT out of a VAT-inclusive total', () => {
    const b = computeVatBreakdown(1120, 12)
    expect(b.vatableSales).toBe(1000)
    expect(b.vatAmount).toBe(120)
    expect(b.total).toBe(1120)
    expect(b.vatRate).toBe(12)
  })

  it('keeps vatableSales + vatAmount equal to the gross total', () => {
    const gross = 999.99
    const b = computeVatBreakdown(gross, 12)
    // Allow a 1-centavo rounding tolerance on the reconstructed total.
    expect(Math.abs(b.vatableSales + b.vatAmount - b.total)).toBeLessThanOrEqual(0.01)
    expect(b.total).toBe(999.99)
  })

  it('rounds to 2 decimals (centavos)', () => {
    const b = computeVatBreakdown(100, 12)
    expect(b.vatableSales).toBe(89.29) // 100 / 1.12 = 89.2857…
    expect(b.vatAmount).toBe(10.71)
  })

  it('treats a 0% rate as no VAT (whole amount is vatable)', () => {
    const b = computeVatBreakdown(500, 0)
    expect(b.vatableSales).toBe(500)
    expect(b.vatAmount).toBe(0)
  })

  it('defaults to the PH 12% rate when none is given', () => {
    const b = computeVatBreakdown(1120)
    expect(b.vatAmount).toBe(120)
  })

  it('handles missing / invalid input as zero', () => {
    const b = computeVatBreakdown(undefined, 12)
    expect(b.total).toBe(0)
    expect(b.vatableSales).toBe(0)
    expect(b.vatAmount).toBe(0)
  })

  it('always reports exempt and zero-rated buckets as 0 (single VATable line)', () => {
    const b = computeVatBreakdown(2240, 12)
    expect(b.vatExempt).toBe(0)
    expect(b.zeroRated).toBe(0)
  })
})
