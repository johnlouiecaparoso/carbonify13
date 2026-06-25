// Supabase Edge Function: PayMongo Checkout Session
// This runs server-side to create PayMongo checkout sessions securely

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYMONGO_SECRET_KEY = Deno.env.get('PAYMONGO_SECRET_KEY') || ''
const PAYMONGO_API_URL = 'https://api.paymongo.com/v1'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// CORS headers required when invoking from browser (localhost or production).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const authHeader = () => ({
  Authorization: `Basic ${btoa(PAYMONGO_SECRET_KEY + ':')}`,
  'Content-Type': 'application/json',
})

/** Verify a checkout session and return payment details (for callback page; keeps secret server-side). */
async function verifyCheckoutSession(sessionId: string) {
  const sessionRes = await fetch(`${PAYMONGO_API_URL}/checkout_sessions/${sessionId}`, {
    method: 'GET',
    headers: authHeader(),
  })
  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}))
    throw new Error(err.errors?.[0]?.detail || 'Failed to retrieve checkout session')
  }
  const sessionData = await sessionRes.json()
  const paymentId =
    sessionData.data?.attributes?.payments?.[0]?.id ?? sessionData.data?.attributes?.payments?.[0]
  if (!paymentId) throw new Error('No payment found in session')

  const paymentRes = await fetch(`${PAYMONGO_API_URL}/payments/${paymentId}`, {
    method: 'GET',
    headers: authHeader(),
  })
  if (!paymentRes.ok) throw new Error('Failed to retrieve payment')
  const paymentData = await paymentRes.json()

  const attrs = paymentData.data?.attributes ?? {}
  let actualPaymentMethod = attrs.payment_method?.type ?? attrs.source?.type ?? attrs.payment_method_details?.type ?? 'unknown'
  const map: Record<string, string> = { card: 'card', credit_card: 'card', debit_card: 'card', gcash: 'gcash', paymaya: 'maya', grab_pay: 'grab_pay' }
  actualPaymentMethod = map[actualPaymentMethod] ?? actualPaymentMethod

  const payment = {
    id: paymentData.data?.id,
    amount: (attrs.amount ?? 0) / 100,
    currency: attrs.currency ?? 'PHP',
    status: attrs.status,
    description: attrs.description,
    fee: (attrs.fee ?? 0) / 100,
    payment_method: actualPaymentMethod,
  }

  return {
    success: payment.status === 'paid',
    payment,
    session: sessionData.data,
    paymentMethod: actualPaymentMethod,
  }
}

/**
 * Server-authoritative marketplace checkout (Phase 1.2).
 *
 * The client sends ONLY { listing_id, quantity, origin, user_id, billing }.
 * The amount is recomputed here from credit_listings.price_per_credit — a
 * client-supplied amount is never trusted. We record a payment_intent (the
 * authoritative amount) before creating the PayMongo session.
 *
 * NOTE (hardening, tracked): user_id should be derived from the verified JWT
 * rather than the request body. The critical fix here is server-side AMOUNT.
 */
