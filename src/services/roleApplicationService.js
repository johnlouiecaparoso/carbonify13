import { getSupabase, getSupabaseAsync } from '@/services/supabaseClient'
import { updateUserRole } from '@/services/roleService'
import { sendRoleApplicationApprovalEmail } from '@/services/emailService'
import { sendRoleApplicationRejectionEmail } from '@/services/emailService'
import { notifyVerifiersOfRoleApplication } from '@/services/emailService'
import { notifyRoleApplicationDecision } from '@/services/notificationService'
import { ROLES } from '@/constants/roles'

export const ROLE_APPLICATION_TABLE = 'role_applications'

export const ROLE_APPLICATION_ROLES = Object.freeze({
  PROJECT_DEVELOPER: 'project_developer',
  VERIFIER: 'verifier',
  FARMER: 'farmer',
})

export const ROLE_APPLICATION_STATUS = Object.freeze({
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
})

export const ROLE_APPLICATION_STATUS_LABELS = Object.freeze({
  [ROLE_APPLICATION_STATUS.PENDING]: 'Pending',
  [ROLE_APPLICATION_STATUS.UNDER_REVIEW]: 'Under Review',
  [ROLE_APPLICATION_STATUS.APPROVED]: 'Approved',
  [ROLE_APPLICATION_STATUS.REJECTED]: 'Rejected',
  [ROLE_APPLICATION_STATUS.CANCELLED]: 'Cancelled',
})

export const ROLE_APPLICATION_ERRORS = Object.freeze({
  SUPABASE_NOT_INITIALIZED: 'SUPABASE_NOT_INITIALIZED',
  INVALID_ROLE: 'INVALID_ROLE_SELECTION',
  DUPLICATE_PENDING: 'ROLE_APPLICATION_ALREADY_EXISTS',
  UNAUTHORIZED_REVIEW: 'UNAUTHORIZED_REVIEW_ACTION',
})

const ROLE_ALIASES = {
  project_developer: ROLE_APPLICATION_ROLES.PROJECT_DEVELOPER,
  'project-developer': ROLE_APPLICATION_ROLES.PROJECT_DEVELOPER,
  developer: ROLE_APPLICATION_ROLES.PROJECT_DEVELOPER,
  builders: ROLE_APPLICATION_ROLES.PROJECT_DEVELOPER,
  verifier: ROLE_APPLICATION_ROLES.VERIFIER,
  verification: ROLE_APPLICATION_ROLES.VERIFIER,
  qa: ROLE_APPLICATION_ROLES.VERIFIER,
  farmer: ROLE_APPLICATION_ROLES.FARMER,
  farmers: ROLE_APPLICATION_ROLES.FARMER,
  grower: ROLE_APPLICATION_ROLES.FARMER,
  smallholder: ROLE_APPLICATION_ROLES.FARMER,
}

function sanitizeString(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed.length ? trimmed : null
}

const VALID_STATUSES = new Set(Object.values(ROLE_APPLICATION_STATUS))

export function normalizeRequestedRole(role) {
  if (!role) return null
  const key = String(role).toLowerCase().replace(/\s+/g, '_')
  return ROLE_ALIASES[key] || null
}

async function ensureSupabase() {
  let supabase = getSupabase()
  if (!supabase) {
    supabase = await getSupabaseAsync()
  }
  if (!supabase) {
    const error = new Error('Supabase client not initialized')
    error.code = ROLE_APPLICATION_ERRORS.SUPABASE_NOT_INITIALIZED
    throw error
  }
  return supabase
}

function canReviewApplicationRole(actorRole, requestedRole) {
  if (requestedRole === ROLE_APPLICATION_ROLES.VERIFIER) {
    return actorRole === ROLES.ADMIN
  }

  if (requestedRole === ROLE_APPLICATION_ROLES.PROJECT_DEVELOPER) {
    return actorRole === ROLES.VERIFIER || actorRole === ROLES.ADMIN
  }

  // Farmer applications are admin-only: `assign_user_role` restricts verifiers to
  // assigning project_developer, so a verifier approval here would fail server-side.
  if (requestedRole === ROLE_APPLICATION_ROLES.FARMER) {
    return actorRole === ROLES.ADMIN
  }

  return false
}

