import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_AVATAR, type AvatarChoice } from '../domain/avatar'
import type { ChallengeWord } from '../domain/challenge'
import { choosePower } from '../domain/powers'
import { NEW_PROFILE, xpForLevel, type Profile } from '../domain/progression'
import type { PlayedWord, RunRecord } from '../domain/history'
import type { RarityTier } from '../domain/rarity'
import type { KeptWord, Run } from '../domain/run'
import { chooseCategory } from '../domain/unlocks'
import type { Account, ChallengeDetail, ChallengePlayer, ChallengeSummary, ReviewCard, Submission, SubmissionStatus } from '../lib/cloud'
import type { AccountActions } from '../ui/AccountPanel'
import { ChallengeNotice } from '../ui/ChallengeHome'
import { ChallengePowers } from '../ui/ChallengePowers'
import { ChallengeView } from '../ui/ChallengeScreen'
import { PowerGiftPop, ShareNewsPop, WordsNewsPop } from '../ui/WordsNews'
import { HomeScreen, POSTER } from '../ui/HomeScreen'
import { LanguagePicker } from '../ui/LanguagePicker'
import { ModeratorOffer } from '../ui/ModeratorOffer'
import { ModerationScreen } from '../ui/ModerationScreen'
import { OverScreen, type RunProposal } from '../ui/OverScreen'
import { PlayerActionsContext, type PlayerActions } from '../ui/PlayerSheet'
import { TutorialScreen } from '../ui/TutorialScreen'
import { UpdateNotice } from '../ui/UpdateNotice'
import { PushOffer } from '../ui/PushOffer'
import { FlagWordCard, OldChallengeList, StatsPage } from '../ui/StatsPage'
import { ChallengeSetup, type ChallengeRules } from '../ui/ChallengeSetup'
import { FriendPicker } from '../ui/FriendPicker'
import { FriendPage } from '../ui/FriendPage'
import { FriendsView } from '../ui/FriendsView'
import { Menu } from '../ui/Menu'
import type { SharedChallenge, SharedPlayer } from '../domain/rivalry'
import type { Boards } from '../domain/boards'
import { Avatar } from '../ui/Avatar'
import { Shape } from '../ui/bauhaus'
import { NamePrompt } from '../ui/NamePrompt'
import { DashboardView } from './Dashboard'
import { WordsBoardView } from './WordsBoard'
import type { WordsReport } from './words'
import { ACHIEVEMENTS, achievementIcon } from '../domain/achievements'
import type { SlotEntry, Snapshot } from './snapshot'
import { completeLeaderboard, type Leaderboard, type PeriodId, type StatId } from '../domain/leaderboards'
import { LeaderboardsPage } from '../ui/LeaderboardsPage'
import { NEW_SCENARIOS, NEW_SINCE, RECENT_SCENARIOS } from './recent'
import { ban, joinPlus, markBanIntroSeen, spendPeek, unban, type HiddenAnswer } from '../domain/perks'
import { ownedCategoryIds } from '../domain/unlocks'
import { CATALOGUE } from '../domain/catalogue'
import { CategoriesPage } from '../ui/CategoriesPage'
import { FeedbackPop } from '../ui/FeedbackPop'
import { PlusPop } from '../ui/PlusPop'
import { Checkout } from '../ui/Checkout'
import { useT } from '../i18n'
import { IdeasAdminView } from './IdeasAdmin'
import type { AdminIdea } from '../lib/cloud'

/*
 * The debug board: every screen a player only meets by luck or by level,
 * played with invented data. A developer tool, so its own labels are French
 * and stay out of the i18n; the screens it shows speak the interface's
 * language. Nothing here reaches the server: the calls that would write
 * (moderator answer, account) are replaced by stand-ins.
 *
 * A screen hard to reach in the game gets its scenario here as soon as it exists.
 */

const noop = () => {}
const later = <T,>(value: T, ms = 400) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

/** A tap on a name asks nothing of the server here. */
const PLAYER_ACTIONS: PlayerActions = {
  befriend: () => later('sent'),
  block: () => later('blocked'),
  // Léa and Tom are friends here, Joueur 3 waits for an answer: their sheet tells the three apart.
  relation: (name) =>
    later(
      name === 'Léa' || name === 'Tom'
        ? { id: name.toLowerCase(), relation: 'friend' as const }
        : name === 'Joueur 3'
          ? { id: 'joueur-3', relation: 'outgoing' as const }
          : null,
      200,
    ),
  challenge: () => undefined,
}


const quietAccount: AccountActions = {
  onRegister: () => later(null),
  onLogIn: () => later(null),
  onGoogle: () => later(null),
  onRequestReset: () => later(null),
  onResetPassword: () => later(null),
  onChooseName: () => later(null),
}

const NAMED: Account = {
  name: 'Testeur',
  email: 'testeur@example.com',
  anonymous: false,
  needsName: false,
  stats: { xp: 0, runs: 0, bestScore: 0, wordsFound: 0, bestCombo: 0 },
  avatar: DEFAULT_AVATAR,
}
const ANONYMOUS: Account = { ...NAMED, name: 'Anonyme', email: null, anonymous: true }
/** A Google account whose name is still « Anonyme »: nothing social is open to it. */
const UNNAMED: Account = { ...NAMED, name: 'Anonyme', needsName: true }

const avatarOf = (design: number, ground: string, shape: string, accent: string): AvatarChoice => ({ design, ground, shape, accent })

const LONG_BOARD = Array.from({ length: 24 }, (_, index) => ({
  name: index === 14 ? 'Testeur' : `Joueur ${index + 1}`,
  avatar: avatarOf((index * 7) % 100, 'bleu', 'jaune', 'rouge'),
  value: 400 - index * 12,
}))
const LONG_BOARDS: Boards = { day: LONG_BOARD, week: LONG_BOARD, discoveries: LONG_BOARD.slice(0, 6) }

/** De quoi faire déborder l'annonce des mots ajoutés : la pop doit défiler. */
const LONG_NEWS: Submission[] = (
  [
    ['animaux', ['axolotl', 'quiscale', 'ornithorynque', 'pangolin', 'narval', 'tatou', 'okapi', 'kinkajou']],
    ['pays', ['tuvalu', 'bhoutan', 'kiribati', 'vanuatu', 'suriname', 'moldavie']],
    ['couleurs', ['vermillon', 'indigo', 'pourpre', 'ocre', 'turquoise']],
    ['metiers', ['ébéniste', 'vitrailliste', 'luthier', 'relieur', 'orfèvre']],
    ['sports', ['curling', 'skeleton', 'pelote', 'escrime', 'judo', 'hockey']],
  ] as const
).flatMap(([categoryId, displays]) =>
  displays.map((display, index) => ({
    id: `${categoryId}-${index}`,
    lang: 'fr',
    categoryId,
    display,
    status: 'accepted' as const,
    at: 0,
    locked: true,
    fresh: true,
  })),
)

// ------------------------------------------------------------ fixtures --

type Word = [categoryId: string, letter: string, display: string, points: number, tier: RarityTier, approximate?: boolean]

const WORDS: readonly Word[] = [
  ['pays', 'B', 'Bhoutan', 64, 'rare'],
  ['animaux', 'O', 'Ornithorynque', 92, 'très rare'],
  ['couleurs', 'V', 'Vermillon', 38, 'peu commun'],
  ['pays', 'C', 'Canada', 12, 'courant'],
  ['animaux', 'C', 'Chat', 10, 'courant'],
  ['couleurs', 'B', 'Bleu', 10, 'courant'],
  ['pays', 'T', 'Thaïlande', 12, 'rare', true],
  ['animaux', 'L', 'Lama', 14, 'courant'],
]

function makeRun(score: number, words: readonly Word[] = WORDS): Run {
  const found: KeptWord[] = words.map(([categoryId, letter, display, points, tier, approximate = false], index) => ({
    prompt: { categoryId, letter },
    word: display.toLowerCase(),
    display: display.toLowerCase(),
    points,
    rarity: 0,
    tier,
    approximate,
    edits: approximate ? 1 : 0,
    joker: false,
    boost: 1,
    seconds: 3 + (index % 4),
    at: 5 + index * 6,
  }))
  return {
    seed: 42,
    categoryIds: ['pays', 'animaux', 'couleurs'],
    prompt: { categoryId: 'pays', letter: 'A' },
    drawn: words.length + 1,
    avoid: [],
    dealt: [],
    settled: [],
    shared: false,
    seeded: [],
    found,
    used: [],
    promptAt: 0,
    skips: 2,
    penaltySeconds: 10,
    combo: 0,
    bestCombo: 4,
    score,
    powers: [],
    charges: { latecomer: 5 },
    joker: null,
    hush: null,
    heldSeconds: 0,
    rerolls: 0,
    chatter: 0,
latecomerSeconds: 0,
flawlessStreak: 0,
freeSkipReady: false,
  }
}

const RUN = makeRun(WORDS.reduce((sum, word) => sum + word[3], 0))

const at = (level: number, extra = 0) => xpForLevel(level) + extra

const PROFILE: Profile = {
  ...NEW_PROFILE,
  xp: at(3, 150),
  runs: 14,
  bestScore: 290,
  wordsFound: 120,
  bestCombo: 5,
  unlocked: ['fruits-legumes', 'metiers'],
  supportAskedAt: 14,
}

/**
 * Plus de parties que la liste n'en déplie : la page en montre vingt, le reste
 * au bouton, et le profil en compte davantage encore — le compte du serveur.
 */
const STATS_PROFILE: Profile = { ...PROFILE, runs: 132, bestScore: 312 }

const STATS_WORDS: [categoryId: string, word: string, display: string, points: number][] = [
  ['animaux', 'chat', 'chat', 10],
  ['pays', 'chili', 'Chili', 20],
  ['animaux', 'lion', 'lion', 12],
  ['fruits-legumes', 'pomme', 'pomme', 8],
  ['pays', 'perou', 'Pérou', 18],
  ['animaux', 'zebre', 'zèbre', 30],
]

function statsRun(index: number, at: number): RunRecord {
  const words = STATS_WORDS.filter((_, word) => (index + word) % 3 !== 0)
  return {
    at,
    lang: 'fr',
    score: 190 + ((index * 37) % 130),
    bestCombo: 2 + (index % 4),
    skips: index % 3,
    categoryIds: ['animaux', 'pays', 'fruits-legumes'],
    words: words.map(([categoryId, word, display, points], order) => ({ categoryId, word, display, points, seconds: 3 + ((index + order) % 4) })),
    prompts: [
      ...words.map(([categoryId, , display]) => ({ prompt: { categoryId, letter: display.charAt(0).toUpperCase() }, passed: false })),
      { prompt: { categoryId: 'pays', letter: 'W' }, passed: true },
      ...(index % 2 ? [{ prompt: { categoryId: 'animaux', letter: 'X' }, passed: true }] : []),
    ],
  }
}

const STATS_HISTORY: RunRecord[] = Array.from({ length: 25 }, (_, index) => statsRun(index, Date.now() - index * 40 * 60 * 1000))

