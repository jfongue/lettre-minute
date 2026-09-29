import { useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import type { InviterClaim } from '../lib/cloud'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/**
 * The last net under an invitation whose code was lost on the way: asked once,
 * to a new account nothing befriended yet. A name befriends its player at
 * once; « personne » closes the question for good.
 */
export function InviterPrompt({
  onClaim,
  onClose,
}: {
  onClaim(name: string | null): Promise<InviterClaim>
  onClose(): void
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const claim = async (wanted: string | null) => {
    setBusy(true)
    setMessage(null)
    const outcome = await onClaim(wanted)
    setBusy(false)
    if (outcome === 'unknown') setMessage(t.inviterPrompt.unknown)
    else if (outcome === 'self') setMessage(t.inviterPrompt.self)
    else if (outcome === 'unreachable') setMessage(t.social.requests.unreachable(''))
    else onClose()
  }
  // Closing without answering only defers the question to the next launch.
  useBackDismiss(onClose)

  const send = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() !== '') void claim(name)
  }

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="inviter-prompt-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <form className="offer-pop" onSubmit={send}>
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="flower" tint="pink" />
          </span>
        </span>
        <h2 id="inviter-prompt-title" className="offer-pop-title">
          {t.inviterPrompt.title}
        </h2>
        <p>{t.inviterPrompt.lead}</p>
        <label className="field">
          <span>{t.inviterPrompt.field}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" autoCapitalize="off" maxLength={24} />
        </label>
        {message && <p className="note note--warn">{message}</p>}
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void claim(null)}>
            {t.inviterPrompt.nobody}
          </button>
          <button type="submit" className="btn btn--blue" disabled={busy || name.trim() === ''}>
            {busy ? t.wait : t.inviterPrompt.add}
          </button>
        </div>
      </form>
    </div>
  )
}
