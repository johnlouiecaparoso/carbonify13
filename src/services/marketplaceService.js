import { getSupabase } from '@/services/supabaseClient'
import { logUserAction } from '@/services/auditService'
import { notifyCreditPurchased } from '@/services/emailService'
import { notifyMarketplacePurchaseAndStock } from '@/services/notificationService'
// import { realPaymentService } from '@/services/realPaymentService'
// Import real payment service
import { realPaymentService } from './realPaymentService.js'
import { creditOwnershipService } from '@/services/creditOwnershipService'
import { getCurrentUserId } from '@/utils/authHelper'

const isDev = import.meta.env?.DEV ?? false
const MARKETPLACE_CACHE_TTL = 10000 // 10 seconds

let cachedMarketplaceListings = []
let lastMarketplaceFetch = 0
let cleanupTriggered = false

/** Call after purchase so next getMarketplaceListings() fetches fresh data */
export function invalidateMarketplaceCache() {
  cachedMarketplaceListings = []
  lastMarketplaceFetch = 0
}

/**
 * Update marketplace stock after a purchase (credits_available + credit_listings).
 * Call this from both in-app purchase and payment callback (PayMongo) so sold-out state is correct.
 * @param {string} projectCreditId - project_credits.id
 * @param {number} quantityPurchased - credits just purchased
 * @param {{ listingQuantity?: number }} [opts] - optional fallback when credits_available/total_credits are null
 */
export async function updateMarketplaceAvailabilityAfterPurchase(
  projectCreditId,
  quantityPurchased,
  opts = {},
) {
  const supabase = getSupabase()
  if (!supabase) return

  const { listingQuantity } = opts

  try {
    const { data: projectCredit } = await supabase
      .from('project_credits')
      .select('credits_available, total_credits')
      .eq('id', projectCreditId)
      .single()

    const currentAvailable =
      projectCredit?.credits_available ??
      projectCredit?.total_credits ??
      listingQuantity ??
      0
    const newCreditsAvailable = Math.max(0, currentAvailable - quantityPurchased)

    const { error: creditsUpdateError } = await supabase
      .from('project_credits')
      .update({ credits_available: newCreditsAvailable })
      .eq('id', projectCreditId)

    if (creditsUpdateError) {
      console.error('Error updating project_credits.credits_available:', creditsUpdateError)
    }

    const listingUpdate = {
      quantity: newCreditsAvailable,
      status: 'active',
    }
    const { error: allListingsUpdateError } = await supabase
      .from('credit_listings')
      .update(listingUpdate)
      .eq('project_credit_id', projectCreditId)

    if (allListingsUpdateError) {
      console.error('Error syncing credit_listings quantities:', allListingsUpdateError)
    }

    invalidateMarketplaceCache()
    if (isDev) {
      console.log('Marketplace availability updated after purchase:', {
        projectCreditId,
        quantityPurchased,
        newCreditsAvailable,
      })
    }

    return newCreditsAvailable
  } catch (err) {
    console.error('updateMarketplaceAvailabilityAfterPurchase error:', err)
    return null
  }
}

/**
 * Get all active marketplace listings with project details
 * Real data implementation with proper error handling
 */
/**
 * Clean up orphaned credit_listings and project_credits that reference deleted projects
 * This function should be called periodically or when marketplace loads
 */