/** Le compte en garde soixante-dix de plus, plus anciennes que l'appareil. */
function olderStatsRuns(before: number, limit: number): Promise<RunRecord[] | null> {
  const oldest = Date.now() - 95 * 40 * 60 * 1000
  const runs = Array.from({ length: limit }, (_, index) => before - (index + 1) * 3 * 60 * 60 * 1000)
    .filter((at) => at > oldest)
    .map((at, index) => statsRun(index + 25, at))
  return later(runs, 600)
}

const STATS_RECAP = {
  hiddenFor: () =>
    later(
      [
        { prompt: { categoryId: 'pays', letter: 'W' }, display: 'Wallis-et-Futuna' },
        { prompt: { categoryId: 'animaux', letter: 'X' }, display: 'xérus' },
      ],
      500,
    ),
  peeks: 5,
  onPeek: noop,
  onJoinPlus: noop,
  // Un signalement de mot ne s'écrit pas depuis la planche : la carte répond seule.
  onFlag: () => later('sent' as const),
}

/** The profile before and after the run: the gap is what the end screen celebrates. */
function afterRun(before: Profile, run: Run, changes: Partial<Profile> = {}): Profile {
  return {
    ...before,
    xp: before.xp + run.score,
    runs: before.runs + 1,
    bestScore: Math.max(before.bestScore, run.score),
    wordsFound: before.wordsFound + run.found.length,
    ...changes,
  }
}

const challengeWords = (words: readonly Word[], at0 = 4): ChallengeWord[] =>
  words.map(([categoryId, letter, display, points, tier, approximate = false], index) => ({
    categoryId,
    letter,
    key: display.toLowerCase(),
    display: display.toLowerCase(),
    points,
    tier,
    approximate,
    seconds: 2 + ((index * 3) % 7),
    at: at0 + index * 7,
  }))

const HOUR = 3_600_000

function player(
  playerId: string,
  name: string,
  avatar: AvatarChoice,
  words: readonly Word[] | null,
  extra: Partial<ChallengePlayer> = {},
): ChallengePlayer {
  const list = words ? challengeWords(words) : []
  return {
    playerId,
    name,
    avatar,
    me: false,
    bot: false,
    playedAt: words ? Date.now() - HOUR : null,
    score: list.reduce((sum, word) => sum + word.points, 0),
    skips: 1,
    bestCombo: 3,
    words: list,
    ...extra,
  }
}

const LEA: Word[] = [
  ['pays', 'B', 'Bhoutan', 64, 'rare'],
  ['animaux', 'C', 'Chat', 10, 'courant'],
  ['couleurs', 'B', 'Bordeaux', 22, 'peu commun'],
  ['animaux', 'L', 'Lynx', 30, 'peu commun'],
]
const TOM: Word[] = [
  ['pays', 'C', 'Canada', 12, 'courant'],
  ['animaux', 'C', 'Chat', 10, 'courant'],
  ['couleurs', 'V', 'Vert', 8, 'courant'],
]

function challenge(state: 'to-play' | 'waiting' | 'finished'): ChallengeDetail {
  const me = player('me', 'Testeur', DEFAULT_AVATAR, state === 'to-play' ? null : WORDS.slice(0, 6), { me: true, skips: 3, bestCombo: 4 })
  const players = [
    me,
    player('lea', 'Léa', avatarOf(12, 'rouge', 'jaune', 'bleu'), LEA, { skips: 0 }),
    player('tom', 'Tom', avatarOf(31, 'jaune', 'noir', 'rouge'), TOM, { skips: 5, bestCombo: 2 }),
    player('ines', 'Inès', avatarOf(47, 'vert', 'creme', 'rose'), state === 'finished' ? LEA.slice(1) : null),
  ]
  return {
    id: `debug-${state}`,
    ownerName: 'Léa',
    owned: state !== 'finished',
    lang: 'fr',
    seed: 7,
    categoryIds: ['pays', 'animaux', 'couleurs'],
    createdAt: Date.now() - 5 * HOUR,
    expiresAt: Date.now() + 19 * HOUR,
    finished: state === 'finished',
    nextId: null,
    powersAllowed: true,
    name: null,
    players,
    reactions:
      state === 'finished'
        ? [
            { target: 'trophy:original', emoji: '👏', playerId: 'lea' },
            { target: 'trophy:original', emoji: '🔥', playerId: 'tom' },
            { target: 'word:animaux:chat', emoji: '😂', playerId: 'ines' },
          ]
        : [],
  }
}

function summaryOf(detail: ChallengeDetail): ChallengeSummary {
  return {
    id: detail.id,
    ownerName: detail.ownerName,
    owned: detail.owned,
    lang: detail.lang,
    categoryIds: detail.categoryIds,
    createdAt: detail.createdAt,
    players: detail.players.length,
    played: detail.players.filter((entry) => entry.playedAt !== null).length,
    mePlayed: false,
    myScore: null,
    finished: detail.finished,
    expiresAt: detail.expiresAt,
    seenInvite: false,
    seenRecap: false,
    name: detail.name,
    nextId: null,
    hiddenStamp: null,
  }
}

// ------------------------------------------------------------ scenarios --

/** Rows per measure: long, past fifty with the player far down, short, empty, and one that does not answer. */
const LEADERBOARD_SIZES: Record<StatId, number> = { best: 24, points: 60, runs: 5, words: 24, discoveries: 2, combo: 12, added: 0 }

/** A name past the podium's width: the top 3 must trim it rather than grow a step. */
const LONG_PLAYER = 'MaximilienDeRobespierre'

function fakeLeaderboard(stat: StatId, period: PeriodId, mineAt = 14): Promise<Leaderboard | null> {
  if (stat === 'combo' && period === 'week') return later(null, 700)
  const scale = period === 'day' ? 1 : period === 'week' ? 4 : 20
  const top = stat === 'best' ? 400 : stat === 'runs' ? 9 : stat === 'discoveries' ? 6 : 120
  const count = Math.min(LEADERBOARD_SIZES[stat], 50)
  const far = LEADERBOARD_SIZES[stat] > 50
  const rows = Array.from({ length: count }, (_, index) => ({
    name: index === 0 ? LONG_PLAYER : index === mineAt && !far ? 'Testeur' : `Joueur ${index + 1}`,
    avatar: avatarOf((index * 7 + top) % 100, index % 2 ? 'jaune' : 'bleu', 'noir', 'rouge'),
    value: Math.max(1, Math.round((top - index * (top / 60)) * scale)),
    place: index + 1,
    mine: index === mineAt && !far,
  }))
  const me = far ? { name: 'Testeur', avatar: DEFAULT_AVATAR, value: 3 * scale, place: 73, mine: true } : null
  return later(completeLeaderboard(stat, period, { rows, me }), 500)
}

