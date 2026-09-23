import { useEffect, useRef } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { RUN_SECONDS, SKIP_PENALTY_SECONDS, type Run, type Verdict } from '../domain/run'
import { normalizeWord } from '../domain/text'

const URGENT_FROM = 10

interface RunScreenProps {
  run: Run
  draft: string
  live: Verdict | null
  cheer: { display: string; points: number; tier: string } | null
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
  const category = categoryMeta(run.prompt.categoryId)
  const urgent = remaining <= URGENT_FROM
  const accepted = live?.kind === 'accepted'

  // The field must never lose focus mid-run: a tap on "Passer" would otherwise
  // close the keyboard on a phone and cost the player the next prompt.
  useEffect(() => {
    field.current?.focus()
  }, [run.prompt])

  return (
    <div className="sheet run">
      <div className="spread">
        <p className={`clock${urgent ? ' clock--urgent' : ''}`}>{Math.ceil(remaining)}</p>
        <p className="score">
          {run.score.toLocaleString('fr-FR')}
          {run.combo > 1 && <span className="combo"> ×{(1 + Math.min(run.combo, 9) * 0.1).toFixed(1)}</span>}
        </p>
      </div>
      <div className={`progress${urgent ? ' progress--urgent' : ''}`}>
        <span style={{ transform: `scaleX(${Math.min(1, remaining / RUN_SECONDS)})` }} />
      </div>

      <section className="prompt" key={`${run.drawn}`}>
        <span className="letter-chip letter-chip--lg">{run.prompt.letter}</span>
        <div>
          <h2 className="serif prompt-label">{category?.label ?? run.prompt.categoryId}</h2>
          <p className="note">{category?.hint}</p>
        </div>
      </section>

      <form
        className={`answer${accepted ? ' answer--valid' : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <input
          ref={field}
          value={draft}
          onChange={(event) => onType(event.target.value)}
          placeholder={`un mot en ${run.prompt.letter}…`}
          aria-label={`Mot en ${run.prompt.letter}, catégorie ${category?.label ?? ''}`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="done"
          onKeyDown={(event) => {
            // Implicit form submission is not guaranteed on mobile keyboards,
            // and Entrée is how the whole game is played.
            if (event.key !== 'Enter') return
            event.preventDefault()
            onSubmit()
          }}
        />
        <Feedback
          live={live}
          letter={run.prompt.letter}
          draft={draft}
          proposed={proposed.includes(normalizeWord(draft))}
          onPropose={onPropose}
        />

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn--ghost" onClick={onSkip}>
            Passer · −{SKIP_PENALTY_SECONDS} s
          </button>
          <button type="submit" className="btn" disabled={!accepted}>
            Valider
          </button>
        </div>
      </form>


      {cheer && (
        <p className="cheer" key={cheer.display}>
          {cheer.display} · +{cheer.points} <span className="note">{cheer.tier}</span>
        </p>
      )}

      <p className="note found-count">
        {run.found.length} mot{run.found.length > 1 ? 's' : ''} · {run.skips} passé{run.skips > 1 ? 's' : ''}
      </p>
    </div>
  )
}

function Feedback({
  live,
  letter,
  draft,
  proposed,
  onPropose,
}: {
  live: Verdict | null
  letter: string
  draft: string
  proposed: boolean
  onPropose(word: string): void
}) {
  if (!live || live.kind === 'empty') return <p className="verdict">&nbsp;</p>

  switch (live.kind) {
    case 'accepted':
      return (
        <p className={`verdict verdict--valid${live.found?.approximate ? ' verdict--approx' : ''}`}>
          {live.found?.approximate && <span aria-hidden="true">≈ </span>}
          {live.found?.display} · +{live.found?.points}{' '}
          <span className="note">{live.found?.approximate ? 'orthographe approchée' : live.found?.tier}</span>
        </p>
      )
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
            <button type="button" className="btn btn--quiet" onClick={() => onPropose(draft)}>
              le proposer
            </button>
          )}
        </p>
      )
  }
}
