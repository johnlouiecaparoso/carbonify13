/**
 * Verifier tooling — per-project validation checklist + SLA helpers.
 *
 * Checklist state lives in verification_assessments (verifier/admin-only via
 * RLS). The SLA threshold is an admin setting (verification_sla_days) used to
 * flag overdue submissions in the review queue.
 */
import { getSupabase } from '@/services/supabaseClient'
import { getCurrentUserId } from '@/utils/authHelper'

/** Load the checklist map for a project ({} if none yet). */
export async function getAssessment(projectId) {
  const supabase = getSupabase()
  if (!supabase || !projectId) return {}
  const { data, error } = await supabase
    .from('verification_assessments')
    .select('checklist')
    .eq('project_id', projectId)
    .maybeSingle()
  if (error || !data) return {}
  return data.checklist || {}
}

/** Upsert the checklist map for a project. Verifier/admin only (RLS). */
export async function saveAssessment(projectId, checklist) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  if (!projectId) throw new Error('Project is required')
  const updatedBy = await getCurrentUserId()
  const { error } = await supabase.from('verification_assessments').upsert(
    {
      project_id: projectId,
      checklist: checklist || {},
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id' },
  )
  if (error) {
    throw new Error(
      error.code === '42501' || /policy/i.test(error.message)
        ? 'Only verifiers can edit the validation checklist.'
        : error.message || 'Failed to save checklist',
    )
  }
  return true
}

/** Admin-configured SLA window in days (default 5). */
export async function getSlaDays() {
  try {
    const { getSetting } = await import('@/services/settingsService')
    return Number(await getSetting('verification_sla_days', 5)) || 5
  } catch {
    return 5
  }
}

/** Whole days a project has been waiting since submission. */
export function projectAgeDays(project, now = new Date()) {
  const created = project?.created_at ? new Date(project.created_at) : null
  if (!created || isNaN(created)) return 0
  return Math.floor((now.getTime() - created.getTime()) / 86400000)
}

/** True if an undecided project has exceeded the SLA window. */
export function isOverdue(project, slaDays, now = new Date()) {
  const open = ['submitted', 'pending', 'in_review'].includes(project?.status)
  return open && projectAgeDays(project, now) > Number(slaDays || 0)
}

// ── Queue assignment ────────────────────────────────────────────────────────

/**
 * Verifiers available to take a review ({ id, display_name }).
 *
 * Comes from the list_verifiers RPC rather than a profiles select: this repo
 * has no tracked SELECT policy on profiles, and a dropdown is not a good reason
 * to depend on one. Degrades to [] so the queue still renders.
 */
export async function listVerifiers() {
  const supabase = getSupabase()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_verifiers')
  if (error) {
    console.warn('[verification] verifier directory unavailable:', error.message)
    return []
  }
  return data || []
}

/**
 * Assign a project to a verifier, or clear the assignment with a null id.
 *
 * Assignment records who is expected to review, not who is permitted to —
 * every verifier can still open any project. See the migration header.
 */
export async function assignProject(projectId, verifierId) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase client not available')
  if (!projectId) throw new Error('Project is required')

  const { error } = await supabase
    .from('projects')
    .update({
      assigned_verifier_id: verifierId || null,
      assigned_at: verifierId ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)

  if (error) {
    throw new Error(
      error.code === '42501' || /policy/i.test(error.message)
        ? 'Only verifiers can assign reviews.'
        : error.message || 'Failed to assign this review',
    )
  }
  return true
}

/**
 * Free-text filter over the review queue.
 *
 * Matches title, category, location and project id so a verifier can paste an
 * id straight from a support thread. Pure — exported for unit testing.
 *
 * @param {Array<Object>} projects
 * @param {string} query
 * @returns {Array<Object>}
 */
export function searchProjects(projects = [], query = '') {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return projects || []
  return (projects || []).filter((p) => {
    const haystack = [p?.title, p?.category, p?.location, p?.id]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    // Every whitespace-separated term must appear somewhere, so "solar cebu"
    // narrows rather than widening the way an OR match would.
    return q.split(/\s+/).every((term) => haystack.includes(term))
  })
}
