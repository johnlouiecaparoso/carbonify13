import { describe, it, expect } from 'vitest'
import {
  itemScore,
  rubricScore,
  requiredProgress,
  allRequiredChecked,
  REQUIRED_KEYS,
  CHECKLIST_ITEMS,
  PASS_SCORE,
  MAX_SCORE,
} from '@/constants/verificationChecklist'

/** Build a checklist map that scores every item at `score`. */
function allAt(score) {
  return Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, { score, checked: score >= PASS_SCORE }]))
}

describe('itemScore (backward compatibility)', () => {
  it('reads a numeric score when present', () => {
    expect(itemScore({ docs_complete: { score: 2 } }, 'docs_complete')).toBe(2)
  })

  it('falls back to checked=true → PASS_SCORE for pre-scoring rows', () => {
    expect(itemScore({ docs_complete: { checked: true } }, 'docs_complete')).toBe(PASS_SCORE)
    expect(itemScore({ docs_complete: { checked: false } }, 'docs_complete')).toBe(0)
  })

  it('returns 0 for an unset item', () => {
    expect(itemScore({}, 'docs_complete')).toBe(0)
  })
})

describe('requiredProgress / allRequiredChecked', () => {
  it('counts required items scoring at least PASS_SCORE', () => {
    const cl = {}
    REQUIRED_KEYS.forEach((k, i) => (cl[k] = { score: i === 0 ? 0 : PASS_SCORE }))
    const p = requiredProgress(cl)
    expect(p.total).toBe(REQUIRED_KEYS.length)
    expect(p.done).toBe(REQUIRED_KEYS.length - 1)
    expect(allRequiredChecked(cl)).toBe(false)
  })

  it('passes when every required item meets PASS_SCORE', () => {
    expect(allRequiredChecked(allAt(PASS_SCORE))).toBe(true)
  })
})

describe('rubricScore', () => {
  it('an empty assessment scores 0% / band none', () => {
    const s = rubricScore({})
    expect(s.earned).toBe(0)
    expect(s.percent).toBe(0)
    expect(s.band).toBe('none')
  })

  it('all-max scores 100% / band strong', () => {
    const s = rubricScore(allAt(MAX_SCORE))
    expect(s.percent).toBe(100)
    expect(s.band).toBe('strong')
    expect(s.earned).toBe(s.possible)
  })

  it('all-adequate (half of max) scores 50% / band weak', () => {
    const s = rubricScore(allAt(1)) // 1 of MAX_SCORE(2) on every item
    expect(s.percent).toBe(50)
    expect(s.band).toBe('weak') // < 55
  })

  it('weights heavier items more (additionality weight 3 > docs weight 1)', () => {
    const onlyAdditionality = rubricScore({ additionality: { score: MAX_SCORE } })
    const onlyDocs = rubricScore({ docs_complete: { score: MAX_SCORE } })
    expect(onlyAdditionality.earned).toBeGreaterThan(onlyDocs.earned)
  })

  it('band thresholds: >=80 strong, >=55 adequate, else weak', () => {
    // possible = sum(weight)*MAX_SCORE; craft earned to land in each band.
    expect(rubricScore(allAt(MAX_SCORE)).band).toBe('strong')
    // ~65% → adequate: score every item at 1 except give the highest-weight ones a 2.
    const mixed = allAt(1)
    mixed.additionality = { score: 2 }
    mixed.no_double_counting = { score: 2 }
    const s = rubricScore(mixed)
    expect(s.percent).toBeGreaterThanOrEqual(55)
    expect(['adequate', 'strong']).toContain(s.band)
  })
})
