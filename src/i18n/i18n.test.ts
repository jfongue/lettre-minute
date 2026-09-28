import { beforeAll, describe, expect, it } from 'vitest'
import { PALETTE } from '../domain/avatar'
import { announcedCategories } from '../domain/catalogue'
import { categoryText, detectLocale, loadMessages, LOCALES, messagesFor } from '.'

beforeAll(() => Promise.all(LOCALES.map((locale) => loadMessages(locale.id))))

describe('detectLocale', () => {
  it('takes the first device language the game speaks', () => {
    expect(detectLocale(['ja-JP', 'de-AT', 'en-US'])).toBe('de')
  })

  it('reads a language by its primary subtag, whatever the region', () => {
    expect(detectLocale(['pt-BR'])).toBe('pt')
    expect(detectLocale(['pt_PT'])).toBe('pt')
    expect(detectLocale(['NL'])).toBe('nl')
  })

  it('answers nothing rather than guess, so the player picks', () => {
    expect(detectLocale(['ja-JP', 'ko'])).toBeNull()
    expect(detectLocale([])).toBeNull()
  })
})

describe('messages', () => {
  it('names every category and every colour in every language', () => {
    for (const { id } of LOCALES) {
      const messages = messagesFor(id)
      for (const category of announcedCategories()) expect(messages.categories[category.id], `${id}: ${category.id}`).toBeDefined()
      for (const colour of PALETTE) expect(messages.colours[colour.id], `${id}: ${colour.id}`).toBeDefined()
    }
  })

  it('keeps the French catalogue as the French wording', () => {
    expect(categoryText(messagesFor('fr'), 'pays')).toEqual({ label: 'Pays', hint: 'États de notre monde' })
    expect(categoryText(messagesFor('en'), 'pays').label).toBe('Countries')
  })

  it('falls back on the catalogue for a category no language names yet', () => {
    expect(categoryText(messagesFor('de'), 'inconnue')).toEqual({ label: 'inconnue', hint: '' })
  })

  it('prints a place the way each language does', () => {
    expect([1, 2, 17].map(messagesFor('fr').boards.ordinal)).toEqual(['1er', '2e', '17e'])
    expect([1, 2, 3, 4, 11, 12, 13, 21, 112].map(messagesFor('en').boards.ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '112th',
    ])
    expect(messagesFor('de').boards.ordinal(3)).toBe('3.')
  })
})
