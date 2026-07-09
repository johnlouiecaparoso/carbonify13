import { getSupabase } from '@/services/supabaseClient'
import { getReportingCadenceDays } from '@/services/mrvReminderService'
import { metricLabel, metricUnit } from '@/constants/mrv'

/**
 * MRV roll-up dashboard service (expansion feature #4).
 *
 * Aggregates a developer's Monitoring/Reporting/Verification activity across all
 * their validated projects into totals, a monthly tCO₂e trend (proposed vs
 * verified), per-metric activity sums, and a per-project compliance status
 * (against the admin reporting cadence). Pure aggregation over existing tables —
 * no new schema. Satellite/IoT feeds are intentionally out of scope.
 *
 * It also rolls up the SUPPLY side from the Farmer Portal (#6): farmers
 * participating, biomass collected, and plantation hectares — the developer here
 * is the RFQ *buyer*, so these are supply-chain figures rather than per-project
 * ones. Plantation hectares needs migration #26 (a buyer can read the parcels
 * that supplied them); until it's applied, `parcels` arrives empty and the metric
 * reports as unavailable rather than as zero.
 *
 * Mirrors assetLedgerService: fetch owned projects → parallel drift-safe reads →
 * a pure, unit-tested aggregate function.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Mass units we can express in tonnes. Deliveries also allow sacks/bales/m³,
 * whose mass depends on the feedstock's bulk density — converting those would be
 * inventing a number, so they are counted separately and excluded from the total.
 */
const TONNE_FACTORS = { tonnes: 1, kg: 0.001 }

/**
 * Roll the farmer supply chain up for a developer (the RFQ buyer).
 *
 * Only CONFIRMED deliveries count: a pending one hasn't been verified as received,
 * and a rejected one never arrived. Counting either would overstate the biomass a
 * developer can claim to have collected.
 *
 * @param {Array<{farmer_id?:string, parcel_id?:string, quantity?:number, unit?:string, status?:string}>} [deliveries]
 * @param {Array<{id?:string, area_hectares?:number, status?:string}>} [parcels]
 *   parcels supplying this developer; empty when RLS hides them (see migration #26)
 * @returns {{farmersParticipating:number, biomassCollectedTonnes:number,
 *   confirmedDeliveries:number, unconvertedDeliveries:number,
 *   plantationHectares:number, hectaresAvailable:boolean}}
 */
export function aggregateFarmerSupply(deliveries = [], parcels = []) {
  const rows = Array.isArray(deliveries) ? deliveries : []
  const farmers = new Set()
  const parcelIds = new Set()
  let biomassCollectedTonnes = 0
  let confirmedDeliveries = 0
  let unconvertedDeliveries = 0

  for (const d of rows) {
    if (d?.status !== 'confirmed') continue
    confirmedDeliveries += 1
    if (d.farmer_id) farmers.add(d.farmer_id)
    if (d.parcel_id) parcelIds.add(d.parcel_id)

    const factor = TONNE_FACTORS[d.unit]
    if (factor == null) {
      unconvertedDeliveries += 1
      continue
    }
    biomassCollectedTonnes += (Number(d.quantity) || 0) * factor
  }

  // Hectares only from parcels that actually supplied a confirmed delivery, and
  // never from retired land.
  const supplying = (Array.isArray(parcels) ? parcels : []).filter(
    (p) => p?.id && parcelIds.has(p.id) && p.status !== 'retired',
  )
  const plantationHectares = supplying.reduce((s, p) => s + (Number(p.area_hectares) || 0), 0)

  return {
    farmersParticipating: farmers.size,
    biomassCollectedTonnes: round2(biomassCollectedTonnes),
    confirmedDeliveries,
    unconvertedDeliveries,
    plantationHectares: round2(plantationHectares),
    // Distinguishes "no parcels supplied us" from "we cannot see the parcels".
    hectaresAvailable: supplying.length > 0 || parcelIds.size === 0,
  }
}

