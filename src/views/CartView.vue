<template>
  <div class="cart-view">
    <div class="container">
      <h1 class="page-title">Your Cart</h1>

      <!-- Sequential-checkout resume banner -->
      <div v-if="resuming && cart.items.length > 0" class="resume-banner">
        <span class="material-symbols-outlined" aria-hidden="true">info</span>
        Checkout continues one item at a time — {{ cart.items.length }} item(s) left to pay for.
      </div>

      <div v-if="cart.items.length === 0" class="state-card">
        <p>Your cart is empty.</p>
        <router-link to="/marketplace" class="browse-link">Browse the marketplace →</router-link>
      </div>

      <div v-else class="cart-layout">
        <ul class="cart-items">
          <li v-for="item in cart.items" :key="item.listingId" class="cart-item">
            <div class="cart-thumb">
              <img v-if="item.image" :src="item.image" :alt="item.title" />
              <div v-else class="thumb-fallback"><span class="material-symbols-outlined">eco</span></div>
            </div>
            <div class="cart-info">
              <h3 class="cart-item-title">{{ item.title }}</h3>
              <p class="cart-unit">{{ formatCurrency(item.pricePerCredit, item.currency) }} / credit</p>
            </div>
            <div class="cart-qty">
              <button class="step" :disabled="item.quantity <= 1" @click="cart.setQuantity(item.listingId, item.quantity - 1)">−</button>
              <input
                type="number"
                min="1"
                :max="item.maxQuantity || undefined"
                :value="item.quantity"
                @input="cart.setQuantity(item.listingId, $event.target.value)"
              />
              <button
                class="step"
                :disabled="item.maxQuantity && item.quantity >= item.maxQuantity"
                @click="cart.setQuantity(item.listingId, item.quantity + 1)"
              >+</button>
            </div>
            <div class="cart-line-total">{{ formatCurrency(item.pricePerCredit * item.quantity, item.currency) }}</div>
            <button class="cart-remove" title="Remove" @click="cart.removeItem(item.listingId)">
              <span class="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </li>
        </ul>

        <aside class="cart-summary">
          <h3>Order Summary</h3>
          <div class="summary-row">
            <span>Items</span>
            <span>{{ cart.count }}</span>
          </div>
          <div class="summary-row total">
            <span>Subtotal</span>
            <span>{{ formatCurrency(cart.subtotal, cart.currency) }}</span>
          </div>
          <p class="summary-note">
            Items are paid for one at a time; you'll be returned here to continue after each payment.
          </p>
          <button class="checkout-btn" :disabled="checkingOut" @click="startCheckout">
            {{ checkingOut ? 'Redirecting…' : 'Proceed to checkout' }}
          </button>
          <button class="clear-btn" @click="cart.clear()">Clear cart</button>
          <p v-if="error" class="checkout-error">{{ error }}</p>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '@/store/cartStore'
import { useUserStore } from '@/store/userStore'
import { createMarketplaceCheckout } from '@/services/paymongoService'
import { CART_CHECKOUT_ACTIVE, CART_PENDING_LISTING } from '@/constants/cart'

const router = useRouter()
const cart = useCartStore()
const userStore = useUserStore()
const checkingOut = ref(false)
const error = ref('')
const resuming = ref(false)

function formatCurrency(value, currency = 'PHP') {
  const sym = currency === 'PHP' ? '₱' : `${currency} `
  return `${sym}${Number(value || 0).toLocaleString()}`
}

async function startCheckout() {
  error.value = ''
  if (!userStore.isAuthenticated) {
    router.push({ name: 'login', query: { returnTo: '/cart' } })
    return
  }
  const next = cart.items[0]
  if (!next) return

  checkingOut.value = true
  try {
    // Mark a sequential checkout in progress so the payment callback can clear
    // the paid item and bring the buyer back here for the next one.
    localStorage.setItem(CART_CHECKOUT_ACTIVE, '1')
    localStorage.setItem(CART_PENDING_LISTING, next.listingId)

    const result = await createMarketplaceCheckout({
      listingId: next.listingId,
      quantity: next.quantity,
    })
    const url = result?.checkoutUrl || result?.checkout_url
    if (url) {
      // Let the callback page find the webhook-settled transaction so it can
      // issue the certificate/receipt for this cart item too.
      if (result.paymentIntentId) {
        localStorage.setItem('pending_purchase_intent', result.paymentIntentId)
      }
      window.location.href = url
    } else {
      throw new Error('Could not start checkout.')
    }
  } catch (err) {
    localStorage.removeItem(CART_CHECKOUT_ACTIVE)
    localStorage.removeItem(CART_PENDING_LISTING)
    error.value = err?.message || 'Checkout failed. Please try again.'
    checkingOut.value = false
  }
}

onMounted(() => {
  // Returning mid-sequence (callback cleared the paid item and sent us back).
  if (localStorage.getItem(CART_CHECKOUT_ACTIVE) === '1') {
    if (cart.items.length > 0) {
      resuming.value = true
    } else {
      localStorage.removeItem(CART_CHECKOUT_ACTIVE)
    }
  }
})
</script>

<style scoped>
.cart-view {
  padding: 2rem 0 4rem;
}
.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 1rem;
}
.page-title {
  font-size: 1.8rem;
  margin: 0 0 1.25rem;
}
.resume-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 8px;
  padding: 0.6rem 0.9rem;
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}
.state-card {
  padding: 2rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  color: #6b7280;
  text-align: center;
}
.browse-link {
  display: inline-block;
  margin-top: 0.75rem;
  color: #069e2d;
  font-weight: 600;
  text-decoration: none;
}
.cart-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 1.5rem;
  align-items: start;
}
.cart-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.cart-item {
  display: grid;
  grid-template-columns: 64px 1fr auto auto auto;
  align-items: center;
  gap: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 0.75rem;
  background: #fff;
}
.cart-thumb {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
}
.cart-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
}
.cart-item-title {
  font-size: 1rem;
  margin: 0 0 0.2rem;
}
.cart-unit {
  color: #6b7280;
  font-size: 0.8rem;
  margin: 0;
}
.cart-qty {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.cart-qty .step {
  width: 28px;
  height: 28px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}
.cart-qty .step:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cart-qty input {
  width: 56px;
  text-align: center;
  padding: 0.35rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font: inherit;
}
.cart-line-total {
  font-weight: 700;
  min-width: 90px;
  text-align: right;
}
.cart-remove {
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
}
.cart-remove:hover {
  color: #ef4444;
}
.cart-summary {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.25rem;
  background: #fff;
  position: sticky;
  top: 1rem;
}
.cart-summary h3 {
  margin: 0 0 1rem;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.summary-row.total {
  font-weight: 700;
  font-size: 1.05rem;
  border-top: 1px solid #eef0f2;
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}
.summary-note {
  color: #9ca3af;
  font-size: 0.75rem;
  margin: 0.75rem 0;
}
.checkout-btn {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 8px;
  background: #069e2d;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.checkout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.clear-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.6rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
}
.checkout-error {
  color: #dc2626;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}
@media (max-width: 760px) {
  .cart-layout {
    grid-template-columns: 1fr;
  }
  .cart-item {
    grid-template-columns: 56px 1fr auto;
  }
  .cart-line-total {
    grid-column: 2 / 3;
    text-align: left;
  }
}
</style>
