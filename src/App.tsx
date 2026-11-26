import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { availableCategoryIds, loadPack, loadPacks } from './data/packs'
import {
  acceptInvite,
  cancelSubmission,
  correctSubmission,
  createChallenge,
  deleteAccount,
  fetchAccount,
  followHostAccount,
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
  fetchSpiedRuns,
  fetchSpiedProfile,
  fetchPremiumOrigin,
  grantPremium,
  setModerator,
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
  catchUpLostRuns,
  fetchMyDiscoveries,
  flushUnsentRuns,
  type DuelInvitation,
  fetchProgress,
  pushProgress,
} from './lib/cloud'
import { progressOf, withProgress } from './domain/progress'
import { reportAchievements, reportRun } from './lib/playGames'
import { liveTransport } from './lib/live'
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
  prepareInterstitial,
  pushState,
  storeUpdateAvailable,
  tapFeedback,
  type PushData,
  onInstallTraces,
} from './lib/native'
import { configureSound, setHush, setMusic, setPulseStage, sound, tierSound, type SoundPrefs } from './lib/sound'
import { DEFAULT_AVATAR, isDefaultAvatar, sameAvatar, type AvatarChoice } from './domain/avatar'
import { appendRecord, mergeHistory, recordOf, type RunRecord } from './domain/history'
import { boardsStillValid, completeBoards, HOUSE_PLAYER, projectBoards, type Boards } from './domain/boards'
import {
  challengePowers,
  CHALLENGE_MAX_PLAYERS,
  defaultChallengePowers,
  needsPowerPick,
  scoreAt,
} from './domain/challenge'
import { barredBonuses } from './domain/bonus'
import { complicationDue, ownedPowers, slotsOf, type PowerId } from './domain/powers'
import { completeLeaderboard } from './domain/leaderboards'
import { withGuest } from './ui/guestBoards'
import { localBoards } from './ui/localBoards'
import { NEW_PROFILE, markDailyFirst, settleReview, type Profile } from './domain/progression'
import { hasPower, isHushed, nextPrompt, promptKey, RUN_SECONDS, remainingSeconds } from './domain/run'
import { DAMPED_PROMPTS, type PromptRecord } from './domain/prompts'
import { DAMPED_WORDS } from './data/damped-words'
import { sharedCategoryIds } from './domain/catalogue'
import { adsDue, dealLineup, ownedCategoryIds, swapCategory, unlockEverything } from './domain/unlocks'
import { compactWord, normalizeWord } from './domain/text'
import { commonWord, withExtraWords } from './domain/words'
import { categoryText, loadMessages, MessagesContext, messagesFor, type Locale } from './i18n'
import { standingMove } from './domain/standing'
import { challengeNotice, settledPushTags } from './state/challenges'
import { markPushOffered, pushOfferDue } from './state/pushOffer'
import { clearInviteRef, keepInviteRef, loadInviteRef, refIn, takeAddressRef } from './state/inviteRef'
import { createJudge } from './state/judge'
import { todayKey } from './lib/today'
import { adoptOfferedPlus, banNews, feedbackDue, grantPlus, hiddenAnswers, hiddenAnswersOf, isPlus, playableCategoryIds, plusThanksDue, premiereNews, revealBudget, shareNewsDue } from './domain/perks'
import { enabledFeatures, type FeatureId, type Roles } from './domain/features'
import { ratingDue } from './domain/rating'
import { weeklyUnlocked } from './domain/weekly'
import { cloudConfigured } from './lib/supabase'
import { host, hostFeatures, premiumStoreOpen, rewardedAdsOpen } from './platform'
import { buyPremium, premiumOwned, premiumPrice, restorePremium } from './lib/billing'
import { PremiumSheet, type PremiumReason } from './ui/PremiumSheet'
import { PremiumContext, type PremiumDoor } from './ui/premiumContext'
import { usePlatformGameplay } from './platform/usePlatformGameplay'
import { FeedbackPop } from './ui/FeedbackPop'
import { RatingPop } from './ui/RatingPop'
import type { BanActions } from './ui/CategoriesPage'
import { applyLocale, loadLocale, saveLocale } from './state/locale'
import { avatarNewsDue, earnedAchievements, ownsEveryDesign } from './domain/achievements'
import { initialSession, sessionReducer, type Proposal } from './state/session'
import {
  clearLocalData,
  loadAccount,
  loadAvatar,
  loadBoardsMemory,
  loadHistory,
  loadMultiplayerNews,
  loadPremiereNewsSeen,
  loadProfile,
  loadQuietSignInTried,
  saveQuietSignInTried,
  loadQueueSeenOn,
  loadSeenDesignsOrNull,
  loadShareNewsSeen,
  loadSubmissions,
  loadTutorialDone,
  saveAccount,
  saveAvatar,
  saveBoardsMemory,
  saveHistory,
  saveMultiplayerPlayed,
  savePremiereNewsSeen,
  saveProfile,
  saveQueueSeenOn,
  saveShareNewsSeen,
  saveSubmissions,
  type PendingSubmission,
  saveTutorialDone,
} from './state/storage'
import { loadFeatures, saveFeatureFlags, saveFeatureRoles } from './state/storage'
import { countsForProgress, modeEdge, MODE_SECONDS, type ArcadeMode, type GameMode } from './domain/modes'
import { queueAlertDue } from './domain/moderation'
import { loadSoundPrefs, saveSoundPrefs } from './state/sound'
import { applyTheme, loadTheme, saveTheme, type Theme } from './state/theme'
import { useElapsed } from './state/useElapsed'
import type { AccountActions, AccountMode } from './ui/AccountPanel'
import { ChallengeNotice } from './ui/ChallengeHome'
import { UpdateNotice } from './ui/UpdateNotice'
import { useLeaving } from './ui/useLeaving'
import { PowerGiftPop, ShareNewsPop, WordsNewsPop } from './ui/WordsNews'
import { PlusNewsPop, PlusThanksPop } from './ui/PlusNewsPop'
import type { ChallengeRules } from './ui/ChallengeSetup'
import { DEFAULT_PLAYER_ACTIONS, PlayerActionsContext, type PlayerActions } from './ui/PlayerSheet'
import { HomeScreen } from './ui/HomeScreen'
import { LanguagePicker } from './ui/LanguagePicker'
import type { MenuPage } from './ui/Menu'
import type { FlagWord, RecapActions } from './ui/StatsPage'
import { ModeratorOffer } from './ui/ModeratorOffer'
import { MuteButton } from './ui/MuteButton'
import { NamePrompt } from './ui/NamePrompt'
import { usePopQueue } from './ui/usePopQueue'
import { UPDATE_WAIT_MS } from './domain/popups'
import { PushOffer } from './ui/PushOffer'
import type { Racer } from './ui/RunScreen'
import { lazyScreen } from './ui/lazyScreen'
import { TutorialScreen, tutorialPrompt } from './ui/TutorialScreen'
import { dismissTopOverlay } from './ui/useBackDismiss'
import { FeaturesContext } from './ui/features'
import { DuelBanner, DuelInviteCard, PlayTogether } from './ui/PlayTogether'
import { GameModes } from './ui/GameModes'
import { ModeTutorial } from './ui/ModeTutorial'
import { WeeklyDone, WeeklyRecap, WeeklyResults, WeeklyScreen, useWeeklyFlow } from './ui/WeeklyFlow'
import { PowerLoadout } from './ui/PowerLoadout'
import type { DuelExit } from './state/duel'