function monthKey(dateLike) {
  if (!dateLike) return null
  const d = new Date(dateLike)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [y, m] = String(key).split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })
}

/**
 * Pure roll-up. Exported for unit testing.
 *
 * @param {Object} input
 * @param {Array<{id:string,title?:string,category?:string,created_at?:string}>} input.projects
 * @param {Array<{project_id:string,status?:string,proposed_vers?:number,period_end?:string,created_at?:string,id?:string}>} [input.reports]
 * @param {Array<{project_id:string,approved_quantity?:number,status?:string,approved_at?:string,created_at?:string}>} [input.vers]
 * @param {Array<{report_id:string,metric_key:string,value?:number,unit?:string}>} [input.activity]
 * @param {Array<Object>} [input.deliveries] confirmed farmer deliveries to this developer
 * @param {Array<Object>} [input.parcels] parcels that supplied those deliveries
 * @param {number} [input.cadenceDays=365]
 * @param {number} [input.now=Date.now()]
 * @returns {Object}
 */
export function aggregateMrvDashboard({
  projects = [],
  reports = [],
  vers = [],
  activity = [],
  deliveries = [],
  parcels = [],
  cadenceDays = 365,
  now = Date.now(),
} = {}) {
  const byStatus = { draft: 0, submitted: 0, under_review: 0, approved: 0, rejected: 0 }
  let proposedVers = 0

  // Group reports per project + tally statuses.
  const reportsByProject = new Map()
  const reportProjectById = new Map() // report_id → project_id (to attribute activity)
  for (const r of reports || []) {
    if (r?.status && byStatus[r.status] != null) byStatus[r.status] += 1
    proposedVers += Number(r?.proposed_vers) || 0
    if (!r?.project_id) continue
    const list = reportsByProject.get(r.project_id) || []
    list.push(r)
    reportsByProject.set(r.project_id, list)
    if (r.id) reportProjectById.set(r.id, r.project_id)
  }

  // Verified/pending VERs per project, split by removal vs avoidance.
  //
  // A VER approved before migration #29 has no `reduction_type`. It lands in an
  // explicit `unclassified` bucket rather than being guessed into one of the two
  // — a removal and an avoidance are not interchangeable, and inventing the
  // distinction after issuance would misrepresent what a verifier actually
  // asserted.
  const verByProject = new Map()
  let verifiedVers = 0
  let pendingVers = 0
  const verifiedByType = { removal: 0, avoidance: 0, unclassified: 0 }
  for (const v of vers || []) {
    const qty = Number(v?.approved_quantity) || 0
    if (v?.status === 'approved') {
      verifiedVers += qty
      const type = v?.reduction_type === 'removal' || v?.reduction_type === 'avoidance'
        ? v.reduction_type
        : 'unclassified'
      verifiedByType[type] += qty
    } else if (v?.status === 'pending') pendingVers += qty
    if (!v?.project_id) continue
    const cur = verByProject.get(v.project_id) || { verified: 0, pending: 0 }
    if (v.status === 'approved') cur.verified += qty
    else if (v.status === 'pending') cur.pending += qty
    verByProject.set(v.project_id, cur)
  }
  for (const k of Object.keys(verifiedByType)) verifiedByType[k] = round2(verifiedByType[k])

  // Per-metric activity sums (keys span project types).
  const metricMap = new Map()
  for (const a of activity || []) {
    if (!a?.metric_key) continue
    const cur = metricMap.get(a.metric_key) || { metric_key: a.metric_key, value: 0, unit: a.unit || metricUnit(a.metric_key) }
    cur.value += Number(a.value) || 0
    metricMap.set(a.metric_key, cur)
  }
  const metricTotals = Array.from(metricMap.values())
    .map((m) => ({ ...m, value: round2(m.value), label: metricLabel(m.metric_key) }))
    .sort((a, b) => b.value - a.value)

  // Energy GENERATED is a headline metric in its own right. Deliberately not
  // merged with `energy_saved_kwh` — energy saved is avoided consumption, a
  // different claim, and adding them would overstate what the project produced.
  const energyGeneratedKwh = round2(metricMap.get('energy_kwh')?.value || 0)

  // Monthly trend: proposed (from reports) vs verified (from approved VERs).
  const proposedByMonth = new Map()
  for (const r of reports || []) {
    const key = monthKey(r?.period_end || r?.created_at)
    if (!key) continue
    proposedByMonth.set(key, (proposedByMonth.get(key) || 0) + (Number(r?.proposed_vers) || 0))
  }
  const verifiedByMonth = new Map()
  for (const v of vers || []) {
    if (v?.status !== 'approved') continue
    const key = monthKey(v?.approved_at || v?.created_at)
    if (!key) continue
    verifiedByMonth.set(key, (verifiedByMonth.get(key) || 0) + (Number(v?.approved_quantity) || 0))
  }
  const monthKeys = Array.from(new Set([...proposedByMonth.keys(), ...verifiedByMonth.keys()])).sort()
  const trend = {
    labels: monthKeys.map(monthLabel),
    proposed: monthKeys.map((k) => round2(proposedByMonth.get(k) || 0)),
    verified: monthKeys.map((k) => round2(verifiedByMonth.get(k) || 0)),
  }

  // Per-project compliance vs cadence.
  const complianceCounts = { overdue: 0, due_soon: 0, on_track: 0 }
  let projectsReporting = 0
  const perProject = (projects || []).map((p) => {
    const rlist = (reportsByProject.get(p.id) || [])
      .slice()
      .sort((a, b) => new Date(b.period_end || b.created_at || 0) - new Date(a.period_end || a.created_at || 0))
    const hasEverReported = rlist.length > 0
    if (hasEverReported) projectsReporting += 1
    const latest = rlist[0] || null
    const anchor = latest?.period_end || latest?.created_at || p.created_at || now
    const dueDate = new Date(anchor).getTime() + cadenceDays * DAY_MS
    const daysUntil = Math.floor((dueDate - now) / DAY_MS)
    const state = daysUntil < 0 ? 'overdue' : daysUntil <= 30 ? 'due_soon' : 'on_track'
    complianceCounts[state] += 1
    const v = verByProject.get(p.id) || { verified: 0, pending: 0 }

    return {
      projectId: p.id,
      title: p.title || 'Untitled Project',
      category: p.category || '',
      reportsCount: rlist.length,
      latestStatus: latest?.status || null,
      lastPeriodEnd: latest?.period_end || latest?.created_at || null,
      proposedVers: round2(rlist.reduce((s, r) => s + (Number(r.proposed_vers) || 0), 0)),
      verifiedVers: round2(v.verified),
      compliance: { state, dueDate: new Date(dueDate).toISOString(), daysUntil, hasEverReported },
    }
  })
  // Most-urgent projects first (overdue → due soon → on track), then soonest due.
  const order = { overdue: 0, due_soon: 1, on_track: 2 }
  perProject.sort(
    (a, b) => order[a.compliance.state] - order[b.compliance.state] || a.compliance.daysUntil - b.compliance.daysUntil,
  )

  return {
    totals: {
      projects: (projects || []).length,
      reportsTotal: (reports || []).length,
      byStatus,
      proposedVers: round2(proposedVers),
      verifiedVers: round2(verifiedVers),
      pendingVers: round2(pendingVers),
      projectsReporting,
      energyGeneratedKwh,
    },
    verifiedByType,
    metricTotals,
    trend,
    perProject,
    compliance: complianceCounts,
    supply: aggregateFarmerSupply(deliveries, parcels),
  }
}

