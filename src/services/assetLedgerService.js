import { getSupabase } from '@/services/supabaseClient'

/**
 * Carbon Asset Management — developer asset-ledger service (expansion feature #2).
 *
 * Rolls up, per project the signed-in developer owns, the full carbon-credit
 * lifecycle: estimated → issued → pending → sold → retired → inventory (remaining
 * unsold), plus the money value of sold + on-hand credits. Pure aggregation over
 * existing tables — no new schema.
 *
 * Data sources (all keyed to projects the developer owns, `projects.user_id`):
 *   - projects                     → title, status, estimated_credits, credit_price
 *   - project_credits              → issued pool (`total_credits`) + remaining
 *                                    inventory (`credits_available`/`available_credits`)
 *   - credit_transactions (seller) → sold quantity + gross revenue (completed only)
 *   - verified_emission_reductions → issued (approved) / pending VER quantities [drift-safe]
 *   - credit_retirements           → retired quantity against the project [drift-safe]
 *
 * The two MRV-era tables (VER, retirements) may be absent on drifted DBs, so their
 * queries degrade to [] on error — the ledger still renders from the reliable
 * projects/pool/transactions sources.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Pure roll-up. Given the developer's projects and the raw lifecycle rows, produce
 * one ledger row per project plus grand totals. Exported for unit testing.
 *
 * @param {Object} input
 * @param {Array<{id:string, title?:string, status?:string, estimated_credits?:number, credit_price?:number}>} input.projects
 * @param {Array<{project_id:string, total_credits?:number, credits_available?:number, available_credits?:number, price_per_credit?:number, currency?:string}>} [input.pools]
 * @param {Array<{project_id:string, quantity?:number, total_amount?:number, status?:string}>} [input.sales]
 * @param {Array<{project_id:string, approved_quantity?:number, status?:string}>} [input.vers]
 * @param {Array<{project_id:string, quantity?:number}>} [input.retirements]
 * @returns {{rows:Array<Object>, totals:Object}}
 */
export function aggregateAssetLedger({
  projects = [],
  pools = [],
  sales = [],
  vers = [],
  retirements = [],
} = {}) {
  // Index the per-project sources by project_id for O(1) lookup.
  const poolBy = new Map()
  for (const p of pools || []) {
    if (!p?.project_id) continue
    // A project has at most one pool row; if duplicated, keep the largest issued.
    const prev = poolBy.get(p.project_id)
    if (!prev || (Number(p.total_credits) || 0) > (Number(prev.total_credits) || 0)) {
      poolBy.set(p.project_id, p)
    }
  }

  const soldBy = new Map()
  for (const s of sales || []) {
    if (s?.status !== 'completed' || !s?.project_id) continue
    const cur = soldBy.get(s.project_id) || { qty: 0, value: 0 }
    cur.qty += Number(s.quantity) || 0
    cur.value += Number(s.total_amount) || 0
    soldBy.set(s.project_id, cur)
  }

  const verBy = new Map()
  for (const v of vers || []) {
    if (!v?.project_id) continue
    const cur = verBy.get(v.project_id) || { approved: 0, pending: 0 }
    const qty = Number(v.approved_quantity) || 0
    if (v.status === 'approved') cur.approved += qty
    else if (v.status === 'pending') cur.pending += qty
    verBy.set(v.project_id, cur)
  }

  const retiredBy = new Map()
  for (const r of retirements || []) {
    if (!r?.project_id) continue
    retiredBy.set(r.project_id, (retiredBy.get(r.project_id) || 0) + (Number(r.quantity) || 0))
  }

  const rows = (projects || []).map((proj) => {
    const pool = poolBy.get(proj.id) || {}
    const sold = soldBy.get(proj.id) || { qty: 0, value: 0 }
    const ver = verBy.get(proj.id) || { approved: 0, pending: 0 }

    // Issued = credits placed into the sellable pool at validation; fall back to
    // approved VER volume, then 0.
    const issued = Number(pool.total_credits) || ver.approved || 0
    const pending = ver.pending || 0
    // Remaining unsold in the pool. Prefer the read-path column `credits_available`,
    // then its synced sibling `available_credits`, then derive issued − sold.
    const inventory =
      pool.credits_available != null
        ? Number(pool.credits_available) || 0
        : pool.available_credits != null
          ? Number(pool.available_credits) || 0
          : Math.max(0, issued - sold.qty)
    const retired = retiredBy.get(proj.id) || 0
    const pricePerCredit = Number(pool.price_per_credit) || Number(proj.credit_price) || 0

    return {
      projectId: proj.id,
      projectTitle: proj.title || 'Untitled Project',
      status: proj.status || 'draft',
      estimated: Number(proj.estimated_credits) || 0,
      issued,
      pending,
      sold: sold.qty,
      retired,
      inventory,
      pricePerCredit,
      soldValue: round2(sold.value),
      inventoryValue: round2(inventory * pricePerCredit),
      currency: pool.currency || 'PHP',
    }
  })

  // Sort by economic weight: sold value first, then on-hand inventory value.
  rows.sort((a, b) => b.soldValue - a.soldValue || b.inventoryValue - a.inventoryValue)

  const totals = rows.reduce(
    (t, r) => {
      t.projects += 1
      t.estimated += r.estimated
      t.issued += r.issued
      t.pending += r.pending
      t.sold += r.sold
      t.retired += r.retired
      t.inventory += r.inventory
      t.soldValue += r.soldValue
      t.inventoryValue += r.inventoryValue
      return t
    },
    {
      projects: 0,
      estimated: 0,
      issued: 0,
      pending: 0,
      sold: 0,
      retired: 0,
      inventory: 0,
      soldValue: 0,
      inventoryValue: 0,
    },
  )
  totals.soldValue = round2(totals.soldValue)
  totals.inventoryValue = round2(totals.inventoryValue)

  return { rows, totals }
}

