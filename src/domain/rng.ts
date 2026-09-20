/**
 * Deterministic RNG. The domain never reaches for Math.random: a match is
 * reproducible from its seed alone, which is what makes the draws testable and
 * what would let two devices deal the same cards later on.
 */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** A distinct stream per round, so a round's draw never depends on the previous ones. */
export function streamFor(seed: number, index: number): Rng {
  return createRng((seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0)
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, weightOf(item)), 0)
  if (total <= 0) return null

  let roll = rng.next() * total
  for (const item of items) {
    roll -= Math.max(0, weightOf(item))
    if (roll < 0) return item
  }
  return items[items.length - 1] ?? null
}

/** Fisher-Yates on a copy — the input order is part of the seed, so it stays untouched. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
