import { describe, expect, it } from 'vitest'
import { NO_USAGE, type WordUsage } from './rarity'
import {
  createRun,
  inspect,
  MIN_WORDS_PER_PROMPT,
  remainingSeconds,
  RUN_SECONDS,
  SKIP_PENALTY_SECONDS,
  skip,
  submit,
  type Judge,
  type Run,
} from './run'
import { lettersWithEnough, lookup, parseWordPack, type WordPack } from './words'

/** A pack with enough words per letter that every letter can be prompted. */
function packOf(categoryId: string, words: readonly string[]): WordPack {
  return parseWordPack(categoryId, words.map((word) => `${word}|50|1.00`).join('\n'))
}

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const animals = packOf(
  'animaux',
  LETTERS.flatMap((letter) => Array.from({ length: MIN_WORDS_PER_PROMPT }, (_, i) => `${letter}nimal${i}`)),
)
const countries = packOf(
  'pays',
  LETTERS.flatMap((letter) => Array.from({ length: MIN_WORDS_PER_PROMPT }, (_, i) => `${letter}ays${i}`)),
)

function judgeOf(usage: Record<string, WordUsage> = {}): Judge {
  const packs = new Map([
    ['animaux', animals],
    ['pays', countries],
  ])
  return {
    find: (categoryId, word) => {
      const pack = packs.get(categoryId)
      return pack ? lookup(pack, word) : null
    },
    usage: (word) => usage[word] ?? NO_USAGE,
    letters: (categoryId) => {
      const pack = packs.get(categoryId)
      return pack ? lettersWithEnough(pack, MIN_WORDS_PER_PROMPT) : []
    },
  }
}

const judge = judgeOf()

function answerOf(run: Run): string {
  return `${run.prompt.letter}${run.prompt.categoryId === 'pays' ? 'ays' : 'nimal'}0`
}

describe('createRun', () => {
  it('opens on a prompt the dictionary can answer', () => {
    const run = createRun({ seed: 1, categoryIds: ['animaux', 'pays'] }, judge)

    expect(run.categoryIds).toContain(run.prompt.categoryId)
    expect(judge.letters(run.prompt.categoryId)).toContain(run.prompt.letter)
    expect(run.score).toBe(0)
  })

  it('deals the same run twice from the same seed', () => {
    const first = createRun({ seed: 12, categoryIds: ['animaux', 'pays'] }, judge)
    const second = createRun({ seed: 12, categoryIds: ['animaux', 'pays'] }, judge)

    expect(first.prompt).toEqual(second.prompt)
  })
})

describe('inspect', () => {
  const run = createRun({ seed: 3, categoryIds: ['animaux'] }, judge)

  it('says nothing about an empty field', () => {
    expect(inspect(run, '   ', judge).kind).toBe('empty')
  })

  it('refuses a word that does not start with the letter', () => {
    const other = run.prompt.letter === 'A' ? 'Bnimal0' : 'Animal0'

    expect(inspect(run, other, judge).kind).toBe('wrong-letter')
  })

  it('refuses a word the dictionary does not carry', () => {
    expect(inspect(run, `${run.prompt.letter}bracadabrantesque`, judge).kind).toBe('unknown')
  })

  it('accepts a known word and prices it before it is played', () => {
    const verdict = inspect(run, answerOf(run), judge)

    expect(verdict.kind).toBe('accepted')
    expect(verdict.found?.points).toBeGreaterThan(0)
    expect(verdict.found?.tier).toBeTruthy()
  })

  it('does not touch the run', () => {
    const before = { ...run }
    inspect(run, answerOf(run), judge)

    expect(run).toEqual(before)
  })
})

describe('submit', () => {
  it('banks the word, draws a new prompt and chains the combo', () => {
    const run = createRun({ seed: 5, categoryIds: ['animaux', 'pays'] }, judge)
    const played = submit(run, answerOf(run), judge)

    expect(played.verdict.kind).toBe('accepted')
    expect(played.run.score).toBeGreaterThan(0)
    expect(played.run.found).toHaveLength(1)
    expect(played.run.combo).toBe(1)
    expect(played.run.prompt).not.toEqual(run.prompt)
  })

  it('leaves the run untouched when the word is refused', () => {
    const run = createRun({ seed: 6, categoryIds: ['animaux'] }, judge)
    const played = submit(run, 'mot inconnu du dictionnaire', judge)

    expect(played.run).toBe(run)
  })

  it('refuses a word already given in this run', () => {
    let run = createRun({ seed: 7, categoryIds: ['animaux'] }, judge)
    const word = answerOf(run)
    run = submit(run, word, judge).run
    // The same word only comes up again if the letter comes up again.
    const again = { ...run, prompt: { ...run.prompt, letter: word[0]!.toUpperCase() } }

    expect(inspect(again, word, judge).kind).toBe('already')
  })

  it('pays a chained answer more than a cold one', () => {
    const run = createRun({ seed: 8, categoryIds: ['animaux'] }, judge)
    const cold = submit(run, answerOf(run), judge)
    const hot = submit({ ...run, combo: 5 }, answerOf(run), judge)

    expect(hot.run.score).toBeGreaterThan(cold.run.score)
  })
})

describe('skip', () => {
  it('costs clock, breaks the chain and moves on', () => {
    const run = { ...createRun({ seed: 9, categoryIds: ['animaux', 'pays'] }, judge), combo: 4 }
    const after = skip(run, judge)

    expect(after.penaltySeconds).toBe(SKIP_PENALTY_SECONDS)
    expect(after.combo).toBe(0)
    expect(after.skips).toBe(1)
    expect(after.prompt).not.toEqual(run.prompt)
    expect(after.score).toBe(run.score)
  })
})

describe('remainingSeconds', () => {
  it('takes the skips off the clock', () => {
    const run = createRun({ seed: 10, categoryIds: ['animaux'] }, judge)

    expect(remainingSeconds(run, 0)).toBe(RUN_SECONDS)
    expect(remainingSeconds(skip(run, judge), 10)).toBe(RUN_SECONDS - 10 - SKIP_PENALTY_SECONDS)
  })

  it('never goes below zero', () => {
    const run = createRun({ seed: 11, categoryIds: ['animaux'] }, judge)

    expect(remainingSeconds(run, 500)).toBe(0)
  })
})
