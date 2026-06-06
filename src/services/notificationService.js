import { getSupabase } from '@/services/supabaseClient'
import { TEST_ACCOUNTS } from '@/utils/testAccounts'

const NOTIFICATION_TABLE = 'system_notifications'

const ROLE_CANONICAL_MAP = Object.freeze({
  admin: 'admin',
  administrator: 'admin',
  super_admin: 'admin',
  superadmin: 'admin',
  verifier: 'verifier',
  verification: 'verifier',
  qa: 'verifier',
  project_developer: 'project_developer',
  projectdeveloper: 'project_developer',
  developer: 'project_developer',
  buyer_investor: 'buyer_investor',
  buyerinvestor: 'buyer_investor',
  investor: 'buyer_investor',
  general_user: 'general_user',
  generaluser: 'general_user',
  user: 'general_user',
})

function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toLowerCase() : ''
}

function canonicalizeRole(role) {
  const normalized = normalizeRole(role).replace(/[\s-]+/g, '_')
  if (!normalized) return ''
  return ROLE_CANONICAL_MAP[normalized] || normalized
}

function normalizeRoles(roles = []) {
  return Array.from(new Set((roles || []).map((role) => canonicalizeRole(role)).filter(Boolean)))
}

function normalizeIds(values = []) {
  return Array.from(new Set((values || []).filter(Boolean).map((value) => String(value))))
}

function isDevelopmentMode() {
  return import.meta.env.DEV || import.meta.env.MODE === 'development'
}

function canUseLocalNotificationFallback() {
  return isDevelopmentMode() && typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function getLocalNotificationStorageKey(userId) {
  return `ecolink-notifications:${String(userId || '').trim()}`
}

function readLocalNotifications(userId) {
  if (!canUseLocalNotificationFallback() || !userId) return []

  try {
    const raw = window.localStorage.getItem(getLocalNotificationStorageKey(userId))
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalNotifications(userId, notifications = []) {
  if (!canUseLocalNotificationFallback() || !userId) return []

  try {
    window.localStorage.setItem(
      getLocalNotificationStorageKey(userId),
      JSON.stringify(notifications),
    )
  } catch (error) {
    console.warn('Failed to persist local notifications:', error)
  }

  return notifications
}

function createLocalNotificationRecord(userId, payload = {}) {
  const now = new Date().toISOString()
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    user_id: String(userId),
    type: payload.type || 'system',
    title: payload.title?.trim() || '',
    message: payload.message?.trim() || '',
    link: payload.link || null,
    metadata: payload.metadata || {},
    is_read: false,
    created_at: now,
    read_at: null,
  }
}

function getLocalTestAccountIdsByRoles(roles = [], excludedUserIds = []) {
  const normalizedRoles = normalizeRoles(roles)
  if (!normalizedRoles.length) return []

  const excluded = new Set(normalizeIds(excludedUserIds))

  return normalizeIds(
    Object.values(TEST_ACCOUNTS)
      .filter((account) => normalizedRoles.includes(canonicalizeRole(account.role)))
      .map((account) => account.mockSession?.user?.id)
      .filter((id) => id && !excluded.has(String(id))),
  )
}

async function getAuthenticatedSupabaseUserId(supabase) {
  if (!supabase) return null

  try {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user?.id) return null
    return String(data.user.id)
  } catch {
    return null
  }
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('relation') ||
    error?.code === '42P01'
  )
}

function isMissingRpcFunctionError(error, functionName) {
  const message = String(error?.message || '').toLowerCase()
  const functionNamePattern = String(functionName || '').toLowerCase()

  return (
    error?.code === '42883' ||
    message.includes(`function public.${functionNamePattern}`) ||
    message.includes(`function ${functionNamePattern}`)
  )
}

