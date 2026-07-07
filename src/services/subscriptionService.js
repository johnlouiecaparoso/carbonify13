/**
 * Subscription service — time-boxed (30-day) premium plans.
 *
 * Billing model: a subscription is a one-off PayMongo checkout that, on a
 * confirmed payment, sets `profiles.plan` and `profiles.plan_expires_at = now +
 * 30 days` (server-side, via the webhook → `activate_subscription` RPC). When
 * the date lapses the user falls back to Free. There is no card vaulting or
 * auto-renew — the user simply checks out again to extend.
 *
 * Amounts shown here are for DISPLAY ONLY. The Edge Function recomputes the
 * price from the `subscription_plans` catalog, so the client can never set it.
 */
import { getSupabase } from '@/services/supabaseClient'
import { PLANS, FREE_LISTING_LIMIT, planHasFeature, FEATURES } from '@/constants/plans'

/** 30 days, in ms — the access window granted per successful checkout. */
export const PLAN_PERIOD_DAYS = 30

/** Display catalog. Prices are authoritative ONLY on the server. */
export const PLAN_CATALOG = [
  {
    key: PLANS.PRO,
    name: 'Pro',
    priceMonthly: 499, // PHP
    currency: 'PHP',
    tagline: 'For active sellers and analysts',
    perks: [
      'Advanced selling analytics & revenue charts',
      'Unlimited active marketplace listings',
    ],
  },
  {
    key: PLANS.BUSINESS,
    name: 'Business',
    priceMonthly: 1499, // PHP
    currency: 'PHP',
    tagline: 'For organisations and LGUs',
    perks: [
      'Everything in Pro',
      'Priority support',
    ],
  },
]

/**
 * Read the current user's plan from their profile row (expiry-aware on read is
 * the store's job via `effectivePlan`; this returns the raw stored values).
 * @returns {Promise<{plan: string, plan_expires_at: string|null}>}
 */
export async function getMyPlan() {
  const supabase = getSupabase()
  if (!supabase) return { plan: PLANS.FREE, plan_expires_at: null }

  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) return { plan: PLANS.FREE, plan_expires_at: null }

  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !data) return { plan: PLANS.FREE, plan_expires_at: null }
  return { plan: data.plan || PLANS.FREE, plan_expires_at: data.plan_expires_at || null }
}

/**
 * Start a subscription checkout. Mirrors `createMarketplaceCheckout`: the client
 * sends only the plan key; the Edge Function looks up the authoritative price,
 * creates the PayMongo session, and returns a redirect URL. The plan is granted
 * only after the webhook confirms payment.
 * @param {string} planKey - PLANS.PRO | PLANS.BUSINESS
 * @returns {Promise<{checkout_url?: string}>}
 */
export async function startSubscriptionCheckout(planKey) {
  if (![PLANS.PRO, PLANS.BUSINESS].includes(planKey)) {
    throw new Error('Unknown plan')
  }
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available for checkout')

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData?.user?.id ?? null
  if (!userId) throw new Error('You must be signed in to subscribe.')

  const { data: result, error } = await supabase.functions.invoke('paymongo-checkout', {
    body: {
      action: 'create_subscription_checkout',
      plan: planKey,
      user_id: userId,
      origin: window.location.origin,
    },
  })

  if (error) throw new Error(error.message || 'Failed to start subscription checkout')
  if (result?.error) throw new Error(result.error)
  return result
}

/**
 * Count a user's currently-active listings. Used for the Free-tier cap so we can
 * warn before the server rejects the insert.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function getActiveListingCount(userId) {
  const supabase = getSupabase()
  if (!supabase || !userId) return 0
  const { count, error } = await supabase
    .from('user_credit_listings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
  if (error) return 0
  return count || 0
}

/**
 * Client-side pre-check for whether a user may create another listing.
 * Pro/Business (UNLIMITED_LISTINGS) always may; Free is capped at
 * FREE_LISTING_LIMIT active listings. The DB trigger is the real enforcement.
 * @param {string} userId
 * @param {string} plan - effective plan
 * @returns {Promise<{allowed: boolean, limit: number|null, active: number}>}
 */
export async function canCreateListing(userId, plan) {
  if (planHasFeature(plan, FEATURES.UNLIMITED_LISTINGS)) {
    return { allowed: true, limit: null, active: 0 }
  }
  const active = await getActiveListingCount(userId)
  return { allowed: active < FREE_LISTING_LIMIT, limit: FREE_LISTING_LIMIT, active }
}
