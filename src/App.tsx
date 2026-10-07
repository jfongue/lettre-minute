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
  fetchRunsBefore,
  fetchMySubmissions,
  markRequestsSeen,
  topUpModeration,
  type Submission,
  logIn,
  logInWithGoogle,
  logOut,
  markChallengeSeen,
  proposeBan,
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
  declineDuel,
  fetchDuelInvites,
  fetchFeatureFlags,
  fetchLeaderboard,
  fetchMyDiscoveries,
  type DuelInvitation,
  fetchProgress,
  pushProgress,
} from './lib/cloud'
import { progressOf, withProgress } from './domain/progress'
import { reportAchievements, reportRun } from './lib/playGames'
import {
  askPush,
  clearDuelPushes,
  clearPushes,
  duelPushTag,
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
  onInstallTraces,
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
import { completeLeaderboard } from './domain/leaderboards'
import { NEW_PROFILE, markDailyFirst, settleReview, type Profile } from './domain/progression'
import { hasPower, isHushed, nextPrompt, promptKey, RUN_SECONDS, remainingSeconds } from './domain/run'
import { DAMPED_PROMPTS, type PromptRecord } from './domain/prompts'
import { DAMPED_WORDS } from './data/damped-words'
import { adsDue, dealLineup, ownedCategoryIds, swapCategory, unlockEverything } from './domain/unlocks'
import { compactWord, normalizeWord } from './domain/text'
import { commonWord, withExtraWords } from './domain/words'
import { loadMessages, MessagesContext, messagesFor, type Locale } from './i18n'
import { standingMove } from './domain/standing'
import { challengeNotice, settledPushTags } from './state/challenges'
import { markPushOffered, pushOfferDue } from './state/pushOffer'
import { clearInviteRef, keepInviteRef, loadInviteRef, refIn, takeAddressRef } from './state/inviteRef'
import { createJudge } from './state/judge'
import { banNews, feedbackDue, hiddenAnswers, hiddenAnswersOf, isPlus, peeksLeft, playableCategoryIds, plusThanksDue, shareNewsDue } from './domain/perks'
import { enabledFeatures, type FeatureId, type Roles } from './domain/features'
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
  loadMultiplayerNews,
  loadProfile,
  loadQuietSignInTried,
  saveQuietSignInTried,
  loadQueueSeenOn,
  loadShareNewsSeen,
  loadSubmissions,
  loadTutorialDone,
  saveAccount,
  saveAvatar,
  saveHistory,
  saveMultiplayerPlayed,
  saveProfile,
  saveQueueSeenOn,
  saveShareNewsSeen,
  saveSubmissions,
  saveTutorialDone,
} from './state/storage'
import { loadFeatures, saveFeatureFlags, saveFeatureRoles } from './state/storage'
import { countsForProgress, modeEdge, type ArcadeMode, type GameMode } from './domain/modes'
import { queueAlertDue } from './domain/moderation'
import { loadSoundPrefs, saveSoundPrefs } from './state/sound'
import { applyTheme, loadTheme, saveTheme, type Theme } from './state/theme'
import { useElapsed } from './state/useElapsed'
import type { AccountActions, AccountMode } from './ui/AccountPanel'
import { ChallengeNotice } from './ui/ChallengeHome'
import { UpdateNotice } from './ui/UpdateNotice'
import { useLeaving } from './ui/useLeaving'
import { PowerGiftPop, ShareNewsPop, WordsNewsPop } from './ui/WordsNews'
import type { ChallengeRules } from './ui/ChallengeSetup'
import { DEFAULT_PLAYER_ACTIONS, PlayerActionsContext, type PlayerActions } from './ui/PlayerSheet'
import { HomeScreen } from './ui/HomeScreen'
import { LanguagePicker } from './ui/LanguagePicker'
import type { MenuPage } from './ui/Menu'
import type { FlagWord, RecapActions } from './ui/StatsPage'
import { ModeratorOffer } from './ui/ModeratorOffer'
import { MuteButton } from './ui/MuteButton'
import { NamePrompt } from './ui/NamePrompt'
import { PushOffer } from './ui/PushOffer'
import type { Racer } from './ui/RunScreen'
import { lazyScreen } from './ui/lazyScreen'
import { TutorialScreen, tutorialPrompt } from './ui/TutorialScreen'
import { dismissTopOverlay } from './ui/useBackDismiss'
import { FeaturesContext } from './ui/features'
import { DuelBanner, DuelInviteCard, PlayTogether } from './ui/PlayTogether'
import { GameModes } from './ui/GameModes'
import { ModeTutorial } from './ui/ModeTutorial'
import type { DuelExit } from './state/duel'

