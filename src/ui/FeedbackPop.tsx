import { useEffect, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { submitIdea, type IdeaSource } from '../lib/cloud'
import { Shape } from './bauhaus'
import { useBackDismiss } from './useBackDismiss'

const IDEA_MAX = 2000

/** A question asked before the box opens: « yes » opens it, « later » closes everything. */
export interface FeedbackIntro {
  title: string
  lead: string
  yes: string
  later: string
}

/**
 * The idea box, brought to the player on the way home after their tenth run
 * and every thirty after: the same box as « Mes demandes », marked as asked.
 * Premium's thanks open it too, behind their own question.
 */

export function FeedbackPop({
  intro,
  onClose,
  send = (body, lang, source) => submitIdea(body, lang, source),
}: {
  intro?: FeedbackIntro
  onClose(): void
  /** The debug board passes a stand-in: nothing reaches the server from there. */
  send?(body: string, lang: string, source: IdeaSource): Promise<boolean>
}) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle')
  const [asking, setAsking] = useState(Boolean(intro))
  useBackDismiss(onClose)
  useEffect(() => sound.pop(), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim().length < 3) return
    setState('busy')
    const ok = await send(draft, t.tag.slice(0, 2), 'prompt')
    setState(ok ? 'sent' : 'failed')
    if (ok) sound.sent()
    if (ok) setTimeout(onClose, 1400)
  }

  if (intro && asking) {
    return (
      <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="feedback-intro-title">
        <div className="offer-pop-scrim" onClick={onClose} />
        <div className="offer-pop">
          <span className="offer-pop-art" aria-hidden="true">
            <span className="offer-pop-shape offer-pop-shape--circle">
              <Shape kind="sun" tint="yellow" />
            </span>
          </span>
          <h2 id="feedback-intro-title" className="offer-pop-title">
            {intro.title}
          </h2>
          <p>{intro.lead}</p>
          <div className="offer-pop-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {intro.later}
            </button>
            <button type="button" className="btn btn--blue" onClick={() => setAsking(false)}>
              {intro.yes}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="feedback-pop-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <form className="offer-pop feedback-pop" onSubmit={submit}>
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="quarter" tint="blue" />
          </span>
        </span>
        <h2 id="feedback-pop-title" className="offer-pop-title">
          {t.feedback.title}
        </h2>
        {!intro && <p>{t.feedback.lead}</p>}
        {state === 'sent' ? (
          <p className="note">{t.feedback.sent}</p>
        ) : (
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (state === 'failed') setState('idle')
            }}
            placeholder={t.feedback.placeholder}
            aria-label={t.feedback.title}
            maxLength={IDEA_MAX}
            rows={4}
          />
        )}
        {state === 'failed' && <p className="note note--warn">{t.feedback.failed}</p>}
        {state !== 'sent' && (
          <div className="offer-pop-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t.feedback.later}
            </button>
            <button type="submit" className="btn btn--blue" disabled={state === 'busy' || draft.trim().length < 3}>
              {state === 'busy' ? t.wait : t.feedback.send}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
