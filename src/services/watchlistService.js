/**
 * Buyer watchlist — save/follow marketplace listings.
 *
 * Keyed on the marketplace listing id (the `listing_id` field returned by
 * marketplaceService.getMarketplaceListings). RLS scopes every row to its
 * owner, so these calls never need to pass a user id for reads.
 */
import { getSupabase } from '@/services/supabaseClient'
import { getCurrentUserId } from '@/utils/authHelper'

/** Full watchlist rows for the current user (newest first). */
export async function getMyWatchlist() {
  const supabase = getSupabase()
  if (!supabase) return []
  const uid = await getCurrentUserId()
  if (!uid) return []
  const { data, error } = await supabase
    .from('watchlist')
    .select('id, listing_id, project_id, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('Failed to load watchlist:', error.message)
    return []
  }
  return data || []
}

/** Set of watched listing ids — handy for marking cards in a list view. */
export async function getMyWatchlistIds() {
  const rows = await getMyWatchlist()
  return new Set(rows.map((r) => r.listing_id))
}

/** Add a listing to the watchlist (idempotent on the unique constraint). */
export async function addToWatchlist({ listingId, projectId = null }) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  if (!listingId) throw new Error('listingId is required')
  const uid = await getCurrentUserId()
  if (!uid) throw new Error('You must be signed in to save listings.')

  const { error } = await supabase
    .from('watchlist')
    .upsert(
      { user_id: uid, listing_id: listingId, project_id: projectId },
      { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
    )
  if (error) throw new Error(error.message || 'Failed to save to watchlist')
  return true
}

/** Remove a listing from the watchlist. */
export async function removeFromWatchlist(listingId) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  const uid = await getCurrentUserId()
  if (!uid) return true
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', uid)
    .eq('listing_id', listingId)
  if (error) throw new Error(error.message || 'Failed to remove from watchlist')
  return true
}