/** Un mois de jeu inventé pour le tableau de bord : un creux le week-end, une pente douce. */
function dashboardSnapshot(): Snapshot {
  const today = new Date()
  const daily = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(today.getTime() - (29 - index) * 24 * HOUR)
    const weekend = day.getDay() === 0 || day.getDay() === 6
    const runs = Math.round((40 + index * 3) * (weekend ? 1.3 : 1) + ((index * 7) % 11))
    const newPlayers = 2 + ((index * 5) % 7)
    return {
      day: day.toISOString().slice(0, 10),
      new_players: newPlayers,
      signups: Math.floor(newPlayers / 3),
      runs,
      players: Math.round(runs / 4),
      opens: Math.round(runs * 0.9),
      sessions_with_run: Math.round(runs / 3),
      sessions_without_run: Math.round(runs / 9),
      challenges: index % 3,
      submissions: index % 4,
      ideas: index % 5 === 0 ? 1 : 0,
    }
  })
  const hourly = [1, 2, 3, 4, 5, 6, 7].flatMap((dow) =>
    Array.from({ length: 24 }, (_, hour) => ({ dow, hour, runs: hour < 7 ? 0 : Math.round(((hour % 12) + dow) * (hour > 17 ? 2 : 1)) })),
  )
  const todayHourly = Array.from({ length: today.getHours() + 1 }, (_, hour) => {
    const runs = hour < 7 ? 0 : Math.round((hour % 12) * (hour > 17 ? 2 : 1) + ((hour * 5) % 4))
    return {
      day: daily[daily.length - 1]!.day,
      hour,
      new_players: hour % 5 === 0 ? 1 : 0,
      signups: hour === 10 ? 1 : 0,
      runs,
      players: Math.ceil(runs / 3),
      opens: Math.round(runs * 0.9),
      sessions_with_run: Math.round(runs / 3),
      sessions_without_run: Math.round(runs / 8),
      challenges: 0,
      submissions: 0,
      ideas: 0,
    }
  })
  return {
    generated_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    days: 30,
    tracking_since: new Date(Date.now() - 9 * 24 * HOUR).toISOString(),
    totals: {
      players: 412, named: 138, anonymous: 274, runs: 5_318, words: 61_204, challenges: 96, moderators: 7,
      friendships: 54, submissions_pending: 12, submissions_accepted: 88, ideas_open: 4, push_devices: 31, devices: 260, events: 48_110,
    },
    today: { runs: 131, players: 29, new_players: 6, signups: 2, opens: 118 },
    active: { dau: 29, wau: 84, mau: 203 },
    daily,
    today_hourly: todayHourly,
    hourly,
    sessions: {
      total: 1_420, with_run: 1_060, without_run: 360, runs_per_session: 2.4, median_seconds: 312,
      ready_p50_ms: 1_380, ready_p90_ms: 3_900, cold_opens: 820, resumes: 600,
    },
    kinds: [
      { kind: 'tap', n: 21_400, devices: 240 }, { kind: 'screen', n: 9_800, devices: 250 }, { kind: 'open', n: 1_420, devices: 260 },
      { kind: 'run_start', n: 3_100, devices: 190 }, { kind: 'run_end', n: 2_950, devices: 188 }, { kind: 'error', n: 14, devices: 6 },
    ],
    taps: [
      { screen: 'home', label: 'Jouer', n: 2_900, devices: 190 }, { screen: 'over', label: 'Rejouer', n: 1_700, devices: 140 },
      { screen: 'home', label: 'Défis', n: 640, devices: 88 }, { screen: 'menu:boards', label: 'Semaine', n: 210, devices: 61 },
      { screen: 'playing', label: 'Passer', n: 4_100, devices: 180 },
    ],
    screens: [{ name: 'home', n: 3_800, devices: 250 }, { name: 'playing', n: 3_100, devices: 190 }, { name: 'menu:boards', n: 420, devices: 90 }],
    features: [{ name: 'power_chosen', n: 310, devices: 120 }, { name: 'challenge_created', n: 96, devices: 51 }, { name: 'category_ban', n: 18, devices: 11 }],
    platforms: [{ platform: 'android', version: '1.6.6', devices: 180 }, { platform: 'web', version: '1.6.6', devices: 70 }, { platform: 'android', version: '1.6.5', devices: 10 }],
    langs: [{ lang: 'fr', devices: 210 }, { lang: 'en', devices: 30 }, { lang: 'de', devices: 12 }, { lang: 'es', devices: 8 }],
    errors: [{ message: 'TypeError: Cannot read properties of undefined (reading \'rows\')', n: 9, devices: 4, last: new Date(Date.now() - 5 * HOUR).toISOString() }],
    runs: {
      count: 3_020, challenge_runs: 240, avg_score: 612, median_score: 540, avg_words: 11.4, avg_skips: 3.1,
      scores: [2, 5, 9, 14, 22, 30, 34, 31, 26, 19, 12, 8, 5, 3, 2].map((n, index) => ({ from: index * 50, n: n * 10 })),
      powers: [{ power: 'joker', runs: 640, avg_score: 690 }, { power: 'hush', runs: 410, avg_score: 655 }, { power: 'magic', runs: 220, avg_score: 610 }],
      categories: [{ category: 'animaux', words: 9_800, points: 88_000 }, { category: 'pays', words: 7_200, points: 61_000 }, { category: 'capitales', words: 5_100, points: 49_000 }],
      top_words: [{ word: 'chat', category: 'animaux', n: 410 }, { word: 'france', category: 'pays', n: 380 }, { word: 'paris', category: 'capitales', n: 350 }],
    },
    funnel: { new_players: 160, played_1: 131, played_3: 88, played_10: 41, named: 52 },
    retention: Array.from({ length: 6 }, (_, index) => {
      const size = 30 + index * 6
      return {
        week: new Date(today.getTime() - (5 - index) * 7 * 24 * HOUR).toISOString().slice(0, 10),
        size, d1: Math.round(size * 0.42), w1: Math.round(size * 0.55), later: index < 5 ? Math.round(size * 0.31) : 0,
      }
    }),
    recent_signups: [
      { name: 'Léa', at: new Date(Date.now() - 3 * HOUR).toISOString(), runs: 12, best: 880 },
      { name: 'Hugo', at: new Date(Date.now() - 20 * HOUR).toISOString(), runs: 4, best: 410 },
      { name: 'Inès', at: new Date(Date.now() - 70 * HOUR).toISOString(), runs: 31, best: 1_240 },
    ],
    top_players: [
      { name: 'Inès', runs: 212, best: 1_240, anonymous: false },
      { name: 'Anonyme 3f2a', runs: 140, best: 760, anonymous: true },
      { name: 'Léa', runs: 96, best: 880, anonymous: false },
    ],
    moderation: { votes: 420, submitted: 38, accepted: 21, rejected: 9 },
    challenges: { created: 41, avg_players: 2.7, played_share: 0.86 },
    invites: {
      mails: 23, mails_to_players: 4, mail_joins: 9, shares: 61, sharers: 27, link_joins: 14, played: 19,
      links_since: new Date(Date.now() - 12 * 24 * HOUR).toISOString(),
      daily: daily.map((row, index) => ({ day: row.day, mails: index % 3, shares: (index * 7) % 5, joins: index % 4 === 0 ? 2 : index % 5 === 0 ? 1 : 0 })),
      top: [
        { name: 'Inès', anonymous: false, mails: 6, shares: 11, joins: 7, played: 6 },
        { name: 'Léa', anonymous: false, mails: 3, shares: 8, joins: 4, played: 3 },
        { name: 'Hugo', anonymous: false, mails: 5, shares: 2, joins: 1, played: 1 },
        { name: 'Anonyme 3f2a', anonymous: true, mails: 0, shares: 4, joins: 0, played: 0 },
      ],
    },
    prompts: {
      langs: [{ lang: 'fr', dealt: 14_380, passed: 2_210, pairs: 612 }, { lang: 'en', dealt: 1_240, passed: 260, pairs: 188 }],
      most_passed: (
        [
          ['metiers', 'Y', 88, 61], ['pays', 'W', 140, 58], ['animaux', 'X', 95, 55], ['capitales', 'Q', 72, 49], ['fruits-legumes', 'K', 60, 41],
          ['sports', 'U', 81, 37], ['pays', 'K', 150, 30], ['marques', 'Z', 34, 28], ['animaux', 'Q', 70, 26], ['metiers', 'W', 22, 20],
          ['capitales', 'Y', 48, 19], ['pays', 'Z', 60, 18], ['fruits-legumes', 'H', 90, 17], ['sports', 'N', 110, 16], ['animaux', 'U', 75, 15],
          ['metiers', 'O', 66, 14],
        ] as const
      ).map(([category, letter, dealt, passed]) => ({
        lang: 'fr', category, letter, dealt, passed, words: Math.round((dealt - passed) * 1.4), points: (dealt - passed) * 60, lang_dealt: 14_380,
      })),
      worst_rate: (
        [
          ['metiers', 'W', 22, 20], ['marques', 'Z', 34, 28], ['metiers', 'Y', 88, 61], ['capitales', 'Q', 72, 49], ['fruits-legumes', 'K', 60, 41],
          ['animaux', 'X', 95, 55], ['pays', 'W', 140, 58],
        ] as const
      ).map(([category, letter, dealt, passed]) => ({
        lang: 'fr', category, letter, dealt, passed, words: Math.round((dealt - passed) * 1.4), points: (dealt - passed) * 60, lang_dealt: 14_380,
      })),
    },
  }
}

/** Les joueurs d'une barre : quelques profils, un compte arrivé, un appareil sans compte. */
function dashboardSlot(): Promise<SlotEntry[]> {
  const player = (name: string, extra: Partial<Extract<SlotEntry, { anonymous: boolean }>>) => ({
    key: name, name, anonymous: false, avatar: avatarOf(21, 'bleu', 'jaune', 'rouge'), xp: at(12, 40), total_runs: 96, total_best: 880,
    words_found: 1_120, created_at: new Date(Date.now() - 20 * 24 * HOUR).toISOString(), named_at: new Date(Date.now() - 19 * 24 * HOUR).toISOString(),
    moderator: false, friends: 3, lang: 'fr', platform: 'android', version: '1.7.1', runs: 0, best: null, words: 0, active: true, arrived: false,
    signed: false, sessions_with_run: 0, sessions_without_run: 0, mails: 0, shares: 0, invited_by: null, ...extra,
  })
  return later(
    [
      player('Inès', { avatar: avatarOf(7, 'rouge', 'creme', 'jaune'), xp: at(24), total_runs: 212, total_best: 1_240, moderator: true, friends: 9, runs: 8, best: 1_010, words: 104, sessions_with_run: 3, shares: 2 }),
      player('Léa', { runs: 5, best: 720, words: 61, sessions_with_run: 2, sessions_without_run: 1, mails: 1 }),
      player('Hugo', { avatar: avatarOf(33, 'vert', 'creme', 'bleu'), xp: at(3), total_runs: 4, total_best: 410, created_at: new Date(Date.now() - 6 * HOUR).toISOString(), named_at: new Date(Date.now() - 5 * HOUR).toISOString(), friends: 1, runs: 4, best: 410, words: 38, arrived: true, signed: true, sessions_with_run: 1, invited_by: 'Inès' }),
      player('Anonyme 3f2a', { anonymous: true, avatar: DEFAULT_AVATAR, xp: at(1, 20), total_runs: 1, total_best: 90, named_at: null, created_at: new Date(Date.now() - 3 * HOUR).toISOString(), friends: 0, platform: 'web', runs: 1, best: 90, words: 7, arrived: true, sessions_with_run: 1 }),
      player('Tom', { avatar: avatarOf(12, 'jaune', 'bleu', 'rouge'), xp: at(8), total_runs: 51, total_best: 640, sessions_without_run: 2 }),
      { key: 'device:9c1e', name: 'Appareil 9c1e', device: true as const, sessions_with_run: 0, sessions_without_run: 1 },
    ],
    500,
  )
}

function AdvancedScenario() {
  const [data, setData] = useState<Snapshot | undefined>(undefined)
  useEffect(() => {
    later(dashboardSnapshot(), 300).then(setData)
  }, [])
  return (
    <div className="dashboard">
      <DashboardView data={data} loadSlot={dashboardSlot} />
    </div>
  )
}

/**
 * Le tableau des mots, nourri d'inventé : aucun appel au serveur, et les vrais
 * dictionnaires embarqués pour la colonne « théorique ».
 */
const WORDS_REPORT: WordsReport = {
  generated_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  lang: 'fr',
  category: null,
  runs: 987,
  lang_runs: 412,
  dealt: 3_074,
  pairs: [
    { category: 'animaux', letter: 'A', dealt: 96, passed: 9, words: 118, points: 2_140 },
    { category: 'animaux', letter: 'C', dealt: 88, passed: 6, words: 121, points: 2_310 },
    { category: 'animaux', letter: 'Z', dealt: 4, passed: 3, words: 1, points: 30 },
    { category: 'pays', letter: 'A', dealt: 61, passed: 12, words: 52, points: 880 },
    { category: 'pays', letter: 'R', dealt: 22, passed: 9, words: 14, points: 210 },
    { category: 'couleurs', letter: 'T', dealt: 12, passed: 10, words: 2, points: 24 },
    { category: 'metiers', letter: 'M', dealt: 44, passed: 7, words: 49, points: 760 },
    { category: 'sports', letter: 'F', dealt: 39, passed: 5, words: 44, points: 690 },
  ],
  words: [
    { word: 'chat', category: 'animaux', uses: 61, approx: 4, last: new Date(Date.now() - 2 * 60_000).toISOString() },
    { word: 'cheval', category: 'animaux', uses: 48, approx: 2, last: new Date(Date.now() - 26 * 60_000).toISOString() },
    { word: 'autruche', category: 'animaux', uses: 9, approx: 3, last: new Date(Date.now() - 5 * 60 * 60_000).toISOString() },
    { word: 'zebre', category: 'animaux', uses: 3, approx: 1, last: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() },
    { word: 'aigle royal', category: 'animaux', uses: 0, approx: 0, last: null },
    { word: 'cote d ivoire', category: 'pays', uses: 12, approx: 1, last: new Date(Date.now() - 3 * 60 * 60_000).toISOString() },
    { word: 'vert bouteille', category: 'couleurs', uses: 4, approx: 0, last: new Date(Date.now() - 8 * 60 * 60_000).toISOString() },
    { word: 'taxidermiste', category: 'metiers', uses: 0, approx: 0, last: null },
  ],
  added: [
    {
      word: 'taxidermiste',
      category: 'metiers',
      display: 'Taxidermiste',
      at: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
      uses: 2,
      approx: 0,
      uses_since: 2,
      approx_since: 0,
      parties_since: 38,
      requesters: [{ name: 'Camille', at: new Date(Date.now() - 9 * 24 * 60 * 60_000).toISOString() }],
      moderators: [
        { name: 'Maxitoon', verdict: 'correct', note: null, at: new Date(Date.now() - 4 * 24 * 60 * 60_000).toISOString() },
        { name: 'Inès', verdict: 'correct', note: null, at: new Date(Date.now() - 4 * 24 * 60 * 60_000).toISOString() },
        { name: 'Terretciel', verdict: 'correct', note: null, at: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString() },
      ],
    },
    {
      word: 'vert bouteille',
      category: 'couleurs',
      display: 'Vert bouteille',
      at: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString(),
      uses: 17,
      approx: 2,
      uses_since: 17,
      approx_since: 2,
      parties_since: 210,
      requesters: [
        { name: 'Léa', at: new Date(Date.now() - 40 * 24 * 60 * 60_000).toISOString() },
        { name: 'Hugo', at: new Date(Date.now() - 39 * 24 * 60 * 60_000).toISOString() },
      ],
      moderators: [{ name: 'Maxitoon', verdict: 'special', note: 'Deux mots, une teinte : à garder.', at: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString() }],
    },
  ],
  removed: [
    {
      word: 'yougoslavie',
      category: 'pays',
      display: 'Yougoslavie',
      at: new Date(Date.now() - 11 * 24 * 60 * 60_000).toISOString(),
      uses_before: 31,
      approx_before: 2,
      parties_before: 640,
      moderators: [
        { name: 'Inès', verdict: 'correct', note: 'Ce pays n’existe plus.', at: new Date(Date.now() - 12 * 24 * 60 * 60_000).toISOString() },
        { name: 'Maxitoon', verdict: 'correct', note: null, at: new Date(Date.now() - 11 * 24 * 60 * 60_000).toISOString() },
      ],
    },
  ],
  pending: [
    {
      id: 'add-taxi',
      word: 'taxidermiste',
      category: 'metiers',
      display: 'Taxidermiste',
      kind: 'add',
      at: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
      respelled: false,
      special: false,
      proposals: 2,
      proposers: [
        { name: 'Camille', at: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString() },
        { name: 'Nino', at: new Date(Date.now() - 20 * 60 * 60_000).toISOString() },
      ],
      votes: [
        { name: 'Léa', verdict: 'correct', note: null, at: new Date(Date.now() - 30 * 60 * 60_000).toISOString() },
        { name: 'Tom', verdict: 'unsure', note: null, at: new Date(Date.now() - 28 * 60 * 60_000).toISOString() },
        { name: 'Sacha', verdict: 'correct', note: null, at: new Date(Date.now() - 26 * 60 * 60_000).toISOString() },
      ],
    },
    {
      id: 'ban-yougo',
      word: 'yougoslavie',
      category: 'pays',
      display: 'Yougoslavie',
      kind: 'ban',
      at: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
      respelled: false,
      special: true,
      proposals: 0,
      proposers: [],
      votes: [{ name: 'Inès', verdict: 'correct', note: 'Ce pays n’existe plus.', at: new Date(Date.now() - 5 * 60 * 60_000).toISOString() }],
    },
  ],
}

