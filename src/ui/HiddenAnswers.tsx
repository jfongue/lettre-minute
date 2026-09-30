import { useState, type CSSProperties } from 'react'
import type { HiddenAnswer } from '../domain/perks'
import { capitalized } from '../domain/text'
import { categoryText, useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { LetterMark } from './bauhaus'
import { categoryMotif } from './motifs'
import { PlusPop } from './PlusPop'

/** Confetti of the bar torn off a hidden word: angle and reach of each piece. */
const SHARDS = Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * 360 + (i % 2) * 17, reach: 2.2 + (i % 3) * 0.9 }))

/**
 * The prompts the player skipped, folded under one toggle; opened, each shows
 * a word it could have taken under a black bar — close enough to tempt, too
 * dark to read. A tap tears the bar off: five times free, then Premium.
 */
export function HiddenAnswers({
  hidden,
  peeks,
  onPeek,
  onJoinPlus,
}: {
  hidden: readonly HiddenAnswer[]
  peeks: number
  onPeek?(): void
  onJoinPlus?(): void
}) {
  const t = useT()
  const [unfolded, setUnfolded] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())
  const [asking, setAsking] = useState<number | null>(null)

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
