import { getSupabase } from '@/services/supabaseClient'
import { computeProjectFinancials } from '@/services/investorAnalytics'
import { getOfftakeSummary } from '@/services/offtakeService'

/**
 * Investor Portal data service (expansion feature #5).
 *
 * Surfaces the cross-developer project pipeline (validated projects available for
 * investment / offtake), each with a computed financial model, plus portfolio-wide
 * pipeline summary. Reads existing tables only. Financial fields (capex/opex/…)
 * are optional — projects without them still appear with revenue/offtake context.
 *
 * Pure aggregation/summary helpers are exported for unit testing.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Summarize a set of pipeline projects (each already carrying a `.financials`
 * model). Pure — exported for testing.
 */
export function summarizePipeline(projects = []) {
  const byCategory = new Map()
  const totals = {
    projects: 0,
    credits: 0,
    grossRevenue: 0,
    totalRevenue: 0,
    contractedRevenue: 0,
    speculativeRevenue: 0,
    fundingTarget: 0,
    fundingGap: 0,
    withFinancials: 0,
    withOfftake: 0,
    irrSum: 0,
    irrCount: 0,
  }

  for (const p of projects || []) {
    const f = p.financials || {}
    totals.projects += 1
    totals.credits += Number(p.estimated_credits) || 0
    totals.grossRevenue += Number(f.grossRevenue) || 0
    totals.totalRevenue += Number(f.totalRevenue) || Number(f.grossRevenue) || 0
    totals.contractedRevenue += Number(f.contractedRevenue) || 0
    totals.speculativeRevenue += Number(f.speculativeRevenue) || 0
    if (f.agreementCount > 0) totals.withOfftake += 1
    if (f.fundingTarget != null) totals.fundingTarget += Number(f.fundingTarget) || 0
    if (f.fundingGap != null) totals.fundingGap += Number(f.fundingGap) || 0
    if (f.hasFinancials) {
      totals.withFinancials += 1
      if (f.irr != null) {
        totals.irrSum += f.irr
        totals.irrCount += 1
      }
    }

    const cat = p.category || 'Uncategorized'
    const c =
      byCategory.get(cat) || { category: cat, projects: 0, credits: 0, grossRevenue: 0, totalRevenue: 0 }
    c.projects += 1
    c.credits += Number(p.estimated_credits) || 0
    c.grossRevenue += Number(f.grossRevenue) || 0
    // Blended (contracted + speculative) revenue, so the category chart matches the
    // headline "Projected value" instead of showing listed-price gross.
    c.totalRevenue += Number(f.totalRevenue) || Number(f.grossRevenue) || 0
    byCategory.set(cat, c)
  }

  const totalRevenue = round2(totals.totalRevenue)
  return {
    projects: totals.projects,
    credits: round2(totals.credits),
    grossRevenue: round2(totals.grossRevenue),
    totalRevenue,
    contractedRevenue: round2(totals.contractedRevenue),
    speculativeRevenue: round2(totals.speculativeRevenue),
    withOfftake: totals.withOfftake,
    // Share of pipeline revenue actually under contract. A ratio, not pesos —
    // round to 4dp so 67.7% doesn't become 68%.
    contractedShare:
      totalRevenue > 0 ? Math.round((totals.contractedRevenue / totalRevenue) * 10000) / 10000 : 0,
    fundingTarget: round2(totals.fundingTarget),
    fundingGap: round2(totals.fundingGap),
    withFinancials: totals.withFinancials,
    avgIrr: totals.irrCount ? Math.round((totals.irrSum / totals.irrCount) * 10000) / 10000 : null,
    byCategory: Array.from(byCategory.values())
      .map((c) => ({
        ...c,
        credits: round2(c.credits),
        grossRevenue: round2(c.grossRevenue),
        totalRevenue: round2(c.totalRevenue),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue),
  }
}

/**
 * Fetch the investable pipeline: validated projects across all developers, each
 * enriched with a financial model. Returns { projects, summary }.
 */
export async function getInvestmentPipeline({ category = '', discountRate = 0.1 } = {}) {
  const empty = { projects: [], summary: summarizePipeline([]) }
  const supabase = getSupabase()
  if (!supabase) return empty

  // Columns guaranteed to exist since early migrations.
  const CORE_COLUMNS =
    'id, title, category, location, status, estimated_credits, credit_price, ' +
    'supporting_documents, user_id, created_at'
  // Optional columns added by later migrations (#24/#27/#28 era). On a
  // partially-migrated DB, selecting ANY absent column 400s the whole query, so
  // each is dropped from the SELECT if it turns out to be missing — rather than
  // blanking the entire pipeline over one optional field.
  const OPTIONAL_COLUMNS = [
    'capacity', 'capacity_unit', 'feedstock', 'methodology', 'capex', 'opex',
    'project_lifetime_years', 'funding_target', 'funding_raised', 'feasibility_score',
    'social_impact_score', 'climate_risk_rating', 'development_status',
  ]

  const runQuery = async (columns) => {
    let q = supabase
      .from('projects')
      .select(columns)
      .eq('status', 'validated')
      .order('created_at', { ascending: false })
      .limit(200)
    if (category) q = q.eq('category', category)
    return q
  }

  // Retry loop: on a "column does not exist" 400, drop the named column and retry,
  // until the query succeeds or no optional columns remain.
  let present = [...OPTIONAL_COLUMNS]
  let data, error
  for (;;) {
    const cols = [CORE_COLUMNS, ...present].join(', ')
    ;({ data, error } = await runQuery(cols))
    if (!error) break
    const msg = error.message || ''
    const missing = present.find((c) => new RegExp(`\\b${c}\\b`).test(msg))
    if (!missing || !/column|does not exist|schema cache/i.test(msg)) break
    console.warn(`[investor] column "${missing}" absent, retrying without it`)
    present = present.filter((c) => c !== missing)
  }
  if (error) {
    console.error('Error loading investment pipeline:', error.message)
    throw new Error(error.message || 'Failed to load the investment pipeline')
  }

  // Contracted position per project. Aggregate-only: the RPC never returns a
  // counterparty or a negotiated price, so browsing the pipeline can't leak
  // another developer's commercial terms. Degrades to {} if migration #27 is
  // unapplied — projects then model on the listed price, as they did before.
  const rows = data || []
  const offtakes = await getOfftakeSummary(rows.map((p) => p.id))

  const projects = rows.map((p) => ({
    ...p,
    financials: computeProjectFinancials(p, discountRate, offtakes[p.id] || null),
  }))
  return { projects, summary: summarizePipeline(projects) }
}

/** Count of supporting documents on a project (for the data-room badge). */
export function documentCount(project) {
  try {
    const raw = project?.supporting_documents
    if (!raw) return 0
    const docs = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(docs) ? docs.length : 0
  } catch {
    return 0
  }
}
