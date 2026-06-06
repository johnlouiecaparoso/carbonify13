/**
 * Webhook Service
 * Helper functions for checking webhook-processed transactions
 */

import { getSupabase } from '@/services/supabaseClient'

/**
 * Check if a transaction has been processed by webhook
 * @param {string} sessionId - PayMongo checkout session ID
 * @returns {Promise<Object|null>} Transaction status or null
 */
export async function checkWebhookTransactionStatus(sessionId) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  try {
    // Check wallet transactions
    const { data: walletTx } = await supabase
      .from('wallet_transactions')
      .select('id, status, amount, created_at')
      .eq('external_reference', sessionId)
      .single()

    if (walletTx) {
      return {
        type: 'wallet_topup',
        status: walletTx.status,
        transactionId: walletTx.id,
        amount: walletTx.amount,
        processedAt: walletTx.created_at,
      }
    }

    // Check credit purchases (marketplace)
    const { data: purchase } = await supabase
      .from('credit_purchases')
      .select('id, status, total_amount, created_at')
      .eq('payment_reference', sessionId)
      .single()

    if (purchase) {
      return {
        type: 'marketplace_purchase',
        status: purchase.status,
        transactionId: purchase.id,
        amount: purchase.total_amount,
        processedAt: purchase.created_at,
      }
    }

    return null
  } catch (error) {
    console.error('Error checking webhook transaction status:', error)
    return null
  }
}

/**
 * Poll for transaction completion (waits for webhook)
 * @param {string} sessionId - PayMongo checkout session ID
 * @param {number} maxAttempts - Maximum polling attempts (default: 10)
 * @param {number} intervalMs - Polling interval in milliseconds (default: 1000)
 * @returns {Promise<Object>} Transaction status when completed
 */
export async function waitForWebhookTransaction(
  sessionId,
  maxAttempts = 10,
  intervalMs = 1000
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const status = await checkWebhookTransactionStatus(sessionId)

    if (status && status.status === 'completed') {
      console.log(`✅ Transaction processed by webhook (attempt ${attempt}/${maxAttempts})`)
      return status
    }

    if (status && status.status === 'failed') {
      throw new Error('Transaction failed')
    }

    // Wait before next attempt
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  // If webhook hasn't processed, return null (fallback to client-side)
  console.warn('⚠️ Webhook did not process transaction within timeout, falling back to client-side')
  return null
}
