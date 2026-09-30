import { describe, expect, it } from 'vitest'
import { appendRecord, HISTORY_LIMIT, listedHistory, mergeHistory, parseRecord, summarize, type RunRecord } from './history'

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
  it('ranks the words said more than twice, per language', () => {
    const said = (word: string, times: number, lang = 'fr') =>
      Array.from({ length: times }, () => record(10, [['animaux', word, 10]], lang))
    const history = [...said('chat', 4), ...said('chien', 3), ...said('chat', 3, 'en'), ...said('lion', 2)]
    const { topWords } = summarize(history)
    expect(topWords.map((word) => [word.word, word.count])).toEqual([
      ['chat', 4],
      ['chien', 3],
      ['chat', 3],
    ])
  })

  it('keeps the list hidden with fewer than three repeated words, and to ten at most', () => {
    const said = (word: string, times: number) => Array.from({ length: times }, () => record(10, [['animaux', word, 10]]))
    expect(summarize([...said('chat', 5), ...said('chien', 3), ...said('lion', 2)]).topWords).toEqual([])
    const many = Array.from({ length: 12 }, (_, index) => said(`mot${index}`, 3)).flat()
    expect(summarize(many).topWords).toHaveLength(10)
  })

  it('counts the prompts each category left without a word', () => {
    const run = {
      ...record(10, [['pays', 'chili', 10]]),
      prompts: [
        { prompt: { categoryId: 'pays', letter: 'C' }, passed: false },
        { prompt: { categoryId: 'pays', letter: 'Z' }, passed: true },
        { prompt: { categoryId: 'pays', letter: 'X' }, passed: true },
        { prompt: { categoryId: 'pays', letter: 'B' }, passed: false },
      ],
    }
    const { categories } = summarize([run, record(10, [['animaux', 'chat', 10]])])
    expect(categories.find((stats) => stats.categoryId === 'pays')?.passRate).toBe(0.5)
    expect(categories.find((stats) => stats.categoryId === 'animaux')?.passRate).toBeNull()
  })

  it('reads back the prompts a record kept, and none from an older one', () => {
    const prompts = [{ prompt: { categoryId: 'pays', letter: 'C' }, passed: true }]
    expect(parseRecord(JSON.parse(JSON.stringify({ ...record(10), prompts })))?.prompts).toEqual(prompts)
    expect(parseRecord(JSON.parse(JSON.stringify(record(10))))?.prompts).toBeUndefined()
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

  it('averages the time a category takes to answer, ignoring untimed words', () => {
    const timed = (seconds: number | undefined) => ({ categoryId: 'pays', word: 'chili', display: 'chili', points: 10, seconds })
    const run = { ...record(30), categoryIds: ['pays'], words: [timed(4), timed(8), timed(undefined)] }
    const { categories } = summarize([run, record(10, [['animaux', 'chat', 10]])])

    expect(categories.find((stats) => stats.categoryId === 'pays')?.averageSeconds).toBe(6)
    expect(categories.find((stats) => stats.categoryId === 'animaux')?.averageSeconds).toBeNull()
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

describe('listedHistory', () => {
  const many = Array.from({ length: 35 }, (_, i) => record(i))

  it('shows the twenty last runs, even though the figures compare ten', () => {
    expect(listedHistory(many).map((run) => run.score)).toEqual(many.slice(0, 20).map((run) => run.score))
    expect(summarize(many).recent).toHaveLength(10)
  })

  it('shows the whole device history when it reaches no further', () => {
    expect(listedHistory(many.slice(0, 7))).toHaveLength(7)
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

describe('parseRecord', () => {
  it('reads back what a device wrote, seconds included', () => {
    const played = { categoryId: 'pays', word: 'chili', display: 'Chili', points: 10, seconds: 4 }
    const raw = { at: 12, lang: 'fr', score: 30, bestCombo: 2, skips: 1, categoryIds: ['pays'], words: [played] }
    expect(parseRecord(raw)).toEqual(raw)
  })

  it('drops a run the server mangled rather than the whole answer', () => {
    expect(parseRecord(null)).toBeNull()
    expect(parseRecord([])).toBeNull()
    expect(parseRecord({ at: 1, lang: 'fr', score: 1, bestCombo: 0, skips: 'deux', categoryIds: [], words: [] })).toBeNull()
    expect(parseRecord({ at: 1, lang: 'fr', score: 1, bestCombo: 0, skips: 0, categoryIds: 'pays', words: [] })).toBeNull()
  })

  it('keeps the sound words of a run that also holds a broken one', () => {
    const raw = { at: 1, lang: 'fr', score: 10, bestCombo: 0, skips: 0, categoryIds: [], words: [{ categoryId: 'pays', word: 'chili' }, 'nope'] }
    expect(parseRecord(raw)?.words).toEqual([])
  })
})

describe('mergeHistory', () => {
  const HOUR = 60 * 60 * 1000
  const run = (at: number, score = 10): RunRecord => ({ ...record(score), at })

  it('adds the account runs the device never played, newest first', () => {
    const merged = mergeHistory([run(3 * HOUR), run(2 * HOUR)], [run(2.5 * HOUR), run(HOUR)])
    expect(merged.map((entry) => entry.at)).toEqual([3 * HOUR, 2.5 * HOUR, 2 * HOUR, HOUR])
  })

  it('never counts the same run twice', () => {
    const device = run(10 * HOUR)
    // Le même instant, à l'horloge de l'appareil près, et le même score : la copie du serveur s'efface.
    expect(mergeHistory([device], [{ ...device, at: 10 * HOUR + 1_000 }])).toHaveLength(1)
    // A different score at the same moment is another run.
    expect(mergeHistory([device], [{ ...device, score: 99 }])).toHaveLength(2)
  })
})
