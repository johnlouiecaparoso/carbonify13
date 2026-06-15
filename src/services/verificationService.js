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
