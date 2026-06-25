<script setup>
import { ref, computed, watch } from 'vue'
// Payment service imports temporarily disabled
// import {
//   initializePayment,
//   confirmPayment,
//   getSupportedPaymentMethods,
//   getAvailableProviders,
//   calculatePaymentFees,
// } from '@/services/paymentService'

// Mock implementations for development
const initializePayment = async (data) => {
  console.log('Mock initializePayment called with:', data)
  return {
    success: true,
    paymentIntentId: 'mock_pi_' + Date.now(),
    clientSecret: 'mock_secret_' + Date.now(),
    provider: data.provider,
    amount: data.amount,
    currency: data.currency,
    status: 'requires_payment_method',
  }
}

const confirmPayment = async (paymentIntentId, provider, methodData) => {
  console.log('Mock confirmPayment called with:', { paymentIntentId, provider, methodData })
  return {
    success: true,
    paymentId: 'mock_payment_' + Date.now(),
    amount: 100,
    currency: 'PHP',
    provider: provider,
    status: 'succeeded',
  }
}

const getSupportedPaymentMethods = (provider) => {
  console.log('Mock getSupportedPaymentMethods called for provider:', provider)
  return ['gcash', 'maya', 'card']
}

const getAvailableProviders = () => {
  console.log('Mock getAvailableProviders called')
  return [
    { id: 'paymongo', name: 'PayMongo', description: 'Philippines payment gateway' },
    { id: 'stripe', name: 'Stripe', description: 'Global payment processor' },
  ]
}

const calculatePaymentFees = (amount, provider, method) => {
  console.log('Mock calculatePaymentFees called with:', { amount, provider, method })
  const fee = amount * 0.03 // 3% fee
  return {
    amount: amount,
    fee: fee,
    total: amount + fee,
    currency: 'PHP',
  }
}

import UiButton from '@/components/ui/Button.vue'
// import UiInput from '@/components/ui/Input.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  paymentData: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'success', 'error'])

// State
const loading = ref(false)
const processing = ref(false)
const error = ref('')
const selectedProvider = ref('paymongo')
const selectedMethod = ref('')
const paymentMethods = ref([])
const providers = ref([])
const paymentIntent = ref(null)
const clientSecret = ref('')

// Computed properties
const availableMethods = computed(() => {
  return getSupportedPaymentMethods(selectedProvider.value)
})

const fees = computed(() => {
  if (!selectedMethod.value || !props.paymentData?.amount) return null
  return calculatePaymentFees(
    props.paymentData.amount,
    selectedProvider.value,
    selectedMethod.value,
  )
})

const totalAmount = computed(() => {
  return fees.value ? fees.value.total : props.paymentData?.amount || 0
})

const isFormValid = computed(() => {
  return selectedProvider.value && selectedMethod.value && !loading.value
})

// Methods
async function loadProviders() {
  try {
    providers.value = getAvailableProviders()
    if (providers.value.length > 0) {
      selectedProvider.value = providers.value[0].id
      await loadPaymentMethods()
    }
  } catch (err) {
    console.error('Error loading providers:', err)
    error.value = 'Failed to load payment providers'
  }
}

async function loadPaymentMethods() {
  try {
    paymentMethods.value = availableMethods.value
    if (paymentMethods.value.length > 0) {
      selectedMethod.value = paymentMethods.value[0]
    }
  } catch (err) {
    console.error('Error loading payment methods:', err)
    error.value = 'Failed to load payment methods'
  }
}

async function initializePaymentSession() {
  try {
    loading.value = true
    error.value = ''

    const paymentIntentData = {
      provider: selectedProvider.value,
      amount: props.paymentData?.amount || 0,
      currency: props.paymentData?.currency || 'PHP',
      description: props.paymentData?.description || 'Payment',
      metadata: {
        transaction_id: props.paymentData?.transactionId || '',
        user_id: props.paymentData?.userId || '',
        credits: props.paymentData?.credits || 0,
      },
    }

    const result = await initializePayment(paymentIntentData)
    paymentIntent.value = result
    clientSecret.value = result.clientSecret

    console.log('Payment session initialized:', result)
  } catch (err) {
    console.error('Error initializing payment:', err)
    error.value = err.message || 'Failed to initialize payment'
  } finally {
    loading.value = false
  }
}

