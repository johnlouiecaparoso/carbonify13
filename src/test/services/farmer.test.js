import { describe, it, expect } from 'vitest'
import {
  validateParcelInput,
  validateDeliveryInput,
  estimateDeliveryTotal,
  aggregateFarmerDeliveries,
  aggregateParcels,
} from '@/services/farmerService'
import { cropTypeLabel } from '@/constants/farmer'

describe('validateParcelInput', () => {
  it('accepts a minimal valid parcel', () => {
    expect(validateParcelInput({ name: 'Lot 3', crop_type: 'rice' })).toEqual([])
  })

  it('requires a name and crop type', () => {
    const errs = validateParcelInput({})
    expect(errs).toContain('A parcel name is required')
    expect(errs).toContain('Crop type is required')
  })

  it('rejects negative area and yield', () => {
    const errs = validateParcelInput({
      name: 'Lot 3',
      crop_type: 'rice',
      area_hectares: -2,
      expected_yield_tonnes: -1,
    })
    expect(errs).toContain('Area cannot be negative')
    expect(errs).toContain('Expected yield cannot be negative')
  })

  it('rejects out-of-range coordinates', () => {
    const errs = validateParcelInput({
      name: 'Lot 3',
      crop_type: 'rice',
      latitude: 120,
      longitude: -200,
    })
    expect(errs).toContain('Latitude must be between -90 and 90')
    expect(errs).toContain('Longitude must be between -180 and 180')
  })

  it('accepts valid Philippine coordinates', () => {
    expect(
      validateParcelInput({ name: 'Lot 3', crop_type: 'rice', latitude: 14.6, longitude: 121.0 }),
    ).toEqual([])
  })
})

describe('validateDeliveryInput', () => {
  it('accepts a delivery against an accepted quote', () => {
    expect(validateDeliveryInput({ rfq_id: 'rfq-1', quantity: 12 })).toEqual([])
  })

  it('requires an RFQ and a positive quantity', () => {
    const errs = validateDeliveryInput({ quantity: 0 })
    expect(errs).toContain('An accepted quote is required')
    expect(errs).toContain('Enter a delivered quantity greater than zero')
  })

  it('rejects a negative price', () => {
    expect(validateDeliveryInput({ rfq_id: 'r', quantity: 1, price_per_unit: -3 })).toContain(
      'Price cannot be negative',
    )
  })
})

describe('estimateDeliveryTotal', () => {
  it('multiplies price by quantity to 2dp', () => {
    expect(estimateDeliveryTotal(12.5, 4)).toBe(50)
    expect(estimateDeliveryTotal(3.333, 3)).toBe(10)
  })

  it('returns null when unpriced or quantity is non-positive', () => {
    expect(estimateDeliveryTotal(null, 4)).toBeNull()
    expect(estimateDeliveryTotal(10, 0)).toBeNull()
  })
})

describe('aggregateFarmerDeliveries', () => {
  const rows = [
    { status: 'confirmed', payment_status: 'paid', quantity: 10, total_amount: 5000 },
    { status: 'confirmed', payment_status: 'unpaid', quantity: 5, total_amount: 2500 },
    { status: 'pending', payment_status: 'unpaid', quantity: 3, total_amount: 1500 },
    { status: 'rejected', payment_status: 'unpaid', quantity: 8, total_amount: 4000 },
  ]

  it('splits earned vs owed across confirmed deliveries', () => {
    const s = aggregateFarmerDeliveries(rows)
    expect(s.totalEarned).toBe(5000)
    expect(s.amountOwed).toBe(2500)
    expect(s.paidCount).toBe(1)
  })

  it('counts each status and only banks confirmed quantity', () => {
    const s = aggregateFarmerDeliveries(rows)
    expect(s.deliveryCount).toBe(4)
    expect(s.confirmedCount).toBe(2)
    expect(s.pendingCount).toBe(1)
    expect(s.rejectedCount).toBe(1)
    expect(s.quantityDelivered).toBe(15)
    expect(s.quantityPending).toBe(3)
  })

  it('excludes rejected deliveries from every money figure', () => {
    const s = aggregateFarmerDeliveries([
      { status: 'rejected', payment_status: 'unpaid', quantity: 8, total_amount: 4000 },
    ])
    expect(s.totalEarned).toBe(0)
    expect(s.amountOwed).toBe(0)
    expect(s.quantityDelivered).toBe(0)
  })

  it('excludes pending deliveries from amountOwed (receipt not yet confirmed)', () => {
    const s = aggregateFarmerDeliveries([
      { status: 'pending', payment_status: 'unpaid', quantity: 3, total_amount: 1500 },
    ])
    expect(s.amountOwed).toBe(0)
    expect(s.quantityPending).toBe(3)
  })

  it('treats a null total_amount as zero rather than NaN', () => {
    const s = aggregateFarmerDeliveries([
      { status: 'confirmed', payment_status: 'unpaid', quantity: 2, total_amount: null },
    ])
    expect(s.amountOwed).toBe(0)
    expect(s.quantityDelivered).toBe(2)
  })

  it('rounds away float drift', () => {
    const s = aggregateFarmerDeliveries([
      { status: 'confirmed', payment_status: 'paid', quantity: 0.1, total_amount: 0.1 },
      { status: 'confirmed', payment_status: 'paid', quantity: 0.2, total_amount: 0.2 },
    ])
    expect(s.totalEarned).toBe(0.3)
    expect(s.quantityDelivered).toBe(0.3)
  })

  it('handles an empty or non-array input', () => {
    expect(aggregateFarmerDeliveries([]).deliveryCount).toBe(0)
    expect(aggregateFarmerDeliveries(undefined).totalEarned).toBe(0)
  })
})

describe('aggregateParcels', () => {
  const parcels = [
    { status: 'active', area_hectares: 2.5, expected_yield_tonnes: 10 },
    { status: 'fallow', area_hectares: 1.5, expected_yield_tonnes: 0 },
    { status: 'retired', area_hectares: 4, expected_yield_tonnes: 20 },
  ]

  it('counts parcels and active parcels', () => {
    const s = aggregateParcels(parcels)
    expect(s.parcelCount).toBe(3)
    expect(s.activeCount).toBe(1)
  })

  it('excludes retired parcels from area and yield totals', () => {
    const s = aggregateParcels(parcels)
    expect(s.totalHectares).toBe(4)
    expect(s.totalExpectedYield).toBe(10)
  })

  it('handles an empty input', () => {
    expect(aggregateParcels([])).toEqual({
      parcelCount: 0,
      activeCount: 0,
      totalHectares: 0,
      totalExpectedYield: 0,
    })
  })
})

describe('cropTypeLabel', () => {
  it('maps a known crop', () => {
    expect(cropTypeLabel('bana_grass')).toBe('Bana grass')
  })

  it('titleizes an unknown crop', () => {
    expect(cropTypeLabel('sweet_sorghum')).toBe('Sweet Sorghum')
  })

  it('falls back for an empty value', () => {
    expect(cropTypeLabel('')).toBe('Crop')
  })
})
