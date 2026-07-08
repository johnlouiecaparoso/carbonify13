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
