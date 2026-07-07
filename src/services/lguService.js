import { getSupabase } from '@/services/supabaseClient'
import { getCurrentUserId } from '@/utils/authHelper'
import { logUserAction } from '@/services/auditService'
import { computeWasteEmissions } from '@/constants/lgu'

/**
 * LGU emissions / waste-diversion records service.
 */

function client() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  return supabase
}

/**
 * Save a municipal emissions / diversion record. Emission figures are computed
 * from the generated/diverted tonnage so the stored values are consistent.
 */
export async function saveEmissionsRecord({
  municipality,
  periodLabel,
  population,
  wasteGenerated,
  wasteDiverted,
  notes = '',
}) {
  const supabase = client()
  const uid = await getCurrentUserId()
  if (!uid) throw new Error('User not authenticated')

  // Use the sanitized/clamped tonnage (diverted can never exceed generated) so
  // the stored waste figures stay consistent with the computed emissions and the
  // diversion rate can never render above 100%.
  const { generated, diverted, baseline, avoided, net } = computeWasteEmissions(
    wasteGenerated,
    wasteDiverted,
  )

  const { data, error } = await supabase
    .from('lgu_emissions_records')
    .insert([
      {
        user_id: uid,
        municipality: municipality || null,
        period_label: periodLabel || null,
        population: population ? Number(population) : null,
        waste_generated_tonnes: generated,
        waste_diverted_tonnes: diverted,
        baseline_emissions_tco2e: baseline,
        avoided_emissions_tco2e: avoided,
        net_emissions_tco2e: net,
        notes,
      },
    ])
    .select()
    .single()

  if (error) throw new Error(error.message || 'Failed to save record')

  try {
    await logUserAction('LGU_EMISSIONS_RECORDED', 'lgu_emissions_record', uid, data.id, {})
  } catch {
    /* non-critical */
  }
  return data
}

export async function getMyEmissionsRecords(userId = null) {
  const supabase = client()
  const uid = userId || (await getCurrentUserId())
  if (!uid) return []
  const { data, error } = await supabase
    .from('lgu_emissions_records')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message || 'Failed to load records')
  return data || []
}

export async function deleteEmissionsRecord(id) {
  const supabase = client()
  const { error } = await supabase.from('lgu_emissions_records').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete record')
}

/**
 * Aggregate records into a city ESG summary.
 */
export function buildEsgSummary(records = []) {
  const totals = records.reduce(
    (acc, r) => {
      acc.generated += Number(r.waste_generated_tonnes) || 0
      acc.diverted += Number(r.waste_diverted_tonnes) || 0
      acc.baseline += Number(r.baseline_emissions_tco2e) || 0
      acc.avoided += Number(r.avoided_emissions_tco2e) || 0
      acc.net += Number(r.net_emissions_tco2e) || 0
      return acc
    },
    { generated: 0, diverted: 0, baseline: 0, avoided: 0, net: 0 },
  )
  totals.diversionRate = totals.generated > 0 ? (totals.diverted / totals.generated) * 100 : 0
  totals.recordCount = records.length
  return totals
}
