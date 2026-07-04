import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EmailPayload = {
  to?: string | string[]
  subject?: string
  html?: string
  from?: string
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
    let to = Array.isArray(payload.to) ? payload.to : [payload.to].filter(Boolean)

    if (!to.length && payload.role_requested) {
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
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
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }

      to = (recipients || []).map((recipient) => recipient.email).filter(Boolean)

      if (!payload.subject) {
        payload.subject = `New ${roleLabel} Application`
      }

      if (!payload.html) {
        payload.html = `
          <p>A new role application has been submitted.</p>
          <p><strong>Applicant:</strong> ${payload.applicant_full_name || 'N/A'}</p>
          <p><strong>Email:</strong> ${payload.applicant_email || 'N/A'}</p>
          <p><strong>Requested role:</strong> ${roleLabel}</p>
          <p>Please review this request in ${reviewDestination}.</p>
        `
      }
    }

    if (!to.length || !payload.subject || !payload.html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

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
        subject: payload.subject,
        html: payload.html,
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
