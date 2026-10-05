import { useState } from 'react'
import { levelFor } from '../domain/progression'
import { faceOff, rivalry, type SharedChallenge, type SharedPlayer } from '../domain/rivalry'
import { formatNumber, useT, type Messages } from '../i18n'
import type { Friend } from '../lib/cloud'
import { challengeTitle } from '../state/challenges'
import { Avatar } from './Avatar'
import { Figure } from './bauhaus'
import { useFeature } from './features'

function formatDate(t: Messages, at: number): string {
  return new Date(at).toLocaleString(t.tag, { day: 'numeric', month: 'short' })
}

interface FriendPageProps {
  friend: Friend
  /** Newest first; null when the server could not list them. */
  challenges: readonly SharedChallenge[] | null
  /** False while some shared challenges are still being settled. */
  complete: boolean
  /** Who moderates is known to moderators alone. */
  showModerator: boolean
  onBack(): void
  onChallenge(id: string): void
  /** Absent quand les défis sont fermés. */
  onChallengeFriend?(): void
  onRemove(): void
  onElect?(): Promise<void>
}

/** A friend's page: how the two of you fare in challenges, and each one you shared. */
export function FriendPage({
  friend,
  challenges,
  complete,
  showModerator,
  onBack,
  onChallenge,
  onChallengeFriend,
  onRemove,
  onElect,
}: FriendPageProps) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [electing, setElecting] = useState(false)
  const faceOff = useFeature('rivalry')
  const tally = faceOff && challenges && rivalry(challenges, friend.id)

  return (
    <div className="friend-page">
      <div className="subpage-head">
        <button type="button" className="subpage-back" onClick={onBack} aria-label={t.menu.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h2 className="subpage-title">{friend.name}</h2>
      </div>

      <section className="player">
        <Avatar choice={friend.avatar} size="md" />
        <div className="player-id">
          <span className="note">
            {t.social.stats(levelFor(friend.xp), formatNumber(t, friend.weekBest), formatNumber(t, friend.bestScore))}
            {showModerator && friend.moderator && <span className="friend-moderator">{t.social.moderator}</span>}
          </span>
          {onChallengeFriend ? (
            <button type="button" className="btn btn--quiet menu-start" onClick={onChallengeFriend}>
              {t.social.challengeFriend}
            </button>
          ) : null}
        </div>
      </section>

      {tally && tally.won + tally.tied + tally.lost > 0 && (
        <section className="stack">
          <p className="section-title">{t.social.faceOff}</p>
          <div className="figures face-off">
            <Figure tint="green" value={tally.won} label={t.social.won(tally.won)} />
            {/* Ties are rare enough that a zero would only take room. */}
            {tally.tied > 0 && <Figure tint="yellow" value={tally.tied} label={t.social.tied(tally.tied)} />}
            <Figure tint="red" value={tally.lost} label={t.social.lost(tally.lost)} />
          </div>
          <div className="face-off-points">
            <span>
              <strong>{formatNumber(t, tally.mine)}</strong>
              <span className="note">{t.social.myPoints}</span>
            </span>
            <span className="note" aria-hidden="true">–</span>
            <span>
              <strong>{formatNumber(t, tally.theirs)}</strong>
              <span className="note">{t.social.theirPoints}</span>
            </span>
          </div>
        </section>
      )}

      <section className="stack">
        <p className="section-title">{t.social.together}</p>
        {challenges === null && <p className="note note--warn">{t.social.historyFailed}</p>}
        {challenges?.length === 0 && <p className="note">{complete ? t.social.togetherNone : t.social.settling}</p>}
        {challenges && challenges.length > 0 && (
          <ul className="run-list shared-challenges">
            {challenges.map((challenge) => (
              <SharedRow key={challenge.id} challenge={challenge} friend={friend} onOpen={() => onChallenge(challenge.id)} />
            ))}
          </ul>
        )}
        {challenges && challenges.length > 0 && !complete && <p className="note">{t.social.settling}</p>}
      </section>

      <div className="friend-page-actions">
        {onElect && !friend.moderator && (
          <button
            type="button"
            className="btn btn--quiet"
            aria-label={t.social.electLabel(friend.name)}
            disabled={electing}
            onClick={async () => {
              setElecting(true)
              await onElect()
              setElecting(false)
            }}
          >
            {t.social.elect}
          </button>
        )}
        {confirming ? (
          <>
            <button type="button" className="btn btn--quiet" onClick={onRemove}>
              {t.social.remove}
            </button>
            <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(false)}>
              {t.social.keep}
            </button>
          </>
        ) : (
          // Removing takes a second tap: a stray one would cost a request and a wait.
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(true)}>
            {t.social.removeNamed(friend.name)}
          </button>
        )}
      </div>
    </div>
  )
}

function SharedRow({ challenge, friend, onOpen }: { challenge: SharedChallenge; friend: Friend; onOpen(): void }) {
  const t = useT()
  const outcome = faceOff(challenge, friend.id)
  const me = challenge.players.find((player) => player.me)
  const them = challenge.players.find((player) => player.playerId === friend.id)
  const line = (player: SharedPlayer | undefined, name: string, absent: string) => {
    if (!player?.played) return absent
    const rank = player.rank === null ? '' : `${t.social.rank(player.rank)} · `
    return `${name} ${rank}${formatNumber(t, player.score)}`
  }

  return (
    <li>
      <span className="old-challenge-id">
        <button type="button" className="btn btn--quiet menu-start" onClick={onOpen}>
          {challengeTitle(t, challenge)}
        </button>
        <span className="note">
          {formatDate(t, challenge.createdAt)} · {t.social.players(challenge.players.length)}
        </span>
        <span className="note shared-scores">
          <span>{line(me, t.social.you, t.social.youNotPlayed)}</span>
          <span>{line(them, friend.name, t.social.notPlayed(friend.name))}</span>
        </span>
      </span>
      <span className={`outcome outcome--${outcome}`}>{t.social.outcomes[outcome]}</span>
    </li>
  )
}
