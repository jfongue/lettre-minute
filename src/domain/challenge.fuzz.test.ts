import { describe, expect, it } from 'vitest'
import { awardTrophies, mostSharedWords, scoreAt, settleChallenge, uniqueWords, type ChallengeEntry, type ChallengeWord } from './challenge'
import type { RarityTier } from './rarity'
import { createRng, type Rng } from './rng'

/**
 * Random challenges between up to eight players drawing from a small common
 * pool, so that words overlap as they do on one seed. Whatever the runs, the
 * Petit Bac settlement must only ever add the unique-word bonus to what was actually scored.
 */
const TIERS: readonly RarityTier[] = ['courant', 'peu commun', 'rare', 'très rare']
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng.next() * items.length)]!

function wordOf(rng: Rng, at: number): ChallengeWord {
  const key = `mot${Math.floor(rng.next() * 12)}`
  return {
    categoryId: pick(rng, ['animaux', 'pays']),
    letter: 'M',
    key,
    display: key,
    points: 10 + Math.floor(rng.next() * 60),
    tier: pick(rng, TIERS),
    approximate: rng.next() < 0.15,
    seconds: Math.floor(rng.next() * 20),
    at,
  }
}

function entryOf(rng: Rng, index: number): ChallengeEntry {
  const words: ChallengeWord[] = []
  let at = 0
  for (let i = Math.floor(rng.next() * 9); i > 0; i--) {
    at += 1 + Math.floor(rng.next() * 8)
    const word = wordOf(rng, at)
    // A run never scores the same key twice in a category.
    if (!words.some((known) => known.categoryId === word.categoryId && known.key === word.key)) words.push(word)
  }
  return {
    playerId: `p${index}`,
    playedAt: rng.next() < 0.15 ? null : Math.floor(rng.next() * 1000),
    score: words.reduce((sum, word) => sum + word.points, 0),
    skips: Math.floor(rng.next() * 4),
    bestCombo: Math.floor(rng.next() * 8),
    words,
  }
}

function check(seed: number): void {
  const rng = createRng(seed)
  const entries = Array.from({ length: 1 + Math.floor(rng.next() * 8) }, (_, i) => entryOf(rng, i))
  const played = entries.filter((entry) => entry.playedAt !== null)
  const tag = `seed=${seed}`

  const standings = settleChallenge(entries)
  expect(standings.map((row) => row.playerId).sort(), tag).toEqual(played.map((entry) => entry.playerId).sort())
  for (let i = 1; i < standings.length; i++) expect(standings[i - 1]!.score, `${tag} unsorted`).toBeGreaterThanOrEqual(standings[i]!.score)
  for (const row of standings) {
    expect(row.score, `${tag} settled below raw`).toBeGreaterThanOrEqual(row.raw)
    expect(row.unique + row.shared, tag).toBe(row.words.length)
    for (const word of row.words) {
      const bonus = word.sharedWith === 0 && played.length > 1
      expect(word.settled, tag).toBe(bonus ? Math.round(word.points * 1.25) : word.points)
    }
  }
  if (played.length === 1) expect(standings[0]!.score, `${tag} alone yet shared`).toBe(standings[0]!.raw)

  const ghost: ChallengeEntry = { playerId: 'ghost', playedAt: null, score: 0, skips: 0, bestCombo: 0, words: [wordOf(rng, 1)] }
  expect(settleChallenge([...entries, ghost]), `${tag} an unplayed entry changed the standings`).toEqual(standings)

  for (const word of mostSharedWords(entries, 99)) {
    expect(word.players.length, tag).toBeGreaterThan(1)
    expect(new Set(word.players).size, tag).toBe(word.players.length)
  }
  for (const word of uniqueWords(entries, 99)) expect(word.players.length, tag).toBe(1)

  const trophies = awardTrophies(entries)
  if (played.length < 2) expect(trophies, tag).toEqual([])
  expect(new Set(trophies.map((trophy) => trophy.id)).size, `${tag} a trophy given twice`).toBe(trophies.length)
  for (const trophy of trophies) {
    expect(played.map((entry) => entry.playerId), `${tag} ${trophy.id} to an unplayed entry`).toContain(trophy.playerId)
    expect(Number.isFinite(trophy.value), `${tag} ${trophy.id}`).toBe(true)
  }

  for (const entry of played) {
    let previous = 0
    for (let second = 0; second <= 70; second += 5) {
      const score = scoreAt(entry.words, second)
      expect(score, `${tag} the race went backwards`).toBeGreaterThanOrEqual(previous)
      previous = score
    }
    expect(previous, `${tag} the race does not end on the run's score`).toBe(entry.score)
  }
}

describe('fuzz: challenges settled whatever the runs', () => {
  it('splits shared words fairly and awards each trophy once', () => {
    const master = createRng(Number(process.env.FUZZ_SEED ?? 20260924) >>> 0)
    const challenges = Number(process.env.FUZZ_RUNS ?? 40) * 5
    for (let i = 0; i < challenges; i++) check(Math.floor(master.next() * 2 ** 32))
  }, 5_000 + Number(process.env.FUZZ_RUNS ?? 40) * 10)
})