async function getExistingNotificationRecipients(userIds = []) {
  const supabase = getSupabase()
  if (!supabase) return []

  const normalizedUserIds = normalizeIds(userIds)

  if (!normalizedUserIds.length) return []

  const { data, error } = await supabase.from('profiles').select('id').in('id', normalizedUserIds)

  if (error) {
    throw new Error(error.message || 'Failed to verify notification recipients')
  }

  return (data || []).map((record) => String(record.id))
}

async function resolveNotificationRecipients({ userIds = [], roles = [], excludeUserIds = [] } = {}) {
  const supabase = getSupabase()
  if (!supabase) return []

  const normalizedUserIds = normalizeIds(userIds)
  const normalizedRoles = normalizeRoles(roles)
  const normalizedExcludedUserIds = normalizeIds(excludeUserIds)

  if (!normalizedUserIds.length && !normalizedRoles.length) {
    return []
  }

  if (isDevelopmentMode()) {
    const localRoleRecipients = normalizedRoles.length
      ? getLocalTestAccountIdsByRoles(normalizedRoles, normalizedExcludedUserIds)
      : []

    const localRecipients = normalizeIds([...normalizedUserIds, ...localRoleRecipients]).filter(
      (id) => !normalizedExcludedUserIds.includes(id),
    )

    if (localRecipients.length) {
      return localRecipients
    }
  }

  const { data, error } = await supabase.rpc('resolve_notification_recipient_ids', {
    target_user_ids: normalizedUserIds.length ? normalizedUserIds : null,
    target_roles: normalizedRoles.length ? normalizedRoles : null,
    excluded_user_ids: normalizedExcludedUserIds.length ? normalizedExcludedUserIds : null,
  })

  if (!error) {
    return normalizeIds((data || []).map((record) => record.user_id ?? record.id ?? record.recipient_id))
  }

  if (!isMissingRpcFunctionError(error, 'resolve_notification_recipient_ids')) {
    console.warn('Notification recipient RPC failed, falling back to legacy profile lookup:', error)
  }

  const fallbackRecipientIds = []

  if (normalizedUserIds.length) {
    fallbackRecipientIds.push(...(await getExistingNotificationRecipients(normalizedUserIds)))
  }

  if (normalizedRoles.length) {
    fallbackRecipientIds.push(...(await getUserIdsByRoles(normalizedRoles, normalizedExcludedUserIds)))
  }

  return normalizeIds(fallbackRecipientIds).filter((id) => !normalizedExcludedUserIds.includes(id))
}

