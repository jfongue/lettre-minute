import { useEffect, useRef, useState } from 'react'
import { loadPack } from '../data/packs'
import { modeEdge, type ArcadeMode } from '../domain/modes'
import type { Prompt } from '../domain/run'
import { capitalized, compactWord, finalOf, initialOf } from '../domain/text'
import { lookup, type WordPack } from '../domain/words'
import { categoryText, useT } from '../i18n'
import { sound } from '../lib/sound'
import { LetterMark, Shape } from './bauhaus'
import { categoryMotif } from './motifs'

/** Long enough to enjoy the find, short enough to keep the pace. */
const SOLVED_MS = 2000
/** When each label springs up, as `tutorial-tag` in styles.css. */
const TAG_S = { letter: 1.15, theme: 1.95 }
/** The top of each `tutorial-beat` pulse on the letter. */
const BEAT_MS = [2500, 3500, 4500]
/** When each shape of the solved screen pops in, and its note. */
const SHAPE_NOTES: readonly { timbre: 'marimba' | 'glass'; step: number; at: number }[] = [
  { timbre: 'marimba', step: 5, at: 0.3 },
  { timbre: 'glass', step: 7, at: 0.38 },
  { timbre: 'marimba', step: 9, at: 0.46 },
  { timbre: 'marimba', step: 10, at: 0.54 },
]

/**
 * Les questions de la leçon : toutes sur les couleurs de la langue du joueur,
 * et toujours remplies par la même — celle de la question A. Le retard joue
 * deux questions, la A se validant à vide : c'est elle qui montre que la B se
 * remplit avec ce que la A demandait. Son thème à lui est une autre couleur,
 * pour que la lettre change d'une question à l'autre.
 */
function lessonPrompts(t: ReturnType<typeof useT>, mode: ArcadeMode): { a: Prompt; b: Prompt | null; answer: string } {
  const answer = t.colours.rouge
  const letterOf = modeEdge(mode) === 'last' ? finalOf : initialOf
  return {
    a: { categoryId: 'couleurs', letter: letterOf(answer) },
    b: mode === 'delayed' ? { categoryId: 'couleurs', letter: initialOf(t.colours.bleu) } : null,
    answer,
  }
}

/**
 * La leçon d'un mode de la réserve, jouée comme la première partie : les mêmes
 * pièces, la même validation, et n'importe quelle couleur du dictionnaire sur
 * la lettre demandée — la leçon ne se refuse jamais. Elle s'affiche à chaque
 * sélection d'un mode de la réserve, et se passe d'un bouton.
 */
export function ModeTutorial({ mode, lang, onDone }: { mode: ArcadeMode; lang: string; onDone(): void }) {
  const t = useT()
  const { a, b, answer } = lessonPrompts(t, mode)
  const category = categoryText(t, a.categoryId)
  const [pack, setPack] = useState<WordPack | null>(null)
  // Sans seconde question, la leçon s'ouvre directement sur le champ.
  const [step, setStep] = useState<'a' | 'b'>(b ? 'a' : 'b')
  const [draft, setDraft] = useState('')
  const [missed, setMissed] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [solved, setSolved] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPack(lang, a.categoryId).then(setPack, () => undefined)
  }, [lang, a.categoryId])

  useEffect(() => {
    sound.tile('marimba', 2, TAG_S.letter)
    sound.tile('glass', 4, TAG_S.theme)
  }, [])

  useEffect(() => {
    if (step === 'a') return
    field.current?.focus()
  }, [step])

  // The letter's pulses knock softly, until the player starts typing.
  const typing = draft !== ''
  useEffect(() => {
    if (step === 'a' || typing || solved) return
    const timers = BEAT_MS.map((at) => setTimeout(() => sound.tile('wood', 7), at))
    return () => timers.forEach(clearTimeout)
  }, [step, typing, solved])

  useEffect(() => {
    if (!solved) return
    const timer = setTimeout(onDone, SOLVED_MS)
    return () => clearTimeout(timer)
  }, [solved, onDone])

  // La question remplie est toujours la A : le renversé la juge par sa fin.
  const edge = modeEdge(mode)
  const known = pack && (edge === 'last' ? finalOf(draft) : initialOf(draft)) === a.letter ? lookup(pack, draft) : null
  const found = compactWord(draft) === compactWord(answer) ? answer : known ? capitalized(known.display) : null

  const named = found !== null
  useEffect(() => {
    if (named && !solved) sound.recognized()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [named])

  const submit = () => {
    if (solved) return
    if (step === 'a') {
      sound.go()
      setStep('b')
      return
    }
    if (found) {
      sound.found(3, 0)
      SHAPE_NOTES.forEach((note) => sound.tile(note.timbre, note.step, note.at))
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

  const shown = step === 'b' && b ? b.letter : a.letter
  const ask =
    mode === 'delayed'
      ? step === 'a'
        ? t.modes.lesson.delayed.askA
        : t.modes.lesson.delayed.askB
      : t.modes.lesson[mode].ask(a.letter)
  return (
    <div className={`sheet tutorial${typing ? ' tutorial--typing' : ''}`}>
      <div className="tutorial-top">
        <p className="tutorial-hello">{t.modes.lesson[mode].hello}</p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={onDone}>
          {t.tutorial.skip}
        </button>
      </div>

      <section className={`tutorial-prompt${edge === 'last' ? ' tutorial-prompt--last' : ''}`} key={step}>
        <div className="tutorial-piece tutorial-piece--letter">
          <LetterMark letter={shown} motif={categoryMotif(a.categoryId)} size="lg" />
          <span className="tutorial-tag">↑ {t.tutorial.letter}</span>
        </div>
        <div className="tutorial-piece tutorial-piece--theme">
          <h2 className="prompt-label">{category.label}</h2>
          <span className="tutorial-tag">↑ {t.tutorial.theme}</span>
        </div>
      </section>

      <p className="tutorial-ask">{ask}</p>

      {step === 'b' && b && (
        <p className="note">
          {t.modes.answerTo} <strong>{a.letter}</strong> · {category.label}
        </p>
      )}

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
            readOnly={step === 'a'}
            onChange={(event) => {
              sound.key(event.target.value.length < draft.length)
              setDraft(capitalized(event.target.value))
            }}
            placeholder={step === 'a' ? t.modes.armNote : t.run.placeholder(a.letter)}
            aria-label={t.run.fieldLabel(a.letter, category.label)}
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
