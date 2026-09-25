import { MAX_EQUIPPED, equippedPowers, ownedPowers, type PowerId } from './powers'
import { applyRun, XP_PER_POINT, type Profile, type RunOutcome } from './progression'
import type { RarityTier } from './rarity'
import type { Run } from './run'

/**
 * A challenge between friends: one seed, one lineup, played by each in turn
 * within a day. Everyone draws the same prompts in the same order, since a
 * run's n-th prompt depends only on the seed, the lineup and what it avoids.
 * The scores are then settled like a Petit Bac: a word someone else also found
 * pays half.
 */

export const CHALLENGE_MAX_PLAYERS = 8
/** A challenge closes this long after its last run, even if some invitees never played. */
export const CHALLENGE_EXPIRY_HOURS = 24
/** The XP a challenge run pays on top of its points: playing with friends is worth a little more. */
export const CHALLENGE_XP_BONUS = 0.25
/** What a word found by more than one player keeps of its points. */
export const SHARED_WORD_SHARE = 0.5
/**
 * Permutation trades a category for one of the player's own: the lineup
 * would no longer be the one everyone else plays.
 */
export const BARRED_POWERS: readonly PowerId[] = ['permutation']

/** The powers a player may take into a challenge. */
export function challengePowers(profile: Profile): PowerId[] {
  return ownedPowers(profile).filter((id) => !BARRED_POWERS.includes(id))
}

/** More allowed powers than slots: the player picks before the run. */
export function needsPowerPick(profile: Profile): boolean {
  return challengePowers(profile).length > MAX_EQUIPPED
}

/** What the run carries unless the player picks: the worn powers that are allowed, topped up with the others. */
export function defaultChallengePowers(profile: Profile): PowerId[] {
  const allowed = challengePowers(profile)
  const worn = equippedPowers(profile).filter((id) => allowed.includes(id))
  return [...worn, ...allowed.filter((id) => !worn.includes(id))].slice(0, MAX_EQUIPPED)
}

/** A word as a challenge keeps it: enough to settle, rank and replay a run, nothing of the player's history. */
export interface ChallengeWord {
  categoryId: string
  letter: string
  /** `WordEntry.key`: two players who wrote « chats » and « chat » found the same word. */
  key: string
  display: string
  points: number
  tier: RarityTier
  approximate: boolean
  /** Seconds its prompt stayed up before it came. */
  seconds: number
  /** The run clock when it was validated. */
  at: number
}

export function challengeWordsOf(run: Run): ChallengeWord[] {
  return run.found.map((found) => ({
    categoryId: found.prompt.categoryId,
    letter: found.prompt.letter,
    key: found.word,
    display: found.display,
    points: found.points,
    tier: found.tier,
    approximate: found.approximate,
    seconds: found.seconds,
    at: found.at,
  }))
}

/** One player's run in a challenge; `playedAt` is null while they have not played. */
export interface ChallengeEntry {
  playerId: string
  playedAt: number | null
  score: number
  skips: number
  bestCombo: number
  words: readonly ChallengeWord[]
}

const wordId = (word: Pick<ChallengeWord, 'categoryId' | 'key'>) => `${word.categoryId}:${word.key}`

function played(entries: readonly ChallengeEntry[]): ChallengeEntry[] {
  return entries
    .filter((entry) => entry.playedAt !== null)
    .sort((a, b) => (a.playedAt ?? 0) - (b.playedAt ?? 0))
}

/** How many players found each word, by category and key. */
function finders(entries: readonly ChallengeEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    for (const id of new Set(entry.words.map(wordId))) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

export interface SettledWord extends ChallengeWord {
  /** Other players who found it too. */
  sharedWith: number
  /** What it pays once settled. */
  settled: number
}

export interface Standing {
  playerId: string
  /** The run's own score, before settling. */
  raw: number
  score: number
  unique: number
  shared: number
  words: readonly SettledWord[]
}

/**
 * The Petit Bac rule, over the runs played so far: settled again each time a
 * player joins, so a word unique this morning may be shared tonight. Ties go
 * to the higher raw score, then to whoever played first.
 */
export function settleChallenge(entries: readonly ChallengeEntry[]): Standing[] {
  const runs = played(entries)
  const counts = finders(runs)
  return runs
    .map((entry, order) => {
      const words = entry.words.map((word) => {
        const sharedWith = (counts.get(wordId(word)) ?? 1) - 1
        return { ...word, sharedWith, settled: sharedWith > 0 ? Math.round(word.points * SHARED_WORD_SHARE) : word.points }
      })
      return {
        order,
        standing: {
          playerId: entry.playerId,
          raw: entry.score,
          score: words.reduce((sum, word) => sum + word.settled, 0),
          unique: words.filter((word) => word.sharedWith === 0).length,
          shared: words.filter((word) => word.sharedWith > 0).length,
          words,
        },
      }
    })
    .sort((a, b) => b.standing.score - a.standing.score || b.standing.raw - a.standing.raw || a.order - b.order)
    .map(({ standing }) => standing)
}

export interface TalliedWord {
  categoryId: string
  letter: string
  key: string
  display: string
  tier: RarityTier
  /** Who found it, in the order they played. */
  players: readonly string[]
}

function tally(entries: readonly ChallengeEntry[]): TalliedWord[] {
  const words = new Map<string, TalliedWord>()
  for (const entry of played(entries)) {
    for (const word of entry.words) {
      const id = wordId(word)
      const known = words.get(id)
      if (!known) {
        words.set(id, { ...word, players: [entry.playerId] })
      } else if (!known.players.includes(entry.playerId)) {
        words.set(id, {
          ...known,
          // An exact spelling beats a corrected one as the word the recap names.
          tier: word.approximate ? known.tier : word.tier,
          players: [...known.players, entry.playerId],
        })
      }
    }
  }
  return [...words.values()]
}

export interface Answer {
  playerId: string
  /** What they found on that letter and category; empty when they skipped it or never got there. */
  words: readonly ChallengeWord[]
}

/**
 * What every player who has played answered on one letter and category, in
 * the order they played. Everyone draws the same prompts, but not at the same
 * pace: a fast player reaches prompts a slow one never sees.
 */
export function answersTo(entries: readonly ChallengeEntry[], prompt: Pick<ChallengeWord, 'categoryId' | 'letter'>): Answer[] {
  return played(entries).map((entry) => ({
    playerId: entry.playerId,
    words: entry.words.filter((word) => word.categoryId === prompt.categoryId && word.letter === prompt.letter),
  }))
}

/** The words the most players found, two at least. */
export function mostSharedWords(entries: readonly ChallengeEntry[], limit = 5): TalliedWord[] {
  return tally(entries)
    .filter((word) => word.players.length > 1)
    .sort((a, b) => b.players.length - a.players.length || a.display.localeCompare(b.display))
    .slice(0, limit)
}

const TIER_RANK: Record<RarityTier, number> = { courant: 0, 'peu commun': 1, rare: 2, 'très rare': 3 }

/** Words only one player found, the rarest first. */
export function uniqueWords(entries: readonly ChallengeEntry[], limit = 5): TalliedWord[] {
  return tally(entries)
    .filter((word) => word.players.length === 1)
    .sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.display.localeCompare(b.display))
    .slice(0, limit)
}

