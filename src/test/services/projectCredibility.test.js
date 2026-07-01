import { describe, it, expect } from 'vitest'
import {
  additionalityLabel,
  reversalRiskLabel,
  formatPermanence,
  normalizeCredibility,
  ADDITIONALITY_TYPES,
  REVERSAL_RISK_LEVELS,
} from '@/services/projectCredibility'

describe('projectCredibility labels', () => {
  it('labels known additionality types and falls back to em dash', () => {
    expect(additionalityLabel('financial')).toBe('Financial barrier')
    expect(additionalityLabel('nope')).toBe('—')
    expect(additionalityLabel(undefined)).toBe('—')
  })

  it('labels known reversal-risk levels and falls back to em dash', () => {
    expect(reversalRiskLabel('high')).toBe('High')
    expect(reversalRiskLabel('')).toBe('—')
  })

  it('formats permanence with singular/plural and guards bad input', () => {
    expect(formatPermanence(100)).toBe('100 years')
    expect(formatPermanence(1)).toBe('1 year')
    expect(formatPermanence(0)).toBe('—')
    expect(formatPermanence(-5)).toBe('—')
    expect(formatPermanence('abc')).toBe('—')
    expect(formatPermanence(12.6)).toBe('13 years') // rounds
  })
})

describe('normalizeCredibility', () => {
  it('passes through valid values', () => {
    expect(
      normalizeCredibility({
        additionality_type: 'technological',
        permanence_years: '40',
        reversal_risk: 'medium',
      }),
    ).toEqual({ additionality_type: 'technological', permanence_years: 40, reversal_risk: 'medium' })
  })

  it('nulls out unknown enum values', () => {
    expect(
      normalizeCredibility({ additionality_type: 'bogus', reversal_risk: 'extreme' }),
    ).toEqual({ additionality_type: null, permanence_years: null, reversal_risk: null })
  })

  it('coerces permanence to a positive integer, else null', () => {
    expect(normalizeCredibility({ permanence_years: 0 }).permanence_years).toBe(null)
    expect(normalizeCredibility({ permanence_years: -3 }).permanence_years).toBe(null)
    expect(normalizeCredibility({ permanence_years: 'x' }).permanence_years).toBe(null)
    expect(normalizeCredibility({ permanence_years: 12.7 }).permanence_years).toBe(13)
  })

  it('clamps permanence to the 1000-year DB ceiling', () => {
    expect(normalizeCredibility({ permanence_years: 999999 }).permanence_years).toBe(1000)
  })

  it('handles empty input without throwing', () => {
    expect(normalizeCredibility()).toEqual({
      additionality_type: null,
      permanence_years: null,
      reversal_risk: null,
    })
  })

  it('keeps the option vocabularies in sync with the CHECK constraints', () => {
    expect(ADDITIONALITY_TYPES.map((t) => t.value)).toEqual([
      'financial',
      'technological',
      'institutional',
      'common_practice',
    ])
    expect(REVERSAL_RISK_LEVELS.map((r) => r.value)).toEqual(['low', 'medium', 'high'])
  })
})
