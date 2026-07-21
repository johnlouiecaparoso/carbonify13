import { getSupabase } from '@/services/supabaseClient'
import { USE_DATABASE } from '@/config/database'

async function attachAuditLogUsers(supabase, logs = []) {
  const normalizedLogs = Array.isArray(logs) ? logs : []
  const userIds = [...new Set(normalizedLogs.map((log) => log.user_id).filter(Boolean))]

  if (!userIds.length) {
    return normalizedLogs.map((log) => ({
      ...log,
      user_name: 'Unknown User',
      user_role: 'unknown',
    }))
  }

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', userIds)

    if (error) {
      console.error('Error fetching audit log user profiles:', error)
      return normalizedLogs.map((log) => ({
        ...log,
        user_name: 'Unknown User',
        user_role: 'unknown',
      }))
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]))

    return normalizedLogs.map((log) => {
      const profile = profileMap.get(log.user_id)
      return {
        ...log,
        user_name: profile?.full_name || 'Unknown User',
        user_role: profile?.role || 'unknown',
      }
    })
  } catch (error) {
    console.error('Error attaching audit log user profiles:', error)
    return normalizedLogs.map((log) => ({
      ...log,
      user_name: 'Unknown User',
      user_role: 'unknown',
    }))
  }
}

/**
 * Log user actions for audit trail
 */
export async function logUserAction(action, entityType, userId, entityId, metadata = {}) {
  // Skip audit logging if database is disabled
  if (!USE_DATABASE) {
    console.log('Database disabled, skipping audit log:', { action, entityType, userId })
    return null
  }

  // Skip audit logging if no user ID
  if (!userId) {
    console.warn('Skipping audit log - no user ID provided')
    return null
  }

  const supabase = getSupabase()

  try {
    const { data, error } = await supabase.from('audit_logs').insert({
      action: action,
      resource_type: entityType,
      user_id: userId,
      resource_id: entityId,
      metadata: metadata,
      created_at: new Date().toISOString(),
      ip_address: getClientIP(), // Would get from request in real implementation
      user_agent: getUserAgent(), // Would get from request in real implementation
    })

    if (error) {
      console.error('Error logging user action:', error)
      // Don't throw error for audit logging failures
    }

    return data
  } catch (error) {
    console.error('Error in logUserAction:', error)
    // Don't throw error for audit logging failures
  }
}

/**
 * Log system events
 */
export async function logSystemEvent(event, entityType, entityId, metadata = {}) {
  const supabase = getSupabase()

  try {
    const { data, error } = await supabase.from('audit_logs').insert({
      action: event,
      resource_type: entityType,
      user_id: null, // System event, no user
      resource_id: entityId,
      metadata: metadata,
      created_at: new Date().toISOString(),
      ip_address: 'system',
      user_agent: 'system',
    })

    if (error) {
      console.error('Error logging system event:', error)
    }

    return data
  } catch (error) {
    console.error('Error in logSystemEvent:', error)
  }
}

/**
 * Get audit logs for a specific entity
 */
export async function getAuditLogs(entityType, entityId, limit = 50) {
  const supabase = getSupabase()

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select(
        `
        *,
        profiles!audit_logs_user_id_fkey(full_name, email)
      `,
      )
      .eq('resource_type', entityType)
      .eq('resource_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching audit logs:', error)
      throw new Error('Failed to fetch audit logs')
    }

    return data || []
  } catch (error) {
    console.error('Error in getAuditLogs:', error)
    throw error
  }
}

/**
 * Get user activity logs
 */
export async function getUserActivityLogs(userId, limit = 100) {
  const supabase = getSupabase()

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching user activity logs:', error)
      throw new Error('Failed to fetch user activity logs')
    }

    return data || []
  } catch (error) {
    console.error('Error in getUserActivityLogs:', error)
    throw error
  }
}

/**
 * Get system-wide audit logs (admin only)
 */