/** Le relevé d'une catégorie seule, comme `admin_words` le rend : filtré par le serveur. */
function wordsReportOf(category: string | null): WordsReport {
  if (!category) return WORDS_REPORT
  const kept = <T extends { category: string }>(rows: readonly T[]) => rows.filter((row) => row.category === category)
  return {
    ...WORDS_REPORT,
    category,
    pairs: kept(WORDS_REPORT.pairs),
    words: kept(WORDS_REPORT.words),
    added: kept(WORDS_REPORT.added),
    removed: kept(WORDS_REPORT.removed),
    pending: kept(WORDS_REPORT.pending),
  }
}

function WordsScenario() {
  return (
    <div className="dashboard">
      <WordsBoardView
        lang="fr"
        superModerator
        load={(_lang, category) => later(wordsReportOf(category), 300)}
        onBan={() => later('sent' as const)}
        onForce={() => later('accepted' as const)}
        onAdd={() => later(true)}
      />
    </div>
  )
}

/** Les icônes à téléverser dans la Play Console, une par succès, sans marge ni animation. */
function AchievementIcons() {
  return (
    <div className="achievement-icons">
      {ACHIEVEMENTS.map((achievement) => (
        <div key={achievement.id} className="achievement-icon" data-achievement={achievement.id}>
          <Avatar choice={achievementIcon(achievement.id)} size="fill" />
        </div>
      ))}
    </div>
  )
}

function LeaderboardsScenario({ named, mineAt }: { named: boolean; mineAt?: number }) {
  return (
    <div className="sheet">
      <LeaderboardsPage named={named} load={(stat, period) => fakeLeaderboard(stat, period, mineAt)} />
    </div>
  )
}

const FRIEND_LEA = {
  id: 'lea',
  name: 'Léa',
  avatar: avatarOf(21, 'bleu', 'jaune', 'rouge'),
  xp: at(12, 40),
  bestScore: 2310,
  weekBest: 1840,
  moderator: false,
  relation: 'friend' as const,
}

function shared(
  id: string,
  days: number,
  finished: boolean,
  players: [string, number | null, number | null][],
  name: string | null = null,
): SharedChallenge {
  return {
    id,
    name,
    ownerName: 'Léa',
    owned: false,
    createdAt: Date.now() - days * 24 * HOUR,
    finished,
    players: players.map(
      ([playerId, score, rank]): SharedPlayer => ({
        playerId,
        name: playerId === 'lea' ? 'Léa' : playerId === 'me' ? 'Testeur' : 'Maxitoon',
        me: playerId === 'me',
        played: score !== null,
        score: score ?? 0,
        rank,
      }),
    ),
  }
}

const SHARED: readonly SharedChallenge[] = [
  shared('s-open', 0, false, [['me', 1910, null], ['lea', null, null]]),
  shared('s-won', 2, true, [['me', 2140, 1], ['bot', 1780, 2], ['lea', 1610, 3]], 'Revanche du jeudi'),
  shared('s-lost', 7, true, [['me', 1380, 2], ['lea', 1720, 1]]),
  shared('s-void', 9, true, [['me', 1520, 1], ['lea', null, null]]),
  shared('s-won-2', 14, true, [['lea', 1450, 2], ['me', 1600, 1]]),
]

function FriendPageScenario({ back, ties, empty }: { back(): void; ties?: boolean; empty?: boolean }) {
  const challenges = empty
    ? []
    : ties
      ? [...SHARED, shared('s-tie', 20, true, [['me', 1500, 1], ['lea', 1500, 2]])]
      : SHARED
  return (
    <div className="sheet">
      <FriendPage
        friend={FRIEND_LEA}
        challenges={challenges}
        complete
        showModerator
        onBack={back}
        onChallenge={back}
        onChallengeFriend={back}
        onRemove={back}
        onElect={() => later(undefined)}
      />
    </div>
  )
}

const FRIENDS = [
  FRIEND_LEA,
  { ...FRIEND_LEA, id: 'tom', name: 'Tom', avatar: avatarOf(31, 'jaune', 'noir', 'rouge'), xp: at(9), bestScore: 2480, weekBest: 1210 },
  { ...FRIEND_LEA, id: 'maxitoon', name: 'Maxitoon', avatar: avatarOf(47, 'vert', 'creme', 'rose'), xp: at(30), bestScore: 4400, weekBest: 2010, moderator: true },
  { ...FRIEND_LEA, id: 'camille', name: 'Camille', avatar: avatarOf(64, 'rose', 'noir', 'jaune'), xp: at(2), bestScore: 0, weekBest: 0 },
  { ...FRIEND_LEA, id: 'nino', name: 'Nino', avatar: avatarOf(5, 'rouge', 'creme', 'bleu'), relation: 'incoming' as const },
  { ...FRIEND_LEA, id: 'sacha', name: 'Sacha', avatar: avatarOf(88, 'noir', 'jaune', 'rouge'), relation: 'outgoing' as const },
]

/** La vue de l'onglet Social d'un compte nommé, sur des amis inventés : rien ne part au serveur. */
function FriendsScenario({ back, sheet }: { back(): void; sheet?: 'name' | 'invite' }) {
  const [said, setSaid] = useState<string | null>(null)
  return (
    <div className="sheet">
      <div className="stack">
        <button type="button" className="btn btn--quiet" onClick={back}>
          Retour
        </button>
        <FriendsView
          name="Jérémy"
          avatar={avatarOf(1, 'rouge', 'jaune', 'bleu')}
          onAvatar={() => setSaid('Ouvrirait l’éditeur d’avatar')}
          friends={FRIENDS}
          blocks={[{ id: 'kev', name: 'xXkevXx', avatar: avatarOf(3, 'bleu', 'noir', 'jaune') }]}
          showModerator
          sharedWith={(id) => (id === 'lea' ? SHARED : id === 'maxitoon' ? SHARED.slice(2, 4) : [])}
          message={said}
          onOpen={(id) => setSaid(`Ouvrirait la fiche de ${id}`)}
          onRespond={(id, accept) => setSaid(`${accept ? 'Accepterait' : 'Refuserait'} ${id}`)}
          onCancel={(id) => setSaid(`Annulerait la demande à ${id}`)}
          onUnblock={(id) => setSaid(`Débloquerait ${id}`)}
          onRequest={(name) =>
            later(name === 'Personne' ? { said: 'Aucun compte à ce nom.', done: false } : { said: `Demande envoyée à ${name}.`, done: true })
          }
          onInvite={(email) =>
            later(email.includes('@') ? { said: `${email} reçoit ton invitation. S’il crée son compte avec cette adresse, vous serez amis.`, done: true } : { said: 'Cette adresse e-mail ne semble pas valide.', done: false })
          }
          inviteCode="0123456789ab"
          initialSheet={sheet}
        />
      </div>
    </div>
  )
}

/**
 * Ce que le mail d'invitation et la carte d'aperçu montrent du jeu, dans la
 * langue de l'interface : l'affiche de l'accueil — le quart de disque rendu à
 * la tuile du menu — et son titre.
 * `npm run render:invite` les photographie (scripts/render-invite-art.ts).
 */
function InviteArtScenario({ back }: { back(): void }) {
  const t = useT()
  return (
    <div className="sheet stack">
      <div data-art="header" className="stack">
        <div className="poster">
          {POSTER.map(([kind, tint, ground], index) => (
            <span key={index} className="poster-cell" style={{ background: `var(--${ground})` }}>
              <Shape kind={kind} tint={tint} />
            </span>
          ))}
        </div>
        <header className="masthead">
          <h1 className="title">
            <span>{t.appName[0]}</span>
            <span>{t.appName[1]}</span>
          </h1>
        </header>
      </div>
      <button type="button" className="btn btn--quiet" onClick={back}>
        Retour
      </button>
    </div>
  )
}

/** Le vrai tiroir, ouvert sur « Social » pour un compte sans nom : rien à y voir, le nom à choisir. */
function SocialScenario({ back }: { back(): void }) {
  return (
    <Menu
      page="social"
      profile={PROFILE}
      history={[]}
      statsRecap={STATS_RECAP}
      avatar={DEFAULT_AVATAR}
      account={UNNAMED}
      accountActions={quietAccount}
      friendRequests={0}
      onFriends={noop}
      challenges={null}
      onChallenge={noop}
      onChallengeFriend={noop}
      theme="system"
      onTheme={noop}
      locale="fr"
      onLocale={noop}
      sound={{ master: 1, effects: 0.8, keys: 0.6, music: 0, muted: false }}
      onSound={noop}
      onAvatar={noop}
      onLogOut={noop}
      onErase={() => later(true)}
      moderation={null}
      onModerate={noop}
      onRequestsSeen={noop}
      onRequestsOpen={noop}
      onStatsRefresh={() => later(undefined)}
      lang="fr"
      advancedBoards={false}
      onAdvancedBoards={noop}
      onWordsBoard={noop}
      banActions={{ onBan: noop, onUnban: noop, onIntroSeen: noop, onJoinPlus: noop }}
      onClose={back}
    />
  )
}

