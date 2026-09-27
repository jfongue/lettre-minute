import { describe, expect, it } from 'vitest'
import { baselinePass, PULL_MAX, PULL_MIN, promptPull } from './prompts'

describe('promptPull', () => {
  it('ne bouge pas un couple dont on ne sait rien', () => {
    expect(promptPull(undefined, 0.3)).toBe(1)
    expect(promptPull({ dealt: 0, passed: 0 }, 0.3)).toBe(1)
  })

  it('juge un couple contre sa propre catégorie', () => {
    const record = { dealt: 100, passed: 50 }

    expect(promptPull(record, 0.5)).toBe(1)
    // Une catégorie entière plus difficile que ce couple : il revient.
    expect(promptPull(record, 0.8)).toBeGreaterThan(1)
    expect(promptPull(record, 0.1)).toBeLessThan(1)
  })

  it('efface peu à peu un couple que les joueurs laissent vide, sans jamais l’enlever', () => {
    const settled = promptPull({ dealt: 400, passed: 320 }, 0.3)

    expect(settled).toBeLessThan(0.5)
    expect(settled).toBeGreaterThanOrEqual(PULL_MIN)
    expect(promptPull({ dealt: 100_000, passed: 100_000 }, 0)).toBeCloseTo(PULL_MIN)
  })

  it('se méfie des petits nombres : trois parties ne font pas une réputation', () => {
    const few = promptPull({ dealt: 3, passed: 3 }, 0.3)

    expect(few).toBeGreaterThan(0.85)
    expect(few).toBeLessThan(1)
  })

  it('ramène un couple que les joueurs réussissent', () => {
    const pull = promptPull({ dealt: 400, passed: 0 }, 0.8)

    expect(pull).toBeGreaterThan(1.5)
    expect(pull).toBeLessThanOrEqual(PULL_MAX)
  })
})

describe('baselinePass', () => {
  it('rend la part des tirages qu’une catégorie a laissés vides', () => {
    expect(baselinePass([{ dealt: 3, passed: 1 }, { dealt: 1, passed: 1 }])).toBe(0.5)
  })

  it('rend zéro plutôt qu’un faux zéro sans carnet', () => {
    expect(baselinePass([])).toBe(0)
    expect(baselinePass([undefined, { dealt: 0, passed: 0 }])).toBe(0)
  })
})