export async function getSystemAuditLogs(filters = {}, limit = 100) {
  const supabase = getSupabase()

  try {
    let query = supabase
      .from('audit_logs')
      .select(
        `
        *,
        profiles!audit_logs_user_id_fkey(full_name, email)
      `,
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply filters
    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.entityType) {
      query = query.eq('resource_type', filters.entityType)
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching system audit logs:', error)
      throw new Error('Failed to fetch system audit logs')
    }

    return data || []
  } catch (error) {
    console.error('Error in getSystemAuditLogs:', error)
    throw error
  }
}

/**
 * Get client IP address (placeholder)
 */
function getClientIP() {
  // In a real implementation, this would extract IP from request headers
  return '127.0.0.1'
}

/**
 * Get user agent (placeholder)
 */
function getUserAgent() {
  // In a real implementation, this would extract from request headers
  return typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
}

/**
 * Search audit logs with filters
 */
export async function searchAuditLogs(filters = {}, limit = 100) {
  // Skip if database is disabled
  if (!USE_DATABASE) {
    console.log('Database disabled, returning empty audit logs')
    return []
  }

  const supabase = getSupabase()

  try {
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit)

    // Apply filters
    if (filters.action) {
      query = query.eq('action', filters.action)
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType)
    }

    if (filters.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString())
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error('Error searching audit logs:', error)
      return []
    }

    const enrichedLogs = await attachAuditLogUsers(supabase, data || [])

    return enrichedLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resource_type: log.resource_type || log.entity_type,
      resource_id: log.resource_id || log.entity_id,
      user_id: log.user_id,
      user_name: log.user_name || 'Unknown User',
      user_role: log.user_role || 'unknown',
      ip_address: log.ip_address,
      metadata: log.metadata,
      created_at: log.created_at || log.timestamp,
    }))
  } catch (error) {
    console.error('Error in searchAuditLogs:', error)
    return []
  }
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(userId = null) {
  // Skip if database is disabled
  if (!USE_DATABASE) {
    console.log('Database disabled, returning empty activity summary')
    return {
      total_actions: 0,
      actions_24h: 0,
      actions_7d: 0,
      last_activity: null,
    }
  }

  const supabase = getSupabase()

  try {
    // Get total actions count
    let totalQuery = supabase.from('audit_logs').select('id', { count: 'exact', head: true })

    if (userId) {
      totalQuery = totalQuery.eq('user_id', userId)
    }

    const { count: totalActions } = await totalQuery

    // Get actions in last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    let actions24hQuery = supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString())

    if (userId) {
      actions24hQuery = actions24hQuery.eq('user_id', userId)
    }

    const { count: actions24h } = await actions24hQuery

    // Get actions in last 7 days
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)

    let actions7dQuery = supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', lastWeek.toISOString())

    if (userId) {
      actions7dQuery = actions7dQuery.eq('user_id', userId)
    }

    const { count: actions7d } = await actions7dQuery

    // Get last activity
    let lastActivityQuery = supabase
      .from('audit_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    if (userId) {
      lastActivityQuery = lastActivityQuery.eq('user_id', userId)
    }

    const { data: lastActivityData } = await lastActivityQuery

    return {
      total_actions: totalActions || 0,
      actions_24h: actions24h || 0,
      actions_7d: actions7d || 0,
      last_activity: lastActivityData?.[0]?.created_at || null,
    }
  } catch (error) {
    console.error('Error in getUserActivitySummary:', error)
    return {
      total_actions: 0,
      actions_24h: 0,
      actions_7d: 0,
      last_activity: null,
    }
  }
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(limit = 50) {
  // Skip if database is disabled
  if (!USE_DATABASE) {
    console.log('Database disabled, returning empty recent audit logs')
    return []
  }

  const supabase = getSupabase()

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent audit logs:', error)
      return []
    }

    const enrichedLogs = await attachAuditLogUsers(supabase, data || [])

    return enrichedLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resource_type: log.resource_type || log.entity_type,
      resource_id: log.resource_id || log.entity_id,
      user_id: log.user_id,
      user_name: log.user_name || 'Unknown User',
      user_role: log.user_role || 'unknown',
      ip_address: log.ip_address,
      metadata: log.metadata,
      created_at: log.created_at || log.timestamp,
    }))
  } catch (error) {
    console.error('Error in getRecentAuditLogs:', error)
    return []
  }
}