function PastScenario({ back }: { back(): void }) {
  const [open, setOpen] = useState(true)
  const base = summaryOf(challenge('finished'))
  const rows = [
    { challenge: { ...base, id: 'past-won', name: 'Revanche du jeudi' }, winner: { name: 'Testeur', me: true, score: 1840 } },
    { challenge: { ...base, id: 'past-lost', createdAt: base.createdAt - 30 * HOUR }, winner: { name: 'Léa', me: false, score: 2315 } },
    { challenge: { ...base, id: 'past-asking', owned: true, createdAt: base.createdAt - 60 * HOUR }, winner: undefined },
    { challenge: { ...base, id: 'past-empty', createdAt: base.createdAt - 90 * HOUR }, winner: null },
  ]
  return (
    <div className="sheet">
      <OldChallengeList rows={rows} open={open} onToggle={() => setOpen(!open)} onOpen={back} />
    </div>
  )
}

/** A request as the server would hand it back, for the scenarios that show one. */
function submission(id: string, categoryId: string, display: string, status: SubmissionStatus, locked = false): Submission {
  return { id, lang: 'fr', categoryId, display, status, at: 0, locked, fresh: false }
}

/** The real end screen, its picks applied to a copy of the profile the way the session would. */
function OverScenario({
  run = RUN,
  before = PROFILE,
  after,
  account = NAMED,
  challengeState,
  mine,
  requests = [],
  failing = false,
  hidden,
  onBack,
}: {
  run?: Run
  before?: Profile
  after: Profile
  account?: Account
  challengeState?: ChallengeDetail | 'sending' | 'failed'
  /** Les mots que le joueur a lui-même fait entrer, pour la marque discrète. */
  mine?: ReadonlySet<string>
  /** Les mots proposés pendant la partie, corrigés et retirés comme en vrai. */
  requests?: readonly RunProposal[]
  /** Le serveur ne répond pas : les deux gestes échouent, le bilan le dit. */
  failing?: boolean
  /** Les invites passées, chacune avec un mot caché sous une bande. */
  hidden?: readonly HiddenAnswer[]
  onBack(): void
}) {
  const [profile, setProfile] = useState(after)
  const [revealed, setRevealed] = useState(false)
  const [proposals, setProposals] = useState(requests)
  return (
    <OverScreen
      run={run}
      profile={profile}
      profileBefore={before}
      revealed={revealed}
      onRevealed={() => setRevealed(true)}
      lang="fr"
      avatar={DEFAULT_AVATAR}
      account={account}
      accountActions={quietAccount}
      onAvatar={noop}
      onChoose={(id) => setProfile((current) => chooseCategory(current, id))}
      onChoosePower={(id) => setProfile((current) => choosePower(current, id))}
      onSupportAsked={noop}
      mine={mine}
      proposals={proposals}
      onCorrectProposal={async (proposal, display) => {
        if (failing) return false
        setProposals((current) =>
          current.map((entry) =>
            entry.proposal.at === proposal.at
              ? {
                  proposal: { ...entry.proposal, word: display },
                  submission: entry.submission && { ...entry.submission, display },
                }
              : entry,
          ),
        )
        return true
      }}
      onWithdrawProposal={async (proposal) => {
        if (failing) return false
        setProposals((current) => current.filter((entry) => entry.proposal.at !== proposal.at))
        return true
      }}
      onReplay={onBack}
      onHome={onBack}
      challenge={challengeState}
      onChallengeChanged={noop}
      hidden={hidden}
      onPeek={() => setProfile((current) => spendPeek(current))}
      onJoinPlus={() => setProfile((current) => joinPlus(current, Date.now()))}
    />
  )
}

const HIDDEN: HiddenAnswer[] = [
  { prompt: { categoryId: 'pays', letter: 'K' }, display: 'kenya' },
  { prompt: { categoryId: 'animaux', letter: 'Z' }, display: 'zèbre' },
  { prompt: { categoryId: 'couleurs', letter: 'M' }, display: 'marron' },
  { prompt: { categoryId: 'animaux', letter: 'O' }, display: 'ours' },
]

/** Les écrans parlent la langue de l'interface : le merci aussi. */
function PremiumThanksScenario({ back }: { back(): void }) {
  const t = useT()
  return <FeedbackPop intro={t.premiumThanks} onClose={back} send={() => later(true)} />
}

/** « Mes catégories » à sept catégories : le bannissement s'y ouvre, sur un profil qui ne sort pas de la planche. */
function BansScenario({
  seen = false,
  plus = false,
  banned = [],
  every = false,
}: {
  seen?: boolean
  plus?: boolean
  /** Déjà bannies à l'ouverture. */
  banned?: readonly string[]
  /** Tout le catalogue possédé, au lieu de sept catégories. */
  every?: boolean
}) {
  const [profile, setProfile] = useState<Profile>(() => ({
    ...PROFILE,
    unlocked: every
      ? CATALOGUE.map((category) => category.id).filter((id) => !['pays', 'animaux', 'couleurs'].includes(id))
      : ['fruits-legumes', 'metiers', 'sports', 'marques'],
    banIntroSeen: seen ? 1 : 0,
    plusSince: plus ? 1 : 0,
    banned,
  }))
  const owned = ownedCategoryIds(profile)
  return (
    <div className="sheet">
      <CategoriesPage
        profile={profile}
        onHidden={noop}
        onBan={(id) => setProfile((current) => ban(current, owned, id))}
        onUnban={(id) => setProfile((current) => unban(current, id))}
        onIntroSeen={() => setProfile((current) => markBanIntroSeen(current))}
        onJoinPlus={() => setProfile((current) => joinPlus(current, Date.now()))}
      />
    </div>
  )
}

/** La file de modération, avec un mot signalé : la planche n'écrit jamais au serveur. */
const MODERATION_QUEUE: readonly ReviewCard[] = [
  {
    id: 'ban-1',
    categoryId: 'animaux',
    kind: 'ban',
    display: 'Quiscale',
    proposals: 2,
    special: false,
    note: 'Ce n’est pas un animal : c’est le nom d’un genre de passereaux.',
    canRespell: false,
    friends: [],
  },
  {
    id: 'add-1',
    categoryId: 'animaux',
    kind: 'add',
    display: 'Pangolin',
    proposals: 3,
    special: false,
    note: null,
    canRespell: true,
    friends: [],
  },
]

function ModerationQueueScenario({ onBack }: { onBack(): void }) {
  return <ModerationScreen lang="fr" queue={MODERATION_QUEUE} onDone={onBack} />
}

/** Le mot d'un récap qu'un modérateur peut signaler, la carte ouverte dessus. */
const FLAGGED_WORD: PlayedWord = { categoryId: 'animaux', word: 'quiscale', display: 'Quiscale', points: 14 }

/** Le récap d'une de ses parties, ouvert : un mot s'y signale d'un appui long. */
function FlagRecapScenario() {
  return (
    <div className="sheet">
      <StatsPage
        history={STATS_HISTORY}
        profile={STATS_PROFILE}
        challenges={null}
        openRun={STATS_HISTORY[0]}
        onChallenge={noop}
        recap={STATS_RECAP}
      />
    </div>
  )
}

/** La carte de signalement seule, telle que la planche la montre sans geste. */
function FlagCardScenario({ onBack }: { onBack(): void }) {
  return (
    <FlagWordCard
      word={FLAGGED_WORD}
      category="Animaux"
      onFlag={() => later('sent' as const)}
      onClose={onBack}
    />
  )
}

/** La page des statistiques, telle qu'un compte qui a joué ailleurs la remplit. */
function StatsScenario() {
  return (
    <div className="sheet">
      <StatsPage
        history={STATS_HISTORY}
        profile={STATS_PROFILE}
        challenges={null}
        onChallenge={noop}
        onRefresh={() => later(undefined)}
        loadOlder={olderStatsRuns}
        recap={STATS_RECAP}
      />
    </div>
  )
}

const IDEAS: AdminIdea[] = [
  {
    id: 'i1',
    body: 'Un mode à deux sur le même téléphone, ce serait génial pour les soirées !',
    lang: 'fr',
    source: 'prompt',
    author: 'Léa',
    authorRuns: 41,
    createdAt: new Date(Date.now() - 2 * HOUR).toISOString(),
    archivedAt: null,
  },
  {
    id: 'i2',
    body: 'La catégorie Marques accepte « Nike » mais pas « Adidas » ?',
    lang: 'fr',
    source: 'box',
    author: 'Anonyme',
    authorRuns: 7,
    createdAt: new Date(Date.now() - 30 * HOUR).toISOString(),
    archivedAt: null,
  },
  {
    id: 'i3',
    body: 'Please add a dark mode for the keyboard.',
    lang: 'en',
    source: 'box',
    author: 'Tom',
    authorRuns: 120,
    createdAt: new Date(Date.now() - 90 * HOUR).toISOString(),
    archivedAt: new Date(Date.now() - 20 * HOUR).toISOString(),
  },
]

/** Les idées reçues, archivées et effacées sur une copie : rien ne part au serveur. */
function IdeasScenario({ back }: { back(): void }) {
  const [ideas, setIdeas] = useState(IDEAS)
  return (
    <div className="sheet">
      <IdeasAdminView
        ideas={ideas}
        onArchive={async (id, archived) => {
          setIdeas((current) =>
            current.map((idea) => (idea.id === id ? { ...idea, archivedAt: archived ? new Date().toISOString() : null } : idea)),
          )
          return true
        }}
        onDelete={async (id) => {
          setIdeas((current) => current.filter((idea) => idea.id !== id))
          return true
        }}
        onClose={back}
      />
    </div>
  )
}

interface Scenario {
  id: string
  group: string
  title: string
  how: string
  phase: string
  render(back: () => void): ReactNode
}

const levelUp = (from: number, to: number): [Profile, Profile] => {
  const before = { ...PROFILE, xp: at(from, 80) }
  return [before, afterRun(before, RUN, { xp: at(to, 40) })]
}

/** L'offre de modérateur : un seul rendu pour les trois raisons qui l'amènent. */
const offerModerator =
  (reason: 'level' | 'words' | 'friend') =>
  (back: () => void): ReactNode => (
    <ModeratorOffer
      reason={reason}
      invitedBy={reason === 'friend' ? 'Léa' : null}
      anonymous={false}
      onAccount={back}
      onAnswered={(accepted) => !accepted && back()}
      onLater={back}
      onModerate={back}
      answerOffer={() => later(true)}
    />
  )

