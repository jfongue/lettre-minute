import { describe, expect, it } from 'vitest'
import { CATEGORIES_PAGE_FROM, homePageOpen, type HomeAccess } from './home'
import { NEW_PROFILE, type Profile } from './progression'
import { starterCategoryIds } from './unlocks'

const access = (over: Partial<HomeAccess> = {}): HomeAccess => ({
  profile: NEW_PROFILE,
  named: false,
  requested: false,
  ...over,
})

const PICKS = ['fruits-legumes', 'metiers', 'sports']

/** Un profil qui possède `count` catégories : les starters, puis des choix. */
const owning = (count: number): Profile => ({
  ...NEW_PROFILE,
  unlocked: PICKS.slice(0, Math.max(0, count - starterCategoryIds().length)),
})

describe('tuiles de l’accueil', () => {
  it('ne montre rien à un appareil sans partie, sans compte et sans demande', () => {
    expect(homePageOpen('profile', access())).toBe(false)
    expect(homePageOpen('stats', access())).toBe(false)
    expect(homePageOpen('requests', access())).toBe(false)
    expect(homePageOpen('categories', access())).toBe(false)
  })

  it('ouvre profil et statistiques dès une partie en mémoire, ou un compte nommé', () => {
    const played = access({ profile: { ...NEW_PROFILE, runs: 1 } })
    expect(homePageOpen('profile', played)).toBe(true)
    expect(homePageOpen('stats', played)).toBe(true)
    expect(homePageOpen('profile', access({ named: true }))).toBe(true)
    expect(homePageOpen('stats', access({ named: true }))).toBe(true)
  })

  it('n’ouvre « Mes demandes » qu’avec un mot proposé, et jamais avec une partie seule', () => {
    expect(homePageOpen('requests', access({ requested: true }))).toBe(true)
    expect(homePageOpen('requests', access({ profile: { ...NEW_PROFILE, runs: 3 } }))).toBe(false)
  })

  it('n’ouvre « Mes catégories » qu’à six catégories possédées', () => {
    expect(homePageOpen('categories', access({ profile: owning(CATEGORIES_PAGE_FROM - 1) }))).toBe(false)
    expect(homePageOpen('categories', access({ profile: owning(CATEGORIES_PAGE_FROM) }))).toBe(true)
  })
})
