/**
 * Standard validation rubric verifiers work through before validating a project.
 * Definitions live in code (a consistent rubric for all projects); per-project
 * pass/note state is stored in verification_assessments.checklist keyed by `key`.
 */
export const CHECKLIST_SECTIONS = [
  {
    section: 'Documentation',
    items: [
      { key: 'docs_complete', label: 'Required project documents are attached and legible', required: true },
      { key: 'baseline_methodology', label: 'Baseline & methodology are clearly described', required: true },
    ],
  },
  {
    section: 'Eligibility',
    items: [
      { key: 'additionality', label: 'Additionality is demonstrated (project needs the credit revenue)', required: true },
      { key: 'no_double_counting', label: 'Credits are not double-counted / claimed elsewhere', required: true },
      { key: 'location_verified', label: 'Project location and ownership/host consent verified', required: false },
    ],
  },
  {
    section: 'MRV',
    items: [
      { key: 'monitoring_plan', label: 'A monitoring plan with measurable metrics is defined', required: true },
      { key: 'emission_factors', label: 'Emission factors / calculations are appropriate for the project type', required: true },
      { key: 'data_quality', label: 'Supporting data (logs, photos) is sufficient and credible', required: false },
    ],
  },
]

/** Flat list of all items. */
export const CHECKLIST_ITEMS = CHECKLIST_SECTIONS.flatMap((s) => s.items)

/** Keys of required items. */
export const REQUIRED_KEYS = CHECKLIST_ITEMS.filter((i) => i.required).map((i) => i.key)

/** True if every required item is checked in the given checklist map. */
export function allRequiredChecked(checklist = {}) {
  return REQUIRED_KEYS.every((k) => checklist?.[k]?.checked === true)
}

/** { done, total } completion of required items. */
export function requiredProgress(checklist = {}) {
  const done = REQUIRED_KEYS.filter((k) => checklist?.[k]?.checked === true).length
  return { done, total: REQUIRED_KEYS.length }
}
