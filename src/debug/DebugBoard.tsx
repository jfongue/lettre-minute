import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_AVATAR, type AvatarChoice } from '../domain/avatar'
import type { ChallengeWord } from '../domain/challenge'
import { choosePower } from '../domain/powers'
import { chooseBonus } from '../domain/bonus'
import { NEW_PROFILE, xpForLevel, type Profile } from '../domain/progression'
import type { PlayedWord, RunRecord } from '../domain/history'
import type { RarityTier } from '../domain/rarity'
import type { KeptWord, Run, Verdict } from '../domain/run'
import { chooseCategory } from '../domain/unlocks'
import type { Account, ChallengeDetail, ChallengePlayer, ChallengeSummary, ModerationStatus, ProfileReview, ReviewCard, SpiedProfile, Submission, SubmissionStatus } from '../lib/cloud'
import type { ModeratorOfferReason } from '../domain/moderation'
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
import { ProfileReviewScreen } from '../ui/ProfileReviewScreen'
import { RequestsPage } from '../ui/RequestsPage'
import { OverScreen, type RunProposal } from '../ui/OverScreen'
import { RunScreen } from '../ui/RunScreen'
import type { Cheer } from '../state/session'
import { PlayerActionsContext, type PlayerActions } from '../ui/PlayerSheet'
import { SpyHistory, type SpyActions } from '../ui/SpyHistory'
import { GameModes } from '../ui/GameModes'
import { ModeTutorial } from '../ui/ModeTutorial'
import { TutorialScreen } from '../ui/TutorialScreen'
import { ScreenBoundary } from '../ui/ScreenBoundary'
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
import { WordsBoardView } from './WordsBoard'
import type { WordsReport } from './words'
import { PLAY_ACHIEVEMENTS_ONLY, achievementIcon } from '../domain/achievements'
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
import { DuelScreen, Draft, Lobby, Over } from '../ui/DuelScreen'
import { AwayScenario, BotsWhileQueueScenario, FlowFoundScenario, FlowOverScenario, FlowPlayScenario, FlowSearchScenario, LadderScenario, MatchFoundScenario, MatchmakingScenario, QueuePillScenario, RankedOverScenario, ResumeScenario } from './rankedScenarios'
import { DuelBanner, DuelInviteCard, PlayTogether } from '../ui/PlayTogether'
import { FEATURES, type FlagRow } from '../domain/features'
import type { AdminIdea } from '../lib/cloud'
import { DuelTutorial } from '../ui/DuelTutorial'
import { DUEL_XP_BONUS, pickCategory, type Duel, type DuelPlayer } from '../domain/duel'
import { startDuel, type DuelFact, type DuelSetup } from '../domain/duelLog'
import { activeCheers, HOUSE_BOTS, type DuelPayout, type DuelTable, type Seat } from '../state/duel'
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
    letterFreed: false,
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
  budget: { left: 2, allowed: 2, adsLeft: Infinity, unlimited: false },
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
    platforms: [
      { platform: 'android', runs: 81, last: daysAgo(0.2) },
      { platform: 'web', runs: 14, last: daysAgo(12) },
    ],
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
    reasons: [{ verdict: 'correct', note: 'Ce n’est pas un animal : c’est le nom d’un genre de passereaux.' }],
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
    reasons: [],
  },
]

function ModerationQueueScenario({ onBack }: { onBack(): void }) {
  return <ModerationScreen lang="fr" queue={MODERATION_QUEUE} onDone={onBack} />
}

/** Deux mots que d'autres modérateurs ont déjà jugés en laissant leur raison (0116). */
const REASONED_QUEUE: readonly ReviewCard[] = [
  {
    id: 'add-reasons',
    categoryId: 'animaux',
    kind: 'add',
    display: 'Licorne',
    proposals: 4,
    special: false,
    note: null,
    canRespell: false,
    friends: [],
    reasons: [
      { verdict: 'incorrect', note: 'Animal imaginaire, il n’existe pas.' },
      { verdict: 'correct', note: 'Le narval est surnommé licorne des mers.' },
    ],
  },
  {
    id: 'ban-reasons',
    categoryId: 'pays',
    kind: 'ban',
    display: 'Yougoslavie',
    proposals: 2,
    special: false,
    note: 'Ce pays n’existe plus depuis 2003.',
    canRespell: false,
    friends: [],
    reasons: [
      { verdict: 'correct', note: 'Ce pays n’existe plus depuis 2003.' },
      { verdict: 'incorrect', note: 'Les joueurs le connaissent, on peut le garder.' },
    ],
  },
]

