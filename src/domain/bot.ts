import { createRng } from './rng'
import { createRun, remainingSeconds, skip, submit, type Judge, type Run } from './run'

/** Seconds a house bot takes on a prompt, at least and at most. */
const THINK_SECONDS: readonly [number, number] = [3, 9]
/** Share of prompts it answers; the rest it skips. */
const ANSWER_CHANCE = 0.7

/** An id as a seed: FNV-1a, so each bot plays its own game on a given challenge. */
function hashId(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193)
  return hash >>> 0
}

/**
 * A house bot's challenge run. The server only marks it played: every client
 * plays it again from the challenge's seed and the bot's id, which is why the
 * judge must be the same everywhere — no usage counts, no community words.
 * It answers with the best-known word left, as anyone who knows it would.
 */
export function playBot(seed: number, categoryIds: readonly string[], botId: string, judge: Judge): Run {
  const rng = createRng((seed ^ hashId(botId)) >>> 0)
  let run = createRun({ seed, categoryIds, shared: true }, judge)
  let clock = 0
  for (;;) {
    const at = clock + THINK_SECONDS[0] + rng.next() * (THINK_SECONDS[1] - THINK_SECONDS[0])
    const answers = rng.next() < ANSWER_CHANCE
    if (remainingSeconds(run, at) <= 0) return run
    clock = Math.round(at * 10) / 10
    const word = answers ? judge.common?.(run.prompt.categoryId, run.prompt.letter, run.used) : null
    const played = word ? submit(run, word, judge, clock) : null
    run = played?.verdict.kind === 'accepted' ? played.run : skip(run, judge, clock)
  }
}
