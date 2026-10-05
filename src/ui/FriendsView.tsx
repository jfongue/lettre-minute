import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { AvatarChoice } from '../domain/avatar'
import { levelFor } from '../domain/progression'
import { rivalry, type SharedChallenge } from '../domain/rivalry'
import { formatNumber, useT } from '../i18n'
import { sound } from '../lib/sound'
import type { BlockedPlayer, Friend } from '../lib/cloud'
import { isNativeApp, shareText, type ShareOutcome } from '../lib/native'
import { invitePage } from '../../supabase/functions/invite/mail'
import { Avatar } from './Avatar'
import { PlayerName } from './PlayerSheet'
import { useBackDismiss } from './useBackDismiss'
import { useFeature } from './features'

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
  /** Worn beside the player's name. */
  avatar: AvatarChoice
  onAvatar(): void
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
  onInvite(email: string): Promise<{ said: string; done: boolean }>
  /** What a shared link carries to befriend its reader (0034); null until known. */
  inviteCode: string | null
  /** The debug board opens the sheet straight away, on either tab. */
  initialSheet?: AddTab
}

/** The Social tab once the account has a name: its card, requests received, then friends by record or by name. */
export function FriendsView(props: FriendsViewProps) {
  const t = useT()
  const avatars = useFeature('avatar')
  const [sort, setSort] = useState<FriendSort>(loadSort)
  const [adding, setAdding] = useState(props.initialSheet !== undefined)

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
  return (
    <>
      <div className="friends-me">
        <button type="button" className="player-avatar" onClick={avatars ? props.onAvatar : undefined} disabled={!avatars} aria-label={t.menu.editAvatarLabel}>
          <Avatar choice={props.avatar} size="md" />
        </button>
        <span className="friends-me-name">
          <span className="note">{t.social.nameLabel}</span>
          <strong>{props.name}</strong>
        </span>
      </div>
      <button type="button" className="btn btn--block friends-add" onClick={() => setAdding(true)}>
        {t.social.add}
      </button>
      {props.message && <p className="note">{props.message}</p>}

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

      {/* Out of the drawer: an animated ancestor would pin the layer to itself instead of the window. */}
      {adding &&
        createPortal(
          <AddFriendSheet
            name={props.name}
            initialTab={props.initialSheet}
            onRequest={props.onRequest}
            onInvite={props.onInvite}
            inviteCode={props.inviteCode}
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
  const faceOff = useFeature('rivalry')
  const tally = faceOff && shared && rivalry(shared, friend.id)
  const lead = tally ? Math.sign(tally.won - tally.lost) : 0

  return (
    <li>
      <button type="button" className="friend friend--open" onClick={onOpen} aria-label={t.social.openFriend(friend.name)}>
        {rank !== undefined && <span className="friend-rank">{rank ?? '–'}</span>}
        <Avatar choice={friend.avatar} size="sm" />
        <span className="friend-name">
          <span>
            {friend.name}
            {showModerator && friend.moderator && (
              <span className="friend-moderator" title={t.social.moderator} aria-label={t.social.moderator}>
                {t.social.moderatorShort}
              </span>
            )}
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
  onInvite,
  inviteCode,
  onClose,
  initialTab = 'name',
}: {
  name: string
  onRequest(name: string): Promise<{ said: string; done: boolean }>
  /** Resolves to what to tell the player, and whether the mail went out. */
  onInvite(email: string): Promise<{ said: string; done: boolean }>
  inviteCode: string | null
  onClose(): void
  initialTab?: AddTab
}) {
  const t = useT()
  const invites = useFeature('friendInvite')
  const [tab, setTab] = useState<AddTab>(invites ? initialTab : 'name')
  const [wanted, setWanted] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)

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
    if (outcome.done) sound.sent()
    if (outcome.done) onClose()
    else setSaid(outcome.said)
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
        <div className="layer-tabs" role="tablist" hidden={!invites}>
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
          <InvitePanel name={name} code={inviteCode} onInvite={onInvite} />
        )}
        <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
          {t.player.close}
        </button>
      </div>
    </div>
  )
}

/** Chat apps by their own names: proper nouns, the same in every language. */
const CHAT_APPS = [
  { id: 'whatsapp', label: 'WhatsApp', href: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}` },
  // Messenger shares from its app only: the web dialog asks for a Facebook app id.
  { id: 'messenger', label: 'Messenger', native: true, href: (_: string, link: string) => `fb-messenger://share/?link=${encodeURIComponent(link)}` },
  { id: 'telegram', label: 'Telegram', href: (text: string, link: string) => `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(link, '').trim())}` },
  { id: 'sms', label: 'SMS', href: (text: string) => `sms:?&body=${encodeURIComponent(text)}` },
] as const

function InvitePanel({
  name,
  code,
  onInvite,
}: {
  name: string
  code: string | null
  onInvite(email: string): Promise<{ said: string; done: boolean }>
}) {
  const t = useT()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const link = invitePage(name, code)
  const text = t.social.inviteText(link)
  const native = isNativeApp()

  const tell = (outcome: ShareOutcome, copied = t.social.copied) =>
    setSaid(outcome === 'copied' ? copied : outcome === 'failed' ? t.social.shareFailed : null)

  // Discord has no share link: the text goes to the clipboard, to paste there.
  const discord = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setSaid(t.social.discordCopied)
    } catch {
      setSaid(t.social.shareFailed)
    }
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (email.trim() === '') return
    setBusy(true)
    const outcome = await onInvite(email.trim())
    setBusy(false)
    setSaid(outcome.said)
    if (outcome.done) sound.sent()
    if (outcome.done) setEmail('')
  }

  return (
    <div className="stack invite-panel">
      <p>{t.social.inviteLead}</p>
      <div className="chat-apps">
        {CHAT_APPS.filter((app) => native || !('native' in app)).map((app) => (
          <a
            key={app.id}
            className={`chat-app chat-app--${app.id}`}
            href={app.href(text, link)}
            target="_blank"
            rel="noopener noreferrer"
            data-track={`invite-${app.id}`}
          >
            {app.label}
          </a>
        ))}
        <button type="button" className="chat-app chat-app--discord" onClick={discord} data-track="invite-discord">
          Discord
        </button>
        <button type="button" className="chat-app chat-app--other" onClick={async () => tell(await shareText(text))}>
          {t.social.otherApps}
        </button>
      </div>
      {said && <p className="note">{said}</p>}
      <form className="account-form" onSubmit={send}>
        <label className="field">
          <span>{t.social.byEmail}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.social.emailPlaceholder}
            autoComplete="off"
            autoCapitalize="off"
            maxLength={254}
          />
        </label>
        <button type="submit" className="btn btn--block" disabled={busy || email.trim() === ''}>
          {busy ? t.wait : t.social.sendInvite}
        </button>
      </form>
    </div>
  )
}
