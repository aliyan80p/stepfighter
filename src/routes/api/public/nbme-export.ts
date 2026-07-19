import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/nbme-export')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get('token')
        if (token !== process.env.NBME_EXPORT_TOKEN) {
          return new Response('unauthorized', { status: 401 })
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
