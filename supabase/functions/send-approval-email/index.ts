import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Escape untrusted applicant-supplied text before interpolating into HTML email. */
function escapeHtml(value?: string): string {
  if (!value) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// H4: this function is a fixed-purpose notifier for role applications, NOT a
// general mailer. It deliberately accepts ONLY role_requested + applicant fields.
// Recipients, subject, and body are all derived server-side. Previously it
// forwarded caller-supplied `to`/`subject`/`html` straight to Resend, which — with
// the project's public anon key and open signup — let anyone send arbitrary HTML
// from Carbonify's own verified sender: a brand-credible phishing/spam relay.
type EmailPayload = {
  role_requested?: string
  applicant_full_name?: string
  applicant_email?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY secret' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = (await req.json()) as EmailPayload

    // Only the structured role-application notification is supported. Recipients
    // and content are derived server-side; nothing about them is caller-supplied.
    if (payload.role_requested !== 'project_developer' && payload.role_requested !== 'verifier') {
      return new Response(
        JSON.stringify({ error: 'Unsupported request: role_requested must be project_developer or verifier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const targetRoles =
      payload.role_requested === 'project_developer' ? ['verifier', 'admin'] : ['admin']
    const roleLabel = payload.role_requested === 'project_developer' ? 'Project Developer' : 'Verifier'
    const reviewDestination =
      payload.role_requested === 'project_developer'
        ? 'the verifier panel'
        : 'the admin role applications panel'

    const { data: recipients, error: recipientsError } = await supabase
      .from('profiles')
      .select('email')
      .in('role', targetRoles)
      .not('email', 'is', null)

    if (recipientsError) {
      return new Response(
        JSON.stringify({
          error: 'Failed to load reviewer recipients',
          details: recipientsError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const to = (recipients || []).map((recipient) => recipient.email).filter(Boolean)
    if (!to.length) {
      // No reviewers to notify — not an error the caller can fix.
      return new Response(
        JSON.stringify({ success: true, message: 'No reviewer recipients configured', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Body is a fixed template. Applicant name/email are escaped so a malicious
    // application (attacker-chosen name) can't inject markup into the reviewer email.
    const subject = `New ${roleLabel} Application`
    const html = `
      <p>A new role application has been submitted.</p>
      <p><strong>Applicant:</strong> ${escapeHtml(payload.applicant_full_name) || 'N/A'}</p>
      <p><strong>Email:</strong> ${escapeHtml(payload.applicant_email) || 'N/A'}</p>
      <p><strong>Requested role:</strong> ${roleLabel}</p>
      <p>Please review this request in ${reviewDestination}.</p>
    `

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // A2: never trust a caller-supplied `from`. The sender is fixed to our
        // own address (overridable only via a server-side secret) so this
        // function can't be used to spoof mail from an arbitrary domain.
        from: Deno.env.get('APPROVAL_EMAIL_FROM') || 'Carbonify <notifications@resend.dev>',
        to,
        subject,
        html,
      }),
    })

    const responseText = await resendResponse.text()
    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          error: 'Failed to send email',
          details: responseText,
        }),
        {
          status: resendResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(responseText, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected function error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
