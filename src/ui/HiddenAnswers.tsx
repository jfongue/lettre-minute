import { useEffect, useState, type CSSProperties } from 'react'
import { BASE_REVEALS, REVEALS_PER_AD, type HiddenAnswer, type RevealBudget } from '../domain/perks'
import { capitalized, normalizeWord } from '../domain/text'
import { categoryText, useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { host } from '../platform'
import { sound } from '../lib/sound'
import { trackFeature } from '../lib/track'
import { LetterMark } from './bauhaus'
import { categoryMotif } from './motifs'
import { PlusLockedSlot, PlusSeal, ResourceChip, ResourceGlyph } from './premium'
import { usePremium } from './premiumContext'
import { useLongPress } from './useLongPress'
import type { FlagWord } from './StatsPage'
import { useFeature } from './features'

/** Confetti of the bar torn off a hidden word: angle and reach of each piece. */
const SHARDS = Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * 360 + (i % 2) * 17, reach: 2.2 + (i % 3) * 0.9 }))

/**
 * The prompts the player skipped, folded under one toggle; opened, each shows
 * a word it could have taken under a black bar — close enough to tempt, too
 * dark to read. A tap tears the bar off: a few a day, then an ad or Premium.
 *
 * La bande qui ne peut plus rien arracher ne part pas dans le vide : le premier
 * appui propose la pub — elle paie deux révélations et fait vivre le jeu —, les
 * suivants proposent Premium, qui répond « voir une pub » ou « le devenir ».
 *
 * A torn-off word is one a moderator can flag like any other: what the game
 * still had to give is exactly what does not belong there.
 */
export function HiddenAnswers({
  hidden,
  budget,
  onPeek,
  onAd,
  onFlag,
}: {
  hidden: readonly HiddenAnswer[]
  /** The day's reveals: what is left, what the day allows, the ads still to watch. */
  budget: RevealBudget
  onPeek?(): void
  /** A rewarded ad was watched to the end: one more reveal today. */
  onAd?(): void
  /** Signals a word the run never took, uncovered: `WordEntry.key` is its display. */
  onFlag?(word: FlagWord): void
}) {
  const t = useT()
  const shown = useFeature('hiddenWords')
  const door = usePremium()
  const canReveal = budget.unlimited || budget.left > 0
  const [unfolded, setUnfolded] = useState(false)
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())
  const [watching, setWatching] = useState(false)
  const [noAd, setNoAd] = useState(false)
  // Ce que la bande vide propose : la pub la première fois, Premium ensuite.
  const [offer, setOffer] = useState<'ad' | 'premium' | null>(null)
  const [walls, setWalls] = useState(0)
  const adPossible = door.adsOpen && budget.adsLeft > 0
  // Le carré de l'œil tressaute à chaque révélation : remonter sa clé rejoue l'animation.
  const [beat, setBeat] = useState(0)
  // Loading an ad takes seconds: started as the summary opens, it is ready by the time the reveals run out.
  useEffect(() => {
    if (door.adsOpen) host.prepareRewarded()
  }, [door.adsOpen])
  const press = useLongPress<FlagWord>((word) => onFlag?.(word))

  const tear = (index: number) => {
    setOpen((current) => new Set(current).add(index))
    tapFeedback('medium')
    sound.found(2, index + 3)
    setBeat((count) => count + 1)
  }

  const watch = async () => {
    if (watching) return
    setWatching(true)
    setNoAd(false)
    const result = await host.showRewarded()
    trackFeature('ad', { source: 'reveal', result })
    setWatching(false)
    if (result === 'rewarded') {
      tapFeedback('medium')
      onAd?.()
      setOffer(null)
      setBeat((count) => count + 1)
    } else if (result === 'unavailable') setNoAd(true)
  }

  /**
   * Plus rien à arracher : la première fois, la pub (deux révélations d'un coup) ;
   * ensuite Premium, qui offre les deux réponses. Sans boutique ni pub, la bande
   * ne dit rien, comme avant.
   */
  const ask = () => {
    tapFeedback('light')
    const hit = walls + 1
    setWalls(hit)
    if (hit === 1 && adPossible) setOffer('ad')
    else if (door.storeOpen) setOffer('premium')
    else if (adPossible) setOffer('ad')
  }

  if (!shown) return null
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
        <span className={`peek-left${beat > 0 ? ' peek-left--beat' : ''}`} key={beat}>
          <ResourceChip
            icon="eye"
            count={budget.left}
            max={budget.allowed}
            unlimited={budget.unlimited}
            state={canReveal ? 'normal' : 'spent'}
            label={budget.unlimited ? t.peek.unlimited : t.peek.chip(budget.left, budget.allowed)}
          />
        </span>
        <svg className="hidden-answers-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {unfolded && !budget.unlimited && <p className="note reveal-budget">{canReveal ? t.peek.rule(BASE_REVEALS) : t.peek.spent}</p>}
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
                        if (!canReveal) {
                          ask()
                          return
                        }
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
      {unfolded && !canReveal && (
        <div className="reveal-spent">
          {adPossible && (
            <button type="button" className="btn btn--blue reveal-ad" disabled={watching} onClick={watch}>
              {watching ? t.peek.adBusy : t.peek.ad(REVEALS_PER_AD)}
            </button>
          )}
          {noAd && (
            <p className="note note--warn" role="alert">
              {t.peek.adFailed}
            </p>
          )}
          {door.storeOpen && <PlusLockedSlot icon="eye" label={t.peek.unlimited} onOpen={() => door.open('reveal')} />}
        </div>
      )}
      {offer !== null && (
        <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="peek-offer-title">
          <div className="offer-pop-scrim" onClick={() => setOffer(null)} />
          <div className="offer-pop">
            <span className="offer-pop-art" aria-hidden="true">
              <span className="offer-pop-shape offer-pop-shape--circle">
                {offer === 'ad' ? <ResourceGlyph icon="eye" plus size={44} /> : <PlusSeal size="lg" animated />}
              </span>
            </span>
            <h2 className="offer-pop-title" id="peek-offer-title">
              {offer === 'ad' ? t.peek.adTitle : t.peek.plusTitle}
            </h2>
            <p className="note">{offer === 'ad' ? t.peek.adBody(REVEALS_PER_AD) : t.peek.plusBody}</p>
            {noAd && (
              <p className="note note--warn" role="alert">
                {t.peek.adFailed}
              </p>
            )}
            <div className="offer-pop-actions">
              {offer === 'premium' && (
                <button type="button" className="btn btn--ghost" disabled={watching} onClick={watch}>
                  {watching ? t.peek.adBusy : t.peek.plusAd(REVEALS_PER_AD)}
                </button>
              )}
              {offer === 'premium' ? (
                <button
                  type="button"
                  className="btn btn--blue"
                  onClick={() => {
                    setOffer(null)
                    door.open('reveal')
                  }}
                >
                  {t.peek.plusCta}
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn--ghost" onClick={() => setOffer(null)}>
                    {t.peek.later}
                  </button>
                  <button type="button" className="btn btn--blue" disabled={watching} onClick={watch}>
                    {watching ? t.peek.adBusy : t.peek.adCta}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
