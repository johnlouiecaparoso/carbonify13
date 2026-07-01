import { getSupabase } from '@/services/supabaseClient'
import { USE_DATABASE } from '@/config/database'
import { realPaymentService } from './realPaymentService'
import { checkPaymentStatus } from './paymentGatewayService'

export async function getWalletBalance(userId = null) {
  // In production, always use database (USE_DATABASE should be true)
  // Sample data only for development/testing
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

  if (!USE_DATABASE && isDevelopment) {
    console.warn('[DEV] Database disabled, using sample data for wallet balance')
    return {
      current_balance: 1250.5,
      currency: 'PHP',
      last_updated: new Date().toISOString(),
    }
  }

  // Production: Must use database
  if (!USE_DATABASE) {
    throw new Error('Database must be enabled in production')
  }

  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Get user ID from session if not provided
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    userId = user.id
  }

  const { data, error } = await supabase
    .from('wallet_accounts')
    .select('current_balance, currency')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.log('Wallet fetch error:', error)
    // If no wallet exists, create one
    if (error.code === 'PGRST116') {
      console.log('No wallet found, creating new wallet for user:', userId)
      try {
        return await createWallet(userId)
      } catch (createError) {
        // If RLS violation, return default wallet data instead of throwing
        if (createError.code === 'RLS_VIOLATION') {
          console.warn('Wallet creation blocked by RLS policy. Returning default wallet balance.')
          return {
            current_balance: 0,
            currency: 'PHP',
          }
        }
        throw createError
      }
    }
    throw new Error(error.message || 'Failed to fetch wallet balance')
  }
  console.log('Wallet balance fetched:', data)
  return data
}

export async function createWallet() {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Wallet creation is server-side via the ensure_wallet() RPC (SECURITY
  // DEFINER, user taken from the JWT). This is idempotent and survives the
  // financial-table RLS lockdown — the browser never inserts wallet_accounts.
  const { data, error } = await supabase.rpc('ensure_wallet')
  if (error) {
    throw new Error(error.message || 'Failed to create wallet')
  }

  // The table function returns an array; the caller expects a single wallet row.
  const wallet = Array.isArray(data) ? data[0] : data
  if (!wallet) {
    throw new Error('Failed to create wallet')
  }
  return wallet
}

export async function getTransactions(userId = null, limit = 50) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Get user ID from session if not provided
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    userId = user.id
  }

  // First get the wallet account for this user
  const { data: walletAccount, error: walletError } = await supabase
    .from('wallet_accounts')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (walletError || !walletAccount) {
    return []
  }

  // Then get transactions for this account
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('account_id', walletAccount.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message || 'Failed to fetch transactions')
  }

  const transactions = data || []

  // Backfill legacy marketplace entries stuck in pending:
  // if a pending wallet transaction has an external_reference that matches
  // a completed credit_transaction.payment_reference, mark it completed.
  const pendingWithReference = transactions.filter(
    (transaction) => transaction.status === 'pending' && transaction.external_reference,
  )

  if (pendingWithReference.length > 0) {
    const references = Array.from(
      new Set(pendingWithReference.map((transaction) => String(transaction.external_reference))),
    )

    const { data: completedCredits, error: completedCreditsError } = await supabase
      .from('credit_transactions')
      .select('payment_reference')
      .eq('buyer_id', userId)
      .eq('status', 'completed')
      .in('payment_reference', references)

    if (!completedCreditsError && completedCredits?.length) {
      const completedReferences = Array.from(
        new Set(
          completedCredits
            .map((record) => record.payment_reference)
            .filter((reference) => reference != null)
            .map((reference) => String(reference)),
        ),
      )

      if (completedReferences.length) {
        await supabase
          .from('wallet_transactions')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', walletAccount.id)
          .eq('status', 'pending')
          .in('external_reference', completedReferences)

        return transactions.map((transaction) =>
          completedReferences.includes(String(transaction.external_reference))
            ? { ...transaction, status: 'completed' }
            : transaction,
        )
      }
    }
  }

  return transactions
}

