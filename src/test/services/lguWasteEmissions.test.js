import { describe, it, expect } from 'vitest'
import {
  computeWasteEmissions,
  estimateWasteFromPopulation,
  EMISSION_PER_TONNE,
} from '@/constants/lgu'

describe('computeWasteEmissions', () => {
  it('computes baseline/avoided/net from generated + diverted tonnage', () => {
    const r = computeWasteEmissions(100, 40)
    expect(r.generated).toBe(100)
    expect(r.diverted).toBe(40)
    expect(r.baseline).toBeCloseTo(100 * EMISSION_PER_TONNE, 6)
    expect(r.avoided).toBeCloseTo(40 * EMISSION_PER_TONNE, 6)
    expect(r.net).toBeCloseTo(60 * EMISSION_PER_TONNE, 6)
    expect(r.diversionRate).toBeCloseTo(40, 6)
  })

  it('clamps diverted to never exceed generated (diversion rate <= 100%)', () => {
    const r = computeWasteEmissions(50, 80)
    expect(r.generated).toBe(50)
    expect(r.diverted).toBe(50) // clamped down from 80
    expect(r.diversionRate).toBe(100)
    expect(r.net).toBeCloseTo(0, 6) // fully diverted → no net emissions
  })

  it('sanitizes negative / non-numeric inputs to zero', () => {
    const r = computeWasteEmissions(-10, -5)
    expect(r.generated).toBe(0)
    expect(r.diverted).toBe(0)
    expect(r.diversionRate).toBe(0)
    expect(computeWasteEmissions('abc', null).generated).toBe(0)
  })
})

describe('estimateWasteFromPopulation', () => {
  it('estimates annual MSW at 0.4 kg/person/day', () => {
    // 1000 people * 0.4 kg/day * 365 / 1000 = 146 tonnes/yr
    expect(estimateWasteFromPopulation(1000)).toBeCloseTo(146, 6)
  })

  it('treats invalid population as zero', () => {
    expect(estimateWasteFromPopulation(-5)).toBe(0)
    expect(estimateWasteFromPopulation('x')).toBe(0)
  })
})
