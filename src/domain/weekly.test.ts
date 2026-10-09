import { describe, expect, it } from 'vitest'
import { createRun, type Judge } from './run'
import { NO_USAGE } from './rarity'
import { buildWordPack, commonWord, findWord, lettersWithEnough, type WordRow } from './words'
import {
  WEEKLY_EPOCH,
  WEEKLY_TROPHY_IDS,
  awardWeeklyTrophies,
  type WeeklyMeasures,
  WEEKLY_SCHEDULE,
  attemptState,
  attemptWindow,
  attemptsAllowed,
  attemptsLeft,
  isWeekId,
  metricOf,
  parisDay,
  recordCurve,
  weekById,
  weekNumber,
  weekOf,
  weeklyChallenge,
  weeklyMode,
  weeklyRunOptions,
  weeklySeed,
  weeklyValue,
} from './weekly'

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const animals = buildWordPack(
  'animaux',
  LETTERS.flatMap((letter) => Array.from({ length: 12 }, (_, i): WordRow => [`${letter}nimal${i}`, 10 + i * 20, i])),
)
const EMPTY_JUDGE: Judge = {
  find: (_, word, tolerance) => findWord(animals, word, tolerance),
  usage: () => NO_USAGE,
  letters: () => lettersWithEnough(animals, 12),
  known: () => 12,
  spells: { joker: ['joker'], hush: ['chut'] },
  common: (_, letter, played) => commonWord(animals, letter, played),
}

const IDS = ['pays', 'animaux', 'couleurs', 'fruits-legumes', 'metiers', 'sports', 'corps-humain', 'matieres']
const at = (iso: string) => Date.parse(iso)

describe('Paris time', () => {
  it('agrees with the platform zone database every hour over three years', () => {
    const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    const HOUR = 3600 * 1000
    for (let t = at('2025-01-01T00:00:00Z'); t < at('2028-01-01T00:00:00Z'); t += HOUR) {
      expect(parisDay(t)).toBe(format.format(t))
    }
  }, 30_000)

  it('switches to summer time at 01:00 UTC on the last Sunday of March', () => {
    expect(parisDay(at('2026-03-28T22:59:59Z'))).toBe('2026-03-28')
    // 2026-03-28T23:00Z is already the 29th in winter time (UTC+1).
    expect(parisDay(at('2026-03-28T23:00:00Z'))).toBe('2026-03-29')
    expect(parisDay(at('2026-03-29T21:59:59Z'))).toBe('2026-03-29')
    // Summer time: 22:00Z is midnight.
    expect(parisDay(at('2026-03-29T22:00:00Z'))).toBe('2026-03-30')
  })

  it('switches back at 01:00 UTC on the last Sunday of October', () => {
    expect(parisDay(at('2026-10-24T21:59:59Z'))).toBe('2026-10-24')
    expect(parisDay(at('2026-10-24T22:00:00Z'))).toBe('2026-10-25')
    // Winter time again: 22:59Z is not yet midnight, 23:00Z is.
    expect(parisDay(at('2026-10-25T22:59:59Z'))).toBe('2026-10-25')
    expect(parisDay(at('2026-10-25T23:00:00Z'))).toBe('2026-10-26')
  })

  it('turns the day at Paris midnight, not UTC midnight', () => {
    expect(parisDay(at('2026-07-14T21:59:59Z'))).toBe('2026-07-14')
    expect(parisDay(at('2026-07-14T22:00:00Z'))).toBe('2026-07-15')
    expect(parisDay(at('2026-12-31T22:59:59Z'))).toBe('2026-12-31')
    expect(parisDay(at('2026-12-31T23:00:00Z'))).toBe('2027-01-01')
  })
})

