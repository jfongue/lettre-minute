import { useState, type CSSProperties } from 'react'
import type { HiddenAnswer } from '../domain/perks'
import { capitalized, normalizeWord } from '../domain/text'
import { categoryText, useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { LetterMark } from './bauhaus'
import { categoryMotif } from './motifs'
import { PlusPop } from './PlusPop'
import { useLongPress } from './useLongPress'
import type { FlagWord } from './StatsPage'

/** Confetti of the bar torn off a hidden word: angle and reach of each piece. */
const SHARDS = Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * 360 + (i % 2) * 17, reach: 2.2 + (i % 3) * 0.9 }))

/**
 * The prompts the player skipped, folded under one toggle; opened, each shows
 * a word it could have taken under a black bar — close enough to tempt, too
 * dark to read. A tap tears the bar off: five times free, then Premium.
 *
 * A torn-off word is one a moderator can flag like any other: what the game
 * still had to give is exactly what does not belong there.
 */
export function HiddenAnswers({
  hidden,
  peeks,
  onPeek,
  onJoinPlus,
  onFlag,
}: {
  hidden: readonly HiddenAnswer[]
  peeks: number
  onPeek?(): void
  onJoinPlus?(): void
  /** Signals a word the run never took, uncovered: `WordEntry.key` is its display. */
  onFlag?(word: FlagWord): void
}) {
  const t = useT()
  const [unfolded, setUnfolded] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())
  const [asking, setAsking] = useState<number | null>(null)
  const press = useLongPress<FlagWord>((word) => onFlag?.(word))

  const tear = (index: number) => {
    setOpen((current) => new Set(current).add(index))
    tapFeedback('medium')
    sound.found(2, index + 3)
  }

  return (
    <section className="hidden-answers" onClick={(event) => event.stopPropagation()} role="presentation">
      <button
        type="button"
        className={`hidden-answers-toggle${unfolded ? ' hidden-answers-toggle--open' : ''}`}
        aria-expanded={unfolded}
        onClick={() => {
          setUnfolded(!unfolded)
          sound.click()
        }}
      >
        <span className="section-title">{t.peek.title}</span>
        <span className="hidden-answers-count">{hidden.length}</span>
        <svg className="hidden-answers-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {unfolded && (
        <ol className="reveal-words">
          {hidden.map((answer, index) => {
            const shown = open.has(index)
            const category = categoryText(t, answer.prompt.categoryId).label
            return (
              <li
                key={`${answer.prompt.categoryId}:${answer.prompt.letter}`}
                className="reveal-word hidden-answer"
                style={{ '--i': index } as CSSProperties}
                // Only a word the moderator has uncovered: the bar answers a
                // tap, and there is nothing to signal behind it.
                {...(onFlag && shown
                  ? press({
                      categoryId: answer.prompt.categoryId,
                      word: normalizeWord(answer.display),
                      display: answer.display,
                    })
                  : {})}
              >
                <LetterMark letter={answer.prompt.letter} motif={categoryMotif(answer.prompt.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {shown ? (
                    <span className="peek-word peek-word--torn">
                      {capitalized(answer.display)}
                      <span className="peek-shards" aria-hidden="true">
                        {SHARDS.map((shard, i) => (
                          <span
                            key={i}
                            style={{ '--angle': `${shard.angle}deg`, '--reach': `${shard.reach}rem`, '--i': i } as CSSProperties}
                          />
                        ))}
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="peek-bar"
                      // Each bar keeps its own beat: together they would tick like one.
                      style={{ '--beat': `${-((index * 1.37) % 2.8).toFixed(2)}s`, '--tempo': `${2.6 + (index % 3) * 0.35}s` } as CSSProperties}
                      aria-label={t.peek.reveal(category, answer.prompt.letter)}
                      onClick={() => {
                        if (peeks <= 0) return setAsking(index)
                        onPeek?.()
                        tear(index)
                      }}
                    >
                      <span className="peek-bar-ghost" aria-hidden="true">
                        {capitalized(answer.display)}
                      </span>
                    </button>
                  )}
                  <span className="reveal-word-category">{category}</span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {asking !== null && (
        <PlusPop
          reason="peek"
          onClose={() => setAsking(null)}
          onJoin={() => {
            onJoinPlus?.()
            tear(asking)
            setAsking(null)
          }}
        />
      )}
    </section>
  )
}
