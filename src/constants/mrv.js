/**
 * MRV (Monitoring, Reporting, Verification) constants.
 *
 * METRICS_BY_TYPE mirrors the seeded rows in the `methodology_factors` table
 * (migration 20260604010000). The form uses it to know which activity-data
 * fields to show per project type; the DB uses the factors to compute the
 * actual emission reductions server-side. Keep the two in sync.
 */

export const REPORT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const REPORT_STATUS_META = {
  draft: { label: 'Draft', color: 'gray' },
  submitted: { label: 'Submitted', color: 'yellow' },
  under_review: { label: 'Under Review', color: 'blue' },
  approved: { label: 'Approved', color: 'green' },
  rejected: { label: 'Rejected', color: 'red' },
}

export const PERIOD_TYPES = [
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
]

/**
 * Whether a tonne of CO₂e was REMOVED from the atmosphere or its emission was
 * AVOIDED. Registries and buyers price these very differently — a durable
 * removal (biochar, afforestation) is not interchangeable with an avoided
 * emission (a cookstove, diverted methane) — so summing them into one tCO₂e
 * figure, as the dashboard did, hides the distinction that matters most.
 */
export const REDUCTION_TYPES = [
  {
    value: 'removal',
    label: 'Removal',
    description: 'CO₂ taken out of the atmosphere and durably stored (biochar, trees, soil).',
  },
  {
    value: 'avoidance',
    label: 'Avoidance',
    description: 'Emissions that would have occurred but did not (methane capture, clean energy).',
  },
]

const REDUCTION_LABELS = Object.fromEntries(REDUCTION_TYPES.map((r) => [r.value, r.label]))

/** Human label for a reduction_type; unclassified when unset. */
export function reductionTypeLabel(value) {
  return REDUCTION_LABELS[value] || 'Unclassified'
}

/**
 * The likely reduction type for a project category, used ONLY to pre-select the
 * verifier's dropdown. It is a suggestion, never an automatic classification:
 * a category can produce both (biochar removes carbon; the bio-briquettes burnt
 * alongside it avoid emissions), and mislabelling a credit is a registry-grade
 * error. The verifier confirms every one.
 *
 * @returns {'removal'|'avoidance'|''} '' when the category gives no clear steer.
 */
export function suggestedReductionType(category) {
  switch (category) {
    case 'Biochar & Bio-briquettes':
    case 'Reforestation & Agroforestry':
    case 'Coastal & Watershed Protection':
      return 'removal'
    case 'Biomass-to-Energy (WTE)':
    case 'Renewable Energy':
    case 'Methane Avoidance':
    case 'Industrial Decarbonization':
      return 'avoidance'
    default:
      return ''
  }
}

/**
 * Activity-data metrics per project type. metric_key/unit must match
 * methodology_factors. `label` is shown on the form.
 */
export const METRICS_BY_TYPE = {
  'Biochar & Bio-briquettes': [
    { metric_key: 'biochar_tonnes', label: 'Biochar produced', unit: 'tonnes' },
    { metric_key: 'briquettes_tonnes', label: 'Bio-briquettes produced', unit: 'tonnes' },
  ],
  'Biomass-to-Energy (WTE)': [
    { metric_key: 'energy_kwh', label: 'Energy generated', unit: 'kWh' },
    { metric_key: 'waste_tonnes', label: 'Waste processed', unit: 'tonnes' },
  ],
  'Reforestation & Agroforestry': [
    { metric_key: 'area_hectares', label: 'Area under restoration', unit: 'hectares' },
    { metric_key: 'trees_planted', label: 'Trees planted', unit: 'trees' },
  ],
  'Renewable Energy': [
    { metric_key: 'energy_kwh', label: 'Clean energy generated', unit: 'kWh' },
  ],
  'Methane Avoidance': [
    { metric_key: 'methane_tonnes', label: 'Methane captured/avoided', unit: 'tonnes' },
    { metric_key: 'waste_tonnes_diverted', label: 'Waste diverted', unit: 'tonnes' },
  ],
  'Industrial Decarbonization': [
    { metric_key: 'emissions_reduced_tco2e', label: 'Direct emissions reduced', unit: 'tCO2e' },
    { metric_key: 'energy_saved_kwh', label: 'Energy saved', unit: 'kWh' },
  ],
  'Coastal & Watershed Protection': [
    { metric_key: 'area_hectares', label: 'Area protected/restored', unit: 'hectares' },
  ],
}

/**
 * Metrics for a given project type (empty array if the type is unknown).
 */
export function getMetricsForType(projectType) {
  return METRICS_BY_TYPE[projectType] || []
}

// Flat metric_key → { label, unit } map, built from every project type. Used by
// the MRV dashboard to label aggregated activity-data sums (keys span types).
const METRIC_META = {}
for (const list of Object.values(METRICS_BY_TYPE)) {
  for (const m of list) {
    if (!METRIC_META[m.metric_key]) METRIC_META[m.metric_key] = { label: m.label, unit: m.unit }
  }
}

/** Friendly label for an activity metric_key; falls back to a titleized key. */
export function metricLabel(metricKey) {
  return (
    METRIC_META[metricKey]?.label ||
    String(metricKey || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

/** Unit for an activity metric_key (empty string if unknown). */
export function metricUnit(metricKey) {
  return METRIC_META[metricKey]?.unit || ''
}

/** Max evidence file size stored as a data URL (matches the app's data-URL pattern). */
export const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024 // 2MB