export async function getUserNotifications(userId, limit = 25) {
  const supabase = getSupabase()
  if (!userId) return []

  const localNotifications = canUseLocalNotificationFallback() ? readLocalNotifications(userId) : []

  if (!supabase) {
    return localNotifications.slice(0, limit)
  }

  try {
    const { data, error } = await supabase
      .from(NOTIFICATION_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isMissingTableError(error)) {
        console.warn('Notifications table not found. Apply latest migration to enable in-app notifications.')
        return localNotifications.slice(0, limit)
      }
      if (canUseLocalNotificationFallback()) {
        return localNotifications.slice(0, limit)
      }
      throw new Error(error.message || 'Failed to fetch notifications')
    }

    const remoteNotifications = data || []
    if (canUseLocalNotificationFallback() && localNotifications.length) {
      const merged = [...remoteNotifications, ...localNotifications].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )

      const seen = new Set()
      const deduped = merged.filter((notification) => {
        const key = notification.id || `${notification.user_id}:${notification.created_at}:${notification.title}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      return deduped.slice(0, limit)
    }

    return remoteNotifications
  } catch (error) {
    if (canUseLocalNotificationFallback()) {
      return localNotifications.slice(0, limit)
    }
    throw error
  }
}

export async function markNotificationAsRead(notificationId, userId) {
  const supabase = getSupabase()
  if (!notificationId || !userId) return

  if (canUseLocalNotificationFallback()) {
    const notifications = readLocalNotifications(userId).map((notification) =>
      String(notification.id) === String(notificationId)
        ? { ...notification, is_read: true, read_at: notification.read_at || new Date().toISOString() }
        : notification,
    )
    writeLocalNotifications(userId, notifications)
  }

  if (!supabase) return

  const { error } = await supabase
    .from(NOTIFICATION_TABLE)
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message || 'Failed to mark notification as read')
  }
}

export async function markAllNotificationsAsRead(userId) {
  const supabase = getSupabase()
  if (!userId) return

  if (canUseLocalNotificationFallback()) {
    const notifications = readLocalNotifications(userId).map((notification) => ({
      ...notification,
      is_read: true,
      read_at: notification.read_at || new Date().toISOString(),
    }))
    writeLocalNotifications(userId, notifications)
  }

  if (!supabase) return

  const { error } = await supabase
    .from(NOTIFICATION_TABLE)
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error && !isMissingTableError(error)) {
    throw new Error(error.message || 'Failed to mark notifications as read')
  }
}

async function getUserIdsByRoles(roles = [], excludedUserIds = []) {
  const supabase = getSupabase()
  if (!supabase) return []

  const normalizedRoles = normalizeRoles(roles)
  if (!normalizedRoles.length) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .not('role', 'is', null)

  if (error) {
    throw new Error(error.message || 'Failed to resolve notification recipients')
  }

  const excluded = new Set((excludedUserIds || []).map((id) => String(id)))
  const targetRoles = new Set(normalizedRoles)

  return (data || [])
    .filter((record) => targetRoles.has(canonicalizeRole(record.role)))
    .map((record) => record.id)
    .filter((id) => id && !excluded.has(String(id)))
}

export async function createNotificationsForUsers(userIds = [], payload = {}) {
  const supabase = getSupabase()
  const recipients = normalizeIds(userIds)
  if (!recipients.length) return []

  const title = payload.title?.trim()
  const message = payload.message?.trim()
  if (!title || !message) return []

  const authenticatedUserId = await getAuthenticatedSupabaseUserId(supabase)
  if (!supabase || !authenticatedUserId) {
    const localNotifications = canUseLocalNotificationFallback()
      ? recipients.flatMap((userId) => {
          const existing = readLocalNotifications(userId)
          const next = [...existing, createLocalNotificationRecord(userId, payload)]
          writeLocalNotifications(userId, next)
          return next
        })
      : []

    return localNotifications
  }

  const resolvedRecipients = await resolveNotificationRecipients({ userIds })
  if (!resolvedRecipients.length) {
    return []
  }

  const rows = resolvedRecipients.map((userId) => ({
    user_id: userId,
    type: payload.type || 'system',
    title,
    message,
    link: payload.link || null,
    metadata: payload.metadata || {},
    is_read: false,
  }))

  const { data, error } = await supabase.from(NOTIFICATION_TABLE).insert(rows).select('id')

  if (error) {
    if (isMissingTableError(error)) {
      console.warn('Notifications table not found. Apply latest migration to enable in-app notifications.')
      return canUseLocalNotificationFallback()
        ? recipients.flatMap((userId) => {
            const existing = readLocalNotifications(userId)
            const next = [...existing, createLocalNotificationRecord(userId, payload)]
            writeLocalNotifications(userId, next)
            return next
          })
        : []
    }
    if (canUseLocalNotificationFallback()) {
      return recipients.flatMap((userId) => {
        const existing = readLocalNotifications(userId)
        const next = [...existing, createLocalNotificationRecord(userId, payload)]
        writeLocalNotifications(userId, next)
        return next
      })
    }
    throw new Error(error.message || 'Failed to create notifications')
  }

  return data || []
}

export async function createNotificationsForRoles(roles = [], payload = {}, options = {}) {
  const recipients = await resolveNotificationRecipients({ roles, excludeUserIds: options.excludeUserIds || [] })

  if (!recipients.length) return []

  return createNotificationsForUsers(recipients, payload)
}

export async function notifyProjectSubmittedForReview(project) {
  if (!project?.id) return

  await createNotificationsForRoles(
    ['verifier'],
    {
      type: 'project_submission',
      title: 'New project submitted for verification',
      message: `Project "${project.title || 'Untitled Project'}" is waiting for review.`,
      link: '/verifier',
      metadata: {
        project_id: project.id,
        status: project.status || 'pending',
      },
    },
    {
      excludeUserIds: [project.user_id],
    },
  )
}

export async function notifyProjectDecision(project, status, notes = '') {
  if (!project?.id || !project?.user_id) return

  const normalizedStatus = normalizeRole(status)
  const canonicalStatus = normalizedStatus === 'approved' ? 'validated' : normalizedStatus
  if (!['validated', 'needs_revision', 'rejected'].includes(canonicalStatus)) return

  await notifyProjectSubmitterDecision(project, canonicalStatus, notes)

  await createNotificationsForRoles(['admin'], {
    type: 'project_status_admin',
    title: `Project ${canonicalStatus}`,
    message: `Project "${project.title || 'Untitled Project'}" was ${canonicalStatus}.`,
    link: '/admin',
    metadata: {
      project_id: project.id,
      status: canonicalStatus,
    },
  })

  await createNotificationsForRoles(
    ['admin', 'verifier'],
    {
      type: 'project_review_activity',
      title: `Project ${canonicalStatus}`,
      message: `A reviewer marked "${project.title || 'Untitled Project'}" as ${canonicalStatus}.`,
      link: '/verifier',
      metadata: {
        project_id: project.id,
        status: canonicalStatus,
        reviewer_id: project.verified_by || null,
      },
    },
    {
      excludeUserIds: [project.user_id, project.verified_by].filter(Boolean),
    },
  )
}

export async function notifyProjectSubmitterDecision(project, status, notes = '') {
  if (!project?.id || !project?.user_id) return

  const normalizedStatus = normalizeRole(status)
  const canonicalStatus = normalizedStatus === 'approved' ? 'validated' : normalizedStatus
  if (!['validated', 'needs_revision', 'rejected'].includes(canonicalStatus)) return

  const isValidated = canonicalStatus === 'validated'
  const title = isValidated
    ? 'Your project was validated'
    : canonicalStatus === 'needs_revision'
      ? 'Project requires revisions'
      : 'Your project was rejected'
  const noteSuffix = notes?.trim() ? ` Notes: ${notes.trim()}` : ''

  await createNotificationsForUsers([project.user_id], {
    type: 'project_status',
    title,
    message:
      canonicalStatus === 'validated'
        ? `Project "${project.title || 'Untitled Project'}" was validated and moved to the active pool.${noteSuffix}`
        : canonicalStatus === 'needs_revision'
          ? `Project "${project.title || 'Untitled Project'}" needs revisions before validation.${noteSuffix}`
          : `Project "${project.title || 'Untitled Project'}" was rejected.${noteSuffix}`,
    link: '/developer/projects',
    metadata: {
      project_id: project.id,
      status: canonicalStatus,
    },
  })
}

export async function notifyProjectOwnerMarketplaceLive(project, listing) {
  if (!project?.id || !project?.user_id) return

  await createNotificationsForUsers([project.user_id], {
    type: 'project_marketplace_live',
    title: 'Your project is now live in the marketplace',
    message: `Project "${project.title || 'Untitled Project'}" now has an active marketplace listing.`,
    link: '/developer/projects',
    metadata: {
      project_id: project.id,
      listing_id: listing?.id || null,
    },
  })
}

export async function notifyNewMarketplaceProject(project, listing) {
  if (!project?.id) return

  await createNotificationsForRoles(
    ['general_user', 'buyer_investor', 'project_developer', 'admin'],
    {
      type: 'marketplace_new_project',
      title: 'New project available in marketplace',
      message: `"${project.title || 'Untitled Project'}" is now available for purchase.`,
      link: '/marketplace',
      metadata: {
        project_id: project.id,
        listing_id: listing?.id || null,
      },
    },
    {
      excludeUserIds: [project.user_id],
    },
  )
}

export async function notifyMarketplacePurchaseAndStock(project, options = {}) {
  if (!project?.id) return

  const remainingCredits = Number(options.remainingCredits)
  const isSoldOut = Number.isFinite(remainingCredits) && remainingCredits <= 0
  const projectTitle = project.title || 'Untitled Project'

  const title = isSoldOut
    ? 'Marketplace update: project sold out'
    : 'Marketplace update: project was purchased'
  const message = isSoldOut
    ? `"${projectTitle}" has just been bought out and now has no stocks left.`
    : `"${projectTitle}" was purchased in the marketplace.`

  return createNotificationsForRoles(
    ['general_user', 'buyer_investor'],
    {
      type: isSoldOut ? 'marketplace_project_sold_out' : 'marketplace_project_purchased',
      title,
      message,
      link: '/marketplace',
      metadata: {
        project_id: project.id,
        project_credit_id: options.projectCreditId || null,
        listing_id: options.listingId || null,
        buyer_id: options.buyerId || null,
        remaining_credits: Number.isFinite(remainingCredits) ? remainingCredits : null,
      },
    },
    {
      excludeUserIds: [options.buyerId, options.sellerId].filter(Boolean),
    },
  )
}

export async function notifyRoleApplicationDecision(application, status) {
  if (!application?.user_id) return []

  const normalizedStatus = normalizeRole(status)
  if (!['approved', 'rejected'].includes(normalizedStatus)) return []

  const isApproved = normalizedStatus === 'approved'
  const roleLabel =
    normalizeRole(application.role_requested) === 'verifier' ? 'Verifier' : 'Project Developer'

  return createNotificationsForUsers([application.user_id], {
    type: 'role_application_status',
    title: isApproved ? 'Your specialist account was approved' : 'Your specialist account was rejected',
    message: isApproved
      ? `Your ${roleLabel} application has been approved. You can now use your verified account features.`
      : `Your ${roleLabel} application was rejected. Please check your email or contact EcoLink support for next steps.`,
    link: '/profile',
    metadata: {
      application_id: application.id,
      requested_role: application.role_requested,
      status: normalizedStatus,
    },
  })
}

export async function notifyReviewersOfRoleApplicationInApp(application) {
  if (!application) return []

  const normalizedRequestedRole = normalizeRole(application.role_requested)
  if (!['verifier', 'project_developer'].includes(normalizedRequestedRole)) return []

  const reviewerRoles = normalizedRequestedRole === 'verifier' ? ['admin'] : ['verifier']

  const roleLabel = normalizedRequestedRole === 'verifier' ? 'Verifier' : 'Project Developer'

  return createNotificationsForRoles(reviewerRoles, {
    type: 'role_application_submission',
    title: `New ${roleLabel} application`,
    message: `${application.applicant_full_name || application.email || 'A new applicant'} submitted a ${roleLabel} application for review.`,
    link: normalizedRequestedRole === 'verifier' ? '/admin' : '/verifier',
    metadata: {
      application_id: application.id || null,
      requested_role: application.role_requested,
      applicant_email: application.email || null,
    },
  })
}

export async function notifyWelcomeUser(userId, fullName = '') {
  if (!userId) return []

  return createNotificationsForUsers([userId], {
    type: 'welcome',
    title: 'Welcome to EcoLink',
    message: fullName
      ? `Welcome to EcoLink, ${fullName}. Your account is ready to use.`
      : 'Welcome to EcoLink. Your account is ready to use.',
    link: '/home',
    metadata: {
      category: 'welcome',
    },
  })
}