/** Les profils qu'un super modérateur juge : un banni d'office, un joueur dans le doute. */
const PROFILE_QUEUE: readonly ProfileReview[] = [
  {
    id: 'profile-auto',
    name: 'Spammeur42',
    banned: true,
    accepted: 1,
    rejected: 16,
    pending: 0,
    words: [
      { display: 'Azerty', lang: 'fr', categoryId: 'animaux', status: 'rejected', at: Date.now(), reasons: ['Pas un animal.', 'Ce sont les lettres du clavier.'] },
      { display: 'Qsdf', lang: 'fr', categoryId: 'pays', status: 'rejected', at: Date.now(), reasons: [] },
      { display: 'Chat', lang: 'fr', categoryId: 'animaux', status: 'accepted', at: Date.now() - 1 * 86_400_000, reasons: [] },
      { display: 'Lolilol', lang: 'fr', categoryId: 'metiers', status: 'rejected', at: Date.now() - 1 * 86_400_000, reasons: ['Mot inventé.'] },
    ],
  },
  {
    id: 'profile-doubt',
    name: 'Camille',
    banned: false,
    accepted: 6,
    rejected: 7,
    pending: 2,
    words: [
      { display: 'Doudou', lang: 'fr', categoryId: 'objets', status: 'pending', at: Date.now(), reasons: [] },
      { display: 'Pokémon', lang: 'fr', categoryId: 'animaux', status: 'rejected', at: Date.now() - 1 * 86_400_000, reasons: ['Personnage de jeu vidéo, pas un animal.'] },
      { display: 'Ouistiti', lang: 'fr', categoryId: 'animaux', status: 'accepted', at: Date.now() - 2 * 86_400_000, reasons: [] },
      { display: 'Kebabier', lang: 'fr', categoryId: 'metiers', status: 'rejected', at: Date.now() - 3 * 86_400_000, reasons: ['Pas dans le dictionnaire.'] },
    ],
  },
]

const GUARDED_STATUS: ModerationStatus = {
  moderator: true,
  super: true,
  validated: 12,
  queue: 7,
  sessions: 14,
  offer: null,
  invitedBy: null,
  topUp: false,
  news: 0,
  score: 87,
  judged: 64,
  profiles: 2,
  banned: false,
}

/** « Mes demandes » : score d'exigence, session et profils à juger ; ou un joueur banni. */
function GuardedRequestsScenario({ status }: { status: ModerationStatus }) {
  return (
    <div className="sheet">
      <RequestsPage moderation={status} onModerate={noop} onProfiles={noop} onSeen={noop} onOpen={noop} />
    </div>
  )
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
      onFreeLetter={noop}
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

/** Magie touchée : la lettre devient une étoile, et un pays d'une autre initiale passe. */
function MagicFreedScenario() {
  const run: Run = {
    ...makeRun(64, WORDS.slice(0, 2)),
    powers: ['magic'],
    charges: { magic: 2 },
    usedPowers: ['magic'],
    prompt: { categoryId: 'pays', letter: 'Q' },
    letterFreed: true,
  }
  const found = { ...run.found[0]!, prompt: run.prompt, word: 'bresil', display: 'Brésil' }
  return <RunEffets run={run} draft="Brésil" live={{ kind: 'accepted', found }} cheer={null} />
}

/** L'offre de modérateur : un seul rendu pour les trois raisons qui l'amènent. */
const offerModerator =
  (reason: ModeratorOfferReason, onClosed?: () => void) =>
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
    isPublic: false,
    canPublish: false,
    setPublic: noop,
    payout: null,
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
    kept: false,
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
    ranked: false,
    rating: null,
    away: [],
    echoes: true,
    echoesLeft: 3,
    echo: noop,
  }
})()

/**
 * Un salon en ligne ouvert au public : l'hôte, un inconnu que la file du
 * matchmaking vient d'asseoir — prêt tout seul, comme un appariement — et un
 * joueur ordinateur. L'interrupteur bascule pour de vrai, sans serveur.
 */