describe('the weekly window', () => {
  it('opens on Sunday at 21:00 Paris time: 20:59 is still the week before, 21:00 the new one', () => {
    // 2026-10-11 is a Sunday in summer time: 21:00 Paris is 19:00 UTC.
    expect(weekOf(at('2026-10-11T18:59:59Z')).weekId).toBe('2026-10-04')
    expect(weekOf(at('2026-10-11T19:00:00Z')).weekId).toBe('2026-10-11')
    expect(weekOf(at('2026-10-11T19:00:00Z')).opensAt).toBe(at('2026-10-11T19:00:00Z'))
  })

  it('does the same in winter time, where 21:00 is 20:00 UTC', () => {
    expect(weekOf(at('2026-11-01T19:59:59Z')).weekId).toBe('2026-10-25')
    expect(weekOf(at('2026-11-01T20:00:00Z')).weekId).toBe('2026-11-01')
  })

  it('gives a week the instants it opens and closes, whatever the clock change in between', () => {
    const plain = weekOf(at('2026-10-14T12:00:00Z'))
    expect(plain).toEqual({ weekId: '2026-10-11', opensAt: at('2026-10-11T19:00:00Z'), closesAt: at('2026-10-18T19:00:00Z') })

    // The week of 18 October holds the end of summer time: 7 days and one hour long.
    const autumn = weekOf(at('2026-10-20T12:00:00Z'))
    expect(autumn).toEqual({ weekId: '2026-10-18', opensAt: at('2026-10-18T19:00:00Z'), closesAt: at('2026-10-25T20:00:00Z') })

    // The week of 21 March 2027 holds the start of summer time: one hour short.
    const spring = weekOf(at('2027-03-24T12:00:00Z'))
    expect(spring.weekId).toBe('2027-03-21')
    expect(spring.opensAt).toBe(at('2027-03-21T20:00:00Z'))
    expect(spring.closesAt).toBe(at('2027-03-28T19:00:00Z'))
  })

  it('chains weeks with no gap and no overlap across a year', () => {
    let week = weekOf(at('2026-10-11T19:00:00Z'))
    for (let i = 0; i < 80; i++) {
      const next = weekOf(week.closesAt)
      expect(next.opensAt).toBe(week.closesAt)
      expect(weekOf(week.closesAt - 1).weekId).toBe(week.weekId)
      expect(weekById(next.weekId)).toEqual(next)
      week = next
    }
  })

  it('crosses midnight and the new year within the week', () => {
    expect(weekOf(at('2026-12-31T23:30:00Z')).weekId).toBe('2026-12-27')
    expect(weekOf(at('2027-01-03T19:59:59Z')).weekId).toBe('2026-12-27')
    expect(weekOf(at('2027-01-03T19:59:59Z')).closesAt).toBe(at('2027-01-03T20:00:00Z'))
    expect(weekOf(at('2027-01-03T20:00:00Z')).weekId).toBe('2027-01-03')
  })

  it('numbers the weeks from the epoch, a Sunday', () => {
    expect(isWeekId(WEEKLY_EPOCH)).toBe(true)
    expect(weekNumber(WEEKLY_EPOCH)).toBe(0)
    expect(weekNumber('2026-10-18')).toBe(1)
    expect(weekNumber('2026-10-04')).toBe(-1)
    expect(weekNumber('2027-10-10')).toBe(52)
  })

  it('accepts only the Sundays that open a week', () => {
    expect(isWeekId('2026-10-12')).toBe(false)
    expect(isWeekId('2026-02-29')).toBe(false)
    expect(isWeekId('hier')).toBe(false)
    expect(isWeekId(null)).toBe(false)
  })
})

describe('the attempt window', () => {
  it('is the week and the Paris day', () => {
    expect(attemptWindow(at('2026-10-14T10:00:00Z'))).toEqual({ weekId: '2026-10-11', day: '2026-10-14' })
  })

  it('turns over at Paris midnight, not UTC midnight', () => {
    expect(attemptWindow(at('2026-10-14T21:59:59Z')).day).toBe('2026-10-14')
    expect(attemptWindow(at('2026-10-14T22:00:00Z')).day).toBe('2026-10-15')
  })

  it('gives Sunday 21:00–24:00 to the new week, with a window of its own', () => {
    const before = attemptWindow(at('2026-10-18T18:59:59Z'))
    const after = attemptWindow(at('2026-10-18T19:00:00Z'))
    expect(before).toEqual({ weekId: '2026-10-11', day: '2026-10-18' })
    expect(after).toEqual({ weekId: '2026-10-18', day: '2026-10-18' })
    // Then Monday, still the same week, a new day.
    expect(attemptWindow(at('2026-10-18T22:00:00Z'))).toEqual({ weekId: '2026-10-18', day: '2026-10-19' })
  })
})

