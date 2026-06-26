// UN Sustainable Development Goals (SDGs) — the canonical 17 goals.
//
// Projects tag the SDGs they contribute to (stored on projects.co_benefits as an
// array of `sdgTag()` strings, e.g. "SDG 13: Climate Action"). The detail page
// shows them as chips and the marketplace lets buyers filter by goal.

export const SDGS = Object.freeze([
  { id: 1, label: 'No Poverty' },
  { id: 2, label: 'Zero Hunger' },
  { id: 3, label: 'Good Health and Well-being' },
  { id: 4, label: 'Quality Education' },
  { id: 5, label: 'Gender Equality' },
  { id: 6, label: 'Clean Water and Sanitation' },
  { id: 7, label: 'Affordable and Clean Energy' },
  { id: 8, label: 'Decent Work and Economic Growth' },
  { id: 9, label: 'Industry, Innovation and Infrastructure' },
  { id: 10, label: 'Reduced Inequalities' },
  { id: 11, label: 'Sustainable Cities and Communities' },
  { id: 12, label: 'Responsible Consumption and Production' },
  { id: 13, label: 'Climate Action' },
  { id: 14, label: 'Life Below Water' },
  { id: 15, label: 'Life on Land' },
  { id: 16, label: 'Peace, Justice and Strong Institutions' },
  { id: 17, label: 'Partnerships for the Goals' },
])

/** Canonical stored/display tag for an SDG, e.g. "SDG 13: Climate Action". */
export function sdgTag(goal) {
  return `SDG ${goal.id}: ${goal.label}`
}

/** All tags, for building filter option lists. */
export const SDG_TAGS = Object.freeze(SDGS.map(sdgTag))

/**
 * Normalize a project's co_benefits (array of strings or {label|sdg} objects)
 * to a flat list of tag strings.
 */
export function normalizeCoBenefits(coBenefits) {
  if (!Array.isArray(coBenefits)) return []
  return coBenefits
    .map((c) => (typeof c === 'string' ? c : c?.label || c?.sdg || ''))
    .filter(Boolean)
}