// Everything but the home screen waits in its own chunk: the first paint only
// parses what it shows. `preloadScreens` fetches them once the home screen has
// settled, and a run awaits its own before it starts.
const DebugBoard = lazyScreen(() => import('./debug/DebugBoard').then((module) => module.DebugBoard))
const AvatarScreen = lazyScreen(() => import('./ui/AvatarScreen').then((module) => module.AvatarScreen))
const AchievementsScreen = lazyScreen(() => import('./ui/AchievementsScreen').then((module) => module.AchievementsScreen))
const ChallengePowers = lazyScreen(() => import('./ui/ChallengePowers').then((module) => module.ChallengePowers))
const ChallengeSetup = lazyScreen(() => import('./ui/ChallengeSetup').then((module) => module.ChallengeSetup))
const ChallengeScreen = lazyScreen(() => import('./ui/ChallengeScreen').then((module) => module.ChallengeScreen))
const FriendPicker = lazyScreen(() => import('./ui/FriendPicker').then((module) => module.FriendPicker))
const CountdownScreen = lazyScreen(() => import('./ui/CountdownScreen').then((module) => module.CountdownScreen))
const Menu = lazyScreen(() => import('./ui/Menu').then((module) => module.Menu))
const ModerationScreen = lazyScreen(() => import('./ui/ModerationScreen').then((module) => module.ModerationScreen))
const OverScreen = lazyScreen(() => import('./ui/OverScreen').then((module) => module.OverScreen))
const RunScreen = lazyScreen(() => import('./ui/RunScreen').then((module) => module.RunScreen))
const WordsBoard = lazyScreen(() => import('./debug/WordsBoard').then((module) => module.WordsBoard))
const FeaturesBoard = lazyScreen(() => import('./debug/FeaturesBoard').then((module) => module.FeaturesBoard))
const DuelScreen = lazyScreen(() => import('./ui/DuelScreen').then((module) => module.DuelScreen))

/** The run's own screens: awaited with its dictionaries, so the countdown never opens on a blank frame. */
function preloadRunScreens(): Promise<unknown> {
  return Promise.all([CountdownScreen.preload(), RunScreen.preload(), OverScreen.preload()])
}

