import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { createDuel, tuningOf } from './duel'
import { nextBreak, interstitialBreaks } from './adBreaks'
import { kFactor } from './ranked'
import { applyTuning, DEFAULT_TUNING, duelTuning, parseTuning, runTuning, TUNING, TUNING_KEYS, tuningRange } from './tuning'

afterEach(() => applyTuning({}))

describe('les réglages lus', () => {
  it('gardent une valeur dans sa plage, même écrite en texte', () => {
    expect(parseTuning({ 'run.seconds.solo': 45, 'duel.reserve': '40' })).toEqual({ 'run.seconds.solo': 45, 'duel.reserve': 40 })
  })

  it('écartent une valeur hors plage, d’un autre type, non entière ou d’une clé inconnue', () => {
    expect(
      parseTuning({ 'run.seconds.solo': 5000, 'duel.reserve': 'trente', 'run.raceWords': 7.5, 'nothing.here': 3, 'duel.pass': null }),
    ).toEqual({})
    expect(parseTuning(null)).toEqual({})
    expect(parseTuning([1, 2])).toEqual({})
  })

  it('remplacent ceux de l’appareil, défauts compris : rien ne reste d’un réglage retiré', () => {
    applyTuning({ 'run.seconds.solo': 45 })
    expect(TUNING['run.seconds.solo']).toBe(45)
    applyTuning({})
    expect(TUNING['run.seconds.solo']).toBe(60)
  })
})

describe('les familles', () => {
  it('une partie prend les réglages de l’appareil, ou un instantané complété des défauts', () => {
    applyTuning({ 'run.skipPenalty': 3 })
    expect(runTuning()['run.skipPenalty']).toBe(3)
    const frozen = runTuning({ 'run.seconds.solo': 50 })
    expect(frozen['run.seconds.solo']).toBe(50)
    expect(frozen['run.skipPenalty']).toBe(DEFAULT_TUNING['run.skipPenalty'])
    expect(Object.keys(frozen).every((key) => key.startsWith('run.'))).toBe(true)
  })

  it('un duel garde les siens, quoi que l’appareil lise ensuite', () => {
    applyTuning({ 'duel.reserve': 40 })
    const duel = createDuel({ seed: 1, playerIds: ['a', 'b'], categories: ['pays'] })
    applyTuning({})
    expect(duel.players[0]?.reserve).toBe(40)
    expect(tuningOf(duel)['duel.reserve']).toBe(40)
    expect(duelTuning({})['duel.reserve']).toBe(30)
  })

  it('un duel gardé par une version d’avant joue les défauts', () => {
    expect(tuningOf({})['duel.passPenalty']).toBe(DEFAULT_TUNING['duel.passPenalty'])
  })

  it('l’appareil lit les siens à l’appel', () => {
    applyTuning({ 'ranked.kEarly': 80, 'ads.first': 5 })
    expect(kFactor(0)).toBe(80)
    expect(nextBreak(0, interstitialBreaks())).toBe(5)
  })
})

describe('la migration qui les sème', () => {
  const seeded = readFileSync(new URL('../../supabase/migrations/0125_game_config.sql', import.meta.url), 'utf8')
  const rows = new Map([...seeded.matchAll(/^ {2}\('([a-zA-Z.]+)', ([-\d.]+), ([-\d.]+), ([-\d.]+), '/gm)].map((m) => [m[1]!, m.slice(2, 5).map(Number)]))

  it('sème chaque clé avec la valeur et la plage du jeu', () => {
    expect([...rows.keys()].sort()).toEqual([...TUNING_KEYS].sort())
    for (const key of TUNING_KEYS) {
      const { min, max } = tuningRange(key)
      expect(rows.get(key), key).toEqual([DEFAULT_TUNING[key], min, max])
    }
  })
})
