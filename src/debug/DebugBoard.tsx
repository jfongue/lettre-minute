import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_AVATAR, type AvatarChoice } from '../domain/avatar'
import type { ChallengeWord } from '../domain/challenge'
import { choosePower } from '../domain/powers'
import { NEW_PROFILE, xpForLevel, type Profile } from '../domain/progression'
import type { RarityTier } from '../domain/rarity'
import type { KeptWord, MissedWord, Run } from '../domain/run'
import { chooseCategory } from '../domain/unlocks'
import type { Account, ChallengeDetail, ChallengePlayer, ChallengeSummary, Submission, SubmissionStatus } from '../lib/cloud'
import type { AccountActions } from '../ui/AccountPanel'
import { ChallengeNotice } from '../ui/ChallengeHome'
import { ChallengePowers } from '../ui/ChallengePowers'
import { ChallengeView } from '../ui/ChallengeScreen'
import { PowerGiftPop, WordsNewsPop } from '../ui/WordsNews'
import { HomeScreen } from '../ui/HomeScreen'
import { LanguagePicker } from '../ui/LanguagePicker'
import { ModeratorOffer } from '../ui/ModeratorOffer'
import { OverScreen, type RunProposal } from '../ui/OverScreen'
import { PlayerActionsContext, type PlayerActions } from '../ui/PlayerSheet'
import { TutorialScreen } from '../ui/TutorialScreen'
import { UpdateNotice } from '../ui/UpdateNotice'
import { PushOffer } from '../ui/PushOffer'
import { OldChallengeList } from '../ui/StatsPage'
import { ChallengeSetup, type ChallengeRules } from '../ui/ChallengeSetup'
import { FriendPicker } from '../ui/FriendPicker'
import { FriendPage } from '../ui/FriendPage'
import type { SharedChallenge, SharedPlayer } from '../domain/rivalry'
import type { Boards } from '../domain/boards'
import type { ActivityBucket, Insights as InsightData, PairTally, PowerTally } from '../domain/insights'
import { completeLeaderboard, type Leaderboard, type PeriodId, type StatId } from '../domain/leaderboards'
import { LeaderboardsPage } from '../ui/LeaderboardsPage'
import { RECENT_SCENARIOS, RECENT_VERSIONS } from './recent'
import { ban, joinPlus, markBanIntroSeen, spendPeek, unban, type HiddenAnswer } from '../domain/perks'
import { ownedCategoryIds } from '../domain/unlocks'
import { CategoriesPage } from '../ui/CategoriesPage'
import { FeedbackPop } from '../ui/FeedbackPop'
import { PlusPop } from '../ui/PlusPop'
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
  // Léa and Tom are friends here: their sheet offers a challenge.
  friendId: (name) => later(name === 'Léa' || name === 'Tom' ? name.toLowerCase() : null, 200),
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

function makeRun(score: number, words: readonly Word[] = WORDS, missed: readonly MissedWord[] = []): Run {
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
    charges: {},
    joker: null,
    hush: null,
    heldSeconds: 0,
    rerolls: 0,
    missed,
    chatter: 0,
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
  }
}

// ------------------------------------------------------------ scenarios --

/** Rows per measure: long, past fifty with the player far down, short, empty, and one that does not answer. */
const LEADERBOARD_SIZES: Record<StatId, number> = { best: 24, points: 60, runs: 5, words: 24, discoveries: 2, combo: 12, added: 0 }

/** A name past the podium's width: the top 3 must trim it rather than grow a step. */
const LONG_PLAYER = 'MaximilienDeRobespierre'

function fakeLeaderboard(stat: StatId, period: PeriodId): Promise<Leaderboard | null> {
  if (stat === 'combo' && period === 'week') return later(null, 700)
  const scale = period === 'day' ? 1 : period === 'week' ? 4 : 20
  const top = stat === 'best' ? 400 : stat === 'runs' ? 9 : stat === 'discoveries' ? 6 : 120
  const count = Math.min(LEADERBOARD_SIZES[stat], 50)
  const far = LEADERBOARD_SIZES[stat] > 50
  const rows = Array.from({ length: count }, (_, index) => ({
    name: index === 0 ? LONG_PLAYER : index === 14 && !far ? 'Testeur' : `Joueur ${index + 1}`,
    avatar: avatarOf((index * 7 + top) % 100, index % 2 ? 'jaune' : 'bleu', 'noir', 'rouge'),
    value: Math.max(1, Math.round((top - index * (top / 60)) * scale)),
    place: index + 1,
    mine: index === 14 && !far,
  }))
  const me = far ? { name: 'Testeur', avatar: DEFAULT_AVATAR, value: 3 * scale, place: 73, mine: true } : null
  return later(completeLeaderboard(stat, period, { rows, me }), 500)
}

