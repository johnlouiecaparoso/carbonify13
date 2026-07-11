import { describe, it, expect } from 'vitest'
import {
  validateParcelInput,
  validateDeliveryInput,
  estimateDeliveryTotal,
  aggregateFarmerDeliveries,
  aggregateParcels,
  deliveryTonnes,
  attributeCarbon,
  unattributableDeliveries,
  aggregateParcelPerformance,
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

describe('deliveryTonnes', () => {
  it('converts tonnes and kg', () => {
    expect(deliveryTonnes({ quantity: 2, unit: 'tonnes' })).toBe(2)
    expect(deliveryTonnes({ quantity: 2500, unit: 'kg' })).toBe(2.5)
  })

  it('is case-insensitive on the unit', () => {
    expect(deliveryTonnes({ quantity: 1, unit: 'Tonnes' })).toBe(1)
  })

  it('returns null for units with no defensible tonnage', () => {
    // A sack of rice husk and a sack of biochar are wildly different masses.
    expect(deliveryTonnes({ quantity: 100, unit: 'sacks' })).toBeNull()
    expect(deliveryTonnes({ quantity: 10, unit: 'bales' })).toBeNull()
    expect(deliveryTonnes({ quantity: 10, unit: 'm³' })).toBeNull()
  })

  it('returns null for a non-positive or missing quantity', () => {
    expect(deliveryTonnes({ quantity: 0, unit: 'tonnes' })).toBeNull()
    expect(deliveryTonnes({ unit: 'tonnes' })).toBeNull()
  })
})

describe('attributeCarbon', () => {
  it('gives a farmer their pro-rata share of verified carbon', () => {
    // Supplied 20 of 100 tonnes; project verified 500 tCO2e → 100 tCO2e.
    const { share, attributed } = attributeCarbon(20, 100, 500)
    expect(share).toBe(0.2)
    expect(attributed).toBe(100)
  })

  it('attributes everything to a sole supplier', () => {
    expect(attributeCarbon(50, 50, 300)).toEqual({ share: 1, attributed: 300 })
  })

  it('shares across farmers sum to the project total, never more', () => {
    const a = attributeCarbon(30, 100, 900).attributed
    const b = attributeCarbon(70, 100, 900).attributed
    expect(a + b).toBeCloseTo(900, 3)
  })

  it('returns zeros rather than NaN when the project has no mass', () => {
    // A farmer must never be shown "NaN tCO2e".
    expect(attributeCarbon(10, 0, 500)).toEqual({ share: 0, attributed: 0 })
    expect(attributeCarbon(0, 0, 500)).toEqual({ share: 0, attributed: 0 })
  })

  it('returns zeros for nonsense input instead of Infinity', () => {
    expect(attributeCarbon('abc', 'def', 'ghi')).toEqual({ share: 0, attributed: 0 })
  })

  it('clamps a share above 1 rather than over-attributing', () => {
    // Shouldn't happen, but a data error must not mint phantom carbon.
    const { share, attributed } = attributeCarbon(150, 100, 200)
    expect(share).toBe(1)
    expect(attributed).toBe(200)
  })

  it('attributes zero when the project has verified nothing yet', () => {
    expect(attributeCarbon(20, 100, 0).attributed).toBe(0)
    expect(attributeCarbon(20, 100, 0).share).toBe(0.2)
  })

  it('never attributes negative carbon', () => {
    expect(attributeCarbon(20, 100, -500).attributed).toBe(0)
  })
})

describe('unattributableDeliveries', () => {
  it('counts confirmed deliveries that cannot be attributed, by reason', () => {
    const out = unattributableDeliveries([
      { status: 'confirmed', quantity: 5, unit: 'tonnes', project_id: 'p1' }, // fine
      { status: 'confirmed', quantity: 5, unit: 'tonnes' }, // no project
      { status: 'confirmed', quantity: 5, unit: 'sacks', project_id: 'p1' }, // non-mass
      { status: 'pending', quantity: 5, unit: 'sacks' }, // not confirmed → ignored
    ])
    expect(out).toEqual({ unattributedProject: 1, nonMassUnits: 1 })
  })

  it('counts a non-mass unit once, not twice, when it also lacks a project', () => {
    const out = unattributableDeliveries([{ status: 'confirmed', quantity: 5, unit: 'sacks' }])
    expect(out.nonMassUnits).toBe(1)
    expect(out.unattributedProject).toBe(0)
  })

  it('handles empty input', () => {
    expect(unattributableDeliveries([])).toEqual({ unattributedProject: 0, nonMassUnits: 0 })
  })
})

describe('aggregateParcelPerformance', () => {
  const NOW = new Date('2026-07-09T00:00:00Z').getTime()
  const parcels = [{ id: 'a', name: 'Lot 3', crop_type: 'rice', expected_yield_tonnes: 100 }]

  const delivery = (over) => ({
    status: 'confirmed',
    parcel_id: 'a',
    unit: 'tonnes',
    ...over,
  })

  it('compares the trailing 12 months against the ANNUAL expectation', () => {
    const [row] = aggregateParcelPerformance(
      parcels,
      [delivery({ quantity: 80, delivered_on: '2026-05-01' })],
      NOW,
    )
    expect(row.deliveredTrailingYear).toBe(80)
    expect(row.performance).toBe(0.8)
  })

  it('excludes deliveries older than 12 months from performance but not from lifetime', () => {
    // The whole point: a 3-year-old parcel must not report 300% performance.
    const [row] = aggregateParcelPerformance(
      parcels,
      [
        delivery({ quantity: 100, delivered_on: '2024-01-01' }),
        delivery({ quantity: 100, delivered_on: '2025-01-01' }),
        delivery({ quantity: 50, delivered_on: '2026-06-01' }),
      ],
      NOW,
    )
    expect(row.deliveredLifetime).toBe(250)
    expect(row.deliveredTrailingYear).toBe(50)
    expect(row.performance).toBe(0.5)
  })

  it('reports over-performance honestly rather than capping at 100%', () => {
    const [row] = aggregateParcelPerformance(
      parcels,
      [delivery({ quantity: 130, delivered_on: '2026-06-01' })],
      NOW,
    )
    expect(row.performance).toBe(1.3)
  })

  it('returns a null performance when nothing was expected — not zero, not 100%', () => {
    const [row] = aggregateParcelPerformance(
      [{ id: 'a', name: 'Lot 3' }],
      [delivery({ quantity: 10, delivered_on: '2026-06-01' })],
      NOW,
    )
    expect(row.performance).toBeNull()
    expect(row.expectedAnnual).toBeNull()
    expect(row.deliveredTrailingYear).toBe(10)
  })

  it('converts kg and ignores non-mass units', () => {
    const [row] = aggregateParcelPerformance(
      parcels,
      [
        delivery({ quantity: 5000, unit: 'kg', delivered_on: '2026-06-01' }),
        delivery({ quantity: 999, unit: 'sacks', delivered_on: '2026-06-01' }),
      ],
      NOW,
    )
    expect(row.deliveredTrailingYear).toBe(5)
    expect(row.deliveryCount).toBe(1)
  })

  it('ignores unconfirmed deliveries and those with no parcel', () => {
    const [row] = aggregateParcelPerformance(
      parcels,
      [
        delivery({ quantity: 50, delivered_on: '2026-06-01', status: 'pending' }),
        delivery({ quantity: 50, delivered_on: '2026-06-01', parcel_id: null }),
      ],
      NOW,
    )
    expect(row.deliveredLifetime).toBe(0)
    expect(row.performance).toBe(0)
  })

  it('keeps the most recent delivery date', () => {
    const [row] = aggregateParcelPerformance(
      parcels,
      [
        delivery({ quantity: 1, delivered_on: '2026-02-01' }),
        delivery({ quantity: 1, delivered_on: '2026-06-01' }),
      ],
      NOW,
    )
    expect(row.lastDeliveredOn).toBe('2026-06-01')
  })

  it('lists a parcel with no deliveries at zero, not missing', () => {
    const [row] = aggregateParcelPerformance(parcels, [], NOW)
    expect(row.deliveredLifetime).toBe(0)
    expect(row.performance).toBe(0)
    expect(row.deliveryCount).toBe(0)
  })

  it('handles empty input', () => {
    expect(aggregateParcelPerformance([], [], NOW)).toEqual([])
  })
})
