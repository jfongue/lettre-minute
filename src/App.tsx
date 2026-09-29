import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { availableCategoryIds, loadPack, loadPacks } from './data/packs'
import {
  acceptInvite,
  cancelSubmission,
  correctSubmission,
  createChallenge,
  deleteAccount,
  fetchAccount,
  fetchChallenge,
  fetchChallenges,
  fetchFriends,
  forgetPushToken,
  fetchCommunityWords,
  fetchCrowdUsage,
  fetchPromptStats,
  fetchBoards,
  fetchModerationStatus,
  fetchMyRuns,
  fetchMySubmissions,
  markRequestsSeen,
  topUpModeration,
  type Submission,
  logIn,
  logInWithGoogle,
  logOut,
  markChallengeSeen,
  pushAvatar,
  pushChallengeRun,
  pushRun,
  pushSubmissions,
  register,
  requestPasswordReset,
  resetPassword,
  rematchChallenge,
  savePushToken,
  type Account,
  type AuthOutcome,
  type ChallengeDetail,
  type ChallengeSummary,
  type CommunityWord,
  type Friend,
  type ModerationStatus,
  chooseName,
  fetchMyDiscoveries,
  fetchProgress,
  pushProgress,
} from './lib/cloud'
import { progressOf, withProgress } from './domain/progress'
import { reportAchievements, reportRun } from './lib/playGames'
import {
  askPush,
  enablePush,
  isNativeApp,
  onBackButton,
  onPush,
  openStoreUpdate,
  playGamesPlayer,
  prepareAds,
  pushState,
  storeUpdateAvailable,
  tapFeedback,
  type PushData,
  onInstallReferrer,
} from './lib/native'
import { configureSound, setHush, setMusic, setPulseStage, sound, tierSound, type SoundPrefs } from './lib/sound'
import { DEFAULT_AVATAR, isDefaultAvatar, sameAvatar, type AvatarChoice } from './domain/avatar'
import { appendRecord, mergeHistory, recordOf, type RunRecord } from './domain/history'
import { completeBoards, HOUSE_PLAYER, type Boards } from './domain/boards'
import {
  challengePowers,
  CHALLENGE_MAX_PLAYERS,
  defaultChallengePowers,
  needsPowerPick,
  scoreAt,
} from './domain/challenge'
import { complicationDue, type PowerId } from './domain/powers'
import { NEW_PROFILE, type Profile } from './domain/progression'
import { hasPower, isHushed, nextPrompt, promptKey, RUN_SECONDS, remainingSeconds } from './domain/run'
import type { PromptRecord } from './domain/prompts'
import { adsDue, dealLineup, ownedCategoryIds, swapCategory, unlockEverything } from './domain/unlocks'
import { compactWord, normalizeWord } from './domain/text'
import { commonWord, withExtraWords } from './domain/words'
import { loadMessages, MessagesContext, messagesFor, type Locale } from './i18n'
import { standingMove } from './domain/standing'
import { challengeNotice } from './state/challenges'
import { markPushOffered, pushOfferDue } from './state/pushOffer'
import { clearInviteRef, keepInviteRef, loadInviteRef, refIn, takeAddressRef } from './state/inviteRef'
import { createJudge } from './state/judge'
import { banNews, feedbackDue, hiddenAnswers, playableCategoryIds, plusThanksDue } from './domain/perks'
import { cloudConfigured } from './lib/supabase'
import { setTrackLang, setTrackScreen, track, trackFeature, trackReady } from './lib/track'
import { FeedbackPop } from './ui/FeedbackPop'
import type { BanActions } from './ui/CategoriesPage'
import { applyLocale, loadLocale, saveLocale } from './state/locale'
import { initialSession, sessionReducer, type Proposal } from './state/session'
import {
  clearLocalData,
  loadAccount,
  loadAvatar,
  loadHistory,
  loadProfile,
  loadQuietSignInTried,
  saveQuietSignInTried,
  loadSubmissions,
  loadTutorialDone,
  saveAccount,
  saveAvatar,
  saveHistory,
  saveProfile,
  saveSubmissions,
  saveTutorialDone,
} from './state/storage'
import { loadSoundPrefs, saveSoundPrefs } from './state/sound'
import { applyTheme, loadTheme, saveTheme, type Theme } from './state/theme'
import { useElapsed } from './state/useElapsed'
import type { AccountActions, AccountMode } from './ui/AccountPanel'
import { ChallengeNotice } from './ui/ChallengeHome'
import { UpdateNotice } from './ui/UpdateNotice'
import { PowerGiftPop, WordsNewsPop } from './ui/WordsNews'
import type { ChallengeRules } from './ui/ChallengeSetup'
import { DEFAULT_PLAYER_ACTIONS, PlayerActionsContext, type PlayerActions } from './ui/PlayerSheet'
import { HomeScreen } from './ui/HomeScreen'
import { LanguagePicker } from './ui/LanguagePicker'
import type { MenuPage } from './ui/Menu'
import { ModeratorOffer } from './ui/ModeratorOffer'
import { MuteButton } from './ui/MuteButton'
import { NamePrompt } from './ui/NamePrompt'
import { PushOffer } from './ui/PushOffer'
import type { Racer } from './ui/RunScreen'
import { lazyScreen } from './ui/lazyScreen'
import { TutorialScreen, tutorialPrompt } from './ui/TutorialScreen'
import { dismissTopOverlay } from './ui/useBackDismiss'

// Everything but the home screen waits in its own chunk: the first paint only
// parses what it shows. `preloadScreens` fetches them once the home screen has
// settled, and a run awaits its own before it starts.
const DebugBoard = lazyScreen(() => import('./debug/DebugBoard').then((module) => module.DebugBoard))
const AvatarScreen = lazyScreen(() => import('./ui/AvatarScreen').then((module) => module.AvatarScreen))
const ChallengePowers = lazyScreen(() => import('./ui/ChallengePowers').then((module) => module.ChallengePowers))
const ChallengeSetup = lazyScreen(() => import('./ui/ChallengeSetup').then((module) => module.ChallengeSetup))
const ChallengeScreen = lazyScreen(() => import('./ui/ChallengeScreen').then((module) => module.ChallengeScreen))
const FriendPicker = lazyScreen(() => import('./ui/FriendPicker').then((module) => module.FriendPicker))
const CountdownScreen = lazyScreen(() => import('./ui/CountdownScreen').then((module) => module.CountdownScreen))
const Menu = lazyScreen(() => import('./ui/Menu').then((module) => module.Menu))
const ModerationScreen = lazyScreen(() => import('./ui/ModerationScreen').then((module) => module.ModerationScreen))
const OverScreen = lazyScreen(() => import('./ui/OverScreen').then((module) => module.OverScreen))
const RunScreen = lazyScreen(() => import('./ui/RunScreen').then((module) => module.RunScreen))

/** The run's own screens: awaited with its dictionaries, so the countdown never opens on a blank frame. */
function preloadRunScreens(): Promise<unknown> {
  return Promise.all([CountdownScreen.preload(), RunScreen.preload(), OverScreen.preload()])
}

/** One screen at a time, in the order a player is likely to need them. */
async function preloadScreens(): Promise<void> {
  for (const screen of [Menu, CountdownScreen, RunScreen, OverScreen, ChallengeScreen, FriendPicker, ChallengeSetup, ChallengePowers, AvatarScreen, ModerationScreen]) {
    await screen.preload().catch(() => undefined)
  }
}

/** The boards as the home screen shows them: without a server, none at all. */
async function loadBoards(): Promise<Boards | null> {
  const boards = await fetchBoards()
  return boards && completeBoards(boards)
}

/** Sends the words proposed while the game was offline, then clears the queue. */
function flushSubmissions(): Promise<unknown> {
  const pending = loadSubmissions()
  if (pending.length === 0) return Promise.resolve()
  return pushSubmissions(pending).then((sent) => {
    if (sent.length > 0) saveSubmissions([])
  })
}

/** Corrige un mot que le serveur n'a pas encore vu : la file de l'appareil se réécrit. */
function amendQueued(proposal: Proposal, display: string): boolean {
  const pending = loadSubmissions()
  if (!pending.some((item) => item.at === proposal.at)) return false
  saveSubmissions(pending.map((item) => (item.at === proposal.at ? { ...item, word: display.trim() } : item)))
  return true
}

