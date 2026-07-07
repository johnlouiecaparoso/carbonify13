/**
 * Marketplace Integration Service
 * Handles automatic creation of marketplace listings for approved projects
 */

import { getSupabase } from '@/services/supabaseClient'
import { logUserAction } from '@/services/auditService'

export class MarketplaceIntegrationService {
  constructor() {
    this.supabase = getSupabase()
  }

  /**
   * Create marketplace listing for approved project
   * @param {string} projectId - Project ID
   * @param {Object} listingData - Listing configuration
   * @returns {Promise<Object>} Created listing
   */
  async createProjectListing(projectId, listingData = {}) {
    if (!this.supabase) {
      throw new Error('Supabase client not available')
    }

    try {
      // Get project details including credit information
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .in('status', ['approved', 'validated'])
        .single()

      if (projectError || !project) {
        throw new Error('Project not found or not approved')
      }

      // First, ensure we have a project_credit record
      let projectCreditId = null

      // Check if project_credit exists
      const { data: existingProjectCredit, error: projectCreditError } = await this.supabase
        .from('project_credits')
        .select('id')
        .eq('project_id', projectId)
        .limit(1)
        .single()

      // Check if marketplace listing already exists for this project
      const { data: existingListing, error: listingCheckError } = await this.supabase
        .from('credit_listings')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (existingListing && !listingCheckError) {
        console.log('⚠️ Marketplace listing already exists for project:', project.title)
        return existingListing // Return existing listing instead of creating duplicate
      }

      // Additional check: if we have a project_credit_id, check for existing listings by that ID too
      if (projectCreditId) {
        const { data: existingByCreditId, error: creditIdCheckError } = await this.supabase
          .from('credit_listings')
          .select('id')
          .eq('project_credit_id', projectCreditId)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (existingByCreditId && !creditIdCheckError) {
          console.log(
            '⚠️ Marketplace listing already exists for project_credit_id:',
            projectCreditId,
          )
          return existingByCreditId // Return existing listing instead of creating duplicate
        }
      }

      if (projectCreditError || !existingProjectCredit) {
        // Create project_credit record if it doesn't exist
        // PRIORITY: Use project.estimated_credits (developer-set limit) - this is the MAXIMUM limit
        // Only use fallback if developer didn't set a limit
        if (!project.estimated_credits || project.estimated_credits <= 0) {
          console.warn('⚠️ No estimated_credits set by developer, using fallback')
        }
        const estimatedCredits = project.estimated_credits || listingData.quantity || 1000
        const creditPrice = project.credit_price || listingData.pricePerCredit || 15.0

        console.log('📊 Creating project_credits with developer-set limit:', {
          project_estimated_credits: project.estimated_credits,
          final_credits: estimatedCredits,
          respects_limit: project.estimated_credits ? estimatedCredits === project.estimated_credits : 'no limit set'
        })

        const { data: newProjectCredit, error: createProjectCreditError } = await this.supabase
          .from('project_credits')
          .insert({
            project_id: projectId,
            total_credits: estimatedCredits,
            credits_available: estimatedCredits,
            price_per_credit: creditPrice,
            currency: 'PHP',
            status: 'active',
            vintage_year: new Date().getFullYear(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (createProjectCreditError) {
          throw new Error(`Failed to create project_credit: ${createProjectCreditError.message}`)
        }

        projectCreditId = newProjectCredit.id
      } else {
        projectCreditId = existingProjectCredit.id
        // Update existing credits if developer set a limit that's different
        if (project.estimated_credits && project.estimated_credits > 0) {
          const { data: existingCredit } = await this.supabase
            .from('project_credits')
            .select('total_credits')
            .eq('id', projectCreditId)
            .single()
          
          if (existingCredit && existingCredit.total_credits > project.estimated_credits) {
            console.warn(`⚠️ Existing credits (${existingCredit.total_credits}) exceed developer limit (${project.estimated_credits}). Updating to respect limit.`)
            await this.supabase
              .from('project_credits')
              .update({
                total_credits: project.estimated_credits,
                credits_available: Math.min(existingCredit.total_credits - (existingCredit.total_credits - existingCredit.credits_available || 0), project.estimated_credits)
              })
              .eq('id', projectCreditId)
          }
        }
      }

      // Create credit listing with values that match the actual table structure
      // PRIORITY: project.credit_price (developer-set) > project_credits.price_per_credit > listingData
      // Always prioritize project.credit_price because it's the source of truth set by the developer
      let finalPrice = project.credit_price
      
      if (!finalPrice && existingProjectCredit && !projectCreditError) {
        // Get the full project_credits record to access price_per_credit as fallback
        const { data: fullProjectCredit } = await this.supabase
          .from('project_credits')
          .select('price_per_credit, total_credits')
          .eq('id', projectCreditId)
          .single()
        
        if (fullProjectCredit?.price_per_credit) {
          finalPrice = fullProjectCredit.price_per_credit
        }
      }
      
      // Final fallback to listingData or default
      const creditPrice = finalPrice || listingData.pricePerCredit || 15.0
      // CRITICAL: Use project.estimated_credits (developer-set limit) - this must not be exceeded
      const estimatedCredits = project.estimated_credits || listingData.quantity || 1000
      
      console.log('📊 Creating listing with developer-set limit:', {
        project_estimated_credits: project.estimated_credits,
        listing_quantity: estimatedCredits,
        respects_limit: project.estimated_credits ? estimatedCredits === project.estimated_credits : 'no limit set'
      })

      console.log('💰 Creating listing with price:', {
        project_credit_price: project.credit_price,
        final_price: creditPrice,
        source: project.credit_price ? 'project.credit_price' : 'fallback'
      })

      const defaultListing = {
        project_id: projectId,
        project_credit_id: projectCreditId, // This is required and NOT NULL
        seller_id: project.user_id,
        quantity: estimatedCredits, // Use project's estimated credits
        price_per_credit: creditPrice, // Use prioritized price (project.credit_price first!)
        currency: 'PHP',
        listing_type: 'sell',
        status: 'active',
        title: project.title ? `${project.title} - Carbon Credits` : 'Carbon Credits',
        description:
          project.description ||
          `Verified carbon credits from ${project.title || 'Project'} in ${project.location || 'Unknown Location'}`,
        category: project.category || 'Renewable Energy',
        location: project.location || 'Unknown Location',
        vintage_year: new Date().getFullYear(),
        verification_standard: 'Carbonify Standard',
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        listed_at: new Date().toISOString(),
      }

      // Insert into credit_listings table
      const { data: listing, error: listingError } = await this.supabase
        .from('credit_listings')
        .insert([defaultListing])
        .select()
        .single()

      if (listingError) {
        throw new Error(`Failed to create marketplace listing: ${listingError.message}`)
      }

      // Log the action
      await logUserAction(
        'MARKETPLACE_LISTING_CREATED',
        'credit_listing',
        project.user_id,
        listing.id,
        {
          project_id: projectId,
          project_title: project.title,
          price_per_credit: defaultListing.price_per_credit,
          quantity: defaultListing.available_quantity,
        },
      )

      console.log('✅ Marketplace listing created for project:', project.title)
      return listing
    } catch (error) {
      console.error('Error creating marketplace listing:', error)
      throw error
    }
  }

  /**
   * Update project status and create marketplace listing if approved
   * @param {string} projectId - Project ID
   * @param {string} status - New status
   * @param {string} verificationNotes - Verification notes
   * @param {Object} listingData - Optional listing configuration
   * @returns {Promise<Object>} Updated project and created listing (if approved)
   */
  async updateProjectStatusWithMarketplace(
    projectId,
    status,
    verificationNotes = '',
    listingData = {},
  ) {
    if (!this.supabase) {
      throw new Error('Supabase client not available')
    }

    try {
      // Get current user ID first
      const {
        data: { user },
      } = await this.supabase.auth.getUser()
      const currentUserId = user?.id

      // Update project status
      const { data: updatedProject, error: updateError } = await this.supabase
        .from('projects')
        .update({
          status,
          verification_notes: verificationNotes,
          verified_by: ['approved', 'validated', 'rejected'].includes(status) ? currentUserId : null,
          verified_at:
            ['approved', 'validated', 'rejected'].includes(status) ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Failed to update project status: ${updateError.message}`)
      }

      let marketplaceListing = null

      // If approved, create marketplace listing
      if (['approved', 'validated'].includes(status)) {
        try {
          marketplaceListing = await this.createProjectListing(projectId, listingData)
          console.log('✅ Project validated and marketplace listing created')
        } catch (listingError) {
          console.error('⚠️ Project validated but marketplace listing failed:', listingError)
          // Don't fail the entire operation if marketplace listing fails
        }
      }

      return {
        project: updatedProject,
        marketplaceListing,
      }
    } catch (error) {
      console.error('Error updating project status with marketplace:', error)
      throw error
    }
  }

  /**
   * Get marketplace listings for a specific project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Project listings
   */
  async getProjectListings(projectId) {
    if (!this.supabase) {
      throw new Error('Supabase client not available')
    }

    try {
      const { data: listings, error } = await this.supabase
        .from('credit_listings')
        .select('*')
        .eq('project_id', projectId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch project listings: ${error.message}`)
      }

      return listings || []
    } catch (error) {
      console.error('Error fetching project listings:', error)
      throw error
    }
  }
}

// Export singleton instance
export const marketplaceIntegrationService = new MarketplaceIntegrationService()