/** Ce qu'un mode débug montre : des pouvoirs qui pèsent, un couple rentable, un couple fui. */
const POWERS: readonly PowerTally[] = [
  { power: 'joker', runs: 128, points: 9_200, best: 420 },
  { power: 'hush', runs: 61, points: 4_100, best: 310 },
  { power: 'magic', runs: 44, points: 3_600, best: 290 },
  { power: 'dodge', runs: 22, points: 1_500, best: 180 },
  { power: 'divination', runs: 8, points: 900, best: 260 },
  { power: 'dyslexia', runs: 3, points: 700, best: 340 },
]

const PAIRS: readonly PairTally[] = [
  // Rapportés par une partie : les tirages quittés s'y comptent.
  { categoryId: 'pays', letter: 'Z', dealt: 42, passed: 34, words: 9, points: 620, reported: true },
  { categoryId: 'animaux', letter: 'Q', dealt: 31, passed: 24, words: 8, points: 540, reported: true },
  { categoryId: 'couleurs', letter: 'V', dealt: 58, passed: 12, words: 51, points: 1_780, reported: true },
  { categoryId: 'pays', letter: 'B', dealt: 74, passed: 9, words: 69, points: 2_240, reported: true },
  { categoryId: 'metiers', letter: 'E', dealt: 26, passed: 11, words: 18, points: 430, reported: true },
  { categoryId: 'fruits-legumes', letter: 'K', dealt: 19, passed: 14, words: 6, points: 260, reported: true },
  { categoryId: 'sports', letter: 'C', dealt: 47, passed: 19, words: 33, points: 780, reported: true },
  { categoryId: 'marques', letter: 'F', dealt: 23, passed: 15, words: 10, points: 240, reported: true },
  // Lus dans les mots joués d'une partie qui n'a rien rapporté : « au moins »
  // N tirages, et leur part de tirages quittés reste inconnue.
  { categoryId: 'animaux', letter: 'O', dealt: 61, passed: 0, words: 55, points: 1_690, reported: false },
  { categoryId: 'capitales', letter: 'A', dealt: 12, passed: 0, words: 8, points: 320, reported: false },
  { categoryId: 'plantes', letter: 'M', dealt: 9, passed: 0, words: 4, points: 150, reported: false },
  { categoryId: 'objets', letter: 'T', dealt: 17, passed: 0, words: 14, points: 260, reported: false },
]

const RUN_HOURS = [3, 2, 1, 0, 0, 1, 4, 9, 14, 18, 21, 17, 12, 15, 19, 24, 31, 28, 22, 16, 11, 7, 5, 4]
const ACCOUNT_HOURS = [0, 0, 0, 0, 0, 0, 1, 2, 3, 1, 0, 2, 4, 1, 0, 3, 5, 2, 1, 0, 0, 1, 0, 0]

function series(step: number, count: number, runs: readonly number[], accounts: readonly number[]): ActivityBucket[] {
  const last = Math.floor(Date.now() / step) * step
  return Array.from({ length: count }, (_, index) => ({
    at: last - (count - 1 - index) * step,
    runs: runs[index % runs.length]!,
    accounts: accounts[index % accounts.length]!,
  }))
}

const INSIGHTS: InsightData = {
  hours: series(HOUR, 24, RUN_HOURS, ACCOUNT_HOURS),
  days: series(24 * HOUR, 7, [180, 240, 205, 310, 288, 352, 143], [7, 12, 9, 15, 11, 18, 6]),
  weeks: series(7 * 24 * HOUR, 12, [1_240, 1_380, 1_190, 1_460, 1_710, 1_520, 1_830, 2_040, 1_960, 2_310, 2_180, 1_420], [42, 51, 38, 60, 55, 71, 66, 83, 74, 91, 79, 48]),
  powers: POWERS,
  pairs: PAIRS,
}

function AdvancedScenario() {
  return (
    <div className="sheet">
      <LeaderboardsPage named lang="fr" load={fakeLeaderboard} advanced loadInsights={() => later(INSIGHTS, 300)} />
    </div>
  )
}

