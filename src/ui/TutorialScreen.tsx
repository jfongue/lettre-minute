import { useEffect, useRef, useState } from 'react'
import { RUN_SECONDS } from '../domain/run'
import { capitalized, compactWord, initialOf } from '../domain/text'
import { categoryText, useT } from '../i18n'
import { sound } from '../lib/sound'
import { LetterMark } from './bauhaus'
import { motifAt } from './motifs'

/** Long enough to read the cheer, short enough not to feel like a wait. */
const CHEER_MS = 1100

interface TutorialScreenProps {
  /** Validated or skipped: the real run starts either way. */
  onDone(): void
}

/**
 * One prompt, one answer everybody knows: red, in the interface's language.
 * Compared here rather than through a `Judge`, so the lesson needs no
 * dictionary loaded and cannot be refused by one.
 */
export function TutorialScreen({ onDone }: TutorialScreenProps) {
  const t = useT()
  const answer = t.colours.rouge
  const letter = initialOf(answer)
  const category = categoryText(t, 'couleurs')
  const [draft, setDraft] = useState('')
  const [missed, setMissed] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [solved, setSolved] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  const right = compactWord(draft) === compactWord(answer)

  useEffect(() => field.current?.focus(), [])

  useEffect(() => {
    if (!solved) return
    const timer = setTimeout(onDone, CHEER_MS)
    return () => clearTimeout(timer)
  }, [solved, onDone])

  const submit = () => {
    if (solved) return
    if (right) {
      sound.found(0, 0)
      setSolved(true)
      return
    }
    if (draft.trim() === '') return
    sound.refused()
    setShaking(true)
    setMissed(true)
  }

  return (
    <div className="sheet tutorial">
      <header className="stack">
        <p className="eyebrow">{t.tutorial.eyebrow}</p>
        <h1 className="tutorial-title">{t.tutorial.title}</h1>
      </header>

      <ol className="tutorial-steps">
        <li>{t.tutorial.stepPrompt}</li>
        <li>{t.tutorial.stepType}</li>
        <li>{t.tutorial.stepClock(RUN_SECONDS)}</li>
      </ol>

      <section className="prompt">
        <LetterMark letter={letter} motif={motifAt(0)} size="lg" />
        <div className="prompt-text">
          <h2 className="prompt-label">{category.label}</h2>
          <p className="note">{t.tutorial.ask(letter)}</p>
        </div>
      </section>

      <form
        className={`answer${right ? ' answer--valid' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div className={`answer-field${shaking ? ' answer-field--shake' : ''}`} onAnimationEnd={() => setShaking(false)}>
          <input
            ref={field}
            value={draft}
            onChange={(event) => {
              sound.key(event.target.value.length < draft.length)
              setDraft(capitalized(event.target.value))
            }}
            placeholder={t.run.placeholder(letter)}
            aria-label={t.run.fieldLabel(letter, category.label)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            enterKeyHint="done"
            readOnly={solved}
          />
          <span className="answer-line" aria-hidden="true" />
        </div>

        {solved ? (
          <p className="cheer verdict">
            <span className="cheer-word">{answer}</span>
            <span className="note">{t.tutorial.solved}</span>
          </p>
        ) : right ? (
          <p className="verdict verdict--valid">✓ {answer}</p>
        ) : missed ? (
          <p className="verdict">{t.tutorial.hint(answer)}</p>
        ) : (
          <p className="verdict">&nbsp;</p>
        )}

        <div className="answer-actions">
          <button type="button" className="btn btn--ghost" onClick={onDone} disabled={solved}>
            {t.tutorial.skip}
          </button>
          <button type="submit" className="btn btn--blue" disabled={solved}>
            {t.run.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
