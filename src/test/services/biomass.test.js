import { describe, it, expect } from 'vitest'
import {
  validateProductInput,
  validateRfqInput,
  estimateRfqTotal,
} from '@/services/biomassService'
import { biomassTypeLabel } from '@/constants/biomass'

describe('validateProductInput', () => {
  it('accepts a minimal valid product', () => {
    expect(validateProductInput({ product_type: 'rice_husk', title: 'Dry rice husk', unit: 'tonnes' })).toEqual([])
  })

  it('requires type, title, and unit', () => {
    const errs = validateProductInput({})
    expect(errs).toContain('Product type is required')
    expect(errs).toContain('A short title is required')
    expect(errs).toContain('Unit is required')
  })

  it('rejects negative price and quantity', () => {
    const errs = validateProductInput({
      product_type: 'biochar',
      title: 'Biochar',
      unit: 'kg',
      price_per_unit: -5,
      quantity_available: -1,
    })
    expect(errs).toContain('Price cannot be negative')
    expect(errs).toContain('Quantity available cannot be negative')
  })

  it('allows an empty (request-a-quote) price', () => {
    expect(
      validateProductInput({ product_type: 'biochar', title: 'Biochar', unit: 'kg', price_per_unit: '' }),
    ).toEqual([])
  })
})

describe('validateRfqInput', () => {
  it('accepts a valid RFQ', () => {
    expect(validateRfqInput({ quantity: 10, unit: 'tonnes', seller_id: 'u1' })).toEqual([])
  })

  it('rejects zero/negative/missing quantity', () => {
    expect(validateRfqInput({ quantity: 0, unit: 'tonnes', seller_id: 'u1' })).toContain(
      'Enter a quantity greater than zero',
    )
    expect(validateRfqInput({ quantity: -3, unit: 'tonnes', seller_id: 'u1' })).toContain(
      'Enter a quantity greater than zero',
    )
    expect(validateRfqInput({ unit: 'tonnes', seller_id: 'u1' })).toContain(
      'Enter a quantity greater than zero',
    )
  })

  it('requires a supplier and a unit', () => {
    expect(validateRfqInput({ quantity: 5, unit: 'tonnes' })).toContain('A supplier is required')
    expect(validateRfqInput({ quantity: 5, seller_id: 'u1' })).toContain('Unit is required')
  })
})

describe('estimateRfqTotal', () => {
  it('multiplies price × quantity to 2dp', () => {
    expect(estimateRfqTotal(12.5, 4)).toBe(50)
    expect(estimateRfqTotal(3.333, 3)).toBe(10) // 9.999 → 10.00
    expect(estimateRfqTotal(2.5, 3)).toBe(7.5)
  })

  it('returns null when unpriced or quantity invalid', () => {
    expect(estimateRfqTotal(null, 4)).toBeNull()
    expect(estimateRfqTotal('', 4)).toBeNull()
    expect(estimateRfqTotal(10, 0)).toBeNull()
    expect(estimateRfqTotal(-1, 4)).toBeNull()
  })
})

describe('biomassTypeLabel', () => {
  it('maps known types to friendly labels', () => {
    expect(biomassTypeLabel('rice_husk')).toBe('Rice husk')
    expect(biomassTypeLabel('sugarcane_bagasse')).toBe('Sugarcane bagasse')
  })

  it('titleizes unknown values and defaults when empty', () => {
    expect(biomassTypeLabel('custom_feed')).toBe('Custom Feed')
    expect(biomassTypeLabel('')).toBe('Biomass')
  })
})
