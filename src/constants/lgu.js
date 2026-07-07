/**
 * LGU (Local Government Unit) tooling constants.
 *
 * Municipal solid waste (MSW) emission factors use the IPCC default first-order
 * approximation also used by the carbon calculator: methane generated per tonne
 * of landfilled waste, converted to CO2e via the AR5 100-year GWP.
 */

export const WASTE_CH4_FACTOR = 0.052 // tonnes CH4 per tonne MSW (IPCC default)
export const CH4_GWP = 28 // IPCC AR5 100-year GWP for methane

/** tCO2e avoided/emitted per tonne of MSW landfilled. */
export const EMISSION_PER_TONNE = WASTE_CH4_FACTOR * CH4_GWP

export const ORGANIZATION_TYPES = [
  'Municipal LGU',
  'City Government',
  'Provincial LGU',
  'Barangay',
  'Cooperative',
  'NGO / Civil Society',
  'Private Company',
  'Other',
]

/**
 * Compute MSW emissions from generated + diverted tonnage.
 * Diverting waste from landfill avoids its methane emissions.
 */
export function computeWasteEmissions(generated, diverted) {
  const g = Math.max(Number(generated) || 0, 0)
  const d = Math.min(Math.max(Number(diverted) || 0, 0), g)
  const baseline = g * EMISSION_PER_TONNE
  const avoided = d * EMISSION_PER_TONNE
  return {
    generated: g, // sanitized (>= 0)
    diverted: d, // sanitized + clamped to <= generated
    baseline, // if all generated waste were landfilled
    avoided, // avoided by diversion
    net: baseline - avoided, // actual emissions after diversion
    diversionRate: g > 0 ? (d / g) * 100 : 0,
  }
}

/** Rough estimate of annual MSW (tonnes) from population (0.4 kg/person/day). */
export function estimateWasteFromPopulation(population) {
  const p = Math.max(Number(population) || 0, 0)
  return (p * 0.4 * 365) / 1000
}