async function getCurrentReviewerContext(supabase) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user?.id) {
    const error = new Error('You must be signed in to review applications.')
    error.code = ROLE_APPLICATION_ERRORS.UNAUTHORIZED_REVIEW
    throw error
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.role) {
    const error = new Error('Unable to verify your reviewer permissions.')
    error.code = ROLE_APPLICATION_ERRORS.UNAUTHORIZED_REVIEW
    throw error
  }

  return {
    reviewerId: user.id,
    reviewerRole: String(profile.role).toLowerCase().trim(),
  }
}

async function resolveApplicationEmail(supabase, application) {
  const directEmail = sanitizeString(application?.email)?.toLowerCase()
  if (directEmail) return directEmail

  const linkedUserId = sanitizeString(application?.user_id)
  if (!linkedUserId) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', linkedUserId)
    .single()

  if (error) {
    console.warn('Unable to load fallback applicant email from profile:', error)
    return null
  }

  return sanitizeString(profile?.email)?.toLowerCase() || null
}

/**
 * Submit a role application request.
 * @param {Object} application
 * @param {string} application.role - Requested role (project_developer | verifier)
 * @param {string} application.fullName - Applicant full name
 * @param {string} application.email - Applicant contact email
 * @param {string} [application.password] - Password to create applicant auth account when not signed in
 * @param {string} [application.company] - Optional company or organization
 * @param {string} [application.website] - Optional website or portfolio link
 * @param {string} [application.experience] - Summary of relevant experience
 * @param {string} [application.motivation] - Motivation statement
 * @param {string} [application.supportingDocuments] - Any supporting links
 * @param {string} [application.userId] - Authenticated user ID
 * @param {Object} [application.metadata] - Additional metadata to store (JSON)
 * @returns {Promise<Object>} Inserted role application record
 */
export async function submitRoleApplication(application) {
  const supabase = await ensureSupabase()
  let createdAuthSessionDuringApply = false

  const normalizedRole = normalizeRequestedRole(application.role)
  if (!normalizedRole) {
    const error = new Error('Please choose a valid role to apply for.')
    error.code = ROLE_APPLICATION_ERRORS.INVALID_ROLE
    throw error
  }

  const fullName = sanitizeString(application.fullName)
  if (!fullName) {
    throw new Error('Full name is required.')
  }

  const email = sanitizeString(application.email)?.toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid contact email address.')
  }

  const company = sanitizeString(application.company)
  const website = sanitizeString(application.website)
  const experience = sanitizeString(application.experience)
  const motivation = sanitizeString(application.motivation)
  const supportingDocuments = sanitizeString(application.supportingDocuments)

  const submittedFromPath =
    application.metadata?.submitted_from_path ||
    (typeof window !== 'undefined' ? window.location.pathname : null)

  const userAgent =
    application.metadata?.user_agent ||
    (typeof window !== 'undefined' ? window.navigator.userAgent : null)

  const metadata = {
    source: application.metadata?.source || 'web_form',
    submitted_from_path: submittedFromPath,
    user_agent: userAgent,
    additional: application.metadata?.additional || null,
  }

  let normalizedUserId = sanitizeString(application.userId)

  if (!normalizedUserId && application.password) {
    const password = String(application.password)
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters.')
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (signUpError) {
      const signUpMessage = String(signUpError.message || '')
      const accountAlreadyExists =
        /already registered|already exists|user already registered/i.test(signUpMessage)

      if (accountAlreadyExists) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError || !signInData?.user?.id) {
          throw new Error(
            'This email already has an Carbonify account. Please log in first, or use the correct password for that account before applying.',
          )
        }

        normalizedUserId = sanitizeString(signInData.user.id)
        createdAuthSessionDuringApply = Boolean(signInData?.session)
      } else {
        throw new Error(signUpError.message || 'Unable to create applicant account. Please try again.')
      }
    }

    if (!normalizedUserId) {
      normalizedUserId = sanitizeString(signUpData?.user?.id)
      createdAuthSessionDuringApply = Boolean(signUpData?.session)
    }
  }

  const record = {
    user_id: normalizedUserId,
    applicant_full_name: fullName,
    email,
    company,
    website,
    role_requested: normalizedRole,
    experience_summary: experience,
    motivation,
    supporting_documents: supportingDocuments,
    metadata,
    status: ROLE_APPLICATION_STATUS.PENDING,
  }

  let data
  let error

  if (normalizedUserId) {
    ;({ data, error } = await supabase
      .from(ROLE_APPLICATION_TABLE)
      .insert([record])
      .select()
      .single())
  } else {
    ;({ data, error } = await supabase
      .from(ROLE_APPLICATION_TABLE)
      .insert([record], { returning: 'minimal' }))
  }

  if (error) {
    if (createdAuthSessionDuringApply) {
      await supabase.auth.signOut().catch((signOutError) => {
        console.warn('Failed to clear temporary application signup session:', signOutError)
      })
    }

    if (error.code === '23505') {
      const duplicateError = new Error(
        'You already have a pending application for this role. Our team will review it shortly.',
      )
      duplicateError.code = ROLE_APPLICATION_ERRORS.DUPLICATE_PENDING
      throw duplicateError
    }

    throw new Error(error.message || 'Failed to submit role application. Please try again.')
  }

  if (createdAuthSessionDuringApply) {
    await supabase.auth.signOut().catch((signOutError) => {
      console.warn('Failed to clear temporary application signup session:', signOutError)
    })
  }

  const notificationApplication = data || {
    ...record,
    id: null,
  }

  Promise.resolve().then(async () => {
    try {
      await notifyVerifiersOfRoleApplication(notificationApplication)
    } catch (notifyError) {
      console.warn('Failed to notify verifiers/admin about role application:', notifyError)
    }

  })

  if (data) {
    return data
  }

  return notificationApplication
}

