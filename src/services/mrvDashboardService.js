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
 * Mirrors assetLedgerService: fetch owned projects → parallel drift-safe reads →
 * a pure, unit-tested aggregate function.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

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
 * @param {number} [input.cadenceDays=365]
 * @param {number} [input.now=Date.now()]
 * @returns {Object}
 */
export function aggregateMrvDashboard({
  projects = [],
  reports = [],
  vers = [],
  activity = [],
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

  // Verified/pending VERs per project.
  const verByProject = new Map()
  let verifiedVers = 0
  let pendingVers = 0
  for (const v of vers || []) {
    const qty = Number(v?.approved_quantity) || 0
    if (v?.status === 'approved') verifiedVers += qty
    else if (v?.status === 'pending') pendingVers += qty
    if (!v?.project_id) continue
    const cur = verByProject.get(v.project_id) || { verified: 0, pending: 0 }
    if (v.status === 'approved') cur.verified += qty
    else if (v.status === 'pending') cur.pending += qty
    verByProject.set(v.project_id, cur)
  }

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
    },
    metricTotals,
    trend,
    perProject,
    compliance: complianceCounts,
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
  const empty = aggregateMrvDashboard({})
  if (!supabase) return empty

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return empty

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
  if (!projectIds.length) return empty

  const [reports, vers, cadenceDays] = await Promise.all([
    safeIn(
      supabase,
      'monitoring_reports',
      'id, project_id, status, proposed_vers, period_end, created_at',
      'project_id',
      projectIds,
    ),
    safeIn(
      supabase,
      'verified_emission_reductions',
      'project_id, approved_quantity, status, approved_at, created_at',
      'project_id',
      projectIds,
    ),
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

  return aggregateMrvDashboard({ projects, reports, vers, activity, cadenceDays: Number(cadenceDays) || 365 })
}
