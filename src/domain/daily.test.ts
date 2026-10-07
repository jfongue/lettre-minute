import { describe, expect, it } from 'vitest'
import type { ChallengeWord } from './challenge'
import { dailyLineup, dailyNumber, dailySeed, dayOf, isDay, plausibleDaily, tierGrid } from './daily'

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
