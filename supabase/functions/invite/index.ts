// Sends the invitations players type in the Social tab (migrations 0034,
// 0035): woken once `npm run group:invites` has put the address in the
// testers' group, and every quarter of an hour for what waits longer.
// Deployed with `--no-verify-jwt`: the caller is the database, which proves
// itself with the `x-invites-secret` it drew itself.
//
// The mail leaves the game's Gmail box (GMAIL_USER, GMAIL_APP_PASSWORD, an
// app password) under the inviter's name, and a reply reaches the inviter:
// no provider lets a mail claim the inviter's own address as its sender.
// Port 465, since Supabase closes 25 and 587.
//
// An address the group never took means the developer's Mac was off: the
// mail left with its join step, and the same box warns its owner, whose
// phone can add the address to the group by hand.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'
import { inviteMail } from './mail.ts'

interface Row {
  id: string
  email: string
  lang: string | null
  inviter_name: string
  inviter_email: string | null
  inviter_code: string | null
  listed: boolean
}

const MEMBERS_URL = 'https://groups.google.com/g/lettre-minute/members'

function sender(name: string): string {
  return `"${name.replace(/["\\]/g, '')} · Lettre Minute"`
}

Deno.serve(async (request) => {
  const url = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secret } = await supabase.rpc('invites_config', { p_url: `${url}/functions/v1/invite` })
  if (typeof secret !== 'string' || request.headers.get('x-invites-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const user = Deno.env.get('GMAIL_USER')
  const pass = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!user || !pass) return new Response('GMAIL_USER or GMAIL_APP_PASSWORD missing', { status: 500 })

  const { data, error } = await supabase.rpc('claim_invites')
  if (error) return new Response(error.message, { status: 500 })
  const rows = (data ?? []) as Row[]
  if (rows.length === 0) return Response.json({ mailed: 0 })

  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
  const mailed: string[] = []
  for (const row of rows) {
    const mail = inviteMail(row.lang, row.inviter_name, row.email, row.inviter_code, row.listed)
    try {
      await transport.sendMail({
        from: `${sender(row.inviter_name)} <${user}>`,
        to: row.email,
        replyTo: row.inviter_email || user,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      mailed.push(row.id)
    } catch (failure) {
      console.warn(`${row.email}: ${failure instanceof Error ? failure.message : failure}`)
    }
  }

  if (mailed.length > 0) await supabase.rpc('finish_invites', { p_ids: mailed })

  const unlisted = rows.filter((row) => !row.listed && mailed.includes(row.id))
  if (unlisted.length > 0) {
    const lines = unlisted.map((row) => `${row.email} (invité par ${row.inviter_name})`)
    await transport
      .sendMail({
        from: `"Lettre Minute" <${user}>`,
        to: user,
        subject: `À ajouter au groupe des testeurs : ${unlisted.map((row) => row.email).join(', ')}`,
        text: [
          'Ces adresses attendent depuis une heure : ton Mac n’a pas pu les ajouter au groupe. Leur mail est parti avec l’étape « Rejoindre les testeurs ».',
          '',
          ...lines,
          '',
          `Ajoute-les toi-même (Ajouter des membres, cocher « Ajouter directement ») : ${MEMBERS_URL}`,
        ].join('\n'),
      })
      .catch((failure: unknown) => console.warn(`alert: ${failure instanceof Error ? failure.message : failure}`))
  }
  return Response.json({ mailed: mailed.length, failed: rows.length - mailed.length })
})
