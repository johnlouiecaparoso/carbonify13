import { getSupabase } from '@/services/supabaseClient'

/**
 * Dispute client service (Phase 2.6). Buyers open disputes on their own
 * transactions; an admin resolves them (resolve_dispute RPC), and a refund
 * resolution triggers the compensating reversal (refund_purchase).
 */

/** Buyer opens a dispute on a transaction. Returns the dispute id. */
export async function openDispute({ transactionId, reason } = {}) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  if (!transactionId) throw new Error('transactionId is required')
  if (!reason?.trim()) throw new Error('A reason is required')

  const { data, error } = await supabase.rpc('open_dispute', {
    p_transaction_id: transactionId,
    p_reason: reason.trim(),
  })
  if (error) throw new Error(error.message || 'Failed to open dispute')
  return data
}

/** The caller's disputes (RLS returns own + admin sees all), most recent first. */
export async function getMyDisputes(limit = 20) {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('disputes')
    .select('id, transaction_id, reason, status, resolution_notes, created_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching disputes:', error)
    return []
  }
  return data || []
}