/** One screen at a time, in the order a player is likely to need them. */
async function preloadScreens(): Promise<void> {
  for (const screen of [Menu, CountdownScreen, RunScreen, OverScreen, ChallengeScreen, FriendPicker, ChallengeSetup, ChallengePowers, AvatarScreen, AchievementsScreen, ModerationScreen]) {
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

/** The drawer's way out, as long as `menu-out` in styles.css. */
const MENU_LEAVE_MS = 200
/** A run in progress takes two back presses this close together. */
const LEAVE_RUN_MS = 2000
// A card's scrim closes it like its « Plus tard »: the tap clicks the same.
const TAPPABLE = 'button, a, summary, input[type="checkbox"], .offer-pop-scrim'
const TYPED = new Set(['text', 'email', 'password', 'search'])

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession(NEW_PROFILE))
  const [startedAt, setStartedAt] = useState<number | null>(null)
  // Le mode choisi sous « Jouer » : « solo » tant qu'on n'a rien choisi, et
  // relu par la relecture, qui doit rejouer le même.
  const modeNow = useRef<GameMode>('solo')
  const [modesOpen, setModesOpen] = useState(false)
  // La leçon du mode choisi : elle se joue à chaque sélection d'un mode de la
  // réserve, et `launching` la garde à l'écran le temps que la partie charge.
  const [modeLesson, setModeLesson] = useState<{ mode: ArcadeMode; launching: boolean } | null>(null)
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
  // Closed, the drawer slides back out before it goes (`.menu-layer--leaving`).
  const menuLayer = useLeaving(menuPage, MENU_LEAVE_MS)
  const [inviteOpen, setInviteOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) setInviteOpen(false)
  }, [menuOpen])
  // However the drawer moves — tap, swipe, scrim or back — it sounds the same.
  const drawerMoved = useRef(false)
  useEffect(() => {
    if (drawerMoved.current) sound.drawer(menuOpen)
    drawerMoved.current = true
  }, [menuOpen])
  const [shareNewsSeen, setShareNewsSeen] = useState(loadShareNewsSeen)
  // La pastille du bouton « Multijoueur » : elle tient tant qu'aucune partie à
  // plusieurs — duel ou défi — n'a été lancée depuis cet appareil.
  const [multiplayerNews, setMultiplayerNews] = useState(loadMultiplayerNews)
  const rememberMultiplayer = useCallback(() => {
    saveMultiplayerPlayed()
    setMultiplayerNews(false)
  }, [])
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
    // The language changes only once its messages are there: a failure keeps
    // the one on screen, rather than a locale holding French words.
    void loadMessages(next)
      .then(() => {
        setLocale(next)
        saveLocale(next)
      })
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    if (locale) applyLocale(locale)
    setTrackLang(locale ?? 'none')
  }, [locale])
  const community = useRef<Record<string, CommunityWord[]>>({})
  const [avatar, setAvatar] = useState<AvatarChoice>(DEFAULT_AVATAR)
  const [account, setAccount] = useState<Account | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  const [achievementsOpen, setAchievementsOpen] = useState(false)
  // Les découvertes ne se comptent que sur le serveur : la page des succès les
  // demande à son ouverture plutôt que d'afficher une barre à zéro.
  const [discoveries, setDiscoveries] = useState<number | null>(null)
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
  // Les fonctionnalités ouvertes : la table lue au démarrage précédent — un
  // réglage ne change jamais un écran en cours de session —, et les rôles du
  // serveur dès qu'il répond, ceux du dernier lancement en attendant.
  const [storedFeatures] = useState(loadFeatures)
  const roles: Roles = {
    moderator: moderation ? moderation.moderator : storedFeatures.roles.moderator,
    superModerator: moderation ? moderation.super : storedFeatures.roles.superModerator,
    premium: isPlus(session.profile),
  }
  const features = useMemo(
    () => enabledFeatures(storedFeatures.flags, roles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedFeatures, roles.moderator, roles.superModerator, roles.premium],
  )
  const on = useCallback((id: FeatureId) => features.has(id), [features])
  const featuresNow = useRef(features)
  featuresNow.current = features
  useEffect(() => {
    void fetchFeatureFlags().then((flags) => flags && saveFeatureFlags(flags))
  }, [])
  useEffect(() => {
    if (moderation) saveFeatureRoles({ moderator: moderation.moderator, superModerator: moderation.super })
  }, [moderation])
  const [featuresBoard, setFeaturesBoard] = useState(false)
  // Le duel en direct : l'écran de choix, la table ouverte (neuve ou rejointe),
  // les invitations qui attendent, et ce que la table a dit en renvoyant le joueur.
  const [together, setTogether] = useState(false)
  const [duelOpen, setDuelOpen] = useState<{ join: string | null } | null>(null)
  const [duelInvites, setDuelInvites] = useState<readonly DuelInvitation[]>([])
  const [duelBanner, setDuelBanner] = useState<'kicked' | 'closed' | null>(null)
  const [debugPhase, setDebugPhase] = useState<string | null>(() =>
    window.location.hash === '#debug' && enabledFeatures(storedFeatures.flags, { ...storedFeatures.roles, premium: false }).has('debugBoard') ? 'home' : null,
  )
  // Les classements avancés : le mode débug caché derrière cinq tapes sur
  // « Classement ». Il ne survit pas au rechargement, comme la planche.
  const [advancedBoards, setAdvancedBoards] = useState(false)
  // Le tableau des mots : l'autre mode débug caché, derrière cinq tapes sur
  // « Mes catégories ». Hors du tiroir : il s'affiche même refermé.
  const [wordsBoard, setWordsBoard] = useState(false)

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
  const [queueSeenOn, setQueueSeenOn] = useState(loadQueueSeenOn)
  const queueAlert = moderator && queueAlertDue(moderation?.queue ?? 0, queueSeenOn, new Date().toLocaleDateString('sv'))
  const topUpRequests = useCallback(() => {
    const today = new Date().toLocaleDateString('sv')
    saveQueueSeenOn(today)
    setQueueSeenOn(today)
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
  // Une demande existe dès qu'un mot attend sur l'appareil ou vit chez le serveur :
  // c'est elle qui ouvre « Mes demandes » à l'accueil. La file se relit au retour
  // à l'accueil, la seule fois où la tuile se décide.
  const [queued, setQueued] = useState(() => loadSubmissions().length)
  useEffect(() => {
  if (session.phase === 'home') setQueued(loadSubmissions().length)
  }, [session.phase])
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
    if (!answered.account || (account && !account.anonymous) || quietTried.current || !featuresNow.current.has('playGames')) return
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
    // The code of whoever invited the player who leaves must not befriend the
    // next account made on this device.
    clearInviteRef()
    setInviteRef(null)
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
  // When the last back press came in, so a run takes two of them.
  const leftRun = useRef(0)
  // The challenge screens close one at a time, the way they opened.
  const closeChallengeLayer = useRef<() => boolean>(() => false)
  useEffect(
    () =>
      onBackButton(() => {
        // A pop-up is above whatever screen it covers: it goes first.
        if (dismissTopOverlay()) return true
        if (menuShown.current) {
          // From a sub-page, back hands the profile back before closing the drawer.
          setMenuPage((page) => (page === 'stats' || page === 'requests' || page === 'categories' || page === 'boards' ? 'profile' : null))
          return true
        }
        if (closeChallengeLayer.current()) return true
        if (phase.current === 'home' || phase.current === 'loading') return false
        // A run in progress would be lost by one back press: it takes two.
        if (phase.current === 'playing' || phase.current === 'countdown') {
          const now = Date.now()
          if (now - leftRun.current > LEAVE_RUN_MS) {
            leftRun.current = now
            tapFeedback()
            return true
          }
          leftRun.current = 0
        }
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
      // Le bouton muet joue son clic lui-même : il sert aussi pendant la partie,
      // quand cet écouteur-ci est retiré.
      if (event.target instanceof Element && event.target.closest(TAPPABLE) && !event.target.closest('.mute')) sound.click()
    }
    // A field outside the run types like the run's own; one that plays its keys itself says so.
    const type = (event: Event) => {
      const field = event.target
      if (!(field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && TYPED.has(field.type)))) return
      if (field.closest('[data-keys]')) return
      sound.key(event instanceof InputEvent && event.inputType.startsWith('delete'))
    }
    document.addEventListener('click', click, true)
    document.addEventListener('input', type, true)
    return () => {
      document.removeEventListener('click', click, true)
      document.removeEventListener('input', type, true)
    }
  }, [quietTaps])

  // Le retard part à la validation à vide, pas au compte à rebours : c'est ce
// clic qui met son horloge en marche.
useEffect(() => {
if (session.run?.mode !== 'delayed' || !session.run.armed) return
setStartedAt((at) => at ?? Date.now())
}, [session.run?.mode, session.run?.armed])


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
  const adsWanted = on('ads') && adsDue(session.profile) && (session.phase === 'home' || session.phase === 'over')
  useEffect(() => {
    if (adsWanted) prepareAds()
  }, [adsWanted])

  const judgeFor = useCallback(
    async (categoryIds: readonly string[], packLang: string = lang, challenge = false, edge: 'first' | 'last' = 'first') => {
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
      // Les freins écrits à la main, et ceux que `ban:sync` calcule pour les
      // couples qu'un ban a vidés : les deux multiplient la cote du tirage.
      const damped = { ...DAMPED_PROMPTS[packLang], ...DAMPED_WORDS[packLang] }
      return createJudge(packs, usage, t.powers.spells, challenge ? undefined : served, challenge ? undefined : damped, edge)
    },
    [session.profile.usage, crowd, promptStats, lang, t],
  )

  const play = useCallback(async () => {
    const mode = modeNow.current
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
      const [judge] = await Promise.all([judgeFor(lineup.dealt, lang, false, modeEdge(mode)), preloadRunScreens()])
      dispatch({ type: 'ready', judge, seed, categoryIds: lineup.dealt, reserve: lineup.reserve, noPowers: !featuresNow.current.has('powers'), mode })
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
    if (session.profile.runs > 0 || loadTutorialDone() || !on('tutorial')) return play()
    setMenuPage(null)
    setTutorial('teaching')
  }, [session.profile.runs, play, on])
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

  /**
   * Le choix d'un mode : le solo garde son tutoriel de première partie, le
   * retard a le sien — une fois par appareil —, les autres partent droit.
   */
  const pickMode = useCallback(
    (chosen: GameMode) => {
      setModesOpen(false)
      modeNow.current = chosen
      if (chosen === 'solo') {
        startFirstRun()
        return
      }
      setModeLesson({ mode: chosen, launching: false })
    },
    [startFirstRun],
  )
  const endModeTutorial = useCallback(() => {
    setModeLesson((current) => (current ? { ...current, launching: true } : current))
    void play()
  }, [play])
  // Dropped only once the run is loaded, or the home screen would flash
  // between the lesson and the countdown. A failed load lands home with its
  // error, where it belongs.
  useEffect(() => {
    if (tutorial === 'launching' && session.phase !== 'loading') setTutorial(null)
    if (modeLesson?.launching && session.phase !== 'loading') setModeLesson(null)
  }, [tutorial, modeLesson, session.phase])

  const refreshChallenges = useCallback(() => {
    if (!named) return setChallenges(null)
    fetchChallenges().then((next) => {
      setChallenges(next)
      answer('challenges')
    })
  }, [named, answer])
  useEffect(refreshChallenges, [refreshChallenges])
  // A notification whose challenge was played or whose recap was read, here or
  // elsewhere, would only send the player to what they have already done.
  useEffect(() => {
    if (challenges) clearPushes(settledPushTags(challenges))
  }, [challenges])
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
    if (!pushOfferDue(friends) || !featuresNow.current.has('pushOffer')) return
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
  useEffect(() => onInstallTraces((text) => setInviteRef((kept) => keepInviteRef(refIn(text)) ?? kept)), [])
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

  // Les invitations à une table de duel : relues à l'accueil, plus souvent que
  // les défis — une table attend ses joueurs, pas une journée.
  // La dernière liste balayée : relire les notifications de la table à chaque
  // passage coûterait un appel au téléphone toutes les huit secondes.
  const sweptDuelInvites = useRef<string | null>(null)
  const refreshDuelInvites = useCallback(() => {
    if (!named || !featuresNow.current.has('duel')) return setDuelInvites([])
    fetchDuelInvites().then((list) => {
      if (!list) return
      setDuelInvites(list)
      // Le serveur retire la notification d'une table qui n'attend plus par un
      // message muet ; un téléphone éteint l'aurait manqué, on le refait ici.
      const open = list.map((invite) => invite.table)
      if (sweptDuelInvites.current !== open.join(',')) {
        sweptDuelInvites.current = open.join(',')
        clearDuelPushes(open)
      }
    })
  }, [named])
  useEffect(() => {
    if (!atHome || duelOpen || !named || !on('duel')) return
    refreshDuelInvites()
    const timer = setInterval(() => document.visibilityState === 'visible' && refreshDuelInvites(), 8_000)
    return () => clearInterval(timer)
  }, [atHome, duelOpen, named, on, refreshDuelInvites])
  const joinDuelInvite = (table: string) => {
    rememberMultiplayer()
    setDuelInvites((list) => list.filter((invite) => invite.table !== table))
    clearPushes([duelPushTag(table)])
    setMenuPage(null)
    setDuelOpen({ join: table })
  }
  const dropDuelInvite = (table: string) => {
    setDuelInvites((list) => list.filter((invite) => invite.table !== table))
    clearPushes([duelPushTag(table)])
    void declineDuel(table)
  }
  const leaveDuel = useCallback(
    (reason: DuelExit) => {
      setDuelOpen(null)
      if (reason) setDuelBanner(reason)
      refreshDuelInvites()
    },
    [refreshDuelInvites],
  )
  const clearDuelBanner = useCallback(() => setDuelBanner(null), [])

  const launchChallenge = useCallback(
    async (detail: ChallengeDetail, powers: readonly PowerId[]) => {
      rememberMultiplayer()
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
          noPowers: !featuresNow.current.has('powers'),
        })
      } catch {
        dispatch({ type: 'load-failed', message: t.loadFailed })
      }
    },
    [judgeFor, rememberMultiplayer, t],
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
    () => ({ ...DEFAULT_PLAYER_ACTIONS, ...(on('challenges') && { challenge: (friendId: string) => openCreate([friendId]) }) }),
    [on, openCreate],
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
  useEffect(
    () =>
      onPush(setTapped, (data) => {
        // Retirer une invitation de duel ne se joue pas : la notification sort
        // du bandeau, rien d'autre ne bouge.
        if (data.kind === 'duel_cancel') return clearPushes([duelPushTag(data.table)])
        refreshNow.current()
      }),
    [],
  )
  // A tap lands wherever the game stands: it waits for the home screen, and
  // for the account that tells whose challenge it is.
  useEffect(() => {
    if (!tapped || !named || session.phase !== 'home') return
    setTapped(null)
    if (tapped.kind === 'invite' || tapped.kind === 'recap') {
      const challenge = tapped.challenge
      if (!on('challenges')) return
      setMenuPage(null)
      setHeldNotices((held) => [...held, challenge])
      // Even an invitation opens on its screen: the player may not want to play right now.
      setChallengeOpen(challenge)
      return
    }
    if (tapped.kind === 'duel') {
      const table = tapped.table
      if (!on('duel')) return
      clearPushes([duelPushTag(table)])
      rememberMultiplayer()
      setDuelInvites((list) => list.filter((invite) => invite.table !== table))
      setMenuPage(null)
      setDuelOpen({ join: table })
      return
    }
    // Le retrait d'une invitation : la notification n'a plus rien à dire.
    if (tapped.kind === 'duel_cancel') clearPushes([duelPushTag(tapped.table)])
  }, [tapped, named, session.phase, on])

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
  // A past run is read with today's dictionaries: its own are gone with it.
  const statsRecap = useMemo<RecapActions>(
    () => ({
      hiddenFor: async (run) =>
        hiddenAnswersOf(run.prompts ?? [], run.words.map((word) => word.word), await judgeFor(run.categoryIds, run.lang)),
      peeks: peeksLeft(session.profile),
      onPeek: peek,
      onJoinPlus: joinPlus,
      // Only a moderator flags a word: without the role, the recap says nothing of it.
      ...(moderation?.moderator && on('wordFlag') && {
        onFlag: (run, word, reason) => proposeBan(run.lang, word.categoryId, word.word, word.display, reason),
      }),
    }),
    [judgeFor, session.profile, peek, joinPlus, moderation, on],
  )
  // Le bilan de fin de partie signale un mot comme l'historique : même geste,
  // même carte, et la langue de la partie qui vient de finir.
  const overFlag = useMemo(
    () =>
      moderation?.moderator && on('wordFlag') && session.run
        ? (word: FlagWord, reason: string) => proposeBan(runLang ?? lang, word.categoryId, word.word, word.display, reason)
        : undefined,
    [moderation, on, session.run, runLang, lang],
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
      // The run's taps are silent: the word leaving is the only sign it went.
      sound.sent()
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
    // Un mode de la réserve ne laisse rien derrière lui : ni historique, ni
    // serveur, ni succès. Ses mots proposés partent quand même.
    if (!countsForProgress(session.run.mode)) {
      void flushSubmissions().then(refreshMine)
      return
    }
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
    if (featuresNow.current.has('playGames')) {
      reportRun(session.run)
      reportAchievements(session.profile)
    }
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
    pushed.then(fetchMyDiscoveries).then((count) => {
      if (count === null) return
      // La page des succès montre la barre des découvertes, que le serveur compte seul.
      setDiscoveries(count)
      if (featuresNow.current.has('playGames')) reportAchievements(session.profile, count)
    })
    // Premier du jour : le serveur seul connaît la place, et on ne la relit
    // qu'une fois la partie arrivée. Le joueur maison compte : passer premier
    // sans l'avoir battu ne serait pas être premier.
    pushed
      .then(() => fetchLeaderboard('best', 'day'))
      .then((board) => {
        if (!board || !featuresNow.current.has('achievements')) return
        if (completeLeaderboard('best', 'day', board).me?.place !== 1) return
        dispatch({ type: 'profile-loaded', profile: markDailyFirst(profile.current) })
      })
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

  // La page des succès demande ses découvertes la première fois qu'on l'ouvre :
  // une barre à zéro mentirait jusqu'à la partie suivante.
  useEffect(() => {
    if (!achievementsOpen || discoveries !== null) return
    void fetchMyDiscoveries().then((count) => count !== null && setDiscoveries(count))
  }, [achievementsOpen, discoveries])

  closeChallengeLayer.current = () => {
    // Une table de duel se quitte par son bouton : un geste de retour en pleine
    // partie abandonnerait sa réserve sans le dire.
    if (duelOpen) return true
    if (together) setTogether(false)
    else if (picking) setPicking(null)
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
    : achievementsOpen
      ? 'achievements'
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

  const quietHome =
    session.phase === 'home' && !tutorial && !menuOpen && !editingAvatar && !moderating && !challengeOpen && !creating && !picking && !together && !modesOpen && !duelOpen
  const notice = quietHome && on('challenges') ? challengeNotice(challenges, heldNotices) : null
  const updateDue = update === 'due' && on('storeUpdate')
  const offerDue = !!moderation?.offer && !offerHeld && on('moderatorOffer')
  const wordsNewsDue = wordsNews.length > 0 && on('wordsNews')
  const giftDue = complicationDue(session.profile, acceptedWords) && on('powerGift')
  const popsQuiet = !notice && quietHome && !updateDue && !offerDue && !wordsNewsDue && !giftDue && pushOffer === null
  // Premium thanks its new member once, back home, and asks for an opinion in
  // exchange: that ask stands in for the regular one if both are due.
  const thanksPop = popsQuiet && cloudConfigured() && plusThanksDue(session.profile)
  const feedbackPop = popsQuiet && feedbackAsk && !thanksPop && on('feedback')
  const shareNewsPop = popsQuiet && !thanksPop && !feedbackPop && on('friendInvite') && shareNewsDue(session.profile, named, shareNewsSeen)
  const settleShareNews = () => {
    saveShareNewsSeen()
    setShareNewsSeen(true)
  }

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
    <FeaturesContext value={features}>
    <PlayerActionsContext value={playerActions}>
    <main className={`stage stage--${tutorial ? 'playing' : session.phase}${isNativeApp() ? '' : ' stage--muteable'}`}>
      {tutorial && (session.phase === 'home' || session.phase === 'loading') && <TutorialScreen lang={lang} onDone={endTutorial} />}
      {modeLesson && (session.phase === 'home' || session.phase === 'loading') && (
<ModeTutorial mode={modeLesson.mode} lang={lang} onDone={endModeTutorial} />
)}

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

      {achievementsOpen && (
        <Suspense fallback={null}>
          <AchievementsScreen
            profile={session.profile}
            discoveries={discoveries ?? undefined}
            onClose={() => setAchievementsOpen(false)}
          />
        </Suspense>
      )}

      {moderating && (
        <Suspense fallback={null}>
          <ModerationScreen
            lang={lang}
            onVerdict={() => dispatch({ type: 'profile-loaded', profile: settleReview(profile.current) })}
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

      {duelOpen && session.phase === 'home' && (
        <Suspense fallback={null}>
          <DuelScreen lang={lang} mode="online" join={duelOpen.join} onExit={leaveDuel} />
        </Suspense>
      )}

      {together && session.phase === 'home' && !duelOpen && (
        <PlayTogether
          challenge={on('challenges')}
          onClose={() => setTogether(false)}
          onDuel={() => {
            rememberMultiplayer()
            setTogether(false)
            setDuelOpen({ join: null })
          }}
          onChallenge={() => {
            setTogether(false)
            openCreate()
          }}
        />
      )}

      {modesOpen && session.phase === 'home' && !tutorial && (
        <GameModes onPick={pickMode} onClose={() => setModesOpen(false)} />
      )}

      {duelBanner && (
        <DuelBanner text={duelBanner === 'kicked' ? t.duel.kickedBanner : t.duel.closedBanner} onDone={clearDuelBanner} />
      )}

      {!tutorial && !editingAvatar && !moderating && !duelOpen && !(challengeOpen && session.phase === 'home') && (session.phase === 'home' || session.phase === 'loading') && (
        <HomeScreen
          profile={session.profile}
          error={session.error}
          loading={session.phase === 'loading'}
          settled={homeSettled}
          boards={on('leaderboards') ? boards : null}
          me={account && !account.anonymous ? account.name : null}
          climbed={climbed}
          avatar={avatar}
          requestsMade={queued > 0 || mine.length > 0}
          requestsNews={moderation?.news ?? 0}
          queueAlert={queueAlert}
          categoriesNews={banNews(session.profile, ownedCategoryIds(session.profile)) ? 1 : 0}
          friendRequests={named && on('friends') ? friendRequests : 0}
          challenges={named && (on('challenges') || on('duel')) ? (on('challenges') ? challenges : []) : null}
          multiplayerNews={multiplayerNews}
          invites={
            duelInvites[0] ? (
              <DuelInviteCard
                key={duelInvites[0].table}
                host={duelInvites[0].host}
                avatar={duelInvites[0].avatar}
                players={duelInvites[0].players}
                onJoin={() => joinDuelInvite(duelInvites[0]!.table)}
                onDecline={() => dropDuelInvite(duelInvites[0]!.table)}
              />
            ) : null
          }
          onChallenge={setChallengeOpen}
          onCreateChallenge={() => (on('duel') ? setTogether(true) : openCreate())}
          onPastChallenges={() => {
            setMenuFocus(true)
            setMenuPage('stats')
          }}
          onMenu={(page = 'profile') => {
            setAccountMode('register')
            setMenuFocus(false)
            setMenuPage(page)
          }}
          onBoardsHidden={
            on('dashboard')
              ? () => {
                  setAdvancedBoards(true)
                  setMenuPage('boards')
                }
              : undefined
          }
          onPlay={() => (on('gameModes') ? setModesOpen(true) : startFirstRun())}
          onDebug={on('debugBoard') ? () => setDebugPhase('home') : undefined}
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

      {pushOffer !== null && session.phase === 'home' && !notice && on('pushOffer') && (
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

      {!notice && quietHome && updateDue && (
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
        !updateDue &&
        offerDue &&
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
            onModerate={on('moderation') ? () => setModerating(true) : undefined}
          />
        )}

      {!notice && quietHome && !updateDue && !offerDue && wordsNewsDue && (
        <WordsNewsPop
          words={wordsNews}
          onClose={() => {
            setWordsNews([])
            markRequestsSeen().then((seen) => seen && refreshModeration())
          }}
          // « Mes demandes » marks them seen itself, and shows them highlighted.
          onOpen={
            on('myRequests')
              ? () => {
                  setWordsNews([])
                  setMenuPage('requests')
                }
              : undefined
          }
        />
      )}

      {!notice && quietHome && !updateDue && !offerDue && !wordsNewsDue && giftDue && (
          <PowerGiftPop powerId="complication" onClose={() => dispatch({ type: 'grant-power', powerId: 'complication' })} />
        )}

      {shareNewsPop && (
        <ShareNewsPop
          onLater={settleShareNews}
          onOpen={() => {
            settleShareNews()
            setInviteOpen(true)
            setMenuPage('social')
          }}
        />
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

      {menuLayer.shown !== null && !editingAvatar && !moderating && (session.phase === 'home' || session.phase === 'loading') && (
        <Suspense fallback={null}>
          <Menu
            page={menuLayer.shown}
            leaving={menuLayer.leaving}
            profile={session.profile}
            history={history}
            focusChallenges={menuFocus}
            inviteOpen={inviteOpen}
            onStatsRefresh={loadAccountRuns}
            onStatsOlder={account ? fetchRunsBefore : undefined}
            statsRecap={statsRecap}
            friendRequests={named && on('friends') ? friendRequests : 0}
            onFriends={takeFriends}
            challenges={named && on('challenges') ? challenges : null}
            onChallenge={(id) => {
              setMenuPage(null)
              setChallengeOpen(id)
            }}
            onChallengeFriend={
              on('challenges')
                ? (friendId) => {
                    setMenuPage(null)
                    openCreate([friendId])
                  }
                : undefined
            }
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
            onAchievements={() => {
              setMenuPage(null)
              setAchievementsOpen(true)
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
            queueAlert={queueAlert}
            onModerate={() => {
              if (!on('moderation')) return
              setMenuPage(null)
              setModerating(true)
            }}
            onRequestsSeen={refreshModeration}
            onRequestsOpen={topUpRequests}
            lang={lang}
            advancedBoards={advancedBoards && on('dashboard')}
            onAdvancedBoards={on('dashboard') ? setAdvancedBoards : undefined}
            onWordsBoard={on('wordsBoard') ? setWordsBoard : undefined}
            onFeatures={moderation?.super ? () => setFeaturesBoard(true) : undefined}
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

      {wordsBoard && on('wordsBoard') && (
        <Suspense fallback={null}>
          <WordsBoard lang={lang} superModerator={moderation?.super === true} onClose={() => setWordsBoard(false)} />
        </Suspense>
      )}

      {featuresBoard && moderation?.super && (
        <Suspense fallback={null}>
          <FeaturesBoard roles={roles} onClose={() => setFeaturesBoard(false)} />
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
            mode={session.run.mode}
            onSwap={swap}
            onDone={() => {
              // Le retard attend sa première validation : son chrono part de là.
              setStartedAt(session.run?.mode === 'delayed' ? null : Date.now())
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
            onSubmit={(auto) => (session.run?.armed ? dispatch({ type: 'submit', at: elapsed, auto }) : dispatch({ type: 'arm' }))}
            onSkip={() => dispatch({ type: 'skip', at: elapsed })}
            onReroll={() => dispatch({ type: 'reroll', at: elapsed })}
            onRecall={() => dispatch({ type: 'recall' })}
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
            onFlag={overFlag}
            onReplay={play}
            onHome={() => {
              // Asked on the way home, never over the summary: after the tenth run, then every thirty.
              if (cloudConfigured() && feedbackDue(session.profile) && on('feedback')) {
                dispatch({ type: 'feedback-asked' })
                setFeedbackAsk(true)
              }
              dispatch({ type: 'home' })
              if (session.challengeId) {
                setPlayed(null)
                refreshChallenges()
              }
            }}
            ranked={countsForProgress(session.run.mode)}
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
    </FeaturesContext>
    </MessagesContext>
  )
}
