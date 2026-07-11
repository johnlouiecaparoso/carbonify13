// Biomass Marketplace constants — feedstock product types + units (expansion #3).
// product_type/unit are stored as free text (drift-safe, allows 'other'); these
// drive the form dropdowns and label lookups.

export const BIOMASS_PRODUCT_TYPES = [
  { value: 'rice_husk', label: 'Rice husk' },
  { value: 'rice_straw', label: 'Rice straw' },
  { value: 'sugarcane_bagasse', label: 'Sugarcane bagasse' },
  { value: 'coconut_husk', label: 'Coconut husk' },
  { value: 'coconut_shell', label: 'Coconut shell' },
  { value: 'corn_cob', label: 'Corn cob / stover' },
  { value: 'wood_chips', label: 'Wood chips' },
  { value: 'wood_pellets', label: 'Wood pellets' },
  { value: 'black_pellets', label: 'Black pellets (torrefied)' },
  { value: 'biochar', label: 'Biochar' },
  { value: 'bana_grass', label: 'Bana grass' },
  { value: 'napier_grass', label: 'Napier grass' },
  { value: 'other', label: 'Other biomass' },
]

export const BIOMASS_UNITS = ['tonnes', 'kg', 'sacks', 'bales', 'm³']

const TYPE_LABELS = Object.fromEntries(BIOMASS_PRODUCT_TYPES.map((t) => [t.value, t.label]))

/** Human label for a product_type value; falls back to a titleized raw value. */
export function biomassTypeLabel(value) {
  if (!value) return 'Biomass'
  return TYPE_LABELS[value] || String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
