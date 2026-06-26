// Public carbon registry service — searchable, anonymous-accessible list of
// active certificates (issued/retired credits). Backed by SECURITY DEFINER RPCs
// (migration 20260626000900) that expose only safe, non-PII fields and are
// granted to anon, so the registry works without logging in.

import { getSupabase } from '@/services/supabaseClient'

const PAGE_SIZE = 25

/** Search the public registry. Returns { rows, pageSize }. */
export async function searchRegistry({ search = '', category = '', page = 0 } = {}) {
  const supabase = getSupabase()
  if (!supabase) return { rows: [], pageSize: PAGE_SIZE }

  const { data, error } = await supabase.rpc('search_public_registry', {
    p_search: search || null,
    p_category: category || null,
    p_limit: PAGE_SIZE,
    p_offset: Math.max(0, page) * PAGE_SIZE,
  })
  if (error) {
    console.warn('[registry] search failed:', error.message)
    throw new Error(error.message || 'Failed to search the registry.')
  }
  return { rows: data || [], pageSize: PAGE_SIZE }
}

/** Headline totals for the registry header. */
export async function getRegistryStats() {
  const supabase = getSupabase()
  if (!supabase) return { certificate_count: 0, total_credits: 0, project_count: 0 }

  const { data, error } = await supabase.rpc('public_registry_stats')
  if (error) {
    console.warn('[registry] stats failed:', error.message)
    return { certificate_count: 0, total_credits: 0, project_count: 0 }
  }
  return {
    certificate_count: Number(data?.certificate_count) || 0,
    total_credits: Number(data?.total_credits) || 0,
    project_count: Number(data?.project_count) || 0,
  }
}
