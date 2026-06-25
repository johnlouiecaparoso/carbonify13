import { getSupabase } from '@/services/supabaseClient'

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(userEmail, userName) {
  // In a real implementation, this would integrate with an email service like SendGrid, AWS SES, etc.
  console.log(`Sending welcome email to ${userEmail} for user ${userName}`)

  // For now, we'll just log the action
  return {
    success: true,
    messageId: `welcome_${Date.now()}`,
    email: userEmail,
    type: 'welcome',
  }
}

/**
 * Notify user when their project is approved
 */
export async function notifyProjectApproved(projectId, userId, verifierNotes) {
  try {
    // Get project and user details
    const supabase = getSupabase()

    const { data: project } = await supabase
      .from('projects')
      .select('title, category, location')
      .eq('id', projectId)
      .single()

    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!project || !user) {
      throw new Error('Project or user not found')
    }

    const emailData = {
      to: user.email,
      subject: `🎉 Your Project "${project.title}" Has Been Approved!`,
      template: 'project_approved',
      data: {
        userName: user.full_name,
        projectTitle: project.title,
        projectCategory: project.category,
        projectLocation: project.location,
        verifierNotes: verifierNotes,
        approvalDate: new Date().toLocaleDateString(),
      },
    }

    console.log('Sending project approval email:', emailData)
    return {
      success: true,
      messageId: `approval_${projectId}_${Date.now()}`,
      email: user.email,
      type: 'project_approved',
    }
  } catch (error) {
    console.error('Error sending project approval email:', error)
    throw error
  }
}

/**
 * Notify user when their project is rejected
 */
export async function notifyProjectRejected(
  projectId,
  userId,
  verifierNotes,
  improvementSuggestions,
) {
  try {
    // Get project and user details
    const supabase = getSupabase()

    const { data: project } = await supabase
      .from('projects')
      .select('title, category, location')
      .eq('id', projectId)
      .single()

    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!project || !user) {
      throw new Error('Project or user not found')
    }

    const emailData = {
      to: user.email,
      subject: `Project Review: "${project.title}" Requires Updates`,
      template: 'project_rejected',
      data: {
        userName: user.full_name,
        projectTitle: project.title,
        projectCategory: project.category,
        projectLocation: project.location,
        verifierNotes: verifierNotes,
        improvementSuggestions: improvementSuggestions,
        rejectionDate: new Date().toLocaleDateString(),
      },
    }

    console.log('Sending project rejection email:', emailData)
    return {
      success: true,
      messageId: `rejection_${projectId}_${Date.now()}`,
      email: user.email,
      type: 'project_rejected',
    }
  } catch (error) {
    console.error('Error sending project rejection email:', error)
    throw error
  }
}

/**
 * Notify user when they purchase credits
 */
