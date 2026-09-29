import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { levelFor } from '../domain/progression'
import { rivalry, type SharedChallenge } from '../domain/rivalry'
import { formatNumber, useT } from '../i18n'
import type { BlockedPlayer, Friend } from '../lib/cloud'
import { inviteLinks, shareText, type ShareOutcome } from '../lib/native'
import { Avatar } from './Avatar'
import { PlayerName } from './PlayerSheet'
import { useBackDismiss } from './useBackDismiss'

type FriendSort = 'record' | 'alpha'
const SORT_KEY = 'friends-sort'

function loadSort(): FriendSort {
  try {
    return localStorage.getItem(SORT_KEY) === 'alpha' ? 'alpha' : 'record'
  } catch {
    return 'record'
  }
}

function saveSort(sort: FriendSort): void {
  try {
    localStorage.setItem(SORT_KEY, sort)
  } catch {
    // A sort order is a convenience: forgetting it costs a tap.
  }
}

export interface FriendsViewProps {
  /** The player's own account name, the one friends type. */
  name: string
  friends: readonly Friend[] | null | 'loading'
  blocks: readonly BlockedPlayer[]
  /** Who moderates is known to moderators alone: a player would know whom to lobby. */
  showModerator: boolean
  /** Null until the shared challenges are listed. */
  sharedWith(friendId: string): readonly SharedChallenge[] | null
  message: string | null
  onOpen(friendId: string): void
  onRespond(friendId: string, accept: boolean): void
  onCancel(friendId: string): void
  onUnblock(playerId: string): void
  /** Resolves to what to tell the player, and whether the request went out. */
  onRequest(name: string): Promise<{ said: string; done: boolean }>
  /** The debug board opens the sheet straight away, on either tab. */
  initialSheet?: AddTab
}