function PublicLobbyScenario() {
  const [open, setOpen] = useState(true)
  const seats: readonly Seat[] = [
    { ...DUEL_ME, name: 'Jérémy' },
    { id: 'ondine', name: 'Ondine', avatar: { design: 21, ground: 'bleu', shape: 'jaune', accent: 'rouge' }, bot: false, owned: 9, ready: true },
    { id: 'maxitoon', name: 'Maxitoon', avatar: HOUSE_BOTS[0]!.avatar, bot: true, trait: HOUSE_BOTS[0]!.trait, owned: 999, ready: true },
  ]
  const table: DuelTable = {
    ...CHEER_TABLE,
    mode: 'online',
    phase: 'lobby',
    seats,
    myIndex: 0,
    host: true,
    duel: null,
    picker: null,
    candidates: [
      { id: 'terretciel', name: 'Terretciel', avatar: HOUSE_BOTS[1]!.avatar, bot: true, trait: HOUSE_BOTS[1]!.trait },
      { id: 'lucie', name: 'Lucie', avatar: { design: 5, ground: 'rose', shape: 'vert', accent: 'creme' }, bot: false },
    ],
    ready: { me: false, ondine: true, maxitoon: true },
    isPublic: open,
    canPublish: true,
    setPublic: setOpen,
    embedded: true,
  }
  return <Lobby table={table} onRules={noop} />
}

/** Un mot gardé par un joueur du duel : ce que le bilan lit, sans dictionnaire. */
function duelWord(display: string, categoryId: string, points: number, tier: KeptWord['tier'], rarity: number): KeptWord {
  return {
    prompt: { categoryId, letter: display.charAt(0) },
    word: display.toLowerCase(),
    display,
    points,
    rarity,
    tier,
    approximate: false,
    edits: 0,
    joker: false,
    taught: false,
    boost: 1,
    seconds: 4,
    at: 0,
  }
}

/**
 * La fin d'un duel en ligne contre un vrai joueur : le classement, puis l'XP
 * qu'il paie — les points des mots trouvés et le forfait —, qui franchit un
 * niveau et fait tomber un succès. L'offre du niveau attend la partie seule.
 */
const DUEL_OVER_TABLE: DuelTable = (() => {
  const seats: readonly Seat[] = [
    { ...DUEL_ME, name: 'Jérémy' },
    { id: 'ondine', name: 'Ondine', avatar: { design: 21, ground: 'bleu', shape: 'jaune', accent: 'rouge' }, bot: false, owned: 9, ready: true },
    { id: 'maxitoon', name: 'Maxitoon', avatar: HOUSE_BOTS[0]!.avatar, bot: true, trait: HOUSE_BOTS[0]!.trait, owned: 999, ready: true },
  ]
  const words: KeptWord[] = [
    duelWord('Ornithorynque', 'animaux', 92, 'très rare', 0.94),
    duelWord('Bhoutan', 'pays', 64, 'rare', 0.81),
    duelWord('Vermillon', 'couleurs', 38, 'peu commun', 0.55),
    duelWord('Chat', 'animaux', 10, 'courant', 0.1),
  ]
  const player = (id: string, alive: boolean, kept: KeptWord[]): DuelPlayer => ({
    id,
    reserve: alive ? 12 : 0,
    alive,
    words: kept,
    used: kept.map((word) => word.word),
    score: kept.reduce((sum, word) => sum + word.points, 0),
    combo: 0,
  })
  const duel: Duel = {
    seed: 4,
    categories: ['animaux', 'pays', 'couleurs', 'metiers', 'sports'],
    picks: ['animaux', 'pays', 'couleurs', 'metiers', 'sports'],
    order: [0, 1, 2],
    pickSince: 0,
    draftedAt: 0,
    opener: 1,
    dealt: Array.from({ length: 11 }, (_, index) => `animaux:${'ABCDEFGHIJK'[index]}`),
    turns: 24,
    phase: 'over',
    players: [
      player('me', true, words),
      player('ondine', false, [duelWord('Canada', 'pays', 12, 'courant', 0.2), duelWord('Lama', 'animaux', 14, 'peu commun', 0.4)]),
      player('maxitoon', false, [duelWord('Rouge', 'couleurs', 10, 'courant', 0.05)]),
    ],
    turn: null,
    deaths: [2, 1],
  }
  const points = words.reduce((sum, word) => sum + word.points, 0)
  const before: Profile = { ...NEW_PROFILE, xp: xpForLevel(4) - 120 }
  const payout: DuelPayout = { xp: points + DUEL_XP_BONUS, words: words.length, points, before, after: { ...before, xp: before.xp + points + DUEL_XP_BONUS } }
  return { ...CHEER_TABLE, mode: 'online', phase: 'over', seats, myIndex: 0, duel, picker: null, payout, rematchOpen: false }
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
        <PlusLockedSlot icon="eye" label="Révéler un mot de plus" onOpen={() => undefined} />
      </div>
    </div>
  )
}

