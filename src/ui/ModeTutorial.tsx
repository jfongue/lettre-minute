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
 * Les deux questions de la leçon : la A se valide à vide — c'est elle qui lance
 * le chrono —, la B s'affiche quand c'est la A qu'il faut remplir. Les deux
 * thèmes sont des couleurs, et la lettre de la B n'est jamais celle de la A
 * dans les sept langues : la règle se voit, elle ne s'explique pas.
 */
function delayPrompts(t: Messages): { a: Prompt & { answer: string }; b: Prompt } {
  const answer = t.colours.rouge
  return {
    a: { categoryId: 'couleurs', letter: initialOf(answer), answer },
    b: { categoryId: 'couleurs', letter: initialOf(t.colours.bleu) },
  }
}

/**
 * La leçon du retard, jouée comme la première partie : les mêmes pièces, la
 * même validation. La question A part sans réponse, la B prend sa place, et
 * c'est la A qu'il faut remplir — n'importe quelle couleur du dictionnaire sur
 * sa lettre, pour que la leçon ne soit jamais refusée.
 */
export function ModeTutorial({ lang, onDone }: { lang: string; onDone(): void }) {
  const t = useT()
  const { a, b } = delayPrompts(t)
  const category = categoryText(t, a.categoryId)
  const [pack, setPack] = useState<WordPack | null>(null)
  const [step, setStep] = useState<'a' | 'b'>('a')
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

  // The answer is the one the question A asked for, never the one on screen.
  const known = pack && initialOf(draft) === a.letter ? lookup(pack, draft) : null
  const found = compactWord(draft) === compactWord(a.answer) ? a.answer : known ? capitalized(known.display) : null

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

  const shown = step === 'a' ? a.letter : b.letter
  return (
    <div className={`sheet tutorial${typing ? ' tutorial--typing' : ''}`}>
      <div className="tutorial-top">
        <p className="tutorial-hello">{t.modes.tutorialHello}</p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={onDone}>
          {t.tutorial.skip}
        </button>
      </div>

      <section className="tutorial-prompt" key={step}>
        <div className="tutorial-piece tutorial-piece--letter">
          <LetterMark letter={shown} motif={categoryMotif(a.categoryId)} size="lg" />
          <span className="tutorial-tag">↑ {t.tutorial.letter}</span>
        </div>
        <div className="tutorial-piece tutorial-piece--theme">
          <h2 className="prompt-label">{category.label}</h2>
          <span className="tutorial-tag">↑ {t.tutorial.theme}</span>
        </div>
      </section>

      <p className="tutorial-ask">{step === 'a' ? t.modes.tutorialAskA : t.modes.tutorialAskB}</p>

      {step === 'b' && (
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
          <p className="verdict tutorial-hint">{t.tutorial.hint(a.answer)}</p>
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
