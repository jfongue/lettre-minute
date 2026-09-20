import type { Card } from './card'
import { initialOf, normalizeWord } from './text'

export const POINTS_SHARED = 1
export const POINTS_UNIQUE = 2
/** Filling the three categories is worth a nudge of its own, so a full sheet beats two lucky words. */
export const BONUS_FULL_CARD = 1

export type AnswerStatus = 'blank' | 'wrong-letter' | 'shared' | 'unique'

export interface RoundAnswers {
  playerId: string
  /** One entry per category of the card, in the card's order. Empty string means nothing written. */
  words: readonly string[]
}

export interface ScoredAnswer {
  word: string
  status: AnswerStatus
  points: number
}

export interface PlayerRoundScore {
  playerId: string
  answers: readonly ScoredAnswer[]
  bonus: number
  total: number
}

function statusOf(word: string, letter: string, sharers: number): AnswerStatus {
  if (normalizeWord(word) === '') return 'blank'
  if (initialOf(word) !== letter.toUpperCase()) return 'wrong-letter'
  return sharers > 1 ? 'shared' : 'unique'
}

function pointsOf(status: AnswerStatus): number {
  switch (status) {
    case 'unique':
      return POINTS_UNIQUE
    case 'shared':
      return POINTS_SHARED
    default:
      return 0
  }
}

export function scoreRound(card: Card, answers: readonly RoundAnswers[]): PlayerRoundScore[] {
  const sharersByCategory = card.categories.map((_, index) => {
    const counts = new Map<string, number>()
    for (const entry of answers) {
      const word = normalizeWord(entry.words[index] ?? '')
      if (word === '' || initialOf(word) !== card.letter.toUpperCase()) continue
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
    return counts
  })

  return answers.map((entry) => {
    const scored = card.categories.map((_, index) => {
      const word = entry.words[index] ?? ''
      const sharers = sharersByCategory[index]!.get(normalizeWord(word)) ?? 0
      const status = statusOf(word, card.letter, sharers)
      return { word: word.trim(), status, points: pointsOf(status) }
    })

    const counted = scored.filter((answer) => answer.status === 'shared' || answer.status === 'unique')
    const bonus = counted.length === card.categories.length ? BONUS_FULL_CARD : 0
    return {
      playerId: entry.playerId,
      answers: scored,
      bonus,
      total: scored.reduce((sum, answer) => sum + answer.points, 0) + bonus,
    }
  })
}
