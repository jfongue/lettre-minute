import { describe, expect, it } from 'vitest'
import { ARCADE_MODES, countsForProgress, ENDURANCE_TIME_BONUS, MODE_SECONDS, modeEdge } from './modes'
import { finalOf } from './text'
import { buildWordPack, findWord, knownByLetter, mirrorPack } from './words'

/** Une catégorie de pays qui finit par toutes les lettres testées. */
const countries = buildWordPack('pays', [
  ['Vietnam', 50, 1],
  ['Yémen', 50, 1],
  ['Pérou', 50, 1],
  ['Mali', 50, 1],
])

describe('les modes de la réserve', () => {
  it('garde le solo hors de la réserve et à part de sa durée', () => {
    expect(ARCADE_MODES).toEqual(['delayed', 'endurance', 'reversed'])
    expect(MODE_SECONDS.solo).toBe(60)
    expect(MODE_SECONDS.endurance).toBe(30)
  })

  it('paie un mot d’endurance selon son palier de rareté', () => {
    expect(ENDURANCE_TIME_BONUS['courant']).toBe(2)
    expect(ENDURANCE_TIME_BONUS['peu commun']).toBe(2.5)
    expect(ENDURANCE_TIME_BONUS.rare).toBe(3)
    expect(ENDURANCE_TIME_BONUS['très rare']).toBe(4)
  })

  it('ne renverse que la lettre du mode renversé, et ne compte que le solo', () => {
    expect(modeEdge('reversed')).toBe('last')
    expect(modeEdge('delayed')).toBe('first')
    expect(modeEdge('endurance')).toBe('first')
    expect(ARCADE_MODES.every((mode) => !countsForProgress(mode))).toBe(true)
    expect(countsForProgress('solo')).toBe(true)
  })
})

describe('finalOf', () => {
  it('lit la dernière lettre, accents, espaces et ponctuation compris', () => {
    expect(finalOf('Vietnam')).toBe('M')
    expect(finalOf('Côte d’Ivoire')).toBe('E')
    expect(finalOf('va !')).toBe('A')
    expect(finalOf('')).toBe('')
  })
})

describe('le dictionnaire lu par la fin', () => {
  const mirrored = mirrorPack(countries)

  it('range chaque mot sous sa dernière lettre, à l’envers', () => {
    expect(knownByLetter(countries, 'first').get('V')).toBe(1)
    expect(knownByLetter(countries, 'last').get('M')).toBe(1)
    expect(knownByLetter(countries, 'last').get('I')).toBe(1)
    expect(knownByLetter(countries, 'last').get('V')).toBeUndefined()
  })

  it('retrouve un mot tapé à l’envers, tolérance comprise', () => {
    expect(findWord(mirrored, 'manteiv', 1)?.entry.key).toBe('vietnam')
    expect(findWord(mirrored, 'manteiw', 1)).toMatchObject({ entry: { key: 'vietnam' }, approximate: true })
    expect(findWord(mirrored, 'uorep', 0)?.entry.key).toBe('perou')
  })

  it('ne touche pas au dictionnaire qu’il relit', () => {
    expect(countries.entries.get('vietnam')?.key).toBe('vietnam')
    expect(countries.byLetter.get('V')?.length).toBe(1)
    expect(countries.byLetter.get('M')?.length).toBe(1)
  })
})