async function cleanupOrphanedRecords() {
  const supabase = getSupabase()
  if (!supabase) return

  // Add timeout protection - cleanup should not block marketplace loading
  const cleanupTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Cleanup timeout')), 10000) // 10 second timeout for cleanup
  )

  try {
    console.log('[Cleanup] Checking for orphaned records...')

    // Race cleanup against timeout - if it takes too long, skip it
    await Promise.race([
      (async () => {
        // Get all project_credits
        const { data: allCredits, error: creditsError } = await supabase
          .from('project_credits')
          .select('id, project_id')
          .limit(1000) // Limit to prevent huge queries

        if (creditsError || !allCredits || allCredits.length === 0) {
          return
        }

        // Get all project IDs from credits
        const creditProjectIds = [...new Set(allCredits.map((c) => c.project_id).filter(Boolean))]

        if (creditProjectIds.length === 0) {
          return
        }

        // Check which projects actually exist
        const { data: existingProjects, error: projectsError } = await supabase
          .from('projects')
          .select('id')
          .in('id', creditProjectIds)

        if (projectsError) {
          console.warn('Warning: Error checking existing projects:', projectsError)
          return
        }

        const existingProjectIds = new Set(existingProjects?.map((p) => p.id) || [])
        const orphanedProjectIds = creditProjectIds.filter((id) => !existingProjectIds.has(id))

        if (orphanedProjectIds.length === 0) {
          console.log('[Cleanup] No orphaned records found')
          return
        }

        console.log(`[Cleanup] Found ${orphanedProjectIds.length} orphaned project references`)

        // Find orphaned credits
        const orphanedCredits = allCredits.filter((c) => orphanedProjectIds.includes(c.project_id))
        const orphanedCreditIds = orphanedCredits.map((c) => c.id)

        if (orphanedCreditIds.length === 0) {
          return
        }

        console.log(
          `[Cleanup] Removing ${orphanedCreditIds.length} orphaned project_credits and their listings`,
        )

        // Delete orphaned credit_listings first
        const { error: listingsError, count: deletedListings } = await supabase
          .from('credit_listings')
          .delete({ count: 'exact' })
          .in('project_credit_id', orphanedCreditIds)

        if (listingsError) {
          console.warn('Warning: Error cleaning up orphaned credit_listings:', listingsError)
        } else {
          console.log(`[Cleanup] Removed ${deletedListings || 0} orphaned credit_listings`)
        }

        // Delete orphaned project_credits
        const { error: creditsDeleteError, count: deletedCredits } = await supabase
          .from('project_credits')
          .delete({ count: 'exact' })
          .in('id', orphanedCreditIds)

        if (creditsDeleteError) {
          console.warn('Warning: Error cleaning up orphaned project_credits:', creditsDeleteError)
        } else {
          console.log(`[Cleanup] Removed ${deletedCredits || 0} orphaned project_credits`)
        }

        console.log(
          `[Cleanup] Completed removal of ${deletedListings || 0} listings and ${deletedCredits || 0} credits`,
        )
      })(),
      cleanupTimeout,
    ])
  } catch (error) {
    // If it's a timeout, just log and continue - don't block marketplace loading
    if (error.message?.includes('timeout') || error.message?.includes('Cleanup timeout')) {
      console.warn('Warning: Cleanup timed out, continuing with marketplace load...')
    } else {
      console.error('Error during orphaned records cleanup:', error)
    }
  }
}

function triggerCleanupOnce() {
  if (cleanupTriggered) {
    return
  }
  cleanupTriggered = true
    cleanupOrphanedRecords().catch((err) => {
    if (isDev) {
      console.warn('Warning: Orphaned records cleanup failed (non-critical):', err?.message || err)
    }
  })
}

function applyMarketplaceFilters(sourceListings = [], filters = {}) {
  const { ...criteria } = filters || {}
  let filtered = [...sourceListings]

  if (criteria.category && criteria.category !== 'all') {
    filtered = filtered.filter((listing) => listing.category === criteria.category)
  }

  if (criteria.country) {
    const searchLocation = criteria.country.toLowerCase()
    filtered = filtered.filter((listing) =>
      listing.location?.toLowerCase().includes(searchLocation),
    )
  }

  if (criteria.minPrice) {
    filtered = filtered.filter((listing) => listing.price_per_credit >= criteria.minPrice)
  }

  if (criteria.maxPrice) {
    filtered = filtered.filter((listing) => listing.price_per_credit <= criteria.maxPrice)
  }

  if (criteria.search) {
    const term = criteria.search.toLowerCase()
    filtered = filtered.filter(
      (listing) =>
        listing.project_title?.toLowerCase().includes(term) ||
        listing.project_description?.toLowerCase().includes(term) ||
        listing.location?.toLowerCase().includes(term),
    )
  }

  return filtered
}

