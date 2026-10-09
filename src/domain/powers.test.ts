import { describe, expect, it } from 'vitest'
import {
  BASE_SLOTS,
  slotsOf,
  choosePower,
  dealPowerOffer,
  equippedPowers,
  equipPower,
  HUSH_SECONDS,
  nextPowerLevel,
  POWER_IDS,
  powerPicksOwed,
  powersEarnedAt,
  LEVEL_POWER_IDS,
  complicationDue,
  CHATTER_WORDS,
FLAWLESS_POINTS,
FLAWLESS_STREAK,
LATECOMER_CAP_SECONDS,
  grantPower,
  WORDS_FOR_COMPLICATION,
  unlockEveryPower,
  type PowerId,
} from './powers'
import { NEW_PROFILE, xpForLevel, type Profile } from './progression'
import { NO_USAGE } from './rarity'
import {
  chargesLeft,
  createRun,
  inspect,
  isHushed,
  nextPrompt,
  remainingSeconds,
  reroll,
  RUN_SECONDS,
  skip,
skipPenalty,
  submit,
  type Judge,
  type Run,
} from './run'
import { buildWordPack, commonWord, editDistance, findWord, lettersWithEnough, type WordRow } from './words'

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const PER_LETTER = 12
const rows: WordRow[] = LETTERS.flatMap((letter) =>
  Array.from({ length: PER_LETTER }, (_, i): WordRow => [`${letter}nimal${i}`, 10 + i * 20, i]),
)
const animals = buildWordPack('animaux', [...rows, ['Hippopotame', 5, 0], ['Rhinocéros', 5, 0]])

const judge: Judge = {
  find: (_, word, tolerance) => findWord(animals, word, tolerance),
  usage: () => NO_USAGE,
  letters: () => lettersWithEnough(animals, PER_LETTER),
  known: () => PER_LETTER,
  spells: { joker: ['joker'], hush: ['chut'] },
  common: (_, letter, played) => commonWord(animals, letter, played),
}

const runWith = (...powers: PowerId[]): Run => createRun({ seed: 11, categoryIds: ['animaux'], powers }, judge)
const onLetter = (run: Run, letter: string): Run => ({ ...run, prompt: { ...run.prompt, letter } })
const atLevel = (level: number, patch: Partial<Profile> = {}): Profile => ({ ...NEW_PROFILE, xp: xpForLevel(level), ...patch })

describe('earning powers', () => {
  it('never deals Challenge: it comes with accepted words', () => {
    for (let seed = 0; seed < 40; seed++) expect(dealPowerOffer(atLevel(100), seed).powerOffer).not.toContain('complication')
    expect(complicationDue(NEW_PROFILE, WORDS_FOR_COMPLICATION - 1)).toBe(false)
    expect(complicationDue(NEW_PROFILE, WORDS_FOR_COMPLICATION)).toBe(true)
    const given = grantPower(NEW_PROFILE, 'complication')
    expect(given.powers).toEqual(['complication'])
    expect(given.equipped).toEqual(['complication'])
    expect(complicationDue(given, 10)).toBe(false)
  })

  it('leaves a given power out of the picks owed by level', () => {
    expect(powerPicksOwed(grantPower(atLevel(3), 'complication'))).toBe(1)
  })

  it('opens with the sixth category, then every other level', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(powersEarnedAt)).toEqual([0, 0, 1, 1, 2, 2, 3])
    expect(powersEarnedAt(100)).toBe(LEVEL_POWER_IDS.length)
    expect([1, 3, 4, 5].map(nextPowerLevel)).toEqual([3, 5, 5, 7])
  })

  it('deals two powers when a pick is owed, and none otherwise', () => {
    expect(dealPowerOffer(atLevel(2), 1).powerOffer).toEqual([])
    const dealt = dealPowerOffer(atLevel(3), 1)
    expect(dealt.powerOffer).toHaveLength(2)
    expect(new Set(dealt.powerOffer).size).toBe(2)
  })

  it('never deals the same card twice in a row while others remain', () => {
    let profile = atLevel(12)
    for (let seed = 0; seed < 4; seed++) {
      const dealt = dealPowerOffer(profile, seed)
      expect(dealt.powerOffer.some((id) => profile.lastPowerOffer.includes(id))).toBe(false)
      profile = choosePower(dealt, dealt.powerOffer[0]!)
    }
  })

  it('wears a new power while a slot is free, and only then', () => {
    let profile = atLevel(8, { bonuses: ['slot'] })
    for (let i = 0; i < 3; i++) {
      const dealt = dealPowerOffer(profile, i)
      profile = choosePower(dealt, dealt.powerOffer[1]!)
    }
    expect(profile.powers).toHaveLength(3)
    expect(profile.equipped).toEqual(profile.powers.slice(0, 2))
    expect(powerPicksOwed(profile)).toBe(0)
  })

  it('ignores a pick that was not on the table', () => {
    const dealt = dealPowerOffer(atLevel(4), 1)
    const stray = POWER_IDS.find((id) => !dealt.powerOffer.includes(id))!
    expect(choosePower(dealt, stray)).toBe(dealt)
  })

  it('gives the house account every power', () => {
    expect(unlockEveryPower(NEW_PROFILE).powers).toEqual(POWER_IDS)
  })
})

