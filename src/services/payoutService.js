import { getSupabase } from '@/services/supabaseClient'

/**
 * Seller payout / withdrawal client service (Phase 2.4).
 *
 * Withdrawals draw from the seller's ledger balance (seller_payable), not the
 * wallet. The request_payout RPC reserves the funds and records a payout_request;
 * a server-side worker (process-payouts) disburses it via the PayoutProvider.
 */

/** The caller's seller balance: { available, held, currency }. */
export async function getSellerBalance() {
  const supabase = getSupabase()
  if (!supabase) return { available: 0, held: 0, currency: 'PHP' }

  const { data, error } = await supabase.rpc('get_my_seller_balance')
  if (error) {
    console.error('Error fetching seller balance:', error)
    return { available: 0, held: 0, currency: 'PHP' }
  }
  // RPC returns a single-row table.
  const row = Array.isArray(data) ? data[0] : data
  return {
    available: Number(row?.available) || 0,
    held: Number(row?.held) || 0,
    currency: row?.currency || 'PHP',
  }
}

/**
 * Request a withdrawal of `amount` to `destination`.
 * @param {{ amount: number, destination: { method: string, accountName: string, accountNumber: string, bankCode?: string }, idempotencyKey?: string }} args
 * @returns {Promise<string>} the payout request id
 */
export async function requestWithdrawal({ amount, destination, idempotencyKey } = {}) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')

  if (!amount || amount <= 0) throw new Error('A positive amount is required')
  if (!destination?.method || !destination?.accountNumber || !destination?.accountName) {
    throw new Error('Destination method, account name and account number are required')
  }
  if (destination.method === 'bank' && !destination.bankCode) {
    throw new Error('Bank withdrawals require a bank code')
  }

  const { data, error } = await supabase.rpc('request_payout', {
    p_amount: amount,
    p_destination: destination,
    p_idempotency_key: idempotencyKey ?? null,
  })
  if (error) throw new Error(error.message || 'Failed to request withdrawal')
  return data
}

/** The caller's sales (as seller), most recent first. */
export async function getMySales(limit = 50) {
  const supabase = getSupabase()
  if (!supabase) return []

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('id, quantity, price_per_credit, total_amount, currency, status, created_at, completed_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching sales:', error)
    return []
  }
  return data || []
}

/** The caller's payout requests, most recent first. */
export async function getMyPayouts(limit = 20) {
  const supabase = getSupabase()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('payout_requests')
    .select('id, amount, currency, status, destination, failure_reason, created_at, settled_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching payouts:', error)
    return []
  }
  return data || []
}