const SCENARIOS: readonly Scenario[] = [
  {
    id: 'over-classic',
    group: 'Fin de partie',
    title: 'Classique, record battu',
    how: 'Record, mots rares, faute d’une lettre, demande de soutien',
    phase: 'over',
    render: (back) => (
      <OverScenario
        after={afterRun(PROFILE, RUN, { runs: PROFILE.runs + 10 })}
        mine={new Set(['bhoutan', 'ornithorynque'])}
        onBack={back}
      />
    ),
  },
  {
    id: 'over-proposals',
    group: 'Fin de partie',
    title: 'Mots proposés au bilan',
    how: 'Un mot encore sur l’appareil, un en attente, un entré : corriger et retirer marchent',
    phase: 'over',
    render: (back) => (
      <OverScenario
        after={afterRun(PROFILE, RUN)}
        mine={new Set(['bhoutan'])}
        requests={[
          { proposal: { word: 'axolotl', categoryId: 'animaux', at: 1, lang: 'fr' }, submission: null },
          {
            proposal: { word: 'narval', categoryId: 'animaux', at: 2, lang: 'fr' },
            submission: submission('s-narval', 'animaux', 'narval', 'pending', true),
          },
          {
            proposal: { word: 'okapi', categoryId: 'animaux', at: 3, lang: 'fr' },
            submission: submission('s-okapi', 'animaux', 'okapi', 'accepted', true),
          },
          {
            proposal: { word: 'quiscale', categoryId: 'animaux', at: 4, lang: 'fr' },
            submission: submission('s-quiscale', 'animaux', 'quiscale', 'pending'),
          },
        ]}
        onBack={back}
      />
    ),
  },
  {
    id: 'over-proposals-failed',
    group: 'Fin de partie',
    title: 'Mots proposés : le serveur ne répond pas',
    how: 'Corriger et retirer échouent : la ligne reste, et le bilan le dit',
    phase: 'over',
    render: (back) => (
      <OverScenario
        after={afterRun(PROFILE, RUN)}
        requests={[
          { proposal: { word: 'axolotl', categoryId: 'animaux', at: 1, lang: 'fr' }, submission: null },
          {
            proposal: { word: 'quiscale', categoryId: 'animaux', at: 2, lang: 'fr' },
            submission: submission('s-quiscale', 'animaux', 'quiscale', 'pending'),
          },
        ]}
        failing
        onBack={back}
      />
    ),
  },
  {
    id: 'over-category',
    group: 'Fin de partie',
    title: 'Proposition de catégorie',
    how: 'Passage au niveau 4 : trois catégories, une à garder',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(3, 4)
      return <OverScenario before={before} after={{ ...after, offer: ['sports', 'capitales', 'marques'] }} onBack={back} />
    },
  },
  {
    id: 'over-power',
    group: 'Fin de partie',
    title: 'Proposition de pouvoir',
    how: 'Passage au niveau 5 : deux cartes de pouvoir',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(4, 5)
      return <OverScenario before={{ ...before, powers: ['joker'] }} after={{ ...after, powers: ['joker'], powerOffer: ['hush', 'divination'] }} onBack={back} />
    },
  },
  {
    id: 'over-both',
    group: 'Fin de partie',
    title: 'Catégorie puis pouvoir',
    how: 'Du niveau 2 au 4 d’un coup : le premier pouvoir (3) et une catégorie (4)',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(2, 4)
      return (
        <OverScenario
          before={before}
          after={{ ...after, offer: ['sports', 'corps-humain', 'matieres'], powerOffer: ['joker', 'magic'] }}
          onBack={back}
        />
      )
    },
  },
  {
    id: 'over-hidden',
    group: 'Fin de partie',
    title: 'Mots cachés des invites passées',
    how: 'Repliées sous un bouton ; quatre bandes à arracher, chacune à son rythme : deux gratuites, puis l’offre et le faux paiement',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun({ ...PROFILE, peeks: 3 }, RUN)} hidden={HIDDEN} onBack={back} />,
  },
  {
    id: 'over-hidden-spent',
    group: 'Fin de partie',
    title: 'Mots cachés : plus aucun gratuit',
    how: 'Les cinq révélations gratuites sont passées : la première bande ouvre l’offre Premium',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun({ ...PROFILE, peeks: 5 }, RUN)} hidden={HIDDEN} onBack={back} />,
  },
  {
    id: 'over-hidden-premium',
    group: 'Fin de partie',
    title: 'Mots cachés : Premium',
    how: 'Premium : toutes les bandes s’arrachent, sans compteur',
    phase: 'over',
    render: (back) => (
      <OverScenario after={afterRun({ ...PROFILE, peeks: 5, plusSince: 1 }, RUN)} hidden={HIDDEN} onBack={back} />
    ),
  },
  {
    id: 'over-anonymous',
    group: 'Fin de partie',
    title: 'Joueur anonyme',
    how: 'Proposition de créer un compte (sans effet)',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} account={ANONYMOUS} onBack={back} />,
  },
  {
    id: 'over-empty',
    group: 'Fin de partie',
    title: 'Aucun mot trouvé',
    how: 'Zéro point',
    phase: 'over',
    render: (back) => {
      const run = makeRun(0, [])
      return <OverScenario run={run} after={afterRun(PROFILE, run)} onBack={back} />
    },
  },
  {
    id: 'challenge-over',
    group: 'Défi entre amis',
    title: 'Fin de partie de défi',
    how: 'Classement provisoire, deux joueurs sur quatre attendus',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} challengeState={challenge('waiting')} onBack={back} />,
  },
  {
    id: 'challenge-sending',
    group: 'Défi entre amis',
    title: 'Fin de défi, envoi en cours',
    how: 'La partie n’a pas encore atteint le serveur',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} challengeState="sending" onBack={back} />,
  },
  {
    id: 'challenge-failed',
    group: 'Défi entre amis',
    title: 'Fin de défi, envoi échoué',
    how: 'Le serveur n’a pas répondu',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} challengeState="failed" onBack={back} />,
  },
  {
    id: 'challenge-recap',
    group: 'Défi entre amis',
    title: 'Défi clos : bilan',
    how: 'Classement final, trophées, mots partagés et uniques, revanche',
    phase: 'home',
    render: (back) => <ChallengeView detail={challenge('finished')} onPlay={noop} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />,
  },
  {
    id: 'challenge-recap-reveal',
    group: 'Défi entre amis',
    title: 'Défi clos : première ouverture du bilan',
    how: 'Le classement se dévoile du dernier au premier, le gagnant en dernier',
    phase: 'home',
    render: (back) => (
      <ChallengeView detail={challenge('finished')} suspense onPlay={noop} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />
    ),
  },
  {
    id: 'challenge-closed-live',
    group: 'Défi entre amis',
    title: 'Défi clos pendant qu’on regarde',
    how: 'Le dernier joueur vient de finir : le classement reste, une pop propose le bilan',
    phase: 'home',
    render: (back) => <HeldScenario back={back} />,
  },
  {
    id: 'challenge-create',
    group: 'Défi entre amis',
    title: 'Créer un défi',
    how: 'Catégories à choisir parmi les siennes, pouvoirs autorisés ou non',
    phase: 'home',
    render: (back) => <CreateScenario back={back} powers />,
  },
  {
    id: 'challenge-create-bare',
    group: 'Défi entre amis',
    title: 'Créer un défi sans pouvoir possédé',
    how: 'L’interrupteur des pouvoirs est grisé',
    phase: 'home',
    render: (back) => <CreateScenario back={back} powers={false} />,
  },
  {
    id: 'challenge-to-play',
    group: 'Défi entre amis',
    title: 'Défi à jouer',
    how: 'Invité, pas encore joué',
    phase: 'home',
    render: (back) => <ChallengeView detail={challenge('to-play')} onPlay={back} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />,
  },
  {
    id: 'challenge-waiting',
    group: 'Défi entre amis',
    title: 'Défi en attente des autres',
    how: 'Joué, classement provisoire, inviter d’autres amis',
    phase: 'home',
    render: (back) => <ChallengeView detail={challenge('waiting')} onPlay={noop} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />,
  },
  {
    id: 'challenge-invite',
    group: 'Défi entre amis',
    title: 'Notification : invitation',
    how: 'Un ami vient d’envoyer un défi',
    phase: 'home',
    render: (back) => <ChallengeNotice challenge={summaryOf(challenge('to-play'))} kind="invite" onLater={back} onGo={back} />,
  },
  {
    id: 'challenge-recap-notice',
    group: 'Défi entre amis',
    title: 'Notification : bilan prêt',
    how: 'Tout le monde a joué',
    phase: 'home',
    render: (back) => <ChallengeNotice challenge={summaryOf(challenge('finished'))} kind="recap" onLater={back} onGo={back} />,
  },
  {
    id: 'words-news',
    group: 'Mots proposés',
    title: 'Mots entrés au dictionnaire',
    how: 'À l’ouverture, deux mots proposés acceptés depuis la dernière visite',
    phase: 'home',
    render: (back) => (
      <WordsNewsPop
        words={[
          { id: 'a', lang: 'fr', categoryId: 'animaux', display: 'axolotl', status: 'accepted', at: 0, locked: true, fresh: true },
          { id: 'b', lang: 'fr', categoryId: 'pays', display: 'tuvalu', status: 'accepted', at: 0, locked: true, fresh: true },
        ]}
        onClose={back}
        onOpen={back}
      />
    ),
  },
  {
    id: 'share-news',
    group: 'Amis',
    title: 'Annonce : inviter ses amis',
    how: 'Une seule fois, à l’ouverture : compte nommé, ou quinzième partie jouée',
    phase: 'home',
    render: (back) => <ShareNewsPop onLater={back} onOpen={back} />,
  },
  {
    id: 'words-news-long',
    group: 'Mots proposés',
    title: 'Mots entrés au dictionnaire : la liste déborde',
    how: 'Trente mots d’un coup : la liste défile dans la pop et les boutons restent au bas',
    phase: 'home',
    render: (back) => <WordsNewsPop words={LONG_NEWS} onClose={back} onOpen={back} />,
  },
  {
    id: 'power-gift',
    group: 'Mots proposés',
    title: 'Pouvoir offert au troisième mot',
    how: 'Challenge, donné quand un troisième mot proposé est accepté',
    phase: 'home',
    render: (back) => <PowerGiftPop powerId="complication" onClose={back} />,
  },
  {
    id: 'challenge-past',
    group: 'Défi entre amis',
    title: 'Anciens défis dans les statistiques',
    how: 'Ouverts depuis le titre « Défis entre amis » de l’accueil : qui a gagné chacun',
    phase: 'home',
    render: (back) => <PastScenario back={back} />,
  },
  {
    id: 'friend-page',
    group: 'Défi entre amis',
    title: 'Fiche d’un ami',
    how: 'Mes amis → toucher un ami : face à face et défis joués ensemble',
    phase: 'home',
    render: (back) => <FriendPageScenario back={back} />,
  },
  {
    id: 'friend-page-tie',
    group: 'Défi entre amis',
    title: 'Fiche d’un ami, avec une égalité',
    how: 'La case « égalité » n’apparaît que s’il y en a une',
    phase: 'home',
    render: (back) => <FriendPageScenario back={back} ties />,
  },
  {
    id: 'friend-page-empty',
    group: 'Défi entre amis',
    title: 'Fiche d’un ami sans défi',
    how: 'Aucun défi joué ensemble',
    phase: 'home',
    render: (back) => <FriendPageScenario back={back} empty />,
  },
  {
    id: 'social-friends',
    group: 'Défi entre amis',
    title: 'Mes amis',
    how: 'Onglet Social d’un compte nommé : une demande reçue, amis par record ou A–Z, envoyées et bloqués repliés',
    phase: 'home',
    render: (back) => <FriendsScenario back={back} />,
  },
  {
    id: 'social-add-friend',
    group: 'Défi entre amis',
    title: 'Ajouter un ami par son nom',
    how: 'Mes amis → Ajouter un ami, onglet « A déjà le jeu » (« Personne » répond aucun compte)',
    phase: 'home',
    render: (back) => <FriendsScenario back={back} sheet="name" />,
  },
  {
    id: 'social-invite',
    group: 'Défi entre amis',
    title: 'Inviter un ami sans le jeu',
    how: 'Mes amis → Ajouter un ami, onglet « N’a pas le jeu » : lien de la page d’invitation par WhatsApp, Messenger (app seule), Telegram, SMS, Discord (copié) ou la feuille de partage, et invitation par e-mail (rien n’est envoyé ici)',
    phase: 'home',
    render: (back) => <FriendsScenario back={back} sheet="invite" />,
  },
  {
    id: 'social-unnamed',
    group: 'Défi entre amis',
    title: 'Onglet Social sans nom de compte',
    how: 'Compte Google pas encore nommé (profil « Anonyme ») : l’onglet demande le nom au lieu de montrer des amis (sans effet ici)',
    phase: 'home',
    render: (back) => <SocialScenario back={back} />,
  },
  {
    id: 'challenge-powers',
    group: 'Défi entre amis',
    title: 'Choix des pouvoirs avant un défi',
    how: 'Plus de deux pouvoirs admis',
    phase: 'home',
    render: (back) => (
      <ChallengePowers allowed={['joker', 'dodge', 'hush', 'divination', 'chatter']} initial={['joker', 'dodge']} onStart={back} onClose={back} />
    ),
  },
  // Les identifiants restent littéraux : `npm run debug:recent` les relit dans
  // le fichier pour nommer les planches touchées depuis la dernière version.
  {
    id: 'moderator-level',
    group: 'Modération',
    title: 'Offre de modérateur : niveau 6',
    how: 'Accepter montre l’accueil, sans rien écrire sur le serveur',
    phase: 'home',
    render: offerModerator('level'),
  },
  {
    id: 'moderator-words',
    group: 'Modération',
    title: 'Offre de modérateur : trois mots acceptés',
    how: 'Accepter montre l’accueil, sans rien écrire sur le serveur',
    phase: 'home',
    render: offerModerator('words'),
  },
  {
    id: 'moderator-friend',
    group: 'Modération',
    title: 'Offre de modérateur : élu par un ami',
    how: 'Accepter montre l’accueil, sans rien écrire sur le serveur',
    phase: 'home',
    render: offerModerator('friend'),
  },
  {
    id: 'moderator-anonymous',
    group: 'Modération',
    title: 'Offre de modérateur, joueur anonyme',
    how: 'Il faut d’abord un compte',
    phase: 'home',
    render: (back) => (
      <ModeratorOffer reason="level" invitedBy={null} anonymous onAccount={back} onAnswered={back} onLater={back} onModerate={back} />
    ),
  },
  {
    id: 'moderator-failed',
    group: 'Modération',
    title: 'Offre de modérateur, réponse perdue',
    how: 'Le serveur ne répond pas',
    phase: 'home',
    render: (back) => (
      <ModeratorOffer
        reason="words"
        invitedBy={null}
        anonymous={false}
        onAccount={back}
        onAnswered={back}
        onLater={back}
        onModerate={back}
        answerOffer={() => later(false)}
      />
    ),
  },
  {
    id: 'language',
    group: 'Premier lancement',
    title: 'Choix de la langue',
    how: 'Appareil dans une langue que le jeu ne parle pas',
    phase: 'home',
    render: (back) => <LanguagePicker onPick={back} />,
  },
  {
    id: 'home-error',
    group: 'Accueil',
    title: 'Dictionnaire introuvable',
    how: 'Le chargement de la partie a échoué',
    phase: 'home',
    render: (back) => <DebugHome back={back} error />,
  },
  {
    id: 'home-waiting',
    group: 'Accueil',
    title: 'Ouverture en attente du serveur',
    how: 'L’affiche et le titre sont entrés, le profil, le compte ou les classements pas encore : trois formes sautillent',
    phase: 'home',
    render: (back) => <DebugHome back={back} waiting />,
  },
  {
    id: 'home-news',
    group: 'Accueil',
    title: 'Mots acceptés à annoncer, demandes d’ami',
    how: 'Pastille sur « Mes demandes », point rouge sur le menu',
    phase: 'home',
    render: (back) => <DebugHome back={back} />,
  },
  {
    id: 'home-newcomer',
    group: 'Accueil',
    title: 'Nouveau joueur sans compte',
    how: 'Tout à zéro : boutons de compte à la place des chiffres, du niveau et du classement',
    phase: 'home',
    render: (back) => <DebugHome back={back} newcomer />,
  },
  {
    id: 'long-boards',
    group: 'Accueil',
    title: 'Classement de plus de dix joueurs',
    how: 'Podium, le joueur et ses amis d’abord, puis « Voir plus » ; un nom ouvre ami / bloquer',
    phase: 'home',
    render: (back) => <DebugHome back={back} boards={LONG_BOARDS} />,
  },
  {
    id: 'home-climb',
    group: 'Accueil',
    title: 'Retour à l’accueil après avoir gagné des places',
    how: 'Le nom du joueur remonte le classement du jour, avec « +3 » en vert',
    phase: 'home',
    render: (back) => <DebugHome back={back} boards={LONG_BOARDS} climbed={3} />,
  },
  {
    id: 'leaderboards',
    group: 'Accueil',
    title: 'Page des classements',
    how: 'Sept mesures, jour / semaine / total : « Points » dépasse cinquante (ta place en bas), « Mots ajoutés » vide, « Série » semaine hors ligne',
    phase: 'home',
    render: () => <LeaderboardsScenario named />,
  },
  {
    id: 'leaderboards-podium',
    group: 'Accueil',
    title: 'Page des classements, joueur sur le podium',
    how: 'Le joueur est deuxième : sa marche du podium est cerclée de rouge',
    phase: 'home',
    render: () => <LeaderboardsScenario named mineAt={1} />,
  },
  {
    id: 'leaderboards-anonymous',
    group: 'Accueil',
    title: 'Page des classements, joueur anonyme',
    how: 'Les classements se lisent, avec l’invitation à créer un compte',
    phase: 'home',
    render: () => <LeaderboardsScenario named={false} />,
  },
  {
    id: 'leaderboards-advanced',
    group: 'Accueil',
    title: 'Tableau de bord de l’administrateur',
    how: 'Cinq tapes sur « Classements » : joueurs, actifs, parties, sessions, boutons touchés, rétention, erreurs — le relevé d’analytics_snapshot',
    phase: 'home',
    render: () => <AdvancedScenario />,
  },
  {
    id: 'words-board',
    group: 'Accueil',
    title: 'Tableau des mots du dictionnaire',
    how: 'Cinq tapes sur « Mes catégories » : ce que le tirage donne à chaque couple lettre + catégorie, théorique et réel, les mots écrits, ajoutés, retirés, en modération ; appui long sur une ligne pour signaler un mot, bouton pour en proposer un',
    phase: 'home',
    render: () => <WordsScenario />,
  },
  {
    id: 'achievement-icons',
    group: 'Accueil',
    title: 'Icônes des succès Play Games',
    how: 'Les quinze tuiles que les succès montrent sur Play Games, immobiles et à 512 px : npm run render:achievements les capture',
    phase: 'home',
    render: () => <AchievementIcons />,
  },
  {
    id: 'update',
    group: 'Accueil',
    title: 'Notification : nouvelle version',
    how: 'Le Play Store a une version plus récente',
    phase: 'home',
    render: (back) => <UpdateNotice onLater={back} onUpdate={back} />,
  },
  {
    id: 'feedback-pop',
    group: 'Accueil',
    title: 'Demande d’avis',
    how: 'Au retour d’une partie, après la dixième puis toutes les trente (envoi simulé)',
    phase: 'home',
    render: (back) => <FeedbackPop onClose={back} send={() => later(true)} />,
  },
  {
    id: 'feedback-pop-failed',
    group: 'Accueil',
    title: 'Demande d’avis : envoi raté',
    how: 'Le serveur ne répond pas : le texte reste, l’avis le dit',
    phase: 'home',
    render: (back) => <FeedbackPop onClose={back} send={() => later(false)} />,
  },
  {
    id: 'home-categories-news',
    group: 'Accueil',
    title: 'Pastille sur « Catégories »',
    how: 'Septième catégorie obtenue, bannissement pas encore lu',
    phase: 'home',
    render: (back) => <DebugHome back={back} categoriesNews={1} />,
  },
  {
    id: 'flag-word-recap',
    group: 'Modération',
    title: 'Signaler un mot : le récap d’une partie',
    how: 'Modérateur : appui long sur un mot de ses parties — clic droit sur le web — pour ouvrir la carte, motif compris ; « Ce que tu aurais pu écrire » se signale aussi, une fois la bande arrachée',
    phase: 'home',
    render: () => <FlagRecapScenario />,
  },
  {
    id: 'flag-word-card',
    group: 'Modération',
    title: 'Signaler un mot : la carte',
    how: 'Ce que lit le modérateur avant de confirmer — la phrase, le motif à écrire — puis « Signalé. Les autres modérateurs le jugeront. »',
    phase: 'home',
    render: (back) => <FlagCardScenario onBack={back} />,
  },
  {
    id: 'moderation-ban',
    group: 'Modération',
    title: 'Juger un mot signalé',
    how: 'File de jugement avec un mot signalé et un ajout : « Retirer » à droite, « Garder » à gauche, ni correction ni cas spécial',
    phase: 'home',
    render: (back) => <ModerationQueueScenario onBack={back} />,
  },
  {
    id: 'stats',
    group: 'Accueil',
    title: 'Page des statistiques',
    how: 'Vingt-cinq parties sur l’appareil, soixante-dix de plus au compte : « Voir plus » en charge trente à la fois ; une partie touchée ouvre son récap (mots dits, mots cachés) ; top des mots dits trois fois, taux de passe par catégorie',
    phase: 'home',
    render: () => <StatsScenario />,
  },
  {
    id: 'categories-ban',
    group: 'Accueil',
    title: 'Mes catégories : bannir',
    how: 'Septième catégorie : explication à l’ouverture, un ban gratuit, par le bouton ou d’un glissement de la ligne',
    phase: 'home',
    render: () => <BansScenario />,
  },
  {
    id: 'categories-ban-plus',
    group: 'Accueil',
    title: 'Mes catégories : Premium',
    how: 'Premium, tout le catalogue : jusqu’à cinq bans, par le bouton ou d’un glissement',
    phase: 'home',
    render: () => <BansScenario seen plus every />,
  },
  {
    id: 'categories-ban-full',
    group: 'Accueil',
    title: 'Mes catégories : jamais moins de six',
    how: 'Premium, une bannie sur sept : un deuxième ban est refusé, il faut garder six catégories en jeu',
    phase: 'home',
    render: () => <BansScenario seen plus banned={['pays']} />,
  },
  {
    id: 'categories-ban-max',
    group: 'Accueil',
    title: 'Mes catégories : cinq bans au plus',
    how: 'Premium, tout le catalogue, cinq bannies : un sixième est refusé ; glisser une ligne la rétablit',
    phase: 'home',
    render: () => <BansScenario seen plus every banned={['pays', 'animaux', 'couleurs', 'sports', 'marques']} />,
  },
  {
    id: 'plus-pop',
    group: 'Accueil',
    title: 'Offre Premium',
    how: 'Deuxième ban demandé sans être Premium (gratuit pour l’instant)',
    phase: 'home',
    render: (back) => <PlusPop reason="ban" onJoin={back} onClose={back} />,
  },
  {
    id: 'checkout',
    group: 'Accueil',
    title: 'Faux paiement Premium',
    how: 'Après « Passer Premium » : la commande à 0 €, « Payer », le paiement qui tourne, puis la bienvenue',
    phase: 'home',
    render: (back) => <Checkout onPaid={back} onCancel={back} />,
  },
  {
    id: 'premium-thanks',
    group: 'Accueil',
    title: 'Merci d’être Premium',
    how: 'Premier retour à l’accueil après l’abonnement : le merci, puis la demande d’avis (envoi simulé)',
    phase: 'home',
    render: (back) => <PremiumThanksScenario back={back} />,
  },
  {
    id: 'plus-pop-peek',
    group: 'Accueil',
    title: 'Offre Premium : mots cachés',
    how: 'Sixième mot caché demandé sans être Premium',
    phase: 'home',
    render: (back) => <PlusPop reason="peek" onJoin={back} onClose={back} />,
  },
  {
    id: 'ideas-admin',
    group: 'Accueil',
    title: 'Idées reçues (administrateur)',
    how: 'Cinq tapes sur « Boîte à idées » : à traiter, archivées, copier pour un backlog, effacer',
    phase: 'home',
    render: (back) => <IdeasScenario back={back} />,
  },
  {
    id: 'ideas-admin-denied',
    group: 'Accueil',
    title: 'Idées reçues : pas administrateur',
    how: 'Les cinq tapes d’un joueur ordinaire, ou un serveur muet',
    phase: 'home',
    render: (back) => (
      <div className="sheet">
        <IdeasAdminView ideas={null} onArchive={() => later(false)} onDelete={() => later(false)} onClose={back} />
      </div>
    ),
  },
  {
    id: 'ideas-admin-empty',
    group: 'Accueil',
    title: 'Idées reçues : rien à traiter',
    how: 'Tout est archivé',
    phase: 'home',
    render: (back) => (
      <div className="sheet">
        <IdeasAdminView
          ideas={IDEAS.map((idea) => ({ ...idea, archivedAt: idea.archivedAt ?? new Date().toISOString() }))}
          onArchive={() => later(true)}
          onDelete={() => later(true)}
          onClose={back}
        />
      </div>
    ),
  },
  {
    id: 'name-prompt',
    group: 'Accueil',
    title: 'Nom après la connexion Play Games',
    how: 'Joueur anonyme reconnu par Play Games : le compte Google est créé, l’accueil demande le nom en proposant celui de Play Games (sans effet ici)',
    phase: 'home',
    render: (back) => (
      <NamePrompt suggestion="Lettrophile42" onChoose={async (name) => (name.trim().length < 2 ? 'Nom trop court.' : (back(), null))} onLater={back} />
    ),
  },
  {
    id: 'push-offer',
    group: 'Accueil',
    title: 'Proposition des notifications',
    how: 'Juste après une nouvelle amitié, avant la question du téléphone (sans effet ici)',
    phase: 'home',
    render: (back) => <PushOffer onNo={back} onYes={back} />,
  },
  {
    id: 'invite-art',
    group: 'Accueil',
    title: 'Images du mail d’invitation',
    how: 'L’affiche et le titre que npm run render:invite photographie pour le mail et la carte d’aperçu',
    phase: 'home',
    render: (back) => <InviteArtScenario back={back} />,
  },
  {
    id: 'tutorial',
    group: 'Accueil',
    title: 'Tutoriel du premier « Jouer »',
    how: 'Une couleur en R (dans la langue de l’interface), puis la partie',
    phase: 'playing',
    render: (back) => <TutorialScreen lang="fr" onDone={back} />,
  },
]

