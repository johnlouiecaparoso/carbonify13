// Admin finance console service — read-only money overview for admins.
//
// Backed by SECURITY DEFINER RPCs that self-gate on is_admin() (migration
// 20260626000600), so the ledger stays deny-all to regular clients. A non-admin
// caller gets a Postgres "admin only" error, surfaced here as a friendly message.

import { getSupabase } from '@/services/supabaseClient'

function friendlyError(error, fallback) {
  const msg = String(error?.message || '')
  if (msg.includes('admin only')) return 'Admin access required.'
  return msg || fallback
}

/** Headline totals for the summary cards. */
export async function getFinanceSummary() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Service unavailable. Please try again in a moment.')

  const { data, error } = await supabase.rpc('admin_finance_summary')
  if (error) throw new Error(friendlyError(error, 'Failed to load finance summary.'))

  // RPC returns a json object.
  return {
    gross_sales: Number(data?.gross_sales) || 0,
    total_fees: Number(data?.total_fees) || 0,
    transaction_count: Number(data?.transaction_count) || 0,
    platform_revenue: Number(data?.platform_revenue) || 0,
    pending_payouts: Number(data?.pending_payouts) || 0,
    settled_payouts: Number(data?.settled_payouts) || 0,
    drift_count: Number(data?.drift_count) || 0,
  }
}

/** Recent transactions with buyer/seller names. */
export async function getRecentTransactions(limit = 50) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Service unavailable. Please try again in a moment.')

  const { data, error } = await supabase.rpc('admin_recent_transactions', { p_limit: limit })
  if (error) throw new Error(friendlyError(error, 'Failed to load transactions.'))
  return data || []
}

/** Reconciliation drift report (empty array = healthy books). */
export async function getReconciliation() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Service unavailable. Please try again in a moment.')

  const { data, error } = await supabase.rpc('admin_reconcile_financials')
  if (error) throw new Error(friendlyError(error, 'Failed to run reconciliation.'))
  return data || []
}
