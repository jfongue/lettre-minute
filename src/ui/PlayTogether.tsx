import { useEffect, type CSSProperties } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { armSound, sound } from '../lib/sound'
import { Avatar } from './Avatar'
import { LeagueChip } from './League'
import { RANKED_CARD_LEVEL } from '../domain/bonus'
import type { DuelRatingInfo } from '../lib/cloud'
import { useBackDismiss } from './useBackDismiss'

/**
 * Le choix entre les deux façons de jouer entre amis, derrière le même bouton
 * que la création d'un défi quand le duel est ouvert : le duel en direct, ou
 * le défi de vingt-quatre heures. Chaque carte porte son dessin à côté de son
 * texte, jamais derrière : le duel, quatre places autour d'une table, la main
 * sur l'une d'elles ; le défi, une journée qui avance. Les deux dessins sont
 * posés d'aplomb et ne bougent pas : c'est le choix qui doit se lire.
 */
export function PlayTogether({
  challenge,
  local = false,
  onDuel,
  onMatch,
  onChallenge,
  onSignIn,
  onClose,
  rating = null,
  rankedLocked = null,
}: {
  challenge: boolean
  /** Sans compte nommé : le duel se joue contre les joueurs ordinateur. */
  local?: boolean
  onDuel(): void
  /** Le matchmaking : un adversaire inconnu, trouvé par le serveur. */
  onMatch?(): void
  /** Mon classement au duel, que la carte du matchmaking annonce. */
  rating?: DuelRatingInfo | null
  /**
   * Le duel classé demande la carte de classement : `level`, elle se gagne au
   * niveau 5 ; `pending`, elle attend au prochain bilan. Null : la carte est là.
   */
  rankedLocked?: 'level' | 'pending' | null
  onChallenge(): void
  /** Sans compte nommé : se connecter ouvre les vrais joueurs. */
  onSignIn?(): void
  onClose(): void
}) {
  const t = useT()
  useBackDismiss(onClose)
  useEffect(() => {
    sound.pop()
  }, [])

  return (
    <div className="together" role="dialog" aria-label={t.duel.chooseTitle} data-no-swipe>
      <div className="together-sheet">
        <div className="together-head">
          <button type="button" className="btn btn--quiet btn--muted together-close" onClick={onClose}>
            ← {t.duel.errorBack}
          </button>
          <h1 className="together-title">{t.duel.chooseTitle}</h1>
          <p className="note together-lead">{t.duel.chooseLead}</p>
        </div>

        <div className="together-cards">
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
            <small>{local ? t.duel.botsCardNote : t.duel.duelCardNote}</small>
            <span className="together-chip">{t.duel.duelCardPlayers}</span>
          </span>
          <span className="together-go" aria-hidden="true">
            →
          </span>
        </button>

        {onMatch && rankedLocked ? (
          <section className="together-card together-card--match together-card--locked" style={{ '--i': 1 } as CSSProperties} aria-label={t.duel.matchCard}>
            <svg className="together-art together-art--duel" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
              <rect className="together-table" x="33" y="33" width="34" height="34" />
              <circle className="together-seat--hand" cx="50" cy="11" r="11" />
              <circle cx="50" cy="89" r="11" />
            </svg>
            <span className="together-text">
              <b>{t.duel.matchCard}</b>
              <small>{rankedLocked === 'pending' ? t.ranked.cardPending : t.ranked.cardLocked(RANKED_CARD_LEVEL)}</small>
              <span className="together-chips">
                <span className="together-chip together-chip--lock">{t.bonus.kinds.ranked[0]}</span>
              </span>
            </span>
          </section>
        ) : onMatch ? (
          <button
            type="button"
            className="together-card together-card--match"
            style={{ '--i': 1 } as CSSProperties}
            onClick={() => {
              armSound()
              sound.go()
              onMatch()
            }}
          >
            <svg className="together-art together-art--duel" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
              <rect className="together-table" x="33" y="33" width="34" height="34" />
              <circle className="together-seat--hand" cx="50" cy="11" r="11" />
              <circle cx="50" cy="89" r="11" />
            </svg>
            <span className="together-text">
              <b>{t.duel.matchCard}</b>
              <small>{t.duel.matchCardNote}</small>
              <span className="together-chips">
                <span className="together-chip">{t.duel.matchCardPlayers}</span>
                <span className="together-chip together-chip--ranked">{t.ranked.ranked}</span>
                {rating ? <LeagueChip rating={rating.rating} games={rating.games} rank={rating.masterRank} compact /> : null}
              </span>
            </span>
            <span className="together-go" aria-hidden="true">
              →
            </span>
          </button>
        ) : null}

        {onSignIn ? (
          <section className="together-signin" style={{ '--i': 1 } as CSSProperties}>
            <p className="note">{t.duel.signInLead}</p>
            <button type="button" className="btn btn--blue btn--block" onClick={onSignIn}>
              {t.duel.signIn}
            </button>
          </section>
        ) : null}

        {challenge ? (
          <button
            type="button"
            className="together-card together-card--challenge"
            style={{ '--i': 2 } as CSSProperties}
            onClick={() => {
              armSound()
              sound.tile('glass', 4)
              onChallenge()
            }}
          >
            <svg className="together-art together-art--challenge" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="together-disc" cx="50" cy="50" r="42" />
              <path className="together-slice" d="M50 50V12A38 38 0 0 1 88 50Z" />
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

/**
 * Une partie de duel quittée en cours — l'app fermée, la connexion perdue — et
 * pas encore jouée jusqu'au bout : l'accueil propose d'y revenir tant que la
 * réserve du joueur peut encore tenir. L'écarter, c'est abandonner.
 */
export function DuelResumeCard({ onResume, onDrop }: { onResume(): void; onDrop(): void }) {
  const t = useT()
  useEffect(() => {
    sound.pop()
  }, [])
  return (
    <section className="duel-invite-card duel-resume-card" aria-live="polite">
      <span className="duel-invite-card__text">
        <b>{t.ranked.resumeTitle}</b>
        <small>{t.ranked.resumeLead}</small>
      </span>
      <span className="duel-invite-card__actions">
        <button
          type="button"
          className="btn btn--blue"
          onClick={() => {
            armSound()
            sound.go()
            onResume()
          }}
        >
          {t.ranked.resume}
        </button>
        <button type="button" className="btn btn--quiet" onClick={onDrop}>
          {t.ranked.resign}
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
