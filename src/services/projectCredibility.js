/**
 * Structured additionality + permanence metadata (Phase 3 — buyer trust).
 * Pure and side-effect-free: option vocabularies, display labels, and a
 * normalizer that coerces raw form input into DB-safe values (or null).
 *
 * The allowed values here MUST match the CHECK constraints in
 * 20260701000000_project_credibility_metadata.sql.
 */

export const ADDITIONALITY_TYPES = [
  {
    value: 'financial',
    label: 'Financial barrier',
    description: 'Would not be financially viable without carbon revenue.',
  },
  {
    value: 'technological',
    label: 'Technological barrier',
    description: 'Faces technology hurdles that carbon finance helps overcome.',
  },
  {
    value: 'institutional',
    label: 'Institutional / regulatory barrier',
    description: 'Blocked by institutional or regulatory obstacles absent this support.',
  },
  {
    value: 'common_practice',
    label: 'Beyond common practice',
    description: 'Goes beyond what is standard practice in the region/sector.',
  },
]

export const REVERSAL_RISK_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const ADDITIONALITY_VALUES = new Set(ADDITIONALITY_TYPES.map((t) => t.value))
const REVERSAL_RISK_VALUES = new Set(REVERSAL_RISK_LEVELS.map((r) => r.value))

/** Human label for an additionality type, or '—' if unknown/empty. */
export function additionalityLabel(value) {
  return ADDITIONALITY_TYPES.find((t) => t.value === value)?.label || '—'
}

/** Human label for a reversal-risk level, or '—' if unknown/empty. */
export function reversalRiskLabel(value) {
  return REVERSAL_RISK_LEVELS.find((r) => r.value === value)?.label || '—'
}

/** "100 years" / "1 year" / '—' for a permanence duration. */
export function formatPermanence(years) {
  const n = Number(years)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const whole = Math.round(n)
  return `${whole} ${whole === 1 ? 'year' : 'years'}`
}

/**
 * Coerce raw form values into DB-safe credibility metadata. Unknown enum values
 * and out-of-range / non-numeric permanence become null so we never violate the
 * migration's CHECK constraints.
 *
 * @param {{additionality_type?:string, permanence_years?:(number|string), reversal_risk?:string}} input
 * @returns {{additionality_type:(string|null), permanence_years:(number|null), reversal_risk:(string|null)}}
 */
export function normalizeCredibility(input = {}) {
  const additionality_type = ADDITIONALITY_VALUES.has(input.additionality_type)
    ? input.additionality_type
    : null
  const reversal_risk = REVERSAL_RISK_VALUES.has(input.reversal_risk) ? input.reversal_risk : null

  let permanence_years = null
  const n = Number(input.permanence_years)
  if (Number.isFinite(n) && n > 0) {
    permanence_years = Math.min(Math.round(n), 1000)
  }

  return { additionality_type, permanence_years, reversal_risk }
}
