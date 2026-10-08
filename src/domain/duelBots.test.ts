import { describe, expect, it } from 'vitest'
import { HOUSE_BOTS, houseBotsFor } from './duelBots'

describe('la réserve des joueurs maison', () => {
  it('ouvre quatre profils au premier duel, et toute la réserve vers la trentième partie', () => {
    expect(houseBotsFor(0).length).toBe(4)
    expect(houseBotsFor(3).length).toBe(4)
    expect(houseBotsFor(32).length).toBe(HOUSE_BOTS.length)
    expect(houseBotsFor(999).length).toBe(HOUSE_BOTS.length)
  })

  it('ne referme jamais un profil déjà ouvert', () => {
    for (let runs = 0; runs < 40; runs++) {
      const before = houseBotsFor(runs)
      const after = houseBotsFor(runs + 1)
      expect(after.length).toBeGreaterThanOrEqual(before.length)
      expect(before.every((bot) => after.includes(bot))).toBe(true)
    }
  })

  it('garde les plus rudes pour la fin', () => {
    const first = houseBotsFor(0)
    expect(Math.max(...first.map((bot) => bot.answerChance))).toBeLessThan(0.7)
    for (const bot of HOUSE_BOTS.slice(-4)) {
      expect(bot.answerChance).toBeGreaterThanOrEqual(0.87)
      expect(bot.think[0]).toBeLessThanOrEqual(3)
    }
    expect(HOUSE_BOTS[0]!.answerChance).toBeLessThan(HOUSE_BOTS.at(-1)!.answerChance)
  })

  it('reste battable : aucun ne rate tout, aucun ne répond avant un doigt', () => {
    for (const bot of HOUSE_BOTS) {
      expect(bot.answerChance).toBeGreaterThanOrEqual(0.45)
      expect(bot.answerChance).toBeLessThanOrEqual(0.95)
      expect(bot.think[0]).toBeGreaterThanOrEqual(1.5)
      expect(bot.think[1]).toBeGreaterThan(bot.think[0])
    }
  })

  it('donne à chaque profil son nom et son allure', () => {
    expect(new Set(HOUSE_BOTS.map((bot) => bot.id)).size).toBe(HOUSE_BOTS.length)
    expect(new Set(HOUSE_BOTS.map((bot) => bot.name)).size).toBe(HOUSE_BOTS.length)
    for (const bot of HOUSE_BOTS) {
      expect(['fast', 'steady', 'sharp']).toContain(bot.trait)
    }
  })

  it('garde les deux noms du serveur (0024) en tête, le plus tendre d’abord', () => {
    expect(HOUSE_BOTS[0]!.id).toBe('maxitoon')
    expect(HOUSE_BOTS[1]!.id).toBe('terretciel')
  })
})