export function getRoleApplicationStatusLabel(status) {
  return ROLE_APPLICATION_STATUS_LABELS[status] || 'Unknown'
}

export async function getBlockingRoleApplicationForUser({ userId, email }) {
  const supabase = await ensureSupabase()

  const normalizedEmail = sanitizeString(email)?.toLowerCase()
  let query = supabase
    .from(ROLE_APPLICATION_TABLE)
    .select('*')
    .in('role_requested', Object.values(ROLE_APPLICATION_ROLES))
    .order('created_at', { ascending: false })

  if (userId && normalizedEmail) {
    query = query.or(`user_id.eq.${userId},email.eq.${normalizedEmail}`)
  } else if (userId) {
    query = query.eq('user_id', userId)
  } else if (normalizedEmail) {
    query = query.eq('email', normalizedEmail)
  } else {
    return null
  }

  const { data, error } = await query.limit(1)

  if (error) {
    throw new Error(error.message || 'Failed to check role application status.')
  }

  const latestApplication = data?.[0] || null

  // Only an application still AWAITING a decision should block login. Previously
  // any non-approved status blocked, so a REJECTED or CANCELLED applicant was
  // permanently locked out of their pre-existing account (with an error telling
  // them to wait for approval that will never come). A finished decision —
  // approved, rejected, or cancelled — must let the user into their base account.
  const BLOCKING_STATUSES = new Set([
    ROLE_APPLICATION_STATUS.PENDING,
    ROLE_APPLICATION_STATUS.UNDER_REVIEW,
  ])

  if (!latestApplication || !BLOCKING_STATUSES.has(latestApplication.status)) {
    return null
  }

  return latestApplication
}

