import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ENDURANCE_TIME_BONUS } from '../domain/modes'
import type { HiddenAnswer } from '../domain/perks'
import { runScore, type FoundWord, type Run } from '../domain/run'
import { capitalized, compactWord } from '../domain/text'
import { categoryText, formatNumber, useT } from '../i18n'
import type { BanOutcome } from '../lib/cloud'
import { tapFeedback } from '../lib/native'
import { sound, tierSound } from '../lib/sound'
import { Burst, LetterMark, MineMark, Shape, TierTag } from './bauhaus'
import { HiddenAnswers } from './HiddenAnswers'
import type { RevealBudget } from '../domain/perks'
import { categoryMotif } from './motifs'
import type { FlagWord } from './StatsPage'
import { reducedMotion, useCountUp } from './useCountUp'
import { useLongPress } from './useLongPress'

/** The beat of silence before the score: the clock has stopped, let it register. */
const BLANK_MS = 650
const SCORE_MS = 900
/** The whole list takes about this long, whatever its length… */
const WORDS_SPAN_MS = 3600
/** …but no word flashes by faster than this, nor lingers longer than that. */
const WORD_MIN_MS = 170
const WORD_MAX_MS = 480

const TIER_WEIGHT: Record<string, number> = { 'peu commun': 1.25, rare: 1.7, 'très rare': 2.4 }
const isRare = (found: FoundWord) => !found.approximate && (found.tier === 'rare' || found.tier === 'très rare')

/**
 * First screen: nothing, then the score, then every word the run found, one at
 * a time. Fast, but each find gets its own beat — and a rare one a longer one.
 * A tap skips to the end; the next tap moves on.
 */
