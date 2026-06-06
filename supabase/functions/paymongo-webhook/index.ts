/**
 * PayMongo Webhook Handler
 * 
 * This Edge Function receives webhooks from PayMongo when payments are completed.
 * It verifies the payment and updates wallet balances securely on the server-side.
 * 
 * Setup:
 * 1. Deploy this function: supabase functions deploy paymongo-webhook
 * 2. Get the function URL: https://YOUR_PROJECT.supabase.co/functions/v1/paymongo-webhook
 * 3. Configure in PayMongo Dashboard: Settings > Webhooks > Add webhook
 * 4. Webhook URL: https://YOUR_PROJECT.supabase.co/functions/v1/paymongo-webhook
 * 5. Events to subscribe: checkout.payment.paid
 * 
 * Security:
 * - Verifies webhook signature from PayMongo
 * - Only processes 'checkout.payment.paid' events
 * - Uses atomic database operations
 * - Idempotent (won't process same payment twice)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY') || ''
const PAYMONGO_WEBHOOK_SECRET = Deno.env.get('PAYMONGO_WEBHOOK_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Allow unsigned webhooks ONLY when explicitly opted in (local dev). Default
// is fail-closed: no secret + no opt-in => reject.
const ALLOW_UNSIGNED_WEBHOOKS = Deno.env.get('ALLOW_UNSIGNED_WEBHOOKS') === 'true'
// Reject events whose signed timestamp is older/newer than this (replay guard).
const SIGNATURE_TOLERANCE_SECONDS = 300

interface SignatureCheck {
  ok: boolean
  reason?: string
}

/** Lowercase hex HMAC-SHA256 digest. */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time string compare. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

/**
 * Verify a PayMongo webhook signature with replay protection.
 *
 * Header format: `t=<unix_seconds>,te=<test_sig>,li=<live_sig>`.
 * Signed message is `${t}.${rawBody}`, HMAC-SHA256 with the webhook secret,
 * hex-encoded. We compare against li (live) then te (test).
 */
