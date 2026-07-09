// Farmer Portal constants (expansion #6). Crop types mirror the biomass feedstock
// catalog so a parcel's crop lines up with what the farmer lists on /biomass.
// Stored as free text (drift-safe, allows 'other').

export const FARM_CROP_TYPES = [
  { value: 'rice', label: 'Rice (palay)' },
  { value: 'sugarcane', label: 'Sugarcane' },
  { value: 'coconut', label: 'Coconut' },
  { value: 'corn', label: 'Corn' },
  { value: 'bamboo', label: 'Bamboo' },
  { value: 'bana_grass', label: 'Bana grass' },
  { value: 'napier_grass', label: 'Napier grass' },
  { value: 'cassava', label: 'Cassava' },
  { value: 'oil_palm', label: 'Oil palm' },
  { value: 'agroforestry', label: 'Agroforestry / mixed' },
  { value: 'other', label: 'Other crop' },
]

export const PARCEL_STATUSES = ['active', 'fallow', 'retired']

export const DELIVERY_STATUS_LABELS = Object.freeze({
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
})

export const PAYMENT_STATUS_LABELS = Object.freeze({
  unpaid: 'Unpaid',
  paid: 'Paid',
})

const CROP_LABELS = Object.fromEntries(FARM_CROP_TYPES.map((c) => [c.value, c.label]))

/** Human label for a crop_type value; falls back to a titleized raw value. */
export function cropTypeLabel(value) {
  if (!value) return 'Crop'
  return (
    CROP_LABELS[value] ||
    String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
