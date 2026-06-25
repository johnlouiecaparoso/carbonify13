/**
 * Real Payment Service - PayMongo Integration
 * Replaces mock payment system with real payment processing via PayMongo
 */

import { getSupabase } from '@/services/supabaseClient'
import {
  createCheckoutSession,
  processPaymentCallback
} from './paymongoService'

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
   * Process GCash payment via PayMongo
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result with checkout URL
   */
  async processGCashPayment(paymentData) {
    try {
      console.log('💳 Processing GCash payment via PayMongo:', paymentData)

      // Get wallet account ID - wallet should already exist (created by walletService)
      let walletAccountId
      
      // Try to get wallet account ID from metadata first (preferred - avoids RLS issues)
      if (paymentData.metadata && paymentData.metadata.walletAccountId) {
        walletAccountId = paymentData.metadata.walletAccountId
        console.log('✅ Using wallet account ID from metadata:', walletAccountId)
      } else {
        // Fallback: fetch wallet account (walletService should have created it already)
        const walletAccountResult = await this.supabase
          .from('wallet_accounts')
          .select('id')
          .eq('user_id', paymentData.userId)
          .single()

        if (walletAccountResult.error || !walletAccountResult.data) {
          throw new Error(`Wallet account not found for user ${paymentData.userId}. Please ensure wallet is created first.`)
        }
        walletAccountId = walletAccountResult.data.id
        console.log('✅ Using existing wallet from database:', walletAccountId)
      }

      // Create wallet transaction record
      const { data: transaction, error: transactionError } = await this.supabase
        .from('wallet_transactions')
        .insert({
          account_id: walletAccountId,
          user_id: paymentData.userId,
          type: 'deposit',
          amount: paymentData.amount,
          status: 'pending',
          payment_method: 'gcash',
          description: `GCash payment for ${paymentData.description || 'credit purchase'}`,
          reference_id: `pm_gcash_${Date.now()}`,
        })
        .select()
        .single()

      if (transactionError) {
        throw new Error(`Failed to create transaction: ${transactionError.message}`)
      }

      const billing = await this.getBuyerBillingInfo(paymentData.userId)

      // Create PayMongo checkout session
      // Include purchase metadata (quantity, price_per_credit, etc.) for checkout display
      const checkoutSession = await createCheckoutSession({
        amount: paymentData.amount,
        description: paymentData.description || 'Carbonify Credit Purchase',
        paymentMethodTypes: ['gcash'],
        billing,
        metadata: {
          transaction_id: transaction.id,
          user_id: paymentData.userId,
          method: 'gcash',
          // Include purchase details for checkout display
          ...(paymentData.metadata || {}),
        },
      })

      // Update transaction with PayMongo session ID
      await this.supabase
        .from('wallet_transactions')
        .update({
          external_reference: checkoutSession.sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)

      return {
        success: true,
        transactionId: transaction.id,
        checkoutUrl: checkoutSession.checkoutUrl,
        sessionId: checkoutSession.sessionId,
        amount: paymentData.amount,
        currency: 'PHP',
        method: 'gcash',
        status: 'pending',
        expiresAt: checkoutSession.expiresAt,
      }
    } catch (error) {
      console.error('❌ GCash payment error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Process Card payment via PayMongo
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result with checkout URL
   */
  async processCardPayment(paymentData) {
    try {
      console.log('💳 Processing Card payment via PayMongo:', paymentData)

      // Get wallet account ID - wallet should already exist (created by walletService)
      let walletAccountId
      
      // Try to get wallet account ID from metadata first (preferred - avoids RLS issues)
      if (paymentData.metadata && paymentData.metadata.walletAccountId) {
        walletAccountId = paymentData.metadata.walletAccountId
        console.log('✅ Using wallet account ID from metadata:', walletAccountId)
      } else {
        // Fallback: fetch wallet account (walletService should have created it already)
        const walletAccountResult = await this.supabase
          .from('wallet_accounts')
          .select('id')
          .eq('user_id', paymentData.userId)
          .single()

        if (walletAccountResult.error || !walletAccountResult.data) {
          throw new Error(`Wallet account not found for user ${paymentData.userId}. Please ensure wallet is created first.`)
        }
        walletAccountId = walletAccountResult.data.id
        console.log('✅ Using existing wallet from database:', walletAccountId)
      }

      // Create wallet transaction record
      const { data: transaction, error: transactionError } = await this.supabase
        .from('wallet_transactions')
        .insert({
          account_id: walletAccountId,
          user_id: paymentData.userId,
          type: 'deposit',
          amount: paymentData.amount,
          status: 'pending',
          payment_method: 'card',
          description: `Card payment for ${paymentData.description || 'credit purchase'}`,
          reference_id: `pm_card_${Date.now()}`,
        })
        .select()
        .single()

      if (transactionError) {
        throw new Error(`Failed to create transaction: ${transactionError.message}`)
      }

      const billing = await this.getBuyerBillingInfo(paymentData.userId)

      // Create PayMongo checkout session
      // PayMongo checkout supports card, gcash, and paymaya in the same session
      // Include purchase metadata (quantity, price_per_credit, etc.) for checkout display
      const checkoutSession = await createCheckoutSession({
        amount: paymentData.amount,
        description: paymentData.description || 'Carbonify Credit Purchase',
        paymentMethodTypes: ['card', 'gcash', 'paymaya'], // Allow all methods, user chooses
        billing,
        metadata: {
          transaction_id: transaction.id,
          user_id: paymentData.userId,
          method: 'card',
          // Include purchase details for checkout display
          ...(paymentData.metadata || {}),
        },
      })

      // Update transaction with PayMongo session ID
      await this.supabase
        .from('wallet_transactions')
        .update({
          external_reference: checkoutSession.sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)

      return {
        success: true,
        transactionId: transaction.id,
        checkoutUrl: checkoutSession.checkoutUrl,
        sessionId: checkoutSession.sessionId,
        amount: paymentData.amount,
        currency: 'PHP',
        method: 'card',
        status: 'pending',
        expiresAt: checkoutSession.expiresAt,
      }
    } catch (error) {
      console.error('❌ Card payment error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Process Maya payment via PayMongo
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result with checkout URL
   */
  async processMayaPayment(paymentData) {
    try {
      console.log('💳 Processing Maya payment via PayMongo:', paymentData)

      // Get wallet account ID - wallet should already exist (created by walletService)
      let walletAccountId
      
      // Try to get wallet account ID from metadata first (preferred - avoids RLS issues)
      if (paymentData.metadata && paymentData.metadata.walletAccountId) {
        walletAccountId = paymentData.metadata.walletAccountId
        console.log('✅ Using wallet account ID from metadata:', walletAccountId)
      } else {
        // Fallback: fetch wallet account (walletService should have created it already)
        const walletAccountResult = await this.supabase
          .from('wallet_accounts')
          .select('id')
          .eq('user_id', paymentData.userId)
          .single()

        if (walletAccountResult.error || !walletAccountResult.data) {
          throw new Error(`Wallet account not found for user ${paymentData.userId}. Please ensure wallet is created first.`)
        }
        walletAccountId = walletAccountResult.data.id
        console.log('✅ Using existing wallet from database:', walletAccountId)
      }

      // Create wallet transaction record
      const { data: transaction, error: transactionError } = await this.supabase
        .from('wallet_transactions')
        .insert({
          account_id: walletAccountId,
          user_id: paymentData.userId,
          type: 'deposit',
          amount: paymentData.amount,
          status: 'pending',
          payment_method: 'maya',
          description: `Maya payment for ${paymentData.description || 'credit purchase'}`,
          reference_id: `pm_maya_${Date.now()}`,
        })
        .select()
        .single()

      if (transactionError) {
        throw new Error(`Failed to create transaction: ${transactionError.message}`)
      }

      const billing = await this.getBuyerBillingInfo(paymentData.userId)

      // Create PayMongo checkout session
      // Include purchase metadata (quantity, price_per_credit, etc.) for checkout display
      const checkoutSession = await createCheckoutSession({
        amount: paymentData.amount,
        description: paymentData.description || 'Carbonify Credit Purchase',
        paymentMethodTypes: ['paymaya'],
        billing,
        metadata: {
          transaction_id: transaction.id,
          user_id: paymentData.userId,
          method: 'maya',
          // Include purchase details for checkout display
          ...(paymentData.metadata || {}),
        },
      })

      // Update transaction with PayMongo session ID
      await this.supabase
        .from('wallet_transactions')
        .update({
          external_reference: checkoutSession.sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)

      return {
        success: true,
        transactionId: transaction.id,
        checkoutUrl: checkoutSession.checkoutUrl,
        sessionId: checkoutSession.sessionId,
        amount: paymentData.amount,
        currency: 'PHP',
        method: 'maya',
        status: 'pending',
        expiresAt: checkoutSession.expiresAt,
      }
    } catch (error) {
      console.error('❌ Maya payment error:', error)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Confirm completed PayMongo payment
   * Called when user returns from PayMongo checkout
   * @param {string} sessionId - PayMongo checkout session ID
   * @returns {Promise<Object>} Payment confirmation result
   */
  async confirmPayMongoPayment(sessionId) {
    try {
      console.log('✅ Confirming PayMongo payment for session:', sessionId)

      // Process the payment callback from PayMongo
      const callbackResult = await processPaymentCallback(sessionId)

      if (!callbackResult.success) {
        throw new Error('Payment not completed')
      }

      const payment = callbackResult.payment
      const userId = callbackResult.session?.attributes?.metadata?.user_id

      if (!userId) {
        console.warn('⚠️ No user ID in payment metadata')
      }

      // Update wallet transaction status
      const { data: transactions } = await this.supabase
        .from('wallet_transactions')
        .select('*')
        .eq('external_reference', sessionId)
        .eq('status', 'pending')

      if (transactions && transactions.length > 0) {
        const transaction = transactions[0]

        // Update transaction to completed
        await this.supabase
          .from('wallet_transactions')
          .update({
            status: 'completed',
            external_reference: payment.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', transaction.id)

        // Update wallet balance
        if (userId) {
          await this.updateWalletBalance(userId, transaction.amount, 'add')
        }
      }

      return {
        success: true,
        paymentId: payment.id,
        amount: payment.amount,
        status: payment.status,
        fee: payment.fee,
      }
    } catch (error) {
      console.error('❌ Error confirming PayMongo payment:', error)
      throw error
    }
  }

  /**
   * Update wallet balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add/subtract
   * @param {string} operation - 'add' or 'subtract'
   */
  async updateWalletBalance(userId, amount, operation) {
    try {
      // Get current balance
      const { data: wallet, error: fetchError } = await this.supabase
        .from('wallet_accounts')
        .select('current_balance')
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        // Create wallet if doesn't exist
        await this.supabase.from('wallet_accounts').insert({
          user_id: userId,
          current_balance: operation === 'add' ? amount : 0,
          currency: 'PHP',
        })
        return
      }

      const newBalance =
        operation === 'add' ? wallet.current_balance + amount : wallet.current_balance - amount

      // Update balance
      await this.supabase
        .from('wallet_accounts')
        .update({
          current_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)

      console.log(`✅ Wallet balance updated: ${operation} ${amount}`)
    } catch (error) {
      console.error('❌ Error updating wallet balance:', error)
      throw error
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
