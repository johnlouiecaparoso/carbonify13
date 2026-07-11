import { describe, it, expect } from 'vitest'
import {
  METHODOLOGY_STANDARDS,
  DEVELOPMENT_STATUSES,
  methodologyGroups,
  methodologyLabel,
  developmentStatusLabel,
  isKnownMethodology,
} from '@/constants/projectRegistry'
import { REDUCTION_TYPES, reductionTypeLabel, suggestedReductionType } from '@/constants/mrv'

describe('methodologyLabel', () => {
  it('maps the canonical standards the spec names', () => {
    expect(methodologyLabel('verra_vcs')).toBe('Verra (VCS)')
    expect(methodologyLabel('gold_standard')).toBe('Gold Standard')
    expect(methodologyLabel('puro_earth')).toBe('Puro.earth')
    expect(methodologyLabel('iso_14064')).toBe('ISO 14064')
  })

  it('passes legacy free text through untouched', () => {
    // Real rows predate the enum; "Verra VM0044" is information a developer
    // typed and must not be mangled into "Verra Vm0044".
    expect(methodologyLabel('Verra VM0044')).toBe('Verra VM0044')
    expect(methodologyLabel('ISCC PLUS')).toBe('ISCC PLUS')
  })

  it('titleizes an unknown snake_case value', () => {
    expect(methodologyLabel('some_new_standard')).toBe('Some New Standard')
  })

  it('returns null for an empty value so callers can choose their own dash', () => {
    expect(methodologyLabel('')).toBeNull()
    expect(methodologyLabel(null)).toBeNull()
  })
})

describe('isKnownMethodology', () => {
  it('is true only for canonical keys', () => {
    expect(isKnownMethodology('gold_standard')).toBe(true)
    expect(isKnownMethodology('Verra VM0044')).toBe(false)
    expect(isKnownMethodology('')).toBe(false)
  })

  it('is not fooled by inherited Object properties', () => {
    expect(isKnownMethodology('constructor')).toBe(false)
    expect(isKnownMethodology('toString')).toBe(false)
  })
})

describe('developmentStatusLabel', () => {
  it('maps the lifecycle stages', () => {
    expect(developmentStatusLabel('feasibility')).toBe('Feasibility')
    expect(developmentStatusLabel('operational')).toBe('Operational')
  })

  it('returns null when unset', () => {
    expect(developmentStatusLabel(null)).toBeNull()
  })

  it('never collides with the validation workflow statuses', () => {
    // `projects.status` uses draft/submitted/validated/rejected. Sharing a value
    // would let the two be conflated, which is the bug this field exists to fix.
    const lifecycle = DEVELOPMENT_STATUSES.map((d) => d.value)
    for (const workflow of ['draft', 'submitted', 'in_review', 'validated', 'rejected', 'needs_revision']) {
      expect(lifecycle).not.toContain(workflow)
    }
  })
})

describe('methodologyGroups', () => {
  it('groups every standard exactly once', () => {
    const groups = methodologyGroups()
    const flat = groups.flatMap((g) => g.items)
    expect(flat).toHaveLength(METHODOLOGY_STANDARDS.length)
  })

  it('offers an escape hatch so no developer is forced into a wrong standard', () => {
    expect(METHODOLOGY_STANDARDS.some((m) => m.value === 'other')).toBe(true)
  })
})

describe('suggestedReductionType', () => {
  it('suggests removal for durable-storage categories', () => {
    expect(suggestedReductionType('Biochar & Bio-briquettes')).toBe('removal')
    expect(suggestedReductionType('Reforestation & Agroforestry')).toBe('removal')
    expect(suggestedReductionType('Coastal & Watershed Protection')).toBe('removal')
  })

  it('suggests avoidance for displaced-emission categories', () => {
    expect(suggestedReductionType('Methane Avoidance')).toBe('avoidance')
    expect(suggestedReductionType('Renewable Energy')).toBe('avoidance')
    expect(suggestedReductionType('Biomass-to-Energy (WTE)')).toBe('avoidance')
    expect(suggestedReductionType('Industrial Decarbonization')).toBe('avoidance')
  })

  it('suggests nothing for an unknown category rather than defaulting', () => {
    expect(suggestedReductionType('Something Else')).toBe('')
    expect(suggestedReductionType('')).toBe('')
  })

  it('every suggestion is a valid reduction type', () => {
    for (const c of [
      'Biochar & Bio-briquettes',
      'Renewable Energy',
      'Methane Avoidance',
      'Coastal & Watershed Protection',
    ]) {
      expect(REDUCTION_TYPES.map((r) => r.value)).toContain(suggestedReductionType(c))
    }
  })
})

describe('reductionTypeLabel', () => {
  it('labels the two types', () => {
    expect(reductionTypeLabel('removal')).toBe('Removal')
    expect(reductionTypeLabel('avoidance')).toBe('Avoidance')
  })

  it('calls an unset or unknown type Unclassified, never a guess', () => {
    expect(reductionTypeLabel(null)).toBe('Unclassified')
    expect(reductionTypeLabel('bogus')).toBe('Unclassified')
  })
})