/** Retire de la file un mot que le serveur n'a pas encore vu. */
function dropQueued(proposal: Proposal): boolean {
  const pending = loadSubmissions()
  if (!pending.some((item) => item.at === proposal.at)) return false
  saveSubmissions(pending.filter((item) => item.at !== proposal.at))
  return true
}

/** How often a home screen left open reads the boards again. */
const BOARDS_REFRESH_MS = 120_000

/** When the home screen starts warming the player's dictionaries, and the pause between two. */
const PACK_WARM_DELAY_MS = 2500
const PACK_WARM_GAP_MS = 400

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession(NEW_PROFILE))
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [crowd, setCrowd] = useState<Readonly<Record<string, number>>>({})
  // What the players' runs said of each pair, and the language they said it in:
  // a borrowed dictionary has no such record, and a challenge never reads it.
  const [promptStats, setPromptStats] = useState<{ lang: string; records: Readonly<Record<string, PromptRecord>> } | null>(null)
  const [boards, setBoards] = useState<Boards | null>(null)
  // The boards as they stood when the run started, and once it reached the
  // server: the end screen animates the player's move from one to the other.
  const [boardsBefore, setBoardsBefore] = useState<Boards | null>(null)
  const [boardsAfter, setBoardsAfter] = useState<Boards | null>(null)
  const boardsNow = useRef(boards)
  boardsNow.current = boards
  // The climb plays on the first home screen after the run, not on every one after.
  const [climbSeen, setClimbSeen] = useState<Boards | null>(null)
  // Where the drawer opened, or null while it is closed.
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null)
  const [menuFocus, setMenuFocus] = useState(false)
  const menuOpen = menuPage !== null
  const [accountMode, setAccountMode] = useState<AccountMode>('register')
  // The very first « Jouer » teaches one word before the clock starts; the
  // lesson then stays up while the run loads.
  const [tutorial, setTutorial] = useState<'teaching' | 'launching' | null>(null)
  const closeMenu = useCallback(() => setMenuPage(null), [])
  const [history, setHistory] = useState<RunRecord[]>([])
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [soundPrefs, setSoundPrefs] = useState<SoundPrefs>(loadSoundPrefs)
  const tune = useCallback((next: SoundPrefs) => {
    setSoundPrefs(next)
    saveSoundPrefs(next)
  }, [])
  useEffect(() => configureSound(soundPrefs), [soundPrefs])
  // Null only when the device speaks none of the game's languages and the
  // player has not picked one yet: the picker then comes before anything else.
  const [locale, setLocale] = useState<Locale | null>(loadLocale)
  const t = messagesFor(locale ?? 'fr')
  // The dictionary follows the interface: a German player answers in German.
  const lang = locale ?? 'fr'
  const speak = useCallback((next: Locale) => {
    trackFeature('language', { lang: next })
    // A language is loaded before it is shown: rendered first, it would flash French.
    void loadMessages(next)
      .catch(() => undefined)
      .then(() => {
        setLocale(next)
        saveLocale(next)
      })
  }, [])
  useEffect(() => {
    if (locale) applyLocale(locale)
    setTrackLang(locale ?? 'none')
  }, [locale])
  const community = useRef<Record<string, CommunityWord[]>>({})
  const [avatar, setAvatar] = useState<AvatarChoice>(DEFAULT_AVATAR)
  const [account, setAccount] = useState<Account | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [moderation, setModeration] = useState<ModerationStatus | null>(null)
  const [moderating, setModerating] = useState(false)
  // « Plus tard » holds the offer back until the next launch, without answering it.
  const [offerHeld, setOfferHeld] = useState(false)
  // Set on the way home once `feedbackDue` says so: asked once, answered or not.
  const [feedbackAsk, setFeedbackAsk] = useState(false)
  // The seed of the run whose reveal has played: leaving for the avatar editor
  // and coming back must not replay it.
  const [revealed, setRevealed] = useState<number | null>(null)
  // Challenges between friends: the list under « Jouer », the one opened,
  // the friend picker that starts one, and the power pick before a run.
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null)
  const [challengeOpen, setChallengeOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState<{
    busy: boolean
    message: string | null
    rules: ChallengeRules
    /** Ticked on opening: the friend whose name was tapped. */
    friends: readonly string[]
  } | null>(null)
  const [picking, setPicking] = useState<ChallengeDetail | null>(null)
  // The challenge being played, for the race; then what became of the run sent to it.
  const [played, setPlayed] = useState<ChallengeDetail | null>(null)
  const [afterRun, setAfterRun] = useState<ChallengeDetail | 'sending' | 'failed'>('sending')
  // Notices put off with « Plus tard » this session, by challenge id.
  const [heldNotices, setHeldNotices] = useState<readonly string[]>([])
  // 'later' holds until the app is launched again: one nudge per launch is enough.
  const [update, setUpdate] = useState<'none' | 'due' | 'later'>('none')
  // The dictionary the run plays: the interface's, or the challenge's own.
  const [runLang, setRunLang] = useState<string | null>(null)
  // Signing in must wait for the run to reach the server: the merge moves the
  // anonymous player's runs, and a run still in flight would be left behind.
  const pushing = useRef<Promise<unknown>>(Promise.resolve())
  const profile = useRef(session.profile)
  profile.current = session.profile
  // Hidden: seven taps on « Thème » in the options, or #debug on the web.
  // What the home screen waits for before showing anything under its title.
  const [answered, setAnswered] = useState({ profile: false, account: false, boards: false, challenges: false })
  const answer = useCallback(
    (key: keyof typeof answered) => setAnswered((was) => (was[key] ? was : { ...was, [key]: true })),
    [],
  )
  const [homeSettled, setHomeSettled] = useState(false)
  const [debugPhase, setDebugPhase] = useState<string | null>(() => (window.location.hash === '#debug' ? 'home' : null))
  // Les classements avancés : le mode débug caché derrière cinq tapes sur
  // « Classement ». Il ne survit pas au rechargement, comme la planche.
  const [advancedBoards, setAdvancedBoards] = useState(false)

  // Written only once the cached account has been read, or the first render's
  // null would erase it.
  const accountRead = useRef(false)
  useEffect(() => {
    if (accountRead.current) saveAccount(account)
  }, [account])

  // The stored profile is read after the first paint: touching localStorage
  // during render is a side effect, and the home screen is right either way.
  useEffect(() => {
    const stored = loadProfile()
    dispatch({ type: 'profile-loaded', profile: stored })
    reportAchievements(stored)
    setAvatar(loadAvatar())
    setHistory(loadHistory())
    setAccount(loadAccount())
    accountRead.current = true
    answer('profile')
  }, [answer])

  // Les parties du compte : un téléphone qui vient de se connecter n'en a
  // aucune, et la page des statistiques doit couvrir au moins les vingt
  // dernières ou les trois derniers jours. Elle redemande cette fenêtre à
  // chaque ouverture — une lecture ratée au lancement ne la laisse donc plus
  // vide —, et les parties déjà sur l'appareil ne comptent pas deux fois.
  const loadAccountRuns = useCallback(async () => {
    const runs = await fetchMyRuns()
    if (!runs || runs.length === 0) return
    setHistory((previous) => {
      const next = mergeHistory(previous, runs)
      if (next.length === previous.length) return previous
      saveHistory(next)
      return next
    })
  }, [])

  // La tuile portée, lue par `adopt` sans en dépendre : une dépendance à
  // `avatar` recréerait `adopt` à chaque changement, et l'effet qui relit le
  // compte et les classements repartirait en boucle.
  const worn = useRef(avatar)
  worn.current = avatar

  const wear = useCallback((next: AvatarChoice) => {
    setAvatar(next)
    saveAvatar(next)
  }, [])

  /** A permanent account is the reference: another device may have played on it since. */
  const adopt = useCallback(
    (next: Account) => {
      setAccount(next)
      if (next.anonymous) return
      const local: Profile = profile.current
      if (next.stats.runs >= local.runs) {
        // The server keeps totals; the picks come from the cloud save below.
        dispatch({ type: 'profile-loaded', profile: { ...local, ...next.stats } })
      }
      // Le compte porte sa tuile. Une tuile de départ n'en est pas une : le
      // téléphone qui tenait déjà ce compte remet la sienne, qu'un
      // enregistrement hors ligne avait laissée sur le serveur ; un autre
      // compte, lui, l'écarte au lieu de la lui prêter.
      const held = loadAccount()?.name ?? null
      const server = next.avatar
      if (!server) {
        if (!isDefaultAvatar(worn.current)) pushAvatar(worn.current).then((saved) => { if (saved) loadBoards().then(setBoards) })
      } else if (!isDefaultAvatar(server)) {
        wear(server)
      } else if (held === next.name && !sameAvatar(worn.current, server)) {
        pushAvatar(worn.current).then((saved) => { if (saved) loadBoards().then(setBoards) })
      } else if (held !== next.name) {
        wear(server)
      }
      // Another device's picks join this one's, and the merged copy goes back up.
      fetchProgress().then((saved) => {
        if (!saved) return
        const merged = withProgress(profile.current, saved)
        dispatch({ type: 'profile-loaded', profile: merged })
        savedProgress.current = JSON.stringify(progressOf(merged))
      })
    },
    [wear],
  )

  // The cloud save follows the profile a few seconds behind, for a named
  // account only: an anonymous one lives and dies with this device.
  const savedProgress = useRef('')
  const named = account !== null && !account.anonymous
  useEffect(() => {
    if (!named || session.profile === NEW_PROFILE) return
    const next = JSON.stringify(progressOf(session.profile))
    if (next === savedProgress.current) return
    const timer = setTimeout(() => {
      pushProgress(session.profile).then((ok) => {
        if (ok) savedProgress.current = next
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [named, session.profile])

  useEffect(() => {
    if (session.profile !== NEW_PROFILE) saveProfile(session.profile)
  }, [session.profile, crowd])

  // Everything below is best-effort: the cloud calls answer with a fallback
  // rather than throwing, so a missing project simply leaves the game local.
  useEffect(() => {
    fetchCrowdUsage(lang).then((usage) => setCrowd(usage.shares))
    fetchPromptStats(lang).then((records) => setPromptStats({ lang, records }))
    fetchCommunityWords(lang).then((words) => {
      community.current = words
    })
  }, [lang])

  useEffect(() => {
    loadBoards().then((next) => {
      setBoards(next)
      answer('boards')
    })
    fetchAccount().then((found) => {
      answer('account')
      // Unreachable keeps the cached account: the session is still on the device.
      if (found === 'unreachable') return
      if (found) adopt(found)
      else setAccount(null)
    })
    flushSubmissions()
  }, [adopt, answer])

  const refreshModeration = useCallback(() => {
    fetchModerationStatus(lang).then(setModeration)
  }, [lang])
  // The account decides the role, the language which words wait for it.
  useEffect(refreshModeration, [refreshModeration, account?.name, account?.anonymous])

  const moderator = moderation?.moderator === true
  const topUpRequests = useCallback(() => {
    if (!moderator) return
    topUpModeration(lang).then((released) => {
      if (released > 0) refreshModeration()
    })
  }, [moderator, lang, refreshModeration])

  // On opening, and on each sign-in: the player's words let in since they last
  // looked, and how many ever were — the third brings Challenge.
  const [wordsNews, setWordsNews] = useState<readonly Submission[]>([])
  // Toutes ses demandes, et pas seulement les nouvelles : c'est là que le jeu
  // lit les mots que ce joueur a lui-même fait entrer au dictionnaire.
  const [mine, setMine] = useState<readonly Submission[]>([])
  const [acceptedWords, setAcceptedWords] = useState(0)
  const signedIn = account !== null
  const refreshMine = useCallback(() => {
    fetchMySubmissions().then((found) => found && setMine(found))
  }, [])
  useEffect(() => {
    if (!signedIn) return
    fetchMySubmissions().then((found) => {
      if (!found) return
      setMine(found)
      setAcceptedWords(found.filter((submission) => submission.status === 'accepted').length)
      setWordsNews(found.filter((submission) => submission.fresh))
    })
  }, [signedIn, account?.name, account?.anonymous])

  // Les mots ajoutés se déduisent des demandes acceptées, et le serveur seul en
  // décide : le profil les reçoit pour que les sept tuiles qu'ils débloquent
  // tiennent hors ligne. Un compte anonyme n'en a aucun, faute de pouvoir proposer.
  useEffect(() => {
    if (session.profile.wordsAdded === acceptedWords) return
    dispatch({ type: 'profile-loaded', profile: { ...session.profile, wordsAdded: acceptedWords } })
  }, [acceptedWords, session.profile])

  /** After any sign-in that changes user: the anonymous player's runs have been merged into it. */
  const enter = (outcome: AuthOutcome): string | null => {
    if (!outcome.ok) return t.account.errors[outcome.error]
    adopt(outcome.account)
    // The merge summed both players on the server: its totals are the truth now.
    dispatch({ type: 'profile-loaded', profile: { ...profile.current, ...outcome.account.stats } })
    if (!outcome.account.avatar) pushAvatar(avatar)
    loadBoards().then(setBoards)
    return outcome.warning ? t.account.errors[outcome.warning] : null
  }

  // Play Games has signed the player in: their Google account becomes the
  // game's without a form, and only its name is asked, the gamer name offered.
  // Tried once per device: closing the sheet, or signing out later, is an
  // answer that stands.
  const quietTried = useRef(false)
  const [nameAsk, setNameAsk] = useState<string | null>(null)
  useEffect(() => {
    if (!answered.account || (account && !account.anonymous) || quietTried.current) return
    quietTried.current = true
    if (loadQuietSignInTried()) return
    playGamesPlayer().then(async (gamer) => {
      if (gamer === null) return
      saveQuietSignInTried()
      const outcome = await logInWithGoogle(pushing.current, true)
      if (!outcome?.ok) return
      track('login', { method: 'play-games' })
      enter(outcome)
      if (outcome.account.needsName) setNameAsk(gamer)
    })
    // `enter` reads the latest state through refs; the effect keys on the answer alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered.account, account])

  const accountActions: AccountActions = {
    async onRegister(name, email, password) {
      await pushing.current
      const outcome = await register(name, email, password)
      if (!outcome.ok) return t.account.errors[outcome.error]
      track('signup', { method: 'email', runs: profile.current.runs })
      setAccount(outcome.account)
      pushAvatar(avatar)
      loadBoards().then(setBoards)
      // With email confirmation on, the account stays anonymous until the link is followed.
      return outcome.account.anonymous ? t.account.confirmationSent(email.trim()) : null
    },
    async onLogIn(email, password) {
      await pushing.current
      const outcome = await logIn(email, password)
      if (outcome.ok) track('login', { method: 'email' })
      return enter(outcome)
    },
    async onGoogle() {
      const outcome = await logInWithGoogle(pushing.current)
      if (outcome?.ok) track('login', { method: 'google' })
      return outcome ? enter(outcome) : null
    },
    async onRequestReset(email) {
      const error = await requestPasswordReset(email)
      return error ? t.account.errors[error] : null
    },
    async onResetPassword(email, code, password) {
      await pushing.current
      return enter(await resetPassword(email, code, password))
    },
    async onChooseName(name) {
      const outcome = await chooseName(name)
      if (!outcome.ok) return t.account.errors[outcome.error]
      track('signup', { method: 'name', runs: profile.current.runs })
      setAccount(outcome.account)
      loadBoards().then(setBoards)
      return null
    },
  }

  /** Starts the device over as a new anonymous player, after a sign-out or an erase. */
  const forget = () => {
    clearLocalData()
    dispatch({ type: 'profile-loaded', profile: NEW_PROFILE })
    setAvatar(DEFAULT_AVATAR)
    setHistory([])
    setAccount(null)
    fetchAccount().then((found) => found && found !== 'unreachable' && setAccount(found))
    loadBoards().then(setBoards)
  }

  // Android's back gesture leaves a run for the home screen, and closes the app
  // from there. A ref keeps one listener for the whole session.
  const phase = useRef(session.phase)
  phase.current = session.phase
  const menuShown = useRef(menuOpen)
  menuShown.current = menuOpen
  // The challenge screens close one at a time, the way they opened.
  const closeChallengeLayer = useRef<() => boolean>(() => false)
  useEffect(
    () =>
      onBackButton(() => {
        // A pop-up is above whatever screen it covers: it goes first.
        if (dismissTopOverlay()) return true
        if (menuShown.current) {
          setMenuPage(null)
          return true
        }
        if (closeChallengeLayer.current()) return true
        if (phase.current === 'home' || phase.current === 'loading') return false
        dispatch({ type: 'home' })
        return true
      }),
    [],
  )

  useEffect(() => {
    if (!session.cheer) return
    tapFeedback()
    // The combo counts this prompt's finds, this one included: the note climbs with it.
    sound.found(tierSound(session.cheer.tier, session.cheer.approximate), Math.max(0, (session.run?.combo ?? 1) - 1))
    if (session.cheer.boost > 1) sound.power('complication', 0.7)
    if (session.cheer.auto) sound.power('celerity', 0.8)
    // Only a new cheer sings; the run it came with is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.cheer])

  // The music keeps to the screens around the run; the run itself has its pulse, if wanted.
  useEffect(() => {
    const around = session.phase === 'home' || session.phase === 'loading' || session.phase === 'over'
    setMusic(around ? 'menu' : session.phase === 'playing' ? 'pulse' : null)
    if (session.phase === 'over') sound.timeUp()
  }, [session.phase])

  // Every tap on the screens around the run clicks, like the phone's own keys.
  const quietTaps = session.phase === 'countdown' || session.phase === 'playing'
  useEffect(() => {
    if (quietTaps) return
    const click = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('button, a')) sound.click()
    }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [quietTaps])

  const elapsed = useElapsed(session.phase === 'playing' ? startedAt : null)
  const remaining = session.run ? remainingSeconds(session.run, elapsed) : 0
  const pulseStage = Math.min(2, Math.floor(((RUN_SECONDS - remaining) / RUN_SECONDS) * 3))
  useEffect(() => setPulseStage(pulseStage), [pulseStage])

  // Silence muffles the whole game, music included, and the room opens back up when it lets go.
  const hushed = session.phase === 'playing' && session.run !== null && isHushed(session.run, elapsed)
  const wasHushed = useRef(false)
  useEffect(() => {
    setHush(hushed)
    if (wasHushed.current && !hushed && session.phase === 'playing') sound.unhush()
    wasHushed.current = hushed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hushed])

  const coming = useMemo(
    () => (session.run && session.judge && hasPower(session.run, 'divination') ? nextPrompt(session.run, session.judge) : null),
    [session.run, session.judge],
  )

  const rivals = useMemo<Racer[] | undefined>(() => {
    if (!played || session.phase !== 'playing') return undefined
    return played.players
      .filter((player) => !player.me && player.playedAt !== null)
      .map((player) => ({ id: player.playerId, name: player.name, avatar: player.avatar, score: scoreAt(player.words, elapsed) }))
  }, [played, session.phase, elapsed])

  useEffect(() => {
    if (session.phase === 'playing' && remaining <= 0) dispatch({ type: 'time-up', at: elapsed })
  }, [session.phase, remaining, elapsed])

  // The house account owns every category, on whichever device it signs in.
  useEffect(() => {
    if (account?.anonymous !== false || account.name !== HOUSE_PLAYER.name) return
    const everything = unlockEverything(session.profile)
    if (everything !== session.profile) dispatch({ type: 'profile-loaded', profile: everything })
  }, [account, session.profile])

  // A pick owed and no offer on the table — after a level up, or on a device
  // that has never seen this player's picks — deals three categories to choose from.
  useEffect(() => {
    dispatch({ type: 'offer', availableIds: availableCategoryIds(lang), seed: Date.now() >>> 0 })
  }, [session.profile, lang])

  // Loading an ad takes seconds, consent included: started once the free pick
  // is spent, it is ready by the next offer. Never mid-run, where the consent
  // form would cover the clock.
  const adsWanted = adsDue(session.profile) && (session.phase === 'home' || session.phase === 'over')
  useEffect(() => {
    if (adsWanted) prepareAds()
  }, [adsWanted])

  const judgeFor = useCallback(
    async (categoryIds: readonly string[], packLang: string = lang, challenge = false) => {
      const loaded = await loadPacks(packLang, categoryIds)
      // A challenge leaves the community words out: they change which letters
      // a category can be prompted on, and two players who loaded a different
      // list would not draw the same prompts.
      const packs = challenge
        ? loaded
        : loaded.map((pack) =>
            withExtraWords(
              pack,
              (community.current[pack.categoryId] ?? []).map((word) => ({
                key: '',
                display: word.display,
                sitelinks: word.sitelinks,
                frequency: word.frequency,
                notoriety: 0,
              })),
            ),
          )
      // The crowd counts are the interface language's: another dictionary has none.
      const usage = { own: session.profile.usage, crowd: packLang === lang ? crowd : {} }
      // A challenge draws from the seed and the embedded dictionaries alone:
      // the crowd's record of a pair would differ from one player to the next.
      const served = packLang === promptStats?.lang ? promptStats.records : undefined
      return createJudge(packs, usage, t.powers.spells, challenge ? undefined : served)
    },
    [session.profile.usage, crowd, promptStats, lang, t],
  )

  const play = useCallback(async () => {
    dispatch({ type: 'play' })
    setRunLang(lang)
    setPlayed(null)
    setBoardsBefore(boardsNow.current)
    setBoardsAfter(null)
    try {
      // A category of the catalogue whose dictionary has not been imported yet
      // is simply not dealt, rather than failing the whole run.
      const shipped = new Set(availableCategoryIds(lang))
      const seed = Date.now() >>> 0
      // A ban holds for solo runs only: a challenge deals its own categories.
      const lineup = dealLineup(
        seed,
        playableCategoryIds(session.profile, ownedCategoryIds(session.profile)).filter((id) => shipped.has(id)),
      )
      const [judge] = await Promise.all([judgeFor(lineup.dealt), preloadRunScreens()])
      dispatch({ type: 'ready', judge, seed, categoryIds: lineup.dealt, reserve: lineup.reserve })
      // Warmed while the categories are announced, so the first swap is instant.
      if (lineup.reserve[0]) loadPack(lang, lineup.reserve[0]).catch(() => undefined)
    } catch {
      dispatch({ type: 'load-failed', message: t.loadFailed })
    }
  }, [session.profile, judgeFor, t, lang])

  // The player's dictionaries, parsed one by one while the home screen idles:
  // parsed at the countdown instead, they stalled the page as the sound played,
  // and the phone crackled.
  const ownedShipped = useMemo(() => {
    const shipped = new Set(availableCategoryIds(lang))
    return ownedCategoryIds(session.profile).filter((id) => shipped.has(id)).join(',')
  }, [lang, session.profile])
  const idleHome = session.phase === 'home'
  useEffect(() => {
    if (!idleHome) return
    const ids = ownedShipped.split(',').filter(Boolean)
    let timer: ReturnType<typeof setTimeout>
    let live = true
    const warm = (index: number) => {
      const id = ids[index]
      if (!id || !live) return
      loadPack(lang, id)
        .catch(() => undefined)
        .then(() => {
          if (live) timer = setTimeout(() => warm(index + 1), PACK_WARM_GAP_MS)
        })
    }
    timer = setTimeout(() => warm(0), PACK_WARM_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [idleHome, ownedShipped, lang])

  const startFirstRun = useCallback(() => {
    if (session.profile.runs > 0 || loadTutorialDone()) return play()
    setMenuPage(null)
    setTutorial('teaching')
  }, [session.profile.runs, play])
  // The answer was just handed over: the run that follows must not deal the
  // same pair. `lastPrompts` already keeps it out, and the run's own prompts
  // replace it once it ends.
  const endTutorial = useCallback(() => {
    saveTutorialDone()
    setTutorial('launching')
    const banned = promptKey(tutorialPrompt(t))
    const { lastPrompts } = profile.current
    if (!lastPrompts.includes(banned)) {
      dispatch({ type: 'profile-loaded', profile: { ...profile.current, lastPrompts: [...lastPrompts, banned] } })
    }
    play()
  }, [play, t])
  // Dropped only once the run is loaded, or the home screen would flash
  // between the lesson and the countdown. A failed load lands home with its
  // error, where it belongs.
  useEffect(() => {
    if (tutorial === 'launching' && session.phase !== 'loading') setTutorial(null)
  }, [tutorial, session.phase])

  const refreshChallenges = useCallback(() => {
    if (!named) return setChallenges(null)
    fetchChallenges().then((next) => {
      setChallenges(next)
      answer('challenges')
    })
  }, [named, answer])
  useEffect(refreshChallenges, [refreshChallenges])
  useEffect(() => {
    const check = () =>
      document.visibilityState === 'visible' &&
      storeUpdateAvailable().then((due) => due && setUpdate((current) => (current === 'none' ? 'due' : current)))
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  // Once shown, the home screen stays shown: later answers update it in place.
  // A slow server gets two seconds and a half, not the player's whole wait.
  const homeReady = answered.profile && answered.account && answered.boards && (!named || answered.challenges)
  useEffect(() => {
    if (homeReady) setHomeSettled(true)
  }, [homeReady])
  useEffect(() => {
    if (!homeSettled) return
    trackReady()
    // After the home screen's own entrance, so its animation keeps the main thread.
    const timer = setTimeout(() => void preloadScreens(), 1200)
    return () => clearTimeout(timer)
  }, [homeSettled])
  useEffect(() => {
    const timer = setTimeout(() => setHomeSettled(true), 2500)
    return () => clearTimeout(timer)
  }, [])
  // Friends: the menu's dot for the requests waiting, and the notifications
  // offer once a new friendship lets challenges come in — never before.
  const [friendRequests, setFriendRequests] = useState(0)
  const [pushOffer, setPushOffer] = useState<number | null>(null)
  const takeFriends = useCallback((list: readonly Friend[]) => {
    setFriendRequests(list.filter((friend) => friend.relation === 'incoming').length)
    const friends = list.filter((friend) => friend.relation === 'friend').length
    if (!pushOfferDue(friends)) return
    pushState().then((state) => {
      // Already allowed, refused, or no push in this build: nothing to offer.
      if (state === 'ask') setPushOffer(friends)
      else markPushOffered(friends)
    })
  }, [])
  const refreshFriends = useCallback(() => {
    if (!named) return setFriendRequests(0)
    fetchFriends().then((list) => list && takeFriends(list))
  }, [named, takeFriends])

  // Whoever invited this device becomes a friend as soon as its account has
  // a name: at once if it already has one, else the moment it is chosen.
  const [inviteRef, setInviteRef] = useState(() => {
    takeAddressRef()
    return loadInviteRef()
  })
  useEffect(() => onInstallReferrer((text) => setInviteRef((kept) => keepInviteRef(refIn(text)) ?? kept)), [])
  useEffect(() => {
    if (!named || !inviteRef) return
    let live = true
    acceptInvite(inviteRef).then((inviter) => {
      if (!live || inviter === 'unreachable') return
      clearInviteRef()
      setInviteRef(null)
      if (inviter) refreshFriends()
    })
    return () => {
      live = false
    }
  }, [named, inviteRef, refreshFriends])

  // No push service: the home screen asks again when it comes back into view,
  // and every minute while it stays there. The boards follow, less often.
  const atHome = session.phase === 'home'
  useEffect(() => {
    if (!atHome) return
    if (named) {
      refreshChallenges()
      refreshFriends()
    }
    const visible = () => document.visibilityState === 'visible'
    const tick = () => {
      if (!visible() || !named) return
      refreshChallenges()
      refreshFriends()
    }
    const boardsTick = () => visible() && loadBoards().then((next) => next && setBoards(next))
    const back = () => {
      tick()
      boardsTick()
    }
    document.addEventListener('visibilitychange', back)
    const timer = setInterval(tick, 60_000)
    const boardsTimer = setInterval(boardsTick, BOARDS_REFRESH_MS)
    return () => {
      document.removeEventListener('visibilitychange', back)
      clearInterval(timer)
      clearInterval(boardsTimer)
    }
  }, [atHome, named, refreshChallenges, refreshFriends])

  const launchChallenge = useCallback(
    async (detail: ChallengeDetail, powers: readonly PowerId[]) => {
      setPicking(null)
      setChallengeOpen(null)
      setMenuPage(null)
      setPlayed(detail)
      setRunLang(detail.lang)
      dispatch({ type: 'play' })
      setBoardsBefore(null)
      setBoardsAfter(null)
      try {
        const [judge] = await Promise.all([judgeFor(detail.categoryIds, detail.lang, true), preloadRunScreens()])
        dispatch({
          type: 'ready',
          judge,
          seed: detail.seed,
          categoryIds: detail.categoryIds,
          reserve: [],
          challenge: { id: detail.id, powers },
        })
      } catch {
        dispatch({ type: 'load-failed', message: t.loadFailed })
      }
    },
    [judgeFor, t],
  )

  /** Straight into the run, unless the player has more allowed powers than slots to fill. */
  const startChallenge = useCallback(
    (detail: ChallengeDetail) => {
      const me = detail.players.find((player) => player.me)
      if (detail.finished || !me || me.playedAt !== null) return setChallengeOpen(detail.id)
      markChallengeSeen(detail.id, 'invite')
      if (!detail.powersAllowed) {
        launchChallenge(detail, [])
      } else if (needsPowerPick(session.profile)) {
        setChallengeOpen(null)
        setPicking(detail)
      } else {
        launchChallenge(detail, defaultChallengePowers(session.profile))
      }
    },
    [session.profile, launchChallenge],
  )

  const startChallengeById = useCallback(
    async (id: string) => {
      const detail = await fetchChallenge(id)
      if (detail) startChallenge(detail)
      else setChallengeOpen(id)
    },
    [startChallenge],
  )

  /** A lineup dealt from the player's own categories, in the challenge's language. */
  const challengeLineup = useCallback(
    (seed: number, challengeLang: string) => {
      const shipped = new Set(availableCategoryIds(challengeLang))
      return dealLineup(seed, ownedCategoryIds(session.profile).filter((id) => shipped.has(id))).dealt
    },
    [session.profile],
  )

  /** The owner's categories a challenge in this language can play. */
  const challengeCategories = useMemo(() => {
    const shipped = new Set(availableCategoryIds(lang))
    return ownedCategoryIds(session.profile).filter((id) => shipped.has(id))
  }, [lang, session.profile])

  /** The form opens on a dealt lineup and powers allowed, when the owner has any. */
  const openCreate = useCallback(
    (friends: readonly string[] = []) => {
      const seed = Date.now() >>> 0
      setChallengeOpen(null)
      setCreating({
        busy: false,
        message: null,
        rules: { categoryIds: challengeLineup(seed, lang), powers: challengePowers(session.profile).length > 0, name: '' },
        friends,
      })
    },
    [challengeLineup, lang, session.profile],
  )
  const playerActions = useMemo<PlayerActions>(
    () => ({ ...DEFAULT_PLAYER_ACTIONS, challenge: (friendId) => openCreate([friendId]) }),
    [openCreate],
  )

  const create = useCallback(
    async (friends: readonly string[], rules: ChallengeRules) => {
      setCreating({ busy: true, message: null, rules, friends })
      const seed = Date.now() >>> 0
      const id = await createChallenge(lang, seed, rules.categoryIds, friends, rules.powers, rules.name)
      const detail = id ? await fetchChallenge(id) : null
      if (!detail) return setCreating({ busy: false, message: t.challenge.createFailed, rules, friends })
      setCreating(null)
      trackFeature('challenge_created', { friends: friends.length, powers: rules.powers })
      refreshChallenges()
      startChallenge(detail)
    },
    [lang, refreshChallenges, startChallenge, t],
  )

  // Only one rematch per challenge: whoever comes second is sent to the first one.
  const rematch = useCallback(
    async (detail: ChallengeDetail) => {
      // The categories its owner chose stand for the rematch: a new seed is new enough.
      const id = detail.nextId ?? (await rematchChallenge(detail.id, Date.now() >>> 0, detail.categoryIds))
      const next = id ? await fetchChallenge(id) : null
      if (!next) return false
      trackFeature('challenge_rematch')
      refreshChallenges()
      startChallenge(next)
      return true
    },
    [refreshChallenges, startChallenge],
  )

  // Push: the phone's token, saved under the account in the interface's
  // language, and a tapped notification waiting for the home screen.
  const pushToken = useRef<string | null>(null)
  const [tapped, setTapped] = useState<PushData | null>(null)
  useEffect(() => {
    if (!named) return
    return enablePush(t.challenge.title, (token) => {
      pushToken.current = token
      savePushToken(token, lang)
    })
  }, [named, lang, t])
  const refreshNow = useRef(refreshChallenges)
  refreshNow.current = refreshChallenges
  useEffect(() => onPush(setTapped, () => refreshNow.current()), [])
  // A tap lands wherever the game stands: it waits for the home screen, and
  // for the account that tells whose challenge it is.
  useEffect(() => {
    if (!tapped || !named || session.phase !== 'home') return
    setTapped(null)
    setMenuPage(null)
    setHeldNotices((held) => [...held, tapped.challenge])
    // Even an invitation opens on its screen: the player may not want to play right now.
    setChallengeOpen(tapped.challenge)
  }, [tapped, named, session.phase])

  const [swapping, setSwapping] = useState(false)
  const swap = useCallback(
    async (index: number) => {
      if (!session.run || swapping || session.swapsLeft <= 0) return
      const lineup = swapCategory({ dealt: session.run.categoryIds, reserve: session.reserve }, index)
      if (lineup.dealt === session.run.categoryIds) return
      setSwapping(true)
      try {
        const judge = await judgeFor(lineup.dealt)
        dispatch({ type: 'swapped', judge, categoryIds: lineup.dealt, reserve: lineup.reserve })
        trackFeature('swap')
        if (lineup.reserve[0]) loadPack(lang, lineup.reserve[0]).catch(() => undefined)
      } catch {
        /* the dictionary did not come: the run keeps the category it had */
      } finally {
        setSwapping(false)
      }
    },
    [session.run, session.reserve, session.swapsLeft, swapping, judgeFor, lang],
  )

  const choose = useCallback((categoryId: string) => {
    trackFeature('category_chosen', { category: categoryId })
    dispatch({ type: 'choose', categoryId })
  }, [])
  const choosePower = useCallback((powerId: string) => {
    trackFeature('power_chosen', { power: powerId })
    dispatch({ type: 'choose-power', powerId })
  }, [])
  const supportAsked = useCallback(() => dispatch({ type: 'support-asked' }), [])
  const joinPlus = useCallback(() => {
    trackFeature('premium_joined')
    dispatch({ type: 'join-plus', at: Date.now() })
  }, [])
  const peek = useCallback(() => {
    trackFeature('hidden_words_peek')
    dispatch({ type: 'peek' })
  }, [])
  const banActions = useMemo<BanActions>(
    () => ({
      onBan: (categoryId) => {
        trackFeature('category_ban', { category: categoryId })
        dispatch({ type: 'ban', categoryId })
      },
      onUnban: (categoryId) => {
        trackFeature('category_unban', { category: categoryId })
        dispatch({ type: 'unban', categoryId })
      },
      onIntroSeen: () => dispatch({ type: 'ban-intro-seen' }),
      onJoinPlus: joinPlus,
    }),
    [joinPlus],
  )
  // Read from the run as it ended, with the dictionaries it was judged by.
  const hidden = useMemo(
    () => (session.phase === 'over' && session.run && session.judge ? hiddenAnswers(session.run, session.judge) : []),
    [session.phase, session.run, session.judge],
  )

  // Proposing costs no clock: in a timed run, a confirmation dialog would take
  // the seconds the player is spending on the word they just failed to place.
  const propose = useCallback(
    (word: string) => {
      if (!session.run) return
      const proposal: Proposal = {
        word: word.trim(),
        categoryId: session.run.prompt.categoryId,
        at: Date.now(),
        lang: runLang ?? lang,
      }
      saveSubmissions([...loadSubmissions(), proposal])
      trackFeature('word_proposed', { category: proposal.categoryId })
      dispatch({ type: 'propose', proposal })
    },
    [session.run, lang, runLang],
  )

  /** Ce que le serveur tient d'un mot proposé : rien tant qu'il attend sur l'appareil. */
  const submissionOf = useCallback(
    (proposal: Proposal) =>
      mine.find(
        (submission) =>
          submission.lang === proposal.lang &&
          submission.categoryId === proposal.categoryId &&
          compactWord(submission.display) === compactWord(proposal.word),
      ) ?? null,
    [mine],
  )

  const runProposals = useMemo(
    () => session.proposals.map((proposal) => ({ proposal, submission: submissionOf(proposal) })),
    [session.proposals, submissionOf],
  )

  const correctProposal = useCallback(
    async (proposal: Proposal, display: string) => {
      const submission = submissionOf(proposal)
      // Un mot déjà chez le serveur passe par `amend_submission`, qui refuse
      // dès qu'un modérateur a voté ; l'autre se corrige dans la file.
      const ok = submission ? await correctSubmission(submission, display) : amendQueued(proposal, display)
      // Un refus peut vouloir dire qu'un modérateur a voté entre-temps : relire
      // ses demandes remet alors la ligne au statut qu'elle a maintenant.
      if (!ok) {
        refreshMine()
        return false
      }
      dispatch({ type: 'proposal-amended', at: proposal.at, display: display.trim() })
      refreshMine()
      return true
    },
    [submissionOf, refreshMine],
  )

  const withdrawProposal = useCallback(
    async (proposal: Proposal) => {
      const submission = submissionOf(proposal)
      // `cancelSubmission` ne retire qu'un mot encore en attente : un mot
      // accepté a payé son XP, un mot refusé reste en archive.
      const ok = submission ? await cancelSubmission(submission.id) : dropQueued(proposal)
      // Même relecture qu'à la correction : le mot a pu être tranché depuis.
      if (!ok) {
        refreshMine()
        return false
      }
      dispatch({ type: 'proposal-withdrawn', at: proposal.at })
      refreshMine()
      return true
    },
    [submissionOf, refreshMine],
  )

  useEffect(() => {
    if (session.phase !== 'over' || !session.run) return
    const playedLang = runLang ?? lang
    track('run_end', {
      mode: session.challengeId ? 'challenge' : 'solo',
      score: session.run.score,
      words: session.run.found.length,
      skips: session.run.skips,
      combo: session.run.bestCombo,
      prompts: session.run.settled.length,
      empty: session.run.settled.filter((prompt) => prompt.passed).length,
      rerolls: session.run.rerolls,
      categories: session.run.categoryIds,
      powers: session.run.powers,
      proposed: session.proposals.length,
      lang: playedLang,
    })
    const record = recordOf(session.run, Date.now(), playedLang)
    setHistory((previous) => {
      const next = appendRecord(previous, record)
      saveHistory(next)
      return next
    })
    // Les mots proposés partent avec la partie : le bilan les relit aussitôt
    // après, avec l'identifiant que le serveur leur a donné.
    const flushed = flushSubmissions()
    flushed.then(refreshMine)
    reportRun(session.run)
    reportAchievements(session.profile)
    const challengeId = session.challengeId
    if (challengeId) {
      setAfterRun('sending')
      const sent = pushChallengeRun(challengeId, session.run, session.profile)
      pushing.current = Promise.all([sent, flushed])
      sent
        .then((ok) => (ok ? fetchChallenge(challengeId) : null))
        .then((detail) => setAfterRun(detail ?? 'failed'))
      return
    }
    const pushed = pushRun(session.run, record, session.profile)
    pushing.current = Promise.all([pushed, flushed])
    // Read after the run is in, or the boards would not count it yet.
    // A word proposed during the run may be waiting for a verdict already.
    pushed.then(refreshModeration)
    // Les découvertes ne se comptent que sur le serveur, la partie une fois arrivée.
    pushed.then(fetchMyDiscoveries).then((count) => count !== null && reportAchievements(session.profile, count))
    pushed
      .then(loadBoards)
      .then((next) => {
        setBoards(next)
        setBoardsAfter(next)
      })
    // The run is pushed once, when the clock stops: the profile that follows it
    // in the same render is the one the score was just added to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase])

  closeChallengeLayer.current = () => {
    if (picking) setPicking(null)
    else if (creating) setCreating(null)
    else if (challengeOpen) setChallengeOpen(null)
    else return false
    return true
  }

  const leaveChallenge = () => {
    setChallengeOpen(null)
    refreshChallenges()
  }
  const myName = account && !account.anonymous ? account.name : null
  const move =
    myName && boardsBefore && boardsAfter && boardsAfter !== climbSeen ? standingMove(boardsBefore.day, boardsAfter.day, myName) : null
  const climbed = move && move.from !== null && move.to < move.from ? move.from - move.to : 0
  const climbing = session.phase === 'home' && climbed > 0
  useEffect(() => {
    if (!climbing) return
    // Past the animation: coming back home later shows the board at rest.
    const timer = setTimeout(() => setClimbSeen(boardsAfter), 3000)
    return () => clearTimeout(timer)
  }, [climbing, boardsAfter])

  // La langue de la partie qui vient de finir : un mot entré dans un autre
  // dictionnaire ne se reconnaîtrait pas dans celui-ci.
  const mineWords = useMemo(
    () =>
      new Set(
        mine
          .filter((submission) => submission.status === 'accepted' && submission.lang === (runLang ?? lang))
          .map((submission) => compactWord(submission.display)),
      ),
    [mine, runLang, lang],
  )

  // One run_start per run, read at its announcement: the lineup, the powers
  // carried and the mode are all known by then.
  useEffect(() => {
    if (session.phase !== 'countdown' || !session.run) return
    track('run_start', {
      mode: session.challengeId ? 'challenge' : 'solo',
      categories: session.run.categoryIds,
      powers: session.run.powers,
      first: session.profile.runs === 0,
      lang: runLang ?? lang,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase])

  const screenName = tutorial
    ? 'tutorial'
    : editingAvatar
      ? 'avatar'
      : moderating
        ? 'moderation'
        : picking
          ? 'challenge-powers'
          : creating
            ? 'challenge-create'
            : challengeOpen && session.phase === 'home'
              ? 'challenge'
              : menuPage && (session.phase === 'home' || session.phase === 'loading')
                ? `menu:${menuPage}`
                : session.phase
  useEffect(() => setTrackScreen(screenName), [screenName])

  const quietHome = session.phase === 'home' && !tutorial && !menuOpen && !editingAvatar && !moderating && !challengeOpen && !creating && !picking
  const notice = quietHome ? challengeNotice(challenges, heldNotices) : null
  const popsQuiet =
    !notice &&
    quietHome &&
    update !== 'due' &&
    !(moderation?.offer && !offerHeld) &&
    wordsNews.length === 0 &&
    !complicationDue(session.profile, acceptedWords) &&
    pushOffer === null
  // Premium thanks its new member once, back home, and asks for an opinion in
  // exchange: that ask stands in for the regular one if both are due.
  const thanksPop = popsQuiet && cloudConfigured() && plusThanksDue(session.profile)
  const feedbackPop = popsQuiet && feedbackAsk && !thanksPop

  if (debugPhase !== null && locale !== null) {
    return (
      <MessagesContext value={t}>
        <main className={`stage stage--${debugPhase}${isNativeApp() ? '' : ' stage--muteable'}`}>
          <Suspense fallback={null}>
            <DebugBoard
              onPhase={setDebugPhase}
              onClose={() => {
                if (window.location.hash === '#debug') window.history.replaceState(null, '', window.location.pathname + window.location.search)
                setDebugPhase(null)
              }}
            />
          </Suspense>
        </main>
      </MessagesContext>
    )
  }

  if (locale === null) {
    return (
      <main className="stage stage--home">
        <LanguagePicker onPick={speak} />
      </main>
    )
  }

  return (
    <MessagesContext value={t}>
    <PlayerActionsContext value={playerActions}>
    <main className={`stage stage--${tutorial ? 'playing' : session.phase}${isNativeApp() ? '' : ' stage--muteable'}`}>
      {tutorial && (session.phase === 'home' || session.phase === 'loading') && <TutorialScreen lang={lang} onDone={endTutorial} />}

      {editingAvatar && (
        <Suspense fallback={null}>
          <AvatarScreen
            profile={session.profile}
            avatar={avatar}
            onSave={(next) => {
              trackFeature('avatar_saved', { design: next.design, ground: next.ground })
              wear(next)
              // The boards read the avatar from the profile: only a fetch after the write shows it.
              pushAvatar(next).then((saved) => {
                if (saved) loadBoards().then(setBoards)
              })
              setEditingAvatar(false)
            }}
            onBack={() => setEditingAvatar(false)}
          />
        </Suspense>
      )}

      {moderating && (
        <Suspense fallback={null}>
          <ModerationScreen
            lang={lang}
            onDone={() => {
              setModerating(false)
              refreshModeration()
              setMenuPage('requests')
            }}
          />
        </Suspense>
      )}

      {challengeOpen && !editingAvatar && !moderating && session.phase === 'home' && (
        <Suspense fallback={null}>
          <ChallengeScreen
            key={challengeOpen}
            id={challengeOpen}
            onPlay={startChallenge}
            onRematch={rematch}
            onBack={leaveChallenge}
          />
        </Suspense>
      )}

      {!tutorial && !editingAvatar && !moderating && !(challengeOpen && session.phase === 'home') && (session.phase === 'home' || session.phase === 'loading') && (
        <HomeScreen
          profile={session.profile}
          error={session.error}
          loading={session.phase === 'loading'}
          settled={homeSettled}
          boards={boards}
          me={account && !account.anonymous ? account.name : null}
          climbed={climbed}
          avatar={avatar}
          requestsNews={moderation?.news ?? 0}
          categoriesNews={banNews(session.profile, ownedCategoryIds(session.profile)) ? 1 : 0}
          friendRequests={named ? friendRequests : 0}
          challenges={named ? challenges : null}
          onChallenge={setChallengeOpen}
          onCreateChallenge={() => openCreate()}
          onPastChallenges={() => {
            setMenuFocus(true)
            setMenuPage('stats')
          }}
          onMenu={(page = 'profile') => {
            setAccountMode('register')
            setMenuFocus(false)
            setMenuPage(page)
          }}
          onBoardsHidden={() => {
            setAdvancedBoards(true)
            setMenuPage('boards')
          }}
          onPlay={startFirstRun}
          onDebug={() => setDebugPhase('home')}
          onEquip={(slot, powerId) => dispatch({ type: 'equip', slot, powerId })}
          onAccount={
            account?.anonymous
              ? (mode) => {
                  setAccountMode(mode)
                  setMenuPage('profile')
                }
              : undefined
          }
        />
      )}

      {creating && session.phase === 'home' && (
        <Suspense fallback={null}>
          <FriendPicker
            title={t.challenge.create}
            lead={t.challenge.createLead(CHALLENGE_MAX_PLAYERS - 1)}
            exclude={[]}
            max={CHALLENGE_MAX_PLAYERS - 1}
            busy={creating.busy}
            message={creating.message}
            confirmLabel={t.challenge.launch}
            initial={creating.friends}
            onConfirm={(friends) => create(friends, creating.rules)}
            onClose={() => setCreating(null)}
          >
            <ChallengeSetup
              owned={challengeCategories}
              hasPowers={challengePowers(session.profile).length > 0}
              rules={creating.rules}
              onRules={(rules) => setCreating({ ...creating, rules })}
            />
          </FriendPicker>
        </Suspense>
      )}

      {picking && session.phase === 'home' && (
        <Suspense fallback={null}>
          <ChallengePowers
            allowed={challengePowers(session.profile)}
            initial={defaultChallengePowers(session.profile)}
            onStart={(powers) => launchChallenge(picking, powers)}
            onClose={() => setPicking(null)}
          />
        </Suspense>
      )}

      {nameAsk !== null && session.phase === 'home' && !notice && (
        <NamePrompt
          suggestion={nameAsk}
          onChoose={async (name) => {
            const refused = await accountActions.onChooseName(name)
            if (refused === null) setNameAsk(null)
            return refused
          }}
          onLater={() => setNameAsk(null)}
        />
      )}

      {pushOffer !== null && session.phase === 'home' && !notice && (
        // Over the menu too: the friendship is often made there, and the offer follows it at once.
        <PushOffer
          onNo={() => {
            markPushOffered(pushOffer)
            setPushOffer(null)
          }}
          onYes={() => {
            trackFeature('push_accepted')
            markPushOffered(pushOffer)
            setPushOffer(null)
            askPush()
          }}
        />
      )}

      {notice && (
        <ChallengeNotice
          challenge={notice.challenge}
          kind={notice.kind}
          onLater={() => {
            setHeldNotices((held) => [...held, notice.challenge.id])
            // An invitation seen is off the notices for good: it waits in the list.
            if (notice.kind === 'invite') markChallengeSeen(notice.challenge.id, 'invite')
          }}
          onGo={() => {
            setHeldNotices((held) => [...held, notice.challenge.id])
            if (notice.kind === 'invite') startChallengeById(notice.challenge.id)
            else setChallengeOpen(notice.challenge.id)
          }}
        />
      )}

      {!notice && quietHome && update === 'due' && (
        <UpdateNotice
          onLater={() => setUpdate('later')}
          onUpdate={() => {
            trackFeature('store_update')
            setUpdate('later')
            openStoreUpdate()
          }}
        />
      )}

      {!notice &&
        quietHome &&
        update !== 'due' &&
        !offerHeld &&
        moderation?.offer && (
          <ModeratorOffer
            reason={moderation.offer}
            invitedBy={moderation.invitedBy}
            anonymous={account?.anonymous !== false}
            onAccount={() => {
              setOfferHeld(true)
              setMenuPage('profile')
            }}
            onAnswered={refreshModeration}
            onLater={() => setOfferHeld(true)}
            onModerate={() => setModerating(true)}
          />
        )}

      {!notice && quietHome && update !== 'due' && !(moderation?.offer && !offerHeld) && wordsNews.length > 0 && (
        <WordsNewsPop
          words={wordsNews}
          onClose={() => {
            setWordsNews([])
            markRequestsSeen().then((seen) => seen && refreshModeration())
          }}
          // « Mes demandes » marks them seen itself, and shows them highlighted.
          onOpen={() => {
            setWordsNews([])
            setMenuPage('requests')
          }}
        />
      )}

      {!notice &&
        quietHome &&
        update !== 'due' &&
        !(moderation?.offer && !offerHeld) &&
        wordsNews.length === 0 &&
        complicationDue(session.profile, acceptedWords) && (
          <PowerGiftPop powerId="complication" onClose={() => dispatch({ type: 'grant-power', powerId: 'complication' })} />
        )}

      {feedbackPop && <FeedbackPop onClose={() => setFeedbackAsk(false)} />}

      {thanksPop && (
        <FeedbackPop
          intro={t.premiumThanks}
          onClose={() => {
            setFeedbackAsk(false)
            dispatch({ type: 'plus-thanked' })
          }}
        />
      )}

      {menuOpen && !editingAvatar && !moderating && (session.phase === 'home' || session.phase === 'loading') && (
        <Suspense fallback={null}>
          <Menu
            page={menuPage}
            profile={session.profile}
            history={history}
            focusChallenges={menuFocus}
            onStatsRefresh={loadAccountRuns}
            friendRequests={named ? friendRequests : 0}
            onFriends={takeFriends}
            challenges={named ? challenges : null}
            onChallenge={(id) => {
              setMenuPage(null)
              setChallengeOpen(id)
            }}
            onChallengeFriend={(friendId) => {
              setMenuPage(null)
              openCreate([friendId])
            }}
            avatar={avatar}
            account={account}
            accountActions={accountActions}
            accountMode={accountMode}
            theme={theme}
            locale={locale}
            onLocale={speak}
            sound={soundPrefs}
            onSound={tune}
            onTheme={(next) => {
              trackFeature('theme', { theme: next })
              setTheme(next)
              saveTheme(next)
              applyTheme(next)
            }}
            onAvatar={() => {
              setMenuPage(null)
              setEditingAvatar(true)
            }}
            onLogOut={async () => {
              track('logout')
              if (pushToken.current) await forgetPushToken(pushToken.current)
              await logOut()
              forget()
            }}
            moderation={moderation}
            onModerate={() => {
              setMenuPage(null)
              setModerating(true)
            }}
            onRequestsSeen={refreshModeration}
            onRequestsOpen={topUpRequests}
            lang={lang}
            advancedBoards={advancedBoards}
            onAdvancedBoards={setAdvancedBoards}
            banActions={banActions}
            onErase={async () => {
              // The device keeps its copy until the server has let go of its
              // own: a failed erase must not leave the player half-deleted.
              if (!(await deleteAccount())) return false
              track('erase')
              forget()
              return true
            }}
            onClose={closeMenu}
          />
        </Suspense>
      )}

      {session.phase === 'countdown' && session.run && (
        <Suspense fallback={null}>
          <CountdownScreen
            key={session.run.seed}
            categoryIds={session.run.categoryIds}
            reserve={session.reserve.length}
            swaps={session.swapsLeft}
            swapping={swapping}
            onSwap={swap}
            onDone={() => {
              setStartedAt(Date.now())
              dispatch({ type: 'start' })
            }}
          />
        </Suspense>
      )}

      {session.phase === 'playing' && session.run && (
        <Suspense fallback={null}>
          <RunScreen
            run={session.run}
            draft={session.draft}
            live={session.live}
            cheer={session.cheer}
            remaining={remaining}
            hushed={hushed}
            next={coming}
            onType={(draft) => {
              // Dev only: "@" answers for the tester, who is left to validate.
              if (import.meta.env.DEV && draft.includes('@') && session.run) {
                const { prompt, found } = session.run
                const played = found.map((word) => word.word)
                void loadPack(lang, prompt.categoryId).then((pack) =>
                  dispatch({ type: 'type', draft: commonWord(pack, prompt.letter, played) ?? draft.replace('@', '') }),
                )
                return
              }
              dispatch({ type: 'type', draft })
            }}
            onSubmit={(auto) => dispatch({ type: 'submit', at: elapsed, auto })}
            onSkip={() => dispatch({ type: 'skip', at: elapsed })}
            onReroll={() => dispatch({ type: 'reroll', at: elapsed })}
            proposed={session.proposals.map((proposal) => normalizeWord(proposal.word))}
            mine={mineWords}
            onPropose={propose}
            rivals={rivals}
            avatar={avatar}
          />
        </Suspense>
      )}

      {!editingAvatar && session.phase === 'over' && session.run && (
        <Suspense fallback={null}>
          <OverScreen
            run={session.run}
            profile={session.profile}
            profileBefore={session.profileBefore}
            revealed={revealed === session.run.seed}
            onRevealed={() => setRevealed(session.run?.seed ?? null)}
            lang={lang}
            avatar={avatar}
            account={account}
            accountActions={accountActions}
            onAvatar={() => setEditingAvatar(true)}
            onChoose={choose}
            onChoosePower={choosePower}
            onSupportAsked={supportAsked}
            boardsBefore={boardsBefore}
            boardsAfter={boardsAfter}
            me={account && !account.anonymous ? account.name : null}
            mine={mineWords}
            proposals={runProposals}
            onCorrectProposal={correctProposal}
            onWithdrawProposal={withdrawProposal}
            hidden={hidden}
            onPeek={peek}
            onJoinPlus={joinPlus}
            onReplay={play}
            onHome={() => {
              // Asked on the way home, never over the summary: after the tenth run, then every thirty.
              if (cloudConfigured() && feedbackDue(session.profile)) {
                dispatch({ type: 'feedback-asked' })
                setFeedbackAsk(true)
              }
              dispatch({ type: 'home' })
              if (session.challengeId) {
                setPlayed(null)
                refreshChallenges()
              }
            }}
            challenge={session.challengeId ? afterRun : undefined}
            onChallengeChanged={() => {
              if (session.challengeId) fetchChallenge(session.challengeId).then((detail) => detail && setAfterRun(detail))
            }}
          />
        </Suspense>
      )}

      {!isNativeApp() && <MuteButton muted={soundPrefs.muted} onToggle={() => tune({ ...soundPrefs, muted: !soundPrefs.muted })} />}
    </main>
    </PlayerActionsContext>
    </MessagesContext>
  )
}