export async function notifyCreditPurchased(transactionId, userId) {
  try {
    // Get transaction and user details
    const supabase = getSupabase()

    const { data: transaction } = await supabase
      .from('credit_transactions')
      .select(
        `
        *,
        project_credits!inner(
          *,
          projects!inner(title, category, location)
        )
      `,
      )
      .eq('id', transactionId)
      .single()

    const { data: user } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (!transaction || !user) {
      throw new Error('Transaction or user not found')
    }

    const emailData = {
      to: user.email,
      subject: `✅ Carbon Credits Purchased Successfully!`,
      template: 'credit_purchased',
      data: {
        userName: user.full_name,
        projectTitle: transaction.project_credits.projects.title,
        projectCategory: transaction.project_credits.projects.category,
        projectLocation: transaction.project_credits.projects.location,
        creditsPurchased: transaction.quantity,
        pricePerCredit: transaction.price_per_credit,
        totalAmount: transaction.total_amount,
        currency: transaction.currency,
        purchaseDate: new Date(transaction.created_at).toLocaleDateString(),
        transactionId: transaction.id,
      },
    }

    console.log('Sending credit purchase email:', emailData)
    return {
      success: true,
      messageId: `purchase_${transactionId}_${Date.now()}`,
      email: user.email,
      type: 'credit_purchased',
    }
  } catch (error) {
    console.error('Error sending credit purchase email:', error)
    throw error
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(userEmail) {
  console.log(`Sending password reset email to ${userEmail}`)

  return {
    success: true,
    messageId: `reset_${Date.now()}`,
    email: userEmail,
    type: 'password_reset',
  }
}

/**
 * Send email verification
 */
export async function sendEmailVerification(userEmail, userName) {
  console.log(`Sending email verification to ${userEmail} for user ${userName}`)

  return {
    success: true,
    messageId: `verify_${Date.now()}`,
    email: userEmail,
    type: 'email_verification',
  }
}

/**
 * Notify when a project is submitted for review
 */
export async function notifyProjectSubmitted(projectId, userId) {
  const supabase = getSupabase()
  if (!supabase) {
    return {
      success: false,
      projectId,
      userId,
      type: 'project_submitted',
      reason: 'Supabase not initialized',
    }
  }

  const [{ data: project }, { data: submitter }, { data: recipients }] = await Promise.all([
    supabase.from('projects').select('title, category, location').eq('id', projectId).single(),
    supabase.from('profiles').select('full_name, email').eq('id', userId).single(),
    supabase
      .from('profiles')
      .select('email, role')
      .in('role', ['verifier'])
      .not('email', 'is', null),
  ])

  if (!recipients?.length) {
    return {
      success: false,
      projectId,
      userId,
      type: 'project_submitted',
      reason: 'No recipients found',
    }
  }

  const subject = `New Project Submission: ${project?.title || projectId}`
  const html = `
    <p>A new project has been submitted and needs verifier review.</p>
    <p><strong>Project:</strong> ${project?.title || 'N/A'}</p>
    <p><strong>Category:</strong> ${project?.category || 'N/A'}</p>
    <p><strong>Location:</strong> ${project?.location || 'N/A'}</p>
    <p><strong>Submitted by:</strong> ${submitter?.full_name || submitter?.email || userId}</p>
    <p>Please review this project in the verifier panel.</p>
  `

  await Promise.allSettled(
    recipients.map((recipient) =>
      sendEmailViaFunction({
        to: recipient.email,
        subject,
        html,
      }),
    ),
  )

  return {
    success: true,
    messageId: `project_submitted_${Date.now()}`,
    projectId,
    userId,
    recipients: recipients.length,
    type: 'project_submitted',
  }
}

export async function notifyVerifiersOfRoleApplication(application) {
  if (!application?.email) return { success: false, reason: 'Missing application data' }

  await sendEmailViaFunction({
    role_requested: application.role_requested,
    applicant_full_name: application.applicant_full_name,
    applicant_email: application.email,
  })

  return {
    success: true,
    type: 'role_application_submitted',
  }
}

/**
 * Get user email preferences
 */
export async function getUserEmailPreferences(userId) {
  console.log('Getting email preferences for user:', userId)

  // Return default preferences
  return {
    marketing: true,
    projectUpdates: true,
    priceAlerts: true,
    systemNotifications: true,
    weeklyDigest: false,
  }
}

/**
 * Update user email preferences
 */
export async function updateUserEmailPreferences(userId, preferences) {
  console.log('Updating email preferences for user:', userId, preferences)

  // In a real implementation, this would save to database
  return {
    success: true,
    preferences,
  }
}

/**
 * Notify applicant that their specialist role request was approved
 */
const PROJECT_REF = import.meta.env.VITE_SUPABASE_PROJECT_REF
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''

function deriveFunctionsUrl() {
  if (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL) {
    return import.meta.env.VITE_SUPABASE_FUNCTIONS_URL
  }

  if (PROJECT_REF) {
    return `https://${PROJECT_REF}.functions.supabase.co`
  }

  if (SUPABASE_URL) {
    try {
      const parsedUrl = new URL(SUPABASE_URL)
      const host = parsedUrl.hostname.replace('.supabase.co', '.functions.supabase.co')
      return `${parsedUrl.protocol}//${host}`
    } catch (error) {
      console.warn('Could not derive Supabase Functions URL from VITE_SUPABASE_URL:', error)
    }
  }

  return ''
}

const FUNCTIONS_URL = deriveFunctionsUrl()

async function sendEmailViaFunction(payload) {
  const supabase = getSupabase()
  const functionsUrl = FUNCTIONS_URL ? `${FUNCTIONS_URL.replace(/\/$/, '')}/send-approval-email` : ''
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 12000)
  const requestBody = {
    from: 'Carbonify <notifications@resend.dev>',
    ...payload,
  }

  try {
    if (!functionsUrl && supabase?.functions) {
      const { data, error } = await supabase.functions.invoke('send-approval-email', {
        body: requestBody,
      })
      if (error) {
        throw new Error(error.message || 'Failed to send email')
      }
      return data
    }

    if (!functionsUrl) {
      throw new Error(
        'Supabase functions URL is not configured and client invoke is unavailable for send-approval-email.',
      )
    }

    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey
          ? {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            }
          : {}),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to send email')
    }

    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sendRoleApplicationApprovalEmail(details) {
  const { email, applicantName, role, hasAccount = false, approvedAt = new Date() } = details || {}

  if (!email) {
    throw new Error('Approval email requires a recipient email.')
  }

  const roleLabel =
    role === 'verifier'
      ? 'Verifier'
      : role === 'project_developer'
        ? 'Project Developer'
        : 'Specialist'

  const origin =
    (typeof window !== 'undefined' && window.location?.origin) || 'https://app.carbonify.dev'

  const loginLink = `${origin}/login`
  const signUpLink = `${origin}/register?role=${encodeURIComponent(role || '')}&email=${encodeURIComponent(email)}`

  const html = `
    <p>Hi ${applicantName || 'Carbonify Specialist'},</p>
    <p>Your Carbonify account for the <strong>${roleLabel}</strong> role has been verified and approved.</p>
    ${
      hasAccount
        ? `<p>You can now sign in and access your dashboard here:<br/><a href="${loginLink}">${loginLink}</a></p>`
        : `<p>To get started, create your Carbonify account using this link:<br/><a href="${signUpLink}">${signUpLink}</a></p>`
    }
    <p>Verification date: ${approvedAt instanceof Date ? approvedAt.toLocaleString() : approvedAt}</p>
    <p>If you believe this was sent in error, please contact the Carbonify support team.</p>
    <p>— The Carbonify Team</p>
  `

  const result = await sendEmailViaFunction({
    to: email,
    subject: `Your ${roleLabel} account has been verified`,
    html,
    from: 'Carbonify <notifications@resend.dev>',
  })

  return {
    ...result,
    success: true,
    email,
    role,
    hasAccount,
    type: 'role_application_approved',
  }
}

export async function sendRoleApplicationRejectionEmail(details) {
  const {
    email,
    applicantName,
    role,
    notes = '',
    rejectedAt = new Date(),
  } = details || {}

  if (!email) {
    throw new Error('Rejection email requires a recipient email.')
  }

  const roleLabel =
    role === 'verifier'
      ? 'Verifier'
      : role === 'project_developer'
        ? 'Project Developer'
        : 'Specialist'

  const origin =
    (typeof window !== 'undefined' && window.location?.origin) || 'https://app.carbonify.dev'

  const applyAgainLink = `${origin}/apply?role=${encodeURIComponent(role || '')}`
  const noteSection = String(notes || '').trim()
    ? `<p><strong>Reviewer notes:</strong><br/>${String(notes).trim()}</p>`
    : ''

  const html = `
    <p>Hi ${applicantName || 'Carbonify Applicant'},</p>
    <p>Thank you for applying for the <strong>${roleLabel}</strong> role on Carbonify.</p>
    <p>After review, your application was <strong>not approved</strong> at this time.</p>
    ${noteSection}
    <p>You may submit a stronger application after updating your details and supporting information:</p>
    <p><a href="${applyAgainLink}">${applyAgainLink}</a></p>
    <p>Decision date: ${rejectedAt instanceof Date ? rejectedAt.toLocaleString() : rejectedAt}</p>
    <p>If you need clarification, please contact the Carbonify support team.</p>
    <p>— The Carbonify Team</p>
  `

  const result = await sendEmailViaFunction({
    to: email,
    subject: `Update on your ${roleLabel} application`,
    html,
    from: 'Carbonify <notifications@resend.dev>',
  })

  return {
    ...result,
    success: true,
    email,
    role,
    type: 'role_application_rejected',
  }
}