function LeaderboardsScenario({ named }: { named: boolean }) {
  return (
    <div className="sheet">
      <LeaderboardsPage named={named} lang="fr" load={fakeLeaderboard} />
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
  { prompt: { categoryId: 'pays', letter: 'K' }, display: 'kenya', told: false },
  { prompt: { categoryId: 'animaux', letter: 'Z' }, display: 'zèbre', told: false },
  { prompt: { categoryId: 'couleurs', letter: 'M' }, display: 'marron', told: false },
  { prompt: { categoryId: 'animaux', letter: 'O' }, display: 'ours', told: true },
]

/** « Mes catégories » à sept catégories : le bannissement s'y ouvre, sur un profil qui ne sort pas de la planche. */
function BansScenario({
  seen = false,
  plus = false,
  banned = [],
}: {
  seen?: boolean
  plus?: boolean
  /** Déjà bannies à l'ouverture. */
  banned?: readonly string[]
}) {
  const [profile, setProfile] = useState<Profile>(() => ({
    ...PROFILE,
    unlocked: ['fruits-legumes', 'metiers', 'sports', 'marques'],
    banIntroSeen: seen ? 1 : 0,
    plusSince: plus ? 1 : 0,
    banned,
  }))
  const owned = ownedCategoryIds(profile)
  return (
    <div className="sheet">
      <CategoriesPage
        profile={profile}
        onBan={(id) => setProfile((current) => ban(current, owned, id))}
        onUnban={(id) => setProfile((current) => unban(current, id))}
        onIntroSeen={() => setProfile((current) => markBanIntroSeen(current))}
        onJoinPlus={() => setProfile((current) => joinPlus(current, Date.now()))}
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
    id: 'over-professor',
    group: 'Fin de partie',
    title: 'Mots soufflés par Professeur',
    how: 'Bilan avec la liste des mots manqués',
    phase: 'over',
    render: (back) => {
      const run = makeRun(120, WORDS.slice(3), [
        { prompt: { categoryId: 'pays', letter: 'K' }, display: 'kenya' },
        { prompt: { categoryId: 'animaux', letter: 'Z' }, display: 'zèbre' },
      ])
      return <OverScenario run={run} after={afterRun(PROFILE, run)} onBack={back} />
    },
  },
  {
    id: 'over-hidden',
    group: 'Fin de partie',
    title: 'Mots cachés des invites passées',
    how: 'Trois bandes noires à arracher (deux gratuites restantes, puis Premium), une déjà soufflée par Professeur',
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
    id: 'challenge-powers',
    group: 'Défi entre amis',
    title: 'Choix des pouvoirs avant un défi',
    how: 'Plus de deux pouvoirs admis',
    phase: 'home',
    render: (back) => (
      <ChallengePowers allowed={['joker', 'dodge', 'hush', 'divination', 'professor']} initial={['joker', 'dodge']} onStart={back} onClose={back} />
    ),
  },
  // Les identifiants restent littéraux : `npm run debug:recent` les relit dans
  // le fichier pour nommer les planches touchées depuis les deux dernières versions.
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
    title: 'Classements avancés, mode débug',
    how: 'Cinq tapes sur « Classements » : pouvoirs portés, points moyens par pouvoir, parties et comptes par heure / jour / semaine, couples les plus rentables et les plus passés',
    phase: 'home',
    render: () => <AdvancedScenario />,
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
    id: 'categories-ban',
    group: 'Accueil',
    title: 'Mes catégories : bannir',
    how: 'Septième catégorie : explication à l’ouverture, un ban gratuit, le deuxième demande Premium',
    phase: 'home',
    render: () => <BansScenario />,
  },
  {
    id: 'categories-ban-plus',
    group: 'Accueil',
    title: 'Mes catégories : Premium',
    how: 'Premium : autant de bans qu’on veut, tant qu’il reste cinq catégories',
    phase: 'home',
    render: () => <BansScenario seen plus />,
  },
  {
    id: 'categories-ban-full',
    group: 'Accueil',
    title: 'Mes catégories : limite des cinq',
    how: 'Premium, deux bannies sur sept : un troisième ban est refusé, il faut garder cinq catégories',
    phase: 'home',
    render: () => <BansScenario seen plus banned={['pays', 'animaux']} />,
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
    id: 'push-offer',
    group: 'Accueil',
    title: 'Proposition des notifications',
    how: 'Juste après une nouvelle amitié, avant la question du téléphone (sans effet ici)',
    phase: 'home',
    render: (back) => <PushOffer onNo={back} onYes={back} />,
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
}: {
  back(): void
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
      settled
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

/** Les planches touchées depuis les deux dernières versions livrées. */
const RECENT = new Set(RECENT_SCENARIOS)

export function DebugBoard({ onClose, onPhase }: DebugBoardProps) {
  const [open, setOpen] = useState<Scenario | null>(null)
  // Replaying remounts the screen, its animations and picks with it.
  const [take, setTake] = useState(0)

  useEffect(() => {
    onPhase(open?.phase ?? 'home')
    window.scrollTo(0, 0)
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
  const recentCount = SCENARIOS.filter((scenario) => RECENT.has(scenario.id)).length
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
      {recentCount > 0 && (
        <p className="note debug-note">
          En surligné : {recentCount} des {SCENARIOS.length} planches montrent un écran ou un code qui a changé depuis
          les deux dernières versions livrées ({RECENT_VERSIONS.join(' et ')}). « npm run debug:recent » refait la liste
          au moment de livrer.
        </p>
      )}
      {groups.map((group) => (
        <section key={group} className="stack">
          <p className="section-title">{group}</p>
          <ul className="debug-list">
            {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => {
              const recent = RECENT.has(scenario.id)
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    className={recent ? 'debug-item debug-item--recent' : 'debug-item'}
                    onClick={() => {
                      setTake(0)
                      setOpen(scenario)
                    }}
                  >
                    <strong>
                      {scenario.title}
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
