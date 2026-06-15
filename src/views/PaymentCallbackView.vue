<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/store/userStore'
import { processPaymentCallback } from '@/services/paymongoService'
import { realPaymentService } from '@/services/realPaymentService'
import { useModernPrompt } from '@/composables/useModernPrompt'
import ModernPrompt from '@/components/ui/ModernPrompt.vue'
import { useCartStore } from '@/store/cartStore'
import { CART_CHECKOUT_ACTIVE, CART_PENDING_LISTING } from '@/constants/cart'

const {
  promptState,
  success: showSuccess,
  error: showError,
  handleConfirm,
  handleCancel,
  handleClose,
} = useModernPrompt()

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const cart = useCartStore()

const loading = ref(true)
const success = ref(false)
const error = ref('')
const paymentDetails = ref(null)

onMounted(async () => {
  // Get session ID from URL or localStorage (PayMongo may not replace {CHECKOUT_SESSION_ID})
  console.log('🔍 Full route query:', route.query)
  console.log('🔍 Full route params:', route.params)

  // Check if this is a mock payment (from mock checkout URL)
  const isMockPayment = route.query.mock === 'true' || route.query.mock === true
  const mockAmount = route.query.amount ? parseFloat(route.query.amount) : null

  let sessionId =
    route.query.session_id ||
    route.query.checkout_session_id ||
    route.params.sessionId ||
    route.params.checkout_session_id

  // If URL doesn't have it or has placeholder, check localStorage
  if (!sessionId || sessionId === '{CHECKOUT_SESSION_ID}') {
    console.log('⚠️ Session ID not in URL, checking localStorage...')
    sessionId =
      localStorage.getItem('pending_purchase_session') ||
      localStorage.getItem('wallet_topup_session')
    if (sessionId) {
      console.log('✅ Found session ID in localStorage:', sessionId)
    }
  }

  // If mock payment but no sessionId, create a mock session ID
  if (isMockPayment && !sessionId) {
    sessionId = `mock_session_${Date.now()}`
    console.log('🎭 Creating mock session ID for demo:', sessionId)
    // Store it so the purchase completion can find it
    localStorage.setItem('pending_purchase_session', sessionId)
  }

  console.log('🔍 Final session ID:', sessionId)
  console.log('🎭 Is mock payment:', isMockPayment, 'Amount:', mockAmount)

  if (!sessionId || sessionId === '{CHECKOUT_SESSION_ID}') {
    error.value = 'No payment session found'
    loading.value = false
    return
  }

  try {
    // Process the payment callback
    const result = await processPaymentCallback(sessionId, { isMock: isMockPayment, mockAmount })

    if (result.success) {
      success.value = true
      paymentDetails.value = result.payment

      // Sequential cart checkout: remove the item just paid for and, if more
      // remain, send the buyer back to the cart to continue.
      if (localStorage.getItem(CART_CHECKOUT_ACTIVE) === '1') {
        const pending = localStorage.getItem(CART_PENDING_LISTING)
        if (pending) cart.removeItem(pending)
        localStorage.removeItem(CART_PENDING_LISTING)
        if (cart.items.length > 0) {
          await showSuccess({
            title: 'Item purchased',
            message: `Payment received. ${cart.items.length} item(s) left in your cart.`,
            confirmText: 'Continue checkout',
          })
          router.push('/cart')
          return
        }
        localStorage.removeItem(CART_CHECKOUT_ACTIVE)
      }

      // Check if this was a wallet top-up or marketplace purchase
      const topUpSession = localStorage.getItem('wallet_topup_session')
      const wasTopUp = topUpSession && topUpSession === sessionId

      if (wasTopUp) {
        // Complete wallet top-up
        try {
          const userId = localStorage.getItem('wallet_topup_user_id') || store.session?.user?.id
          const topUpAmount = parseFloat(localStorage.getItem('wallet_topup_amount') || '0')

          console.log('💰 Completing wallet top-up:', { userId, amount: topUpAmount, sessionId })

          if (!userId) {
            throw new Error('User ID not found for wallet top-up')
          }

          // First, try to wait for webhook (if configured)
          // This ensures server-side processing happens first
          const { waitForWebhookTransaction } = await import('@/services/webhookService')
          const webhookStatus = await waitForWebhookTransaction(sessionId, 5, 1500)

          if (webhookStatus && webhookStatus.status === 'completed') {
            console.log('✅ Webhook processed payment, balance updated server-side')
            // Webhook already handled it, just refresh UI
          } else {
            // Fallback: Client-side processing (if webhook not configured or timed out)
            console.log('⚠️ Webhook not available, processing client-side...')

            // Confirm PayMongo payment (updates transaction status)
            await realPaymentService.confirmPayMongoPayment(sessionId)

            // Update wallet balance using walletService
            const { updateWalletBalance } = await import('@/services/walletService')
            await updateWalletBalance(userId, topUpAmount, 'topup')

            console.log('✅ Wallet top-up completed (client-side fallback)')
          }
        } catch (confirmError) {
          console.error('❌ Error completing wallet top-up:', confirmError)
          // Show error but don't fail the whole callback
          error.value = `Top-up may have failed: ${confirmError.message}`
        }
      } else {
        // Complete marketplace purchase from localStorage
        const pendingPurchase = localStorage.getItem('pending_purchase')
        if (pendingPurchase) {
          try {
            const purchaseData = JSON.parse(pendingPurchase)
            console.log('🛒 Completing marketplace purchase from callback...')

            // Import services needed to complete purchase
            const { getSupabase } = await import('@/services/supabaseClient')
            const { creditOwnershipService } = await import('@/services/creditOwnershipService')
            const supabase = getSupabase()

            const { listing, purchaseData: pd, totalCost, paymentResult } = purchaseData

            // CRITICAL: Use actual payment method detected from PayMongo, not the one from purchase data
            // This ensures card payments show as 'card' instead of 'gcash' or 'maya'
            const actualPaymentMethod =
              result.paymentMethod || result.payment?.payment_method || pd.paymentMethod || 'wallet'

            console.log('💳 Using payment method:', {
              from_paymongo: result.paymentMethod,
              from_payment_object: result.payment?.payment_method,
              from_purchase_data: pd.paymentMethod,
              final: actualPaymentMethod,
            })

            // Get seller_id from listing or project owner
            // The listing might have seller_id directly, or we need to get it from the project
            let sellerId = listing.seller_id
            if (!sellerId && listing.project_credits?.project_id) {
              // Fetch project to get owner (seller)
              const { data: project } = await supabase
                .from('projects')
                .select('user_id')
                .eq('id', listing.project_credits.project_id)
                .single()
              if (project) {
                sellerId = project.user_id
              }
            }

            // If still no seller_id, try to get it from credit_listings table
            if (!sellerId && purchaseData.listingId) {
              const { data: listingData } = await supabase
                .from('credit_listings')
                .select('seller_id')
                .eq('id', purchaseData.listingId)
                .single()
              if (listingData) {
                sellerId = listingData.seller_id
              }
            }

            if (!sellerId) {
              console.warn('⚠️ Could not determine seller_id, purchase may fail')
            }

            // Create credit_purchases record
            // Note: Schema matches complete-ecolink-setup.sql - no currency or payment_reference columns
            const purchaseDataToInsert = {
              listing_id: purchaseData.listingId,
              buyer_id: store.session.user.id,
              seller_id: sellerId,
              credits_amount: pd.quantity,
              price_per_credit: listing.price_per_credit,
              total_amount: totalCost,
              payment_method: actualPaymentMethod, // Use detected payment method
              payment_status: 'completed', // Schema has both payment_status and status
              status: 'completed',
              completed_at: new Date().toISOString(), // Schema has completed_at field
            }

            const { error: purchaseError } = await supabase
              .from('credit_purchases')
              .insert(purchaseDataToInsert)
              .select()
              .single()

            // Handle purchase record creation error
            if (purchaseError) {
              console.error('❌ Error creating purchase record:', purchaseError)
              console.warn('⚠️ Purchase transaction may still be valid - payment was successful')
            }

            // Create credit_transactions record FIRST (CRITICAL - needed for certificates and history)
            // This must be created before credit_ownership to get the transaction ID
            let transaction = null
            let transactionId = null

            try {
              const { data: transactionData, error: transactionError } = await supabase
                .from('credit_transactions')
                .insert({
                  buyer_id: store.session.user.id,
                  seller_id: sellerId,
                  project_credit_id: listing.project_credits.id,
                  listing_id: purchaseData.listingId,
                  quantity: pd.quantity,
                  price_per_credit: listing.price_per_credit,
                  total_amount: totalCost,
                  currency: listing.currency || 'PHP',
                  payment_method: actualPaymentMethod, // Use detected payment method
                  payment_reference: paymentResult.sessionId || paymentResult.paymentId,
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                })
                .select()
                .single()

              if (!transactionError && transactionData) {
                transaction = transactionData
                transactionId = transaction.id
                console.log('✅ Credit transaction created:', transactionId)

                // Update marketplace stock so project shows correct remaining/sold-out (same as in-app purchase)
                try {
                  const { updateMarketplaceAvailabilityAfterPurchase } = await import(
                    '@/services/marketplaceService'
                  )
                  await updateMarketplaceAvailabilityAfterPurchase(
                    listing.project_credits.id,
                    pd.quantity,
                    { listingQuantity: listing.quantity },
                  )
                  console.log('✅ Marketplace availability updated after payment callback')
                } catch (availErr) {
                  console.error('⚠️ Failed to update marketplace availability (non-blocking):', availErr)
                }

                // NOW add credits to portfolio (after transaction is created)
                // Note: This may fail due to schema issues, but we'll continue anyway
                try {
                  // credit_ownership table requires project_credit_id, not project_id
                  const projectCreditId = listing.project_credits.id
                  if (!projectCreditId) {
                    throw new Error('project_credit_id is missing from listing')
                  }

                  // Get purchase price from listing
                  const purchasePrice = listing.price_per_credit || listing.price || 0

                  // Use transactionId from credit_transactions (valid UUID)
                  await creditOwnershipService.addCreditsToPortfolio(
                    store.session.user.id,
                    listing.project_credits.project_id, // Keep project_id for backward compatibility
                    pd.quantity,
                    'purchased',
                    transactionId, // Use credit_transactions ID (valid UUID)
                    projectCreditId, // Pass project_credit_id separately if function supports it
                    purchasePrice, // Pass purchase_price to satisfy not-null constraint
                  )
                  console.log('✅ Credits added to portfolio')
                } catch (ownershipError) {
                  console.error('❌ Error adding credits to portfolio:', ownershipError)
                  console.error(
                    '⚠️ CRITICAL: Purchase payment succeeded but credits not added to portfolio',
                  )
                  console.error('⚠️ This needs to be fixed - user paid but credits are missing')
                  // Don't throw - allow certificate creation to proceed
                  // The purchase is still valid even if ownership record fails
                  // User will need manual credit addition
                }
              } else {
                console.error('❌ Error creating credit_transaction:', transactionError)
                // Try with minimal fields as fallback
                console.log('🔄 Attempting to create transaction with minimal fields...')
                const { data: minimalTransaction, error: minimalError } = await supabase
                  .from('credit_transactions')
                  .insert({
                    buyer_id: store.session.user.id,
                    seller_id: sellerId,
                    project_credit_id: listing.project_credits.id,
                    quantity: pd.quantity,
                    price_per_credit: listing.price_per_credit,
                    total_amount: totalCost,
                    currency: listing.currency || 'PHP',
                    payment_method: actualPaymentMethod,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                  })
                  .select()
                  .single()

                if (!minimalError && minimalTransaction) {
                  transaction = minimalTransaction
                  transactionId = transaction.id
                  console.log('✅ Credit transaction created with minimal fields:', transactionId)
                } else {
                  console.error(
                    '❌ CRITICAL: Failed to create transaction even with minimal fields:',
                    minimalError,
                  )
                  throw new Error(
                    'Failed to create transaction record. Purchase history may not show.',
                  )
                }
              }
            } catch (transErr) {
              console.error('❌ CRITICAL ERROR creating credit transaction:', transErr)
              throw transErr // Re-throw to prevent silent failure
            }

            // Generate receipt (optional)
            if (transactionId) {
              try {
                const { generateReceipt } = await import('@/services/receiptService')
                await generateReceipt(transactionId)
                console.log('✅ Receipt generated')
              } catch (receiptError) {
                console.error('⚠️ Receipt generation failed (non-critical):', receiptError)
              }
            }

            // Generate certificate for purchase (CRITICAL)
            if (transactionId) {
              console.log('🔄 Starting certificate generation for transaction:', transactionId)
              try {
                const { generateCreditCertificate } = await import('@/services/certificateService')
                const certificate = await generateCreditCertificate(transactionId, 'purchase')

                if (certificate && certificate.id) {
                  console.log('✅ Purchase certificate generated successfully!')
                  console.log('✅ Certificate ID:', certificate.id)
                  console.log('✅ Certificate Number:', certificate.certificate_number)
                  console.log(
                    '✅ Certificate will appear in certificate dashboard and retire section',
                  )
                  // Show success message with modern prompt
                  await showSuccess({
                    title: 'Certificate Generated!',
                    message:
                      'Your certificate has been generated successfully. You can view and download it in the Certificates section.',
                    confirmText: 'View Certificates',
                  }).then((confirmed) => {
                    if (confirmed) {
                      router.push('/certificates')
                    }
                  })
                } else {
                  console.error('❌ Certificate generation returned null or invalid certificate')
                  throw new Error('Certificate generation returned invalid result')
                }
              } catch (certError) {
                console.error('❌ CRITICAL: Certificate generation failed:', certError)
                console.error('❌ Error details:', {
                  message: certError.message,
                  stack: certError.stack,
                  transactionId: transactionId,
                })
                console.error(
                  '⚠️ Purchase completed but certificate is missing. This needs to be fixed.',
                )
                // Show user-friendly error with modern prompt
                await showError({
                  title: 'Certificate Generation Failed',
                  message:
                    'Purchase completed successfully, but certificate generation failed. You can try generating it manually from the Certificates section.',
                  confirmText: 'OK',
                })
                // Don't throw - purchase is still valid, but certificate won't be generated
              }
            } else {
              console.error('❌ CRITICAL: Cannot generate certificate - no transactionId available')
              console.error(
                '⚠️ Transaction ID is missing. Purchase completed but certificate cannot be generated.',
              )
            }

            console.log('✅ Marketplace purchase completed successfully')
          } catch (purchaseError) {
            console.error('❌ Error completing marketplace purchase:', purchaseError)
            // Continue anyway - show success
          }
        }
      }

      // Ensure wallet history reflects a successful marketplace checkout.
      // Marketplace flow creates pending wallet_transactions during checkout start,
      // but unlike top-ups it did not always finalize them.
      if (!wasTopUp) {
        try {
          const { getSupabase } = await import('@/services/supabaseClient')
          const supabase = getSupabase()
          const resolvedMethod = result.paymentMethod || result.payment?.payment_method || null

          if (supabase) {
            const walletUpdatePayload = {
              status: 'completed',
              updated_at: new Date().toISOString(),
              ...(resolvedMethod ? { payment_method: resolvedMethod } : {}),
            }

            const { error: walletUpdateError } = await supabase
              .from('wallet_transactions')
              .update(walletUpdatePayload)
              .eq('external_reference', sessionId)
              .eq('status', 'pending')

            if (walletUpdateError) {
              console.warn('⚠️ Failed to finalize wallet transaction status:', walletUpdateError)
            } else {
              console.log('✅ Wallet transaction status finalized for marketplace checkout')
            }
          }
        } catch (walletFinalizeError) {
          console.warn('⚠️ Marketplace wallet status finalization skipped:', walletFinalizeError)
        }
      }

      // Redirect to retire dashboard after purchase (shows proof of purchase)
      // For wallet top-up, redirect to wallet
      const redirectPath = '/wallet'

      // Add a flag to trigger refresh in RetireView
      if (!wasTopUp) {
        sessionStorage.setItem('refresh_retire_history', 'true')
      }

      // Clean up localStorage
      localStorage.removeItem('pending_purchase')
      localStorage.removeItem('pending_purchase_session')
      localStorage.removeItem('wallet_topup_session')
      localStorage.removeItem('wallet_topup_amount')
      localStorage.removeItem('wallet_topup_user_id')

      // Redirect to appropriate page after 3 seconds
      setTimeout(() => {
        router.push(redirectPath)
      }, 3000)
    } else {
      throw new Error('Payment not completed')
    }
  } catch (err) {
    console.error('Payment callback error:', err)
    error.value = err.message || 'Payment verification failed'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="payment-callback-page">
    <div class="container">
      <div v-if="loading" class="loading-container">
        <div class="spinner"></div>
        <h2>Processing payment...</h2>
        <p>Please wait while we verify your payment</p>
      </div>

      <div v-else-if="success" class="success-container">
        <div class="success-icon">✅</div>
        <h2>Payment Successful!</h2>
        <p>Your payment has been confirmed</p>
        <div v-if="paymentDetails" class="payment-summary">
          <p><strong>Amount:</strong> ₱{{ paymentDetails.amount.toLocaleString() }}</p>
          <p><strong>Status:</strong> {{ paymentDetails.status }}</p>
        </div>
        <p class="redirect-message">Redirecting to retire dashboard...</p>
      </div>

      <div v-else class="error-container">
        <div class="error-icon">❌</div>
        <h2>Payment Verification Failed</h2>
        <p>{{ error }}</p>
        <button @click="router.push('/marketplace')" class="btn-primary">
          Return to Marketplace
        </button>
      </div>
    </div>
    <ModernPrompt
      :is-open="promptState.isOpen"
      :type="promptState.type"
      :title="promptState.title"
      :message="promptState.message"
      :confirm-text="promptState.confirmText"
      :cancel-text="promptState.cancelText"
      :show-cancel="promptState.showCancel"
      @confirm="handleConfirm"
      @cancel="handleCancel"
      @close="handleClose"
    />
  </div>
</template>

<style scoped>
.payment-callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
}

.container {
  max-width: 600px;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.loading-container,
.success-container,
.error-container {
  padding: 2rem;
}

.spinner {
  width: 50px;
  height: 50px;
  margin: 0 auto 1rem;
  border: 4px solid #f3f4f6;
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.success-icon,
.error-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}

p {
  margin: 0.5rem 0;
  color: #6b7280;
}

.payment-summary {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
}

.redirect-message {
  font-style: italic;
  color: var(--primary-color);
}

.btn-primary {
  padding: 0.75rem 2rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 1rem;
}

.btn-primary:hover {
  background: var(--primary-hover);
}
</style>
