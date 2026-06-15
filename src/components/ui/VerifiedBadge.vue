<template>
  <span class="verified-badge" :class="variant" :title="title">
    <span class="material-symbols-outlined check" aria-hidden="true">verified</span>
    <span v-if="!iconOnly" class="label">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Small "verified" check shown beside a user's name.
 *  - type 'kyc' → identity verified (kyc_level >= 2)
 *  - type 'kyb' → business verified (kyb_verified)
 */
const props = defineProps({
  type: { type: String, default: 'kyc' }, // 'kyc' | 'kyb'
  iconOnly: { type: Boolean, default: false },
  label: { type: String, default: '' },
})

const variant = computed(() => (props.type === 'kyb' ? 'kyb' : 'kyc'))
const label = computed(
  () => props.label || (props.type === 'kyb' ? 'Business verified' : 'KYC verified'),
)
const title = computed(() =>
  props.type === 'kyb'
    ? 'Business verified by EcoLink (KYB)'
    : 'Identity verified by EcoLink (KYC)',
)
</script>

<style scoped>
.verified-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.4;
  vertical-align: middle;
}
.verified-badge.kyc {
  background: #ecfdf5;
  color: #047857;
}
.verified-badge.kyb {
  background: #eff6ff;
  color: #1d4ed8;
}
.check {
  font-size: 0.95rem;
}
</style>
