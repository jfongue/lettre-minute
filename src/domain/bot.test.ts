import { describe, expect, it } from 'vitest'
import { createJudge } from '../state/judge'
import { playBot } from './bot'
import { challengeWordsOf } from './challenge'
import { RUN_SECONDS } from './run'
import { buildWordPack } from './words'

const LETTERS = 'ABCDEFGHIJLMNOPRSTV'.split('')
const pack = (categoryId: string, stem: string) =>
  buildWordPack(
    categoryId,
    LETTERS.flatMap((letter) => Array.from({ length: 12 }, (_, i) => [`${letter}${stem}${i}`, 50 + i, 1] as const)),
  )
const judge = () => createJudge([pack('animaux', 'nimal'), pack('pays', 'ays')], { own: {}, crowd: {} })

describe('playBot', () => {
  it('plays the same run on every device', () => {
    const one = challengeWordsOf(playBot(42, ['animaux', 'pays'], 'bot-a', judge()))
    const two = challengeWordsOf(playBot(42, ['animaux', 'pays'], 'bot-a', judge()))
    expect(one).toEqual(two)
    expect(one.length).toBeGreaterThan(0)
  })

  it('plays a different run for another bot on the same challenge', () => {
    const one = playBot(42, ['animaux', 'pays'], 'bot-a', judge())
    const two = playBot(42, ['animaux', 'pays'], 'bot-b', judge())
    expect(challengeWordsOf(one)).not.toEqual(challengeWordsOf(two))
  })

  it('answers the prompts the seed deals, within the clock', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const run = playBot(seed, ['animaux'], 'bot-a', judge())
      for (const found of run.found) {
        expect(found.display.startsWith(found.prompt.letter)).toBe(true)
        expect(found.at).toBeLessThanOrEqual(RUN_SECONDS)
      }
      expect(run.score).toBe(run.found.reduce((sum, found) => sum + found.points, 0))
    }
  })
})
