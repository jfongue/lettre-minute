import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChallengeSummary } from '../lib/cloud'
import type { AvatarChoice } from '../domain/avatar'
import type { RunRecord } from '../domain/history'
import { levelFor, levelProgress, type Profile } from '../domain/progression'
import { ADS_ENABLED } from '../domain/unlocks'
import {
  blockPlayer,
  fetchBlocks,
  fetchFriends,
  inviteModerator,
  removeFriend,
  requestFriend,
  respondFriend,
  unblockPlayer,
  type Account,
  type BlockedPlayer,
  type Friend,
  type ModerationStatus,
} from '../lib/cloud'
import {
  adPrivacyOptionsRequired,
  askPush,
  onAppResume,
  openPushSettings,
  pushState,
  pushSupported,
  showAdPrivacyOptions,
  type PushState,
} from '../lib/native'
import { formatNumber, LOCALES, useT, type Locale } from '../i18n'
import { sound as preview, type SoundPrefs } from '../lib/sound'
import type { Theme } from '../state/theme'
import { AccountPanel, type AccountActions, type AccountMode } from './AccountPanel'
import { CategoriesPage } from './CategoriesPage'
import { PageLinks } from './PageLinks'
import { RequestsPage } from './RequestsPage'
import { StatsPage } from './StatsPage'
import { DonateButton } from './Donate'
import { useSwipe } from './useSwipe'
import { Avatar } from './Avatar'

export type MenuPane = 'profile' | 'social' | 'options'
/** A page opened from the profile, which leads back to it. */
export type ProfilePage = 'stats' | 'requests' | 'categories'
export type MenuPage = MenuPane | ProfilePage

const PANES: readonly MenuPane[] = ['profile', 'social', 'options']
const PROFILE_PAGES: readonly ProfilePage[] = ['stats', 'requests', 'categories']

function isPane(page: MenuPage): page is MenuPane {
  return (PANES as readonly string[]).includes(page)
}

// A published app must link its privacy policy. Inside the phone shell a
// relative link would navigate the game's own view away, hence a full URL.
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || '/confidentialite.html'

interface MenuProps {
  /** Where the drawer opens: a tab, or one of the profile's pages. */
  page: MenuPage
  profile: Profile
  /** Newest first, for the statistics. */
  history: readonly RunRecord[]
  avatar: AvatarChoice
  /** Null while the game runs without a server: the player has no account, only an avatar. */
  account: Account | null
  accountActions: AccountActions
  /** The account form's opening tab. */
  accountMode?: AccountMode
  /** On the statistics: open straight onto the old challenges. */
  focusChallenges?: boolean
  /** Friend requests waiting: a dot on the social tab. */
  friendRequests: number
  /** Each fresh friend list, for the home screen's dot and the notifications offer. */
  onFriends(friends: readonly Friend[]): void
  theme: Theme
  onTheme(theme: Theme): void
  locale: Locale
  onLocale(locale: Locale): void
  sound: SoundPrefs
  onSound(sound: SoundPrefs): void
  onAvatar(): void
  onLogOut(): void
  /** Answers false when the server could not erase the account. */
  onErase(): Promise<boolean>
  /** Null without a server: nothing about moderation shows. */
  moderation: ModerationStatus | null
  onModerate(): void
  /** Null without an account; the statistics list the hidden ones. */
  challenges: readonly ChallengeSummary[] | null
  onChallenge(id: string): void
  onRequestsSeen(): void
  onRequestsOpen(): void
  onClose(): void
}