describe('equipping', () => {
  const owner = atLevel(8, { powers: ['joker', 'hush', 'magic'], equipped: ['joker', 'hush'], bonuses: ['slot'] })

  it('replaces what a slot held', () => {
    expect(equipPower(owner, 1, 'magic').equipped).toEqual(['joker', 'magic'])
  })

  it('trades places rather than wearing a power twice', () => {
    expect(equipPower(owner, 0, 'hush').equipped).toEqual(['hush', 'joker'])
  })

  it('empties a slot, and refuses a power not owned', () => {
    expect(equipPower(owner, 0, null).equipped).toEqual(['hush'])
    expect(equipPower(owner, 0, 'celerity')).toBe(owner)
  })

  it('has one slot until the second-slot bonus is taken', () => {
    const single = { ...owner, bonuses: [] }
    expect(slotsOf(single)).toBe(BASE_SLOTS)
    expect(slotsOf(owner)).toBe(2)
    expect(equippedPowers(single)).toEqual(['joker'])
    expect(equipPower(single, 1, 'magic')).toBe(single)
    expect(equipPower(single, 0, 'magic').equipped).toEqual(['magic'])
    expect(grantPower({ ...single, equipped: ['joker'] }, 'magic').equipped).toEqual(['joker'])
  })

  it('never carries a power the player does not own', () => {
    expect(equippedPowers({ ...owner, equipped: ['celerity', 'joker', 'nope'] })).toEqual(['joker'])
  })
})

describe('Retardataire', () => {
it('awards one second only below five seconds, up to five bonus seconds', () => {
const run = { ...onLetter(runWith('latecomer'), 'A'), latecomerSeconds: LATECOMER_CAP_SECONDS - 1, charges: { latecomer: 1 }, penaltySeconds: RUN_SECONDS }
const awarded = submit(run, 'Animal0', judge, 0).run
expect(awarded.latecomerSeconds).toBe(LATECOMER_CAP_SECONDS)
const atCap = submit({ ...onLetter(runWith('latecomer'), 'A'), latecomerSeconds: LATECOMER_CAP_SECONDS, charges: { latecomer: 0 } }, 'Animal0', judge, 0).run
expect(atCap.latecomerSeconds).toBe(LATECOMER_CAP_SECONDS)
})

it('does not add time when five seconds remain', () => {
const run = { ...onLetter(runWith('latecomer'), 'A'), charges: { latecomer: 5 }, penaltySeconds: RUN_SECONDS - 5 }
expect(submit(run, 'Animal0', judge, 0).run.latecomerSeconds).toBe(0)
})
})

describe('Passe-passe', () => {
it('grants one free follow-up skip and keeps the streak through both', () => {
const run = { ...runWith('double-skip'), combo: 4 }
const first = skip(run, judge, 1)
expect(first.penaltySeconds).toBe(5)
expect(first.freeSkipReady).toBe(true)
expect(first.combo).toBe(4)
expect(chargesLeft(first, 'double-skip')).toBe(0)
expect(skipPenalty(first)).toBe(0)
const second = skip(first, judge, 2)
expect(second.penaltySeconds).toBe(5)
expect(second.freeSkipReady).toBe(false)
expect(second.combo).toBe(4)
expect(second.skips).toBe(2)
})

it('does not grant a free skip after Bavardage’s free change', () => {
const run = { ...runWith('double-skip'), chatter: 1 }
const changed = skip(run, judge, 1)
expect(changed.freeSkipReady).toBe(false)
expect(changed.penaltySeconds).toBe(0)
})
})