/** Drift-safe optional read (degrade to [] if a table/column is absent). */
async function safeIn(supabase, table, columns, col, ids) {
  if (!ids.length) return []
  try {
    const { data, error } = await supabase.from(table).select(columns).in(col, ids)
    if (error) {
      console.warn(`[mrvDashboard] ${table} unavailable, skipping:`, error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.warn(`[mrvDashboard] ${table} threw, skipping:`, err?.message)
    return []
  }
}

/**
 * Build the signed-in developer's MRV dashboard. Returns the aggregate shape, or
 * an empty dashboard if unauthenticated / no validated projects.
 */
export async function getMyMrvDashboard() {
  const supabase = getSupabase()
  if (!supabase) return aggregateMrvDashboard({})

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return aggregateMrvDashboard({})

  // Supply side is independent of the project list — a developer can be buying
  // feedstock before any of their projects is validated — so fetch it up front
  // and include it even in the otherwise-empty dashboard.
  const { deliveries, parcels } = await getFarmerSupply(supabase, user.id)

  // Validated projects are the ones expected to report.
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, title, category, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'validated')

  if (projErr) {
    console.error('[mrvDashboard] failed to load projects:', projErr.message)
    throw new Error(projErr.message || 'Failed to load your projects')
  }
  const projectIds = (projects || []).map((p) => p.id)
  if (!projectIds.length) return aggregateMrvDashboard({ deliveries, parcels })

  const [reports, vers, cadenceDays] = await Promise.all([
    safeIn(
      supabase,
      'monitoring_reports',
      'id, project_id, status, proposed_vers, period_end, created_at',
      'project_id',
      projectIds,
    ),
    // `reduction_type` arrives with migration #29; safeIn degrades the whole read
    // to [] on a missing column, which would blank the dashboard. Try with it,
    // then without — an unclassified split beats no MRV data at all.
    (async () => {
      const withType = await safeIn(
        supabase,
        'verified_emission_reductions',
        'project_id, approved_quantity, status, approved_at, created_at, reduction_type',
        'project_id',
        projectIds,
      )
      if (withType.length) return withType
      return safeIn(
        supabase,
        'verified_emission_reductions',
        'project_id, approved_quantity, status, approved_at, created_at',
        'project_id',
        projectIds,
      )
    })(),
    getReportingCadenceDays().catch(() => 365),
  ])

  const reportIds = (reports || []).map((r) => r.id).filter(Boolean)
  const activity = await safeIn(
    supabase,
    'monitoring_activity_data',
    'report_id, metric_key, value, unit',
    'report_id',
    reportIds,
  )

  return aggregateMrvDashboard({
    projects,
    reports,
    vers,
    activity,
    deliveries,
    parcels,
    cadenceDays: Number(cadenceDays) || 365,
  })
}

/**
 * Confirmed farmer deliveries where this developer is the buyer, plus the parcels
 * that supplied them. Both reads are drift-safe: on a DB without migration #25 the
 * tables are absent, and without #26 the parcels are hidden by RLS — either way we
 * degrade to [] rather than failing the dashboard.
 */
async function getFarmerSupply(supabase, userId) {
  let deliveries = []
  try {
    const { data, error } = await supabase
      .from('farmer_deliveries')
      .select('farmer_id, parcel_id, quantity, unit, status')
      .eq('buyer_id', userId)
      .eq('status', 'confirmed')
    if (error) {
      console.warn('[mrvDashboard] farmer_deliveries unavailable, skipping:', error.message)
    } else {
      deliveries = data || []
    }
  } catch (err) {
    console.warn('[mrvDashboard] farmer_deliveries threw, skipping:', err?.message)
  }

  const parcelIds = [...new Set(deliveries.map((d) => d.parcel_id).filter(Boolean))]
  if (!parcelIds.length) return { deliveries, parcels: [] }

  const parcels = await safeIn(supabase, 'farm_parcels', 'id, area_hectares, status', 'id', parcelIds)
  return { deliveries, parcels }
}