export function Reveal({
  run,
  previousBest,
  mine,
  hidden,
  budget,
  onPeek,
  onAd,
  onFlag,
  flagCard,
  onNext,
}: {
  run: Run
  previousBest: number | null
  mine?: ReadonlySet<string>
  hidden: readonly HiddenAnswer[]
  budget: RevealBudget
  onPeek?(): void
  onAd?(): void
  onFlag?(word: FlagWord, reason: string): Promise<BanOutcome>
  /**
   * The card a long press opens on a word, drawn by the caller: it lives in
   * the statistics page, which a screen without the app around it (the Reddit
   * post) must not have to load for a gesture it never offers.
   */
  flagCard?(word: FlagWord, close: () => void): ReactNode
  onNext(): void
}) {
  const t = useT()
  const total = run.found.length
  // -2: blank, -1: the score alone, n: the score and the first n words.
  const [shown, setShown] = useState(() => (reducedMotion() ? total : -2))
  const done = shown >= total
  const step = Math.min(WORD_MAX_MS, Math.max(WORD_MIN_MS, WORDS_SPAN_MS / Math.max(1, total)))
  const bestPoints = Math.max(0, ...run.found.map((found) => found.points))
  const latest = useRef<HTMLLIElement>(null)
  const [flagged, setFlagged] = useState<FlagWord | null>(null)
  const press = useLongPress<FlagWord>((word) => setFlagged(word))

  useEffect(() => {
    if (done) return
    const previous = run.found[shown - 1]
    const delay =
      shown === -2 ? BLANK_MS : shown === -1 ? SCORE_MS + 250 : step * (previous ? (TIER_WEIGHT[previous.tier] ?? 1) : 1)
    const timer = setTimeout(() => setShown(shown + 1), delay)
    return () => clearTimeout(timer)
  }, [shown, done, step, run.found])

  useEffect(() => {
    const found = run.found[shown - 1]
    if (!found) return
    tapFeedback(isRare(found) ? 'medium' : 'light')
    sound.recap(tierSound(found.tier, found.approximate), shown - 1)
    latest.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shown, run.found])

  return (
    <div
      className="sheet reveal"
      // Un appui long ouvre la carte du mot : le tape qui suit ne doit pas
      // passer au bilan dans son dos, ni la refermer.
      onClick={() => {
        if (flagged) return
        if (done) onNext()
        else setShown(total)
      }}
      role="presentation"
    >
      {shown >= -1 && <RevealScore score={runScore(run)} previousBest={previousBest} mode={run.mode} />}

      {shown >= 0 && (
        <ol className="reveal-words">
          {run.found.slice(0, Math.max(0, shown)).map((found, index) => {
            const best = done && found.points === bestPoints && bestPoints > 0
            const ours = mine?.has(compactWord(found.display)) === true
            return (
              <li
                key={found.word}
                ref={index === shown - 1 ? latest : undefined}
                className={`reveal-word${isRare(found) ? ' reveal-word--rare' : ''}${best ? ' reveal-word--best' : ''}`}
                {...(onFlag
                  ? press({ categoryId: found.prompt.categoryId, word: found.word, display: found.display })
                  : {})}
              >
                <LetterMark letter={found.prompt.letter} motif={categoryMotif(found.prompt.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {found.approximate && <span className="note">≈ </span>}
                  {capitalized(found.display)}
                  <span className="reveal-word-category">
                    {categoryText(t, found.prompt.categoryId).label}
                    {ours && (
                      <>
                        {' · '}
                        <MineMark label={t.requests.mine} />
                      </>
                    )}
                  </span>
                </span>
                {!found.approximate && found.tier !== 'courant' && <TierTag tier={found.tier} />}
                <span className="reveal-word-points">
                  {/* En endurance le mot rend des secondes : c'est la seule monnaie du mode. */}
                  {run.mode === 'endurance' ? t.over.seconds(ENDURANCE_TIME_BONUS[found.tier] ?? 0) : `+${found.points}`}
                  {isRare(found) && <Burst />}
                </span>
              </li>
            )
          })}
          {total === 0 && <li className="note reveal-empty">{t.over.empty}</li>}
        </ol>
      )}

      {onFlag && shown >= 0 && <p className="note">{t.moderation.flag.hint}</p>}

      {done && hidden.length > 0 && (
        <HiddenAnswers
          hidden={hidden}
          budget={budget}
          onPeek={onPeek}
          onAd={onAd}
          onFlag={onFlag && ((word) => setFlagged(word))}
        />
      )}

      {done && (
        <button
          type="button"
          className="btn btn--play btn--block reveal-next"
          onClick={(event) => {
            event.stopPropagation()
            onNext()
          }}
        >
          <span>{t.over.next}</span>
          <span className="play-glyph" aria-hidden="true">
            <Shape kind="circle" tint="yellow" />
            <span className="motion play-triangle">
              <Shape kind="triangle" tint="red" />
            </span>
          </span>
        </button>
      )}

      {flagged && onFlag && flagCard?.(flagged, () => setFlagged(null))}
    </div>
  )
}

/**
 * The old record waits under the counter, so the moment the count passes it
 * lands on screen — not on the summary, a tap later. A first run has no record
 * to beat (null).
 */
function RevealScore({ score, previousBest, mode }: { score: number; previousBest: number | null; mode: Run['mode'] }) {
  const t = useT()
  const shown = useCountUp(score, SCORE_MS)
  const beaten = previousBest !== null && shown > previousBest

  useEffect(() => {
    if (!beaten) return
    tapFeedback('heavy')
    sound.record()
  }, [beaten])

  // The counter stops short of the old record: the same run, falling, without
  // the bell. A first run has nothing to fall short of.
  useEffect(() => {
    if (beaten || previousBest === null || shown < score) return
    sound.recordMiss()
  }, [beaten, previousBest, score, shown])

  return (
    <header className={`reveal-score${beaten ? ' reveal-score--record' : ''}`}>
      <p className="eyebrow">{t.over.timeUp}</p>
      <h1 className="score-final">
        {formatNumber(t, shown)}
        {beaten && <Burst />}
      </h1>
      <p className="score-poster-unit">{mode === 'endurance' ? t.over.survived : t.over.points}</p>
      {previousBest !== null && score > previousBest && (
        <p className="reveal-record" key={beaten ? 'new' : 'old'}>
          {beaten ? t.over.newRecord : `${t.over.record} ${formatNumber(t, previousBest)}`}
        </p>
      )}
    </header>
  )
}
