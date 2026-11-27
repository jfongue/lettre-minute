import { useEffect, type CSSProperties } from 'react'
import { LEAGUES } from '../domain/ranked'
import { useT } from '../i18n'
import { armSound, sound } from '../lib/sound'
import { LeagueMark, TierMark } from './League'
import { useBackDismiss } from './useBackDismiss'

/**
 * Le duel classé présenté à un joueur qui jouait déjà, une fois : l'échelle
 * des ligues en formes, du Bronze au Maître, puis de quoi s'y lancer — la file
 * classée, ou la connexion qu'il demande à qui n'a pas de compte.
 */
export function RankedNewsPop({ named, onPlay, onLater }: { named: boolean; onPlay(): void; onLater(): void }) {
  const t = useT()
  useBackDismiss(onLater)
  useEffect(() => sound.news(), [])
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="ranked-news-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="offer-pop ranked-news">
        <p className="eyebrow">{t.ranked.promoEyebrow}</p>
        <ol className="ranked-news__ladder" aria-hidden="true">
          {LEAGUES.map((league, index) => (
            <li key={league.id} style={{ '--i': index } as CSSProperties}>
              <LeagueMark league={league.id} />
            </li>
          ))}
          <li style={{ '--i': LEAGUES.length } as CSSProperties}>
            <TierMark tier={{ kind: 'master', spot: 1 }} />
          </li>
        </ol>
        <h2 id="ranked-news-title" className="offer-pop-title">
          {t.ranked.promoTitle}
        </h2>
        <p className="note">{t.ranked.promoLead}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {t.ranked.promoLater}
          </button>
          <button
            type="button"
            className="btn btn--blue"
            onClick={() => {
              armSound()
              sound.go()
              onPlay()
            }}
          >
            {named ? t.ranked.promoPlay : t.ranked.promoSignIn}
          </button>
        </div>
      </div>
    </div>
  )
}
