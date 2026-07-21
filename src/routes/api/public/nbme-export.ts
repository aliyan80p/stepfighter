import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

/**
 * Admin-only export of NBME question content.
 *
 * Requires BOTH:
 *   1. A valid Supabase user access token via `Authorization: Bearer <jwt>`
 *      (the caller must be signed in), AND
 *   2. That user having the `admin` role in `public.user_roles`, AND
 *   3. The static NBME_EXPORT_TOKEN as a defence-in-depth query param.
 *
 * Losing any one of these on its own no longer grants access to the paid
 * catalog — a leaked static token is useless without an admin session.
 */
export const Route = createFileRoute('/api/public/nbme-export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const token = url.searchParams.get('token')
        const expected = process.env.NBME_EXPORT_TOKEN
        if (!expected || token !== expected) {
          return new Response('unauthorized', { status: 401 })
        }

        const auth = request.headers.get('authorization') ?? ''
        if (!auth.toLowerCase().startsWith('bearer ')) {
          return new Response('unauthorized', { status: 401 })
        }
        const jwt = auth.slice(7).trim()
        if (jwt.split('.').length !== 3) {
          return new Response('unauthorized', { status: 401 })
        }

        const SUPABASE_URL = process.env.SUPABASE_URL
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response('server misconfigured', { status: 500 })
        }

        // Validate the caller and check the admin role under RLS using the
        // caller's own JWT — never the service role for authorization.
        const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${jwt}` } },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined as any },
        })
        const { data: claims, error: claimsError } = await userClient.auth.getClaims(jwt)
        if (claimsError || !claims?.claims?.sub) {
          return new Response('unauthorized', { status: 401 })
        }
        const { data: isAdmin, error: roleError } = await userClient.rpc('has_role', {
          _user_id: claims.claims.sub,
          _role: 'admin',
        })
        if (roleError || !isAdmin) {
          return new Response('forbidden', { status: 403 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { data: subjects } = await supabaseAdmin.from('subjects').select('id,name')
        const { data: systems } = await supabaseAdmin.from('systems').select('id,name')
        const all: any[] = []
        let from = 0
        const size = 1000
        for (;;) {
          const { data, error } = await supabaseAdmin
            .from('questions')
            .select('id,qbank_id,source,subject_id,system_id,question')
            .ilike('source', 'NBME%')
            .order('id')
            .range(from, from + size - 1)
          if (error) return new Response(error.message, { status: 500 })
          if (!data || data.length === 0) break
          all.push(...data)
          if (data.length < size) break
          from += size
        }
        return new Response(JSON.stringify({ subjects, systems, questions: all }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
