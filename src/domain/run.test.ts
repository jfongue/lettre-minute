import { describe, expect, it } from 'vitest'
import { PLAYABLE_LETTERS } from './letters'
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
import { buildWordPack, findWord, lettersWithEnough, type WordPack } from './words'

/** A pack with enough words per letter that every letter can be prompted. */
function packOf(categoryId: string, words: readonly string[]): WordPack {
  return buildWordPack(categoryId, words.map((word) => [word, 50, 1] as const))
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
      return pack ? findWord(pack, word) : null
    },
    usage: (word) => usage[word] ?? NO_USAGE,
    deck: PLAYABLE_LETTERS,
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

describe('formes fléchies', () => {
  it('refuses the plural of a word already answered', () => {
    const pack = buildWordPack('animaux', [['Canard', 50, 1], ['Canards', 50, 0.5, 'canard']])
    const only: Judge = {
      find: (_, word) => findWord(pack, word),
      usage: () => NO_USAGE,
      letters: () => ['C'],
      deck: PLAYABLE_LETTERS,
    }
    let run = createRun({ seed: 1, categoryIds: ['animaux'] }, only)
    run = submit(run, 'canard', only).run

    expect(run.found[0]!.word).toBe('canard')
    expect(inspect({ ...run, prompt: { categoryId: 'animaux', letter: 'C' } }, 'canards', only).kind).toBe('already')
  })
})

describe('orthographe approchée', () => {
  const pack = buildWordPack('animaux', [['Libellule', 0, 2.16], ['Lynx', 60, 1]])
  const soft: Judge = {
    find: (_, word) => findWord(pack, word),
    usage: () => NO_USAGE,
    letters: () => ['L'],
    deck: PLAYABLE_LETTERS,
  }

  it('accepts a one-letter slip and pays it the flat rate', () => {
    const run = { ...createRun({ seed: 1, categoryIds: ['animaux'] }, soft), prompt: { categoryId: 'animaux', letter: 'L' } }
    const exact = inspect(run, 'libellule', soft)
    const slipped = inspect(run, 'libelule', soft)

    expect(slipped.kind).toBe('accepted')
    expect(slipped.found?.display).toBe('Libellule')
    expect(slipped.found?.approximate).toBe(true)
    expect(slipped.found?.tier).toBe('courant')
    expect(slipped.found!.points).toBeLessThan(exact.found!.points)
  })

  it('counts a corrected answer as the word itself', () => {
    const run = { ...createRun({ seed: 2, categoryIds: ['animaux'] }, soft), prompt: { categoryId: 'animaux', letter: 'L' } }
    const played = submit(run, 'libelule', soft)

    expect(played.run.used).toEqual(['libellule'])
    expect(inspect(played.run, 'libellule', soft).kind).toBe('already')
  })

  it('times a word from the moment its prompt appeared, a skip included', () => {
    const run = createRun({ seed: 3, categoryIds: ['animaux'] }, soft)
    const skipped = { ...skip(run, soft, 7), prompt: { categoryId: 'animaux', letter: 'L' } }
    const played = submit(skipped, 'libellule', soft, 19)

    expect(played.run.found[0]?.seconds).toBe(12)
    expect(played.run.promptAt).toBe(19)
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

describe('prompts locked from the previous run', () => {
  function playThrough(run: Run, steps: number): Run {
    let current = run
    for (let i = 0; i < steps; i++) current = skip(current, judge)
    return current
  }

  it('never deals a pair the previous run dealt', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const previous = playThrough(createRun({ seed, categoryIds: ['animaux', 'pays'] }, judge), 12)
      const next = playThrough(
        createRun({ seed: seed + 1000, categoryIds: ['animaux', 'pays'], avoid: previous.dealt }, judge),
        12,
      )
      for (const key of next.dealt) expect(previous.dealt).not.toContain(key)
    }
  })

  it('remembers every prompt it dealt, skipped ones included', () => {
    const run = createRun({ seed: 3, categoryIds: ['animaux', 'pays'] }, judge)
    const skipped = skip(run, judge)
    expect(skipped.dealt).toEqual([
      `${run.prompt.categoryId}:${run.prompt.letter}`,
      `${skipped.prompt.categoryId}:${skipped.prompt.letter}`,
    ])
  })

  it('gives way when a category has no other letter left', () => {
    const everything = LETTERS.map((letter) => `animaux:${letter}`)
    const run = createRun({ seed: 5, categoryIds: ['animaux'], avoid: everything }, judge)
    expect(LETTERS).toContain(run.prompt.letter)
  })
})
