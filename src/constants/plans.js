/**
 * Subscription plans & feature entitlements.
 *
 * This is the SINGLE SOURCE OF TRUTH for what each paid tier unlocks on the
 * client. It is intentionally separate from `roles.js`: a role answers "what
 * kind of user" (developer/verifier/buyer); a plan answers "what are they
 * paying for". The two are orthogonal.
 *
 * SECURITY: anything gated here is also enforced server-side (RLS / RPC /
 * triggers — see supabase/migrations/*_subscriptions.sql). Client gating is
 * UX only; never the security boundary.
 */

export const PLANS = {
  FREE: 'free',
  PRO: 'pro',
  BUSINESS: 'business',
}

/** Feature keys used by FeatureGate, router meta, and server checks. */
export const FEATURES = {
  ADVANCED_ANALYTICS: 'advanced_analytics', // Selling analytics tab, deeper charts
  UNLIMITED_LISTINGS: 'unlimited_listings', // remove the free-tier listing cap
  INVESTOR_PORTAL: 'investor_portal', // pipeline, financial model (IRR/NPV), data room
}

/** Which features each plan grants. Higher tiers are supersets here. */
export const PLAN_FEATURES = {
  [PLANS.FREE]: [],
  [PLANS.PRO]: [FEATURES.ADVANCED_ANALYTICS, FEATURES.UNLIMITED_LISTINGS, FEATURES.INVESTOR_PORTAL],
  [PLANS.BUSINESS]: [
    FEATURES.ADVANCED_ANALYTICS,
    FEATURES.UNLIMITED_LISTINGS,
    FEATURES.INVESTOR_PORTAL,
  ],
}

/** Max simultaneously-active listings on the Free tier (unlimited above). */
export const FREE_LISTING_LIMIT = 3

/** True if the given plan unlocks the given feature. */
export function planHasFeature(plan, feature) {
  return (PLAN_FEATURES[plan] || []).includes(feature)
}

/**
 * Resolve the *effective* plan from a profile, honouring expiry.
 * A `pro`/`business` row whose `plan_expires_at` is in the past is treated as
 * `free` (defence-in-depth; the server also downgrades lapsed plans).
 * @param {{plan?: string, plan_expires_at?: string|null}|null} profile
 * @param {Date} [now] - injectable for testing
 */
export function effectivePlan(profile, now = new Date()) {
  const plan = profile?.plan || PLANS.FREE
  if (plan === PLANS.FREE) return PLANS.FREE
  const expiry = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  if (expiry && !isNaN(expiry) && expiry.getTime() <= now.getTime()) return PLANS.FREE
  return plan
}

/** Human-readable plan name. */
export function getPlanDisplayName(plan) {
  return (
    {
      [PLANS.FREE]: 'Free',
      [PLANS.PRO]: 'Pro',
      [PLANS.BUSINESS]: 'Business',
    }[plan] || 'Free'
  )
}