describe('the weekly challenge', () => {
  it('starts with endurance and cycles through the schedule', () => {
    expect(WEEKLY_SCHEDULE[0]).toBe('endurance')
    expect(weeklyMode(WEEKLY_EPOCH)).toBe('endurance')
    expect(WEEKLY_SCHEDULE.map((_, i) => weeklyMode(['2026-10-11', '2026-10-18', '2026-10-25'][i]!))).toEqual([...WEEKLY_SCHEDULE])
    expect(weeklyMode('2026-11-01')).toBe('endurance')
    expect(weeklyMode('2026-10-04')).toBe(WEEKLY_SCHEDULE[WEEKLY_SCHEDULE.length - 1])
  })

  it('ranks endurance in seconds survived and the other modes in points', () => {
    expect(metricOf('endurance')).toBe('survival')
    expect(metricOf('delayed')).toBe('score')
    expect(metricOf('reversed')).toBe('score')
    expect(weeklyChallenge('2026-10-11', 'fr', IDS).metric).toBe('survival')
    expect(weeklyChallenge('2026-10-18', 'fr', IDS).metric).toBe('score')
  })

  it('is the same game for everyone, in whatever order the categories come', () => {
    const a = weeklyChallenge('2026-10-11', 'fr', IDS)
    const b = weeklyChallenge('2026-10-11', 'fr', [...IDS].reverse())
    expect(b).toEqual(a)
    expect(a.lineup).toHaveLength(5)
    expect(new Set(a.lineup).size).toBe(5)
    for (const id of a.lineup) expect(IDS).toContain(id)
  })

  it('draws another game per week and per language', () => {
    expect(weeklySeed('2026-10-11', 'fr')).not.toBe(weeklySeed('2026-10-18', 'fr'))
    expect(weeklySeed('2026-10-11', 'fr')).not.toBe(weeklySeed('2026-10-11', 'en'))
    expect(weeklySeed('2026-10-11', 'fr')).toBe(weeklySeed('2026-10-11', 'fr'))
    expect(weeklySeed('2026-10-11', 'fr')).not.toBe(weeklySeed('2026-10-11', 'fr') + 1)
  })

  it('never deals a category it was not given, and deals them all when fewer than five', () => {
    expect(weeklyChallenge('2026-10-11', 'fr', ['pays', 'animaux']).lineup.sort()).toEqual(['animaux', 'pays'])
  })

  it('builds a run with no power, nothing to avoid and no crowd', () => {
    const challenge = weeklyChallenge('2026-10-11', 'fr', IDS)
    const options = weeklyRunOptions(challenge)
    expect(options).toEqual({ seed: challenge.seed, mode: 'endurance', categoryIds: challenge.lineup, avoid: [], powers: [], shared: true })
    const run = createRun(options, EMPTY_JUDGE)
    expect(run.mode).toBe('endurance')
    expect(run.powers).toEqual([])
    expect(run.shared).toBe(true)
    expect(run.avoid).toEqual([])
  })

  it('reads the value to rank: points, or seconds survived to the tenth', () => {
    const run = createRun(weeklyRunOptions(weeklyChallenge('2026-10-11', 'fr', IDS)), EMPTY_JUDGE)
    expect(weeklyValue(run, 'survival')).toBe(30)
    expect(weeklyValue({ ...run, bonusSeconds: 12.5, penaltySeconds: 3 }, 'survival')).toBe(39.5)
    expect(weeklyValue({ ...run, score: 42 }, 'score')).toBe(42)
  })
})

describe('the attempts', () => {
  it('gives two, a third for one ad, and five to Premium', () => {
    expect(attemptsAllowed({ plus: false, adsWatched: 0 })).toBe(2)
    expect(attemptsAllowed({ plus: false, adsWatched: 1 })).toBe(3)
    expect(attemptsAllowed({ plus: false, adsWatched: 9 })).toBe(3)
    expect(attemptsAllowed({ plus: false, adsWatched: -1 })).toBe(2)
    expect(attemptsAllowed({ plus: true, adsWatched: 0 })).toBe(5)
    expect(attemptsAllowed({ plus: true, adsWatched: 3 })).toBe(5)
  })

  it('counts what is left', () => {
    expect(attemptsLeft(0, { plus: false, adsWatched: 0 })).toBe(2)
    expect(attemptsLeft(2, { plus: false, adsWatched: 0 })).toBe(0)
    expect(attemptsLeft(2, { plus: false, adsWatched: 1 })).toBe(1)
    expect(attemptsLeft(7, { plus: true, adsWatched: 0 })).toBe(0)
  })

  it('lays the five places out for a free player', () => {
    expect(attemptState(0, false, 0)).toEqual(['free', 'free', 'ad', 'locked', 'locked'])
    expect(attemptState(1, false, 0)).toEqual(['used', 'free', 'ad', 'locked', 'locked'])
    expect(attemptState(2, false, 0)).toEqual(['used', 'used', 'ad', 'locked', 'locked'])
    expect(attemptState(2, false, 1)).toEqual(['used', 'used', 'free', 'locked', 'locked'])
    expect(attemptState(3, false, 1)).toEqual(['used', 'used', 'used', 'locked', 'locked'])
  })

  it('lays them out for Premium, whose places 3 to 5 are direct', () => {
    expect(attemptState(0, true, 0)).toEqual(['free', 'free', 'plus', 'plus', 'plus'])
    expect(attemptState(3, true, 0)).toEqual(['used', 'used', 'used', 'plus', 'plus'])
    expect(attemptState(5, true, 0)).toEqual(['used', 'used', 'used', 'used', 'used'])
  })

  it('keeps a lapsed Premium player’s spent places spent', () => {
    expect(attemptState(4, false, 0)).toEqual(['used', 'used', 'used', 'used', 'locked'])
    expect(attemptState(9, true, 0)).toEqual(['used', 'used', 'used', 'used', 'used'])
  })
})

