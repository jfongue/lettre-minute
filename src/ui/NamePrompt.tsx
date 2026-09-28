import { useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

/**
 * After the quiet Play Games sign-in: the account exists, its name is still
 * the player's to choose. The gamer name is offered, never imposed; « plus
 * tard » leaves the question to the menu, as after any Google sign-in.
 */
export function NamePrompt({
  suggestion,
  onChoose,
  onLater,
}: {
  suggestion: string
  /** Null once named, or the sentence to show. */
  onChoose(name: string): Promise<string | null>
  onLater(): void
}) {
  const t = useT()
  const [name, setName] = useState(suggestion.slice(0, 24))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useBackDismiss(onLater)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    const refused = await onChoose(name)
    setBusy(false)
    setMessage(refused)
  }

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <form className="offer-pop" onSubmit={send}>
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="star" tint="blue" />
          </span>
        </span>
        <h2 id="name-prompt-title" className="offer-pop-title">
          {t.namePrompt.title}
        </h2>
        <p>{t.namePrompt.lead}</p>
        <label className="field">
          <span>{t.account.name}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" maxLength={24} required />
        </label>
        {message && <p className="note note--warn">{message}</p>}
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {t.namePrompt.later}
          </button>
          <button type="submit" className="btn btn--blue" disabled={busy}>
            {busy ? t.wait : t.account.submitName}
          </button>
        </div>
      </form>
    </div>
  )
}
