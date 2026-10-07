import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { MODE_SECONDS, type GameMode } from '../domain/modes'
import { useT } from '../i18n'
import { armSound, sound } from '../lib/sound'
import { useBackDismiss } from './useBackDismiss'

/** Ce que chaque mode change à la question : la lettre, ou celle d'avant. */
type ModeArt = 'first' | 'previous' | 'bonus' | 'last'

/**
 * Un dessin par mode. Le solo et le renversé montrent le mot et la cellule de sa
 * lettre, au bord que la question contraint — la première pour l'un, la dernière
 * pour l'autre ; le retard remonte à la question d'avant ; l'endurance porte le
 * chrono dont chaque mot repousse l'aiguille. Tous taillés comme les icônes du
 * jeu : un aplat, un trait épais, rien qui bouge.
 */
const ART: Record<ModeArt, ReactNode> = {
  first: (
    <>
      <rect className="together-word" x="22" y="35" width="68" height="30" rx="6" />
      <rect className="together-letter" x="10" y="35" width="28" height="30" rx="6" />
    </>
  ),
  previous: <path className="together-mark" d="M10 50L42 22V38H90V62H42V78Z" />,
  bonus: (
    <>
      <circle className="together-word" cx="50" cy="54" r="32" />
      <rect className="together-mark" x="40" y="2" width="20" height="16" rx="6" />
      <rect x="46" y="30" width="8" height="26" rx="4" className="together-hand" />
      <rect x="54" y="50" width="22" height="8" rx="4" className="together-hand" />
    </>
  ),
  last: (
    <>
      <rect className="together-word" x="10" y="35" width="68" height="30" rx="6" />
      <rect className="together-letter" x="62" y="35" width="28" height="30" rx="6" />
    </>
  ),
}

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

  const cards: readonly { mode: GameMode; title: string; note: string; art: ModeArt }[] = [
    { mode: 'solo', title: t.modes.solo, note: t.modes.soloHint, art: 'first' },
    { mode: 'delayed', title: t.modes.delayed, note: t.modes.delayedHint, art: 'previous' },
    { mode: 'endurance', title: t.modes.endurance, note: t.modes.enduranceHint, art: 'bonus' },
    { mode: 'reversed', title: t.modes.reversed, note: t.modes.reversedHint, art: 'last' },
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
              {ART[card.art]}
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
