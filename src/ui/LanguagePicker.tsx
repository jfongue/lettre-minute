import { useEffect, useState, type CSSProperties } from 'react'
import { LOCALES, loadMessages, type Locale, type Messages } from '../i18n'
import { fr } from '../i18n/fr'
import { Shape } from './bauhaus'

/**
 * Shown once, before anything else, when the device speaks none of the game's
 * languages. Each language is written in itself: the player cannot be expected
 * to read the one the game would have guessed.
 *
 * A touch does not decide on its own: the title takes the language of the line
 * touched, so the choice is read before it is made, and « Valider » closes the
 * screen — the list is long and its words are foreign to whoever lands here.
 */
export function LanguagePicker({ onPick }: { onPick(locale: Locale): void }) {
  const [draft, setDraft] = useState<Locale | null>(null)
  const [preview, setPreview] = useState<Messages>(fr)

  useEffect(() => {
    if (!draft) return
    let living = true
    void loadMessages(draft).then((messages) => {
      if (living) setPreview(messages)
    })
    return () => {
      living = false
    }
  }, [draft])

  // The language's texts are in: the button can speak it too.
  const ready = draft !== null && preview.tag.split('-')[0] === draft

  return (
    <div className="sheet cascade language-picker">
      <header className="masthead">
        <h1 className="title language-title" key={`${draft ?? 'start'}-${preview.tag}`}>
          <span>{preview.appName[0]}</span>
          <span>{preview.appName[1]}</span>
        </h1>
      </header>

      <ul className="language-choices">
        {LOCALES.map((entry, index) => (
          <li key={entry.id} style={{ '--i': index } as CSSProperties}>
            <button
              type="button"
              className={`btn btn--ghost btn--block${draft === entry.id ? ' language-choice--on' : ''}`}
              lang={entry.id}
              aria-pressed={draft === entry.id}
              onClick={() => setDraft(entry.id)}
            >
              {entry.name}
            </button>
          </li>
        ))}
      </ul>

      {ready && (
        <button
          type="button"
          className="btn btn--play btn--block language-confirm"
          lang={draft}
          onClick={() => onPick(draft)}
        >
          {preview.language.confirm}
        </button>
      )}

      <Shape kind="sun" tint="yellow" className="language-sun" />
    </div>
  )
}