/** The Social tab once the account has a name: its card, requests received, then friends by record or by name. */
export function FriendsView(props: FriendsViewProps) {
  const t = useT()
  const [sort, setSort] = useState<FriendSort>(loadSort)
  const [adding, setAdding] = useState(props.initialSheet !== undefined)
  const [said, setSaid] = useState<string | null>(null)

  const list = props.friends === 'loading' || props.friends === null ? [] : props.friends
  const incoming = list.filter((friend) => friend.relation === 'incoming')
  const outgoing = list.filter((friend) => friend.relation === 'outgoing')
  const accepted = list
    .filter((friend) => friend.relation === 'friend')
    .sort((a, b) =>
      sort === 'alpha'
        ? a.name.localeCompare(b.name, t.tag, { sensitivity: 'base' })
        : b.bestScore - a.bestScore || b.xp - a.xp,
    )

  const choose = (next: FriendSort) => {
    setSort(next)
    saveSort(next)
  }
  const tell = (outcome: ShareOutcome) =>
    setSaid(outcome === 'copied' ? t.social.copied : outcome === 'failed' ? t.social.shareFailed : null)

  return (
    <>
      <div className="friends-me">
        <span className="friends-me-name">
          <span className="note">{t.social.nameLabel}</span>
          <strong>{props.name}</strong>
        </span>
        <button
          type="button"
          className="btn btn--ghost friends-me-share"
          onClick={async () => tell(await shareText(t.social.shareName(props.name)))}
        >
          {t.social.share}
        </button>
      </div>
      {(said ?? props.message) && <p className="note">{said ?? props.message}</p>}

      {props.friends === 'loading' && <p className="note">{t.loading}</p>}
      {props.friends === null && <p className="note note--warn">{t.social.loadFailed}</p>}

      {incoming.length > 0 && (
        <section className="friends-requests">
          <p className="section-title">{t.social.incomingCount(incoming.length)}</p>
          <ul className="friends">
            {incoming.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">
                  {/* Blocking, rare and heavy, waits behind the name rather than beside Accept. */}
                  <PlayerName name={friend.name} avatar={friend.avatar}>
                    {friend.name}
                  </PlayerName>
                  <span className="note">{t.social.wantsFriend}</span>
                </span>
                <span className="friend-answer">
                  <button
                    type="button"
                    className="friend-answer-yes"
                    aria-label={`${t.social.accept} ${friend.name}`}
                    onClick={() => props.onRespond(friend.id, true)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={`${t.social.decline} ${friend.name}`}
                    onClick={() => props.onRespond(friend.id, false)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.friends !== 'loading' && props.friends !== null && (
        <section className="stack">
          <div className="spread friends-head">
            <p className="section-title">{t.social.friends}</p>
            {accepted.length > 1 && (
              <div className="layer-tabs friends-sort" role="tablist" aria-label={t.social.sortLabel}>
                {(
                  [
                    ['record', t.social.sortRecord],
                    ['alpha', t.social.sortAlpha],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={sort === id}
                    className={`layer-tab${sort === id ? ' layer-tab--on' : ''}`}
                    onClick={() => choose(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {accepted.length === 0 ? (
            <p className="note">{t.social.none}</p>
          ) : (
            <ul className={`friends${sort === 'record' ? ' friends--ranked' : ''}`}>
              {accepted.map((friend, index) => (
                <FriendRow
                  key={friend.id}
                  friend={friend}
                  rank={sort === 'record' ? (friend.bestScore > 0 ? index + 1 : null) : undefined}
                  showModerator={props.showModerator}
                  shared={props.sharedWith(friend.id)}
                  onOpen={() => props.onOpen(friend.id)}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {(outgoing.length > 0 || props.blocks.length > 0) && (
        <details className="friends-more">
          <summary>{t.social.elsewhere(outgoing.length, props.blocks.length)}</summary>
          <ul className="friends">
            {outgoing.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">
                  <span>{friend.name}</span>
                  <span className="note">{t.social.outgoing}</span>
                </span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => props.onCancel(friend.id)}>
                    {t.cancel}
                  </button>
                </span>
              </li>
            ))}
            {props.blocks.map((blocked) => (
              <li key={blocked.id} className="friend">
                <Avatar choice={blocked.avatar} size="sm" />
                <span className="friend-name">
                  <span>{blocked.name}</span>
                  <span className="note">{t.social.blocked}</span>
                </span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => props.onUnblock(blocked.id)}>
                    {t.social.unblock}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <button type="button" className="btn btn--block friends-add" onClick={() => setAdding(true)}>
        {t.social.add}
      </button>
      {/* Out of the drawer: an animated ancestor would pin the layer to itself instead of the window. */}
      {adding &&
        createPortal(
          <AddFriendSheet
            name={props.name}
            initialTab={props.initialSheet}
            onRequest={props.onRequest}
            onClose={() => setAdding(false)}
          />,
          document.body,
        )}
    </>
  )
}

/** Record first; under the name, the level and how your challenges together went. */
function FriendRow({
  friend,
  rank,
  showModerator,
  shared,
  onOpen,
}: {
  friend: Friend
  /** A place when sorted by record, null for a friend with none; absent sorted by name. */
  rank: number | null | undefined
  showModerator: boolean
  shared: readonly SharedChallenge[] | null
  onOpen(): void
}) {
  const t = useT()
  const tally = shared && rivalry(shared, friend.id)
  const lead = tally ? Math.sign(tally.won - tally.lost) : 0

  return (
    <li>
      <button type="button" className="friend friend--open" onClick={onOpen} aria-label={t.social.openFriend(friend.name)}>
        {rank !== undefined && <span className="friend-rank">{rank ?? '–'}</span>}
        <Avatar choice={friend.avatar} size="sm" />
        <span className="friend-name">
          <span>
            {friend.name}
            {showModerator && friend.moderator && <span className="friend-moderator">{t.social.moderator}</span>}
          </span>
          <span className="note">
            {t.social.level(levelFor(friend.xp))}
            {tally && tally.won + tally.tied + tally.lost > 0 && (
              <>
                {' · '}
                <span className={`friend-tally${lead > 0 ? ' friend-tally--up' : lead < 0 ? ' friend-tally--down' : ''}`}>
                  {tally.won}–{tally.lost}
                </span>
              </>
            )}
            {friend.bestScore === 0 && ` · ${t.social.noRecord}`}
          </span>
        </span>
        <span className="friend-score">{friend.bestScore > 0 ? formatNumber(t, friend.bestScore) : '—'}</span>
      </button>
    </li>
  )
}

type AddTab = 'name' | 'invite'

/** Adding a friend: by account name when they have the game, by a shared link when they don't. */
export function AddFriendSheet({
  name,
  onRequest,
  onClose,
  initialTab = 'name',
}: {
  name: string
  onRequest(name: string): Promise<{ said: string; done: boolean }>
  onClose(): void
  initialTab?: AddTab
}) {
  const t = useT()
  const [tab, setTab] = useState<AddTab>(initialTab)
  const [wanted, setWanted] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const links = inviteLinks()

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])
  useBackDismiss(onClose)

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (wanted.trim() === '') return
    setBusy(true)
    const outcome = await onRequest(wanted.trim())
    setBusy(false)
    if (outcome.done) onClose()
    else setSaid(outcome.said)
  }

  const invite = async () => {
    const outcome = await shareText(t.social.inviteText(name, links))
    setSaid(outcome === 'copied' ? t.social.copied : outcome === 'failed' ? t.social.shareFailed : null)
  }

  const switchTo = (next: AddTab) => {
    setTab(next)
    setSaid(null)
  }

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="add-friend-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop add-friend">
        <h2 id="add-friend-title" className="offer-pop-title">
          {t.social.add}
        </h2>
        <div className="layer-tabs" role="tablist">
          {(
            [
              ['name', t.social.hasGame],
              ['invite', t.social.noGame],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`layer-tab${tab === id ? ' layer-tab--on' : ''}`}
              onClick={() => switchTo(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'name' ? (
          <form className="account-form" onSubmit={send}>
            <label className="field">
              <span>{t.social.namePlaceholder}</span>
              <input
                value={wanted}
                onChange={(event) => setWanted(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                maxLength={24}
              />
            </label>
            {said && <p className="note">{said}</p>}
            <button type="submit" className="btn btn--block" disabled={busy || wanted.trim() === ''}>
              {busy ? t.wait : t.social.send}
            </button>
          </form>
        ) : (
          <div className="stack">
            <p>{links.group ? t.social.inviteLead : t.social.inviteLeadWeb}</p>
            {said && <p className="note">{said}</p>}
            <button type="button" className="btn btn--blue btn--block" onClick={invite}>
              {t.social.sendInvite}
            </button>
          </div>
        )}
        <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
          {t.player.close}
        </button>
      </div>
    </div>
  )
}