describe('Sans faute', () => {
it('pays ten points immediately after every three exact words', () => {
let run = onLetter(runWith('flawless'), 'A')
for (let index = 0; index < FLAWLESS_STREAK; index++) {
run = submit({ ...run, prompt: { ...run.prompt, letter: 'A' }, promptAt: index, used: [] }, `Animal${index}`, judge, index + 1).run
}
expect(run.flawlessStreak).toBe(FLAWLESS_STREAK)
expect(run.score).toBe(run.found.reduce((sum, found) => sum + found.points, 0) + FLAWLESS_POINTS)
})

it('resets the streak on an approximate or joker word', () => {
const exacts = onLetter(runWith('flawless', 'joker'), 'A')
const first = submit(exacts, 'Animal0', judge, 1).run
const approximate = submit({ ...first, prompt: { ...first.prompt, letter: 'A' } }, 'Anmial1', judge, 2).run
expect(approximate.flawlessStreak).toBe(0)
})
})

describe('Esquive', () => {
  it('makes a skip cost three seconds', () => {
    expect(remainingSeconds(skip(runWith(), judge, 0), 0)).toBe(RUN_SECONDS - 5)
    expect(remainingSeconds(skip(runWith('dodge'), judge, 0), 0)).toBe(RUN_SECONDS - 3)
  })
})

describe('Silence', () => {
  it('is cast by its word and holds the clock until the next word', () => {
    const run = runWith('hush')
    expect(inspect(run, 'Chut', judge)).toMatchObject({ kind: 'spell', spell: 'hush' })

    const hushed = submit(run, 'chut', judge, 20).run
    expect(chargesLeft(hushed, 'hush')).toBe(0)
    expect(isHushed(hushed, 24)).toBe(true)
    expect(remainingSeconds(hushed, 24)).toBe(RUN_SECONDS - 20)

    const back = submit(hushed, `${hushed.prompt.letter}nimal0`, judge, 24).run
    expect(back.hush).toBeNull()
    expect(remainingSeconds(back, 30)).toBe(RUN_SECONDS - 30 + 4)
  })

  it('lets go on its own after ten seconds', () => {
    const hushed = submit(runWith('hush'), 'chut', judge, 20).run
    expect(isHushed(hushed, 20 + HUSH_SECONDS)).toBe(false)
    expect(remainingSeconds(hushed, 40)).toBe(RUN_SECONDS - 40 + HUSH_SECONDS)
  })

  it('never takes over a word the category knows, even one already played', () => {
    const run = onLetter(runWith('hush'), 'A')
    const played = submit(run, 'Animal0', judge, 1).run
    expect(inspect({ ...played, prompt: run.prompt }, 'Animal0', judge).kind).toBe('already')
  })

  it('does nothing without the power, or a second time', () => {
    expect(inspect(runWith(), 'chut', judge).kind).not.toBe('spell')
    const spent = submit(runWith('hush'), 'chut', judge, 5).run
    expect(inspect(spent, 'chut', judge).kind).not.toBe('spell')
  })
})

describe('Tricherie', () => {
  it('writes the best-known word left, paid the flat rate, once', () => {
    const run = onLetter(runWith('joker'), 'M')
    const cast = submit(run, 'Joker', judge, 3).run
    expect(cast.joker?.display).toBe('Mnimal11')
    expect(chargesLeft(cast, 'joker')).toBe(0)

    const verdict = inspect(cast, cast.joker!.display, judge)
    expect(verdict.found).toMatchObject({ joker: true, rarity: 0, points: 10 })
    expect(inspect(cast, 'joker', judge).kind).not.toBe('spell')
  })

  it('is forgotten when the prompt changes', () => {
    const cast = submit(onLetter(runWith('joker'), 'M'), 'Joker', judge, 3).run
    expect(skip(cast, judge, 4).joker).toBeNull()
  })
})