async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  nowSeconds: number,
): Promise<SignatureCheck> {
  if (!secret) {
    if (ALLOW_UNSIGNED_WEBHOOKS) {
      console.warn('PAYMONGO_WEBHOOK_SECRET not set; ALLOW_UNSIGNED_WEBHOOKS=true - accepting unsigned (DEV ONLY)')
      return { ok: true }
    }
    return { ok: false, reason: 'PAYMONGO_WEBHOOK_SECRET not configured' }
  }
  if (!signatureHeader) {
    return { ok: false, reason: 'missing signature header' }
  }

  const parts: Record<string, string> = {}
  for (const kv of signatureHeader.split(',')) {
    const [k, v] = kv.split('=').map((s) => s.trim())
    if (k && v) parts[k] = v
  }

  const timestamp = parts.t
  const provided = parts.li || parts.te
  if (!timestamp || !provided) {
    return { ok: false, reason: 'malformed signature header' }
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance (possible replay)' }
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`)
  return timingSafeEqual(expected, provided)
    ? { ok: true }
    : { ok: false, reason: 'signature mismatch' }
}

/**
 * Process wallet top-up payment
 */
async function processWalletTopUp(
  supabase: any,
  paymentId: string,
  sessionId: string,
  amount: number,
  userId: string
) {
  console.log('ðŸ’° Processing wallet top-up:', { paymentId, sessionId, amount, userId })

  // Check if transaction already processed (idempotency)
  const { data: existingTx } = await supabase
    .from('wallet_transactions')
    .select('id, status')
    .eq('external_reference', paymentId)
    .single()

  if (existingTx) {
    if (existingTx.status === 'completed') {
      console.log('âœ… Transaction already processed:', existingTx.id)
      return { success: true, message: 'Already processed', transactionId: existingTx.id }
    }
    // Update existing pending transaction
    const { error: updateError } = await supabase
      .from('wallet_transactions')
      .update({
        status: 'completed',
        external_reference: paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTx.id)

    if (updateError) {
      throw new Error(`Failed to update transaction: ${updateError.message}`)
    }
  }

  // Use atomic function to update balance
  const { data: balanceResult, error: balanceError } = await supabase.rpc(
    'update_wallet_balance_atomic',
    {
      p_user_id: userId,
      p_amount: amount,
      p_operation: 'add',
    }
  )

  if (balanceError) {
    // If balance update fails, create transaction record for tracking
    console.error('âŒ Balance update failed:', balanceError)
    
    // Try to create/update transaction record for manual review
    if (!existingTx) {
      await supabase.from('wallet_transactions').insert({
        account_id: null, // Will be set after finding wallet
        user_id: userId,
        type: 'deposit',
        amount: amount,
        status: 'failed',
        payment_method: 'gcash',
        description: `Wallet top-up via PayMongo (failed)`,
        reference_id: `pm_${paymentId}`,
        external_reference: paymentId,
      })
    }
    
    throw new Error(`Failed to update wallet balance: ${balanceError.message}`)
  }

  // If transaction doesn't exist, create it now
  if (!existingTx) {
    // Get wallet account ID
    const { data: wallet } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (wallet) {
      await supabase.from('wallet_transactions').insert({
        account_id: wallet.id,
        user_id: userId,
        type: 'deposit',
        amount: amount,
        status: 'completed',
        payment_method: 'gcash',
        description: `Wallet top-up via PayMongo`,
        reference_id: `pm_${paymentId}`,
        external_reference: paymentId,
      })
    }
  }

  console.log('âœ… Wallet top-up processed successfully')
  return { success: true, newBalance: balanceResult }
}

/**
 * Process marketplace purchase payment
 */
async function processMarketplacePurchase(
  supabase: any,
  paymentId: string,
  sessionId: string,
  amount: number,
  metadata: any
) {
  console.log('ðŸ›’ Processing marketplace purchase:', { paymentId, sessionId, amount, metadata })

  // Marketplace purchases are handled in PaymentCallbackView
  // This webhook just confirms payment - actual purchase logic in callback
  // Could be enhanced to handle purchase completion here for better security

  const { data: existingPurchase } = await supabase
    .from('credit_purchases')
    .select('id, status')
    .eq('payment_reference', sessionId)
    .single()

  if (existingPurchase && existingPurchase.status === 'completed') {
    console.log('âœ… Purchase already processed')
    return { success: true, message: 'Already processed' }
  }

  // Update purchase status if exists
  if (existingPurchase) {
    await supabase
      .from('credit_purchases')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPurchase.id)
  }

  return { success: true }
}

/** Mark a recorded webhook event as fully processed (best-effort). */
async function markEventProcessed(supabase: any, eventId: string) {
  try {
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('provider', 'paymongo')
      .eq('event_id', eventId)
  } catch (err) {
    console.warn('Failed to mark webhook event processed:', (err as Error)?.message)
  }
}

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // PayMongo sends the signature in the `paymongo-signature` header.
    const signature =
      req.headers.get('paymongo-signature') || req.headers.get('x-paymongo-signature') || ''
    const payload = await req.text()
    const webhookData = JSON.parse(payload)

    console.log('ðŸ“¥ Webhook received:', {
      type: webhookData.type,
      event: webhookData.data?.attributes?.event,
    })

    // Verify webhook signature (HMAC-SHA256) with replay protection.
    const nowSeconds = Math.floor(Date.now() / 1000)
    const sigCheck = await verifyWebhookSignature(payload, signature, PAYMONGO_WEBHOOK_SECRET, nowSeconds)
    if (!sigCheck.ok) {
      console.error('âŒ Invalid webhook signature')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Only process 'checkout.payment.paid' events
    const eventType = webhookData.data?.attributes?.event
    if (eventType !== 'checkout.payment.paid') {
      console.log('â„¹ï¸ Ignoring event type:', eventType)
      return new Response(JSON.stringify({ message: 'Event ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Extract payment data
    const paymentData = webhookData.data?.attributes?.data
    const paymentId = paymentData?.id
    const sessionId = webhookData.data?.attributes?.data?.attributes?.checkout_session?.id
    const amount = paymentData?.attributes?.amount / 100 // Convert from cents
    const metadata = paymentData?.attributes?.metadata || {}

    if (!paymentId || !amount) {
      throw new Error('Missing payment data')
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Event-level idempotency. Record the event keyed by (provider, event_id).
    // A unique-violation means we've seen it before: short-circuit ONLY if the
    // prior attempt actually finished (status 'processed'); otherwise fall
    // through and (re)process — PayMongo retries unacknowledged events.
    const eventId = webhookData.data?.id || paymentId
    const { error: dedupError } = await supabase.from('webhook_events').insert({
      provider: 'paymongo',
      event_id: eventId,
      event_type: eventType,
      payload: webhookData,
      status: 'received',
    })
    if (dedupError) {
      if (dedupError.code === '23505') {
        const { data: prior } = await supabase
          .from('webhook_events')
          .select('status')
          .eq('provider', 'paymongo')
          .eq('event_id', eventId)
          .single()
        if (prior?.status === 'processed') {
          console.log('Duplicate webhook event ignored:', eventId)
          return new Response(
            JSON.stringify({ success: true, message: 'Already processed (duplicate event)' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
      } else {
        // Table missing / other error: log and continue. Per-handler idempotency
        // (below) still prevents double-crediting until the migration is applied.
        console.warn('webhook_events insert failed (continuing):', dedupError.message)
      }
    }

    // Determine payment type from metadata
    const userId = metadata.user_id
    const transactionId = metadata.transaction_id
    const paymentIntentId = metadata.payment_intent_id
    const isWalletTopUp = metadata.method && ['gcash', 'maya'].includes(metadata.method)

    // Server-authoritative marketplace purchase (Phase 1.2/1.5): the checkout
    // recorded a payment_intent; settle it atomically (decrement + ownership +
    // ledger) via the RPC. This is the source of truth, not the callback page.
    if (paymentIntentId) {
      const { data: txnId, error: rpcError } = await supabase.rpc('process_marketplace_purchase', {
        p_payment_intent_id: paymentIntentId,
        p_provider_payment_id: paymentId,
      })
      if (rpcError) {
        // Leave the event unprocessed so PayMongo retries.
        throw new Error(`process_marketplace_purchase failed: ${rpcError.message}`)
      }
      await markEventProcessed(supabase, eventId)
      return new Response(
        JSON.stringify({ success: true, message: 'Purchase settled', transactionId: txnId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (isWalletTopUp && userId) {
      // Process wallet top-up
      const result = await processWalletTopUp(supabase, paymentId, sessionId, amount, userId)
      await markEventProcessed(supabase, eventId)

      return new Response(JSON.stringify({
        success: true,
        message: 'Wallet top-up processed',
        ...result,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else if (transactionId) {
      // Process marketplace purchase
      const result = await processMarketplacePurchase(
        supabase,
        paymentId,
        sessionId,
        amount,
        metadata
      )
      await markEventProcessed(supabase, eventId)

      return new Response(JSON.stringify({
        success: true,
        message: 'Purchase processed',
        ...result,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      console.warn('âš ï¸ Unknown payment type or missing metadata')
      return new Response(JSON.stringify({
        success: false,
        message: 'Unknown payment type',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error) {
    console.error('âŒ Webhook processing error:', error)
    return new Response(JSON.stringify({
      error: error.message || 'Webhook processing failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