export async function createTransaction(transactionData) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert([transactionData])
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to create transaction')
  }
  return data
}

export async function updateWalletBalance(userId = null, amount, transactionType = 'topup') {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Get user ID from session if not provided
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    userId = user.id
  }

  // Get current balance
  const { data: wallet, error: walletError } = await supabase
    .from('wallet_accounts')
    .select('current_balance')
    .eq('user_id', userId)
    .single()

  if (walletError) {
    throw new Error('Failed to fetch current balance')
  }

  // Calculate new balance
  const currentBalance = wallet.current_balance || 0
  const newBalance = transactionType === 'topup' ? currentBalance + amount : currentBalance - amount

  if (newBalance < 0) {
    throw new Error('Insufficient balance for withdrawal')
  }

  // Update wallet balance
  const { data, error } = await supabase
    .from('wallet_accounts')
    .update({ current_balance: newBalance })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update wallet balance')
  }

  return data
}

// Payment gateway integration functions
export async function initiateTopUp(amount, paymentMethod = 'gcash', userId = null) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Validate amount is a number, not a UUID (prevents parameter order mistakes)
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a valid positive number')
  }
  
  // Get user ID from session if not provided
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    userId = user.id
  }
  
  // Ensure userId is a valid UUID format (not a number - common mistake)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (typeof userId === 'number' || !uuidRegex.test(userId)) {
    throw new Error(`Invalid user ID format: ${userId}. Did you pass parameters in the wrong order? Expected: initiateTopUp(amount, paymentMethod, userId)`)
  }

  try {
    // Get or create wallet account
    let walletAccount
    const { data: existingWallet, error: walletError } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (walletError && walletError.code === 'PGRST116') {
      // Wallet doesn't exist, create it
      console.log('No wallet found, creating new wallet for user:', userId)
      const newWallet = await createWallet(userId)
      walletAccount = { id: newWallet.id }
      console.log('✅ Created new wallet account:', walletAccount.id)
    } else if (walletError) {
      throw new Error(`Failed to fetch wallet: ${walletError.message}`)
    } else if (!existingWallet) {
      // Edge case: wallet query succeeded but returned null
      console.log('Wallet query returned null, creating new wallet for user:', userId)
      const newWallet = await createWallet(userId)
      walletAccount = { id: newWallet.id }
      console.log('✅ Created new wallet account:', walletAccount.id)
    } else {
      walletAccount = existingWallet
      console.log('✅ Using existing wallet account:', walletAccount.id)
    }

    // Server-authoritative top-up (Phase 1 P5): record a payment_intent and let
    // the webhook credit the balance. The browser no longer inserts a pending
    // wallet_transactions row or updates the balance itself — that keeps top-ups
    // working after the financial-table RLS lockdown.
    const { createWalletTopupCheckout } = await import('@/services/paymongoService')

    let billing = null
    try {
      billing = await realPaymentService.getBuyerBillingInfo(userId)
    } catch {
      // billing prefill is best-effort
    }

    const checkout = await createWalletTopupCheckout({ amount, billing })
    const checkoutUrl = checkout?.checkoutUrl || checkout?.checkout_url
    if (!checkoutUrl) {
      throw new Error('Failed to start wallet top-up checkout')
    }

    // Return result with checkout URL for redirect
    console.log('Top-up initiated:', {
      account_id: walletAccount.id,
      amount,
      paymentMethod,
      sessionId: checkout.sessionId,
    })

    return {
      success: true,
      transactionId: checkout.paymentIntentId,
      paymentIntentId: checkout.paymentIntentId,
      checkoutUrl,
      sessionId: checkout.sessionId,
      amount: amount,
      currency: 'PHP',
      method: paymentMethod,
      redirect: true, // Indicates user needs to be redirected
    }
  } catch (error) {
    throw new Error(error.message || 'Failed to initiate top-up')
  }
}

