import { useEffect, useRef, useState } from 'react'
import type { ChallengeSummary } from '../lib/cloud'
import type { AvatarChoice } from '../domain/avatar'
import type { RunRecord } from '../domain/history'
import { levelProgress, type Profile } from '../domain/progression'
import { ADS_ENABLED } from '../domain/unlocks'
import { banNews } from '../domain/perks'
import {
  fetchBlocks,
  fetchFriends,
  inviteModerator,
  removeFriend,
  requestFriend,
  inviteTester,
  fetchInviteCode,
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
import { previewSound, type SoundPrefs } from '../lib/sound'
import type { Theme } from '../state/theme'
import { AccountPanel, type AccountActions, type AccountMode } from './AccountPanel'
import { AchievementsPanel } from './AchievementsPanel'
import { AvatarPanel } from './AvatarPanel'
import { CategoriesPage, type BanActions } from './CategoriesPage'
import { LeaderboardsPage } from './LeaderboardsPage'
import { PageLinks } from './PageLinks'
import { RequestsPage } from './RequestsPage'
import { StatsPage, type RecapActions } from './StatsPage'
import { FriendPage } from './FriendPage'
import { useFriendHistory } from '../state/rivalry'
import { FriendsView } from './FriendsView'
import { useHiddenTaps } from './useHiddenTaps'
import { useFeature } from './features'
import { host } from '../platform'
import { useSwipe } from './useSwipe'
import { Avatar } from './Avatar'

export type MenuPane = 'profile' | 'social' | 'options'
/** A page opened from a tab, which leads back to it. */
export type ProfilePage = 'stats' | 'requests' | 'categories' | 'boards' | 'avatar'
export type MenuPage = MenuPane | ProfilePage

const PANES: readonly MenuPane[] = ['profile', 'social', 'options']
const PROFILE_PAGES: readonly Exclude<ProfilePage, 'boards' | 'avatar'>[] = ['stats', 'requests', 'categories']

function isPane(page: MenuPage): page is MenuPane {
  return (PANES as readonly string[]).includes(page)
}

// A published app must link its privacy policy. Inside the phone shell a
// relative link would navigate the game's own view away, so the address must
// be a full URL: without one, the link is not shown at all.
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL

interface MenuProps {
  /** Where the drawer opens: a tab, or one of the profile's pages. */
  page: MenuPage
  /** Closed, and sliding out: it no longer answers the finger. */
  leaving?: boolean
  /**
   * Ce que le retour de la page d'ouverture fait : le profil du tiroir, ou le
   * tiroir entier. Une page ouverte depuis le bilan de fin de partie se ferme,
   * parce qu'il n'y a pas de profil derrière elle.
   */
  back?: 'profile' | 'close'
  profile: Profile
  /** Newest first, for the statistics. */
  history: readonly RunRecord[]
  avatar: AvatarChoice
  /** Garde l'avatar choisi : l'écran de fin de partie y revient. */
  onAvatarSave(avatar: AvatarChoice): void
  /** Les découvertes que seul le serveur compte, pour la barre des succès. */
  discoveries?: number
  /** Null while the game runs without a server: the player has no account, only an avatar. */
  account: Account | null
  accountActions: AccountActions
  /** The account form's opening tab. */
  accountMode?: AccountMode
  /** On the statistics: open straight onto the old challenges. */
  focusChallenges?: boolean
  /** The Social tab opens on « Ajouter un ami », on the invitation side. */
  inviteOpen?: boolean
  /** Relit les parties du compte : la page des statistiques la redemande à chaque ouverture. */
  onStatsRefresh(): Promise<unknown>
  /** The account's older runs, a page at a time; absent without a server. */
  onStatsOlder?(before: number, limit: number): Promise<RunRecord[] | null>
  statsRecap: RecapActions
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
  onLogOut(): void
  /** Answers false when the server could not erase the account. */
  onErase(): Promise<boolean>
  /** Null without a server: nothing about moderation shows. */
  moderation: ModerationStatus | null
  queueAlert?: boolean
  onModerate(): void
  /** Null without an account; the statistics list the hidden ones. */
  challenges: readonly ChallengeSummary[] | null
  onChallenge(id: string): void
  /** From a friend's page: a new challenge with them ticked; absent when challenges are closed. */
  onChallengeFriend?(friendId: string): void
  onRequestsSeen(): void
  onRequestsOpen(): void
  /** La langue du dictionnaire, comme celle de la partie : celle de l'interface. */
  lang: string
  /** Les classements avancés : le mode débug, ouvert par cinq tapes sur « Classements ». */
  advancedBoards: boolean
  onAdvancedBoards?(open: boolean): void
  /** Le tableau des mots : l'autre mode débug, ouvert par cinq tapes sur « Mes catégories ». */
  onWordsBoard?(open: boolean): void
  /** Le réglage des fonctionnalités, pour un super modérateur seul. */
  onFeatures?(): void
  /** Bans and Premium, from « Mes catégories ». */
  banActions: BanActions
  onClose(): void
}

export function Menu({ onClose, page, leaving = false, ...props }: MenuProps) {
  const t = useT()
  const friends = useFeature('friends')
  const leaderboards = useFeature('leaderboards')
  const avatars = useFeature('avatar')
  const achievements = useFeature('achievements')
  const [pane, setPane] = useState<MenuPane>(isPane(page) ? page : 'profile')
  const [sub, setSub] = useState<ProfilePage | null>(isPane(page) ? null : page)
  const body = useRef<HTMLDivElement>(null)
  // Cinq tapes rapprochées sur le titre de la page : le mode débug des
  // classements, ou celui des mots. Le compte survit au tiroir qui s'ouvre et
  // se referme entre deux tapes.
  const tapTitle = useHiddenTaps()
  // La page d'où l'on vient, pour que le retour y ramène : le profil, ou
  // l'onglet qui a ouvert l'avatar.
  const [parent, setParent] = useState<MenuPage | null>(null)
  const open = (next: MenuPage, from: MenuPage | null = null) => {
    setPane(isPane(next) ? next : 'profile')
    setSub(isPane(next) ? null : next)
    setParent(from)
    body.current?.scrollTo({ top: 0 })
  }
  const drawer = useRef<HTMLElement>(null)
  // Un retour, par le bouton comme par le geste : la page d'où l'on vient, le
  // profil à défaut — et le tiroir entier quand rien ne l'a ouvert derrière.
  const back = () => {
    if (parent === null && props.back === 'close') onClose()
    else open(parent ?? 'profile')
  }
  // The drawer came in from the left: a flick back that way sends it home.
  const swipe = useSwipe('left', onClose)
  // Un geste vers la droite remonte d'un cran, comme le bouton retour.
  const backSwipe = useSwipe('right', back)

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
    <div className={`menu-layer${leaving ? ' menu-layer--leaving' : ''}`}>
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
            {PANES.filter((id) => id !== 'social' || friends).map((id) => (
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

        <div className="menu-body" ref={body} {...backSwipe}>
          {sub && (
            <div className="subpage-head">
              <button type="button" className="subpage-back" onClick={back} aria-label={t.menu.back}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
              <h2
                className="subpage-title"
                onClick={
                  sub === 'boards' || sub === 'categories'
                    ? () => {
                        if (!tapTitle()) return
                        if (sub === 'boards') props.onAdvancedBoards?.(true)
                        else props.onWordsBoard?.(true)
                      }
                    : undefined
                }
              >
                {t.menu.pages[sub]}
              </h2>
            </div>
          )}
          {sub === 'stats' && (
            <StatsPage
              history={props.history}
              profile={props.profile}
              challenges={props.challenges}
              focusChallenges={props.focusChallenges}
              onChallenge={props.onChallenge}
              onRefresh={props.onStatsRefresh}
              loadOlder={props.onStatsOlder}
              recap={props.statsRecap}
              onBoards={props.account && leaderboards ? () => open('boards', 'stats') : undefined}
            />
          )}
          {sub === 'boards' && (
            <LeaderboardsPage
              named={Boolean(props.account && !props.account.anonymous)}
              advanced={props.advancedBoards}
              onCloseAdvanced={() => props.onAdvancedBoards?.(false)}
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
          {sub === 'categories' && (
            <CategoriesPage profile={props.profile} onHidden={() => props.onWordsBoard?.(true)} {...props.banActions} />
          )}
          {sub === 'avatar' && (
            <>
              {avatars ? (
                <AvatarPanel profile={props.profile} avatar={props.avatar} onSave={props.onAvatarSave} />
              ) : null}
              {achievements ? (
                <AchievementsPanel
                  profile={props.profile}
                  avatar={props.avatar}
                  discoveries={props.discoveries}
                />
              ) : null}
            </>
          )}
          {/* Chaque page se referme aussi par le bas : la liste des succès est
              longue, et remonter chercher la flèche coûtait un geste. */}
          {sub && (
            <button type="button" className="btn btn--ghost btn--block" onClick={back}>
              {t.menu.back}
            </button>
          )}
          {!sub && pane === 'profile' && <ProfilePane {...props} onPage={open} />}
          {pane === 'social' && friends && (
            <SocialPane
              account={props.account}
              avatar={props.avatar}
              inviteOpen={props.inviteOpen}
              accountActions={props.accountActions}
              accountMode={props.accountMode}
              moderator={props.moderation?.moderator ?? false}
              onProfile={() => open('profile')}
              onAvatar={() => open('avatar', 'social')}

              onFriends={props.onFriends}
              onChallenge={props.onChallenge}
              onChallengeFriend={props.onChallengeFriend}
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
              onFeatures={props.onFeatures}
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
  onLogOut,
  moderation,
  queueAlert,
  onPage,
}: Omit<
  MenuProps,
  | 'onClose'
  | 'page'
  | 'back'
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
  | 'inviteOpen'
  | 'friendRequests'
  | 'onFriends'
  | 'onChallengeFriend'
  | 'discoveries'
  | 'onAvatarSave'
> & {
  onPage(page: ProfilePage): void
}) {
  const t = useT()
  const named = account && !account.anonymous
  const avatars = useFeature('avatar')
  const achievements = useFeature('achievements')
  const [logOutAsking, setLogOutAsking] = useState(false)

  return (
    <div className="profile-pane">
      <section className="player">
        <button
          type="button"
          className="player-avatar"
          onClick={avatars ? () => onPage('avatar') : undefined}
          aria-label={t.menu.editAvatarLabel}
          disabled={!avatars}
        >
          <Avatar choice={avatar} size="md" />
        </button>
        <div className="player-id">
          <strong>{named && !account.needsName ? account.name : t.menu.anonymous}</strong>
          <span className="note">
            {t.menu.standing(levelProgress(profile.xp).level, formatNumber(t, profile.bestScore))}
          </span>
          {/* L'avatar et les succès se lisent ensemble : une seule page, qui
              montre les deux, plutôt que deux écrans superposés au tiroir. */}
          {avatars || achievements ? (
            <button type="button" className="btn btn--quiet" onClick={() => onPage('avatar')}>
              {t.menu.pages.avatar}
            </button>
          ) : null}
        </div>
      </section>

      {named && (
        <div className="stack">
          {account.email && <p className="note">{t.menu.signedInAs(account.email)}</p>}
          {logOutAsking ? (
            <p className="erase-confirm">
              <span className="note">{t.menu.logOutWarning}</span>
              <button type="button" className="btn btn--quiet" onClick={onLogOut}>
                {t.menu.logOut}
              </button>
              <button type="button" className="btn btn--quiet btn--muted" onClick={() => setLogOutAsking(false)}>
                {t.cancel}
              </button>
            </p>
          ) : (
            <button type="button" className="btn btn--quiet btn--muted menu-start" onClick={() => setLogOutAsking(true)}>
              {t.menu.logOut}
            </button>
          )}
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

      {/* A host that keeps the progress itself (CrazyGames) has nothing to warn about. */}
      {!account && !host.keepsProgress && <p className="note">{t.menu.offline}</p>}

      <PageLinks
        pages={PROFILE_PAGES}
        badges={{ requests: moderation?.news ?? 0, categories: banNews(profile) ? 1 : 0 }}
        queueAlert={queueAlert}
        onOpen={(next) => next !== 'profile' && onPage(next)}
      />

      
    </div>
  )
}

function SocialPane({
  account,
  avatar,
  inviteOpen,
  accountActions,
  accountMode,
  moderator,
  onProfile,
  onAvatar,
  onFriends,
  onChallenge,
  onChallengeFriend,
}: {
  account: Account | null
  avatar: AvatarChoice
  inviteOpen?: boolean
  accountActions: AccountActions
  /** The account form's opening tab, when it has to be shown here. */
  accountMode?: AccountMode
  /** A moderator can put a friend forward to become one. */
  moderator: boolean
  onProfile(): void
  onAvatar(): void
  onFriends(friends: readonly Friend[]): void
  onChallenge(id: string): void
  onChallengeFriend?(friendId: string): void
}) {
  const t = useT()
  const elect = useFeature('electModerator')
  const [friends, setFriends] = useState<Friend[] | null | 'loading'>('loading')
  const [blocks, setBlocks] = useState<BlockedPlayer[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const named = Boolean(account && !account.anonymous && !account.needsName)
  const history = useFriendHistory(named)
  const [opened, setOpened] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)

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
  useEffect(() => {
    if (named) fetchInviteCode().then(setInviteCode)
  }, [named])

  if (!account) {
    return <p className="note">{t.social.noServer}</p>
  }

  if (!named) {
    // A friend is found by the account's name: as long as it has none — an
    // anonymous player, or a Google account whose name is still « Anonyme » —
    // the tab asks for that name rather than showing anyone.
    if (account.needsName) {
      return (
        <AccountPanel
          title={t.menu.accountTitle}
          lead={t.menu.accountLead}
          needsName
          initialMode={accountMode}
          {...accountActions}
        />
      )
    }
    return (
      <div className="stack">
        <p className="note">{t.social.needAccount}</p>
        <button type="button" className="btn btn--block" onClick={onProfile}>
          {t.social.createAccount}
        </button>
      </div>
    )
  }

  const request = async (wanted: string) => {
    const outcome = await requestFriend(wanted)
    const said = t.social.requests[outcome](wanted)
    const done = outcome === 'sent' || outcome === 'accepted'
    if (done) {
      setMessage(said)
      refresh()
    }
    return { said, done }
  }

  const invite = async (email: string) => {
    const outcome = await inviteTester(email, t.tag.split('-')[0]!)
    return { said: t.social.testerInvites[outcome](email), done: outcome === 'sent' }
  }

  const act = async (work: Promise<boolean>) => {
    if (!(await work)) setMessage(t.social.requests.unreachable(''))
    refresh()
  }

  const accepted = friends === 'loading' || friends === null ? [] : friends.filter((friend) => friend.relation === 'friend')
  const sharedWith = (friendId: string) =>
    history && (history.byFriend[friendId] ?? []).flatMap((id) => history.challenges[id] ?? [])

  const page = accepted.find((friend) => friend.id === opened)
  if (page) {
    return (
      <FriendPage
        friend={page}
        challenges={sharedWith(page.id)}
        complete={history?.complete ?? false}
        showModerator={moderator}
        onBack={() => setOpened(null)}
        onChallenge={onChallenge}
        onChallengeFriend={onChallengeFriend ? () => onChallengeFriend(page.id) : undefined}
        onRemove={() => {
          setOpened(null)
          act(removeFriend(page.id))
        }}
        onElect={
          moderator && elect && !page.moderator
            ? async () => {
                setMessage(t.social.invites[await inviteModerator(page.id)](page.name))
                setOpened(null)
              }
            : undefined
        }
      />
    )
  }

  return (
    <FriendsView
      name={account.name}
      avatar={avatar}
      onAvatar={onAvatar}
      friends={friends}
      blocks={blocks}
      showModerator={moderator}
      sharedWith={sharedWith}
      message={message}
      onOpen={setOpened}
      onRespond={(friendId, accept) => act(respondFriend(friendId, accept))}
      onCancel={(friendId) => act(removeFriend(friendId))}
      onUnblock={(playerId) => act(unblockPlayer(playerId))}
      onRequest={request}
      onInvite={invite}
      inviteCode={inviteCode}
      initialSheet={inviteOpen ? 'invite' : undefined}
    />
  )
}

const THEMES: readonly Theme[] = ['system', 'light', 'dark']
const SOUND_CHANNELS = ['master', 'effects', 'keys', 'music'] as const

/** The music is heard as it plays; the effects and keys need a sample. */
function previewChannel(id: (typeof SOUND_CHANNELS)[number]): void {
  if (id === 'effects' || id === 'master') previewSound('effects')
  else if (id === 'keys') previewSound('keys')
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
  onFeatures?(): void
}

function OptionsPane({ theme, onTheme, locale, onLocale, sound, onSound, onErase, named, onFeatures }: OptionsPaneProps) {
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

      {onFeatures ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={onFeatures}>
          {t.options.features}
        </button>
      ) : null}

      <div className="menu-foot">
        {PRIVACY_URL ? (
          <a className="btn btn--quiet menu-start" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {t.options.privacy}
          </a>
        ) : null}
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