export function Menu({ onClose, page, ...props }: MenuProps) {
  const t = useT()
  const [pane, setPane] = useState<MenuPane>(isPane(page) ? page : 'profile')
  const [sub, setSub] = useState<ProfilePage | null>(isPane(page) ? null : page)
  const body = useRef<HTMLDivElement>(null)
  const open = (next: MenuPage) => {
    setPane(isPane(next) ? next : 'profile')
    setSub(isPane(next) ? null : next)
    body.current?.scrollTo({ top: 0 })
  }
  const drawer = useRef<HTMLElement>(null)
  // The drawer came in from the left: a flick back that way sends it home.
  const swipe = useSwipe('left', onClose)

  useEffect(() => {
    drawer.current?.focus()
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    // The home screen behind must not scroll under the player's thumb.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', close)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="menu-layer">
      <div className="menu-scrim" onClick={onClose} />
      <aside
        className="menu"
        role="dialog"
        aria-modal="true"
        aria-label={t.menu.title}
        tabIndex={-1}
        ref={drawer}
        {...swipe}
      >
        <div className="menu-head">
          <div className="layer-tabs menu-tabs" role="tablist">
            {PANES.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pane === id}
                className={`layer-tab${pane === id ? ' layer-tab--on' : ''}`}
                onClick={() => open(id)}
              >
                {t.menu.panes[id]}
                {id === 'social' && props.friendRequests > 0 && <span className="badge-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
          <button type="button" className="menu-close" aria-label={t.menu.close} title={t.menu.close} onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="menu-body" ref={body}>
          {sub && (
            <div className="subpage-head">
              <button type="button" className="subpage-back" onClick={() => open('profile')} aria-label={t.menu.back}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <h2 className="subpage-title">{t.menu.pages[sub]}</h2>
            </div>
          )}
          {sub === 'stats' && (
            <StatsPage
              history={props.history}
              profile={props.profile}
              challenges={props.challenges}
              focusChallenges={props.focusChallenges}
              onChallenge={props.onChallenge}
            />
          )}
          {sub === 'requests' && (
            <RequestsPage
              moderation={props.moderation}
              onModerate={props.onModerate}
              onSeen={props.onRequestsSeen}
              onOpen={props.onRequestsOpen}
            />
          )}
          {sub === 'categories' && <CategoriesPage profile={props.profile} />}
          {!sub && pane === 'profile' && <ProfilePane {...props} onPage={open} />}
          {pane === 'social' && (
            <SocialPane
              account={props.account}
              moderator={props.moderation?.moderator ?? false}
              onProfile={() => open('profile')}
              onFriends={props.onFriends}
            />
          )}
          {pane === 'options' && (
            <OptionsPane
              theme={props.theme}
              onTheme={props.onTheme}
              locale={props.locale}
              onLocale={props.onLocale}
              sound={props.sound}
              onSound={props.onSound}
              onErase={props.onErase}
              named={Boolean(props.account && !props.account.anonymous)}
            />
          )}
        </div>
      </aside>
    </div>
  )
}

function ProfilePane({
  profile,
  avatar,
  account,
  accountActions,
  accountMode,
  onAvatar,
  onLogOut,
  moderation,
  onPage,
}: Omit<
  MenuProps,
  | 'onClose'
  | 'page'
  | 'history'
  | 'theme'
  | 'onTheme'
  | 'locale'
  | 'onLocale'
  | 'sound'
  | 'onSound'
  | 'onModerate'
  | 'onRequestsSeen'
  | 'onRequestsOpen'
  | 'onErase'
  | 'focusChallenges'
  | 'friendRequests'
  | 'onFriends'
> & {
  onPage(page: ProfilePage): void
}) {
  const t = useT()
  const named = account && !account.anonymous

  return (
    <div className="profile-pane">
      <section className="player">
        <button type="button" className="player-avatar" onClick={onAvatar} aria-label={t.menu.editAvatarLabel}>
          <Avatar choice={avatar} size="md" />
        </button>
        <div className="player-id">
          <strong>{named && !account.needsName ? account.name : t.menu.anonymous}</strong>
          <span className="note">
            {t.menu.standing(levelProgress(profile.xp).level, formatNumber(t, profile.bestScore))}
          </span>
          <button type="button" className="btn btn--quiet" onClick={onAvatar}>
            {t.menu.editAvatar}
          </button>
        </div>
      </section>

      {named && (
        <div className="stack">
          {account.email && <p className="note">{t.menu.signedInAs(account.email)}</p>}
          <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={onLogOut}>
            {t.menu.logOut}
          </button>
        </div>
      )}

      {(account?.anonymous || account?.needsName) && (
        <AccountPanel
          title={t.menu.accountTitle}
          lead={t.menu.accountLead}
          needsName={account.needsName}
          initialMode={accountMode}
          {...accountActions}
        />
      )}

      {!account && <p className="note">{t.menu.offline}</p>}

      <PageLinks
        pages={PROFILE_PAGES}
        badges={{ requests: moderation?.news ?? 0 }}
        onOpen={(next) => next !== 'profile' && onPage(next)}
      />

      <DonateButton className="btn btn--ghost btn--block menu-support" label={t.menu.support} />
    </div>
  )
}

function SocialPane({
  account,
  moderator,
  onProfile,
  onFriends,
}: {
  account: Account | null
  /** A moderator can put a friend forward to become one. */
  moderator: boolean
  onProfile(): void
  onFriends(friends: readonly Friend[]): void
}) {
  const t = useT()
  const [friends, setFriends] = useState<Friend[] | null | 'loading'>('loading')
  const [blocks, setBlocks] = useState<BlockedPlayer[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const named = account && !account.anonymous

  const refresh = () => {
    fetchBlocks().then((list) => setBlocks(list ?? []))
    return fetchFriends().then((list) => {
      setFriends(list)
      if (list) onFriends(list)
    })
  }

  useEffect(() => {
    if (named) refresh()
  }, [named, account?.name])

  if (!account) {
    return <p className="note">{t.social.noServer}</p>
  }

  if (!named) {
    return (
      <div className="stack">
        <p className="note">{t.social.needAccount}</p>
        <button type="button" className="btn btn--block" onClick={onProfile}>
          {t.social.createAccount}
        </button>
      </div>
    )
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    const wanted = name.trim()
    if (wanted === '') return
    setBusy(true)
    const outcome = await requestFriend(wanted)
    setBusy(false)
    setMessage(t.social.requests[outcome](wanted))
    if (outcome === 'sent' || outcome === 'accepted') {
      setName('')
      refresh()
    }
  }

  const act = async (work: Promise<boolean>) => {
    if (!(await work)) setMessage(t.social.requests.unreachable(''))
    refresh()
  }

  const list = friends === 'loading' || friends === null ? [] : friends
  const incoming = list.filter((friend) => friend.relation === 'incoming')
  const accepted = list
    .filter((friend) => friend.relation === 'friend')
    .sort((a, b) => b.weekBest - a.weekBest || b.xp - a.xp)
  const outgoing = list.filter((friend) => friend.relation === 'outgoing')

  return (
    <>
      <form className="account-form" onSubmit={send}>
        <label className="field">
          <span>{t.social.add}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.social.addPlaceholder}
            autoComplete="off"
            autoCapitalize="off"
            maxLength={24}
          />
        </label>
        {message && <p className="note">{message}</p>}
        <button type="submit" className="btn btn--block" disabled={busy || name.trim() === ''}>
          {busy ? t.wait : t.social.send}
        </button>
        <p className="note">
          {t.social.yourName[0]}
          <strong>{account.name}</strong>
          {t.social.yourName[1]}
        </p>
      </form>

      {friends === 'loading' && <p className="note">{t.loading}</p>}
      {friends === null && <p className="note note--warn">{t.social.loadFailed}</p>}

      {incoming.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.social.incoming}</p>
          <ul className="friends">
            {incoming.map((friend) => (
              <IncomingRow
                key={friend.id}
                friend={friend}
                onAccept={() => act(respondFriend(friend.id, true))}
                onDecline={() => act(respondFriend(friend.id, false))}
                onBlock={() => act(blockPlayer(friend.name).then((outcome) => outcome === 'blocked'))}
              />
            ))}
          </ul>
        </section>
      )}

      {friends !== 'loading' && friends !== null && (
        <section className="stack">
          <div className="spread">
            <p className="section-title">{t.social.friends}</p>
            <p className="note">{accepted.length}</p>
          </div>
          {accepted.length === 0 ? (
            <p className="note">{t.social.none}</p>
          ) : (
            <ul className="friends">
              {accepted.map((friend) => (
                <FriendRow
                  key={friend.id}
                  friend={friend}
                  showModerator={moderator}
                  onRemove={() => act(removeFriend(friend.id))}
                  onElect={
                    moderator && !friend.moderator
                      ? async () => setMessage(t.social.invites[await inviteModerator(friend.id)](friend.name))
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.social.outgoing}</p>
          <ul className="friends">
            {outgoing.map((friend) => (
              <li key={friend.id} className="friend">
                <Avatar choice={friend.avatar} size="sm" />
                <span className="friend-name">{friend.name}</span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => act(removeFriend(friend.id))}>
                    {t.cancel}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocks.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.social.blocked}</p>
          <ul className="friends">
            {blocks.map((blocked) => (
              <li key={blocked.id} className="friend">
                <Avatar choice={blocked.avatar} size="sm" />
                <span className="friend-name">{blocked.name}</span>
                <span className="friend-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => act(unblockPlayer(blocked.id))}>
                    {t.social.unblock}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

/** A request can be declined, or its sender blocked — which takes a second, explicit tap. */
function IncomingRow({
  friend,
  onAccept,
  onDecline,
  onBlock,
}: {
  friend: Friend
  onAccept(): void
  onDecline(): void
  onBlock(): void
}) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  return (
    <li className="friend">
      <Avatar choice={friend.avatar} size="sm" />
      <span className="friend-name">
        <span>{friend.name}</span>
        {confirming && <span className="note">{t.player.blockWarning(friend.name)}</span>}
      </span>
      <span className="friend-actions">
        {confirming ? (
          <>
            <button type="button" className="btn btn--quiet" onClick={onBlock}>
              {t.player.blockConfirm}
            </button>
            <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(false)}>
              {t.cancel}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--quiet" onClick={onAccept}>
              {t.social.accept}
            </button>
            <button type="button" className="btn btn--quiet btn--muted" onClick={onDecline}>
              {t.social.decline}
            </button>
            <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(true)}>
              {t.player.block}
            </button>
          </>
        )}
      </span>
    </li>
  )
}

/** Removing a friend takes a second tap: a stray one would cost a request and a wait. */
function FriendRow({
  friend,
  showModerator,
  onRemove,
  onElect,
}: {
  friend: Friend
  /** Who moderates is known to moderators alone: a player would know whom to lobby. */
  showModerator: boolean
  onRemove(): void
  onElect?(): Promise<void>
}) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [electing, setElecting] = useState(false)

  return (
    <li className="friend">
      <Avatar choice={friend.avatar} size="sm" />
      <span className="friend-name">
        <span>
          {friend.name}
          {showModerator && friend.moderator && <span className="friend-moderator">{t.social.moderator}</span>}
        </span>
        <span className="note">
          {t.social.stats(levelFor(friend.xp), formatNumber(t, friend.weekBest), formatNumber(t, friend.bestScore))}
        </span>
      </span>
      <span className="friend-actions">
        {onElect && !confirming && (
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
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setConfirming(true)}>
            {t.social.remove}
          </button>
        )}
      </span>
    </li>
  )
}

const THEMES: readonly Theme[] = ['system', 'light', 'dark']
const SOUND_CHANNELS = ['master', 'effects', 'keys', 'music'] as const

/** The music is heard as it plays; the effects and keys need a sample. */
function previewChannel(id: (typeof SOUND_CHANNELS)[number]): void {
  if (id === 'effects' || id === 'master') preview.found(1, 2)
  else if (id === 'keys') preview.key()
}

interface OptionsPaneProps {
  theme: Theme
  onTheme(theme: Theme): void
  locale: Locale
  onLocale(locale: Locale): void
  sound: SoundPrefs
  onSound(sound: SoundPrefs): void
  onErase(): Promise<boolean>
  /** Pushes announce challenges, which only an account receives. */
  named: boolean
}

function OptionsPane({ theme, onTheme, locale, onLocale, sound, onSound, onErase, named }: OptionsPaneProps) {
  const t = useT()
  // Once an ad has asked for consent, EU law requires a way back to that form.
  const [adChoices, setAdChoices] = useState(false)
  useEffect(() => {
    let live = true
    if (!ADS_ENABLED) return
    adPrivacyOptionsRequired().then((required) => live && setAdChoices(required))
    return () => {
      live = false
    }
  }, [])
  return (
    <>
      <section className="stack">
        <p className="section-title">{t.options.theme}</p>
        <div className="layer-tabs" role="radiogroup" aria-label={t.options.theme}>
          {THEMES.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              className={`layer-tab${theme === id ? ' layer-tab--on' : ''}`}
              onClick={() => onTheme(id)}
            >
              {t.options.themes[id]}
            </button>
          ))}
        </div>
      </section>

      <section className="stack">
        <p className="section-title">{t.options.sound}</p>
        <div className="volumes" data-no-swipe>
          {SOUND_CHANNELS.map((id) => (
            <label key={id} className="volume">
              <span className="volume-name">{t.options.sounds[id]}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(sound[id] * 100)}
                onChange={(event) => onSound({ ...sound, [id]: Number(event.target.value) / 100, muted: false })}
                // Heard once the thumb is let go, not at every notch it crosses.
                onPointerUp={() => previewChannel(id)}
                onKeyUp={() => previewChannel(id)}
              />
              <span className="volume-value">{sound[id] === 0 ? t.options.soundOff : `${Math.round(sound[id] * 100)}`}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="stack">
        <p className="section-title">{t.options.language}</p>
        <div className="language-list" role="radiogroup" aria-label={t.options.language}>
          {LOCALES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={locale === entry.id}
              lang={entry.id}
              className={`layer-tab${locale === entry.id ? ' layer-tab--on' : ''}`}
              onClick={() => onLocale(entry.id)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      </section>

      {pushSupported() && <NotificationOptions named={named} />}

      <div className="menu-foot">
        <a className="btn btn--quiet menu-start" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          {t.options.privacy}
        </a>
        {adChoices && (
          <button type="button" className="btn btn--quiet menu-start" onClick={showAdPrivacyOptions}>
            {t.options.adPrivacy}
          </button>
        )}
        <EraseData onErase={onErase} />
      </div>
    </>
  )
}

/**
 * Once refused, only the phone's settings can let the game notify again: the
 * state is read anew each time the player comes back from them.
 */
function NotificationOptions({ named }: { named: boolean }) {
  const t = useT()
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => {
    let live = true
    const read = () => pushState().then((next) => live && setState(next))
    read()
    const stop = onAppResume(read)
    return () => {
      live = false
      stop()
    }
  }, [])
  if (state === null) return null
  return (
    <section className="stack">
      <p className="section-title">{t.options.notifications}</p>
      <p className="note">{named ? t.options.push[state] : t.options.pushAccount}</p>
      {state === 'ask' ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => askPush().then(setState)}>
          {t.options.pushAllow}
        </button>
      ) : (
        <button type="button" className="btn btn--ghost btn--block" onClick={openPushSettings}>
          {t.options.pushSettings}
        </button>
      )}
    </section>
  )
}

/** Erasing is irreversible, so it takes a second, explicit tap. */
function EraseData({ onErase }: { onErase(): Promise<boolean> }) {
  const t = useT()
  const [step, setStep] = useState<'idle' | 'confirm' | 'erasing' | 'failed' | 'done'>('idle')

  const erase = async () => {
    setStep('erasing')
    setStep((await onErase()) ? 'done' : 'failed')
  }

  switch (step) {
    case 'idle':
      return (
        <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={() => setStep('confirm')}>
          {t.options.erase}
        </button>
      )
    case 'confirm':
    case 'erasing':
      return (
        <p className="erase-confirm">
          <span className="note">{t.options.eraseWarning}</span>
          <button type="button" className="btn btn--quiet" onClick={erase} disabled={step === 'erasing'}>
            {step === 'erasing' ? t.options.erasing : t.options.eraseAll}
          </button>
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setStep('idle')}>
            {t.cancel}
          </button>
        </p>
      )
    case 'failed':
      return (
        <p className="erase-confirm">
          <span className="note note--warn">{t.options.eraseFailed}</span>
          <button type="button" className="btn btn--quiet" onClick={erase}>
            {t.options.retry}
          </button>
        </p>
      )
    case 'done':
      return <p className="note">{t.options.erased}</p>
  }
}
