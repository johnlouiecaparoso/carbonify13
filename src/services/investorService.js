import { getSupabase } from '@/services/supabaseClient'
import { computeProjectFinancials } from '@/services/investorAnalytics'

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
    fundingTarget: 0,
    fundingGap: 0,
    withFinancials: 0,
    irrSum: 0,
    irrCount: 0,
  }

  for (const p of projects || []) {
    const f = p.financials || {}
    totals.projects += 1
    totals.credits += Number(p.estimated_credits) || 0
    totals.grossRevenue += Number(f.grossRevenue) || 0
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
    const c = byCategory.get(cat) || { category: cat, projects: 0, credits: 0, grossRevenue: 0 }
    c.projects += 1
    c.credits += Number(p.estimated_credits) || 0
    c.grossRevenue += Number(f.grossRevenue) || 0
    byCategory.set(cat, c)
  }

  return {
    projects: totals.projects,
    credits: round2(totals.credits),
    grossRevenue: round2(totals.grossRevenue),
    fundingTarget: round2(totals.fundingTarget),
    fundingGap: round2(totals.fundingGap),
    withFinancials: totals.withFinancials,
    avgIrr: totals.irrCount ? Math.round((totals.irrSum / totals.irrCount) * 10000) / 10000 : null,
    byCategory: Array.from(byCategory.values())
      .map((c) => ({ ...c, credits: round2(c.credits), grossRevenue: round2(c.grossRevenue) }))
      .sort((a, b) => b.grossRevenue - a.grossRevenue),
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

  let query = supabase
    .from('projects')
    .select(
      'id, title, category, location, status, estimated_credits, credit_price, capacity, capacity_unit, ' +
        'feedstock, methodology, capex, opex, project_lifetime_years, funding_target, funding_raised, ' +
        'feasibility_score, social_impact_score, climate_risk_rating, supporting_documents, user_id, created_at',
    )
    .eq('status', 'validated')
    .order('created_at', { ascending: false })
    .limit(200)

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) {
    console.error('Error loading investment pipeline:', error.message)
    throw new Error(error.message || 'Failed to load the investment pipeline')
  }

  const projects = (data || []).map((p) => ({
    ...p,
    financials: computeProjectFinancials(p, discountRate),
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