describe('Magie', () => {
  it('changes the letter, twice, and keeps the series', () => {
    const run = { ...runWith('magic'), combo: 3 }
    const once = reroll(run, judge, 2)
    expect(once.prompt.letter).not.toBe(run.prompt.letter)
    expect(once.prompt.categoryId).toBe(run.prompt.categoryId)
    expect(once.combo).toBe(3)
    const twice = reroll(once, judge, 3)
    expect(chargesLeft(twice, 'magic')).toBe(0)
    expect(reroll(twice, judge, 4)).toBe(twice)
  })

  it('does nothing without the power', () => {
    const run = runWith()
    expect(reroll(run, judge, 1)).toBe(run)
  })
})

describe('Divination', () => {
  it('shows the very prompt the run deals next, after a word or a skip', () => {
    const run = runWith('divination')
    const next = nextPrompt(run, judge)
    expect(skip(run, judge, 1).prompt).toEqual(next)
    expect(submit(run, `${run.prompt.letter}nimal0`, judge, 1).run.prompt).toEqual(next)
  })
})

describe('Dyslexie', () => {
  it('forgives two slips on a long word, and only with the power', () => {
    expect(editDistance('hipopotmae', 'hippopotame', 2)).toBe(2)
    expect(findWord(animals, 'Hipopotmae')).toBeNull()
    expect(findWord(animals, 'Hipopotmae', 2)).toMatchObject({ edits: 2, entry: { display: 'Hippopotame' } })

    const run = onLetter(runWith('dyslexia'), 'H')
    expect(inspect(run, 'Hipopotmae', judge).found).toMatchObject({ edits: 2, approximate: true, points: 10 })
    expect(inspect(onLetter(runWith(), 'H'), 'Hipopotmae', judge).kind).toBe('unknown')
  })

  it('stays out of short words, and prefers the closer word', () => {
    expect(findWord(animals, 'Anmal', 2)).toBeNull()
    expect(findWord(animals, 'Anmal1', 2)).toMatchObject({ edits: 1 })
  })
})

describe('Complication', () => {
  it('pays uncommon and rare words more, never a common or corrected one', () => {
    const plain = onLetter(runWith(), 'A')
    const hard = onLetter(runWith('complication'), 'A')
    const rare = inspect(hard, 'Animal0', judge).found!
    expect(rare.boost).toBeGreaterThan(1)
    expect(rare.points).toBeGreaterThan(inspect(plain, 'Animal0', judge).found!.points)
    expect(inspect(hard, 'Animal11', judge).found!.boost).toBe(1)
    expect(inspect(hard, 'Anmial0', judge).found!.boost).toBe(1)
  })
})

describe('Bavardage', () => {
  const word = (run: Run, i: number) => `${run.prompt.letter}nimal${i}`

  it('keeps the prompt for three more words after one ending in « ... », once a game', () => {
    const run = runWith('chatter')
    expect(inspect(run, `${word(run, 0)}...`, judge)).toMatchObject({ kind: 'accepted', chatter: true })
    const cast = submit(run, `${word(run, 0)}...`, judge, 1).run
    expect(cast.prompt).toEqual(run.prompt)
    expect(cast.chatter).toBe(CHATTER_WORDS)
    expect(chargesLeft(cast, 'chatter')).toBe(0)

    let held = cast
    for (let i = 1; i < CHATTER_WORDS; i++) held = submit(held, word(held, i), judge, 1 + i).run
    expect(held.prompt).toEqual(run.prompt)
    const done = submit(held, word(held, CHATTER_WORDS), judge, 5).run
    expect(done.prompt).toEqual(nextPrompt(held, judge))
    expect(done.chatter).toBe(0)
    expect(done.found).toHaveLength(CHATTER_WORDS + 1)
    expect(inspect(done, `${word(done, 0)}…`, judge).chatter).toBeUndefined()
  })

  it('lets the player leave it for free, series kept', () => {
    const run = runWith('chatter')
    const cast = submit(run, `${word(run, 0)}…`, judge, 1).run
    const left = skip(cast, judge, 2)
    expect(left.penaltySeconds).toBe(0)
    expect(left.skips).toBe(0)
    expect(left.combo).toBe(1)
    expect(left.chatter).toBe(0)
  })

  it('does nothing without the power', () => {
    const run = runWith()
    const played = submit(run, `${word(run, 0)}...`, judge, 1)
    expect(played.verdict.chatter).toBeUndefined()
    expect(played.run.prompt).not.toBe(run.prompt)
  })
})