/** Fetch rows from an optional (possibly-absent) table; degrade to [] on any error. */
async function safeSelect(supabase, table, columns, projectIds) {
  if (!projectIds.length) return []
  try {
    const { data, error } = await supabase.from(table).select(columns).in('project_id', projectIds)
    if (error) {
      console.warn(`[assetLedger] ${table} unavailable, skipping:`, error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.warn(`[assetLedger] ${table} query threw, skipping:`, err?.message)
    return []
  }
}

/**
 * Build the signed-in developer's asset ledger. Returns { rows, totals } from
 * {@link aggregateAssetLedger}, or an empty ledger if unauthenticated / no projects.
 */
export async function getMyAssetLedger() {
  const empty = { rows: [], totals: aggregateAssetLedger({}).totals }
  const supabase = getSupabase()
  if (!supabase) return empty

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return empty

  // 1) The developer's own projects (authoritative ownership key: projects.user_id).
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, title, status, estimated_credits, credit_price')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (projErr) {
    console.error('[assetLedger] failed to load projects:', projErr.message)
    throw new Error(projErr.message || 'Failed to load your projects')
  }
  const projectIds = (projects || []).map((p) => p.id)
  if (!projectIds.length) return empty

  // 2) Lifecycle sources, in parallel. Pools + sales are reliable; VER + retirements
  //    are MRV-era tables that may be absent on a drifted DB (safeSelect → []).
  const [pools, salesRows, vers, retirements] = await Promise.all([
    safeSelect(
      supabase,
      'project_credits',
      'project_id, total_credits, credits_available, available_credits, price_per_credit, currency',
      projectIds,
    ),
    (async () => {
      // Completed sales where this developer is the seller, mapped to project_id.
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('quantity, total_amount, status, project_credits!inner(projects!inner(id))')
        .eq('seller_id', user.id)
        .eq('status', 'completed')
      if (error) {
        console.warn('[assetLedger] credit_transactions unavailable:', error.message)
        return []
      }
      return (data || []).map((t) => ({
        project_id: t.project_credits?.projects?.id,
        quantity: t.quantity,
        total_amount: t.total_amount,
        status: t.status,
      }))
    })(),
    safeSelect(supabase, 'verified_emission_reductions', 'project_id, approved_quantity, status', projectIds),
    safeSelect(supabase, 'credit_retirements', 'project_id, quantity', projectIds),
  ])

  return aggregateAssetLedger({ projects, pools, sales: salesRows, vers, retirements })
}