// Everything but the home screen waits in its own chunk: the first paint only
// parses what it shows. `preloadScreens` fetches them once the home screen has
// settled, and a run awaits its own before it starts.
const DebugBoard = lazyScreen(() => import('./debug/DebugBoard').then((module) => module.DebugBoard))
const ChallengePowers = lazyScreen(() => import('./ui/ChallengePowers').then((module) => module.ChallengePowers))
const ChallengeSetup = lazyScreen(() => import('./ui/ChallengeSetup').then((module) => module.ChallengeSetup))
const ChallengeScreen = lazyScreen(() => import('./ui/ChallengeScreen').then((module) => module.ChallengeScreen))
const FriendPicker = lazyScreen(() => import('./ui/FriendPicker').then((module) => module.FriendPicker))
const CountdownScreen = lazyScreen(() => import('./ui/CountdownScreen').then((module) => module.CountdownScreen))
const Menu = lazyScreen(() => import('./ui/Menu').then((module) => module.Menu))
const ModerationScreen = lazyScreen(() => import('./ui/ModerationScreen').then((module) => module.ModerationScreen))
const ProfileReviewScreen = lazyScreen(() => import('./ui/ProfileReviewScreen').then((module) => module.ProfileReviewScreen))
const OverScreen = lazyScreen(() => import('./ui/OverScreen').then((module) => module.OverScreen))
const RunScreen = lazyScreen(() => import('./ui/RunScreen').then((module) => module.RunScreen))
const WordsBoard = lazyScreen(() => import('./debug/WordsBoard').then((module) => module.WordsBoard))
const FeaturesBoard = lazyScreen(() => import('./debug/FeaturesBoard').then((module) => module.FeaturesBoard))
const DuelScreen = lazyScreen(() => import('./ui/DuelScreen').then((module) => module.DuelScreen))
const DuelMatchmaking = lazyScreen(() => import('./ui/DuelScreen').then((module) => module.DuelMatchmaking))

/** The run's own screens: awaited with its dictionaries, so the countdown never opens on a blank frame. */
function preloadRunScreens(): Promise<unknown> {
  return Promise.all([CountdownScreen.preload(), RunScreen.preload(), OverScreen.preload()])
}

const WEEKLY_SCREENS = [WeeklyScreen, WeeklyResults, WeeklyDone, WeeklyRecap]

/** One screen at a time, in the order a player is likely to need them. */
async function preloadScreens(): Promise<void> {
  for (const screen of [Menu, CountdownScreen, RunScreen, OverScreen, ChallengeScreen, FriendPicker, ChallengeSetup, ChallengePowers, ModerationScreen, ProfileReviewScreen, ...WEEKLY_SCREENS]) {
    await screen.preload().catch(() => undefined)
  }
}

/** The boards as the home screen shows them: without a server, none at all. */
let boardsRead: { at: number; boards: Promise<Boards | null> } | null = null

/**
 * The home's boards. The server rebuilds them every five minutes (0111), so a
 * read under half a minute old — or still on its way — is shared by every
 * screen that asks; `fresh` skips it once the player's own run or name has
 * just changed what they show.
 */
function loadBoards(fresh = false): Promise<Boards | null> {
  const now = Date.now()
  if (!fresh && boardsRead && now - boardsRead.at < BOARDS_SHARED_MS) return boardsRead.boards
  let answered = false
  const boards = fetchBoards().then((read) => {
    if (read) {
      answered = true
      const complete = completeBoards(read)
      saveBoardsMemory(complete, now)
      return complete
    }
    // A server that does not answer leaves the last boards read on screen,
    // today's only, rather than none.
    const kept = loadBoardsMemory()
    return kept ? boardsStillValid(kept.boards, kept.at, Date.now()) : null
  })
  boardsRead = { at: now, boards }
  // A read that failed is not kept: the next screen asks again.
  boards.then(() => {
    if (!answered && boardsRead?.boards === boards) boardsRead = null
  })
  return boards
}

/**
 * Sends the words proposed while the game was offline, and forgets those that
 * went: past the day's cap (0116) the others wait on the device for tomorrow.
 */
