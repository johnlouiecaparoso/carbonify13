<script setup>
import { ref, onMounted } from 'vue'
import { touchGestures } from '@/utils/mobile'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  price: { type: [String, Number], default: '' },
  currency: { type: String, default: 'PHP' },
  badge: { type: String, default: '' },
  clickable: { type: Boolean, default: true },
  swipeable: { type: Boolean, default: false },
  availableCredits: { type: Number, default: null }, // Available credits to display
})

const emit = defineEmits(['click', 'swipeLeft', 'swipeRight', 'swipeUp', 'swipeDown'])

const cardRef = ref(null)
const isPressed = ref(false)
const isSwipeActive = ref(false)

onMounted(() => {
  if (cardRef.value) {
    // Add touch gesture support
    if (props.swipeable) {
      touchGestures.detectSwipe(cardRef.value, {
        onSwipeLeft: () => {
          isSwipeActive.value = true
          emit('swipeLeft')
        },
        onSwipeRight: () => {
          isSwipeActive.value = true
          emit('swipeRight')
        },
        onSwipeUp: () => {
          isSwipeActive.value = true
          emit('swipeUp')
        },
        onSwipeDown: () => {
          isSwipeActive.value = true
          emit('swipeDown')
        },
      })
    }

    // Add double tap support
    touchGestures.detectDoubleTap(cardRef.value, () => {
      if (props.clickable) {
        emit('click')
      }
    })
  }
})

function handleClick() {
  if (props.clickable && !isSwipeActive.value) {
    emit('click')
  }
}

function handleTouchStart() {
  isPressed.value = true
  isSwipeActive.value = false
}

function handleTouchEnd() {
  setTimeout(() => {
    isPressed.value = false
    isSwipeActive.value = false
  }, 150)
}

function formatPrice(price, currency) {
  if (!price) return ''

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  })

  return formatter.format(price)
}

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat('en-US').format(num)
}
</script>

<template>
  <div
    ref="cardRef"
    :class="[
      'mobile-card',
      {
        'mobile-card--clickable': clickable,
        'mobile-card--pressed': isPressed,
        'mobile-card--swipeable': swipeable,
      },
    ]"
    @click="handleClick"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    :tabindex="clickable ? 0 : -1"
    :role="clickable ? 'button' : 'article'"
    :aria-label="clickable ? `View ${title}` : title"
  >
    <!-- Card Image -->
    <div v-if="image" class="mobile-card__image">
      <img :src="image" :alt="title" loading="lazy" />
      <div v-if="badge" class="mobile-card__badge">
        {{ badge }}
      </div>
    </div>

    <!-- Card Content -->
    <div class="mobile-card__content">
      <h3 class="mobile-card__title">{{ title }}</h3>
      <p v-if="description" class="mobile-card__description">
        {{ description }}
      </p>
      <div v-if="price" class="mobile-card__price">
        {{ formatPrice(price, currency) }}
      </div>
      <div v-if="availableCredits !== null && availableCredits !== undefined" class="mobile-card__credits">
        {{ formatNumber(availableCredits) }} credits available
      </div>
    </div>

    <!-- Card Actions -->
    <div v-if="clickable" class="mobile-card__actions">
      <button class="mobile-card__action-button" aria-label="View details">
        <span class="action-icon">→</span>
      </button>
    </div>

    <!-- Swipe Indicator -->
    <div v-if="swipeable" class="mobile-card__swipe-indicator">
      <span class="swipe-hint">Swipe for more options</span>
    </div>
  </div>
</template>

<style scoped>
.mobile-card {
  position: relative;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
  border: 1px solid #e5e7eb;
}

.mobile-card--clickable {
  cursor: pointer;
}

.mobile-card--clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.mobile-card--pressed {
  transform: scale(0.98);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.mobile-card--swipeable {
  touch-action: pan-x pan-y;
}

.mobile-card__image {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
}

.mobile-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.mobile-card:hover .mobile-card__image img {
  transform: scale(1.05);
}

.mobile-card__badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mobile-card__content {
  padding: 1.25rem;
}

.mobile-card__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.mobile-card__description {
  color: #6b7280;
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0 0 1rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.mobile-card__price {
  font-size: 1.25rem;
  font-weight: 700;
  color: #059669;
  margin: 0;
}

.mobile-card__credits {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0 0;
  font-weight: 500;
}

.mobile-card__actions {
  position: absolute;
  top: 1rem;
  right: 1rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.mobile-card:hover .mobile-card__actions {
  opacity: 1;
}

.mobile-card__action-button {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.mobile-card__action-button:hover {
  background: white;
  transform: scale(1.1);
}

.action-icon {
  font-size: 1.25rem;
  color: #374151;
  transition: transform 0.2s ease;
}

.mobile-card__action-button:hover .action-icon {
  transform: translateX(2px);
}

.mobile-card__swipe-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  color: white;
  padding: 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0;
  transform: translateY(100%);
  transition: all 0.3s ease;
}

.mobile-card--swipeable:hover .mobile-card__swipe-indicator {
  opacity: 1;
  transform: translateY(0);
}

.swipe-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.swipe-hint::before {
  content: '👆';
  animation: swipe-hint 2s ease-in-out infinite;
}

@keyframes swipe-hint {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(10px);
  }
}

/* Focus styles for accessibility */
.mobile-card:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Mobile-specific optimizations */
@media (max-width: 768px) {
  .mobile-card {
    margin-bottom: 1rem;
  }

  .mobile-card__image {
    height: 150px;
  }

  .mobile-card__content {
    padding: 1rem;
  }

  .mobile-card__title {
    font-size: 1rem;
  }

  .mobile-card__description {
    font-size: 0.8125rem;
  }

  .mobile-card__price {
    font-size: 1.125rem;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  .mobile-card--clickable:hover {
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .mobile-card:hover .mobile-card__image img {
    transform: none;
  }

  .mobile-card:hover .mobile-card__actions {
    opacity: 0;
  }

  .mobile-card--swipeable:hover .mobile-card__swipe-indicator {
    opacity: 0;
    transform: translateY(100%);
  }
}
</style>