async function processPayment() {
  try {
    processing.value = true
    error.value = ''

    const paymentMethodData = {
      type: selectedMethod.value,
      provider: selectedProvider.value,
    }

    const result = await confirmPayment(
      paymentIntent.value.paymentIntentId,
      selectedProvider.value,
      paymentMethodData,
    )

    if (result.success) {
      emit('success', {
        paymentId: result.paymentId,
        amount: result.amount,
        currency: result.currency,
        provider: result.provider,
        status: result.status,
      })
      closeModal()
    } else {
      throw new Error('Payment failed')
    }
  } catch (err) {
    console.error('Error processing payment:', err)
    error.value = err.message || 'Payment processing failed'
  } finally {
    processing.value = false
  }
}

function closeModal() {
  emit('close')
  resetForm()
}

function resetForm() {
  selectedProvider.value = 'paymongo'
  selectedMethod.value = ''
  paymentIntent.value = null
  clientSecret.value = ''
  error.value = ''
  loading.value = false
  processing.value = false
}

// Watchers
watch(selectedProvider, async () => {
  selectedMethod.value = ''
  await loadPaymentMethods()
})

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      loadProviders()
    }
  },
)

// Initialize when modal opens
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      loadProviders()
    }
  },
)
</script>

<template>
  <div v-if="isOpen && paymentData" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>Complete Payment</h2>
        <button class="modal-close" @click="closeModal">×</button>
      </div>

      <div class="modal-body">
        <!-- Payment Summary -->
        <div class="payment-summary">
          <h3>Payment Summary</h3>
          <div class="summary-item">
            <span>Credits:</span>
            <span>{{ paymentData?.credits || 0 }}</span>
          </div>
          <div class="summary-item">
            <span>Amount:</span>
            <span>₱{{ (paymentData?.amount || 0).toLocaleString() }}</span>
          </div>
          <div v-if="fees" class="summary-item">
            <span>Fee:</span>
            <span>₱{{ fees.fee.toLocaleString() }}</span>
          </div>
          <div class="summary-item total">
            <span>Total:</span>
            <span>₱{{ totalAmount.toLocaleString() }}</span>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="error-message">
          <div class="error-icon"><span class="material-symbols-outlined" aria-hidden="true">warning</span></div>
          <p>{{ error }}</p>
        </div>

        <!-- Payment Form -->
        <div v-if="!paymentIntent" class="payment-form">
          <div class="form-group">
            <label>Payment Provider</label>
            <select v-model="selectedProvider" class="form-select">
              <option v-for="provider in providers" :key="provider.id" :value="provider.id">
                {{ provider.name }}
              </option>
            </select>
          </div>

          <div class="form-group">
            <label>Payment Method</label>
            <select v-model="selectedMethod" class="form-select">
              <option value="">Select payment method</option>
              <option v-for="method in availableMethods" :key="method" :value="method">
                {{ method.replace('_', ' ').toUpperCase() }}
              </option>
            </select>
          </div>

          <div class="form-actions">
            <UiButton variant="outline" @click="closeModal">Cancel</UiButton>
            <UiButton
              variant="primary"
              @click="initializePaymentSession"
              :disabled="!isFormValid"
              :loading="loading"
            >
              Continue to Payment
            </UiButton>
          </div>
        </div>

        <!-- Payment Processing -->
        <div v-else class="payment-processing">
          <div class="processing-header">
            <h3>Processing Payment</h3>
            <p>Please complete your payment using {{ selectedMethod.toUpperCase() }}</p>
          </div>

          <!-- PayMongo Integration -->
          <div v-if="selectedProvider === 'paymongo'" class="payment-provider">
            <div class="provider-info">
              <h4>PayMongo Payment</h4>
              <p>Complete your payment securely through PayMongo</p>
            </div>

            <div class="payment-details">
              <div class="detail-item">
                <span>Amount:</span>
                <span>₱{{ totalAmount.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span>Method:</span>
                <span>{{ selectedMethod.toUpperCase() }}</span>
              </div>
            </div>

            <div class="payment-actions">
              <UiButton variant="outline" @click="closeModal">Cancel</UiButton>
              <UiButton variant="primary" @click="processPayment" :loading="processing">
                Complete Payment
              </UiButton>
            </div>
          </div>

          <!-- Stripe Integration -->
          <div v-else-if="selectedProvider === 'stripe'" class="payment-provider">
            <div class="provider-info">
              <h4>Stripe Payment</h4>
              <p>Complete your payment securely through Stripe</p>
            </div>

            <div class="payment-details">
              <div class="detail-item">
                <span>Amount:</span>
                <span>₱{{ totalAmount.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span>Method:</span>
                <span>{{ selectedMethod.toUpperCase() }}</span>
              </div>
            </div>

            <div class="payment-actions">
              <UiButton variant="outline" @click="closeModal">Cancel</UiButton>
              <UiButton variant="primary" @click="processPayment" :loading="processing">
                Complete Payment
              </UiButton>
            </div>
          </div>

          <!-- PayPal Integration -->
          <div v-else-if="selectedProvider === 'paypal'" class="payment-provider">
            <div class="provider-info">
              <h4>PayPal Payment</h4>
              <p>Complete your payment securely through PayPal</p>
            </div>

            <div class="payment-details">
              <div class="detail-item">
                <span>Amount:</span>
                <span>₱{{ totalAmount.toLocaleString() }}</span>
              </div>
              <div class="detail-item">
                <span>Method:</span>
                <span>{{ selectedMethod.toUpperCase() }}</span>
              </div>
            </div>

            <div class="payment-actions">
              <UiButton variant="outline" @click="closeModal">Cancel</UiButton>
              <UiButton variant="primary" @click="processPayment" :loading="processing">
                Complete Payment
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--carbonify-surface);
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--carbonify-border);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--carbonify-muted);
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
}

