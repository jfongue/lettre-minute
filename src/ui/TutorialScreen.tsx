import { useEffect, useRef, useState } from 'react'
import { loadPack } from '../data/packs'
import type { Prompt } from '../domain/run'
import { capitalized, compactWord, initialOf } from '../domain/text'
import { lookup, type WordPack } from '../domain/words'
import { categoryText, useT, type Messages } from '../i18n'
import { sound } from '../lib/sound'
import { LetterMark, Shape } from './bauhaus'
import { categoryMotif } from './motifs'

/** Long enough to enjoy the find, short enough to keep the pace. */
const SOLVED_MS = 2000

/** Red in the interface's language, on its own initial: « Vermelho » asks for a V. */
export function tutorialPrompt(t: Messages): Prompt & { answer: string } {
  const answer = t.colours.rouge
  return { categoryId: 'couleurs', letter: initialOf(answer), answer }
}

interface TutorialScreenProps {
  /** The dictionary whose colours the answer is checked against. */
  lang: string
  /** Validated or skipped: the real run starts either way. */
  onDone(): void
}

/**
 * The real prompt, explained on itself: each piece arrives with its label,
 * and the labels step aside once the player starts typing. Any colour of the
 * dictionary on that letter counts — red alone if it does not load, so the
 * lesson can never be refused.
 */
export function TutorialScreen({ lang, onDone }: TutorialScreenProps) {
  const t = useT()
  const { categoryId, letter, answer } = tutorialPrompt(t)
  const category = categoryText(t, categoryId)
  const [pack, setPack] = useState<WordPack | null>(null)
  const [draft, setDraft] = useState('')
  const [missed, setMissed] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [solved, setSolved] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    field.current?.focus()
    loadPack(lang, categoryId).then(setPack, () => undefined)
  }, [lang, categoryId])

  useEffect(() => {
    if (!solved) return
    const timer = setTimeout(onDone, SOLVED_MS)
    return () => clearTimeout(timer)
  }, [solved, onDone])

  const known = pack && initialOf(draft) === letter ? lookup(pack, draft) : null
  const found = compactWord(draft) === compactWord(answer) ? answer : known ? capitalized(known.display) : null

  const submit = () => {
    if (solved) return
    if (found) {
      sound.found(3, 0)
      setSolved(found)
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
        <p className="tutorial-found">✓ {solved}</p>
        <span className="tutorial-shapes" aria-hidden="true">
          <Shape kind="circle" tint="red" />
          <Shape kind="triangle" tint="yellow" />
          <Shape kind="quarter" tint="blue" />
          <Shape kind="diamond" tint="green" />
        </span>
        <p className="tutorial-next">{t.tutorial.next}</p>
      </div>
    )

  return (
    <div className={`sheet tutorial${draft === '' ? '' : ' tutorial--typing'}`}>
      <div className="tutorial-top">
        <p className="tutorial-hello">{t.tutorial.hello}</p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={onDone}>
          {t.tutorial.skip}
        </button>
      </div>

      <section className="tutorial-prompt">
        <div className="tutorial-piece tutorial-piece--letter">
          <LetterMark letter={letter} motif={categoryMotif(categoryId)} size="lg" />
          <span className="tutorial-tag">↑ {t.tutorial.letter}</span>
        </div>
        <div className="tutorial-piece tutorial-piece--theme">
          <h2 className="prompt-label">{category.label}</h2>
          <span className="tutorial-tag">↑ {t.tutorial.theme}</span>
        </div>
      </section>

      <p className="tutorial-ask">
        {t.tutorial.ask} <strong>{letter}</strong>
      </p>

      <form
        className={`answer tutorial-answer${found ? ' answer--valid' : ''}`}
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
            data-keys
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

        {found ? (
          <p className="verdict verdict--valid" key={found}>
            ✓ {found}
          </p>
        ) : missed ? (
          <p className="verdict tutorial-hint">{t.tutorial.hint(answer)}</p>
        ) : (
          <p className="verdict">&nbsp;</p>
        )}

        <button type="submit" className={`btn btn--blue btn--block${found ? ' tutorial-go' : ''}`}>
          {t.run.submit}
        </button>
      </form>
    </div>
  )
}
