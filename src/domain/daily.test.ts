import { describe, expect, it } from 'vitest'
import type { ChallengeWord } from './challenge'
import {
  DAILY_XP_DAYS,
  DAILY_XP_PER_DAY,
  NO_DAILY,
  dailyBonusXp,
  dailyLineup,
  dailyNumber,
  dailySeed,
  dayBefore,
  dayOf,
  isDay,
  liveStreak,
  parseDailyRecord,
  plausibleDaily,
  recordDaily,
  streakAfter,
  tierGrid,
} from './daily'

const IDS = ['pays', 'animaux', 'couleurs', 'fruits-legumes', 'metiers', 'sports', 'corps-humain', 'matieres']

function word(key: string, points: number, extra: Partial<ChallengeWord> = {}): ChallengeWord {
  return {
    categoryId: 'animaux',
    letter: key[0]!.toUpperCase(),
    key,
    display: key,
    points,
    tier: 'courant',
    approximate: false,
    seconds: 3,
    at: 10,
    ...extra,
  }
}

describe('the daily draw', () => {
  it('turns over at midnight UTC', () => {
    expect(dayOf(Date.parse('2026-10-08T23:59:59Z'))).toBe('2026-10-08')
    expect(dayOf(Date.parse('2026-10-09T00:00:00Z'))).toBe('2026-10-09')
  })

  it('names every day of two centuries as the platform calendar does', () => {
    const DAY = 24 * 60 * 60 * 1000
    for (let at = Date.parse('1950-01-01T12:00:00Z'); at < Date.parse('2150-01-01Z'); at += DAY) {
      const day = new Date(at).toISOString().slice(0, 10)
      expect(dayOf(at)).toBe(day)
      expect(isDay(day)).toBe(true)
    }
    expect(isDay('2026-02-29')).toBe(false)
    expect(isDay('2028-02-29')).toBe(true)
  }, 30_000)

  it('steps back a day across months, years and leap days', () => {
    expect(dayBefore('2027-01-01')).toBe('2026-12-31')
    expect(dayBefore('2028-03-01')).toBe('2028-02-29')
    expect(dayBefore('2026-03-01')).toBe('2026-02-28')
  })

  it('numbers the posts from the first one', () => {
    expect(dailyNumber('2026-10-08')).toBe(1)
    expect(dailyNumber('2026-11-07')).toBe(31)
  })

  it('only takes real days', () => {
    expect(isDay('2026-10-08')).toBe(true)
    expect(isDay('2026-02-30')).toBe(false)
    expect(isDay('2026-10-8')).toBe(false)
    expect(isDay(20261008)).toBe(false)
  })

  it('deals five categories that follow the day and the language, not the order they are listed in', () => {
    const lineup = dailyLineup('2026-10-08', 'en', IDS)
    expect(lineup).toHaveLength(5)
    expect(new Set(lineup).size).toBe(5)
    expect(dailyLineup('2026-10-08', 'en', [...IDS].reverse())).toEqual(lineup)
    expect(dailySeed('2026-10-08', 'en')).not.toBe(dailySeed('2026-10-09', 'en'))
    expect(dailySeed('2026-10-08', 'en')).not.toBe(dailySeed('2026-10-08', 'fr'))
  })

  it('does not deal the same lineup every day', () => {
    const days = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    expect(new Set(days.map((day) => dailyLineup(day, 'en', IDS).join())).size).toBeGreaterThan(1)
  })
})

describe('the shared grid', () => {
  it('shows one square per word, eight to a row, slips in white', () => {
    const words = [
      ...Array.from({ length: 8 }, (_, at) => word(`a${at}`, 10)),
      word('b', 30, { tier: 'très rare' }),
      word('c', 10, { tier: 'rare', approximate: true }),
    ]
    expect(tierGrid(words)).toBe('🟨🟨🟨🟨🟨🟨🟨🟨\n🟪⬜')
  })
})

describe('a result the server takes', () => {
  const lineup = ['animaux', 'pays']

  it('adds up, in clock order, on the day’s categories', () => {
    expect(plausibleDaily(40, [word('chat', 10, { at: 2 }), word('zebre', 30, { at: 9 })], lineup)).toBe(true)
    expect(plausibleDaily(0, [], lineup)).toBe(true)
  })

  it('refuses a score its words do not make', () => {
    expect(plausibleDaily(41, [word('chat', 10, { at: 2 }), word('zebre', 30, { at: 9 })], lineup)).toBe(false)
  })

  it('refuses a word out of the lineup, out of scale, twice, or out of order', () => {
    expect(plausibleDaily(10, [word('rouge', 10, { categoryId: 'couleurs' })], lineup)).toBe(false)
    expect(plausibleDaily(58, [word('chat', 58)], lineup)).toBe(false)
    expect(plausibleDaily(20, [word('chat', 10), word('chat', 10)], lineup)).toBe(false)
    expect(plausibleDaily(20, [word('chat', 10, { at: 9 }), word('zebre', 10, { at: 2 })], lineup)).toBe(false)
    expect(plausibleDaily(10, [word('chat', 10, { at: 90 })], lineup)).toBe(false)
  })
})

describe('the daily streak', () => {
  it('starts at one, grows day after day and starts over after a gap', () => {
    const first = recordDaily(NO_DAILY, '2026-10-12', 120)
    expect(first).toEqual({ day: '2026-10-12', streak: 1, best: 1, score: 120, played: 1 })
    const second = recordDaily(first, '2026-10-13', 90)
    expect(second.streak).toBe(2)
    const gap = recordDaily(second, '2026-10-15', 200)
    expect(gap).toEqual({ day: '2026-10-15', streak: 1, best: 2, score: 200, played: 3 })
  })

  it('counts only the first run of the day', () => {
    const once = recordDaily(NO_DAILY, '2026-10-13', 80)
    expect(recordDaily(once, '2026-10-13', 300)).toBe(once)
  })

  it('keeps a streak alive through the next day only', () => {
    const record = recordDaily(recordDaily(NO_DAILY, '2026-10-12', 1), '2026-10-13', 1)
    expect(liveStreak(record, '2026-10-13')).toBe(2)
    expect(liveStreak(record, '2026-10-14')).toBe(2)
    expect(liveStreak(record, '2026-10-15')).toBe(0)
    expect(streakAfter(record, '2026-10-14')).toBe(3)
    expect(streakAfter(record, '2026-10-15')).toBe(1)
  })

  it('crosses the end of a month and a leap day', () => {
    const record = recordDaily(NO_DAILY, '2028-02-29', 1)
    expect(streakAfter(record, '2028-03-01')).toBe(2)
  })

  it('pays more each day, up to a cap', () => {
    expect(dailyBonusXp(0)).toBe(0)
    expect(dailyBonusXp(1)).toBe(DAILY_XP_PER_DAY)
    expect(dailyBonusXp(DAILY_XP_DAYS + 10)).toBe(DAILY_XP_PER_DAY * DAILY_XP_DAYS)
  })

  it('reads back only what it wrote', () => {
    const record = recordDaily(NO_DAILY, '2026-10-13', 42)
    expect(parseDailyRecord(JSON.parse(JSON.stringify(record)))).toEqual(record)
    expect(parseDailyRecord(null)).toBe(NO_DAILY)
    expect(parseDailyRecord({ day: '2026-02-30', streak: 4 })).toBe(NO_DAILY)
    expect(parseDailyRecord({ day: '2026-10-13', streak: -3, best: 'x' })).toMatchObject({ streak: 1, best: 1 })
  })
})
