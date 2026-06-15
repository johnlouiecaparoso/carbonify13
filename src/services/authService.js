import { getSupabase } from '@/services/supabaseClient'
import { logUserAction } from '@/services/auditService'
import { sendWelcomeEmail } from '@/services/emailService'
import { notifyWelcomeUser } from '@/services/notificationService'
import {
  getBlockingRoleApplicationForUser,
  getRoleApplicationStatusLabel,
} from '@/services/roleApplicationService'

export async function loginWithEmail({ email, password }) {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // Log failed login attempt
    await logUserAction('LOGIN_FAILED', 'user', null, null, { email, error: error.message })
    throw new Error(error.message || 'Invalid credentials or account not registered.')
  }

  try {
    const blockingApplication = await getBlockingRoleApplicationForUser({
      userId: data.user?.id,
      email,
    })

    if (blockingApplication) {
      await supabase.auth.signOut({ scope: 'global' })

      const roleLabel =
        blockingApplication.role_requested === 'verifier' ? 'Verifier' : 'Project Developer'
      const statusLabel = getRoleApplicationStatusLabel(blockingApplication.status).toLowerCase()

      await logUserAction('LOGIN_BLOCKED_UNVERIFIED_ROLE', 'user', data.user?.id, null, {
        email,
        requested_role: blockingApplication.role_requested,
        application_status: blockingApplication.status,
      })

      throw new Error(
        `Your ${roleLabel} account is ${statusLabel} and cannot sign in until it is approved. We will email you once your account is verified.`,
      )
    }
  } catch (approvalError) {
    if (approvalError?.message?.includes('cannot sign in until it is approved')) {
      throw approvalError
    }

    console.error('Error checking role application approval during login:', approvalError)
  }

  // Log successful login
  await logUserAction('LOGIN_SUCCESS', 'user', data.user?.id, null, { email })
  return data
}

export async function registerWithEmail({ name, email, password }) {
  const supabase = getSupabase()
  const redirectTo = typeof window !== 'undefined' ? window.location.origin + '/login' : undefined

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: redirectTo,
    },
  })
  if (error) {
    // Log failed registration attempt
    await logUserAction('REGISTRATION_FAILED', 'user', null, null, {
      email,
      error: error.message,
    })
    throw new Error(error.message || 'Unable to register. Please try again.')
  }

  // Log successful registration
  await logUserAction('REGISTRATION_SUCCESS', 'user', data.user?.id, null, { email, name })

  // Create profile if user was created successfully
  if (data.user) {
    try {
      await createUserProfile(data.user.id, { full_name: name })
      // Log profile creation
      await logUserAction('PROFILE_CREATED', 'profile', data.user.id, null, {
        full_name: name,
      })
    } catch (profileError) {
      console.warn('Failed to create profile:', profileError)
      // Log profile creation failure
      await logUserAction('PROFILE_CREATION_FAILED', 'profile', data.user.id, null, {
        error: profileError.message,
      })
      // Don't fail registration if profile creation fails
    }
  }

  return data
}

/**
 * Start a Google OAuth sign-in. Redirects the browser to Google and back to
 * /auth/callback, where the session is finalized and a profile is ensured.
 * Requires the Google provider to be enabled in the Supabase dashboard.
 */
export async function signInWithGoogle() {
  const supabase = getSupabase()
  const redirectTo =
    typeof window !== 'undefined' ? window.location.origin + '/auth/callback' : undefined
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
  if (error) {
    await logUserAction('OAUTH_START_FAILED', 'user', null, null, {
      provider: 'google',
      error: error.message,
    })
    throw new Error(error.message || 'Could not start Google sign-in.')
  }
  return data
}

/**
 * Send a one-time SMS code to a phone number (E.164, e.g. +639171234567).
 * Requires an SMS provider configured in Supabase Auth.
 */
export async function sendPhoneOtp(phone) {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.signInWithOtp({ phone })
  if (error) {
    await logUserAction('PHONE_OTP_SEND_FAILED', 'user', null, null, { error: error.message })
    throw new Error(error.message || 'Could not send the verification code.')
  }
  return data
}

/**
 * Verify the SMS code and establish a session. On success ensures a profile row
 * exists (phone signups have none yet).
 */
