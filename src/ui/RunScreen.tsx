import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { RUN_SECONDS, SKIP_PENALTY_SECONDS, type Run, type Verdict } from '../domain/run'
import { capitalized, normalizeWord } from '../domain/text'
import type { Cheer } from '../state/session'

const URGENT_FROM = 10

// Tapping a button would blur the field and fold the phone keyboard away, only
// for the next prompt to open it again: the page would jump on every tap.
const keepFocus = (event: PointerEvent) => event.preventDefault()

interface RunScreenProps {
  run: Run
  draft: string
  live: Verdict | null
  cheer: Cheer | null
  remaining: number
  /** Normalized words already proposed in this run. */
  proposed: readonly string[]
  onType(draft: string): void
  onSubmit(): void
  onSkip(): void
  onPropose(word: string): void
}

export function RunScreen({
  run,
  draft,
  live,
  cheer,
  remaining,
  proposed,
  onType,
  onSubmit,
  onSkip,
  onPropose,
}: RunScreenProps) {
  const field = useRef<HTMLInputElement>(null)
  const [shaking, setShaking] = useState(false)
  const category = categoryMeta(run.prompt.categoryId)
  const seconds = Math.ceil(remaining)
  const urgent = remaining <= URGENT_FROM
  const accepted = live?.kind === 'accepted'
  // A corrected answer is accepted, but the field must not light up and give
  // away that the player is one letter off a word it will not name.
  const exact = accepted && !live?.found?.approximate

  // The field must never lose focus mid-run: a tap on "Passer" would otherwise
  // close the keyboard on a phone and cost the player the next prompt.
  useEffect(() => {
    field.current?.focus()
  }, [run.prompt])

  const submit = () => {
    if (!accepted && draft.trim() !== '') setShaking(true)
    onSubmit()
  }

  return (
    <div className="sheet run">
      <div className="spread">
        {/* Re-keyed every second once urgent, so each second ticks visibly. */}
        <p className={`clock${urgent ? ' clock--urgent' : ''}`} key={urgent ? seconds : 'calm'}>
          {seconds}
        </p>
        <p className="score">
          <span className="score-value" key={run.score}>
            {run.score.toLocaleString('fr-FR')}
          </span>
          {run.combo > 1 && (
            <span className="combo" key={run.combo}>
              ×{(1 + Math.min(run.combo, 9) * 0.1).toFixed(1)}
            </span>
          )}
        </p>
      </div>
      <div className={`progress progress--clock${urgent ? ' progress--urgent' : ''}`}>
        <span style={{ '--ratio': Math.min(1, remaining / RUN_SECONDS) } as CSSProperties} />
      </div>
      <p className="note run-meta">
        {run.found.length} mot{run.found.length > 1 ? 's' : ''} · {run.skips} passé{run.skips > 1 ? 's' : ''}
      </p>

      <section className="prompt" key={`${run.drawn}`}>
        <span className="letter-chip letter-chip--lg">{run.prompt.letter}</span>
        <div>
          <h2 className="serif prompt-label">{category?.label ?? run.prompt.categoryId}</h2>
          <p className="note">{category?.hint}</p>
        </div>
      </section>

      <form
        className={`answer${exact ? ' answer--valid' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div
          className={`answer-field${shaking ? ' answer-field--shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          <input
            ref={field}
            value={draft}
            onChange={(event) => onType(capitalized(event.target.value))}
            placeholder={`un mot en ${run.prompt.letter}…`}
            aria-label={`Mot en ${run.prompt.letter}, catégorie ${category?.label ?? ''}`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            enterKeyHint="done"
            onKeyDown={(event) => {
              // Implicit form submission is not guaranteed on mobile keyboards,
              // and Entrée is how the whole game is played.
              if (event.key !== 'Enter') return
              event.preventDefault()
              submit()
            }}
          />
          <span className="answer-line" aria-hidden="true" />
        </div>
        <Feedback
          live={live}
          cheer={cheer}
          letter={run.prompt.letter}
          draft={draft}
          proposed={proposed.includes(normalizeWord(draft))}
          onPropose={onPropose}
        />

        <div className="answer-actions">
          <button type="button" className="btn btn--ghost" onPointerDown={keepFocus} onClick={onSkip}>
            Passer · −{SKIP_PENALTY_SECONDS} s
          </button>
          <button type="submit" className="btn" onPointerDown={keepFocus} disabled={!accepted}>
            Valider
          </button>
        </div>
      </form>
    </div>
  )
}

function Feedback({
  live,
  cheer,
  letter,
  draft,
  proposed,
  onPropose,
}: {
  live: Verdict | null
  cheer: Cheer | null
  letter: string
  draft: string
  proposed: boolean
  onPropose(word: string): void
}) {
  // The last find takes the verdict's line until the player types again: lower
  // down, the phone keyboard would hide it.
  // Points and rarity are only revealed here, once the word is validated.
  if (!live && cheer)
    return (
      <p className="cheer verdict" key={cheer.display}>
        {cheer.approximate && <span aria-hidden="true">≈ </span>}
        {capitalized(cheer.display)} · +{cheer.points}{' '}
        <span className="note">{cheer.approximate ? 'orthographe approchée' : cheer.tier}</span>
      </p>
    )
  if (!live || live.kind === 'empty') return <p className="verdict">&nbsp;</p>

  switch (live.kind) {
    case 'accepted':
      // The word is named only once typed exactly: naming the correction would
      // hand the player the spelling they were missing.
      if (live.found?.approximate) return <p className="verdict verdict--approx">à une lettre près…</p>
      return <p className="verdict verdict--valid">✓ {capitalized(live.found?.display ?? '')}</p>
    case 'wrong-letter':
      return <p className="verdict">commence par {letter}</p>
    case 'already':
      return <p className="verdict">déjà donné</p>
    case 'unknown':
      return (
        <p className="verdict">
          inconnu du dictionnaire
          {proposed ? (
            <span className="verdict--sent">proposé, merci</span>
          ) : (
            <button type="button" className="btn btn--quiet" onPointerDown={keepFocus} onClick={() => onPropose(draft)}>
              le proposer
            </button>
          )}
        </p>
      )
  }
}
