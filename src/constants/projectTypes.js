/**
 * Philippine-eligible carbon project types.
 *
 * These categories align with DENR–Climate Change Service (CCS), the Climate
 * Change Commission (CCC), and LGU climate programs as required by the
 * Carbonify platform review. The dropdown in ProjectForm, the marketplace
 * filters, analytics, and the DB CHECK constraint all source their values
 * from this single list so they never drift apart.
 *
 * `value` is what gets stored in `projects.category` (kept human-readable to
 * stay consistent with existing rows and the marketplace filter, which groups
 * listings by their category string).
 */

export const PROJECT_TYPES = [
  {
    value: 'Biochar & Bio-briquettes',
    label: 'Biochar & Bio-briquettes',
    description: 'Carbon sequestration through biochar and bio-briquette production facilities.',
    icon: 'eco',
  },
  {
    value: 'Biomass-to-Energy (WTE)',
    label: 'Biomass-to-Energy (WTE)',
    description: 'Waste-to-energy, briquettes, and pellet plants that displace fossil fuels.',
    icon: 'bolt',
  },
  {
    value: 'Reforestation & Agroforestry',
    label: 'Reforestation & Agroforestry',
    description: 'Tree planting and agroforestry (Bana grass, bamboo, mangroves) that remove CO₂.',
    icon: 'forest',
  },
  {
    value: 'Renewable Energy',
    label: 'Renewable Energy',
    description: 'Solar, biogas, and micro-hydro generation replacing grid emissions.',
    icon: 'solar_power',
  },
  {
    value: 'Methane Avoidance',
    label: 'Methane Avoidance',
    description: 'Livestock and waste-management projects that capture or avoid methane.',
    icon: 'cyclone',
  },
  {
    value: 'Industrial Decarbonization',
    label: 'Industrial Decarbonization',
    description: 'Process efficiency, fuel switching, and emissions reduction in industry.',
    icon: 'factory',
  },
  {
    value: 'Coastal & Watershed Protection',
    label: 'Coastal & Watershed Protection',
    description: 'Blue-carbon and watershed conservation that protect carbon sinks.',
    icon: 'water',
  },
]

/** Array of just the allowed stored values — used for validation. */
export const PROJECT_TYPE_VALUES = PROJECT_TYPES.map((type) => type.value)

/**
 * Check whether a category string is an allowed Philippine-eligible type.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidProjectType(value) {
  return PROJECT_TYPE_VALUES.includes((value || '').trim())
}

export default PROJECT_TYPES
