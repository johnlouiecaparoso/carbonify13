/**
 * Real Payment Service - PayMongo billing helpers.
 *
 * NOTE (Phase 1 P2/P5 cutover): the payment-initiation methods that used to live
 * here (processCardPayment / processGCashPayment / processMayaPayment /
 * confirmPayMongoPayment / updateWalletBalance) wrote wallet_accounts /
 * wallet_transactions directly from the browser. Purchases and top-ups now go
 * through the server-authoritative flow (createMarketplaceCheckout /
 * createWalletTopupCheckout → paymongo-webhook → the settlement RPCs), so those
 * client-write methods were removed. What remains is read-only / pure helpers.
 */

import { getSupabase } from '@/services/supabaseClient'

export class RealPaymentService {
  constructor() {
    // Don't initialize supabase here - it might not be ready yet
    // Get it dynamically in each method to ensure it's initialized
  }

  get supabase() {
    const client = getSupabase()
    if (!client) {
      throw new Error('Supabase client not initialized. Please wait for app initialization.')
    }
    return client
  }

  /**
   * Resolve buyer billing details for PayMongo checkout prefill
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getBuyerBillingInfo(userId) {
    try {
      if (!userId) return null

      let fullName = ''
      let email = ''
      let phone = ''

      const { data: profile } = await this.supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', userId)
        .maybeSingle()

      if (profile) {
        fullName = profile.full_name || ''
        email = profile.email || ''
        phone = profile.phone || ''
      }

      const {
        data: { user },
      } = await this.supabase.auth.getUser()

      if (user && user.id === userId) {
        fullName =
          fullName ||
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')?.[0] ||
          ''
        email = email || user.email || ''
      }

      const billing = {
        name: fullName?.trim() || undefined,
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
      }

      if (!billing.name && !billing.email && !billing.phone) {
        return null
      }

      return billing
    } catch (error) {
      console.warn('⚠️ Failed to resolve buyer billing info:', error)
      return null
    }
  }

  /**
   * Get user transaction history
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Transaction history
   */
  async getUserTransactions(userId) {
    try {
      const { data: transactions, error } = await this.supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`)
      }

      return transactions || []
    } catch (error) {
      console.error('❌ Error fetching transactions:', error)
      return []
    }
  }

  /**
   * Calculate total cost with fees
   * @param {number} amount - Base amount
   * @param {string} method - Payment method ('gcash' or 'maya')
   * @returns {Object} Cost breakdown
   */
  calculateTotal(amount, method) {
    const fees = {
      gcash: 0.02, // 2% fee
      maya: 0.025, // 2.5% fee
    }

    const feeRate = fees[method] || 0
    const feeAmount = amount * feeRate
    const total = amount + feeAmount

    return {
      baseAmount: amount,
      feeRate: feeRate,
      feeAmount: feeAmount,
      total: total,
      currency: 'PHP',
    }
  }
}

// Export singleton instance
export const realPaymentService = new RealPaymentService()
