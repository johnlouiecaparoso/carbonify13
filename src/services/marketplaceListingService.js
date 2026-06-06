// Marketplace Listing Service - For users to list credits for sale
import { getSupabase } from '@/services/supabaseClient'

export class MarketplaceListingService {
  constructor() {
    this.supabase = getSupabase()
  }

  /**
   * Create a new credit listing
   * @param {Object} listingData - Listing information
   * @param {string} listingData.userId - User ID
   * @param {number} listingData.creditsAmount - Number of credits to sell
   * @param {number} listingData.pricePerCredit - Price per credit
   * @param {string} listingData.projectId - Associated project ID (optional)
   * @param {string} listingData.description - Listing description
   * @returns {Promise<Object>} Created listing
   */
  async createListing(listingData) {
    try {
      // Validate user has enough credits
      const userCredits = await this.getUserAvailableCredits(listingData.userId)
      if (userCredits < listingData.creditsAmount) {
        throw new Error('Insufficient credits available for listing')
      }

      const { data, error } = await this.supabase
        .from('user_credit_listings')
        .insert([
          {
            user_id: listingData.userId,
            credits_amount: listingData.creditsAmount,
            price_per_credit: listingData.pricePerCredit,
            project_id: listingData.projectId || null,
            description: listingData.description || '',
            status: 'active',
            created_at: new Date().toISOString(),
          },
        ])
        .select(
          `
          *,
          profiles:user_id (full_name),
          projects:project_id (title, category, location)
        `,
        )
        .single()

      if (error) {
        throw error
      }

      console.log('Credit listing created:', data)
      return data
    } catch (error) {
      console.error('Failed to create listing:', error)
      throw new Error('Failed to create listing: ' + error.message)
    }
  }