function flushSubmissions(): Promise<unknown> {
  const pending = loadSubmissions()
  if (pending.length === 0) return Promise.resolve()
  return pushSubmissions(pending).then((sent) => {
    if (sent.length === 0) return
    const gone = (item: PendingSubmission) => sent.some((done) => done.at === item.at && done.word === item.word)
    saveSubmissions(loadSubmissions().filter((item) => !gone(item)))
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
// The boards' cache on the server is five minutes old at most (0111).
const BOARDS_REFRESH_MS = 300_000
const BOARDS_SHARED_MS = 30_000
// A table waits minutes for its players, not seconds: thousands of homes
// asking every eight seconds weighed on the server.
const DUEL_INVITES_MS = 15_000
const HOST_ACCOUNT_RETRIES_MS = [5_000, 15_000, 45_000, 120_000]

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
// The game's own mute button: not on the phone, which has its buttons, nor in
// a host's frame that brings one (CrazyGames).
const muteable = !isNativeApp() && !host.ownMute

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession(NEW_PROFILE))
  const [startedAt, setStartedAt] = useState<number | null>(null)
  // Le mode choisi sous « Jouer » : « solo » tant qu'on n'a rien choisi, et
  // relu par la relecture, qui doit rejouer le même.
  const modeNow = useRef<GameMode>('solo')
  const [modesOpen, setModesOpen] = useState(false)
  // Le choix des pouvoirs avant une partie seule, là où la fonctionnalité l'ouvre.
  const [loadout, setLoadout] = useState(false)
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
  // Les avant-premières déjà annoncées à cet appareil : une catégorie livrée
  // relance la pop-up, jamais deux fois la même.
  const [premiereNewsSeen, setPremiereNewsSeen] = useState(loadPremiereNewsSeen)
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
  // Le succès touché au bilan : l'éditeur s'ouvre sur son avatar et le secoue.
const [avatarFocus, setAvatarFocus] = useState<number | null>(null)
const closeMenu = useCallback(() => {
setAvatarFocus(null)
setMenuPage(null)
}, [])
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
  // A host's language comes first, and its fallback may stand in for the
  // picker (CrazyGames: English, a player there must land in the game).
  const [locale, setLocale] = useState<Locale | null>(() => loadLocale(host.languages()) ?? host.fallbackLocale)
  const t = messagesFor(locale ?? 'fr')
  // The dictionary follows the interface: a German player answers in German.
  const lang = locale ?? 'fr'
  const speak = useCallback((next: Locale) => {
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
  }, [locale])
  const community = useRef<Record<string, CommunityWord[]>>({})
  const [avatar, setAvatar] = useState<AvatarChoice>(DEFAULT_AVATAR)
  const [account, setAccount] = useState<Account | null>(null)
  // Les découvertes ne se comptent que sur le serveur : la page des succès les
  // demande à son ouverture plutôt que d'afficher une barre à zéro.
  const [discoveries, setDiscoveries] = useState<number | null>(null)
  // Ce que l'éditeur d'avatar a montré à sa dernière sortie : la pastille du menu en dépend.
  const [seenDesigns, setSeenDesigns] = useState(loadSeenDesignsOrNull)
  const refreshSeenDesigns = useCallback(() => setSeenDesigns(loadSeenDesignsOrNull()), [])
  const [moderation, setModeration] = useState<ModerationStatus | null>(null)
  // Words to judge, or, for a super moderator, the profiles of players too often refused (0116).
  const [moderating, setModerating] = useState<false | 'words' | 'profiles'>(false)
  // « Plus tard » holds the offer back until the next launch, without answering it.
  const [offerHeld, setOfferHeld] = useState(false)
  // « Plus tard » on the moderator card a level bonus gave: it comes back at the next launch.
  const [bonusHeld, setBonusHeld] = useState(false)
  // The Premium sheet, opened from anywhere through `PremiumContext`, and the store's price once asked.
  const [premiumFor, setPremiumFor] = useState<PremiumReason | null>(null)
  const [premiumCost, setPremiumCost] = useState<string | null>(null)
  // Set on the way home once `feedbackDue` says so: asked once, answered or not.
  const [feedbackAsk, setFeedbackAsk] = useState(false)
  // Set the same way once `ratingDue` says so; « Okay » answers it for good.
  const [ratingAsk, setRatingAsk] = useState(false)
  // The seed of the run whose reveal has played: leaving for the avatar editor
  // and coming back must not replay it.
  const [revealed, setRevealed] = useState<number | null>(null)
  // Set by the end-of-run summary while it is the screen in view (`OverScreen.onSummary`).
  const [overSummary, setOverSummary] = useState(false)
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
  // The other pop-ups wait for the store's first answer: the update comes first.
  const [updateKnown, setUpdateKnown] = useState(false)
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
  // A guest of a host that gives no anonymous account (CrazyGames) finds
  // their own best on the server's boards, or their runs alone while the
  // server is out of reach.
  const guest = host.guestBoards && (account === null || account.anonymous)
  // A server that does not answer, on a device that has never read the boards
  // (a reviewer's first launch), leaves the player's own runs rather than no
  // leaderboard at all — signed in or not (CrazyGames review of 1.7.6).
  const homeBoards = useMemo(() => {
    if (!boards) return history.length > 0 || guest ? localBoards(history, avatar, t.tag) : null
    return guest ? withGuest(boards, { history, avatar, name: t.boards.me, tag: t.tag }) : boards
  }, [guest, boards, history, avatar, t])
  const features = useMemo(
    () => hostFeatures(enabledFeatures(storedFeatures.flags, roles), roles.superModerator),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedFeatures, roles.moderator, roles.superModerator, roles.premium],
  )
  const on = useCallback((id: FeatureId) => features.has(id), [features])
  // Une version sans compte anonyme (l'invité du portail) n'a aucun compte où
  // devenir modérateur : la carte lui serait un bonus perdu.
  const barred = useMemo(
    () =>
      barredBonuses({
        isModerator: moderation?.moderator === true,
        canName: account?.anonymous === false || host.anonymousAccounts,
        unlimitedReveals: host.unlimitedReveals,
        open: on,
        premiumSold: premiumStoreOpen,
      }, session.profile),
    [moderation?.moderator, account?.anonymous, on, session.profile],
  )
  const featuresNow = useRef(features)
  featuresNow.current = features
  useEffect(() => {
    void fetchFeatureFlags().then((flags) => flags && saveFeatureFlags(flags))
  }, [])
  useEffect(() => {
    if (moderation) saveFeatureRoles({ moderator: moderation.moderator, superModerator: moderation.super })
  }, [moderation])
  // Premium offert : la table l'ouvre au super modérateur tant que la ligne est
  // ouverte, et le lui reprend quand elle se ferme. Le profil s'en souvient, pour
  // que tout ce qui lit `isPlus` — révélations, filtres, tentatives — le voie.
  const grantedPlus = roles.superModerator && features.has('premiumGrant')
  useEffect(() => {
    const next = grantPlus(profile.current, grantedPlus)
    if (next !== profile.current) dispatch({ type: 'profile-loaded', profile: next })
  }, [grantedPlus])
  const [featuresBoard, setFeaturesBoard] = useState(false)
  // Le duel en direct : l'écran de choix, la table ouverte (neuve ou rejointe),
  // les invitations qui attendent, et ce que la table a dit en renvoyant le joueur.
  const [together, setTogether] = useState(false)
  const [duelOpen, setDuelOpen] = useState<{ join: string | null; quick?: boolean; local?: boolean; room?: boolean } | null>(null)
  // The host's rooms (CrazyGames): a friend's table the portal launched the
  // game for or brings the player to while it runs, or the portal's « play
  // with friends » that wants a joinable table at once. A guest is first
  // offered the portal's sign-in for a friend's table — the duel needs a named
  // account —, and plays the house players when launched to play together.
  const [roomCall, setRoomCall] = useState<{ table: string | null } | null>(() => {
    const table = host.rooms?.invited() ?? null
    return table ? { table } : host.rooms?.instant() ? { table: null } : null
  })
  useEffect(() => host.rooms?.onJoin((table) => setRoomCall({ table })), [])
  const [matching, setMatching] = useState(false)
  const [duelInvites, setDuelInvites] = useState<readonly DuelInvitation[]>([])
  const [duelBanner, setDuelBanner] = useState<'kicked' | 'closed' | null>(null)
  const [debugPhase, setDebugPhase] = useState<string | null>(() =>
    window.location.hash === '#debug' && hostFeatures(enabledFeatures(storedFeatures.flags, { ...storedFeatures.roles, premium: false }), storedFeatures.roles.superModerator).has('debugBoard') ? 'home' : null,
  )
  // Les classements avancés : le mode débug caché derrière cinq tapes sur
  // « Classement ». Il ne survit pas au rechargement, comme la planche.
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

  /** La tuile choisie dans le tiroir : portée tout de suite, poussée au compte ensuite. */
  const saveWornAvatar = useCallback(
    (next: AvatarChoice) => {
      wear(next)
      // The boards read the avatar from the profile: only a fetch after the write shows it.
      pushAvatar(next).then((saved) => {
        if (saved) loadBoards(true).then(setBoards)
      })
    },
    [wear],
  )

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
        if (!isDefaultAvatar(worn.current)) pushAvatar(worn.current).then((saved) => { if (saved) loadBoards(true).then(setBoards) })
      } else if (!isDefaultAvatar(server)) {
        wear(server)
      } else if (held === next.name && !sameAvatar(worn.current, server)) {
        pushAvatar(worn.current).then((saved) => { if (saved) loadBoards(true).then(setBoards) })
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
  const avatarNews =
    on('avatar') && !ownsEveryDesign(account?.name) && avatarNewsDue(session.profile, seenDesigns, discoveries ?? undefined)
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

  const readAccount = useCallback(
    () =>
      fetchAccount().then((found) => {
        answer('account')
        // Unreachable keeps the cached account: the session is still on the device.
        if (found === 'unreachable') return
        if (found) adopt(found)
        else {
          // Batched with the cached account read just before, the null would
          // leave the account's own effect unrun and the cache in place.
          setAccount(null)
          saveAccount(null)
        }
      }),
    [adopt, answer],
  )

  useEffect(() => {
    loadBoards().then((next) => {
      setBoards(next)
      answer('boards')
    })
    // A host with its own accounts reads the account once it has been
    // followed: the session on the device may be the one of a player who
    // signed out of the portal, whose progress would be merged into the guest's.
    if (!host.account) readAccount()
    flushSubmissions()
  }, [readAccount, answer])

  // The host's own account (CrazyGames): its signed-in player plays under the
  // game account linked to it, a guest under none.
  // Settled once the first follow has answered: until then a portal player
  // reads as a guest, and a table the portal brought them to must wait for it.
  const [hostAccountSettled, setHostAccountSettled] = useState(!host.account)
  useEffect(() => {
    if (!host.account) return
    // A busy server must not leave a signed-in portal player a guest for the
    // whole visit: the link is tried again, further apart each time.
    let retry: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const follow = (): Promise<unknown> =>
      host
        .account!()
        .then((token) => followHostAccount(token, host.accountService ?? 'crazygames-auth'))
        .then((changed) => {
          clearTimeout(retry)
          if (changed === null && tries < HOST_ACCOUNT_RETRIES_MS.length) {
            retry = setTimeout(follow, HOST_ACCOUNT_RETRIES_MS[tries++])
          } else if (changed !== null) {
            tries = 0
          }
          if (changed) loadBoards(true).then(setBoards)
          return readAccount()
        })
        .finally(() => setHostAccountSettled(true))
    follow()
    host.onAccount?.(() => {
      tries = 0
      void follow()
    })
    return () => clearTimeout(retry)
  }, [adopt])

  // The runs the server could not take wait on the device (`pushRun`): they
  // leave once the account is known, with those lost to the outage of
  // 23 November that the history still holds.
  useEffect(() => {
    if (!hostAccountSettled || !answered.account) return
    void catchUpLostRuns(loadHistory()).finally(() => void flushUnsentRuns())
    // A session that lapsed while the phone slept is renewed on the way back:
    // what it held back leaves then, without waiting for the next run.
    const back = () => {
      if (document.visibilityState === 'visible') void flushUnsentRuns()
    }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [hostAccountSettled, answered.account])

  const refreshModeration = useCallback(() => {
    fetchModerationStatus(lang).then(setModeration)
  }, [lang])
  // The account decides the role, the language which words wait for it.
  useEffect(refreshModeration, [refreshModeration, account?.name, account?.anonymous])

  const moderator = moderation?.moderator === true
  const [queueSeenOn, setQueueSeenOn] = useState(loadQueueSeenOn)
  const queueAlert = moderator && queueAlertDue(moderation?.queue ?? 0, moderation?.topUp === true, queueSeenOn, new Date().toLocaleDateString('sv'))
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
  // The words announced as new each pay one banked reveal, once per submission id.
  const creditNews = useCallback((found: readonly Submission[]) => {
    const ids = found.filter((submission) => submission.fresh).map((submission) => submission.id)
    if (ids.length > 0) dispatch({ type: 'credit-reveals', ids })
  }, [])
  const refreshMine = useCallback(() => {
    fetchMySubmissions().then((found) => {
      if (!found) return
      setMine(found)
      creditNews(found)
    })
  }, [creditNews])
  useEffect(() => {
    if (!signedIn) return
    fetchMySubmissions().then((found) => {
      if (!found) return
      setMine(found)
      setAcceptedWords(found.filter((submission) => submission.status === 'accepted').length)
      setWordsNews(found.filter((submission) => submission.fresh))
      creditNews(found)
    })
  }, [signedIn, account?.name, account?.anonymous, creditNews])

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
    loadBoards(true).then(setBoards)
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
      setAccount(outcome.account)
      pushAvatar(avatar)
      loadBoards(true).then(setBoards)
      // With email confirmation on, the account stays anonymous until the link is followed.
      return outcome.account.anonymous ? t.account.confirmationSent(email.trim()) : null
    },
    async onLogIn(email, password) {
      await pushing.current
      const outcome = await logIn(email, password)
      return enter(outcome)
    },
    async onGoogle() {
      const outcome = await logInWithGoogle(pushing.current)
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
      setAccount(outcome.account)
      loadBoards(true).then(setBoards)
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
    loadBoards(true).then(setBoards)
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
          // Depuis une sous-page, le retour rend l'onglet avant de fermer le
          // tiroir — sauf quand rien ne l'attend derrière (le bilan de fin de
          // partie), où le retour ferme le tiroir d'un coup.
          setMenuPage((page) =>
            page !== null && page !== 'profile' && page !== 'social' && page !== 'options' && phase.current !== 'over'
              ? 'profile'
              : null,
          )
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


  usePlatformGameplay(session.phase, session.run?.score ?? null, session.profile.bestScore, tutorial === 'teaching')

  // The host's banner, on the run and the screens that close it: never for
  // Premium, nor when the ads between runs are closed.
  const bannerWanted =
    (session.phase === 'countdown' || session.phase === 'playing' || session.phase === 'over') &&
    tutorial !== 'teaching' &&
    !isPlus(session.profile) &&
    on('adBreaks')
  useEffect(() => host.setBanner(bannerWanted), [bannerWanted])

  // Every achievement held, for a host that keeps them (Playgama's Bridge): at
  // launch and after each change, the host sending only the new ones.
  useEffect(() => {
    if (!answered.profile) return
    host.unlockAchievements(earnedAchievements(session.profile, discoveries ?? undefined))
  }, [answered.profile, session.profile, discoveries])

  // A host's full-screen ad over a run — one that opened late, after the run
  // started — holds its clock: the player cannot play under it. Switching
  // away from the tab still does not, as `useElapsed` says.
  const [adOnScreen, setAdOnScreen] = useState(false)
  useEffect(() => host.onAdBreak(setAdOnScreen), [])
  const [heldSince, setHeldSince] = useState<number | null>(null)
  const heldSinceRef = useRef<number | null>(null)
  const adHolds = adOnScreen && session.phase === 'playing' && startedAt !== null
  useEffect(() => {
    if (adHolds) {
      heldSinceRef.current ??= Date.now()
      setHeldSince(heldSinceRef.current)
      return
    }
    const since = heldSinceRef.current
    if (since === null) return
    heldSinceRef.current = null
    setStartedAt((at) => (at === null ? at : at + (Date.now() - since)))
    setHeldSince(null)
  }, [adHolds])

  const elapsed = useElapsed(session.phase === 'playing' ? startedAt : null, heldSince)
  const remaining = session.run ? remainingSeconds(session.run, elapsed) : 0
  // La musique se tend sur le temps écoulé du mode joué : l'endurance n'a que
  // trente secondes, elle n'entre donc pas déjà au deuxième palier.
  const stageSeconds = session.run ? MODE_SECONDS[session.run.mode] : RUN_SECONDS
  const pulseStage = Math.min(2, Math.floor(((stageSeconds - remaining) / stageSeconds) * 3))
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
    dispatch({ type: 'offer', availableIds: availableCategoryIds(lang), seed: Date.now() >>> 0, barred, bonuses: host.levelBonuses })
  }, [session.profile, lang, barred])

  // Loading an ad takes seconds, consent included: started once the free pick
  // is spent, it is ready by the next offer. Never mid-run, where the consent
  // form would cover the clock.
  const adsWanted = on('ads') && adsDue(session.profile) && (session.phase === 'home' || session.phase === 'over')
  useEffect(() => {
    if (adsWanted) prepareInterstitial()
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

  // The host's midgame ad, asked by the button that leads to gameplay: what
  // follows waits for it to end, fail or be skipped.
  const afterMidgame = useCallback(
    (go: () => void) => void host.midgame(isPlus(session.profile) || !on('adBreaks')).then(go),
    [session.profile, on],
  )

  /** Une partie seule : d'abord le choix des pouvoirs pour qui en a, quand la fonctionnalité l'ouvre. */
  const playSolo = useCallback(() => {
    if (on('powerLoadout') && on('powers') && modeNow.current === 'solo' && ownedPowers(session.profile).length > 0) setLoadout(true)
    else afterMidgame(play)
  }, [on, session.profile, play, afterMidgame])

  const startFirstRun = useCallback(() => {
    if (session.profile.runs > 0 || loadTutorialDone() || !on('tutorial')) return playSolo()
    setMenuPage(null)
    setTutorial('teaching')
  }, [session.profile.runs, playSolo, on])
  // A host that wants play first (CrazyGames) opens a newcomer's first lesson
  // by itself, once the stored profile says they are one. Never before the
  // language is settled: the lesson's letter, theme and dictionary are its own.
  const playedFirst = useRef(false)
  useEffect(() => {
    if (!host.playFirst || playedFirst.current || !answered.profile || locale === null || session.phase !== 'home') return
    playedFirst.current = true
    // Launched to play with friends: the table comes first, the lesson can wait.
    if (roomCall) return
    if (session.profile.runs === 0 && !loadTutorialDone() && on('tutorial')) startFirstRun()
  }, [answered.profile, locale, session.phase, session.profile.runs, on, startFirstRun, roomCall])
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
  // The powers screen stays up through the load, or the home screen would
  // flash between « Play » and the countdown; it goes once the run is dealt.
  useEffect(() => {
    if (loadout && session.phase !== 'home' && session.phase !== 'loading' && session.phase !== 'over') setLoadout(false)
  }, [loadout, session.phase])
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
      storeUpdateAvailable().then((due) => {
        if (due) setUpdate((current) => (current === 'none' ? 'due' : current))
        setUpdateKnown(true)
      })
    check()
    // A store that never answers must not hold every other pop-up back.
    const timer = setTimeout(() => setUpdateKnown(true), UPDATE_WAIT_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  // Once shown, the home screen stays shown: later answers update it in place.
  // A slow server gets two seconds and a half, not the player's whole wait.
  const homeReady = answered.profile && answered.account && answered.boards && (!named || answered.challenges)
  useEffect(() => {
    if (homeReady) setHomeSettled(true)
  }, [homeReady])
  useEffect(() => {
    if (!homeSettled) return
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
    return liveTransport().watch({ kind: 'duelInvites' }, refreshDuelInvites, { every: DUEL_INVITES_MS })
  }, [atHome, duelOpen, named, on, refreshDuelInvites])
  // Done here, once the account and the screen allow it.
  const roomSignIn = useRef<string | null>(null)
  useEffect(() => {
    if (!roomCall || !hostAccountSettled || !answered.profile || !answered.account || locale === null) return
    if (session.phase !== 'home' || tutorial || modeLesson) return
    if (!on('duel')) return setRoomCall(null)
    if (!named) {
      if (!roomCall.table) {
        setRoomCall(null)
        setDuelOpen({ join: null, local: true, room: true })
        return
      }
      if (roomSignIn.current === roomCall.table || !host.promptAccount) return
      roomSignIn.current = roomCall.table
      // Signed in, the account follows and this runs again, named this time.
      void host.promptAccount().then((signedIn) => {
        // A guest who stays out still lands at a table, not at the lesson: the
        // house players' one, with no rules in front.
        if (!signedIn) {
          setRoomCall(null)
          setDuelOpen({ join: null, local: true, room: true })
        }
      })
      return
    }
    rememberMultiplayer()
    setRoomCall(null)
    setTogether(false)
    setMatching(false)
    setMenuPage(null)
    setDuelOpen(roomCall.table ? { join: roomCall.table, room: true } : { join: null })
  }, [roomCall, hostAccountSettled, answered.profile, answered.account, locale, session.phase, tutorial, modeLesson, on, named, rememberMultiplayer])

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
  // L'XP d'un duel en ligne, payée par la table : le profil de l'écran la suit.
  const duelProfile = useCallback((next: Profile) => dispatch({ type: 'profile-loaded', profile: next }), [])
  // Un joueur sans compte nommé : la connexion du portail (CrazyGames), sinon
  // la page du compte, la seule qui lui donne un nom. Sans l'un ni l'autre —
  // aucun serveur —, rien à proposer.
  const duelSignIn = useMemo(
    () =>
      account === null
        ? host.promptAccount
          ? () => void host.promptAccount!()
          : undefined
        : () => {
            setTogether(false)
            setDuelOpen(null)
            setAccountMode('register')
            setMenuFocus(false)
            setMenuPage('profile')
          },
    [account],
  )

  const launchChallenge = useCallback(
    async (detail: ChallengeDetail, powers: readonly PowerId[]) => {
      await host.midgame(isPlus(session.profile) || !featuresNow.current.has('adBreaks'))
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
    [judgeFor, rememberMultiplayer, session.profile, t],
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
      return dealLineup(seed, sharedCategoryIds(ownedCategoryIds(session.profile).filter((id) => shipped.has(id)))).dealt
    },
    [session.profile],
  )

  /** The owner's categories a challenge in this language can play. */
  const challengeCategories = useMemo(() => {
    const shipped = new Set(availableCategoryIds(lang))
    return sharedCategoryIds(ownedCategoryIds(session.profile).filter((id) => shipped.has(id)))
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

  const create = useCallback(
    async (friends: readonly string[], rules: ChallengeRules) => {
      setCreating({ busy: true, message: null, rules, friends })
      const seed = Date.now() >>> 0
      const id = await createChallenge(lang, seed, rules.categoryIds, friends, rules.powers, rules.name)
      const detail = id ? await fetchChallenge(id) : null
      if (!detail) return setCreating({ busy: false, message: t.challenge.createFailed, rules, friends })
      setCreating(null)
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
    dispatch({ type: 'choose', categoryId })
  }, [])
  const choosePower = useCallback((powerId: string) => {
    dispatch({ type: 'choose-power', powerId })
  }, [])
  const joinPlus = useCallback(() => {
    dispatch({ type: 'join-plus', at: Date.now() })
  }, [])
  const storeOpen = premiumStoreOpen && on('premium')
  const openPremium = useCallback(
    (reason: PremiumReason) => {
      if (!storeOpen) return
      setPremiumFor(reason)
      void premiumPrice().then((price) => price && setPremiumCost(price))
    },
    [storeOpen],
  )
  const premiumDoor = useMemo<PremiumDoor>(
    () => ({ storeOpen, adsOpen: rewardedAdsOpen, open: openPremium }),
    [storeOpen, openPremium],
  )
  const buy = useCallback(async () => {
    const result = await buyPremium()
    if (result === 'ok') joinPlus()
    return result
  }, [joinPlus])
  const restore = useCallback(async () => {
    const found = await restorePremium()
    if (found) joinPlus()
    return found
  }, [joinPlus])
  // A Premium bought on another device, or before a reinstall, comes back with
  // the Google account or the merchant's order; on the web's own return the
  // server is given a few seconds to hear from the webhook.
  useEffect(() => {
    if (!premiumStoreOpen || isPlus(profile.current)) return
    void premiumOwned().then((owned) => {
      if (owned && !isPlus(profile.current)) joinPlus()
    })
  }, [joinPlus, profile])
  // Un Premium offert par un super modérateur (0091) suit le serveur à chaque
  // compte qui se pose sur l'appareil : il s'ouvre, ou se reprend — jamais sans
  // réponse du serveur, et jamais en touchant à un achat.
  useEffect(() => {
    if (!signedIn) return
    void fetchPremiumOrigin().then((origin) => {
      if (origin === undefined) return
      const next = adoptOfferedPlus(profile.current, origin, Date.now())
      if (next === profile.current) return
      dispatch({ type: 'profile-loaded', profile: next })
    })
  }, [signedIn, account?.name, profile])
  // Le défi du moment : ses écrans, sa partie et son récap vivent dans un seul crochet.
  const weeklyFlow = useWeeklyFlow({
    enabled: on('weekly') && weeklyUnlocked(session.profile.xp),
    lang,
    t,
    session,
    dispatch,
    judgeFor,
    profile,
    joinPlus,
    openPremium,
    premiumOpen: storeOpen,
    preloadRun: preloadRunScreens,
    home: session.phase === 'home' && !tutorial && !modeLesson,
    online: cloudConfigured() || signedIn,
  })
  const peek = useCallback(() => {
    dispatch({ type: 'peek', day: todayKey() })
  }, [])
  const revealAd = useCallback(() => {
    dispatch({ type: 'reveal-ad', day: todayKey() })
  }, [])
  const chooseBonus = useCallback((bonusId: string) => {
    dispatch({ type: 'choose-bonus', bonusId })
  }, [])
  const banActions = useMemo<BanActions>(
    () => ({
      onBan: (categoryId) => {
        dispatch({ type: 'ban', categoryId })
      },
      onUnban: (categoryId) => {
        dispatch({ type: 'unban', categoryId })
      },
      onIntroSeen: () => dispatch({ type: 'ban-intro-seen' }),
    }),
    [],
  )
  // A past run is read with today's dictionaries: its own are gone with it.
  const statsRecap = useMemo<RecapActions>(
    () => ({
      hiddenFor: async (run) =>
        hiddenAnswersOf(run.prompts ?? [], run.words.map((word) => word.word), await judgeFor(run.categoryIds, run.lang)),
      budget: revealBudget(session.profile, todayKey(), host.unlimitedReveals),
      onPeek: peek,
      onAd: revealAd,
      // Only a moderator flags a word: without the role, the recap says nothing of it.
      ...(moderation?.moderator && on('wordFlag') && {
        onFlag: (run, word, reason) => proposeBan(run.lang, word.categoryId, word.word, word.display, reason),
      }),
    }),
    [judgeFor, session.profile, peek, revealAd, moderation, on],
  )
  // Un autre joueur se lit tout entier : ses mots cachés ne coûtent aucune
  // révélation à qui l'espionne.
  const spyRecap = useMemo<RecapActions>(
    () => ({ ...statsRecap, budget: { ...statsRecap.budget, unlimited: true }, onPeek: () => {}, onAd: () => {} }),
    [statsRecap],
  )
  const playerActions = useMemo<PlayerActions>(
    () => ({
      ...DEFAULT_PLAYER_ACTIONS,
      ...(on('challenges') && { challenge: (friendId: string) => openCreate([friendId]) }),
      ...(on('spyHistory') && { spy: { load: fetchSpiedRuns, recap: spyRecap, profile: fetchSpiedProfile, grantPremium, setModerator } }),
      // Un invité du portail (CrazyGames) n'a pas de session : demander un ami
      // n'aurait que la réponse d'un serveur qui n'a rien reçu. Le geste ouvre la
      // connexion du portail, la seule qui donnerait un nom au compte.
      ...(account === null &&
      host.promptAccount && {
        befriend: () => {
          void host.promptAccount!()
          return Promise.resolve('anonymous' as const)
        },
      }),
    }),
    [on, openCreate, account, spyRecap],
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
    // Un mode de la réserve ne laisse rien derrière lui : ni historique, ni
    // serveur, ni succès. Ses mots proposés partent quand même.
    if (!countsForProgress(session.run.mode) || session.weekly) {
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
    // qu'une fois la partie arrivée. Le joueur ordinateur compte : passer premier
    // sans l'avoir battu ne serait pas être premier.
    pushed
      .then(() => fetchLeaderboard('best', 'day'))
      .then((board) => {
        if (!board || !featuresNow.current.has('achievements')) return
        if (completeLeaderboard('best', 'day', board).me?.place !== 1) return
        dispatch({ type: 'profile-loaded', profile: markDailyFirst(profile.current) })
      })
    // The climb at the end of the run is drawn from the boards the run started
    // on, with its score placed where it ranks: it shows at once, and the
    // same, whether the server answers in time or not. What the server says
    // afterwards only refreshes the home.
    const runner = account && !account.anonymous ? { name: account.name, avatar } : null
    const projected = runner && boardsBefore ? projectBoards(boardsBefore, runner, session.run.score) : null
    if (projected) setBoardsAfter(projected)
    pushed
      .then(() => loadBoards(true))
      .then((next) => {
        if (next) setBoards(next)
        if (!projected) setBoardsAfter(next)
      })
    // The run is pushed once, when the clock stops: the profile that follows it
    // in the same render is the one the score was just added to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase])

  // La page des succès demande ses découvertes la première fois qu'on l'ouvre :
  // une barre à zéro mentirait jusqu'à la partie suivante.
  useEffect(() => {
    if (menuPage !== 'avatar' || discoveries !== null) return
    void fetchMyDiscoveries().then((count) => count !== null && setDiscoveries(count))
  }, [menuPage, discoveries])

  closeChallengeLayer.current = () => {
    // Une table de duel se quitte par son bouton : un geste de retour en pleine
    // partie abandonnerait sa réserve sans le dire.
    if (duelOpen) return true
    if (matching) {
      setMatching(false)
      setTogether(true)
    } else if (together) setTogether(false)
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

  const quietHome =
    session.phase === 'home' && !tutorial && !modeLesson && !menuOpen && !moderating && !challengeOpen && !creating && !picking && !together && !matching && !modesOpen && !loadout && !duelOpen && !weeklyFlow.covering
  // The moderator card may also open over the summary, once the recap has been
  // revealed: moderators are scarce, and a run's end is when a player is most inclined.
  const quietOver = session.phase === 'over' && overSummary && !session.weekly && !menuOpen && !moderating && !loadout
  const notice = quietHome && on('challenges') ? challengeNotice(challenges, heldNotices) : null
  const updateDue = update === 'due' && on('storeUpdate')
  // The moderator card never reaches someone who already moderates: `moderator`
  // alone let the super role through, and its bonus stayed in the profile.
  const alreadyModerating = moderation?.moderator === true || moderation?.super === true
  const bonusOfferDue = session.profile.bonuses.includes('moderator') && moderation !== null && !alreadyModerating && !bonusHeld && !moderation.offer && on('moderatorOffer')
  // The super role is offered to a moderator (0116): the one card that does reach someone who moderates.
  const superOfferDue = moderation?.offer === 'super' && moderation.moderator && !moderation.super && !offerHeld && on('moderatorOffer')
  const offerDue = superOfferDue || (!alreadyModerating && moderation?.offer !== 'super' && (bonusOfferDue || (!!moderation?.offer && !offerHeld && on('moderatorOffer'))))
  const wordsNewsDue = wordsNews.length > 0 && on('wordsNews')
  const giftDue = complicationDue(session.profile, acceptedWords) && on('powerGift')
  // Premium thanks its new member once, back home, and asks for an opinion in
  // exchange: that ask stands in for the regular one if both are due.
  const thanksDue = cloudConfigured() && plusThanksDue(session.profile)
  const settleShareNews = () => {
    saveShareNewsSeen()
    setShareNewsSeen(true)
  }
  // Les avant-premières qu'un envoi vient de livrer, annoncées au retour à
  // l'accueil : une catégorie nouvelle les fait toutes repasser, une fois.
  const freshPremieres = useMemo(() => premiereNews(premiereNewsSeen, availableCategoryIds(lang)), [premiereNewsSeen, lang])
  const pop = usePopQueue(
    {
      update: quietHome && updateDue,
      // One notice per challenge: the next one closes and opens like any other pop-up.
      challenge: notice?.challenge.id ?? false,
      weeklyRecap: quietHome && weeklyFlow.recap !== null,
      weeklyPrize: quietHome && weeklyFlow.prizePop !== null,
      name: atHome && nameAsk !== null,
      // Over the menu too: the friendship is often made there, and the offer follows it at once.
      push: atHome && pushOffer !== null && on('pushOffer'),
      moderator: (quietHome || quietOver) && offerDue && (!!moderation?.offer || bonusOfferDue),
      wordsNews: quietHome && wordsNewsDue,
      gift: quietHome && giftDue,
      thanks: quietHome && thanksDue,
      feedback: quietHome && feedbackAsk && !thanksDue && on('feedback'),
      shareNews: quietHome && on('friendInvite') && shareNewsDue(session.profile, named, shareNewsSeen),
      premieres: quietHome && on('premium') && freshPremieres.length > 0,
      rating: quietHome && ratingAsk && on('support'),
    },
    updateKnown,
  )
  const settlePremieres = () => {
    const seen = [...new Set([...premiereNewsSeen, ...freshPremieres])]
    savePremiereNewsSeen(seen)
    setPremiereNewsSeen(seen)
  }

  if (debugPhase !== null && locale !== null) {
    return (
      <MessagesContext value={t}>
        <main className={`stage stage--${debugPhase}${muteable ? ' stage--muteable' : ''}`}>
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
    <PremiumContext value={premiumDoor}>
    <main className={`stage stage--${tutorial ? 'playing' : session.phase}${modeLesson ? ' stage--lesson' : ''}${muteable ? ' stage--muteable' : ''}`}>
      {tutorial && (session.phase === 'home' || session.phase === 'loading') && <TutorialScreen lang={lang} onDone={endTutorial} />}
      {modeLesson && (session.phase === 'home' || session.phase === 'loading') && (
<ModeTutorial mode={modeLesson.mode} lang={lang} onDone={endModeTutorial} />
)}

      {moderating === 'profiles' && (
        <Suspense fallback={null}>
          <ProfileReviewScreen
            onDone={() => {
              setModerating(false)
              refreshModeration()
              setMenuPage('requests')
            }}
          />
        </Suspense>
      )}

      {moderating === 'words' && (
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

      {challengeOpen && !moderating && session.phase === 'home' && (
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
          <DuelScreen
            key={duelOpen.join ?? (duelOpen.local ? 'local' : 'new')}
            lang={lang}
            mode={duelOpen.local ? 'local' : 'online'}
            join={duelOpen.join}
            quick={duelOpen.quick}
            room={duelOpen.room}
            onExit={leaveDuel}
            onProfile={duelProfile}
            onSignIn={duelOpen.local ? duelSignIn : undefined}
          />
        </Suspense>
      )}

      {together && session.phase === 'home' && !duelOpen && (
        <PlayTogether
          challenge={on('challenges')}
          onClose={() => setTogether(false)}
          onDuel={() => {
            rememberMultiplayer()
            setTogether(false)
            // Sans compte nommé, la table en ligne ne s'ouvrirait pas : la table
            // des joueurs ordinateur, et l'invitation à se connecter.
            setDuelOpen({ join: null, local: !named })
          }}
          local={!named}
          onSignIn={named ? undefined : duelSignIn}
          onMatch={
            // La file du matchmaking assoit deux comptes nommés (`duel_matchmake`) :
            // un anonyme sans nom, ou un invité du portail, ne s'y met pas.
            named
              ? () => {
                  rememberMultiplayer()
                  setTogether(false)
                  setMatching(true)
                }
              : undefined
          }
          onChallenge={() => {
            setTogether(false)
            openCreate()
          }}
        />
      )}

      {loadout && (session.phase === 'home' || session.phase === 'loading' || session.phase === 'over') && !tutorial && (
        <PowerLoadout
          profile={session.profile}
          onWear={(powerId) => dispatch({ type: 'wear', powerId })}
          onPlay={() => {
            if (session.phase !== 'loading') afterMidgame(() => void play())
          }}
          onBack={() => setLoadout(false)}
        />
      )}

      {matching && session.phase === 'home' && !duelOpen && (
        <Suspense fallback={null}>
          <DuelMatchmaking
            lang={lang}
            onMatched={(table) => {
              setMatching(false)
              setDuelOpen({ join: table, quick: true })
            }}
            onCancel={() => {
              setMatching(false)
              setTogether(true)
            }}
            onBots={() => {
              setMatching(false)
              setDuelOpen({ join: null })
            }}
          />
        </Suspense>
      )}

      {modesOpen && session.phase === 'home' && !tutorial && (
        <GameModes onPick={pickMode} onClose={() => setModesOpen(false)} />
      )}

      {duelBanner && (
        <DuelBanner text={duelBanner === 'kicked' ? t.duel.kickedBanner : t.duel.closedBanner} onDone={clearDuelBanner} />
      )}

      {weeklyFlow.overlay}

      {!tutorial && !modeLesson && !loadout && !moderating && !duelOpen && !(matching && session.phase === 'home') && !weeklyFlow.covering && !(challengeOpen && session.phase === 'home') && (session.phase === 'home' || session.phase === 'loading') && (
        <HomeScreen
          profile={session.profile}
          error={session.error}
          loading={session.phase === 'loading'}
          settled={homeSettled}
          boards={on('leaderboards') ? homeBoards : null}
          me={account && !account.anonymous ? account.name : null}
          climbed={climbed}
          avatar={avatar}
          requestsMade={queued > 0 || mine.length > 0}
          requestsNews={moderation?.news ?? 0}
          queueAlert={queueAlert}
          categoriesNews={banNews(session.profile) ? 1 : 0}
          avatarNews={avatarNews}
          friendRequests={named && on('friends') ? friendRequests : 0}
          challenges={named && (on('challenges') || on('duel')) ? (on('challenges') ? challenges : []) : null}
          multiplayerNews={multiplayerNews}
          weekly={weeklyFlow.card}
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
            setAvatarFocus(null)
            setAccountMode('register')
            setMenuFocus(false)
            setMenuPage(page)
          }}
          onPlay={() => (on('gameModes') ? setModesOpen(true) : startFirstRun())}
          onDebug={on('debugBoard') ? () => setDebugPhase('home') : undefined}
          onEquip={(slot, powerId) => {
            dispatch({ type: 'equip', slot, powerId })
          }}
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
            slots={slotsOf(session.profile)}
            onStart={(powers) => launchChallenge(picking, powers)}
            onClose={() => setPicking(null)}
          />
        </Suspense>
      )}

      {pop === 'name' && nameAsk !== null && (
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

      {pop === 'push' && pushOffer !== null && (
        <PushOffer
          onNo={() => {
            markPushOffered(pushOffer)
            setPushOffer(null)
          }}
          onYes={() => {
            markPushOffered(pushOffer)
            setPushOffer(null)
            askPush()
          }}
        />
      )}

      {pop === 'challenge' && notice && (
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

      {pop === 'weeklyRecap' && weeklyFlow.recap}
      {pop === 'weeklyPrize' && weeklyFlow.prizePop}

      {pop === 'update' && (
        <UpdateNotice
          onLater={() => setUpdate('later')}
          onUpdate={() => {
            setUpdate('later')
            openStoreUpdate()
          }}
        />
      )}

      {pop === 'moderator' && (
          <ModeratorOffer
            reason={moderation?.offer ?? 'bonus'}
            invitedBy={moderation?.offer ? moderation.invitedBy : null}
            anonymous={account?.anonymous !== false}
            onAccount={() => {
              setOfferHeld(true)
              setBonusHeld(true)
              setMenuPage('profile')
            }}
            onAnswered={() => {
              setBonusHeld(true)
              refreshModeration()
            }}
            onLater={() => {
              setOfferHeld(true)
              setBonusHeld(true)
            }}
            onModerate={on('moderation') ? () => setModerating('words') : undefined}
          />
        )}

      {pop === 'wordsNews' && (
        <WordsNewsPop
          words={wordsNews}
          reveal={!isPlus(session.profile) && !host.unlimitedReveals}
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

      {pop === 'gift' && (
          <PowerGiftPop powerId="complication" onClose={() => dispatch({ type: 'grant-power', powerId: 'complication' })} />
        )}

      {pop === 'shareNews' && (
        <ShareNewsPop
          onLater={settleShareNews}
          onOpen={() => {
            settleShareNews()
            setInviteOpen(true)
            setMenuPage('social')
          }}
        />
      )}

      {/* Premium les joue déjà : la pop-up mène aux catégories, et les autres à sa fiche. */}
      {pop === 'premieres' && (
        <PlusNewsPop
          names={freshPremieres.map((id) => categoryText(t, id).label).join(', ')}
          onOpen={() => {
            settlePremieres()
            if (isPlus(session.profile)) setMenuPage('categories')
            else openPremium('premiere')
          }}
          onClose={settlePremieres}
        />
      )}

      {premiumFor && (
        <PremiumSheet
          reason={premiumFor}
          price={premiumCost}
          onBuy={buy}
          onRestore={restore}
          onClose={() => setPremiumFor(null)}
        />
      )}

      {pop === 'feedback' && <FeedbackPop onClose={() => setFeedbackAsk(false)} />}

      {pop === 'rating' && (
        <RatingPop onLater={() => setRatingAsk(false)} onRate={() => { dispatch({ type: 'rating-done' }); setRatingAsk(false) }} />
      )}

      {pop === 'thanks' && (
        <PlusThanksPop
          onClose={() => {
            setFeedbackAsk(false)
            dispatch({ type: 'plus-thanked' })
          }}
        />
      )}

      {menuLayer.shown !== null && !moderating && (session.phase === 'home' || session.phase === 'loading' || session.phase === 'over') && (
        <Suspense fallback={null}>
          <Menu
            page={menuLayer.shown}
            leaving={menuLayer.leaving}
            back={session.phase === 'over' ? 'close' : 'profile'}
            profile={session.profile}
            attempts={weeklyFlow.attempts}
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
            onAvatarSave={saveWornAvatar}
            avatarNews={avatarNews}
            onAvatarSeen={refreshSeenDesigns}
avatarFocus={avatarFocus}
            discoveries={discoveries ?? undefined}
            account={account}
            accountActions={accountActions}
            accountMode={accountMode}
            theme={theme}
            locale={locale}
            onLocale={speak}
            sound={soundPrefs}
            onSound={tune}
            onTheme={(next) => {
              setTheme(next)
              saveTheme(next)
              applyTheme(next)
            }}
            onLogOut={async () => {
              if (pushToken.current) await forgetPushToken(pushToken.current)
              await logOut()
              forget()
            }}
            moderation={moderation}
            queueAlert={queueAlert}
            onModerate={() => {
              if (!on('moderation')) return
              setMenuPage(null)
              setModerating('words')
            }}
            onProfiles={() => {
              if (!on('moderation')) return
              setMenuPage(null)
              setModerating('profiles')
            }}
            onRequestsSeen={refreshModeration}
            onRequestsOpen={topUpRequests}
            lang={lang}
            onWordsBoard={on('wordsBoard') ? setWordsBoard : undefined}
            onFeatures={moderation?.super ? () => setFeaturesBoard(true) : undefined}
            banActions={banActions}
            onErase={async () => {
              // The device keeps its copy until the server has let go of its
              // own: a failed erase must not leave the player half-deleted.
              if (!(await deleteAccount())) return false
              forget()
              return true
            }}
            onClose={closeMenu}
          />
        </Suspense>
      )}

      {wordsBoard && on('wordsBoard') && (
        <Suspense fallback={null}>
          <WordsBoard lang={lang} superModerator={roles.superModerator} onClose={() => setWordsBoard(false)} />
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
            onFreeLetter={() => dispatch({ type: 'free-letter' })}
            onRecall={() => dispatch({ type: 'recall' })}
            proposed={session.proposals.map((proposal) => normalizeWord(proposal.word))}
            mine={mineWords}
            onPropose={propose}
            rivals={rivals}
            avatar={avatar}
          />
        </Suspense>
      )}

      {weeklyFlow.over}

      {session.phase === 'over' && session.run && !session.weekly && !moderating && !loadout && (
        <Suspense fallback={null}>
          <OverScreen
            run={session.run}
            profile={session.profile}
            profileBefore={session.profileBefore}
            revealed={revealed === session.run.seed}
            onRevealed={() => setRevealed(session.run?.seed ?? null)}
            onSummary={setOverSummary}
            lang={lang}
            avatar={avatar}
            account={account}
            accountActions={accountActions}
            // La page « Avatar & succès » vit dans le tiroir : elle s'ouvre
            // par-dessus le bilan, et son retour le rend tel quel.
            onAvatar={(design) => {
setAvatarFocus(design ?? null)
setMenuPage('avatar')
}}
            onChoose={choose}
            onChoosePower={choosePower}
            onChooseBonus={chooseBonus}
            barredBonuses={barred}
            boardsBefore={boardsBefore}
            boardsAfter={boardsAfter}
            me={account && !account.anonymous ? account.name : null}
            mine={mineWords}
            proposals={runProposals}
            onCorrectProposal={correctProposal}
            onWithdrawProposal={withdrawProposal}
            hidden={hidden}
            onPeek={peek}
            onAd={revealAd}
            onAdSpared={() => dispatch({ type: 'plus-ad-skipped' })}
            onFlag={overFlag}
            onReplay={session.challengeId ? () => afterMidgame(play) : playSolo}
            onHome={() => {
              // Asked on the way home, never over the summary: after the tenth run, then every thirty.
              if (cloudConfigured() && feedbackDue(session.profile) && on('feedback')) {
                dispatch({ type: 'feedback-asked' })
                setFeedbackAsk(true)
              } else if (on('support') && ratingDue(session.profile) && !plusThanksDue(session.profile)) {
                dispatch({ type: 'rating-asked' })
                setRatingAsk(true)
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

      {muteable && <MuteButton muted={soundPrefs.muted} onToggle={() => tune({ ...soundPrefs, muted: !soundPrefs.muted })} />}
    </main>
    </PremiumContext>
    </PlayerActionsContext>
    </FeaturesContext>
    </MessagesContext>
  )
}
