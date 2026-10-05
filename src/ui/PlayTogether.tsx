import { useEffect, type CSSProperties } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { armSound, sound } from '../lib/sound'
import { Avatar } from './Avatar'
import { useBackDismiss } from './useBackDismiss'

/**
 * Le choix entre les deux façons de jouer entre amis, derrière le même bouton
 * que la création d'un défi quand le duel est ouvert : le duel en direct, ou
 * le défi de vingt-quatre heures. Chaque carte porte son dessin à côté de son
 * texte, jamais derrière : le duel, quatre places autour d'une table, la main
 * sur l'une d'elles ; le défi, une journée qui avance. Les deux dessins sont
 * posés d'aplomb et ne bougent pas : c'est le choix qui doit se lire.
 */
export function PlayTogether({ challenge, onDuel, onChallenge, onClose }: { challenge: boolean; onDuel(): void; onChallenge(): void; onClose(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  useEffect(() => {
    sound.pop()
  }, [])

  return (
    <div className="together" role="dialog" aria-label={t.duel.chooseTitle} data-no-swipe>
      <div className="together-sheet">
        <button type="button" className="btn btn--quiet btn--muted together-close" onClick={onClose}>
          ← {t.duel.errorBack}
        </button>
        <h1 className="together-title">{t.duel.chooseTitle}</h1>
        <p className="note together-lead">{t.duel.chooseLead}</p>

        <button
          type="button"
          className="together-card together-card--duel"
          style={{ '--i': 0 } as CSSProperties}
          onClick={() => {
            armSound()
            sound.go()
            onDuel()
          }}
        >
          <svg className="together-art together-art--duel" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
            <rect className="together-table" x="33" y="33" width="34" height="34" />
            <circle className="together-seat--hand" cx="50" cy="11" r="11" />
            <circle cx="89" cy="50" r="11" />
            <circle cx="50" cy="89" r="11" />
            <circle cx="11" cy="50" r="11" />
          </svg>
          <span className="together-text">
            <b>{t.duel.duelCard}</b>
            <small>{t.duel.duelCardNote}</small>
            <span className="together-chip">{t.duel.duelCardPlayers}</span>
          </span>
          <span className="together-go" aria-hidden="true">
            →
          </span>
        </button>

        {challenge ? (
          <button
            type="button"
            className="together-card together-card--challenge"
            style={{ '--i': 1 } as CSSProperties}
            onClick={() => {
              armSound()
              sound.tile('glass', 4)
              onChallenge()
            }}
          >
            <svg className="together-art together-art--challenge" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
              <circle className="together-dial" cx="50" cy="50" r="41" />
              <path className="together-slice" d="M50 50V9A41 41 0 0 1 91 50Z" />
              <path d="M47 50V24H53V50Z" transform="rotate(90 50 50)" />
            </svg>
            <span className="together-text">
              <b>{t.duel.challengeCard}</b>
              <small>{t.duel.challengeCardNote}</small>
              <span className="together-chip">{t.duel.challengeCardPlayers}</span>
            </span>
            <span className="together-go" aria-hidden="true">
              →
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Une invitation à une table qui attend le joueur, sur l'accueil. */
export function DuelInviteCard({
  host,
  avatar,
  players,
  onJoin,
  onDecline,
}: {
  host: string
  avatar: AvatarChoice
  players: number
  onJoin(): void
  onDecline(): void
}) {
  const t = useT()
  useEffect(() => {
    sound.pop()
  }, [])
  return (
    <section className="duel-invite-card" aria-live="polite">
      <span className="duel-invite-card__face">
        <Avatar choice={avatar} size="md" />
        <span className="duel-invite-card__pulse" aria-hidden="true" />
      </span>
      <span className="duel-invite-card__text">
        <b>{t.duel.inviteCard(host)}</b>
        <small>{t.duel.invitePlayers(players)}</small>
      </span>
      <span className="duel-invite-card__actions">
        <button
          type="button"
          className="btn btn--blue"
          onClick={() => {
            armSound()
            sound.go()
            onJoin()
          }}
        >
          {t.duel.joinTable}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onDecline}>
          {t.duel.declineTable}
        </button>
      </span>
    </section>
  )
}

/** Ce que la table a dit en renvoyant le joueur à l'accueil : une ligne, quelques secondes. */
export function DuelBanner({ text, onDone }: { text: string; onDone(): void }) {
  useEffect(() => {
    sound.refused()
    const timer = setTimeout(onDone, 4500)
    return () => clearTimeout(timer)
  }, [onDone])
  return (
    <p className="duel-banner" role="status" onClick={onDone}>
      {text}
    </p>
  )
}
