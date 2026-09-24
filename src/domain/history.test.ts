import { describe, expect, it } from 'vitest'
import { appendRecord, HISTORY_LIMIT, summarize, type RunRecord } from './history'

function record(score: number, words: [categoryId: string, word: string, points: number][] = [], lang = 'fr'): RunRecord {
  return {
    at: 0,
    lang,
    score,
    bestCombo: 0,
    skips: 0,
    categoryIds: [...new Set(words.map(([categoryId]) => categoryId))],
    words: words.map(([categoryId, word, points]) => ({ categoryId, word, display: word, points })),
  }
}

describe('summarize', () => {
  it('ranks the words said most often, per language', () => {
    const history = [
      record(30, [['animaux', 'chat', 10], ['animaux', 'chien', 10]]),
      record(20, [['animaux', 'chat', 10]]),
      record(20, [['animaux', 'chat', 10]], 'en'),
      record(10, [['pays', 'chili', 10], ['animaux', 'chien', 10]]),
    ]
    const { topWords } = summarize(history)
    expect(topWords.map((word) => [word.word, word.count])).toEqual([
      ['chat', 2],
      ['chien', 2],
      ['chat', 1],
    ])
  })

  it('totals each category and keeps its best word', () => {
    const { categories } = summarize([
      record(50, [['animaux', 'chat', 10], ['pays', 'chili', 40]]),
      record(10, [['animaux', 'chien', 10]]),
    ])
    expect(categories.map((stats) => [stats.categoryId, stats.runs, stats.words, stats.points])).toEqual([
      ['pays', 1, 1, 40],
      ['animaux', 2, 2, 20],
    ])
    expect(categories[0]!.bestWord?.word).toBe('chili')
  })

  it('compares the recent runs with those just before', () => {
    const history = [...Array.from({ length: 10 }, () => record(60)), ...Array.from({ length: 10 }, () => record(40))]
    const summary = summarize(history)
    expect(summary.recent).toHaveLength(10)
    expect(summary.recentAverage).toBe(60)
    expect(summary.trend).toBe(20)
    expect(summarize(history.slice(0, 10)).trend).toBeNull()
  })

  it('has nothing to say before the first run', () => {
    expect(summarize([])).toEqual({ recent: [], recentAverage: 0, trend: null, topWords: [], categories: [] })
  })
})

describe('appendRecord', () => {
  it('puts the new run first and forgets the oldest past the limit', () => {
    const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => record(i))
    const next = appendRecord(full, record(-1))
    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next[0]!.score).toBe(-1)
    expect(next.at(-1)!.score).toBe(HISTORY_LIMIT - 2)
  })
})