/** Un écran qui plante à son rendu, comme un morceau du jeu qui n'arrive pas. */
function BrokenScreen(): never {
  throw new Error('écran de démonstration')
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
    id: 'weekly-screen-reversed',
    group: 'Défi du moment',
    title: 'Écran du défi : renversé',
    how: 'Le défi de la semaine prochaine : la lettre à droite du thème, le score en points, le classement du défi',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario mode="reversed" used={1} plus={false} onBack={back} />,
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
    id: 'weekly-run-reversed',
    group: 'Défi du moment',
    title: 'Partie en renversé',
    how: 'La lettre contrainte en fin de mot : le champ annonce « qui finit par », le verdict juge la fin',
    phase: 'playing',
    render: () => <WeeklyRunScenario mode="reversed" />,
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
    id: 'weekly-tutorial-race',
    group: 'Défi du moment',
    title: 'Tutoriel de la course',
    how: 'Dix mots le plus vite possible : le chrono qui monte, la passe à 5 s, le plafond de trois minutes',
    phase: 'home',
    render: (back) => <ModeIntro mode="race" onDone={back} />,
  },
  {
    id: 'weekly-screen-race',
    group: 'Défi du moment',
    title: 'Écran du défi : course',
    how: 'Le défi en course, quand une semaine la recevra : le drapeau à damier, le record lu comme un temps',
    phase: 'home',
    render: (back) => <WeeklyScreenScenario mode="race" used={1} plus={false} onBack={back} />,
  },
  {
    id: 'weekly-run-race',
    group: 'Défi du moment',
    title: 'Partie en course',
    how: 'Le chrono qui monte, le disque qui se remplit des mots, « 6/10 » à la place des points',
    phase: 'playing',
    render: () => <WeeklyRunScenario mode="race" remaining={132.7} />,
  },
  {
    id: 'weekly-attempt-done-race',
    group: 'Défi du moment',
    title: 'Fin de tentative : course arrivée',
    how: 'Dix mots en 46,3 s, record battu (52,8 s)',
    phase: 'over',
    render: (back) => <WeeklyDoneScenario record mode="race" onBack={back} />,
  },
  {
    id: 'weekly-attempt-done-race-dnf',
    group: 'Défi du moment',
    title: 'Fin de tentative : course sans arrivée',
    how: 'Sept mots en trois minutes : « Pas d’arrivée », le record reste 52,8 s',
    phase: 'over',
    render: (back) => <WeeklyDoneScenario record={false} mode="race" onBack={back} />,
  },
  {
    id: 'weekly-results-race',
    group: 'Défi du moment',
    title: 'Classement du défi : course',
    how: 'Les mêmes soixante joueurs, chaque valeur lue comme un temps (sans serveur)',
    phase: 'home',
    render: (back) => <WeeklyResultsScenario closed={false} mode="race" onBack={back} />,
  },
  {
    id: 'weekly-results',
    group: 'Défi du moment',
    title: 'Classement du défi',
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
    id: 'over-category-few',
    group: 'Fin de partie',
    title: 'Proposition de catégorie : deux cartes seulement',
    how: 'Plus que deux catégories à gagner : les deux cartes prennent toute la largeur, sans trou',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(3, 4)
      return <OverScenario before={before} after={{ ...after, offer: ['sports', 'capitales'] }} onBack={back} />
    },
  },
  {
    id: 'over-power-single',
    group: 'Fin de partie',
    title: 'Proposition de pouvoir : une seule carte',
    how: 'Le dernier pouvoir à gagner : une carte, sur toute la largeur',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(4, 5)
      return <OverScenario before={{ ...before, powers: ['joker'] }} after={{ ...after, powers: ['joker'], powerOffer: ['magic'] }} onBack={back} />
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
    how: 'Les révélations du jour et celles de trois pubs sont passées : la pub reste proposée (+3, sans limite), à côté de l’offre Premium « Révélations illimitées »',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun({ ...PROFILE, revealDay: todayKey(), revealsUsed: 11, revealAds: 3 }, RUN)} hidden={HIDDEN} onBack={back} />,
  },
  {
    id: 'reveal-spent-ads',
    group: 'Fin de partie',
    title: 'Mots cachés : épuisées, une pub possible',
    how: 'Les deux révélations du jour sont passées : un tap ouvre la petite pub — trois révélations d’un coup, autant de fois qu’on veut —, le suivant l’offre Premium, qui répond « voir une pub » ou « devenir Premium » ; sans pub (navigateur), elle se dit indisponible',
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
    id: 'bonus-offer-first',
    group: 'Fin de partie',
    title: 'Premier bonus de niveau : le second emplacement',
    how: 'Le premier bonus propose toujours le second emplacement de pouvoir, à côté d’une autre carte',
    phase: 'over',
    render: (back) => (
      <OverScenario before={BONUS_PROFILE} after={afterRun({ ...BONUS_PROFILE, bonusOffer: ['slot', 'reveal'] }, RUN)} onBack={back} />
    ),
  },
  {
    id: 'bonus-offer-single',
    group: 'Fin de partie',
    title: 'Bonus de niveau : une seule carte',
    how: 'Une version qui écarte les autres cartes (l’invité CrazyGames) : le second emplacement seul, sur toute la largeur',
    phase: 'over',
    render: (back) => (
      <OverScenario before={BONUS_PROFILE} after={afterRun({ ...BONUS_PROFILE, bonusOffer: ['slot'] }, RUN)} onBack={back} />
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
    how: 'Membre Premium : compteur de cadenas noir et jaune, Ingrédients et Lieux et bâtiments gardés d’avant leur ouverture',
    phase: 'home',
    render: () => <BansScenario seen plus every banned={['pays']} />,
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
    id: 'moderator-super',
    group: 'Modération',
    title: 'Offre de super modérateur',
    how: 'Un modérateur au score d’exigence excellent (90 et plus, soixante votes tranchés) : accepter montre l’accueil, sans rien écrire sur le serveur',
    phase: 'home',
    render: offerModerator('super'),
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
    id: 'play-together-guest',
    group: 'Duel',
    title: 'Choix sans compte : joueurs ordinateur et connexion',
    how: 'Un joueur sans compte nommé — l’invité du portail CrazyGames, ou un anonyme sur Android — touche « Créer un défi » : le duel se joue contre les joueurs ordinateur, et la connexion lui ouvre les vrais joueurs',
    phase: 'home',
    render: (back) => <PlayTogether challenge={false} local onClose={back} onDuel={back} onChallenge={back} onSignIn={back} />,
  },
  {
    id: 'duel-table-guest',
    group: 'Duel',
    title: 'Table des joueurs ordinateur, sans compte',
    how: 'Le duel d’un joueur sans compte nommé : la table locale, et au salon la porte vers la connexion',
    phase: 'home',
    render: (back) => <DuelScreen lang="fr" mode="local" onSignIn={back} />,
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
    group: 'Duel classé',
    title: 'Matchmaking : recherche d’un adversaire',
    how: 'Après « Trouver un adversaire » : ma ligue, l’attente écoulée et l’estimée, combien cherchent et jouent ; « Annuler » arrête la file, le classement s’ouvre en bas',
    phase: 'home',
    render: (back) => <MatchmakingScenario kind="searching" onBack={back} />,
  },
  {
    id: 'duel-matchmaking-long',
    group: 'Duel classé',
    title: 'Matchmaking : attente plus longue que prévu',
    how: 'Plus d’une minute dans la file : l’estimation dépassée en rouge, un adversaire proposé qui n’a pas confirmé, les joueurs ordinateur en attendant et une table publique à rejoindre',
    phase: 'home',
    render: (back) => <MatchmakingScenario kind="long" onBack={back} />,
  },
  {
    id: 'duel-matchmaking-cooldown',
    group: 'Duel classé',
    title: 'Matchmaking : pause après trop d’abandons',
    how: 'Trois duels classés quittés ou propositions laissées passer en une heure : cinq minutes hors de la file, les joueurs ordinateur restent ouverts',
    phase: 'home',
    render: (back) => <MatchmakingScenario kind="cooldown" onBack={back} />,
  },
  {
    id: 'duel-matchmaking-missed',
    group: 'Duel classé',
    title: 'Matchmaking : proposition laissée passer',
    how: 'Le joueur n’a pas accepté dans les vingt secondes : la file s’est arrêtée, « Relancer » la reprend',
    phase: 'home',
    render: (back) => <MatchmakingScenario kind="missed" onBack={back} />,
  },
  {
    id: 'duel-match-found',
    group: 'Duel classé',
    title: 'Adversaire trouvé',
    how: 'La file a trouvé Ondine : les deux places, l’enjeu au classement, vingt secondes qui se consument ; « Accepter » passe à l’attente, Ondine accepte au bout de six secondes',
    phase: 'duel',
    render: (back) => <MatchFoundScenario onBack={back} />,
  },
  {
    id: 'duel-match-found-friendly',
    group: 'Duel classé',
    title: 'Adversaire trouvé par une version livrée',
    how: 'Une version d’avant le classement a apparié le joueur : la table n’est pas classée, la carte dit « Partie amicale »',
    phase: 'duel',
    render: (back) => <MatchFoundScenario ranked={false} onBack={back} />,
  },
  {
    id: 'duel-queue-pill',
    group: 'Duel classé',
    title: 'La file continue à l’accueil',
    how: 'Le joueur a quitté l’écran de recherche : la pastille dit l’attente et l’estimée ; la toucher rouvre la recherche, la croix l’arrête',
    phase: 'home',
    render: (back) => <QueuePillScenario onBack={back} home={<DebugHome back={back} />} />,
  },
  {
    id: 'duel-ladder',
    group: 'Duel classé',
    title: 'Classements en pleine page : le duel classé',
    how: 'Tous les classements sortent du tiroir : Solo, Défi et Duel ; le duel montre les rangs — Maître pour le top 10 —, jamais l’Elo, et ma place en bas',
    phase: 'duel',
    render: (back) => <LadderScenario onBack={back} load={(stat, period) => fakeLeaderboard(stat, period)} />,
  },
  {
    id: 'boards-page',
    group: 'Duel classé',
    title: 'Classements en pleine page : le solo',
    how: 'Depuis l’accueil ou les statistiques, les classements s’ouvrent sur une page entière, hors du tiroir, avec Solo, Défi et Duel',
    phase: 'duel',
    render: (back) => <LadderScenario onBack={back} initial="runs" load={(stat, period) => fakeLeaderboard(stat, period)} />,
  },
  {
    id: 'duel-over-ranked',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : nouvelle ligue',
    how: 'Le serveur a réglé la table : l’Elo monte de 1 093 à 1 108 et passe d’Argent à Or',
    phase: 'duel',
    render: () => <RankedOverScenario base={DUEL_OVER_TABLE} settle="promoted" />,
  },
  {
    id: 'duel-over-ranked-loss',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : défaite',
    how: 'Une défaite réglée : l’Elo descend de onze points, la ligue tient',
    phase: 'duel',
    render: () => <RankedOverScenario base={{ ...DUEL_OVER_TABLE, myIndex: 1 }} settle="lost" />,
  },
  {
    id: 'duel-over-placed',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : placements finis',
    how: 'La troisième partie de placement : le joueur est classé, ici en Or III',
    phase: 'duel',
    render: () => <RankedOverScenario base={DUEL_OVER_TABLE} settle="placed" />,
  },
  {
    id: 'duel-over-demoted',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : rétrogradation',
    how: 'Une défaite qui fait repasser d’Or III en Argent I',
    phase: 'duel',
    render: () => <RankedOverScenario base={DUEL_OVER_TABLE} settle="demoted" />,
  },
  {
    id: 'duel-over-master',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : Maître',
    how: 'Un joueur du top 10 : son rang est « Maître n° 7 »',
    phase: 'duel',
    render: () => <RankedOverScenario base={DUEL_OVER_TABLE} settle="master" />,
  },
  {
    id: 'duel-over-settling',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : règlement en cours',
    how: 'La fin vient d’arriver, le rapport de l’autre pas encore : « Le classement se règle… »',
    phase: 'duel',
    render: () => <RankedOverScenario base={DUEL_OVER_TABLE} settle="settling" />,
  },
  {
    id: 'duel-over-voided',
    group: 'Duel classé',
    title: 'Bilan d’un duel classé : partie annulée',
    how: 'Les rapports des deux appareils ne concordaient pas : la partie ne compte pas',
    phase: 'duel',
    render: () => <RankedOverScenario base={DUEL_OVER_TABLE} settle="voided" />,
  },
  {
    id: 'duel-seat-away',
    group: 'Duel classé',
    title: 'Adversaire hors ligne en pleine partie',
    how: 'Ondine ne relit plus la table depuis six secondes : sa place pâlit et dit « Hors ligne », sa réserve coule',
    phase: 'duel',
    render: () => <AwayScenario base={CHEER_TABLE} />,
  },
  {
    id: 'duel-flow-search-a',
    group: 'Duel classé : le parcours à deux',
    title: '1. Jérémy cherche',
    how: 'Jérémy est dans la file depuis vingt secondes, seul de sa langue : l’estimée, et quatre joueurs en duel qui vont se libérer',
    phase: 'home',
    render: (back) => <FlowSearchScenario side="a" onBack={back} />,
  },
  {
    id: 'duel-flow-search-b',
    group: 'Duel classé : le parcours à deux',
    title: '1. Ondine arrive',
    how: 'Ondine vient d’entrer dans la file : un autre joueur cherche, l’appariement est imminent',
    phase: 'home',
    render: (back) => <FlowSearchScenario side="b" onBack={back} />,
  },
  {
    id: 'duel-flow-bots-a',
    group: 'Duel classé : le parcours à deux',
    title: '2. Jérémy joue les ordinateurs en attendant',
    how: 'Au bout de quinze secondes Jérémy a pris la table des joueurs ordinateur : la pastille de la file reste en haut',
    phase: 'duel',
    render: () => <BotsWhileQueueScenario table={<DuelScreen lang="fr" mode="local" />} />,
  },
  {
    id: 'duel-flow-found-a',
    group: 'Duel classé : le parcours à deux',
    title: '3. Jérémy : adversaire trouvé, accepté',
    how: 'La carte s’ouvre par-dessus la table des ordinateurs ; Jérémy a accepté et attend Ondine',
    phase: 'duel',
    render: () => <FlowFoundScenario side="a" behind={<DuelScreen lang="fr" mode="local" />} />,
  },
  {
    id: 'duel-flow-found-b',
    group: 'Duel classé : le parcours à deux',
    title: '3. Ondine : adversaire trouvé',
    how: 'Ondine voit Jérémy déjà prêt, l’enjeu et le décompte',
    phase: 'duel',
    render: () => <FlowFoundScenario side="b" />,
  },
  {
    id: 'duel-flow-play-a',
    group: 'Duel classé : le parcours à deux',
    title: '4. Jérémy en partie',
    how: 'La table classée, vue de la place de Jérémy',
    phase: 'duel',
    render: () => <FlowPlayScenario base={CHEER_TABLE} side="a" />,
  },
  {
    id: 'duel-flow-play-b',
    group: 'Duel classé : le parcours à deux',
    title: '4. Ondine en partie',
    how: 'La même table, vue de la place d’Ondine',
    phase: 'duel',
    render: () => <FlowPlayScenario base={CHEER_TABLE} side="b" />,
  },
  {
    id: 'duel-flow-echo-a',
    group: 'Duel classé : le parcours à deux',
    title: '4 bis. Jérémy trouve pendant le tour d’Ondine',
    how: 'Un mot juste tapé pendant le tour de l’autre : l’étiquette annonce « Bonus +1 s », Valider l’envoie',
    phase: 'duel',
    render: () => <FlowPlayScenario base={CHEER_TABLE} side="a" echo />,
  },
  {
    id: 'duel-flow-echo-b',
    group: 'Duel classé : le parcours à deux',
    title: '4 bis. Ondine voit Jérémy trouver',
    how: 'Chez celle qui a la main : « Jérémy a trouvé un mot », +1 s sur sa place, le mot reste caché',
    phase: 'duel',
    render: () => <FlowPlayScenario base={CHEER_TABLE} side="b" echo />,
  },
  {
    id: 'duel-flow-away-a',
    group: 'Duel classé : le parcours à deux',
    title: '5. Jérémy voit Ondine décrocher',
    how: 'Ondine ne relit plus la table : sa place pâlit, la ligne du tour le dit',
    phase: 'duel',
    render: () => <FlowPlayScenario base={CHEER_TABLE} side="a" away />,
  },
  {
    id: 'duel-flow-away-b',
    group: 'Duel classé : le parcours à deux',
    title: '5. Ondine a perdu sa connexion',
    how: 'Chez Ondine : le dernier état reste à l’écran avec « connexion perdue »',
    phase: 'duel',
    render: () => <FlowPlayScenario base={CHEER_TABLE} side="b" away />,
  },
  {
    id: 'duel-flow-over-a',
    group: 'Duel classé : le parcours à deux',
    title: '6. Jérémy gagne et monte en Or',
    how: 'Le bilan de Jérémy : +11, l’Elo franchit 1 100 et passe en Or',
    phase: 'duel',
    render: () => <FlowOverScenario base={DUEL_OVER_TABLE} side="a" />,
  },
  {
    id: 'duel-flow-over-b',
    group: 'Duel classé : le parcours à deux',
    title: '6. Ondine perd',
    how: 'Le bilan d’Ondine : −11, sa ligue tient',
    phase: 'duel',
    render: () => <FlowOverScenario base={DUEL_OVER_TABLE} side="b" />,
  },
  {
    id: 'duel-resume',
    group: 'Duel classé',
    title: 'Reprendre un duel quitté',
    how: 'L’app s’est fermée en plein duel : l’accueil propose d’y revenir tant que la réserve tient, ou d’abandonner',
    phase: 'home',
    render: (back) => <ResumeScenario onBack={back} />,
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
    id: 'duel-public-lobby',
    group: 'Duel',
    title: 'Salon ouvert au public',
    how: 'L’hôte d’une table en ligne a touché « Table publique » : la file du matchmaking y a assis Ondine, prête toute seule ; l’interrupteur bascule pour de vrai',
    phase: 'duel',
    render: () => <PublicLobbyScenario />,
  },
  {
    id: 'duel-over-xp',
    group: 'Duel',
    title: 'Bilan d’un duel en ligne : l’XP et un succès',
    how: 'Fin d’un duel contre un vrai joueur, resté jusqu’au bout : les points des mots trouvés et le forfait du duel, un niveau franchi — son offre attend la prochaine partie seule — et un succès débloqué',
    phase: 'duel',
    render: () => <Over table={DUEL_OVER_TABLE} />,
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
    id: 'screen-broken',
    group: 'Accueil',
    title: 'Écran qui n’a pas chargé',
    how: 'Un morceau du jeu manque (mise à jour, coupure) ou un écran plante : la page ne blanchit plus, elle propose de recharger',
    phase: 'home',
    render: () => (
      <ScreenBoundary>
        <BrokenScreen />
      </ScreenBoundary>
    ),
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
    id: 'moderation-reasons',
    group: 'Modération',
    title: 'Juger avec les raisons des autres',
    how: 'Les raisons laissées par les modérateurs précédents s’affichent sur la carte ; « Refuser avec une raison » (ou « Conserver avec une raison » sur un retrait) ouvre le champ',
    phase: 'home',
    render: (back) => <ModerationScreen lang="fr" queue={REASONED_QUEUE} onDone={back} />,
  },
  {
    id: 'profile-review',
    group: 'Modération',
    title: 'Profils à juger (super modérateur)',
    how: 'Un joueur banni d’office (lever ou garder le ban), puis un joueur dans le doute (laisser proposer ou bannir, en deux tapes) : rien n’est écrit sur le serveur',
    phase: 'home',
    render: (back) => <ProfileReviewScreen profiles={PROFILE_QUEUE} judge={(_, ban) => later(ban ? 'banned' : 'cleared')} onDone={back} />,
  },
  {
    id: 'requests-moderator-score',
    group: 'Modération',
    title: 'Mes demandes : score et profils',
    how: 'Super modérateur au score de 87 : lancer une session et « Profils à juger · 2 » (les deux boutons ne font rien ici)',
    phase: 'home',
    render: () => <GuardedRequestsScenario status={GUARDED_STATUS} />,
  },
  {
    id: 'requests-banned',
    group: 'Modération',
    title: 'Mes demandes : propositions suspendues',
    how: 'Un joueur banni de proposition lit pourquoi ses mots ne partent plus',
    phase: 'home',
    render: () => <GuardedRequestsScenario status={{ ...GUARDED_STATUS, moderator: false, super: false, score: null, judged: 0, profiles: 0, banned: true }} />,
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
    id: 'categories-ban-three',
    group: 'Accueil',
    title: 'Mes catégories : trois cadenas gagnés',
    how: 'Version sans Premium (CrazyGames, Playgama, Y8) : les trois cadenas des niveaux 13, 22 et 31 posés ; un quatrième dit de rétablir une catégorie, sans promettre de bonus',
    phase: 'home',
    render: () => (
      // Comme sur un portail : aucune fiche Premium à ouvrir.
      <PremiumContext.Provider value={{ storeOpen: false, adsOpen: false, open: noop }}>
        <BansScenario seen every bonuses={['filter', 'filter', 'filter']} banned={['pays', 'animaux', 'couleurs']} />
      </PremiumContext.Provider>
    ),
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
    id: 'mode-race',
    group: 'Accueil',
    title: 'Leçon du mode course',
    how: 'La fiche de la course, puis une couleur à taper : le premier des dix mots',
    phase: 'playing',
    render: (back) => <ModeTutorial mode="race" lang="fr" onDone={back} />,
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
  {
    id: 'run-magic-freed',
    group: 'Partie',
    title: 'Magie libère la lettre',
    how: 'La lettre touchée devient une étoile : un mot du thème, quelle que soit son initiale, répond à la question',
    phase: 'playing',
    render: () => <MagicFreedScenario />,
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
            {/* Sans enveloppe : un écran posé dans la scène comme dans le jeu, enfant
                direct de la scène, reçoit les mêmes styles (« .stage--home > .sheet »). */}
            <Fragment key={`${open.id}:${take}`}>{open.render(() => setOpen(null))}</Fragment>
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
      {/* Le portail sert le build qu'il a revu, pas celui qu'on vient de
          téléverser : cette ligne dit lequel tourne sous les yeux. */}
      <p className="note">
        Build {import.meta.env.VITE_BUILD ?? 'dev'} · version {import.meta.env.VITE_APP_VERSION ?? 'dev'} — ce que
        cette page exécute, à comparer au build envoyé au portail.
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
                    data-scenario={scenario.id}
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