export type TrophyId = 'slowest' | 'fastest' | 'skipper' | 'original' | 'sheep' | 'rarest' | 'streak' | 'typos'

export interface Trophy {
  id: TrophyId
  playerId: string
  /** Seconds, a count, or a series, depending on the trophy. */
  value: number
  /** The word that won it, for those a single word wins. */
  word?: string
}

interface Measure {
  /** Null when the run has nothing to measure. */
  value: number | null
  word?: string
}

/**
 * The fun awards of the recap. Each goes to one player — the first to have
 * played on a tie — and only when there is something to award: no « Zappeur »
 * in a challenge nobody skipped.
 */
export function awardTrophies(entries: readonly ChallengeEntry[]): Trophy[] {
  const runs = played(entries)
  if (runs.length < 2) return []
  const counts = finders(runs)
  const exact = (entry: ChallengeEntry) => entry.words.filter((word) => !word.approximate)

  const extreme = (pick: (entry: ChallengeEntry) => Measure, lowest = false): Omit<Trophy, 'id'> | null => {
    let best: (Omit<Trophy, 'id'>) | null = null
    for (const entry of runs) {
      const { value, word } = pick(entry)
      if (value === null) continue
      if (best === null || (lowest ? value < best.value : value > best.value)) {
        best = { playerId: entry.playerId, value, ...(word !== undefined && { word }) }
      }
    }
    return best
  }
  const longest = (words: readonly ChallengeWord[], sign: 1 | -1): Measure => {
    const word = [...words].sort((a, b) => sign * (b.seconds - a.seconds))[0]
    return word ? { value: word.seconds, word: word.display } : { value: null }
  }
  const count = (value: number): Measure => ({ value: value > 0 ? value : null })

  const awards: [TrophyId, Omit<Trophy, 'id'> | null][] = [
    ['original', extreme((entry) => count(entry.words.filter((word) => counts.get(wordId(word)) === 1).length))],
    ['rarest', extreme((entry) => {
      const word = exact(entry).sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.points - a.points)[0]
      return word && TIER_RANK[word.tier] > 0 ? { value: TIER_RANK[word.tier], word: word.display } : { value: null }
    })],
    ['fastest', extreme((entry) => longest(entry.words, -1), true)],
    ['slowest', extreme((entry) => longest(entry.words, 1))],
    ['streak', extreme((entry) => count(entry.bestCombo > 1 ? entry.bestCombo : 0))],
    ['sheep', extreme((entry) => count(entry.words.filter((word) => (counts.get(wordId(word)) ?? 0) > 1).length))],
    ['skipper', extreme((entry) => count(entry.skips))],
    ['typos', extreme((entry) => count(entry.words.filter((word) => word.approximate).length))],
  ]
  return awards.flatMap(([id, award]) => (award ? [{ id, ...award }] : []))
}

/** A rival's score at this second of their run: the race replays them as if they were playing now. */
export function scoreAt(words: readonly ChallengeWord[], seconds: number): number {
  let score = 0
  for (const word of words) if (word.at <= seconds) score += word.points
  return score
}

export function challengeXp(score: number): number {
  return Math.round(score * XP_PER_POINT * (1 + CHALLENGE_XP_BONUS))
}

/**
 * A challenge run counts for the level, not for the records: its seed is
 * known in advance, so a score from it proves less than one from a fresh
 * draw. Nor does it lock its prompts for the next solo run.
 */
export function applyChallengeRun(profile: Profile, outcome: RunOutcome): Profile {
  const after = applyRun(profile, { ...outcome, prompts: undefined })
  return { ...after, xp: profile.xp + challengeXp(outcome.score), bestScore: profile.bestScore }
}