export async function getMarketplaceListings(filters = {}) {
  const supabase = getSupabase()

  if (!supabase) {
    console.warn('Supabase client not initialized')
    return []
  }

  triggerCleanupOnce()

  const now = Date.now()
  const forceRefresh = Boolean(filters?.forceRefresh)
  const cacheIsFresh =
    !forceRefresh &&
    cachedMarketplaceListings.length > 0 &&
    now - lastMarketplaceFetch < MARKETPLACE_CACHE_TTL

  if (cacheIsFresh) {
    if (isDev) {
      console.log('Marketplace cache hit, serving cached listings')
    }
    return applyMarketplaceFilters(cachedMarketplaceListings, filters)
  }

  const { data, error } = await supabase
    .from('credit_listings')
    .select(
      `
      id,
      created_at,
      quantity,
      price_per_credit,
      currency,
      seller_id,
      status,
      source,
      project_credit_id,
      project_credits:project_credits (
        id,
        project_id,
        price_per_credit,
        currency,
        total_credits,
        credits_available,
        vintage_year,
        verification_standard,
        projects:projects!inner(
          id,
          title,
          description,
          category,
          location,
          geo_coordinates,
          barangay,
          municipality,
          feasibility_score,
          social_impact_score,
          climate_risk_rating,
          project_image,
          image_name,
          image_type,
          credit_price,
          estimated_credits,
          status
        )
      )
    `,
    )
    .eq('status', 'active')

  if (error) {
    console.error('Error fetching marketplace listings:', error)
    return []
  }

  let sellerMap = new Map()
  if (data?.length) {
    const sellerIds = [...new Set(data.map((listing) => listing.seller_id).filter(Boolean))]
    if (sellerIds.length > 0) {
      const { data: sellers, error: sellerError } = await supabase
        .from('profiles')
        .select('id, full_name, kyc_level')
        .in('id', sellerIds)

      if (!sellerError && sellers) {
        sellerMap = new Map(sellers.map((seller) => [seller.id, seller]))
      } else if (sellerError) {
        console.warn('Warning: Failed to load seller profiles:', sellerError)
      }
    }
  }

  // Derive sold quantities from credit_transactions (source of truth) so sold-out is correct
  // even when project_credits/credit_listings updates are blocked by RLS
  const projectCreditIds = [...new Set((data || []).map((l) => l.project_credits?.id).filter(Boolean))]
  const soldByProjectCredit = new Map()
  if (projectCreditIds.length > 0) {
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('project_credit_id, quantity')
      .in('project_credit_id', projectCreditIds)
      .eq('status', 'completed')
    if (transactions?.length) {
      for (const t of transactions) {
        const id = t.project_credit_id
        soldByProjectCredit.set(id, (soldByProjectCredit.get(id) || 0) + (t.quantity || 0))
      }
    }
  }

  const dedupeMap = new Map()

  for (const listing of data || []) {
    const credit = listing.project_credits
    const project = credit?.projects

      if (!credit || !project || !['approved', 'validated'].includes(project.status)) {
      continue
    }

    const cacheKey = listing.project_credit_id || credit.id
    const existing = dedupeMap.get(cacheKey)
    if (existing && new Date(listing.created_at) <= new Date(existing.listed_at)) {
      continue
    }

    const totalPool =
      project.estimated_credits ?? credit.total_credits ?? listing.quantity ?? 0
    const soldQuantity = soldByProjectCredit.get(credit.id) || 0
    const availableFromTransactions = Math.max(0, totalPool - soldQuantity)

    let availableQuantity = listing.quantity ?? 0
    if (project.estimated_credits) {
      availableQuantity = Math.min(availableQuantity, project.estimated_credits)
    }
    if (credit.credits_available !== null && credit.credits_available !== undefined) {
      availableQuantity = Math.min(availableQuantity, credit.credits_available)
    }
    // Source of truth: never show more than (total pool - already sold)
    availableQuantity = Math.min(availableQuantity, availableFromTransactions)

    const pricePerCredit =
      project.credit_price ??
      credit.price_per_credit ??
      listing.price_per_credit ??
      0

    dedupeMap.set(cacheKey, {
          listing_id: listing.id,
          project_id: project.id,
          project_title: project.title,
          project_description: project.description,
          category: project.category,
          location: project.location,
          geo_coordinates: project.geo_coordinates,
          feasibility_score: project.feasibility_score,
          social_impact_score: project.social_impact_score,
          climate_risk_rating: project.climate_risk_rating,
          vintage_year: credit.vintage_year,
          verification_standard: credit.verification_standard,
      available_quantity: availableQuantity,
          price_per_credit: pricePerCredit,
          currency: listing.currency || credit.currency || 'PHP',
          seller_id: listing.seller_id,
      seller_name: sellerMap.get(listing.seller_id)?.full_name || 'Unknown Seller',
      seller_kyc_verified: Number(sellerMap.get(listing.seller_id)?.kyc_level) >= 2,
          source: listing.source || 'local',
          listed_at: listing.created_at,
          project_image: project.project_image,
          image_name: project.image_name,
          image_type: project.image_type,
      estimated_credits: project.estimated_credits,
          credit_price: project.credit_price,
          project_credits_available: credit.credits_available,
          project_credits_total: credit.total_credits,
        })
      }

  const transformedListings = Array.from(dedupeMap.values())

  cachedMarketplaceListings = transformedListings
  lastMarketplaceFetch = now

  if (isDev) {
    console.log(`Loaded ${transformedListings.length} marketplace listings from Supabase`)
  }

  return applyMarketplaceFilters(transformedListings, filters)
}

