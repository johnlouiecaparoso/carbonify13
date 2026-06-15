<template>
  <div class="upgrade-view">
    <div class="container">
      <h1 class="page-title">Upgrade your plan</h1>
      <p class="page-description">
        You're on the <strong>{{ currentPlanName }}</strong> plan.
        Unlock advanced analytics and unlimited listings.
      </p>

      <div v-if="reasonText" class="reason-banner">
        <span class="material-symbols-outlined" aria-hidden="true">lock</span>
        {{ reasonText }}
      </div>

      <div class="plans-grid">
        <!-- Free (current baseline) -->
        <div class="plan-card" :class="{ current: currentPlan === PLANS.FREE }">
          <h2 class="plan-name">Free</h2>
          <div class="plan-price">₱0<span>/mo</span></div>
          <ul class="plan-perks">
            <li>Browse & buy carbon credits</li>
            <li>Up to {{ FREE_LISTING_LIMIT }} active listings</li>
            <li>Basic buying analytics</li>
          </ul>
          <button class="plan-cta ghost" disabled>
            {{ currentPlan === PLANS.FREE ? 'Current plan' : 'Included' }}
          </button>
        </div>

        <!-- Paid plans -->
        <div
          v-for="p in PLAN_CATALOG"
          :key="p.key"
          class="plan-card paid"
          :class="{ current: currentPlan === p.key }"
        >
          <h2 class="plan-name">{{ p.name }}</h2>
          <div class="plan-price">
            ₱{{ p.priceMonthly.toLocaleString() }}<span>/mo</span>
          </div>
          <p class="plan-tagline">{{ p.tagline }}</p>
          <ul class="plan-perks">
            <li v-for="perk in p.perks" :key="perk">{{ perk }}</li>
          </ul>
          <button
            class="plan-cta"
            :disabled="currentPlan === p.key || loadingKey === p.key"
            @click="subscribe(p.key)"
          >
            <span v-if="currentPlan === p.key">Current plan</span>
            <span v-else-if="loadingKey === p.key">Redirecting…</span>
            <span v-else>Choose {{ p.name }}</span>
          </button>
        </div>
      </div>

      <p v-if="error" class="upgrade-error">{{ error }}</p>
      <p class="upgrade-note">
        Plans are valid for {{ PLAN_PERIOD_DAYS }} days per payment. Cancel anytime by
        simply not renewing.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { PLANS, FREE_LISTING_LIMIT, FEATURES, getPlanDisplayName } from '@/constants/plans'
import {
  PLAN_CATALOG,
  PLAN_PERIOD_DAYS,
  startSubscriptionCheckout,
} from '@/services/subscriptionService'

const route = useRoute()
const store = useUserStore()
const loadingKey = ref('')
const error = ref('')

const currentPlan = computed(() => store.plan)
const currentPlanName = computed(() => getPlanDisplayName(store.plan))

const reasonText = computed(() => {
  const f = route.query.feature
  if (f === FEATURES.ADVANCED_ANALYTICS) return 'Advanced analytics is a Pro feature.'
  if (f === FEATURES.UNLIMITED_LISTINGS) return 'You’ve reached the Free listing limit.'
  return ''
})

async function subscribe(planKey) {
  error.value = ''
  loadingKey.value = planKey
  try {
    const result = await startSubscriptionCheckout(planKey)
    if (result?.checkout_url) {
      window.location.href = result.checkout_url
    } else {
      error.value = 'Could not start checkout. Please try again.'
      loadingKey.value = ''
    }
  } catch (err) {
    error.value = err?.message || 'Subscription checkout is unavailable right now.'
    loadingKey.value = ''
  }
}
</script>

<style scoped>
.upgrade-view {
  padding: 2rem 0 4rem;
}
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 1rem;
}
.page-title {
  font-size: 1.8rem;
  margin: 0 0 0.5rem;
}
.page-description {
  color: #6b7280;
  margin: 0 0 1.5rem;
}
.reason-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #ecfdf5;
  color: #047857;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.25rem;
}
.plan-card {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.plan-card.paid {
  border-color: #069e2d;
}
.plan-card.current {
  outline: 2px solid #069e2d;
}
.plan-name {
  font-size: 1.2rem;
  margin: 0;
}
.plan-price {
  font-size: 2rem;
  font-weight: 700;
  margin: 0.5rem 0;
}
.plan-price span {
  font-size: 0.9rem;
  font-weight: 400;
  color: #9ca3af;
}
.plan-tagline {
  color: #6b7280;
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
}
.plan-perks {
  list-style: none;
  padding: 0;
  margin: 0 0 1.25rem;
  flex: 1;
}
.plan-perks li {
  position: relative;
  padding-left: 1.25rem;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #374151;
}
.plan-perks li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #069e2d;
  font-weight: 700;
}
.plan-cta {
  padding: 0.7rem 1rem;
  border: none;
  border-radius: 8px;
  background: #069e2d;
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
}
.plan-cta.ghost {
  background: #f3f4f6;
  color: #6b7280;
}
.plan-cta:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.upgrade-error {
  color: #dc2626;
  margin-top: 1rem;
}
.upgrade-note {
  color: #9ca3af;
  font-size: 0.8rem;
  margin-top: 1.5rem;
}
</style>
