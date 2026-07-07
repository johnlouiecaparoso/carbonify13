import { getSupabase } from '@/services/supabaseClient'

/**
 * Simple marketplace service that avoids complex joins
 * Uses the approach that works in debug service
 */
export async function getSimpleMarketplaceListings() {
  const supabase = getSupabase()

  if (!supabase) {
    if (import.meta.env.DEV) {
      console.warn('[DEV] Supabase client not initialized')
    }
    return []
  }

  try {
    if (import.meta.env.DEV) {
      console.log('[DEV] Using simple marketplace approach...')
    }

    // Step 1: Get credit listings (this works in debug)
    const { data: listings, error: listingsError } = await supabase
      .from('credit_listings')
      .select('*')
      .eq('status', 'active')

    if (listingsError) {
      console.error('[ERROR] Error fetching credit listings:', listingsError)
      throw listingsError
    }

    if (import.meta.env.DEV) {
      console.log('[DEV] Found', listings?.length || 0, 'credit listings')
    }

    if (!listings || listings.length === 0) {
      return []
    }

    // Step 2: Get project credits for these listings
    const listingIds = listings.map((l) => l.project_credit_id)
    const { data: credits, error: creditsError } = await supabase
      .from('project_credits')
      .select('*')
      .in('id', listingIds)

    if (creditsError) {
      console.error('[ERROR] Error fetching project credits:', creditsError)
      throw creditsError
    }

    if (import.meta.env.DEV) {
      console.log('[DEV] Found', credits?.length || 0, 'project credits')
    }

    // Step 3: Get projects for these credits
    const projectIds = credits?.map((c) => c.project_id).filter(Boolean) || []
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds)
      .in('status', ['approved', 'validated']) // Only approved / validated projects

    if (projectsError) {
      console.error('[ERROR] Error fetching projects:', projectsError)
      throw projectsError
    }

    if (import.meta.env.DEV) {
      console.log('[DEV] Found', projects?.length || 0, 'approved projects')
    }

    // Step 4: Get seller names
    const sellerIds = [...new Set(listings.map((l) => l.seller_id).filter(Boolean))]
    const { data: sellers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', sellerIds)

    const sellerMap = new Map(sellers?.map((seller) => [seller.id, seller.full_name]) || [])

    // Step 5: Combine the data
    const transformedListings = listings
      .map((listing) => {
        const credit = credits?.find((c) => c.id === listing.project_credit_id)
        const project = projects?.find((p) => p.id === credit?.project_id)

        if (!credit || !project) {
          return null // Skip if missing data
        }

        return {
          listing_id: listing.id,
          project_id: project.id,
          project_title: project.title,
          project_description: project.description,
          category: project.category,
          location: project.location,
          vintage_year: credit.vintage_year,
          verification_standard: credit.verification_standard,
          available_quantity: listing.quantity,
          price_per_credit: listing.price_per_credit,
          currency: listing.currency,
          seller_name: sellerMap.get(listing.seller_id) || 'Unknown Seller',
          listed_at: listing.created_at,
          project_image: project.project_image,
          image_name: project.image_name,
          image_type: project.image_type,
          estimated_credits: project.estimated_credits,
          credit_price: project.credit_price,
        }
      })
      .filter(Boolean) // Remove null entries

    if (import.meta.env.DEV) {
      console.log('[DEV] Transformed', transformedListings.length, 'listings for marketplace')
    }

    return transformedListings
  } catch (error) {
    console.error('[ERROR] Error in simple marketplace service:', error)
    return []
  }
}
