import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_AVATAR, type AvatarChoice } from '../domain/avatar'
import type { ChallengeWord } from '../domain/challenge'
import { choosePower } from '../domain/powers'
import { chooseBonus } from '../domain/bonus'
import { NEW_PROFILE, xpForLevel, type Profile } from '../domain/progression'
import type { PlayedWord, RunRecord } from '../domain/history'
import type { RarityTier } from '../domain/rarity'
import type { KeptWord, Run, Verdict } from '../domain/run'
import { chooseCategory } from '../domain/unlocks'
import type { Account, ChallengeDetail, ChallengePlayer, ChallengeSummary, ReviewCard, SpiedProfile, Submission, SubmissionStatus } from '../lib/cloud'
import type { AccountActions } from '../ui/AccountPanel'
import { AchievementsPanel } from '../ui/AchievementsPanel'
import { ChallengeNotice } from '../ui/ChallengeHome'
import { ChallengePowers } from '../ui/ChallengePowers'
import { ChallengeView } from '../ui/ChallengeScreen'
import { PowerGiftPop, ShareNewsPop, WordsNewsPop } from '../ui/WordsNews'
import { HomeScreen, POSTER } from '../ui/HomeScreen'
import { AvatarPanel } from '../ui/AvatarPanel'
import { LanguagePicker } from '../ui/LanguagePicker'
import { ModeratorOffer } from '../ui/ModeratorOffer'
import { ModerationScreen } from '../ui/ModerationScreen'
import { OverScreen, type RunProposal } from '../ui/OverScreen'
import { RunScreen } from '../ui/RunScreen'
import type { Cheer } from '../state/session'
import { PlayerActionsContext, type PlayerActions } from '../ui/PlayerSheet'
import { SpyHistory, type SpyActions } from '../ui/SpyHistory'
import { GameModes } from '../ui/GameModes'
import { ModeTutorial } from '../ui/ModeTutorial'
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
import { PLAY_ACHIEVEMENTS_ONLY, achievementIcon } from '../domain/achievements'
import type { SlotEntry, Snapshot } from './snapshot'
import { completeLeaderboard, type Leaderboard, type PeriodId, type StatId } from '../domain/leaderboards'
import { guestFits, placeGuest } from '../domain/localBoards'
import { LeaderboardsPage } from '../ui/LeaderboardsPage'
import { ModeIntro } from '../ui/ModeIntro'
import { WeeklyCardScenario, WeeklyDoneScenario, WeeklyRecapScenario, WeeklyResultsScenario, WeeklyRunScenario, WeeklyScreenScenario } from './weeklyScenarios'
import { NEW_SCENARIOS, NEW_SINCE, RECENT_SCENARIOS } from './recent'
import { todayKey } from '../lib/today'
import { ban, grantRevealAd, markBanIntroSeen, spendReveal, unban, type HiddenAnswer } from '../domain/perks'
import { ownedCategoryIds } from '../domain/unlocks'
import { CATALOGUE } from '../domain/catalogue'
import { CategoriesPage } from '../ui/CategoriesPage'
import { FeedbackPop } from '../ui/FeedbackPop'
import { PowerSlots } from '../ui/PowerSlots'
import { PremiumPage } from '../ui/PremiumPage'
import { PremiumContext } from '../ui/premiumContext'
import { PremiumSheet, type PremiumReason, type PremiumStatus } from '../ui/PremiumSheet'
import { PlusLockedSlot, PlusSeal, RESOURCE_ICONS, ResourceChip, ResourceGlyph, type ResourceState } from '../ui/premium'
import { PlusNewsPop, PlusPrizePop, PlusThanksPop } from '../ui/PlusNewsPop'
import { AvatarKeepPop } from '../ui/AvatarKeepPop'
import { RatingPop } from '../ui/RatingPop'
import { useT } from '../i18n'
import { IdeasAdminView } from './IdeasAdmin'
import { FeaturesBoardView } from './FeaturesBoard'
import { DuelScreen, Draft, DuelMatchmaking } from '../ui/DuelScreen'
import { DuelBanner, DuelInviteCard, PlayTogether } from '../ui/PlayTogether'
import { FEATURES, type FlagRow } from '../domain/features'
import type { AdminIdea } from '../lib/cloud'
import { DuelTutorial } from '../ui/DuelTutorial'
import { pickCategory } from '../domain/duel'
import { startDuel, type DuelFact, type DuelSetup } from '../domain/duelLog'
import { activeCheers, HOUSE_BOTS, type DuelTable, type Seat } from '../state/duel'
// La feuille du duel vit hors du paquet de l'accueil : cette planche est le
// seul écran de l'app qui la montre, donc elle l'apporte avec elle.
import '../duel.css'
import { PowerLoadout } from '../ui/PowerLoadout'
import { wearOrDrop } from '../domain/powers'

function LoadoutScenario({ onBack }: { onBack(): void }) {
  const [profile, setProfile] = useState<Profile>(() => ({
    ...PROFILE,
    powers: ['joker', 'hush', 'magic', 'permutation', 'dodge', 'dyslexia', 'divination', 'chatter'],
    equipped: ['joker'],
    bonuses: [...PROFILE.bonuses, 'slot'],
  }))
  return <PowerLoadout profile={profile} onWear={(id) => setProfile((current) => wearOrDrop(current, id))} onPlay={onBack} onBack={onBack} />
}

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
  // Défini plus bas, avec l'historique inventé qu'il montre.
  get spy() {
    return SPY_ACTIONS
  },
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
    taught: false,
    boost: 1,
    seconds: 3 + (index % 4),
    at: 5 + index * 6,
  }))
  return {
    seed: 42,
    mode: 'solo',
    answer: null,
    armed: true,
    categoryIds: ['pays', 'animaux', 'couleurs'],
    prompt: { categoryId: 'pays', letter: 'A' },
    drawn: words.length + 1,
    avoid: [],
    dealt: [],
    settled: [],
    shared: false,
    bonusWeight: 1,
    taught: [],
    seeded: [],
    found,
    used: [],
    usedPowers: [],
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
bonusSeconds: 0,
flawlessStreak: 0,
freeSkipReady: false,
  }
}

const RUN = makeRun(WORDS.reduce((sum, word) => sum + word[3], 0))

const at = (level: number, extra = 0) => xpForLevel(level) + extra

/** Trois pouvoirs, six catégories : le niveau où les bonus commencent. */
const BONUS_PROFILE: Profile = {
  ...NEW_PROFILE,
  xp: xpForLevel(10),
  runs: 40,
  bestScore: 290,
  powers: ['joker', 'dodge', 'hush'],
  equipped: ['joker', 'dodge'],
  unlocked: ['fruits-legumes', 'metiers', 'sports'],
  perksVersion: 1,
}

const PROFILE: Profile = {
  ...NEW_PROFILE,
  xp: at(3, 150),
  runs: 14,
  bestScore: 290,
  wordsFound: 120,
  bestCombo: 5,
  unlocked: ['fruits-legumes', 'metiers'],
  ratingAskedAt: 14,
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
  budget: { left: 2, allowed: 2, adsLeft: 3, unlimited: false },
  onPeek: noop,
  onAd: noop,
  // Un signalement de mot ne s'écrit pas depuis la planche : la carte répond seule.
  onFlag: () => later('sent' as const),
}

