type Json = Record<string, unknown>

declare const Deno: {
  env: { get: (name: string) => string | undefined }
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-edge-version, x-supabase-client-platform',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function jsonResponse(body: Json, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function requireEnv(name: string) {
  const v = Deno.env.get(name)
  if (!v || !v.trim()) throw new Error(`Missing required env var: ${name}`)
  return v
}

async function requireAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null

  const supabaseUrl = requireEnv('SUPABASE_URL')
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY')

  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: supabaseAnonKey,
      authorization: authHeader,
    },
  })

  if (!res.ok) return null
  return (await res.json().catch(() => null)) as unknown
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const reqHeaders = req.headers.get('access-control-request-headers')

  console.log('send-provider-update-email: request', {
    method: req.method,
    hasAuthorization: Boolean(req.headers.get('authorization') ?? req.headers.get('Authorization')),
    hasApikey: Boolean(req.headers.get('apikey') ?? req.headers.get('Apikey') ?? req.headers.get('x-supabase-anon-key')),
    origin,
  })

  if (req.method === 'OPTIONS') {
    const headers = corsHeaders(origin)
    if (reqHeaders) {
      headers['Access-Control-Allow-Headers'] = reqHeaders
    }
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed' },
      { status: 405, headers: { ...corsHeaders(origin) } },
    )
  }

  try {
    const user = await requireAuthenticatedUser(req)
    if (!user) {
      console.log('send-provider-update-email: unauthorized')
      return jsonResponse(
        { error: 'Unauthorized' },
        { status: 401, headers: { ...corsHeaders(origin) } },
      )
    }

    const mailgunApiKey = requireEnv('MAILGUN_API_KEY')
    const mailgunDomain = requireEnv('MAILGUN_DOMAIN')
    const mailgunRegion = (Deno.env.get('MAILGUN_REGION') ?? 'US').toUpperCase()
    const mailgunFrom = (Deno.env.get('MAILGUN_FROM') ?? 'noreply@convergencehealth.com').trim()

    console.log('send-provider-update-email: sending', {
      toPresent: Boolean(String(((await req.clone().json().catch(() => ({}))) as any)?.to ?? '').trim()),
      subjectPresent: Boolean(String(((await req.clone().json().catch(() => ({}))) as any)?.subject ?? '').trim()),
      region: mailgunRegion,
    })

    const apiBase = mailgunRegion === 'EU' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net'

    const payload = (await req.json().catch(() => ({}))) as any
    const to = String(payload?.to ?? '').trim()
    const subject = String(payload?.subject ?? '').trim()
    const text = String(payload?.text ?? payload?.body ?? '').trim()

    if (!to) {
      return jsonResponse(
        { error: 'Missing `to`' },
        { status: 400, headers: { ...corsHeaders(origin) } },
      )
    }
    if (!subject) {
      return jsonResponse(
        { error: 'Missing `subject`' },
        { status: 400, headers: { ...corsHeaders(origin) } },
      )
    }
    if (!text) {
      return jsonResponse(
        { error: 'Missing `text`' },
        { status: 400, headers: { ...corsHeaders(origin) } },
      )
    }

    const form = new URLSearchParams()
    form.set('from', mailgunFrom)
    form.set('to', to)
    form.set('subject', subject)
    form.set('text', text)

    const res = await fetch(`${apiBase}/v3/${encodeURIComponent(mailgunDomain)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    })

    const raw = await res.text()
    if (!res.ok) {
      return jsonResponse(
        {
          error: 'Mailgun request failed',
          status: res.status,
          details: raw,
        },
        { status: 502, headers: { ...corsHeaders(origin) } },
      )
    }

    let data: unknown = raw
    try {
      data = JSON.parse(raw)
    } catch {
      // keep raw text
    }

    return jsonResponse(
      { ok: true, data },
      {
        status: 200,
        headers: {
          ...corsHeaders(origin),
        },
      },
    )
  } catch (e: any) {
    return jsonResponse(
      { error: e?.message ?? 'Unknown error' },
      { status: 500, headers: { ...corsHeaders(origin) } },
    )
  }
})
