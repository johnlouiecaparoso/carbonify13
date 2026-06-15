import { describe, it, expect } from 'vitest'
import {
  PLANS,
  FEATURES,
  planHasFeature,
  effectivePlan,
} from '@/constants/plans'

describe('plan entitlements', () => {
  it('Free unlocks no premium features', () => {
    expect(planHasFeature(PLANS.FREE, FEATURES.ADVANCED_ANALYTICS)).toBe(false)
    expect(planHasFeature(PLANS.FREE, FEATURES.UNLIMITED_LISTINGS)).toBe(false)
  })

  it('Pro and Business unlock advanced analytics and unlimited listings', () => {
    for (const plan of [PLANS.PRO, PLANS.BUSINESS]) {
      expect(planHasFeature(plan, FEATURES.ADVANCED_ANALYTICS)).toBe(true)
      expect(planHasFeature(plan, FEATURES.UNLIMITED_LISTINGS)).toBe(true)
    }
  })
})

describe('effectivePlan (expiry-aware)', () => {
  const now = new Date('2026-06-15T00:00:00Z')

  it('defaults to free for a null profile', () => {
    expect(effectivePlan(null, now)).toBe(PLANS.FREE)
  })

  it('keeps a paid plan that has not expired', () => {
    const profile = { plan: PLANS.PRO, plan_expires_at: '2026-07-15T00:00:00Z' }
    expect(effectivePlan(profile, now)).toBe(PLANS.PRO)
  })

  it('downgrades an expired paid plan to free', () => {
    const profile = { plan: PLANS.PRO, plan_expires_at: '2026-06-01T00:00:00Z' }
    expect(effectivePlan(profile, now)).toBe(PLANS.FREE)
  })

  it('treats a paid plan with no expiry as active (lifetime grant)', () => {
    const profile = { plan: PLANS.BUSINESS, plan_expires_at: null }
    expect(effectivePlan(profile, now)).toBe(PLANS.BUSINESS)
  })
})
