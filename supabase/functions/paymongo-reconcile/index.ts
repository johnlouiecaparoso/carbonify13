// Supabase Edge Function: paymongo-reconcile (P1 — external settlement reconciliation)
//
// Reconciles our record of each payment_intent against what PayMongo actually
// shows for its checkout session. This is the EXTERNAL counterpart to the
// internal reconcile_financials() RPC: it catches missed/failed webhooks
// (PayMongo paid but we never settled), fabricated settlements (we marked paid
// but PayMongo did not), and amount drift.
//
// Read-only against both PayMongo and our data (it only INSERTs an audit row in
// settlement_reconciliations). It does NOT auto-heal — discrepancies are
// reported for an admin to act on, so a bug here can't move money.
//
// Not public. Invoked by a schedule (cron) or an admin, gated by a worker
// secret sent as `x-worker-secret` (RECONCILE_WORKER_SECRET, or PAYOUT_WORKER_SECRET
// as a fallback so no new secret is strictly required).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY') || ''
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RECONCILE_WORKER_SECRET =
  Deno.env.get('RECONCILE_WORKER_SECRET') || Deno.env.get('PAYOUT_WORKER_SECRET') || ''

const authHeader = () => ({
  Authorization: `Basic ${btoa(PAYMONGO_SECRET_KEY + ':')}`,
  'Content-Type': 'application/json',
})

const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

interface ProviderResult {
  paid: boolean
  amount: number | null // currency units (e.g. PHP), not centavos
  error?: string
}

/**
 * Ask PayMongo for the truth about one checkout session: is it paid, and for how
 * much? Reads the session's payments; falls back to fetching the payment object
 * if the embedded status isn't present.
 */
async function getProviderSettlement(sessionId: string): Promise<ProviderResult> {
  const res = await fetch(`${PAYMONGO_API_URL}/checkout_sessions/${sessionId}`, {
    method: 'GET',
    headers: authHeader(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { paid: false, amount: null, error: err?.errors?.[0]?.detail || `session lookup ${res.status}` }
  }
  const data = await res.json()
  const payments = data?.data?.attributes?.payments ?? []
  if (!Array.isArray(payments) || payments.length === 0) {
    return { paid: false, amount: null } // no payment yet → unpaid
  }

  // Find a paid payment; prefer embedded attributes, else fetch the payment.
  for (const p of payments) {
    let attrs = p?.attributes
    if (!attrs && typeof p?.id === 'string') {
      const pr = await fetch(`${PAYMONGO_API_URL}/payments/${p.id}`, { method: 'GET', headers: authHeader() })
      if (pr.ok) attrs = (await pr.json())?.data?.attributes
    }
    if (attrs?.status === 'paid') {
      return { paid: true, amount: round2((Number(attrs.amount) || 0) / 100) }
    }
  }
  return { paid: false, amount: null }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }
  if (!RECONCILE_WORKER_SECRET || req.headers.get('x-worker-secret') !== RECONCILE_WORKER_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  if (!PAYMONGO_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'PAYMONGO_SECRET_KEY not set' }), { status: 500 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const lookbackDays = Math.min(Math.max(Number(body.lookback_days) || 7, 1), 90)
    const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const sinceIso = new Date(Date.now() - lookbackDays * 86400_000).toISOString()

    // Every intent we created a provider session for, within the window.
    const { data: intents, error: intentErr } = await supabase
      .from('payment_intents')
      .select('id, status, amount, currency, purpose, provider_session_id, created_at')
      .not('provider_session_id', 'is', null)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (intentErr) throw new Error(`payment_intents query failed: ${intentErr.message}`)

    const discrepancies: any[] = []
    let checked = 0

    for (const intent of intents || []) {
      checked++
      const provider = await getProviderSettlement(intent.provider_session_id as string)
      const localPaid = intent.status === 'paid'
      const localAmount = round2(Number(intent.amount) || 0)

      if (provider.error) {
        // Only worth flagging when our side thinks something happened.
        if (localPaid || intent.status === 'pending') {
          discrepancies.push({
            type: 'provider_lookup_failed',
            intent_id: intent.id,
            session_id: intent.provider_session_id,
            local_status: intent.status,
            detail: provider.error,
          })
        }
        continue
      }

      if (provider.paid && !localPaid) {
        discrepancies.push({
          type: 'provider_paid_local_unsettled',
          intent_id: intent.id,
          session_id: intent.provider_session_id,
          purpose: intent.purpose,
          local_status: intent.status,
          provider_status: 'paid',
          local_amount: localAmount,
          provider_amount: provider.amount,
        })
      } else if (!provider.paid && localPaid) {
        discrepancies.push({
          type: 'local_paid_provider_unpaid',
          intent_id: intent.id,
          session_id: intent.provider_session_id,
          purpose: intent.purpose,
          local_status: intent.status,
          provider_status: 'unpaid',
          local_amount: localAmount,
        })
      } else if (provider.paid && localPaid && provider.amount != null && round2(provider.amount) !== localAmount) {
        discrepancies.push({
          type: 'amount_mismatch',
          intent_id: intent.id,
          session_id: intent.provider_session_id,
          purpose: intent.purpose,
          local_amount: localAmount,
          provider_amount: provider.amount,
        })
      }
      // else: consistent (both paid & equal, or both unpaid) → no discrepancy.
    }

    const { data: run, error: insertErr } = await supabase
      .from('settlement_reconciliations')
      .insert({
        lookback_days: lookbackDays,
        checked_count: checked,
        discrepancy_count: discrepancies.length,
        discrepancies,
      })
      .select('id, run_at')
      .single()

    if (insertErr) throw new Error(`failed to store reconciliation run: ${insertErr.message}`)

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run?.id,
        run_at: run?.run_at,
        checked_count: checked,
        discrepancy_count: discrepancies.length,
        discrepancies,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Reconciliation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