/** The real creation form; « Lancer » only comes back to the board. */
function HeldScenario({ back }: { back(): void }) {
  const [held, setHeld] = useState<'no' | 'pop' | 'board'>('pop')
  return (
    <ChallengeView
      detail={challenge('finished')}
      held={held}
      onHold={setHeld}
      suspense
      onPlay={noop}
      onRematch={() => later(false)}
      onReact={() => later(true)}
      onBack={back}
      onChanged={noop}
    />
  )
}

function CreateScenario({ back, powers }: { back(): void; powers: boolean }) {
  const [rules, setRules] = useState<ChallengeRules>({ categoryIds: ['animaux', 'pays', 'couleurs'], powers, name: '' })
  return (
    <FriendPicker
      title="Défier des amis"
      exclude={[]}
      max={7}
      busy={false}
      message={null}
      confirmLabel={(count) => `Lancer (${count})`}
      onConfirm={back}
      onClose={back}
    >
      <ChallengeSetup
        owned={['animaux', 'pays', 'couleurs', 'metiers', 'fruits-legumes', 'sports', 'marques']}
        hasPowers={powers}
        rules={rules}
        onRules={setRules}
      />
    </FriendPicker>
  )
}

function DebugHome({
  back,
  error = false,
  newcomer = false,
  boards = null,
  climbed = 0,
  categoriesNews = 0,
  waiting = false,
}: {
  back(): void
  /** Ce que le serveur n'a pas encore rendu : l'accueil s'arrête sous son titre. */
  waiting?: boolean
  error?: boolean
  newcomer?: boolean
  boards?: Boards | null
  climbed?: number
  /** La pastille de « Catégories », tant que le bannissement n'a pas été lu. */
  categoriesNews?: number
}) {
  return (
    <HomeScreen
      profile={newcomer ? NEW_PROFILE : { ...PROFILE, powers: ['joker', 'hush'], equipped: ['joker'] }}
      error={error ? 'Le dictionnaire n’a pas pu être chargé.' : null}
      loading={false}
      settled={!waiting}
      boards={boards}
      me={newcomer ? null : 'Testeur'}
      climbed={climbed}
      avatar={DEFAULT_AVATAR}
      requestsNews={error || newcomer ? 0 : 3}
      categoriesNews={categoriesNews}
      friendRequests={error || newcomer ? 0 : 2}
      challenges={null}
      onChallenge={noop}
      onCreateChallenge={noop}
      onPastChallenges={noop}
      onMenu={back}
      onPlay={back}
      onEquip={noop}
      onAccount={back}
    />
  )
}