export async function getLatestRoleApplicationForUser({ userId, email, roleRequested } = {}) {
  const supabase = await ensureSupabase()

  const normalizedEmail = sanitizeString(email)?.toLowerCase()
  let query = supabase
    .from(ROLE_APPLICATION_TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  const normalizedRole = normalizeRequestedRole(roleRequested)
  if (normalizedRole) {
    query = query.eq('role_requested', normalizedRole)
  } else {
    query = query.in('role_requested', Object.values(ROLE_APPLICATION_ROLES))
  }

  if (userId && normalizedEmail) {
    query = query.or(`user_id.eq.${userId},email.eq.${normalizedEmail}`)
  } else if (userId) {
    query = query.eq('user_id', userId)
  } else if (normalizedEmail) {
    query = query.eq('email', normalizedEmail)
  } else {
    return null
  }

  const { data, error } = await query.limit(1)

  if (error) {
    throw new Error(error.message || 'Failed to load the latest role application.')
  }

  return data?.[0] || null
}

function sanitizeSearchTerm(term) {
  if (!term) return null
  return term.replace(/[%"]/g, '').trim()
}

export async function fetchRoleApplications(options = {}) {
  const supabase = await ensureSupabase()

  const { status, roleRequested, limit, offset, search } = options
  let query = supabase.from(ROLE_APPLICATION_TABLE).select('*', { count: 'exact' })

  if (status && status !== 'all' && VALID_STATUSES.has(status)) {
    query = query.eq('status', status)
  }

  const normalizedRole = normalizeRequestedRole(roleRequested)
  if (normalizedRole) {
    query = query.eq('role_requested', normalizedRole)
  }

  const searchTerm = sanitizeSearchTerm(search)
  if (searchTerm) {
    query = query.or(
      `email.ilike.%${searchTerm}%,applicant_full_name.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`,
    )
  }

  query = query.order('created_at', { ascending: false })

  if (typeof limit === 'number' && limit > 0) {
    const rangeStart = Math.max(offset || 0, 0)
    const rangeEnd = rangeStart + limit - 1
    query = query.range(rangeStart, rangeEnd)
  }

  const { data, error } = await query
  if (error) {
    throw new Error(error.message || 'Failed to load role applications.')
  }

  return data || []
}

export async function getRoleApplicationById(id) {
  const supabase = await ensureSupabase()

  const { data, error } = await supabase
    .from(ROLE_APPLICATION_TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(error.message || 'Role application not found.')
  }

  return data
}

export async function updateRoleApplicationStatus(id, status, options = {}) {
  const supabase = await ensureSupabase()

  if (!VALID_STATUSES.has(status)) {
    throw new Error('Invalid status value.')
  }

  const { data: existing, error: fetchError } = await supabase
    .from(ROLE_APPLICATION_TABLE)
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    throw new Error(fetchError?.message || 'Application not found.')
  }

  const { reviewerId, reviewerRole } = await getCurrentReviewerContext(supabase)
  const requestedRole = normalizeRequestedRole(existing.role_requested)

  if (!canReviewApplicationRole(reviewerRole, requestedRole)) {
    const targetRoleLabel = requestedRole === ROLE_APPLICATION_ROLES.VERIFIER ? 'Verifier' : 'Project Developer'
    const error = new Error(`You are not allowed to review ${targetRoleLabel} applications.`)
    error.code = ROLE_APPLICATION_ERRORS.UNAUTHORIZED_REVIEW
    throw error
  }

  let roleUpdated = false
  let roleUpdateError = null
  if (
    status === ROLE_APPLICATION_STATUS.APPROVED &&
    options.assignRole !== false
  ) {
    if (existing.user_id) {
      try {
        await updateUserRole(existing.user_id, existing.role_requested, {
          fullName: existing.applicant_full_name,
          email: existing.email,
        })
        roleUpdated = true
      } catch (err) {
        roleUpdateError = err
        console.error('Failed to assign role during approval:', err)
        throw new Error(err?.message || 'Failed to assign the requested role.')
      }
    } else {
      console.warn(
        'Approval completed without a linked account; skipping role assignment and sending approval email to the application email address.',
      )
    }
  }

  const updatePayload = {
    status,
    admin_notes: sanitizeString(options.notes),
    decision_reason: sanitizeString(options.decisionReason),
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from(ROLE_APPLICATION_TABLE)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message || 'Failed to update application status.')
  }

  let notificationInfo = null
  const decisionEmail = await resolveApplicationEmail(supabase, existing)
  if (status === ROLE_APPLICATION_STATUS.APPROVED) {
    try {
      const emailResult = await sendRoleApplicationApprovalEmail({
        email: decisionEmail,
        applicantName: existing.applicant_full_name,
        role: existing.role_requested,
        hasAccount: !!existing.user_id,
        approvedAt: updatePayload.reviewed_at,
      })
      notificationInfo = { sent: true, hasAccount: !!existing.user_id, response: emailResult }
    } catch (notificationError) {
      console.error('Failed to send role application approval email:', notificationError)
      notificationInfo = { sent: false, error: notificationError }
    }
  } else if (status === ROLE_APPLICATION_STATUS.REJECTED) {
    try {
      const rejectionNotes = sanitizeString(options.notes) || sanitizeString(options.decisionReason) || ''
      const emailResult = await sendRoleApplicationRejectionEmail({
        email: decisionEmail,
        applicantName: existing.applicant_full_name,
        role: existing.role_requested,
        notes: rejectionNotes,
        rejectedAt: updatePayload.reviewed_at,
      })
      notificationInfo = { sent: true, response: emailResult }
    } catch (notificationError) {
      console.error('Failed to send role application rejection email:', notificationError)
      notificationInfo = { sent: false, error: notificationError }
    }
  }

  if ([ROLE_APPLICATION_STATUS.APPROVED, ROLE_APPLICATION_STATUS.REJECTED].includes(status)) {
    try {
      await notifyRoleApplicationDecision(data, status)
    } catch (notificationError) {
      console.error('Failed to create in-app role application notification:', notificationError)
    }
  }

  return {
    application: data,
    roleUpdated,
    roleUpdateError,
    notificationInfo,
  }
}