  /**
   * Get user's active listings
   * @param {string} userId - User ID
   * @returns {Promise<Array>} User's listings
   */
  async getUserListings(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_credit_listings')
        .select(
          `
          *,
          projects:project_id (title, category, location)
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Failed to fetch user listings:', error)
      throw new Error('Failed to fetch listings')
    }
  }

  /**
   * Get all active marketplace listings
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Active listings
   */
  async getMarketplaceListings(filters = {}) {
    try {
      let query = this.supabase
        .from('user_credit_listings')
        .select(
          `
          *,
          profiles:user_id (full_name),
          projects:project_id (title, category, location)
        `,
        )
        .eq('status', 'active')

      // Apply filters
      if (filters.category) {
        query = query.eq('projects.category', filters.category)
      }
      if (filters.minPrice) {
        query = query.gte('price_per_credit', filters.minPrice)
      }
      if (filters.maxPrice) {
        query = query.lte('price_per_credit', filters.maxPrice)
      }
      if (filters.location) {
        query = query.ilike('projects.location', `%${filters.location}%`)
      }

      // Apply sorting
      const sortBy = filters.sortBy || 'created_at'
      const ascending = filters.sortOrder === 'asc'
      query = query.order(sortBy, { ascending })

      const { data, error } = await query

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Failed to fetch marketplace listings:', error)
      throw new Error('Failed to fetch marketplace listings')
    }
  }

  /**
   * Purchase credits from a listing
   * @param {Object} purchaseData - Purchase information
   * @param {string} purchaseData.listingId - Listing ID
   * @param {string} purchaseData.buyerId - Buyer user ID
   * @param {number} purchaseData.creditsAmount - Number of credits to buy
   * @returns {Promise<Object>} Purchase result
   */
  async purchaseCredits(purchaseData) {
    try {
      // Get listing details
      const { data: listing, error: listingError } = await this.supabase
        .from('user_credit_listings')
        .select('*')
        .eq('id', purchaseData.listingId)
        .eq('status', 'active')
        .single()

      if (listingError || !listing) {
        throw new Error('Listing not found or no longer available')
      }

      // Validate purchase amount
      if (purchaseData.creditsAmount > listing.credits_amount) {
        throw new Error('Not enough credits available in this listing')
      }

      // Calculate total cost
      const totalCost = purchaseData.creditsAmount * listing.price_per_credit

      // Create purchase transaction
      const { data: transaction, error: transactionError } = await this.supabase
        .from('credit_purchases')
        .insert([
          {
            listing_id: purchaseData.listingId,
            buyer_id: purchaseData.buyerId,
            seller_id: listing.user_id,
            credits_amount: purchaseData.creditsAmount,
            price_per_credit: listing.price_per_credit,
            total_amount: totalCost,
            status: 'completed',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single()

      if (transactionError) {
        throw transactionError
      }

      // Update listing (reduce available credits or mark as sold)
      const remainingCredits = listing.credits_amount - purchaseData.creditsAmount
      const updateData =
        remainingCredits > 0
          ? { credits_amount: remainingCredits }
          : { credits_amount: 0, status: 'sold' }

      await this.supabase
        .from('user_credit_listings')
        .update(updateData)
        .eq('id', purchaseData.listingId)

      // Update buyer's credit balance
      await this.updateUserCredits(purchaseData.buyerId, purchaseData.creditsAmount, 'add')

      // Update seller's credit balance
      await this.updateUserCredits(listing.user_id, purchaseData.creditsAmount, 'subtract')

      console.log('Credit purchase completed:', transaction)
      return {
        success: true,
        transaction,
        totalCost,
        creditsAmount: purchaseData.creditsAmount,
      }
    } catch (error) {
      console.error('Failed to purchase credits:', error)
      throw new Error('Failed to purchase credits: ' + error.message)
    }
  }

  /**
   * Update or cancel a listing
   * @param {string} listingId - Listing ID
   * @param {string} userId - User ID (must be listing owner)
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated listing
   */
  async updateListing(listingId, userId, updates) {
    try {
      // Verify ownership
      const { data: listing, error: verifyError } = await this.supabase
        .from('user_credit_listings')
        .select('user_id')
        .eq('id', listingId)
        .single()

      if (verifyError || !listing) {
        throw new Error('Listing not found')
      }

      if (listing.user_id !== userId) {
        throw new Error('Not authorized to update this listing')
      }

      const { data, error } = await this.supabase
        .from('user_credit_listings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listingId)
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    } catch (error) {
      console.error('Failed to update listing:', error)
      throw new Error('Failed to update listing: ' + error.message)
    }
  }

  /**
   * Cancel a listing
   * @param {string} listingId - Listing ID
   * @param {string} userId - User ID (must be listing owner)
   * @returns {Promise<Object>} Cancelled listing
   */
  async cancelListing(listingId, userId) {
    return this.updateListing(listingId, userId, { status: 'cancelled' })
  }

  /** Pause an active listing (hidden from the marketplace, not cancelled). */
  async pauseListing(listingId, userId) {
    return this.updateListing(listingId, userId, { status: 'paused' })
  }

  /** Re-activate a paused listing. */
  async relistListing(listingId, userId) {
    return this.updateListing(listingId, userId, { status: 'active' })
  }

  /** Update a listing's price per credit. */
  async updateListingPrice(listingId, userId, pricePerCredit) {
    if (!(pricePerCredit > 0)) throw new Error('Price must be positive')
    return this.updateListing(listingId, userId, { price_per_credit: pricePerCredit })
  }

  /**
   * Get user's available credits for listing
   * @param {string} userId - User ID
   * @returns {Promise<number>} Available credits
   */
  async getUserAvailableCredits(userId) {
    try {
      // This would typically come from a user_credits table or similar
      // For now, simulate with a basic query
      const { data, error } = await this.supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', userId)
        .single()

      if (error) {
        // If no record exists, assume 0 credits
        return 0
      }

      return data?.available_credits || 0
    } catch (error) {
      console.error('Failed to get user credits:', error)
      return 0
    }
  }

  /**
   * Update user's credit balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add/subtract
   * @param {string} operation - 'add' or 'subtract'
   */
  async updateUserCredits(userId, amount, operation) {
    try {
      // This would update the user's credit balance
      // Implementation depends on your credit tracking system
      console.log(`${operation} ${amount} credits for user ${userId}`)

      // TODO: Implement actual credit balance updates
      // This might involve updating a user_credits table or similar
    } catch (error) {
      console.error('Failed to update user credits:', error)
      throw error
    }
  }

  /**
   * Get listing statistics
   * @param {string} userId - User ID (optional, for user-specific stats)
   * @returns {Promise<Object>} Listing statistics
   */
  async getListingStats(userId = null) {
    try {
      let query = this.supabase
        .from('user_credit_listings')
        .select('status, credits_amount, price_per_credit')

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      const stats = {
        totalListings: data.length,
        activeListings: data.filter((l) => l.status === 'active').length,
        soldListings: data.filter((l) => l.status === 'sold').length,
        totalCreditsListed: data.reduce((sum, l) => sum + l.credits_amount, 0),
        averagePrice:
          data.length > 0 ? data.reduce((sum, l) => sum + l.price_per_credit, 0) / data.length : 0,
      }

      return stats
    } catch (error) {
      console.error('Failed to get listing stats:', error)
      throw new Error('Failed to get listing statistics')
    }
  }
}

// Export singleton instance
export const marketplaceListingService = new MarketplaceListingService()

// Export individual functions for easier importing
export const {
  createListing,
  getUserListings,
  getMarketplaceListings,
  purchaseCredits,
  updateListing,
  cancelListing,
  getUserAvailableCredits,
  getListingStats,
} = marketplaceListingService
