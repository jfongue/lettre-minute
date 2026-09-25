// Drains the idea box (migration 0015): woken by the database through
// pg_cron, once a day. Deployed with `--no-verify-jwt`: the caller is the
// database, which proves itself with the `x-ideas-secret` it drew itself
// rather than a user's token.
import { createClient } from 'npm:@supabase/supabase-js@2'

interface Row {
  id: string
  body: string
  lang: string | null
  author: string
  created_at: string
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // The database draws the shared secret (migration 0015); the function
  // tells it where to call, and learns what its caller must present.
  const { data: secret } = await supabase.rpc('ideas_config', { p_url: `${url}/functions/v1/ideas` })
  if (typeof secret !== 'string' || request.headers.get('x-ideas-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const { data, error } = await supabase.rpc('claim_ideas')
  if (error) return new Response(error.message, { status: 500 })
  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return Response.json({ mailed: 0 })

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return new Response('RESEND_API_KEY missing', { status: 500 })
  const from = Deno.env.get('IDEAS_FROM') || 'Lettre Minute <onboarding@resend.dev>'
  const to = Deno.env.get('IDEAS_TO') || 'fongue.jeremy@gmail.com'

  const text = rows
    .map((row) => `${row.author} (${row.lang ?? '?'}, ${row.created_at})\n${row.body}`)
    .join('\n\n')
  const html = `<ul>${rows
    .map(
      (row) =>
        `<li><strong>${escapeHtml(row.author)}</strong> (${escapeHtml(row.lang ?? '?')}, ${escapeHtml(row.created_at)})<br>${escapeHtml(row.body)}</li>`,
    )
    .join('')}</ul>`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: `Boîte à idées : ${rows.length} nouvelles idées`,
      text,
      html,
    }),
  })
  if (!response.ok) return new Response(await response.text(), { status: 502 })

  await supabase.rpc('finish_ideas', { p_ids: rows.map((row) => row.id) })
  return Response.json({ mailed: rows.length })
})