/** Quatre-vingt-dix jours inventés, jusqu'à aujourd'hui : des creux, des séries, un score qui monte. */
function spyDaily(seed: number): SpiedProfile['daily'] {
  return Array.from({ length: 90 }, (_, index) => {
    const day = new Date(Date.now() - (89 - index) * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
    const runs = (index * seed) % 7 < 3 ? 0 : ((index * 5 + seed) % 6) + 1
    const best = runs ? 120 + index * 2 + ((index * seed) % 40) : null
    return { day, runs, best, avg: best && Math.round(best * 0.62) }
  })
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()

function spyProfileOf(name: string): SpiedProfile {
  const bought = name === 'Bastien'
  return {
    id: `spy-${name}`,
    name,
    avatar: DEFAULT_AVATAR,
    anonymous: false,
    providers: bought ? ['google'] : ['email'],
    createdAt: daysAgo(bought ? 210 : 64),
    xp: bought ? 9_400 : 2_150,
    runsCount: 95,
    best: 312,
    wordsFound: 1_204,
    bestCombo: 9,
    bot: false,
    lastRunAt: daysAgo(0.2),
    lastOpen: { at: daysAgo(0.1), platform: 'android', version: '1.8.3', lang: 'fr' },
    platforms: [
      { platform: 'android', runs: 81, opens: 140, last: daysAgo(0.1) },
      { platform: 'web', runs: 14, opens: 22, last: daysAgo(12) },
    ],
    devices: 2,
    premium: {
      purchases: bought ? [{ provider: 'play', state: 'verified', at: daysAgo(40) }] : [],
      grant: null,
      savedSince: bought ? Date.parse(daysAgo(40)) : 0,
    },
    moderator: bought ? { since: daysAgo(90), super: false, lang: 'fr', invitedBy: 'Demontoon' } : null,
    friends: bought ? 7 : 3,
    powers: [
      { power: 'joker', runs: 31, points: 7_440 },
      { power: 'hush', runs: 18, points: 4_212 },
      { power: 'divination', runs: 6, points: 1_090 },
    ],
    withoutPowers: { runs: 40, points: 7_600 },
    moderation: bought
      ? { sessions: 23, lastSession: daysAgo(2), votes: { correct: 98, incorrect: 21, unsure: 6, special: 1 }, lastVote: daysAgo(2), proposed: { accepted: 9, rejected: 4, pending: 1 } }
      : { sessions: 0, lastSession: null, votes: {}, lastVote: null, proposed: { accepted: 1, pending: 2 } },
    daily: spyDaily(bought ? 3 : 5),
    features: [
      { name: 'swap', n: 42, last: daysAgo(0.2) },
      { name: 'hidden_words_peek', n: 17, last: daysAgo(1) },
      { name: 'theme', n: 2, last: daysAgo(30) },
    ],
  }
}

/** Les fiches inventées, modifiées sur place par les doublures : on voit le geste aboutir sans rien écrire au serveur. */
const SPIED_PROFILES = new Map<string, SpiedProfile>()
const spiedProfile = (key: string) => {
  const name = key.startsWith('spy-') ? key.slice(4) : key
  if (!SPIED_PROFILES.has(name)) SPIED_PROFILES.set(name, spyProfileOf(name))
  return SPIED_PROFILES.get(name)!
}

/** L'historique espionné d'un joueur : le même que la page des statistiques, sauf pour « Anonyme », que personne ne porte. */
const SPY_ACTIONS: SpyActions = {
  profile: (player) => later(player === 'Anonyme' ? null : structuredClone(spiedProfile(player))),
  grantPremium: (id, on) => {
    const found = spiedProfile(id)
    found.premium.grant = on ? { at: new Date().toISOString(), by: 'Testeur' } : null
    return later('ok' as const)
  },
  setModerator: (id, on) => {
    const found = spiedProfile(id)
    found.moderator = on ? { since: new Date().toISOString(), super: false, lang: 'fr', invitedBy: 'Testeur' } : null
    return later('ok' as const)
  },
  load: (player, before, limit) =>
    player === 'Anonyme'
      ? later(null)
      : before === null
        ? later({ id: player, name: player, avatar: DEFAULT_AVATAR, runsCount: 95, best: 312, runs: STATS_HISTORY.slice(0, limit) })
        : olderStatsRuns(before, limit).then((runs) => runs && { id: player, name: player, avatar: DEFAULT_AVATAR, runsCount: 95, best: 312, runs }),
  recap: { ...STATS_RECAP, budget: { ...STATS_RECAP.budget, unlimited: true } },
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
const LEADERBOARD_SIZES: Record<StatId, number> = { best: 24, points: 60, runs: 5, words: 24, discoveries: 2, combo: 12, added: 0, moderation: 4 }

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
      { name: 'Léa', at: new Date(Date.now() - 3 * HOUR).toISOString(), runs: 12, best: 880, lang: 'fr' },
      { name: 'Hugo', at: new Date(Date.now() - 20 * HOUR).toISOString(), runs: 4, best: 410, lang: 'de' },
      { name: 'Inès', at: new Date(Date.now() - 70 * HOUR).toISOString(), runs: 31, best: 1_240, lang: 'es' },
    ],
    top_players: [
      { name: 'Inès', runs: 212, best: 1_240, anonymous: false, lang: 'es' },
      { name: 'Anonyme 3f2a', runs: 140, best: 760, anonymous: true, lang: 'en' },
      { name: 'Léa', runs: 96, best: 880, anonymous: false, lang: 'fr' },
    ],
    moderation: { votes: 420, submitted: 38, accepted: 21, rejected: 9 },
    challenges: { created: 41, avg_players: 2.7, played_share: 0.86 },
    invites: {
      mails: 23, mails_to_players: 4, mail_joins: 9, shares: 61, sharers: 27, link_joins: 14, played: 19,
      links_since: new Date(Date.now() - 12 * 24 * HOUR).toISOString(),
      daily: daily.map((row, index) => ({ day: row.day, mails: index % 3, shares: (index * 7) % 5, joins: index % 4 === 0 ? 2 : index % 5 === 0 ? 1 : 0 })),
      top: [
        { name: 'Inès', anonymous: false, lang: 'es', mails: 6, shares: 11, joins: 7, played: 6 },
        { name: 'Léa', anonymous: false, lang: 'fr', mails: 3, shares: 8, joins: 4, played: 3 },
        { name: 'Hugo', anonymous: false, lang: 'de', mails: 5, shares: 2, joins: 1, played: 1 },
        { name: 'Anonyme 3f2a', anonymous: true, lang: 'en', mails: 0, shares: 4, joins: 0, played: 0 },
      ],
    },
    moderation_by_lang: {
      days: 30,
      langs: [
        { lang: 'fr', moderators: 14, supers: 1, active: 9, thin: false, reserve_left: 62, reserve_released: 38, pending_add: 7, pending_ban: 2, sessions: 41, sessions_total: 230, votes: 512, added: 33, added_reserve: 12, added_total: 410, removed: 4, removed_total: 19, rejected: 11 },
        { lang: 'en', moderators: 3, supers: 0, active: 2, thin: true, reserve_left: 88, reserve_released: 12, pending_add: 4, pending_ban: 0, sessions: 6, sessions_total: 9, votes: 40, added: 8, added_reserve: 6, added_total: 8, removed: 0, removed_total: 0, rejected: 2 },
        { lang: 'de', moderators: 1, supers: 0, active: 0, thin: true, reserve_left: 100, reserve_released: 0, pending_add: 5, pending_ban: 0, sessions: 0, sessions_total: 1, votes: 0, added: 0, added_reserve: 0, added_total: 2, removed: 0, removed_total: 0, rejected: 0 },
        { lang: 'pt', moderators: 0, supers: 0, active: 0, thin: true, reserve_left: 100, reserve_released: 0, pending_add: 0, pending_ban: 0, sessions: 0, sessions_total: 0, votes: 0, added: 0, added_reserve: 0, added_total: 0, removed: 0, removed_total: 0, rejected: 0 },
      ],
    },
    usage: {
      features: [
        ['run_solo', 1_480, 160], ['power_used', 910, 84], ['category_chosen', 310, 120], ['run_challenge', 260, 66], ['power_equipped', 190, 58],
        ['theme', 24, 19], ['moderation_session', 41, 9], ['friend_request', 38, 25], ['challenge_created', 96, 51], ['invite_shared', 31, 14],
        ['category_ban', 18, 11], ['weekly_attempt', 140, 52], ['sound_changed', 22, 17], ['swap', 77, 36], ['friend_block', 2, 2],
      ].map(([name, n, u]) => {
        const k = Number(n)
        const users = Number(u)
        return {
          name: String(name),
          n1: Math.round(k / 30), u1: Math.min(users, Math.ceil(users / 6)),
          n7: Math.round(k / 4), u7: Math.min(users, Math.ceil(users / 2)),
          n14: Math.round(k / 2), u14: Math.min(users, Math.ceil(users * 0.75)),
          n30: k, u30: users,
        }
      }),
    },
    moderation_history: {
      sessions_daily: daily.flatMap((row, index) => [
        { day: row.day, lang: 'fr', n: 1 + ((index * 5) % 4) },
        ...(index % 3 === 0 ? [{ day: row.day, lang: 'en', n: 1 + (index % 2) }] : []),
        ...(index > 24 ? [{ day: row.day, lang: 'de', n: 1 }] : []),
      ]),
      sessions_today_hourly: [
        { hour: 9, lang: 'fr', n: 1 }, { hour: 12, lang: 'fr', n: 2 }, { hour: 12, lang: 'en', n: 1 }, { hour: 14, lang: 'fr', n: 1 },
      ],
      // Une réserve qui se vide au compte-goutte, et que l'ensemencement remplit d'un coup au milieu du mois.
      reserve_daily: daily.flatMap((row, index) => [
        { day: row.day, lang: 'fr', left: Math.max(40, 100 - index * 2) + (index > 18 ? 30 : 0) },
        { day: row.day, lang: 'en', left: 100 - Math.floor(index / 5) * 3 },
        { day: row.day, lang: 'de', left: 100 },
        { day: row.day, lang: 'pt', left: index < 12 ? 0 : 100 },
      ]),
    },
    revenue: {
      premium: {
        offers: 318, offer_devices: 96, activations: 27, subscribers: 41, refused: 3,
        reasons: [
          { reason: 'filter', n: 96, devices: 44 },
          { reason: 'reveal', n: 78, devices: 39 },
          { reason: 'attempt', n: 61, devices: 31 },
          { reason: 'menu', n: 43, devices: 29 },
          { reason: 'premiere', n: 40, devices: 26 },
        ],
        sources: [
          { source: 'buy', n: 18, devices: 18 },
          { source: 'win', n: 5, devices: 5 },
          { source: 'restore', n: 3, devices: 3 },
          { source: 'owned', n: 1, devices: 1 },
        ],
        providers: [{ provider: 'play', n: 17, accounts: 17 }, { provider: 'lemonsqueezy', n: 1, accounts: 1 }],
      },
      ads: {
        shown: 1_210, devices: 180, unavailable: 96,
        sources: [
          { source: 'reveal', n: 860, devices: 150, rewarded: 790, unavailable: 40 },
          { source: 'attempt', n: 372, devices: 88, rewarded: 330, unavailable: 42 },
          { source: 'offer', n: 74, devices: 41, rewarded: 0, unavailable: 14 },
        ],
        results: [
          { result: 'rewarded', n: 1_120 }, { result: 'shown', n: 60 }, { result: 'skipped', n: 30 }, { result: 'unavailable', n: 96 },
        ],
      },
      daily: daily.map((row, index) => ({
        day: row.day,
        offers: 8 + (index % 5),
        activations: index % 3,
        ads: 30 + (index % 9) * 3,
        subscribed: index % 4 === 0 ? 1 : 0,
      })),
    },
    by_platform: {
      rows: [
        { platform: 'android', runs: 1_910, tagged: 640, players: 118, runs_today: 64, players_today: 21, avg_score: 182, best: 1_240, new_accounts: 96, duels: 31, weekly_attempts: 210, weekly_players: 74 },
        { platform: 'crazygames', runs: 640, tagged: 640, players: 212, runs_today: 41, players_today: 30, avg_score: 121, best: 760, new_accounts: 58, duels: 0, weekly_attempts: 95, weekly_players: 61 },
        { platform: 'web', runs: 120, tagged: 40, players: 14, runs_today: 3, players_today: 2, avg_score: 204, best: 910, new_accounts: 6, duels: 2, weekly_attempts: 9, weekly_players: 4 },
        { platform: 'inconnu', runs: 48, tagged: 0, players: 11, runs_today: 0, players_today: 0, avg_score: 90, best: 445, new_accounts: 40, duels: 0, weekly_attempts: 0, weekly_players: 0 },
      ],
      daily: daily.flatMap((row, index) => [
        { day: row.day, platform: 'android' as const, runs: 40 + ((index * 13) % 35) },
        { day: row.day, platform: 'crazygames' as const, runs: index < 10 ? 0 : 12 + ((index * 7) % 30) },
        { day: row.day, platform: 'web' as const, runs: index % 3 },
        { day: row.day, platform: 'inconnu' as const, runs: index < 8 ? 4 : 0 },
      ]),
    },
    insights: {
      choices: {
        kinds: [
          { kind: 'category', n: 214, with_offer: 120, devices: 130 },
          { kind: 'power', n: 162, with_offer: 90, devices: 101 },
          { kind: 'bonus', n: 41, with_offer: 30, devices: 33 },
        ],
        items: [
          { kind: 'category', item: 'pays', offered: 70, chosen: 61, picked: 44, devices: 58 },
          { kind: 'category', item: 'animaux', offered: 66, chosen: 52, picked: 31, devices: 50 },
          { kind: 'category', item: 'capitales', offered: 64, chosen: 38, picked: 21, devices: 36 },
          { kind: 'category', item: 'fruits', offered: 40, chosen: 9, picked: 4, devices: 9 },
          { kind: 'power', item: 'joker', offered: 60, chosen: 58, picked: 39, devices: 55 },
          { kind: 'power', item: 'hush', offered: 58, chosen: 40, picked: 24, devices: 38 },
          { kind: 'power', item: 'magic', offered: 62, chosen: 30, picked: 18, devices: 29 },
          { kind: 'bonus', item: 'slot', offered: 22, chosen: 19, picked: 15, devices: 19 },
          { kind: 'bonus', item: 'reveal', offered: 26, chosen: 12, picked: 9, devices: 12 },
          { kind: 'bonus', item: 'filter', offered: 12, chosen: 6, picked: 3, devices: 6 },
          { kind: 'bonus', item: 'moderator', offered: 0, chosen: 4, picked: 0, devices: 4 },
        ],
      },
      split: daily.map((row) => ({ day: row.day, runs_new: Math.round(row.new_players * 2.5), players_new: row.new_players })),
      today_split: todayHourly.map((row) => ({ hour: row.hour, runs_new: row.new_players * 2, players_new: row.new_players })),
      sessions_by_platform: {
        totals: [
          { platform: 'android', total: 920, with_run: 700, runs_per_session: 2.6, median_seconds: 340 },
          { platform: 'crazygames', total: 380, with_run: 260, runs_per_session: 1.9, median_seconds: 210 },
          { platform: 'web', total: 120, with_run: 100, runs_per_session: 2.1, median_seconds: 280 },
        ],
        daily: daily.flatMap((row, index) => [
          { day: row.day, platform: 'android' as const, with_run: Math.round(row.sessions_with_run * 0.6), without_run: Math.round(row.sessions_without_run * 0.6) },
          { day: row.day, platform: 'crazygames' as const, with_run: index < 20 ? 0 : Math.round(row.sessions_with_run * 0.35), without_run: index < 20 ? 0 : Math.round(row.sessions_without_run * 0.5) },
          { day: row.day, platform: 'web' as const, with_run: Math.round(row.sessions_with_run * 0.05), without_run: 1 },
        ]),
        today_hourly: todayHourly.flatMap((row) => [
          { hour: row.hour, platform: 'android' as const, with_run: Math.round(row.sessions_with_run * 0.6), without_run: Math.round(row.sessions_without_run * 0.6) },
          { hour: row.hour, platform: 'crazygames' as const, with_run: Math.round(row.sessions_with_run * 0.4), without_run: Math.round(row.sessions_without_run * 0.4) },
        ]),
      },
      retention_curve: Array.from({ length: 30 }, (_, index) => {
        const day = index + 1
        const eligible = 160 - index * 3
        return { day, eligible, exact: Math.round(eligible * (0.38 / Math.sqrt(day))), rolling: Math.round(eligible * (0.62 - 0.012 * index)) }
      }),
      cohorts: Array.from({ length: 8 }, (_, index) => {
        const size = 24 + index * 5
        const open = 7 - index
        return {
          week: new Date(today.getTime() - (7 - index) * 7 * 24 * HOUR).toISOString().slice(0, 10),
          size,
          cells: Array.from({ length: 12 }, (_, w) =>
            w < open ? { eligible: size, back: Math.round(size * (0.55 / (1 + w * 0.45))) } : { eligible: 0, back: 0 },
          ),
        }
      }),
      stickiness: daily.map((row, index) => ({ day: row.day, dau: row.players, wau: Math.round(row.players * 2.6), mau: 140 + index * 2 })),
      retention_by: [
        { by: 'platform', value: 'android', size: 96, d1_eligible: 92, d1: 41, w1_eligible: 80, w1: 47, m1_eligible: 40, m1: 15 },
        { by: 'platform', value: 'crazygames', size: 140, d1_eligible: 135, d1: 22, w1_eligible: 120, w1: 30, m1_eligible: 30, m1: 3 },
        { by: 'platform', value: 'web', size: 12, d1_eligible: 12, d1: 4, w1_eligible: 10, w1: 5, m1_eligible: 6, m1: 2 },
        { by: 'lang', value: 'fr', size: 150, d1_eligible: 146, d1: 52, w1_eligible: 130, w1: 63, m1_eligible: 60, m1: 17 },
        { by: 'lang', value: 'en', size: 70, d1_eligible: 66, d1: 10, w1_eligible: 58, w1: 14, m1_eligible: 12, m1: 2 },
        { by: 'lang', value: 'de', size: 28, d1_eligible: 27, d1: 5, w1_eligible: 22, w1: 5, m1_eligible: 4, m1: 1 },
      ],
    },
    quality: {
      totals: {
        sessions: 1_420, error_sessions: 31, errors: 44, watched: 610, unclean: 9, ready_p50: 1_380, ready_p90: 3_900, ready_p99: 8_200,
        slow_starts: 22, measured: 590, frozen: 48, long_per_minute: 140, long_max_p90: 820,
      },
      since: { unclean: new Date(Date.now() - 4 * 24 * HOUR).toISOString(), freezes: new Date(Date.now() - 4 * 24 * HOUR).toISOString() },
      daily: daily.map((row, index) => ({
        day: row.day,
        sessions: row.sessions_with_run + row.sessions_without_run,
        error_sessions: index % 6 === 0 ? 4 : 1,
        errors: index % 6 === 0 ? 6 : 1,
        watched: index < 26 ? 0 : 20,
        unclean: index < 26 ? 0 : index % 2,
        measured: index < 26 ? 0 : 19,
        frozen: index < 26 ? 0 : 1 + (index % 3),
        ready_p50: 1_300 + ((index * 37) % 300),
        ready_p90: 3_400 + ((index * 91) % 900),
      })),
      by_version: [
        { platform: 'android', version: '1.9.0', sessions: 610, devices: 140, error_sessions: 8, watched: 590, unclean: 7, measured: 580, frozen: 40, ready_p50: 1_420, ready_p90: 4_100 },
        { platform: 'crazygames', version: '1.0.0', sessions: 380, devices: 260, error_sessions: 14, watched: 0, unclean: 0, measured: 0, frozen: 0, ready_p50: 2_100, ready_p90: 5_300 },
        { platform: 'android', version: '1.8.3', sessions: 300, devices: 70, error_sessions: 6, watched: 0, unclean: 0, measured: 0, frozen: 0, ready_p50: 1_510, ready_p90: 4_400 },
        { platform: 'web', version: '1.9.0', sessions: 120, devices: 30, error_sessions: 3, watched: 20, unclean: 2, measured: 10, frozen: 8, ready_p50: 900, ready_p90: 2_200 },
      ],
      errors: [
        { message: 'TypeError: Cannot read properties of undefined (reading \'rows\')', source: 'index-4f2a.js:1', screen: 'over', n: 19, devices: 8, sessions: 12, first: new Date(Date.now() - 20 * 24 * HOUR).toISOString(), last: new Date(Date.now() - 5 * HOUR).toISOString(), versions: ['android 1.9.0', 'android 1.8.3'] },
        { message: 'Load failed', source: 'promise', screen: 'home', n: 14, devices: 11, sessions: 13, first: new Date(Date.now() - 30 * HOUR).toISOString(), last: new Date(Date.now() - 2 * HOUR).toISOString(), versions: ['crazygames 1.0.0'] },
        { message: 'ResizeObserver loop completed with undelivered notifications.', source: ':0', screen: null, n: 11, devices: 6, sessions: 7, first: new Date(Date.now() - 12 * 24 * HOUR).toISOString(), last: new Date(Date.now() - 26 * HOUR).toISOString(), versions: ['web 1.9.0'] },
      ],
      screens: [{ screen: 'over', n: 19, devices: 8 }, { screen: 'home', n: 14, devices: 11 }, { screen: 'playing', n: 3, devices: 2 }],
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
      { key: 'device:9c1e', name: 'Appareil 9c1e', device: true as const, sessions_with_run: 0, sessions_without_run: 1, lang: 'en', platform: 'crazygames' },
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
  amended: [
    {
      word: 'ecureuil',
      category: 'animaux',
      display: 'Écureuil',
      old_display: 'Ecureuil',
      at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
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
    amended: kept(WORDS_REPORT.amended),
  }
}

function WordsScenario({ answer = 'report', superModerator = true }: { answer?: 'report' | 'error' | 'denied'; superModerator?: boolean }) {
  return (
    <div className="dashboard">
      <WordsBoardView
        lang="fr"
        load={(_lang, category) => later(answer === 'report' ? wordsReportOf(category) : answer, 300)}
        onBan={() => later('sent' as const)}
        onAdd={() => later(true)}
        onAddNow={() => later('added' as const)}
        onAmend={() => later('amended' as const)}
        superModerator={superModerator}
      />
    </div>
  )
}

/** Le réglage des fonctionnalités, avec deux lignes déjà réglées : rien n'est écrit sur le serveur. */
function FeaturesScenario() {
  const flags: Record<string, FlagRow> = {
    duel: { everyone: 'off', moderator: 'neutral', premium: 'on', superModerator: 'on' },
    moderation: { everyone: 'off', moderator: 'on', premium: 'neutral', superModerator: 'on' },
  }
  return (
    <div className="dashboard">
      <FeaturesBoardView
        load={() => later(flags, 300)}
        save={() => later('saved' as const, 400)}
        roles={{ moderator: true, superModerator: true, premium: false }}
      />
    </div>
  )
}

/** Les icônes à téléverser dans la Play Console, une par succès, sans marge ni animation. */
function AchievementIcons() {
  return (
    <div className="achievement-icons">
      {PLAY_ACHIEVEMENTS_ONLY.map((achievement) => (
        <div key={achievement.id} className="achievement-icon" data-achievement={achievement.id}>
          <Avatar choice={achievementIcon(achievement.id)} size="fill" />
        </div>
      ))}
    </div>
  )
}

/** Un profil d’exemple : des compteurs variés, une partie des succès déjà obtenus. */
const ACHIEVEMENTS_PROFILE: Profile = {
  ...NEW_PROFILE,
  xp: at(12, 40),
  runs: 30,
  wordsFound: 260,
  bestScore: 420,
  bestCombo: 12,
  wordsAdded: 3,
  longestWord: 12,
  bestSpeed: 27,
  cleanRuns: 3,
  powersUsed: ['joker', 'hush', 'dodge'],
  playedCategories: ['animaux', 'pays', 'capitales', 'metiers', 'fruits', 'sports'],
  duelRounds4: 22,
  dailyFirst: 1,
  wordsReviewed: 4,
}

function AchievementsScenario() {
  return (
    <div className="sheet cascade">
      <AchievementsPanel profile={ACHIEVEMENTS_PROFILE} discoveries={9} avatar={DEFAULT_AVATAR} />
    </div>
  )
}

function AvatarScenario() {
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR)
  return (
    <div className="sheet">
      <AvatarPanel profile={PROFILE} avatar={avatar} focus={18} onSave={setAvatar} />
    </div>
  )
}

function LeaderboardsScenario({ named, moderator = false, mineAt }: { named: boolean; moderator?: boolean; mineAt?: number }) {
  return (
    <div className="sheet">
      <LeaderboardsPage named={named} moderator={moderator} load={(stat, period) => fakeLeaderboard(stat, period, mineAt)} />
    </div>
  )
}

/** Un invité de CrazyGames : sa meilleure valeur glissée sur le tableau, ou sous lui à la 63e place. */
const GUEST_VALUES: Partial<Record<StatId, number>> = { best: 250, points: 20, runs: 3, words: 40, combo: 9 }

async function fakeGuestLeaderboard(stat: StatId, period: PeriodId): Promise<Leaderboard | null> {
  const board = await fakeLeaderboard(stat, period, -1)
  if (!board) return null
  const value = (GUEST_VALUES[stat] ?? 0) * (period === 'day' ? 1 : period === 'week' ? 4 : 20)
  const open = { rows: board.rows, me: null }
  return placeGuest(open, { name: 'Moi', avatar: DEFAULT_AVATAR, value }, guestFits(open, value) ? null : 63)
}

function GuestLeaderboardsScenario() {
  return (
    <div className="sheet">
      <LeaderboardsPage named={false} guest onSignIn={() => {}} load={fakeGuestLeaderboard} />
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

/**
 * Le vrai tiroir, ouvert sur le profil avec des tuiles d'avatar gagnées à
 * essayer : pastilles sur Profil, sur l'avatar et sur « Avatar et succès ».
 * L'éditeur quitté sans enregistrer pose la question, avant et après.
 */
function AvatarNewsScenario({ back }: { back(): void }) {
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR)
  const [news, setNews] = useState(true)
  return (
    <Menu
      page="profile"
      profile={PROFILE}
      history={[]}
      statsRecap={STATS_RECAP}
      avatar={avatar}
      avatarNews={news}
      onAvatarSeen={() => setNews(false)}
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
      onAvatarSave={setAvatar}
      discoveries={9}
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
      banActions={{ onBan: noop, onUnban: noop, onIntroSeen: noop }}
      onClose={back}
    />
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
      onAvatarSave={noop}
      discoveries={9}
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
      banActions={{ onBan: noop, onUnban: noop, onIntroSeen: noop }}
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
  moderatorOffer = false,
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
  /** L'offre de modérateur s'ouvre par-dessus le bilan, une fois le récap révélé, comme à l'écran de fin de partie. */
  moderatorOffer?: boolean
  onBack(): void
}) {
  const [profile, setProfile] = useState(after)
  const [revealed, setRevealed] = useState(false)
  const [summary, setSummary] = useState(false)
  const [offerOpen, setOfferOpen] = useState(moderatorOffer)
  const [proposals, setProposals] = useState(requests)
  return (
    <>
    {moderatorOffer && offerOpen && summary && offerModerator('level', () => setOfferOpen(false))(onBack)}
    <OverScreen
      onSummary={setSummary}
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
      onChooseBonus={(id) => setProfile((current) => chooseBonus(current, id))}
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
      onPeek={() => setProfile((current) => spendReveal(current, todayKey()))}
      onAd={() => setProfile((current) => grantRevealAd(current, todayKey()))}
      // Un signalement de mot ne s'écrit pas depuis la planche : la carte répond seule.
      onFlag={() => later('sent' as const)}
    />
    </>
  )
}

const HIDDEN: HiddenAnswer[] = [
  { prompt: { categoryId: 'pays', letter: 'K' }, display: 'kenya' },
  { prompt: { categoryId: 'animaux', letter: 'Z' }, display: 'zèbre' },
  { prompt: { categoryId: 'couleurs', letter: 'M' }, display: 'marron' },
  { prompt: { categoryId: 'animaux', letter: 'O' }, display: 'ours' },
]

/** « Mes catégories » à sept catégories : le filtrage s'y ouvre, sur un profil qui ne sort pas de la planche. */
function BansScenario({
  seen = false,
  plus = false,
  banned = [],
  every = false,
  bonuses = [],
}: {
  seen?: boolean
  plus?: boolean
  /** Déjà bannies à l'ouverture. */
  banned?: readonly string[]
  /** Tout le catalogue possédé, au lieu de sept catégories. */
  every?: boolean
  /** Les bonus de niveau déjà pris : sans « filter », le filtrage est verrouillé. */
  bonuses?: readonly string[]
}) {
  const [profile, setProfile] = useState<Profile>(() => ({
    ...PROFILE,
    unlocked: every
      ? CATALOGUE.map((category) => category.id).filter((id) => !['pays', 'animaux', 'couleurs'].includes(id))
      : ['fruits-legumes', 'metiers', 'sports', 'marques'],
    banIntroSeen: seen ? 1 : 0,
    plusSince: plus ? 1 : 0,
    banned,
    bonuses,
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

/** Le champ de la partie, dans les deux états qu'on ne voit qu'en jouant. */
function RunEffets(props: { run: Run; draft: string; live: Verdict | null; cheer: Cheer | null }) {
  return (
    <RunScreen
      run={props.run}
      draft={props.draft}
      live={props.live}
      cheer={props.cheer}
      remaining={32}
      hushed={false}
      next={null}
      proposed={[]}
      onType={noop}
      onSubmit={noop}
      onSkip={noop}
      onReroll={noop}
      onRecall={noop}
      onPropose={noop}
    />
  )
}

/** Le mot repris au Professeur : l'étoile s'allume une fois, sans rien changer au barème. */
function ProfessorWordScenario() {
  const run: Run = {
    ...makeRun(120, WORDS.slice(0, 3)),
    powers: ['professor'],
    prompt: { categoryId: 'animaux', letter: 'O' },
    taught: ['ornithorynque'],
  }
  const found = { ...run.found[1]!, taught: true }
  const cheer: Cheer = { display: found.display, points: found.points, tier: found.tier, approximate: false, edits: 0, joker: false, taught: true, boost: 1, auto: false }
  return <RunEffets run={run} draft={found.display} live={{ kind: 'accepted', found }} cheer={cheer} />
}

/** Le Joker reconnu à la frappe : son mot s'écrit d'un coup, la carte se retourne. */
function JokerWriteScenario() {
  const run: Run = {
    ...makeRun(64, WORDS.slice(0, 2)),
    powers: ['joker'],
    prompt: { categoryId: 'animaux', letter: 'L' },
    joker: { key: 'Lama', display: 'Lama' },
  }
  return <RunEffets run={run} draft="Lama" live={null} cheer={null} />
}

/** L'offre de modérateur : un seul rendu pour les trois raisons qui l'amènent. */
const offerModerator =
  (reason: 'level' | 'words' | 'friend' | 'bonus', onClosed?: () => void) =>
  (back: () => void): ReactNode => (
    <ModeratorOffer
      reason={reason}
      invitedBy={reason === 'friend' ? 'Léa' : null}
      anonymous={false}
      onAccount={onClosed ?? back}
      onAnswered={(accepted) => !accepted && (onClosed ?? back)()}
      onLater={onClosed ?? back}
      onModerate={onClosed ?? back}
      answerOffer={() => later(true)}
    />
  )

/** Ma place au duel : le salon la tire du profil, la planche l’invente. */
const DUEL_ME: Seat = { id: 'me', name: '', avatar: DEFAULT_AVATAR, bot: false, owned: 7, ready: false }

/**
 * Le draft vu par celui qui attend son tour : quatre catégories libres, quatre
 * conseils reçus — le plafond de trois écarte le plus ancien —, et c'est le
 * joueur ordinateur qui choisit. Les faits passent par la même règle que l'écran
 * (`activeCheers`), donc la planche montre ce que le jeu montrerait.
 */
const CHEER_TABLE: DuelTable = (() => {
  const categories = ['pays', 'animaux', 'couleurs', 'metiers', 'sports']
  const seats: readonly Seat[] = [
    DUEL_ME,
    { id: 'maxitoon', name: 'Maxitoon', avatar: HOUSE_BOTS[0]!.avatar, bot: true, trait: HOUSE_BOTS[0]!.trait, owned: 999, ready: true },
    { id: 'terretciel', name: 'Terretciel', avatar: HOUSE_BOTS[1]!.avatar, bot: true, trait: HOUSE_BOTS[1]!.trait, owned: 999, ready: true },
  ]
  const setup: DuelSetup = { seed: 9, playerIds: seats.map((seat) => seat.id), categories, owned: [7, 999, 999], startedAt: 0 }
  const duel = pickCategory(startDuel(setup), 'pays', 10)
  const at = 14
  const facts: DuelFact[] = [
    { id: 'cheer-1', kind: 'cheered', player: 0, at: 12.6, cheer: 'animaux' },
    { id: 'cheer-2', kind: 'cheered', player: 2, at: 13, cheer: 'couleurs' },
    { id: 'cheer-3', kind: 'cheered', player: 0, at: 13.4, cheer: 'metiers' },
    { id: 'cheer-4', kind: 'cheered', player: 2, at: 13.8, cheer: 'sports' },
  ]
  return {
    mode: 'local',
    phase: 'draft',
    at,
    seats,
    myIndex: 0,
    host: true,
    candidates: [],
    invite: noop,
    kick: noop,
    ready: {},
    markReady: noop,
    unready: noop,
    cancelStart: noop,
    draftLobby: false,
    showLobby: noop,
    hideLobby: noop,
    duel,
    judge: null,
    pool: categories,
    prompt: null,
    picker: seats[1]!,
    pickLeft: 6.4,
    forced: null,
    myTurn: false,
    myPickTurn: false,
    watching: false,
    event: null,
    feed: [],
    facts,
    cheers: activeCheers(facts, at),
    error: false,
    offline: false,
    joined: false,
    embedded: true,
    fallen: null,
    fallenAt: 0,
    openingAt: 0,
    drawnShown: 0,
    rematchOpen: false,
    leavers: [],
    openRematch: noop,
    joinRematch: noop,
    backToRecap: noop,
    inspect: () => ({ kind: 'empty', found: null }),
    hold: noop,
    pick: noop,
    cheer: noop,
    play: noop,
    pass: noop,
    leave: noop,
  }
})()

/** La fiche Premium : un achat factice qui réussit après une seconde, sans toucher au serveur. */
function PremiumSheetScenario({ reason, status, onBack }: { reason: PremiumReason; status?: PremiumStatus; onBack(): void }) {
  return (
    <PremiumSheet
      reason={reason}
      price="2,50 €"
      status={status}
      onBuy={() => new Promise((resolve) => setTimeout(() => resolve('ok'), 1000))}
      onRestore={() => Promise.resolve(true)}
      onClose={onBack}
    />
  )
}

/** Toute la grammaire du Premium sur une page : sceaux, icônes, compteurs, emplacement. */
function PremiumGrammarScenario({ onBack }: { onBack(): void }) {
  const states: readonly { state: ResourceState; unlimited?: boolean; label: string }[] = [
    { state: 'normal', label: 'normal' },
    { state: 'spent', label: 'épuisé' },
    { state: 'locked', label: 'verrouillé' },
    { state: 'normal', unlimited: true, label: 'Premium' },
  ]
  return (
    <div className="board-premium">
      <button type="button" className="btn btn--quiet" onClick={onBack}>
        ← Retour
      </button>
      <h2>Le sceau</h2>
      <div className="board-premium-row">
        <PlusSeal size="sm" />
        <PlusSeal size="md" />
        <PlusSeal size="lg" animated />
      </div>
      <h2>Icônes : normales, puis Premium</h2>
      <div className="board-premium-grid">
        {RESOURCE_ICONS.map((icon) => (
          <div key={icon} className="board-premium-cell">
            <ResourceGlyph icon={icon} />
            <ResourceGlyph icon={icon} plus />
            <span>{icon}</span>
          </div>
        ))}
      </div>
      <h2>Compteurs</h2>
      <div className="board-premium-grid">
        {(['eye', 'ticket', 'lock'] as const).map((icon) => (
          <div key={icon} className="board-premium-chips">
            {states.map((entry) => (
              <ResourceChip
                key={entry.label}
                icon={icon}
                count={entry.state === 'spent' ? 0 : 2}
                max={icon === 'eye' ? 8 : undefined}
                unlimited={entry.unlimited}
                state={entry.state}
                label={`${icon} ${entry.label}`}
              />
            ))}
          </div>
        ))}
      </div>
      <h2>Emplacements verrouillés</h2>
      <div className="board-premium-stack">
        <PlusLockedSlot icon="ticket" label="Tentative 4" hint="Réservée à Premium" onOpen={() => undefined} />
        <PlusLockedSlot icon="premiere" label="Ingrédients" hint="En avant-première" onOpen={() => undefined} />
        <PlusLockedSlot icon="eye" label="Révéler un mot de plus" onOpen={() => undefined} />
      </div>
    </div>
  )
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: 'premium-sheet',
    group: 'Premium',
    title: 'Fiche Premium',
    how: 'Ouverte par le filtrage : sa ligne en tête, un achat factice qui réussit après une seconde',
    phase: 'home',
    render: (back) => <PremiumSheetScenario reason="filter" onBack={back} />,
  },
  {
    id: 'premium-sheet-premiere',
    group: 'Premium',
    title: 'Fiche Premium : avant-première',
    how: 'Ouverte par une catégorie en avant-première',
    phase: 'home',
    render: (back) => <PremiumSheetScenario reason="premiere" onBack={back} />,
  },
  {
    id: 'premium-sheet-loading',
    group: 'Premium',
    title: 'Fiche Premium : achat en cours',
    how: 'Le magasin répond : le bouton tourne, rien ne se ferme',
    phase: 'home',
    render: (back) => <PremiumSheetScenario reason="menu" status="loading" onBack={back} />,
  },
  {
    id: 'premium-sheet-success',
    group: 'Premium',
    title: 'Fiche Premium : bienvenue',
    how: 'L’achat a réussi : sceau, gerbe de formes, accord de bienvenue',
    phase: 'home',
    render: (back) => <PremiumSheetScenario reason="menu" status="success" onBack={back} />,
  },
  {
    id: 'premium-sheet-error',
    group: 'Premium',
    title: 'Fiche Premium : échec',
    how: 'Le paiement a échoué : message et « Réessayer »',
    phase: 'home',
    render: (back) => <PremiumSheetScenario reason="reveal" status="error" onBack={back} />,
  },
  {
    id: 'premium-sheet-cancelled',
    group: 'Premium',
    title: 'Fiche Premium : annulé',
    how: 'Le joueur a fermé la fenêtre du magasin',
    phase: 'home',
    render: (back) => <PremiumSheetScenario reason="attempt" status="cancelled" onBack={back} />,
  },
  {
    id: 'premium-grammar',
    group: 'Premium',
    title: 'Grammaire Premium',
    how: 'Sceaux, icônes normales et Premium, compteurs dans chaque état, emplacements verrouillés (une tape joue l’accord)',
    phase: 'home',
    render: (back) => <PremiumGrammarScenario onBack={back} />,
  },
  {
    id: 'premium-news',
    group: 'Premium',
    title: 'Avant-premières livrées',
    how: 'Deux catégories nouvelles : la pop-up les annonce, et son bouton mène à « Mes catégories »',
    phase: 'home',
    render: (back) => <PlusNewsPop names="Ingrédients, Lieux et bâtiments" onOpen={back} onClose={back} />,
  },
  {
    id: 'weekly-home-card',
    group: 'Défi du moment',
    title: 'Carte de l’accueil',
    how: 'Le billet du jour, le même une fois joué, puis la seconde ouverte par une pub et les trois de Premium ; les trois modes',
    phase: 'home',
    render: (back) => <WeeklyCardScenario onBack={back} />,
  },
  {
    id: 'weekly-screen-fresh',
    group: 'Défi du moment',
    title: 'Écran du défi : rien de joué',
    how: 'Un billet plein : le bouton lance après confirmation, la pub et Premium ne s’offrent qu’une fois la tentative gratuite jouée',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario used={0} plus={false} onBack={back} />,
  },
  {
    id: 'weekly-screen-portal',
    group: 'Défi du moment',
    title: 'Écran du défi : CrazyGames',
    how: 'Sans serveur, pub ni boutique : un seul billet par jour, le record de l’appareil, ni rang ni classement',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario used={0} plus={false} portal onBack={back} />,
  },
  {
    id: 'weekly-screen-ad',
    group: 'Défi du moment',
    title: 'Écran du défi : la pub',
    how: 'La gratuite jouée : le bouton cède sa place à « Regarder une pub » (deuxième tentative), et Premium se propose sous lui',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario used={1} plus={false} onBack={back} />,
  },
  {
    id: 'weekly-screen-ad-third',
    group: 'Défi du moment',
    title: 'Écran du défi : la seconde pub',
    how: 'Deux tentatives jouées, une pub regardée : la troisième s’ouvre par une seconde pub, avec Premium sous le bouton',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario used={2} ads={1} plus={false} onBack={back} />,
  },
  {
    id: 'weekly-screen-spent',
    group: 'Défi du moment',
    title: 'Écran du défi : plus rien',
    how: 'Les deux pubs regardées et jouées : plus de tentative, seul Premium reste possible',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario used={3} ads={2} plus={false} onBack={back} />,
  },
  {
    id: 'weekly-screen-plus',
    group: 'Défi du moment',
    title: 'Écran du défi : Premium',
    how: 'Trois tentatives, une jouée, les deux autres directement jouables',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario used={1} plus onBack={back} />,
  },
  {
    id: 'weekly-tutorial-endurance',
    group: 'Défi du moment',
    title: 'Tutoriel de l’endurance',
    how: 'Le chrono qui se vide, ce que rend chaque rareté, le temps de survie',
    phase: 'home',
    render: (back) => <ModeIntro mode="endurance" onDone={back} />,
  },
  {
    id: 'weekly-run-endurance',
    group: 'Défi du moment',
    title: 'Partie en endurance',
    how: 'Le chrono en grand, +2 s qui s’anime à chaque mot, le temps de survie',
    phase: 'playing',
    render: () => <WeeklyRunScenario />,
  },
  {
    id: 'weekly-attempt-done',
    group: 'Défi du moment',
    title: 'Fin de tentative : record',
    how: 'Record battu, tentatives restantes, rang provisoire',
    phase: 'over',
    render: (back) => <WeeklyDoneScenario record onBack={back} />,
  },
  {
    id: 'weekly-results',
    group: 'Défi du moment',
    title: 'Résultats de la semaine',
    how: 'Soixante joueurs, podium, mon rang, huit trophées, réactions agrégées (sans serveur)',
    phase: 'home',
    render: (back) => <WeeklyResultsScenario closed={false} onBack={back} />,
  },
  {
    id: 'weekly-recap',
    group: 'Défi du moment',
    title: 'Récap de fin de défi',
    how: 'La courbe du record, le rang final, le trophée, « Le nouveau défi est ouvert »',
    phase: 'home',
    render: (back) => <WeeklyRecapScenario onBack={back} />,
  },
  {
    id: 'weekly-win-prize',
    group: 'Défi du moment',
    title: 'Premier du défi : Premium offert',
    how: 'Le récap clos sur un rang 1 : la pop-up offre Premium, sans rien écrire au serveur',
    phase: 'home',
    render: (back) => <PlusPrizePop onClose={back} />,
  },
  {
    id: 'power-loadout',
    group: 'Pouvoirs',
    title: 'Choix des pouvoirs avant la partie',
    how: 'Huit pouvoirs, deux emplacements : une touche prend ou repose, le troisième pris chasse le plus ancien ; Entrée joue, Échap revient',
    phase: 'home',
    render: (back) => <LoadoutScenario onBack={back} />,
  },
  {
    id: 'over-classic',
    group: 'Fin de partie',
    title: 'Classique, record battu',
    how: 'Record, mots rares, faute d’une lettre, demande de note',
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
    id: 'over-achievements',
    group: 'Fin de partie',
    title: 'Nouveaux succès au bilan',
    how: 'Quatre succès d’un coup, leur condition écrite à côté du nom : une tuile se montre telle quelle, une couleur seule (les mots longs) sur l’avatar porté, peint de cette couleur',
    phase: 'over',
    render: (back) => (
      <OverScenario
        before={{ ...PROFILE, runs: 9, bestCombo: 9, longestWord: 9 }}
        after={{ ...PROFILE, runs: 11, bestCombo: 12, longestWord: 15 }}
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
    how: 'Repliées sous un bouton ; quatre bandes à arracher, chacune à son rythme : trois révélations aujourd’hui (deux plus un bonus), le compteur œil les suit',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun({ ...PROFILE, bonuses: ['reveal'] }, RUN)} hidden={HIDDEN} onBack={back} />,
  },
  {
    id: 'over-hidden-spent',
    group: 'Fin de partie',
    title: 'Mots cachés : plus aucune du jour',
    how: 'Les révélations et les trois pubs du jour sont passées : un tap sur une bande ouvre l’offre Premium (plus rien à regarder), et la ligne garde « Révélations illimitées »',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun({ ...PROFILE, revealDay: todayKey(), revealsUsed: 5, revealAds: 3 }, RUN)} hidden={HIDDEN} onBack={back} />,
  },
  {
    id: 'reveal-spent-ads',
    group: 'Fin de partie',
    title: 'Mots cachés : épuisées, une pub possible',
    how: 'Les deux révélations du jour sont passées : un tap ouvre la petite pub — deux révélations d’un coup —, le suivant l’offre Premium, qui répond « voir une pub » ou « devenir Premium » ; sans pub (navigateur), elle se dit indisponible',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun({ ...PROFILE, revealDay: todayKey(), revealsUsed: 2 }, RUN)} hidden={HIDDEN} onBack={back} />,
  },
  {
    id: 'over-hidden-premium',
    group: 'Fin de partie',
    title: 'Mots cachés : Premium',
    how: 'Premium : toutes les bandes s’arrachent, sans compteur',
    phase: 'over',
    render: (back) => (
      <OverScenario after={afterRun({ ...PROFILE, plusSince: 1 }, RUN)} hidden={HIDDEN} onBack={back} />
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
    id: 'words-news-reveal',
    group: 'Mots proposés',
    title: 'Mots entrés au dictionnaire : une révélation par mot',
    how: 'Joueur gratuit : chaque mot accepté rapporte « +1 révélation », gardée en réserve ; elle ne se dépense qu’après les deux du jour',
    phase: 'home',
    render: (back) => (
      <WordsNewsPop
        reveal
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
    id: 'bonus-offer',
    group: 'Fin de partie',
    title: 'Bonus de niveau',
    how: 'Deux cartes (une révélation, un cadenas) après le déroulé : on en garde une pour toujours',
    phase: 'over',
    render: (back) => (
      <OverScenario
        before={BONUS_PROFILE}
        after={afterRun({ ...BONUS_PROFILE, bonusOffer: ['reveal', 'filter'] }, RUN)}
        onBack={back}
      />
    ),
  },
  {
    id: 'bonus-offer-moderator',
    group: 'Fin de partie',
    title: 'Bonus de niveau : carte de modérateur',
    how: 'Une carte de modérateur parmi les deux ; dans le jeu, la garder ouvre l’offre de modérer (compte nommé requis)',
    phase: 'over',
    render: (back) => (
      <OverScenario
        before={BONUS_PROFILE}
        after={afterRun({ ...BONUS_PROFILE, bonuses: ['filter'], bonusOffer: ['moderator', 'slot'] }, RUN)}
        onBack={back}
      />
    ),
  },
  {
    id: 'power-slots-locked',
    group: 'Accueil',
    title: 'Pouvoirs : second emplacement verrouillé',
    how: 'Un seul emplacement gagné : le second dit « Gagne-le en bonus de niveau » et n’ouvre rien',
    phase: 'home',
    render: () => (
      <div className="sheet">
        <PowerSlots profile={{ ...BONUS_PROFILE, equipped: ['joker'] }} disabled={false} onEquip={noop} />
      </div>
    ),
  },
  {
    id: 'categories-filter-locked',
    group: 'Accueil',
    title: 'Mes catégories : filtrage verrouillé',
    how: 'Aucun cadenas gagné : le filtrage dit comment en obtenir (bonus de niveau) et propose Premium',
    phase: 'home',
    render: () => <BansScenario seen every />,
  },
  {
    id: 'categories-filter-plus',
    group: 'Accueil',
    title: 'Mes catégories : filtrage Premium',
    how: 'Membre Premium : compteur de cadenas noir et jaune, avant-premières possédées et marquées',
    phase: 'home',
    render: () => <BansScenario seen plus every banned={['pays']} />,
  },
  {
    id: 'categories-premieres',
    group: 'Accueil',
    title: 'Mes catégories : avant-premières',
    how: 'Un cadenas gagné, sans Premium : Ingrédients et Lieux et bâtiments en emplacements pointillés qui ouvrent la fiche',
    phase: 'home',
    render: () => <BansScenario seen every bonuses={['filter']} />,
  },
  {
    id: 'premium-page',
    group: 'Accueil',
    title: 'Page Premium',
    how: 'Le merci d’un membre Premium : sceau, date, cinq compteurs qui montent',
    phase: 'home',
    render: () => (
      <div className="sheet">
        <PremiumPage
          profile={{
            ...PROFILE,
            plusSince: Date.now() - 40 * 24 * HOUR,
            plusStats: { reveals: 37, attempts: 12, filterRuns: 58, premiereRuns: 21, adsSkipped: 49 },
          }}
        />
      </div>
    ),
  },
  {
    id: 'premium-page-fresh',
    group: 'Accueil',
    title: 'Page Premium : tout neuf',
    how: 'Un Premium du jour même : tous les compteurs à zéro, et la phrase qui dit qu’ils se rempliront',
    phase: 'home',
    render: () => (
      <div className="sheet">
        <PremiumPage profile={{ ...PROFILE, plusSince: Date.now() }} />
      </div>
    ),
  },
  {
    id: 'challenge-powers',
    group: 'Défi entre amis',
    title: 'Choix des pouvoirs avant un défi',
    how: 'Plus de deux pouvoirs admis',
    phase: 'home',
    render: (back) => (
      <ChallengePowers allowed={['joker', 'dodge', 'hush', 'divination', 'chatter']} initial={['joker', 'dodge']} slots={2} onStart={back} onClose={back} />
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
    id: 'moderator-over-debrief',
    group: 'Modération',
    title: 'Offre de modérateur : par-dessus le bilan',
    how: 'Après le récap des mots, au bilan lui-même (jamais sur les offres de catégorie ou de pouvoir) : « Plus tard » ou « Non merci » rend le bilan',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} moderatorOffer onBack={back} />,
  },
  {
    id: 'moderator-bonus',
    group: 'Modération',
    title: 'Offre de modérateur : carte gagnée en bonus',
    how: 'La carte prise à un niveau bonus : accepter montre l’accueil, sans rien écrire sur le serveur',
    phase: 'home',
    render: offerModerator('bonus'),
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
    id: 'home-multiplayer',
    group: 'Accueil',
    title: 'Multijoueur sous « Jouer »',
    how: 'Le second appel de l’accueil, sa pastille tant qu’aucune partie à plusieurs n’a été lancée',
    phase: 'home',
    render: (back) => <DebugHome back={back} challenges={[summaryOf(challenge('to-play'))]} multiplayerNews />,
  },
  {
    id: 'leaderboards',
    group: 'Accueil',
    title: 'Page des classements',
    how: 'Huit mesures, jour / semaine / total : « Points » dépasse cinquante (ta place en bas), « Mots ajoutés » vide, « Série » semaine hors ligne, « Sessions de modération » en dernier (modérateur)',
    phase: 'home',
    render: () => <LeaderboardsScenario named moderator />,
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
    id: 'leaderboards-guest',
    group: 'Accueil',
    title: 'Page des classements, invité de CrazyGames',
    how: 'Sans compte : le classement du serveur avec la ligne « Moi » comptée sur l’appareil — parmi les lignes en « Meilleure partie », sous elles à la 63e place en « Points », absente en « Découvertes » — et le bouton qui ouvre la connexion du portail',
    phase: 'home',
    render: () => <GuestLeaderboardsScenario />,
  },
  {
    id: 'leaderboards-advanced',
    group: 'Accueil',
    title: 'Tableau de bord de l’administrateur',
    how: 'Cinq tapes sur « Classements » : joueurs, actifs, parties, sessions de modération, fonctions utilisées (dont celles que personne n’utilise), rétention, choix de niveau, réserve de modération, qualité — le relevé d’analytics_snapshot',
    phase: 'home',
    render: () => <AdvancedScenario />,
  },
  {
    id: 'features-board',
    group: 'Accueil',
    title: 'Réglage des fonctionnalités',
    how: `Options d’un super modérateur, « Fonctionnalités » : ${FEATURES.length} fonctionnalités, quatre publics, une case qu’on touche pour la faire tourner dispo → bloqué → neutre`,
    phase: 'home',
    render: () => <FeaturesScenario />,
  },
  {
    id: 'play-together',
    group: 'Duel',
    title: 'Choix : duel en direct ou défi 24h',
    how: 'Le bouton « Créer un défi » quand le duel est ouvert au joueur',
    phase: 'home',
    render: (back) => <PlayTogether challenge onClose={back} onDuel={back} onMatch={back} onChallenge={back} />,
  },
  {
    id: 'duel-invite',
    group: 'Duel',
    title: 'Invitation à une table, sur l’accueil',
    how: 'Un ami a invité le joueur à sa table de duel',
    phase: 'home',
    render: (back) => (
      <div className="stage stage--home">
        <div className="sheet">
          <DuelInviteCard host="Maxitoon" avatar={{ design: 47, ground: 'vert', shape: 'creme', accent: 'rose' }} players={3} onJoin={back} onDecline={back} />
        </div>
      </div>
    ),
  },
  {
    id: 'duel-kicked',
    group: 'Duel',
    title: 'Retiré de la table',
    how: 'L’hôte a expulsé le joueur du salon : l’accueil le lui dit',
    phase: 'home',
    render: (back) => <DuelBanner text="L’hôte t’a retiré de la table." onDone={back} />,
  },
  {
    id: 'duel-matchmaking',
    group: 'Duel',
    title: 'Matchmaking : recherche d’un adversaire',
    how: 'Après « Trouver un adversaire » : la file, relue toutes les deux secondes ; les joueurs ordinateur s’offrent au bout de quinze secondes ; ici la file ne répond jamais',
    phase: 'home',
    render: (back) => <DuelMatchmaking lang="fr" onMatched={back} onCancel={back} onBots={back} ask={async () => ({ status: 'waiting' })} leave={async () => true} />,
  },
  {
    id: 'duel-table',
    group: 'Duel',
    title: 'Table contre les joueurs ordinateur',
    how: 'Une table locale, sans serveur : salon, expulsion par appui long, draft, ouvreur, partie, morts, bilan, revanche',
    phase: 'home',
    render: () => <DuelScreen lang="fr" mode="local" />,
  },
  {
    id: 'duel-cheer',
    group: 'Duel',
    title: 'Conseils pendant le draft',
    how: 'Quatre conseils reçus pendant le tour d’un autre : trois icônes frémissent, les tuiles s’entourent, le plus ancien est écarté par le plafond ; toucher une catégorie conseille à son tour',
    phase: 'duel',
    render: () => <Draft table={CHEER_TABLE} />,
  },
  {
    id: 'words-board',
    group: 'Accueil',
    title: 'Tableau des mots du dictionnaire',
    how: 'Cinq tapes sur « Mes catégories » : ce que le tirage donne à chaque couple lettre + catégorie, théorique et réel, les mots écrits, ajoutés, retirés, corrigés, en modération ; appui long sur une ligne pour signaler un mot, bouton pour en proposer un. Vu en super modérateur : « Ajouter d’office » et « Corriger » (une catégorie choisie) décident sans vote, envoi simulé',
    phase: 'home',
    render: () => <WordsScenario />,
  },
  {
    id: 'words-board-failed',
    group: 'Accueil',
    title: 'Tableau des mots : le serveur ne répond pas',
    how: 'Le relevé n’est pas venu (limite de temps, erreur serveur) : le message et « Réessayer » au lieu d’une lecture sans fin',
    phase: 'home',
    render: () => <WordsScenario answer="error" />,
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
    id: 'achievements',
    group: 'Accueil',
    title: 'Écran des succès',
    how: 'Les succès en trois familles : barres de couleur pour les statistiques, tuiles-icônes pour les défis, marque Play Games sur les quinze publiés, un profil d’exemple avec une partie d’entre eux obtenus',
    phase: 'home',
    render: () => <AchievementsScenario />,
  },
  {
    id: 'avatar-editor',
    group: 'Accueil',
    title: 'Éditeur d’avatar',
    how: 'Les tuiles gagnées, dont celles que l’éditeur n’a pas encore montrées : « nouveau » s’éteint au toucher, et le design touché au bilan est secoué',
    phase: 'home',
    render: () => <AvatarScenario />,
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
    id: 'rating-pop',
    group: 'Accueil',
    title: 'Demande de 5 étoiles',
    how: 'Au retour d’une partie, après la dixième puis vingt après « Plus tard »',
    phase: 'home',
    render: (back) => <RatingPop onLater={back} onRate={back} />,
  },
  {
    id: 'home-avatar-news',
    group: 'Accueil',
    title: 'Pastille d’avatar sur le menu',
    how: 'Première tuile d’avatar gagnée avant toute ouverture de l’éditeur, puis trois de plus depuis la dernière',
    phase: 'home',
    render: (back) => <DebugHome back={back} avatarNews />,
  },
  {
    id: 'menu-avatar-news',
    group: 'Accueil',
    title: 'Pastilles d’avatar dans le tiroir',
    how: 'Tuiles gagnées à essayer : Profil, l’avatar et « Avatar et succès » ; ouvrir l’éditeur les éteint',
    phase: 'home',
    render: (back) => <AvatarNewsScenario back={back} />,
  },
  {
    id: 'avatar-keep',
    group: 'Accueil',
    title: 'Garder ce nouvel avatar ?',
    how: 'Quitter l’éditeur d’avatar avec un avatar composé mais pas enregistré',
    phase: 'home',
    render: (back) => (
      <AvatarKeepPop before={DEFAULT_AVATAR} after={avatarOf(33, 'vert', 'creme', 'bleu')} onKeep={back} onDrop={back} onStay={back} />
    ),
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
    id: 'spy-history',
    group: 'Accueil',
    title: 'Espionner l’historique d’un joueur',
    how: 'Super modérateur : « Espionner l’historique » sur la fiche d’un joueur, ou une tape sur un nom du tableau de bord — sa fiche (compte, plateformes, Premium, pouvoirs, rythme), « Offrir Premium » et « Nommer modérateur » confirmés, puis ses parties et leur récap',
    phase: 'home',
    render: () => <SpyHistory player="Léa" name="Léa" actions={SPY_ACTIONS} onClose={noop} />,
  },
  {
    id: 'spy-profile-bought',
    group: 'Accueil',
    title: 'Espionner un modérateur qui a payé',
    how: 'Achat Google Play : « Reprendre Premium » grisé avec son explication ; modérateur avec ses votes et sessions, « Retirer le rôle de modérateur » confirmé',
    phase: 'home',
    render: () => <SpyHistory player="Bastien" name="Bastien" actions={SPY_ACTIONS} onClose={noop} />,
  },
  {
    id: 'categories-ban',
    group: 'Accueil',
    title: 'Mes catégories : bannir',
    how: 'Septième catégorie : explication à l’ouverture, un ban gratuit, par le bouton ou d’un glissement de la ligne',
    phase: 'home',
    render: () => <BansScenario bonuses={['filter']} />,
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
    title: 'Mes catégories : six filtres au plus',
    how: 'Premium, tout le catalogue, six filtrées : une septième est refusée ; glisser une ligne la rétablit',
    phase: 'home',
    render: () => <BansScenario seen plus every banned={['pays', 'animaux', 'couleurs', 'sports', 'marques', 'prenoms']} />,
  },
  {
    id: 'premium-thanks',
    group: 'Accueil',
    title: 'Merci d’être Premium',
    how: 'Premier retour à l’accueil après l’achat : le merci et ce que Premium ouvre, sans rien demander',
    phase: 'home',
    render: (back) => <PlusThanksPop onClose={back} />,
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
  {
    id: 'game-modes',
    group: 'Accueil',
    title: 'Les modes de jeu, derrière « Jouer »',
    how: 'La réserve : le solo normal et les trois modes qui se jouent sans pouvoir',
    phase: 'home',
    render: (back) => <GameModes onPick={back} onClose={back} />,
  },
  {
    id: 'mode-delay',
    group: 'Accueil',
    title: 'Leçon du mode retard',
    how: 'La leçon d’une règle : on valide la question A à vide, puis on répond à A sous la question B',
    phase: 'playing',
    render: (back) => <ModeTutorial mode="delayed" lang="fr" onDone={back} />,
  },
  {
    id: 'mode-endurance',
    group: 'Accueil',
    title: 'Leçon du mode endurance',
    how: 'Une seule question : la couleur tapée rend de deux à quatre secondes',
    phase: 'playing',
    render: (back) => <ModeTutorial mode="endurance" lang="fr" onDone={back} />,
  },
  {
    id: 'mode-reversed',
    group: 'Accueil',
    title: 'Leçon du mode renversé',
    how: 'La lettre contraint la fin : la couleur tapée doit finir par elle',
    phase: 'playing',
    render: (back) => <ModeTutorial mode="reversed" lang="fr" onDone={back} />,
  },
  {
    id: 'duel-rules',
    group: 'Duel',
    title: 'Règles du duel, au premier lancement',
    how: 'La partie de duel accélérée que joue la page avant son salon : les places, le draft, le tirage de l’ouvreur, puis la table jusqu’au gagnant, en boucle',
    phase: 'duel',
    render: (back) => <DuelTutorial me={DUEL_ME} onDone={back} />,
  },
  {
    id: 'run-professor-word',
    group: 'Partie',
    title: 'Le mot du Professeur',
    how: 'Le mot écrit avait été proposé à la partie précédente : l’étoile s’allume dessus, une fois',
    phase: 'playing',
    render: () => <ProfessorWordScenario />,
  },
  {
    id: 'run-joker-write',
    group: 'Partie',
    title: 'Le Joker écrit son mot',
    how: '« Joker » reconnu à la frappe : le mot s’écrit d’un coup dans le champ, la carte se retourne',
    phase: 'playing',
    render: () => <JokerWriteScenario />,
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
  avatarNews = false,
  waiting = false,
  challenges = null,
  multiplayerNews = false,
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
  /** Des tuiles d'avatar gagnées à essayer : la pastille du menu, sans demande d'ami. */
  avatarNews?: boolean
  /** Des défis en cours : le second appel de l'accueil, sous « Jouer ». */
  challenges?: readonly ChallengeSummary[] | null
  /** Sa pastille, tant qu'aucune partie à plusieurs n'a été lancée. */
  multiplayerNews?: boolean
}) {
  // Un profil à trois choix faits : huit catégories, la dernière tuile de
  // l'accueil est ouverte elle aussi.
  return (
    <HomeScreen
      profile={newcomer ? NEW_PROFILE : { ...PROFILE, powers: ['joker', 'hush'], equipped: ['joker'], unlocked: [...PROFILE.unlocked, 'sports'] }}
      error={error ? 'Le dictionnaire n’a pas pu être chargé.' : null}
      loading={false}
      settled={!waiting}
      boards={boards}
      me={newcomer ? null : 'Testeur'}
      climbed={climbed}
      avatar={DEFAULT_AVATAR}
      requestsNews={error || newcomer ? 0 : 3}
      requestsMade={!newcomer}
      categoriesNews={categoriesNews}
      avatarNews={avatarNews}
      friendRequests={error || newcomer || avatarNews ? 0 : 2}
      challenges={challenges}
      multiplayerNews={multiplayerNews}
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
  // La fiche Premium, ouverte par n'importe quelle porte des écrans montrés : un achat factice.
  const [sheet, setSheet] = useState<PremiumReason | null>(null)
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
          <PremiumContext.Provider value={{ storeOpen: true, adsOpen: true, open: setSheet }}>
            <div key={`${open.id}:${take}`} className="debug-scene">
              {open.render(() => setOpen(null))}
            </div>
            {sheet && <PremiumSheetScenario reason={sheet} onBack={() => setSheet(null)} />}
          </PremiumContext.Provider>
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
