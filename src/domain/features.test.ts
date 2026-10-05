import { describe, expect, it } from 'vitest'
import { audiencesOf, enabledFeatures, FEATURES, NO_ROLES, type FlagRow } from './features'

const player = NO_ROLES
const moderator = { ...NO_ROLES, moderator: true }
const superModerator = { ...NO_ROLES, moderator: true, superModerator: true }
const premium = { ...NO_ROLES, premium: true }

describe('les fonctionnalités', () => {
  it('ont chacune un identifiant unique, en un mot', () => {
    const ids = FEATURES.map((feature) => feature.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z][a-zA-Z0-9]{1,40}$/)
  })

  it('ne laissent jamais tout le monde sans valeur par défaut', () => {
    for (const feature of FEATURES) expect(feature.defaults.everyone).not.toBe('neutral')
  })

  it('suivent les valeurs du code sans réglage', () => {
    expect(enabledFeatures({}, player).has('challenges')).toBe(true)
    expect(enabledFeatures({}, player).has('moderation')).toBe(false)
    expect(enabledFeatures({}, moderator).has('moderation')).toBe(true)
    expect(enabledFeatures({}, moderator).has('debugBoard')).toBe(false)
    expect(enabledFeatures({}, superModerator).has('debugBoard')).toBe(true)
    expect(enabledFeatures({}, superModerator).has('duel')).toBe(true)
    expect(enabledFeatures({}, premium).has('duel')).toBe(false)
  })

  it('ouvrent dès qu’une case du joueur dit dispo', () => {
    const row: FlagRow = { everyone: 'off', moderator: 'off', premium: 'on', superModerator: 'neutral' }
    expect(enabledFeatures({ duel: row }, premium).has('duel')).toBe(true)
    expect(enabledFeatures({ duel: row }, { ...premium, moderator: true }).has('duel')).toBe(true)
    expect(enabledFeatures({ duel: row }, moderator).has('duel')).toBe(false)
  })

  it('retombent sur le code quand toute la ligne du joueur est neutre', () => {
    const row: FlagRow = { everyone: 'neutral', moderator: 'neutral', premium: 'neutral', superModerator: 'off' }
    expect(enabledFeatures({ challenges: row }, player).has('challenges')).toBe(true)
    // Le super modérateur, lui, a une case qui se prononce : elle ferme.
    expect(enabledFeatures({ challenges: row }, superModerator).has('challenges')).toBe(false)
  })

  it('comptent un super modérateur parmi les modérateurs', () => {
    expect(audiencesOf(superModerator)).toEqual(['everyone', 'moderator', 'superModerator'])
    expect(audiencesOf(premium)).toEqual(['everyone', 'premium'])
  })
})