export async function initiateWithdrawal(amount, paymentMethod = 'gcash', userId = null) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  // Validate amount is a number, not a UUID (prevents parameter order mistakes)
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a valid positive number')
  }
  
  // Get user ID from session if not provided
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }
    userId = user.id
  }
  
  // Ensure userId is a valid UUID format (not a number - common mistake)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (typeof userId === 'number' || !uuidRegex.test(userId)) {
    throw new Error(`Invalid user ID format: ${userId}. Did you pass parameters in the wrong order? Expected: initiateWithdrawal(amount, paymentMethod, userId)`)
  }

  try {
    // Check balance first
    const wallet = await getWalletBalance(userId)
    if (wallet.current_balance < amount) {
      throw new Error('Insufficient balance for withdrawal')
    }

    // Get wallet account ID
    const { data: walletAccount, error: walletError } = await supabase
      .from('wallet_accounts')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (walletError || !walletAccount) {
      throw new Error('Wallet account not found')
    }

    // Create pending transaction
    const transaction = await createTransaction({
      account_id: walletAccount.id,
      amount: amount,
      type: 'withdrawal',
      status: 'pending',
      payment_method: paymentMethod,
      description: `Withdrawal to ${paymentMethod.toUpperCase()}`,
      reference_id: generateReferenceId(),
    })

    // In a real implementation, this would call the payment gateway API
    // For now, we'll simulate processing after 3 seconds
    setTimeout(async () => {
      try {
        await updateWalletBalance(userId, amount, 'withdrawal')
        await updateTransactionStatus(transaction.id, 'completed')
      } catch (error) {
        console.error('Withdrawal processing error:', error)
        await updateTransactionStatus(transaction.id, 'failed')
      }
    }, 3000)

    return transaction
  } catch (error) {
    throw new Error(error.message || 'Failed to initiate withdrawal')
  }
}

async function updateTransactionStatus(transactionId, status) {
  const supabase = getSupabase()
  if (!supabase) {
    console.error('Supabase client not available for transaction update')
    return
  }

  try {
    const { error } = await supabase
      .from('wallet_transactions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', transactionId)

    if (error) {
      console.error('Error updating transaction status:', error)
    }
  } catch (error) {
    console.error('Failed to update transaction status:', error)
  }
}

function generateReferenceId() {
  return 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

/**
 * Check and complete payment if successful
 */
export async function checkAndCompletePayment(transactionId) {
  const supabase = getSupabase()
  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  try {
    // Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (transactionError || !transaction) {
      throw new Error('Transaction not found')
    }

    if (transaction.status !== 'pending') {
      return transaction // Already processed
    }

    // Check payment status with gateway
    const paymentStatus = await checkPaymentStatus(transaction.reference_id)

    if (paymentStatus.status === 'completed') {
      // Get wallet account
      const { data: walletAccount, error: walletError } = await supabase
        .from('wallet_accounts')
        .select('user_id')
        .eq('id', transaction.account_id)
        .single()

      if (walletError || !walletAccount) {
        throw new Error('Wallet account not found')
      }

      // Update wallet balance
      await updateWalletBalance(walletAccount.user_id, transaction.amount, 'topup')

      // Update transaction status
      await updateTransactionStatus(transaction.id, 'completed')

      console.log('✅ Payment completed successfully:', transaction.id)

      return {
        ...transaction,
        status: 'completed',
        completedAt: paymentStatus.completedAt,
        transactionId: paymentStatus.transactionId,
      }
    } else if (paymentStatus.status === 'failed') {
      // Update transaction as failed
      await updateTransactionStatus(transaction.id, 'failed')

      return {
        ...transaction,
        status: 'failed',
        failedAt: paymentStatus.failedAt,
        errorMessage: paymentStatus.errorMessage,
      }
    }

    // Still pending
    return transaction
  } catch (error) {
    console.error('Error checking payment:', error)
    throw new Error(error.message || 'Failed to check payment status')
  }
}