/**
 * Get a specific marketplace listing by ID
 */
export async function getMarketplaceListing(listingId) {
  const supabase = getSupabase()

  try {
    const { data, error } = await supabase
      .from('credit_listings')
      .select('*')
      .eq('id', listingId)
      .single()

    if (error) {
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching marketplace listing:', error)
    throw error
  }
}

/**
 * Check if a credit listing already exists for a project_credit_id
 * @param {string} projectCreditId - Project credit ID
 * @returns {Promise<boolean>} True if listing exists
 */
export async function checkExistingListing(projectCreditId) {
  const supabase = getSupabase()

  if (!supabase) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from('credit_listings')
      .select('id')
      .eq('project_credit_id', projectCreditId)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing listing:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('Error in checkExistingListing:', error)
    return false
  }
}

/**
 * Get marketplace statistics
 */
export async function getMarketplaceStats() {
  const supabase = getSupabase()

  try {
    const { data: listings, error } = await supabase
      .from('credit_listings')
      .select('quantity, price_per_credit, currency')
      .eq('status', 'active')

    if (error) {
      throw error
    }

    const stats = {
      totalListings: listings?.length || 0,
      totalCreditsAvailable: listings?.reduce((sum, listing) => sum + listing.quantity, 0) || 0,
      totalMarketValue:
        listings?.reduce((sum, listing) => sum + listing.quantity * listing.price_per_credit, 0) ||
        0,
    }

    return stats
  } catch (error) {
    console.error('Error fetching marketplace stats:', error)
    return {
      totalListings: 0,
      totalCreditsAvailable: 0,
      totalMarketValue: 0,
    }
  }
}

/**
 * Get user's credit portfolio (owned credits)
 */