const measure = (playerId: string, patch: Partial<WeeklyMeasures> = {}): WeeklyMeasures => ({
  playerId,
  reachedAt: 1000,
  attempts: 1,
  climb: 0,
  bestCombo: 0,
  original: 0,
  sheep: 0,
  rarestTier: 0,
  rarestPoints: 0,
  rarestWord: null,
  fastest: null,
  fastestWord: null,
  longest: 0,
  longestWord: null,
  ...patch,
})

describe('the weekly trophies', () => {
  it('leaves out a trophy nobody qualifies for, and everything when nobody played', () => {
    expect(awardWeeklyTrophies([])).toEqual([])
    expect(awardWeeklyTrophies([measure('a'), measure('b')])).toEqual([])
  })

  it('names eight in prestige order', () => {
    expect(WEEKLY_TROPHY_IDS).toHaveLength(8)
    expect(WEEKLY_TROPHY_IDS[0]).toBe('weekly-rarest')
    expect(WEEKLY_TROPHY_IDS[7]).toBe('weekly-sheep')
  })

  it('gives the rarest word by tier, then points', () => {
    const awards = awardWeeklyTrophies([
      measure('a', { rarestTier: 2, rarestPoints: 40, rarestWord: 'okapi' }),
      measure('b', { rarestTier: 3, rarestPoints: 10, rarestWord: 'aye-aye' }),
      measure('c', { rarestTier: 3, rarestPoints: 30, rarestWord: 'pangolin' }),
    ])
    expect(awards).toEqual([{ id: 'weekly-rarest', playerId: 'c', value: 3, word: 'pangolin' }])
  })

  it('never gives a player two trophies: the next in line takes it', () => {
    const awards = awardWeeklyTrophies([
      measure('a', { rarestTier: 3, rarestPoints: 50, rarestWord: 'x', original: 9, bestCombo: 12 }),
      measure('b', { original: 5, bestCombo: 4 }),
      measure('c', { original: 1, bestCombo: 2 }),
    ])
    expect(awards.map((award) => [award.id, award.playerId])).toEqual([
      ['weekly-rarest', 'a'],
      ['weekly-original', 'b'],
      ['weekly-streak', 'c'],
    ])
    expect(new Set(awards.map((award) => award.playerId)).size).toBe(awards.length)
  })

  it('goes to whoever reached the value first on a tie', () => {
    const awards = awardWeeklyTrophies([
      measure('late', { original: 4, reachedAt: 2000 }),
      measure('early', { original: 4, reachedAt: 1500 }),
    ])
    expect(awards).toEqual([{ id: 'weekly-original', playerId: 'early', value: 4 }])
  })

  it('breaks a tie on the same instant by player, so every device agrees', () => {
    const forward = awardWeeklyTrophies([measure('b', { sheep: 3 }), measure('a', { sheep: 3 })])
    const backward = awardWeeklyTrophies([measure('a', { sheep: 3 }), measure('b', { sheep: 3 })])
    expect(forward).toEqual(backward)
    expect(forward[0]!.playerId).toBe('a')
  })

  it('rewards the quickest answer, the longest word, the climb and the attempts', () => {
    const awards = awardWeeklyTrophies([
      measure('a', { fastest: 0.8, fastestWord: 'ane' }),
      measure('b', { fastest: 1.5, longest: 14, longestWord: 'hippopotame' }),
      measure('c', { climb: 22, attempts: 5 }),
      measure('d', { climb: 30, attempts: 2 }),
    ])
    expect(Object.fromEntries(awards.map((award) => [award.id, award.playerId]))).toEqual({
      'weekly-climber': 'd',
      'weekly-fastest': 'a',
      'weekly-persistent': 'c',
      'weekly-longest': 'b',
    })
    expect(awards.find((award) => award.id === 'weekly-fastest')).toMatchObject({ value: 0.8, word: 'ane' })
  })

  it('asks for more than one attempt, a series above one and a climb above zero', () => {
    expect(awardWeeklyTrophies([measure('a', { attempts: 1, bestCombo: 1, climb: 0 })])).toEqual([])
  })
})

describe('the record curve', () => {
  it('follows the best value attempt after attempt', () => {
    expect(recordCurve([20, 35, 30, 41, 12])).toEqual([20, 35, 35, 41, 41])
  })

  it('carries the record over an unfinished attempt and starts at zero', () => {
    expect(recordCurve([null, 18, null, 25])).toEqual([0, 18, 18, 25])
    expect(recordCurve([])).toEqual([])
  })
})
