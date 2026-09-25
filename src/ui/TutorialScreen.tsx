import { useEffect, useRef, useState } from 'react'
import { RUN_SECONDS, type Prompt } from '../domain/run'
import { capitalized, compactWord, initialOf } from '../domain/text'
import { categoryText, useT, type Messages } from '../i18n'
import { sound } from '../lib/sound'
import { LetterMark, Shape } from './bauhaus'
import { categoryMotif } from './motifs'

/** Long enough to read what comes next, short enough to keep the pace. */
const CHEER_MS = 1900

/** Red in the interface's language, on its own initial: « Vermelho » asks for a V. */
export function tutorialPrompt(t: Messages): Prompt & { answer: string } {
  const answer = t.colours.rouge
  return { categoryId: 'couleurs', letter: initialOf(answer), answer }
}

interface TutorialScreenProps {
  /** Validated or skipped: the real run starts either way. */
  onDone(): void
}

/**
 * One prompt, one answer everybody knows, and a tomato to point at it.
 * Compared here rather than through a `Judge`, so the lesson needs no
 * dictionary loaded and cannot be refused by one.
 */
export function TutorialScreen({ onDone }: TutorialScreenProps) {
  const t = useT()
  const { categoryId, letter, answer } = tutorialPrompt(t)
  const category = categoryText(t, categoryId)
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
      sound.found(3, 0)
      setSolved(true)
      return
    }
    if (draft.trim() === '') return
    sound.refused()
    setShaking(true)
    setMissed(true)
  }

  if (solved)
    return (
      <div className="sheet tutorial tutorial--solved" role="status">
        <p className="tutorial-bravo">{t.tutorial.solved}</p>
        <span className="tutorial-shapes" aria-hidden="true">
          <Shape kind="circle" tint="red" />
          <Shape kind="triangle" tint="yellow" />
          <Shape kind="quarter" tint="blue" />
        </span>
        <p className="tutorial-next">{t.tutorial.next(RUN_SECONDS)}</p>
      </div>
    )

  return (
    <div className="sheet tutorial">
      <button type="button" className="btn btn--quiet btn--muted tutorial-skip" onClick={onDone}>
        {t.tutorial.skip}
      </button>

      <section className="prompt">
        <LetterMark letter={letter} motif={categoryMotif(categoryId)} size="lg" />
        <div className="prompt-text">
          <h2 className="prompt-label">{category.label}</h2>
          <span className="tutorial-clue" aria-hidden="true">
            🍅
          </span>
        </div>
      </section>

      <p className="tutorial-ask">
        {t.tutorial.ask} <strong>{letter}</strong>
      </p>

      <form
        className={`answer${right ? ' answer--valid' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div
          className={`answer-field${draft === '' ? ' tutorial-field--idle' : ''}${shaking ? ' answer-field--shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
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
          />
          <span className="answer-line" aria-hidden="true" />
        </div>

        {right ? (
          <p className="verdict verdict--valid">✓ {answer}</p>
        ) : missed ? (
          <p className="verdict tutorial-hint">{t.tutorial.hint(answer)}</p>
        ) : (
          <p className="verdict">&nbsp;</p>
        )}

        <button type="submit" className={`btn btn--blue btn--block${right ? ' tutorial-go' : ''}`}>
          {t.run.submit}
        </button>
      </form>
    </div>
  )
}