export async function getUserCreditPortfolio(userId) {
  const supabase = getSupabase()

  if (!supabase) {
    console.warn('Supabase client not initialized')
    return []
  }

  try {
    // Use projects directly since credit_ownership has project_id
    // This avoids the ambiguous relationship error with project_credits
    const { data, error } = await supabase
      .from('credit_ownership')
      .select(
        `
        *,
        projects!inner(
          id,
          title,
          description,
          category,
          location,
          project_image,
          image_name,
          image_type
        )
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user credit portfolio:', error)
      throw error
    }

    // Transform the data to match expected format
    const portfolio = (data || []).map((record) => ({
      id: record.id,
      project_id: record.project_id,
      project_title: record.projects?.title || 'Unknown Project',
      project_description: record.projects?.description || '',
      project_category: record.projects?.category || 'Unknown',
      project_location: record.projects?.location || 'Unknown',
      project_image: record.projects?.project_image,
      image_name: record.projects?.image_name,
      image_type: record.projects?.image_type,
      quantity: record.quantity,
      ownership_type: record.ownership_type,
      created_at: record.created_at,
      updated_at: record.updated_at,
      ownership_status: record.ownership_type === 'retired' ? 'retired' : 'owned',
    }))

    return portfolio
  } catch (error) {
    console.error('Error in getUserCreditPortfolio:', error)
    return []
  }
}

/**
 * Purchase credits from marketplace listing
 * @param {string} listingId - Listing ID
 * @param {Object} purchaseData - Purchase information
 * @param {number} purchaseData.quantity - Number of credits to purchase
 * @param {string} purchaseData.paymentMethod - Payment method (gcash/maya)
 * @param {Object} purchaseData.paymentData - Payment details
 * @returns {Promise<Object>} Purchase result
 */
export async function purchaseCredits(listingId, purchaseData) {
  const supabase = getSupabase()

  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  try {
    console.log('🛒 Processing credit purchase:', { listingId, purchaseData })

    // Get current user ID using helper (works for test accounts too)
    const userId = await getCurrentUserId()
    console.log('getCurrentUserId result:', userId)

    if (!userId) {
      console.error('No user ID found')
      throw new Error('User not authenticated')
    }

    // KYC gate: buyers must be identity-verified before purchasing credits.
    const { assertCanTrade } = await import('@/services/kycService')
    await assertCanTrade(userId)

    const user = { id: userId }

    // Get listing details with project information
    const { data: listing, error: listingError } = await supabase
      .from('credit_listings')
      .select(
        `
        *,
        project_credits!inner(
          id,
          project_id,
          projects!inner(
            id,
            title,
            category,
            location
          )
        )
      `,
      )
      .eq('id', listingId)
      .eq('status', 'active')
      .single()

    if (listingError || !listing) {
      throw new Error('Listing not found or no longer available')
    }

    // Validate purchase quantity
    if (purchaseData.quantity <= 0) {
      throw new Error('Invalid purchase quantity')
    }

    // CRITICAL: Get the correct price from project (developer-set price), not listing
    // This ensures we use the same price logic as the marketplace display
    const { data: project } = await supabase
      .from('projects')
      .select('credit_price, estimated_credits')
      .eq('id', listing.project_credits.project_id)
      .single()

    // Use project.credit_price (developer-set) if available, otherwise fall back to listing price
    const actualPricePerCredit = project?.credit_price || listing.price_per_credit
    const totalCost = actualPricePerCredit * purchaseData.quantity

    // CRITICAL: Get current available credits for THIS listing's project_credits row (by id)
    const { data: projectCredit } = await supabase
      .from('project_credits')
      .select('credits_available, total_credits')
      .eq('id', listing.project_credits.id)
      .single()

    // Calculate actual available quantity (respects developer limit)
    // Priority: project_credits.credits_available > project.estimated_credits > listing.quantity
    let actualAvailable = listing.quantity

    // If developer set estimated_credits, use that as the maximum limit
    if (project?.estimated_credits && project.estimated_credits > 0) {
      actualAvailable = Math.min(actualAvailable, project.estimated_credits)
    }

    // If project_credits has credits_available, use that (it's the most accurate)
    if (
      projectCredit?.credits_available !== null &&
      projectCredit?.credits_available !== undefined
    ) {
      actualAvailable = Math.min(
        actualAvailable,
        projectCredit.credits_available,
        project?.estimated_credits || Infinity,
      )
    }

    // Validate purchase quantity against calculated available quantity
    if (purchaseData.quantity > actualAvailable) {
      throw new Error(
        `Cannot purchase ${purchaseData.quantity} credits. ` +
          `Only ${actualAvailable} credits available. ` +
          (project?.estimated_credits ? `(Developer limit: ${project.estimated_credits})` : ''),
      )
    }

    console.log('Purchase quantity validated:', {
      requested: purchaseData.quantity,
      listing_quantity: listing.quantity,
      developer_limit: project?.estimated_credits,
      project_credits_available: projectCredit?.credits_available,
      project_credits_total: projectCredit?.total_credits,
      actual_available: actualAvailable,
    })

    console.log('Purchase details:', {
      quantity: purchaseData.quantity,
      listing_price_per_credit: listing.price_per_credit,
      project_credit_price: project?.credit_price,
      actual_price_per_credit: actualPricePerCredit,
      totalCost,
      currency: listing.currency,
      project_title: listing.project_credits.projects.title,
    })

    // Handle different payment methods
    let paymentResult
    if (purchaseData.paymentMethod === 'wallet') {
      // Wallet balance payment - deduct from user's wallet
      const { updateWalletBalance, getWalletBalance } = await import('@/services/walletService')
      const supabase = getSupabase()

      // Check wallet balance
      const walletBalance = await getWalletBalance(user.id)
      if (walletBalance.current_balance < totalCost) {
        throw new Error(
          `Insufficient wallet balance. You have ₱${walletBalance.current_balance.toFixed(2)}, but need ₱${totalCost.toFixed(2)}`,
        )
      }

      // Get wallet account for transaction record
      const { data: walletAccount } = await supabase
        .from('wallet_accounts')
        .select('id')
        .eq('user_id', user.id)
        .single()

      // Create wallet transaction record
      const { data: walletTransaction, error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          account_id: walletAccount.id,
          user_id: user.id,
          type: 'withdrawal',
          amount: totalCost,
          status: 'completed',
          payment_method: 'wallet',
          description: `Purchase ${purchaseData.quantity} credits from ${listing.project_credits.projects.title}`,
          reference_id: `wallet_purchase_${Date.now()}`,
        })
        .select()
        .single()

      if (transactionError) {
        throw new Error(`Failed to create wallet transaction: ${transactionError.message}`)
      }

      // Deduct from wallet balance
      await updateWalletBalance(user.id, totalCost, 'withdrawal')

      // Payment result for wallet
      paymentResult = {
        success: true,
        transactionId: walletTransaction.id,
        checkoutUrl: null,
        sessionId: null,
        status: 'completed',
        paymentMethod: 'wallet',
      }
      console.log('Wallet payment processed successfully')
    } else if (purchaseData.paymentMethod === 'demo') {
      // Demo mode - instant completion
      paymentResult = {
        success: true,
        transactionId: `demo_${Date.now()}`,
        checkoutUrl: null,
        sessionId: null,
        status: 'completed',
      }
    } else if (
      purchaseData.paymentMethod === 'card' ||
      purchaseData.paymentMethod === 'gcash' ||
      purchaseData.paymentMethod === 'maya'
    ) {
      // Real PayMongo payment - creates checkout session
      // PayMongo supports card, gcash, and paymaya in the same checkout session
      // The actual payment method will be detected from PayMongo callback
      // Include detailed purchase information for PayMongo checkout display

      // Prepare payment data
      const paymentData = {
        amount: totalCost,
        currency: listing.currency,
        description: `Purchase ${purchaseData.quantity} credits from ${listing.project_credits.projects.title}`,
        userId: user.id,
        metadata: {
          quantity: purchaseData.quantity,
          price_per_credit: actualPricePerCredit,
          total_amount: totalCost,
          project_title: listing.project_credits.projects.title,
          listing_id: listingId,
          requested_payment_method: purchaseData.paymentMethod, // Store requested method for reference
        },
      }

      // Call the appropriate payment method with proper context binding
      if (purchaseData.paymentMethod === 'card') {
        paymentResult = await realPaymentService.processCardPayment(paymentData)
      } else if (purchaseData.paymentMethod === 'gcash') {
        paymentResult = await realPaymentService.processGCashPayment(paymentData)
      } else {
        paymentResult = await realPaymentService.processMayaPayment(paymentData)
      }

      // Check for errors first
      if (!paymentResult.success) {
        const errorMessage = paymentResult.error || 'Payment processing failed'
        console.error('❌ Payment service error:', errorMessage)
        throw new Error(errorMessage)
      }

      // If PayMongo checkout is created, redirect user and return early
      if (paymentResult.checkoutUrl) {
        console.log('🔗 Redirecting to PayMongo checkout:', paymentResult.checkoutUrl)
        // Store purchase data temporarily in localStorage for later completion
        localStorage.setItem(
          'pending_purchase',
          JSON.stringify({
            listingId,
            purchaseData,
            totalCost,
            listing,
            paymentResult,
          }),
        )

        // Redirect to PayMongo checkout
        return {
          success: true,
          redirect: true,
          checkoutUrl: paymentResult.checkoutUrl,
          sessionId: paymentResult.sessionId,
          message: 'Redirecting to payment...',
        }
      } else {
        // If no checkoutUrl is returned, this is an error for online payment methods
        console.error('❌ No checkout URL returned from payment service')
        throw new Error('Failed to create payment checkout. Please try again or contact support.')
      }
    } else {
      throw new Error(`Invalid payment method: ${purchaseData.paymentMethod}`)
    }

    // Create credit purchase transaction
    // Note: Schema matches complete-ecolink-setup.sql - no currency or payment_reference columns
    const purchaseDataToInsert = {
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      credits_amount: purchaseData.quantity,
      price_per_credit: actualPricePerCredit, // Use the correct price (developer-set)
      total_amount: totalCost,
      payment_method: purchaseData.paymentMethod,
      payment_status: 'completed', // Note: schema has both payment_status and status
      status: 'completed',
      completed_at: new Date().toISOString(), // Schema has completed_at field
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('credit_purchases')
      .insert(purchaseDataToInsert)
      .select()
      .single()

    // Don't throw error if purchase record creation fails - purchase already succeeded
    // Wallet is deducted and credits are added, so the purchase is valid
    if (purchaseError) {
      console.warn('Warning: Error creating purchase record (non-critical):', purchaseError)
      console.warn('Warning: Purchase was successful - wallet deducted, credits added')
      console.warn('Warning: This is a tracking issue only, purchase transaction completed successfully')
      // Continue execution - purchase is valid even without purchase record
    } else {
      console.log('Purchase record created:', purchase.id)
    }

    // Add credits to user's portfolio using real service
    // Use purchase ID if available, otherwise use transaction ID from payment
    const purchaseId = purchase?.id || paymentResult.transactionId || `wallet_${Date.now()}`
    try {
      // Get purchase price and project credit ID from listing
      const purchasePrice = listing.price_per_credit || listing.price || 0
      const projectCreditId = listing.project_credits?.id || null

      await creditOwnershipService.addCreditsToPortfolio(
        user.id,
        listing.project_credits.project_id,
        purchaseData.quantity,
        'purchased',
        purchaseId,
        projectCreditId,
        purchasePrice,
      )
    console.log('Credits added to user portfolio')
  } catch (ownershipError) {
    console.error('Error adding credits to portfolio:', ownershipError)
      // Continue - purchase is still valid, but ownership might need manual fix
    }

    // Update marketplace stock (project_credits.credits_available + all credit_listings) and invalidate cache
    const remainingCredits = await updateMarketplaceAvailabilityAfterPurchase(
      listing.project_credits.id,
      purchaseData.quantity,
      {
      listingQuantity: listing.quantity,
      },
    )

    try {
      await notifyMarketplacePurchaseAndStock(listing.project_credits.projects, {
        projectCreditId: listing.project_credits.id,
        listingId,
        buyerId: user.id,
        sellerId: listing.seller_id,
        remainingCredits,
      })
    } catch (notificationError) {
      console.error('Failed to create marketplace purchase/sold-out notifications:', notificationError)
    }

    // Create credit_transaction record (required for certificates and receipts)
    // This is CRITICAL - transaction must be created for certificates and history
    let transactionId = null
    try {
      const { data: transaction, error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          buyer_id: user.id,
          seller_id: listing.seller_id,
          project_credit_id: listing.project_credits.id,
          listing_id: listingId,
          quantity: purchaseData.quantity,
          price_per_credit: actualPricePerCredit, // Use the correct price (developer-set)
          total_amount: totalCost,
          currency: listing.currency || 'PHP',
          payment_method: purchaseData.paymentMethod || 'wallet',
          payment_reference:
            paymentResult.transactionId || paymentResult.sessionId || `wallet_${Date.now()}`,
          status: 'completed',
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (!transactionError && transaction) {
        transactionId = transaction.id
        console.log('Credit transaction created:', transactionId)
      } else {
        console.error('CRITICAL: Failed to create credit_transaction:', transactionError)
        // Try to create transaction with minimal required fields
        console.log('Attempting to create transaction with minimal fields...')
        const { data: minimalTransaction, error: minimalError } = await supabase
          .from('credit_transactions')
          .insert({
            buyer_id: user.id,
            seller_id: listing.seller_id,
            project_credit_id: listing.project_credits.id,
            quantity: purchaseData.quantity,
            price_per_credit: actualPricePerCredit,
            total_amount: totalCost,
            currency: listing.currency || 'PHP',
            payment_method: purchaseData.paymentMethod || 'wallet',
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (!minimalError && minimalTransaction) {
          transactionId = minimalTransaction.id
          console.log('Credit transaction created with minimal fields:', transactionId)
        } else {
          console.error(
            'CRITICAL: Failed to create transaction even with minimal fields:',
            minimalError,
          )
          throw new Error(
            'Failed to create transaction record. Purchase may not appear in history.',
          )
        }
      }
    } catch (transError) {
      console.error('CRITICAL ERROR creating credit transaction:', transError)
      // Don't throw - purchase is still valid, but user should be notified
      console.error('Warning: Purchase completed but transaction record failed. History may not show.')
    }

    // Generate certificate automatically when credits are purchased
    // This ensures certificate appears in certificate dashboard immediately
    if (transactionId) {
      try {
        const { generateCreditCertificate } = await import('@/services/certificateService')
        const certificate = await generateCreditCertificate(transactionId, 'purchase')
        console.log(
          'Purchase certificate generated automatically:',
          certificate?.certificate_number,
        )
        console.log('Certificate will appear in certificate dashboard and retire dashboard')
      } catch (certError) {
        console.error('Error generating certificate:', certError)
        console.error(
          'Warning: Certificate generation failed. Purchase completed but certificate may be missing.',
        )
        // Continue - certificate generation failure shouldn't break purchase
      }
    } else {
      console.error('CRITICAL: Cannot generate certificate - no transactionId available')
      console.error('Warning: Purchase completed but certificate will not be generated.')
    }

    // Generate receipt automatically when credits are purchased
    if (transactionId) {
      try {
        const { generateReceipt } = await import('@/services/receiptService')
        const receipt = await generateReceipt(transactionId)
        console.log('Receipt generated automatically:', receipt?.receiptNumber)
      } catch (receiptError) {
        console.error('Error generating receipt:', receiptError)
        // Continue - receipt generation failure shouldn't break purchase
      }
    }

    // Log the purchase action (use purchaseId if purchase record was created)
    try {
      await logUserAction('PURCHASE_CREDITS', 'purchase', user.id, purchaseId, {
        listing_id: listingId,
        quantity: purchaseData.quantity,
        total_cost: totalCost,
        payment_method: purchaseData.paymentMethod,
      })
    } catch (logError) {
      console.warn('Warning: Error logging purchase action:', logError)
      // Continue - logging failure shouldn't break purchase
    }

    // Send notification email (only if purchase record was created)
    if (purchase?.id) {
      try {
        await notifyCreditPurchased(purchase.id, user.id)
      } catch (emailError) {
        console.warn('Warning: Failed to send purchase notification:', emailError)
        // Continue - email failure shouldn't break purchase
      }
    } else {
      console.log('Skipping email notification - purchase record not created')
    }

    console.log('Credit purchase completed successfully')

    return {
      success: true,
      purchase_id: purchase?.id || purchaseId,
      transaction_id: transactionId || paymentResult.transactionId || purchaseId,
      credits_purchased: purchaseData.quantity,
      total_cost: totalCost,
      currency: listing.currency || 'PHP',
      message: `Successfully purchased ${purchaseData.quantity} credits`,
      transaction: {
        id: purchase?.id || purchaseId,
        total_amount: totalCost,
        currency: listing.currency || 'PHP',
      },
    }
  } catch (error) {
    console.error('Error in purchaseCredits:', error)
    throw error
  }
}

/**
 * Retire credits (mark them as retired/used)
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {number} quantity - Number of credits to retire
 * @param {string} reason - Reason for retirement
 * @returns {Promise<Object>} Retirement result
 */
export async function retireCredits(userId, projectId, quantity, reason) {
  const supabase = getSupabase()

  if (!supabase) {
    throw new Error('Supabase client not available')
  }

  try {
    // Atomically decrement the owner's balance FIRST. This is the
    // anti-double-counting guard: the DB only decrements when enough credits
    // exist, so the same credits can never be retired twice (even concurrently).
    let decremented = false
    try {
      const { data, error } = await supabase.rpc('retire_credits_atomic', {
        p_user_id: userId,
        p_project_id: projectId,
        p_quantity: quantity,
      })
      if (error) throw error
      decremented = data === true
    } catch (rpcErr) {
      // Fallback for environments where the RPC isn't deployed yet.
      console.warn('retire_credits_atomic unavailable, using fallback:', rpcErr?.message)
      const { data: ownership, error: ownershipError } = await supabase
        .from('credit_ownership')
        .select('quantity')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .single()
      if (ownershipError || !ownership || ownership.quantity < quantity) {
        throw new Error('Insufficient credits to retire')
      }
      const { error: updateError } = await supabase
        .from('credit_ownership')
        .update({ quantity: ownership.quantity - quantity, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('project_id', projectId)
      if (updateError) throw new Error('Failed to update credit ownership')
      decremented = true
    }

    if (!decremented) {
      throw new Error('Insufficient credits to retire')
    }

    // Create retirement record (serial number auto-assigned by DB trigger)
    const { data: retirement, error: retirementError } = await supabase
      .from('credit_retirements')
      .insert({
        user_id: userId,
        project_id: projectId,
        quantity: quantity,
        reason: reason,
        retired_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (retirementError) {
      throw new Error('Failed to create retirement record')
    }

    // Log the retirement action
    await logUserAction('RETIRE_CREDITS', 'retirement', userId, retirement.id, {
      project_id: projectId,
      quantity: quantity,
      reason: reason,
    })

    // Generate retirement certificate automatically
    try {
      const { generateRetirementCertificate } = await import('@/services/certificateService')
      const certificate = await generateRetirementCertificate(retirement.id, userId)
      console.log(
        'Retirement certificate generated automatically:',
        certificate?.certificate_number,
      )
    } catch (certError) {
      console.error('Error generating retirement certificate:', certError)
      // Continue - certificate generation failure shouldn't break retirement
    }

    return {
      success: true,
      retirement_id: retirement.id,
      serial_number: retirement.serial_number,
      message: `Successfully retired ${quantity} credits`,
    }
  } catch (error) {
    console.error('Error retiring credits:', error)
    throw error
  }
}
