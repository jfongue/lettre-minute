import type { Run, SettledPrompt } from './run'

export interface PlayedWord {
  categoryId: string
  /** The canonical form (`WordEntry.key`): "chats" and "chat" count as one word. */
  word: string
  display: string
  points: number
  /** How long its prompt stayed up before it came; absent from runs recorded before it was kept. */
  seconds?: number
  /** The dictionary corrected a slip to accept it; absent from runs recorded before it was kept. */
  approximate?: boolean
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
  /** The prompts the run moved on from, in order; absent from runs recorded before it was kept. */
  prompts?: readonly SettledPrompt[]
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
      approximate: found.approximate,
    })),
    prompts: run.settled,
  }
}

/** Newest first; the oldest runs go once the device holds this many. */
export const HISTORY_LIMIT = 2000

/**
 * What the statistics page is guaranteed to cover, whatever the device kept:
 * the last twenty runs, or everything since three days ago — whichever
 * reaches further back. A phone that just signed in has no history of its own,
 * and the account's runs fill that window.
 */
export const RECENT_MIN_RUNS = 20
export const RECENT_MIN_DAYS = 3

export function appendRecord(history: readonly RunRecord[], record: RunRecord): RunRecord[] {
  return [record, ...history].slice(0, HISTORY_LIMIT)
}

/**
 * Reads a run record as the server holds it, where anything may have been
 * written: one malformed run is dropped, not the whole answer.
 */
export function parseRecord(raw: unknown): RunRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Record<string, unknown>
  const count = (field: unknown) => (typeof field === 'number' && Number.isFinite(field) && field >= 0 ? field : null)
  const at = count(value.at)
  const score = count(value.score)
  const bestCombo = count(value.bestCombo)
  const skips = count(value.skips)
  if (at === null || score === null || bestCombo === null || skips === null) return null
  if (typeof value.lang !== 'string' || !Array.isArray(value.categoryIds) || !Array.isArray(value.words)) return null
  return {
    at,
    lang: value.lang,
    score,
    bestCombo,
    skips,
    categoryIds: value.categoryIds.filter((id): id is string => typeof id === 'string'),
    words: value.words.flatMap((word: unknown) => {
      if (!word || typeof word !== 'object') return []
      const played = word as Record<string, unknown>
      const points = count(played.points)
      if (typeof played.categoryId !== 'string' || typeof played.word !== 'string' || typeof played.display !== 'string' || points === null)
        return []
      const seconds = count(played.seconds)
      return [{
        categoryId: played.categoryId,
        word: played.word,
        display: played.display,
        points,
        ...(seconds === null ? {} : { seconds }),
        ...(typeof played.approximate === 'boolean' ? { approximate: played.approximate } : {}),
      }]
    }),
    ...(Array.isArray(value.prompts) ? { prompts: value.prompts.flatMap(parseSettled) } : {}),
  }
}

function parseSettled(raw: unknown): SettledPrompt[] {
  if (!raw || typeof raw !== 'object') return []
  const settled = raw as Record<string, unknown>
  const prompt = (settled.prompt ?? {}) as Record<string, unknown>
  if (typeof prompt.categoryId !== 'string' || typeof prompt.letter !== 'string' || typeof settled.passed !== 'boolean') return []
  return [{ prompt: { categoryId: prompt.categoryId, letter: prompt.letter }, passed: settled.passed }]
}

// Une partie remontée du serveur porte l'instant que son appareil lui a donné ;
// les deux copies de la même partie se reconnaissent à cet instant, large d'une
// horloge d'appareil un peu déréglée, et à ce qu'elle a marqué.
const SAME_RUN_MS = 5 * 60_000

function sameRun(one: RunRecord, other: RunRecord): boolean {
  return (
    one.score === other.score &&
    one.bestCombo === other.bestCombo &&
    one.skips === other.skips &&
    one.words.length === other.words.length &&
    Math.abs(one.at - other.at) <= SAME_RUN_MS
  )
}

/** The device's runs and the account's, newest first, without counting one twice. */
export function mergeHistory(local: readonly RunRecord[], incoming: readonly RunRecord[]): RunRecord[] {
  const kept = [...local]
  for (const run of incoming) {
    if (!kept.some((held) => sameRun(held, run))) kept.push(run)
  }
  return kept.sort((one, other) => other.at - one.at).slice(0, HISTORY_LIMIT)
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
  /** Share of its prompts left without a word, from 0 to 1; null until a run records its prompts. */
  passRate: number | null
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
/** The words said more than twice, the ten most said at most. */
export const TOP_WORDS = 10
export const TOP_WORD_MIN_COUNT = 3
/** Fewer repeated words than this say nothing about the player: the list stays hidden. */
export const TOP_WORDS_SHOWN = 3

/**
 * Ce que la page liste sans qu'on le demande : les figures restent sur les dix
 * que compare la tendance, la liste montre au moins les vingt dont le compte
 * répond, sinon un téléphone fraîchement connecté croirait n'avoir rien joué.
 */
export const LISTED_RUNS = Math.max(RECENT_RUNS, RECENT_MIN_RUNS)

/** The runs the statistics show unfolded, newest first. */
export function listedHistory(history: readonly RunRecord[]): RunRecord[] {
  return history.slice(0, LISTED_RUNS)
}

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
  const passing = new Map<string, { prompts: number; passed: number }>()
  const category = (id: string) => {
    let stats = categories.get(id)
    if (!stats) {
      categories.set(id, (stats = { categoryId: id, runs: 0, words: 0, points: 0, bestWord: null, averageSeconds: null, passRate: null }))
    }
    return stats
  }

  for (const run of history) {
    for (const id of run.categoryIds) category(id).runs++
    for (const { prompt, passed } of run.prompts ?? []) {
      const tally = passing.get(prompt.categoryId) ?? { prompts: 0, passed: 0 }
      tally.prompts++
      if (passed) tally.passed++
      passing.set(prompt.categoryId, tally)
    }
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
  for (const [id, tally] of passing) category(id).passRate = tally.passed / tally.prompts
  const repeated = [...counts.values()].filter((word) => word.count >= TOP_WORD_MIN_COUNT).sort((a, b) => b.count - a.count)

  return {
    recent,
    recentAverage: mean(recent),
    trend: recent.length > 0 && before.length > 0 ? mean(recent) - mean(before) : null,
    topWords: repeated.length >= TOP_WORDS_SHOWN ? repeated.slice(0, TOP_WORDS) : [],
    categories: [...categories.values()].sort((a, b) => b.points - a.points || b.runs - a.runs),
  }
}
