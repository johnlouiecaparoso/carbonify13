/**
 * Standard validation rubric verifiers work through before validating a project.
 * Definitions live in code (a consistent rubric for all projects); per-project
 * score/pass/note state is stored in verification_assessments.checklist keyed by `key`.
 *
 * Each stored item is `{ checked, note, score }` where `score` is one of the
 * RUBRIC_LEVELS values (0/1/2). `checked` is kept in sync (score >= PASS_SCORE)
 * so the older pass/fail helpers keep working.
 */

/** Weighted scoring scale applied to every rubric item. */
export const RUBRIC_LEVELS = [
  { value: 0, label: 'Inadequate', short: 'Fail', color: '#dc2626' },
  { value: 1, label: 'Adequate', short: 'OK', color: '#b45309' },
  { value: 2, label: 'Strong', short: 'Strong', color: '#047857' },
]

/** Minimum per-item score that counts as a pass (keeps `checked` semantics). */
export const PASS_SCORE = 1
/** Best possible per-item score. */
export const MAX_SCORE = 2

export const CHECKLIST_SECTIONS = [
  {
    section: 'Documentation',
    items: [
      { key: 'docs_complete', label: 'Required project documents are attached and legible', required: true, weight: 1 },
      { key: 'baseline_methodology', label: 'Baseline & methodology are clearly described', required: true, weight: 2 },
    ],
  },
  {
    section: 'Eligibility',
    items: [
      { key: 'additionality', label: 'Additionality is demonstrated (project needs the credit revenue)', required: true, weight: 3 },
      { key: 'no_double_counting', label: 'Credits are not double-counted / claimed elsewhere', required: true, weight: 3 },
      { key: 'location_verified', label: 'Project location and ownership/host consent verified', required: false, weight: 2 },
    ],
  },
  {
    section: 'MRV',
    items: [
      { key: 'monitoring_plan', label: 'A monitoring plan with measurable metrics is defined', required: true, weight: 2 },
      { key: 'emission_factors', label: 'Emission factors / calculations are appropriate for the project type', required: true, weight: 2 },
      { key: 'data_quality', label: 'Supporting data (logs, photos) is sufficient and credible', required: false, weight: 1 },
    ],
  },
]

/** Flat list of all items. */
export const CHECKLIST_ITEMS = CHECKLIST_SECTIONS.flatMap((s) => s.items)

/** Item definition by key (weight, required, label). */
export const ITEM_BY_KEY = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, i]))

/** Keys of required items. */
export const REQUIRED_KEYS = CHECKLIST_ITEMS.filter((i) => i.required).map((i) => i.key)

/** The numeric score recorded for an item (0 when unset). */
export function itemScore(checklist = {}, key) {
  const entry = checklist?.[key]
  if (!entry) return 0
  if (typeof entry.score === 'number') return entry.score
  // Back-compat: rows saved before scoring existed only have `checked`.
  return entry.checked ? PASS_SCORE : 0
}

/** True if every required item scores at least PASS_SCORE. */
export function allRequiredChecked(checklist = {}) {
  return REQUIRED_KEYS.every((k) => itemScore(checklist, k) >= PASS_SCORE)
}

/** { done, total } completion of required items (passed = score >= PASS_SCORE). */
export function requiredProgress(checklist = {}) {
  const done = REQUIRED_KEYS.filter((k) => itemScore(checklist, k) >= PASS_SCORE).length
  return { done, total: REQUIRED_KEYS.length }
}

/**
 * Weighted rubric score across all items.
 * Returns { earned, possible, percent, band, requiredPassed, requiredTotal }.
 * `band` is one of 'strong' | 'adequate' | 'weak' | 'none'.
 */
export function rubricScore(checklist = {}) {
  let earned = 0
  let possible = 0
  for (const item of CHECKLIST_ITEMS) {
    possible += item.weight * MAX_SCORE
    earned += item.weight * itemScore(checklist, item.key)
  }
  const percent = possible > 0 ? Math.round((earned / possible) * 100) : 0
  const { done, total } = requiredProgress(checklist)
  let band = 'none'
  if (earned > 0) {
    if (percent >= 80) band = 'strong'
    else if (percent >= 55) band = 'adequate'
    else band = 'weak'
  }
  return { earned, possible, percent, band, requiredPassed: done, requiredTotal: total }
}

/** Human label + color for a score band. */
export const BAND_META = {
  strong: { label: 'Strong', color: '#047857', bg: '#ecfdf5' },
  adequate: { label: 'Adequate', color: '#b45309', bg: '#fffbeb' },
  weak: { label: 'Weak', color: '#dc2626', bg: '#fef2f2' },
  none: { label: 'Not scored', color: '#6b7280', bg: '#f3f4f6' },
}