.modal-close:hover {
  color: var(--carbonify-text);
}

.modal-body {
  padding: 1.5rem;
}

/* Payment Summary */
.payment-summary {
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.payment-summary h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--carbonify-text);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--carbonify-border);
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item.total {
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--carbonify-primary);
  border-top: 2px solid var(--carbonify-primary);
  margin-top: 0.5rem;
  padding-top: 0.5rem;
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--carbonify-error-bg);
  color: var(--carbonify-error);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.error-icon {
  font-size: 20px;
}

/* Payment Form */
.payment-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: var(--carbonify-text);
  font-size: 0.9rem;
}

.form-select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--carbonify-border);
  border-radius: 8px;
  background: var(--carbonify-bg);
  color: var(--carbonify-text);
  font-size: 16px;
  transition: border-color 0.2s;
}

.form-select:focus {
  outline: none;
  border-color: var(--carbonify-primary);
  box-shadow: 0 0 0 3px var(--carbonify-primary-50);
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

/* Payment Processing */
.payment-processing {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.processing-header {
  text-align: center;
  padding: 1rem;
  background: var(--carbonify-primary-50);
  border-radius: 8px;
}

.processing-header h3 {
  margin: 0 0 0.5rem 0;
  color: var(--carbonify-primary);
  font-size: 1.2rem;
}

.processing-header p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 0.9rem;
}

.payment-provider {
  background: var(--carbonify-bg);
  border: 1px solid var(--carbonify-border);
  border-radius: 8px;
  padding: 1.5rem;
}

.provider-info {
  margin-bottom: 1rem;
}

.provider-info h4 {
  margin: 0 0 0.5rem 0;
  color: var(--carbonify-text);
  font-size: 1.1rem;
}

.provider-info p {
  margin: 0;
  color: var(--carbonify-muted);
  font-size: 0.9rem;
}

.payment-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--carbonify-border);
}

.detail-item:last-child {
  border-bottom: none;
}

.payment-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

/* Responsive Design */
@media (max-width: 768px) {
  .modal-content {
    margin: 1rem;
    max-height: calc(100vh - 2rem);
  }

  .form-actions,
  .payment-actions {
    flex-direction: column;
  }
}
</style>