export async function verifyPhoneOtp(phone, token) {
  const supabase = getSupabase()
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) {
    await logUserAction('PHONE_OTP_VERIFY_FAILED', 'user', null, null, { error: error.message })
    throw new Error(error.message || 'Invalid or expired code.')
  }
  if (data?.user) {
    await ensureUserProfile()
  }
  await logUserAction('LOGIN_SUCCESS', 'user', data.user?.id, null, { method: 'phone' })
  return data
}

/**
 * Ensure the currently authenticated user has a profile row, creating one if
 * missing. Used after OAuth / phone sign-in (and safe to call repeatedly) since
 * those flows don't go through registerWithEmail. Idempotent.
 */
export async function ensureUserProfile() {
  const supabase = getSupabase()
  if (!supabase) return null

  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) return null

  // Already has a profile? Done.
  try {
    const { getProfile } = await import('@/services/profileService')
    const existing = await getProfile(user.id)
    if (existing) return existing
  } catch {
    // fall through to creation
  }

  const meta = user.user_metadata || {}
  const fullName =
    meta.full_name || meta.name || user.email?.split('@')[0] || user.phone || 'User'

  return createUserProfile(user.id, { full_name: fullName })
}

async function createUserProfile(userId, profileData) {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // Import and use the proper createProfile function to ensure all fields are included
    const { createProfile } = await import('@/services/profileService')

    // Get user email from auth
    const { data: authUser } = await supabase.auth.getUser()
    const userEmail = authUser?.user?.email || ''

    // Create complete profile with all fields using the proper service
    const profile = await createProfile({
      id: userId,
      full_name:
        profileData.full_name ||
        authUser?.user?.user_metadata?.name ||
        userEmail?.split('@')[0] ||
        'User',
      email: userEmail,
      role: profileData.role || 'general_user',
      kyc_level: 0,
      company: '',
      location: '',
      bio: '',
    })

    console.log('Profile created successfully during registration:', profile)

    // Send welcome email to new user
    try {
      await sendWelcomeEmail(userId)
      console.log('Welcome email sent to new user')
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
      // Don't fail the registration if email sending fails
    }

    try {
      await notifyWelcomeUser(userId, profile.full_name)
      console.log('Welcome notification created for new user')
    } catch (notificationError) {
      console.error('Error creating welcome notification:', notificationError)
    }

    return profile
  } catch (error) {
    console.error('Profile creation error during registration:', error)
    throw error
  }
}

export async function getSession() {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      console.warn('Supabase client not available')
      return null
    }

    // Use getSession() which automatically handles localStorage restoration
    // Supabase's getSession() is synchronous for the stored session,
    // but we need to ensure the client is fully initialized
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Error getting session from Supabase:', error)
      return null
    }

    return data?.session || null
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

export async function signOut() {
  const supabase = getSupabase()
  if (!supabase) return

  try {
    // Get current user before signing out (non-blocking with timeout)
    let user = null
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getUser timeout')), 2000)
      )
      const { data } = await Promise.race([
        supabase.auth.getUser(),
        timeoutPromise,
      ])
      user = data?.user
    } catch (e) {
      // Ignore getUser timeout/error - proceed with signOut anyway
      console.warn('Could not get user before signOut:', e.message)
    }

    // Sign out from Supabase (with timeout to prevent hanging)
    const signOutPromise = supabase.auth.signOut({ scope: 'global' })
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('signOut timeout')), 3000)
    )
    
    await Promise.race([signOutPromise, timeoutPromise])

    // Log successful logout (non-blocking)
    if (user?.id) {
      logUserAction('LOGOUT_SUCCESS', 'user', user.id, null, {}).catch(() => {
        // Ignore audit log errors
      })
    }
  } catch (e) {
    // Log failed logout (non-blocking)
    try {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        logUserAction('LOGOUT_FAILED', 'user', data.user.id, null, { error: e.message }).catch(() => {
          // Ignore audit log errors
        })
      }
    } catch {
      // Ignore - we're already in error handling
    }
  }

  // Clear any persisted Supabase auth tokens
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          window.localStorage.removeItem(key)
        }
      })
    }
  } catch {
    // Ignore localStorage errors
  }
}
