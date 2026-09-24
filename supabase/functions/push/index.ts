// Drains `push_outbox` (migration 0009): woken by the database through pg_net
// on every new row, and every minute by pg_cron. Deployed with
// `--no-verify-jwt`: the caller is the database, which proves itself with the
// shared `x-push-secret` rather than a user's token.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { accessToken, send, type Outcome, type ServiceAccount } from './fcm.ts'
import { pushText, type PushKind } from './messages.ts'

interface Row {
  id: number
  kind: PushKind
  challenge_id: string
  token: string | null
  lang: string
  owner_name: string
  players: number
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_SECRET')
  if (!secret || request.headers.get('x-push-secret') !== secret) return new Response('forbidden', { status: 403 })

  const account = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? 'null') as ServiceAccount | null
  if (!account) return new Response('FCM_SERVICE_ACCOUNT missing', { status: 500 })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await supabase.rpc('claim_push_batch', { p_limit: 200 })
  if (error) return new Response(error.message, { status: 500 })
  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return Response.json({ sent: 0 })

  const bearer = rows.some((row) => row.token) ? await accessToken(account) : ''
  // A message is done once every phone of its player has it; one phone to
  // retry keeps it in the queue, and the others may get it twice — rare, and
  // Android's tag folds the second into the first.
  const retry = new Set<number>()
  const dead: string[] = []
  await Promise.all(
    rows.map(async (row) => {
      if (!row.token) return
      const { title, body } = pushText(row.kind, row.lang, row.owner_name, row.players)
      let outcome: Outcome
      try {
        outcome = await send(account, bearer, {
          token: row.token,
          title,
          body,
          data: { kind: row.kind, challenge: row.challenge_id },
          tag: `${row.kind}:${row.challenge_id}`,
        })
      } catch {
        outcome = 'retry'
      }
      if (outcome === 'dead') dead.push(row.token)
      if (outcome === 'retry') retry.add(row.id)
    }),
  )

  const done = [...new Set(rows.map((row) => row.id))].filter((id) => !retry.has(id))
  await supabase.rpc('finish_push_batch', { p_sent: done, p_dead: dead })
  return Response.json({ sent: done.length, retry: retry.size, dead: dead.length })
})
