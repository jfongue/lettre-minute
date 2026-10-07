import { useEffect, type CSSProperties } from 'react'
import { MODE_SECONDS, type GameMode } from '../domain/modes'
import { useT } from '../i18n'
import { armSound, sound } from '../lib/sound'
import { useBackDismiss } from './useBackDismiss'

/**
 * Le choix du mode, derrière le bouton « Jouer » : la partie normale reste la
 * première carte, les trois modes de la réserve suivent. Ils ne se jouent pas
 * avec un pouvoir et leur score ne quitte pas l'écran — c'est dit une fois, en
 * tête. Chaque carte porte son dessin à côté de son texte, jamais derrière.
 */
export function GameModes({ onPick, onClose }: { onPick(mode: GameMode): void; onClose(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  useEffect(() => {
    sound.pop()
  }, [])

  const cards: readonly { mode: GameMode; title: string; note: string; art: 'table' | 'clock' }[] = [
    { mode: 'solo', title: t.modes.solo, note: t.modes.soloHint, art: 'table' },
    { mode: 'delayed', title: t.modes.delayed, note: t.modes.delayedHint, art: 'clock' },
    { mode: 'endurance', title: t.modes.endurance, note: t.modes.enduranceHint, art: 'clock' },
    { mode: 'reversed', title: t.modes.reversed, note: t.modes.reversedHint, art: 'clock' },
  ]

  return (
    <div className="together" role="dialog" aria-label={t.modes.title} data-no-swipe>
      <div className="together-sheet">
        <button type="button" className="btn btn--quiet btn--muted together-close" onClick={onClose}>
          ← {t.modes.back}
        </button>
        <h1 className="together-title">{t.modes.title}</h1>
        <p className="note together-lead">{t.modes.lead}</p>

        {cards.map((card, index) => (
          <button
            key={card.mode}
            type="button"
            className={`together-card together-card--${index % 2 === 0 ? 'duel' : 'challenge'}`}
            style={{ '--i': index } as CSSProperties}
            onClick={() => {
              armSound()
              sound.go()
              onPick(card.mode)
            }}
          >
            <svg className="together-art" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
              {card.art === 'table' ? (
                <>
                  <rect className="together-table" x="33" y="33" width="34" height="34" />
                  <circle cx="50" cy="11" r="11" />
                  <circle cx="89" cy="50" r="11" />
                  <circle cx="50" cy="89" r="11" />
                  <circle cx="11" cy="50" r="11" />
                </>
              ) : (
                <>
                  <circle className="together-disc" cx="50" cy="50" r="42" />
                  <path className="together-slice" d="M50 50V12A38 38 0 0 1 88 50Z" />
                </>
              )}
            </svg>
            <span className="together-text">
              <b>{card.title}</b>
              <small>{card.note}</small>
              <span className="together-chip">{t.modes.seconds(MODE_SECONDS[card.mode])}</span>
            </span>
            <span className="together-go" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
