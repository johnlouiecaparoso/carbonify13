import { getSupabase } from '@/services/supabaseClient'

/**
 * KYB (Know Your Business) client service (Phase 2.5).
 * Sellers submit business verification; an admin reviews it
 * (review_kyb_application RPC), which sets profiles.kyb_verified — required
 * before withdrawals.
 */

/**
 * Submit (or re-submit) a business verification application.
 * @param {{
 *   businessName: string, businessType?: string, registrationNumber?: string,
 *   taxId?: string, businessAddress?: string, authorizedRepresentative?: string,
 *   registrationDocumentUrl?: string, taxDocumentUrl?: string
 * }} application
 */
export async function submitKyb(application = {}) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  if (!application.businessName?.trim()) {
    throw new Error('Business name is required')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('kyb_applications')
    .insert({
      user_id: user.id,
      business_name: application.businessName.trim(),
      business_type: application.businessType || null,
      registration_number: application.registrationNumber || null,
      tax_id: application.taxId || null,
      business_address: application.businessAddress || null,
      authorized_representative: application.authorizedRepresentative || null,
      registration_document_url: application.registrationDocumentUrl || null,
      tax_document_url: application.taxDocumentUrl || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message || 'Failed to submit KYB application')
  return data
}

/**
 * The caller's KYB status: { verified, application } where application is the
 * latest submission (or null).
 */
export async function getMyKyb() {
  const supabase = getSupabase()
  if (!supabase) return { verified: false, application: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { verified: false, application: null }

  const [{ data: profile }, { data: apps }] = await Promise.all([
    supabase.from('profiles').select('kyb_verified').eq('id', user.id).single(),
    supabase
      .from('kyb_applications')
      .select('id, business_name, status, review_notes, submitted_at, reviewed_at')
      .order('submitted_at', { ascending: false })
      .limit(1),
  ])

  return {
    verified: Boolean(profile?.kyb_verified),
    application: Array.isArray(apps) && apps.length ? apps[0] : null,
  }
}