async function createMarketplaceCheckout(body: any) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const listingId = body.listing_id
  const quantity = Number(body.quantity)
  const userId = body.user_id ?? null
  const origin = typeof body.origin === 'string' ? body.origin.replace(/\/$/, '') : ''

  if (!listingId || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('listing_id and a positive quantity are required')
  }

  const { data: listing, error: listingErr } = await supabase
    .from('credit_listings')
    .select('id, price_per_credit, quantity, currency, status, seller_id')
    .eq('id', listingId)
    .single()

  if (listingErr || !listing) throw new Error('Listing not found')
  if (listing.status !== 'active') throw new Error('Listing is not active')
  if (quantity > Number(listing.quantity)) {
    throw new Error('Requested quantity exceeds availability')
  }

  const unitAmount = Number(listing.price_per_credit)
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    throw new Error('Listing has no valid price')
  }
  const amount = Math.round(unitAmount * quantity * 100) / 100 // server-computed total
  const currency = listing.currency || 'PHP'

  // Record the authoritative intent BEFORE creating the provider session.
  const { data: intent, error: intentErr } = await supabase
    .from('payment_intents')
    .insert({
      user_id: userId,
      purpose: 'marketplace_purchase',
      listing_id: listingId,
      quantity,
      unit_amount: unitAmount,
      amount,
      currency,
      provider: 'paymongo',
      status: 'created',
      metadata: { seller_id: listing.seller_id },
    })
    .select('id')
    .single()

  if (intentErr || !intent) {
    throw new Error(`Failed to create payment intent: ${intentErr?.message ?? 'unknown'}`)
  }

  const checkoutData = {
    data: {
      attributes: {
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: `Purchase of ${quantity} carbon credit(s)`,
        line_items: [
          {
            name: `Carbon Credits x${quantity}`,
            quantity,
            amount: Math.round(unitAmount * 100), // per-unit centavos; PayMongo multiplies by quantity
            currency,
          },
        ],
        payment_method_types: ['card', 'gcash', 'paymaya'],
        success_url: `${origin}/payment/callback`,
        cancel_url: `${origin}/marketplace?cancelled=true`,
        metadata: {
          payment_intent_id: intent.id,
          listing_id: listingId,
          quantity: String(quantity),
        },
        ...(body.billing && (body.billing.name || body.billing.email || body.billing.phone)
          ? { billing: body.billing }
          : {}),
      },
    },
  }

  const res = await fetch(`${PAYMONGO_API_URL}/checkout_sessions`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(checkoutData),
  })
  const result = await res.json()
  if (!res.ok) {
    // Mark the intent failed so it isn't left dangling.
    await supabase.from('payment_intents').update({ status: 'failed' }).eq('id', intent.id)
    throw new Error(result.errors?.[0]?.detail || 'Failed to create checkout session')
  }

  const sessionId = result.data.id
  await supabase
    .from('payment_intents')
    .update({ provider_session_id: sessionId, status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', intent.id)

  return {
    success: true,
    sessionId,
    checkoutUrl: result.data.attributes.checkout_url,
    amount,
    currency,
    paymentIntentId: intent.id,
  }
}

/**
 * Server-authoritative subscription checkout (time-boxed plan model).
 *
 * The client sends ONLY { plan, user_id, origin }. The price comes from the
 * subscription_plans catalog — never the client. We record a payment_intent
 * (purpose 'subscription', plan in metadata) before creating the PayMongo
 * session; the webhook reads that intent and calls activate_subscription on
 * 'checkout.payment.paid'. The plan is granted only after confirmed payment.
 */
async function createSubscriptionCheckout(body: any) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const planKey = String(body.plan || '')
  const userId = body.user_id ?? null
  const origin = typeof body.origin === 'string' ? body.origin.replace(/\/$/, '') : ''

  if (!userId) throw new Error('user_id is required')
  if (!['pro', 'business'].includes(planKey)) throw new Error('Unknown plan')

  // Authoritative price from the catalog.
  const { data: plan, error: planErr } = await supabase
    .from('subscription_plans')
    .select('key, name, price_minor, currency, period_days, active')
    .eq('key', planKey)
    .single()

  if (planErr || !plan) throw new Error('Plan not found')
  if (!plan.active) throw new Error('Plan is not available')

  const priceMinor = Number(plan.price_minor)
  if (!Number.isFinite(priceMinor) || priceMinor <= 0) {
    throw new Error('Plan has no valid price')
  }
  const amount = Math.round(priceMinor) / 100 // currency units for the intent
  const currency = plan.currency || 'PHP'

  // Record the authoritative intent BEFORE creating the provider session.
  const { data: intent, error: intentErr } = await supabase
    .from('payment_intents')
    .insert({
      user_id: userId,
      purpose: 'subscription',
      unit_amount: amount,
      amount,
      currency,
      provider: 'paymongo',
      status: 'created',
      metadata: { plan: planKey, period_days: plan.period_days },
    })
    .select('id')
    .single()

  if (intentErr || !intent) {
    throw new Error(`Failed to create payment intent: ${intentErr?.message ?? 'unknown'}`)
  }

  const checkoutData = {
    data: {
      attributes: {
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        description: `Carbonify ${plan.name} plan — ${plan.period_days} days`,
        line_items: [
          {
            name: `Carbonify ${plan.name} (${plan.period_days} days)`,
            quantity: 1,
            amount: Math.round(priceMinor), // centavos
            currency,
          },
        ],
        payment_method_types: ['card', 'gcash', 'paymaya'],
        success_url: `${origin}/upgrade?status=success`,
        cancel_url: `${origin}/upgrade?cancelled=true`,
        metadata: {
          payment_intent_id: intent.id,
          purpose: 'subscription',
          plan: planKey,
        },
      },
    },
  }

  const res = await fetch(`${PAYMONGO_API_URL}/checkout_sessions`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify(checkoutData),
  })
  const result = await res.json()
  if (!res.ok) {
    await supabase.from('payment_intents').update({ status: 'failed' }).eq('id', intent.id)
    throw new Error(result.errors?.[0]?.detail || 'Failed to create checkout session')
  }

  const sessionId = result.data.id
  await supabase
    .from('payment_intents')
    .update({ provider_session_id: sessionId, status: 'pending', updated_at: new Date().toISOString() })
    .eq('id', intent.id)

  return {
    success: true,
    sessionId,
    // snake_case to match the client (subscriptionService/UpgradeView); camelCase
    // kept for parity with the marketplace action.
    checkout_url: result.data.attributes.checkout_url,
    checkoutUrl: result.data.attributes.checkout_url,
    amount,
    currency,
    paymentIntentId: intent.id,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Action: verify session (callback page – no secret in frontend)
    if (body.action === 'verify' && body.sessionId) {
      if (!PAYMONGO_SECRET_KEY) {
        return new Response(JSON.stringify({ error: 'PAYMONGO_SECRET_KEY not set in Edge Function' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const result = await verifyCheckoutSession(body.sessionId)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Server-authoritative marketplace checkout: amount computed from the
    // listing, not trusted from the client (Phase 1.2).
    if (body.action === 'create_marketplace_checkout') {
      const result = await createMarketplaceCheckout(body)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Server-authoritative subscription checkout: price from subscription_plans,
    // never the client.
    if (body.action === 'create_subscription_checkout') {
      const result = await createSubscriptionCheckout(body)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default (legacy): create checkout session from a client-supplied payload.
    // INSECURE for marketplace purchases (amount is client-controlled) — retained
    // only for wallet top-ups (where the amount is the user's own deposit).
    // Marketplace flows must use action 'create_marketplace_checkout' above.
    const { data } = body
    if (!data) throw new Error('Missing data for checkout session')

    const response = await fetch(`${PAYMONGO_API_URL}/checkout_sessions`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ data }),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.errors?.[0]?.detail || 'Failed to create checkout session')
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
