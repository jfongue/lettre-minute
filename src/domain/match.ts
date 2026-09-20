import { drawCard, type Card } from './card'
import { streamFor } from './rng'
import { scoreRound, type PlayerRoundScore, type RoundAnswers } from './scoring'

export interface Player {
  id: string
  name: string
}

export interface MatchSettings {
  rounds: number
  seconds: number
}

/** 94 seconds is the round every player already has in the ear; the others are for tables in a hurry or not. */
export const DURATION_CHOICES: readonly number[] = [60, 94, 120]
export const ROUND_CHOICES: readonly number[] = [3, 5, 8]
export const DEFAULT_SETTINGS: MatchSettings = { rounds: 5, seconds: 94 }

export interface RoundRecord {
  card: Card
  scores: readonly PlayerRoundScore[]
}

export interface Match {
  seed: number
  settings: MatchSettings
  players: readonly Player[]
  history: readonly RoundRecord[]
  /** The card being played. Once the last round is recorded it stays as a memento. */
  card: Card
}

export interface CreateMatchInput {
  seed: number
  players: readonly Player[]
  settings?: MatchSettings
}

export function createMatch({ seed, players, settings = DEFAULT_SETTINGS }: CreateMatchInput): Match {
  return { seed, settings, players, history: [], card: drawCard(streamFor(seed, 0)) }
}

export function roundNumber(match: Match): number {
  return Math.min(match.history.length + 1, match.settings.rounds)
}

export function isOver(match: Match): boolean {
  return match.history.length >= match.settings.rounds
}

export function recordRound(match: Match, answers: readonly RoundAnswers[]): Match {
  const history = [...match.history, { card: match.card, scores: scoreRound(match.card, answers) }]
  const next = { ...match, history }
  if (isOver(next)) return next

  return {
    ...next,
    card: drawCard(streamFor(match.seed, history.length), {
      usedCategoryIds: history.flatMap((round) => round.card.categories.map((category) => category.id)),
      usedLetters: history.map((round) => round.card.letter),
    }),
  }
}

export interface Standing {
  player: Player
  points: number
  /** Shared by tied players, so two firsts are both announced as first. */
  rank: number
}

export function standings(match: Match): Standing[] {
  const totals = new Map<string, number>(match.players.map((player) => [player.id, 0]))
  for (const round of match.history) {
    for (const score of round.scores) {
      totals.set(score.playerId, (totals.get(score.playerId) ?? 0) + score.total)
    }
  }

  // Ties keep the seating order rather than falling back on the name, so the
  // board never reshuffles itself between two rounds at equal score.
  const ordered = match.players
    .map((player) => ({ player, points: totals.get(player.id) ?? 0 }))
    .sort((a, b) => b.points - a.points)

  let rank = 0
  let previous: number | null = null
  return ordered.map((entry, index) => {
    if (entry.points !== previous) {
      rank = index + 1
      previous = entry.points
    }
    return { ...entry, rank }
  })
}
