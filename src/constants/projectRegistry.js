// Project Registry constants (expansion #1) — methodology standards + the
// project development lifecycle.
//
// Both are stored as free text on `projects` so a drifted DB never rejects a
// write, but the UI drives them from these lists. That gives filterable,
// groupable values without an enum type that would be painful to extend.

/**
 * Recognised carbon standards / methodologies.
 *
 * `methodology` was a free-text box, so "Gold Standard", "gold standard", and
 * "GS" were three different projects to any filter. These are the canonical
 * values; `other` lets a developer record a standard we haven't listed rather
 * than forcing a wrong choice.
 */
export const METHODOLOGY_STANDARDS = [
  { value: 'verra_vcs', label: 'Verra (VCS)', group: 'International' },
  { value: 'gold_standard', label: 'Gold Standard', group: 'International' },
  { value: 'puro_earth', label: 'Puro.earth', group: 'International' },
  { value: 'iso_14064', label: 'ISO 14064', group: 'International' },
  { value: 'cdm', label: 'CDM (Clean Development Mechanism)', group: 'International' },
  { value: 'acr', label: 'American Carbon Registry (ACR)', group: 'International' },
  { value: 'car', label: 'Climate Action Reserve (CAR)', group: 'International' },
  { value: 'plan_vivo', label: 'Plan Vivo', group: 'International' },
  { value: 'isccc', label: 'ISCC', group: 'International' },
  { value: 'ph_national', label: 'Philippine national methodology (DENR/CCC)', group: 'Philippines' },
  { value: 'carbonify_standard', label: 'Carbonify Standard (interim)', group: 'Philippines' },
  { value: 'other', label: 'Other / not listed', group: 'Other' },
]

/**
 * Where the project is in its development lifecycle.
 *
 * DISTINCT from `projects.status`, which tracks the Carbonify *validation*
 * workflow (draft → submitted → validated → rejected). A project can be fully
 * validated on the platform and still only be at feasibility stage in the real
 * world — investors care about the latter, and conflating them was the bug.
 */
export const DEVELOPMENT_STATUSES = [
  { value: 'concept', label: 'Concept', description: 'Idea stage; no feasibility work yet.' },
  { value: 'feasibility', label: 'Feasibility', description: 'Technical and financial feasibility under study.' },
  { value: 'financing', label: 'Financing', description: 'Seeking or closing capital.' },
  { value: 'construction', label: 'Construction', description: 'Being built or installed.' },
  { value: 'operational', label: 'Operational', description: 'Running and generating reductions.' },
  { value: 'decommissioned', label: 'Decommissioned', description: 'No longer operating.' },
]

const METHODOLOGY_LABELS = Object.fromEntries(METHODOLOGY_STANDARDS.map((m) => [m.value, m.label]))
const DEVELOPMENT_LABELS = Object.fromEntries(DEVELOPMENT_STATUSES.map((d) => [d.value, d.label]))

/** Methodology values grouped for an <optgroup>-style dropdown. */
export function methodologyGroups() {
  const groups = new Map()
  for (const m of METHODOLOGY_STANDARDS) {
    const list = groups.get(m.group) || []
    list.push(m)
    groups.set(m.group, list)
  }
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }))
}

const titleize = (value) =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Human label for a methodology value. Legacy rows hold arbitrary free text
 * (e.g. "Verra VM0044"), so an unrecognised value is shown as-is rather than
 * mangled — it is real information a developer typed.
 */
export function methodologyLabel(value) {
  if (!value) return null
  if (METHODOLOGY_LABELS[value]) return METHODOLOGY_LABELS[value]
  return String(value).includes('_') ? titleize(value) : String(value)
}

/** Human label for a development_status value. */
export function developmentStatusLabel(value) {
  if (!value) return null
  return DEVELOPMENT_LABELS[value] || titleize(value)
}

/** True when the value is one of the canonical, filterable methodology keys. */
export function isKnownMethodology(value) {
  return Object.prototype.hasOwnProperty.call(METHODOLOGY_LABELS, value)
}
