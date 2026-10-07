import { describe, expect, it } from 'vitest'
import { NO_USAGE, type WordUsage } from './rarity'
import { PULL_MAX, PULL_MIN } from './prompts'
import {
  arm,
  celerityDue,
  createRun,
  inspect,
  letterShares,
  letterWeight,
  promptOutcomes,
  recall,
  remainingSeconds,
  RUN_SECONDS,
  runScore,
  SKIP_PENALTY_SECONDS,
  reroll,
  skip,
  submit,
  THIN_PROMPT_WORDS,
  type Judge,
  type Run,
} from './run'
import { buildWordPack, findWord, lettersWithEnough, mirrorPack, type WordPack } from './words'
import { ENDURANCE_TIME_BONUS, RECALL_SECONDS } from './modes'
import { compactWord } from './text'

/** A pack with enough words per letter that every letter can be prompted. */
function packOf(categoryId: string, words: readonly string[]): WordPack {
  return buildWordPack(categoryId, words.map((word) => [word, 50, 1] as const))
}

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const PER_LETTER = 12
const animals = packOf(
  'animaux',
  LETTERS.flatMap((letter) => Array.from({ length: PER_LETTER }, (_, i) => `${letter}nimal${i}`)),
)
const countries = packOf(
  'pays',
  LETTERS.flatMap((letter) => Array.from({ length: PER_LETTER }, (_, i) => `${letter}ays${i}`)),
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
    known: () => PER_LETTER,
    letters: (categoryId) => {
      const pack = packs.get(categoryId)
      return pack ? lettersWithEnough(pack, PER_LETTER) : []
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
      known: () => PER_LETTER,
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
    known: () => PER_LETTER,
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
    expect(played.run.found[0]?.at).toBe(19)
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

describe('odds of a pair', () => {
  /** Animals only: C has plenty of known words, Z and Q a handful. */
  function judgeKnowing(known: Record<string, number>): Judge {
    return {
      find: (_, word) => findWord(animals, word),
      usage: () => NO_USAGE,
      letters: () => Object.keys(known),
      known: (_, letter) => known[letter] ?? 0,
    }
  }

  it('deals a rare letter less often, but deals it', () => {
    const odds = judgeKnowing({ C: 300, Z: 3 })
    const counts = { C: 0, Z: 0 }
    for (let seed = 1; seed <= 2000; seed++) {
      counts[createRun({ seed, categoryIds: ['animaux'] }, odds).prompt.letter as 'C' | 'Z']++
    }

    expect(counts.Z).toBeGreaterThan(100)
    expect(counts.C).toBeGreaterThan(counts.Z * 2)
  })

  it('never deals a thin pair twice in a run while another is left', () => {
    const thin = judgeKnowing({ A: 1, B: 2, C: 3, D: THIN_PROMPT_WORDS - 1 })
    let run = createRun({ seed: 9, categoryIds: ['animaux'] }, thin)
    for (let i = 0; i < 3; i++) run = skip(run, thin)

    expect(new Set(run.dealt).size).toBe(4)
  })

  it('keeps a challenge in step whatever letter Magie brought', () => {
    const thin = judgeKnowing({ A: 1, B: 2, C: 3, D: 4, E: 5 })
    const seed = 21
    const plain = createRun({ seed, categoryIds: ['animaux'], powers: ['magic'], shared: true }, thin)
    const magic = reroll(plain, thin, 1)
    let [left, right] = [plain, magic]
    const prompts: [string, string][] = []
    for (let i = 0; i < 3; i++) {
      left = skip(left, thin)
      right = skip(right, thin)
      prompts.push([left.prompt.letter, right.prompt.letter])
    }

    expect(magic.prompt.letter).not.toBe(plain.prompt.letter)
    expect(prompts.every(([a, b]) => a === b)).toBe(true)
  })

  it('lets a well-stocked pair come back', () => {
    const stocked = judgeKnowing({ A: THIN_PROMPT_WORDS, B: THIN_PROMPT_WORDS })
    let run = createRun({ seed: 9, categoryIds: ['animaux'] }, stocked)
    const letters = [run.prompt.letter]
    for (let i = 0; i < 20; i++) letters.push((run = skip(run, stocked)).prompt.letter)

    expect(letters.filter((letter) => letter === 'A').length).toBeGreaterThan(1)
  })

  it('deals a pair players leave empty less often, without ever dropping it', () => {
    const base = judgeKnowing({ A: 50, B: 50 })
    const pulled: Judge = { ...base, pull: (_, letter) => (letter === 'A' ? PULL_MIN : PULL_MAX) }
    const counts = { A: 0, B: 0 }
    for (let seed = 1; seed <= 2000; seed++) {
      counts[createRun({ seed, categoryIds: ['animaux'] }, pulled).prompt.letter as 'A' | 'B']++
    }

    expect(counts.B).toBeGreaterThan(counts.A * 2)
    expect(counts.A).toBeGreaterThan(0)
  })
})

describe('promptOutcomes', () => {
  it('reports the pairs the run settled, and not the one still on screen', () => {
    const run = createRun({ seed: 9, categoryIds: ['animaux', 'pays'] }, judge)
    const answered = submit(run, answerOf(run), judge).run
    const skipped = skip(answered, judge)
    const outcomes = promptOutcomes(skipped)

    expect(outcomes).toEqual([
      { prompt: run.prompt, passed: false },
      { prompt: answered.prompt, passed: true },
    ])
  })

  it('says nothing of a run that left nothing behind', () => {
    expect(promptOutcomes(createRun({ seed: 4, categoryIds: ['animaux'] }, judge))).toEqual([])
  })
})

describe('celerityDue', () => {
  const accepted = (display: string, edits: number): Parameters<typeof celerityDue>[0] => ({
    kind: 'accepted',
    found: {
      prompt: { categoryId: 'animaux', letter: 'E' },
      word: display,
      display,
      points: 1,
      rarity: 0,
      tier: 'courant',
      approximate: edits > 0,
      edits,
      joker: false,
      boost: 1,
    },
  })

  it('validates an exact word and a slip', () => {
    expect(celerityDue(accepted('éléphant', 0), 'Éléphant')).toBe(true)
    expect(celerityDue(accepted('éléphant', 1), 'elephamt')).toBe(true)
    expect(celerityDue(accepted('éléphant', 1), 'elephantt')).toBe(true)
    expect(celerityDue(accepted('éléphant', 2), 'elepant')).toBe(true)
  })

  it('waits for the last letter of a word spelled right so far', () => {
    expect(celerityDue(accepted('éléphant', 1), 'elephan')).toBe(false)
    expect(celerityDue(accepted('éléphant', 1), 'elepant')).toBe(false)
  })

  it('never validates what the dictionary did not accept', () => {
    expect(celerityDue({ kind: 'unknown', found: null }, 'xyz')).toBe(false)
    expect(celerityDue(null, '')).toBe(false)
  })
})

describe('letterShares', () => {
  // « Banane » est connue, « Cactus » ne l'est pas (aucun signal), et « Chats »
  // n'est qu'une forme fléchie de « Chat » : elle ne compte pas pour un mot de
  // plus sous son C.
  const pack = buildWordPack('animaux', [
    ...Array.from({ length: 3 }, (_, i) => [`Abeille${i}`, 50, 1] as const),
    ['Banane', 50, 1],
    ['Cactus', 0, 0],
    ['Chat', 50, 1],
    ['Chats', 50, 1, 'chat'],
  ])

  it('gives each letter its share of the draw', () => {
    const shares = letterShares(pack)
    const total = Math.log2(4) + 2 * Math.log2(2)
    expect(shares.get('A')).toBeCloseTo(Math.log2(4) / total, 10)
    expect(shares.get('B')).toBeCloseTo(Math.log2(2) / total, 10)
    expect(shares.get('C')).toBeCloseTo(Math.log2(2) / total, 10)
    expect([...shares.values()].reduce((sum, share) => sum + share, 0)).toBeCloseTo(1, 10)
  })

  it('leaves out a letter the draw would never take', () => {
    expect(letterShares(pack).has('D')).toBe(false)
  })
})

describe('les modes de la réserve', () => {
  /** Une catégorie dont chaque lettre finit douze mots : de quoi tirer par la fin. */
  const endings = packOf(
    'animaux',
    LETTERS.flatMap((letter) => Array.from({ length: PER_LETTER }, (_, i) => `Animal${i}${letter}`)),
  )

  /** Le même dictionnaire jugé sur la dernière lettre, comme le fait `createJudge`. */
  function reversedJudgeOf(): Judge {
    const pack = mirrorPack(endings)
    return {
      find: (categoryId, word) =>
        categoryId === 'animaux' ? findWord(pack, [...compactWord(word)].reverse().join('')) : null,
      usage: () => NO_USAGE,
      known: () => PER_LETTER,
      letters: () => lettersWithEnough(pack, PER_LETTER),
    }
  }

  it('retard : la question affichée part sans réponse, et c’est elle qu’on joue ensuite', () => {
    const run = createRun({ seed: 5, mode: 'delayed', categoryIds: ['animaux'] }, judge)
    expect(run.armed).toBe(false)
    expect(inspect(run, '', judge)).toEqual({ kind: 'empty', found: null })
    // Le texte ne lance rien : la question part à vide, et le champ le dit.
    expect(inspect(run, 'Rien', judge)).toEqual({ kind: 'must-empty', found: null })
    expect(arm(run, judge, 'Rien')).toBe(run)
    expect(skip(run, judge)).toBe(run)

    const started = arm(run, judge)
    expect(started.armed).toBe(true)
    expect(started.answer).toEqual(run.prompt)
    expect(started.drawn).toBe(2)
    // Le champ répond à la question quittée, pas à celle de l'écran.
    expect(inspect(started, answerOf(run), judge).kind).toBe('accepted')
    expect(submit(started, answerOf(run), judge).run.score).toBeGreaterThan(0)
  })

  it('endurance : un mot rend des secondes selon sa rareté', () => {
    const run = createRun({ seed: 3, mode: 'endurance', categoryIds: ['animaux'] }, judge)
    expect(remainingSeconds(run, 0)).toBe(30)

    const played = submit(run, answerOf(run), judge)
    expect(played.verdict.kind).toBe('accepted')
    const bonus = played.verdict.found ? ENDURANCE_TIME_BONUS[played.verdict.found.tier] : 0
    expect(bonus).toBeGreaterThan(0)
    expect(played.run.bonusSeconds).toBe(bonus)
    expect(remainingSeconds(played.run, 1)).toBe(29 + bonus)
    // Le score du mode est le temps tenu, pas les points des mots.
    expect(runScore(played.run)).toBe(30 + bonus)
    expect(runScore(played.run)).not.toBe(played.run.score)
  })

  it('endurance : le score ne descend jamais sous zéro', () => {
    const run = { ...createRun({ seed: 4, mode: 'endurance', categoryIds: ['animaux'] }, judge), penaltySeconds: 40 }
    expect(runScore(run)).toBe(0)
  })

  it('retard : revoir la question à remplir coûte trois secondes', () => {
    const run = createRun({ seed: 5, mode: 'delayed', categoryIds: ['animaux'] }, judge)
    // Rien à rappeler avant le premier mot.
    expect(recall(run)).toBe(run)

    const started = arm(run, judge)
    const recalled = recall(started)
    expect(recalled.penaltySeconds).toBe(RECALL_SECONDS)
    expect(remainingSeconds(recalled, 0)).toBe(60 - RECALL_SECONDS)
    // Seul le retard paie ce rappel.
    const solo: Run = { ...started, mode: 'solo' }
    expect(recall(solo)).toBe(solo)
  })

  it('renversé : le tirage pèse ses lettres droit, le mode normal en logarithme', () => {
    // Le E des pays revient souvent, la lettre qu'un seul mot connaît presque jamais.
    expect(letterWeight(90, 'last')).toBe(90)
    expect(letterWeight(90, 'last') / letterWeight(1, 'last')).toBe(90)
    expect(letterWeight(90) / letterWeight(1)).toBeLessThan(7)
  })

  it('renversé : la question contraint la dernière lettre, pas la première', () => {
    const reversed = reversedJudgeOf()
    const run = createRun({ seed: 8, mode: 'reversed', categoryIds: ['animaux'] }, reversed)
    const letter = run.prompt.letter

    expect(inspect(run, `Animal0${letter}`, reversed).kind).toBe('accepted')
    expect(inspect(run, `${letter}nimal0`, reversed).kind).toBe('wrong-letter')
  })
})