// --------------------------------------------------------------- board --

interface DebugBoardProps {
  onClose(): void
  /** The phase class the stage should wear, so each screen gets its own layout. */
  onPhase(phase: string): void
}

/** Les planches touchées depuis la dernière version livrée. */
const RECENT = new Set(RECENT_SCENARIOS)
/** Les planches que la dernière version livrée n'avait pas : en bleu, avant le rouge. */
const NEW = new Set(NEW_SCENARIOS)

export function DebugBoard({ onClose, onPhase }: DebugBoardProps) {
  const [open, setOpen] = useState<Scenario | null>(null)
  // Replaying remounts the screen, its animations and picks with it.
  const [take, setTake] = useState(0)
  // Où la liste était : y revenir évite de la rescroller à chaque planche vue.
  const listScroll = useRef(0)

  useEffect(() => {
    onPhase(open?.phase ?? 'home')
    window.scrollTo(0, open ? 0 : listScroll.current)
  }, [open, onPhase])

  if (open) {
    return (
      <>
        <PlayerActionsContext.Provider value={PLAYER_ACTIONS}>
          <div key={`${open.id}:${take}`} className="debug-scene">
            {open.render(() => setOpen(null))}
          </div>
        </PlayerActionsContext.Provider>
        <div className="debug-bar">
          <button type="button" className="btn btn--quiet" onClick={() => setOpen(null)}>
            ← Planche
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => setTake(take + 1)}>
            Rejouer
          </button>
        </div>
      </>
    )
  }

  const groups = [...new Set(SCENARIOS.map((scenario) => scenario.group))]
  // RECENT peut nommer une planche supprimée depuis : le compte suit la liste.
  const recentCount = SCENARIOS.filter((scenario) => RECENT.has(scenario.id) && !NEW.has(scenario.id)).length
  const newCount = SCENARIOS.filter((scenario) => NEW.has(scenario.id)).length
  return (
    <div className="sheet cascade debug-board">
      {/* À gauche : cinq tapes dans le coin haut droit ouvrent la planche,
          un bouton quitter au même endroit la refermait aussitôt. */}
      <div className="subpage-head">
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Fermer
        </button>
        <h1 className="subpage-title">Planche debug</h1>
      </div>
      <p className="note">
        Chaque écran difficile d’accès, avec des données inventées. Rien n’est envoyé au serveur ; les choix ne
        touchent pas au vrai profil.
      </p>
      {newCount > 0 && (
        <p className="note debug-note debug-note--new">
          En bleu : {newCount} planches nouvelles, que la {NEW_SINCE} n’avait pas.
        </p>
      )}
      {recentCount > 0 && (
        <p className="note debug-note">
          En rouge : {recentCount} des {SCENARIOS.length} planches montrent un écran ou un code qui a changé depuis
          la dernière version livrée ({NEW_SINCE}). « npm run debug:recent » refait la liste
          au moment de livrer.
        </p>
      )}
      {groups.map((group) => (
        <section key={group} className="stack">
          <p className="section-title">{group}</p>
          <ul className="debug-list">
            {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => {
              const fresh = NEW.has(scenario.id)
              const recent = !fresh && RECENT.has(scenario.id)
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    className={`debug-item${fresh ? ' debug-item--new' : recent ? ' debug-item--recent' : ''}`}
                    onClick={() => {
                      listScroll.current = window.scrollY
                      setTake(0)
                      setOpen(scenario)
                    }}
                  >
                    <strong>
                      {scenario.title}
                      {fresh && <span className="debug-flag debug-flag--new">nouveau</span>}
                      {recent && <span className="debug-flag">récent</span>}
                    </strong>
                    <span className="note">{scenario.how}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
