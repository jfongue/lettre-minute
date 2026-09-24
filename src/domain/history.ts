import type { Run } from './run'

export interface PlayedWord {
  categoryId: string
  /** The canonical form (`WordEntry.key`): "chats" and "chat" count as one word. */
  word: string
  display: string
  points: number
  /** How long its prompt stayed up before it came; absent from runs recorded before it was kept. */
  seconds?: number
}

/** A finished run, as the statistics remember it. */
export interface RunRecord {
  at: number
  lang: string
  score: number
  bestCombo: number
  skips: number
  categoryIds: readonly string[]
  words: readonly PlayedWord[]
}

export function recordOf(run: Run, at: number, lang: string): RunRecord {
  return {
    at,
    lang,
    score: run.score,
    bestCombo: run.bestCombo,
    skips: run.skips,
    categoryIds: run.categoryIds,
    words: run.found.map((found) => ({
      categoryId: found.prompt.categoryId,
      word: found.word,
      display: found.display,
      points: found.points,
      seconds: found.seconds,
    })),
  }
}

/** Newest first; the oldest runs go once the device holds this many. */
export const HISTORY_LIMIT = 2000

export function appendRecord(history: readonly RunRecord[], record: RunRecord): RunRecord[] {
  return [record, ...history].slice(0, HISTORY_LIMIT)
}

export interface WordCount {
  word: string
  display: string
  count: number
}

export interface CategoryStats {
  categoryId: string
  /** Runs that dealt this category. */
  runs: number
  words: number
  points: number
  bestWord: PlayedWord | null
  /** Mean seconds from a prompt to the word that answered it; null until a timed word is recorded. */
  averageSeconds: number | null
}

export interface Summary {
  recent: readonly RunRecord[]
  /** Mean score of `recent`, 0 when there is none. */
  recentAverage: number
  /** How `recent` compares with the runs just before it, in points; null without enough of either. */
  trend: number | null
  topWords: readonly WordCount[]
  categories: readonly CategoryStats[]
}

export const RECENT_RUNS = 10
export const TOP_WORDS = 3

const mean = (runs: readonly RunRecord[]) =>
  runs.length === 0 ? 0 : runs.reduce((sum, run) => sum + run.score, 0) / runs.length

/** Everything the statistics page shows, from the runs the device remembers (newest first). */
export function summarize(history: readonly RunRecord[]): Summary {
  const recent = history.slice(0, RECENT_RUNS)
  const before = history.slice(RECENT_RUNS, RECENT_RUNS * 2)

  // Counted per language: « chat » in French and « chat » in English are two words.
  const counts = new Map<string, WordCount>()
  const categories = new Map<string, CategoryStats>()
  const timing = new Map<string, { words: number; seconds: number }>()
  const category = (id: string) => {
    let stats = categories.get(id)
    if (!stats) {
      categories.set(id, (stats = { categoryId: id, runs: 0, words: 0, points: 0, bestWord: null, averageSeconds: null }))
    }
    return stats
  }

  for (const run of history) {
    for (const id of run.categoryIds) category(id).runs++
    for (const played of run.words) {
      const key = `${run.lang}:${played.word}`
      const count = counts.get(key)
      if (count) count.count++
      // Newest first: the display kept is the latest spelling the player saw.
      else counts.set(key, { word: played.word, display: played.display, count: 1 })

      const stats = category(played.categoryId)
      stats.words++
      stats.points += played.points
      if (!stats.bestWord || played.points > stats.bestWord.points) stats.bestWord = played
      if (played.seconds !== undefined) {
        const timed = timing.get(played.categoryId) ?? { words: 0, seconds: 0 }
        timed.words++
        timed.seconds += played.seconds
        timing.set(played.categoryId, timed)
      }
    }
  }
  for (const [id, timed] of timing) category(id).averageSeconds = timed.seconds / timed.words

  return {
    recent,
    recentAverage: mean(recent),
    trend: recent.length > 0 && before.length > 0 ? mean(recent) - mean(before) : null,
    topWords: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, TOP_WORDS),
    categories: [...categories.values()].sort((a, b) => b.points - a.points || b.runs - a.runs),
  }
}
