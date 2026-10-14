import { describe, expect, it } from 'vitest'
import { FEATURES } from '../domain/features'
import { appHost } from './app'
import { crazyGamesHost, encryptScore } from './crazygames'
import { redditHost } from './reddit'

const ids = new Set(FEATURES.map((feature) => feature.id))

describe('les hôtes', () => {
  it('ne ferment que des fonctionnalités qui existent', () => {
    // Un identifiant mal écrit ne fermerait rien, sans erreur.
    for (const host of [appHost, crazyGamesHost, redditHost]) {
      for (const id of host.closedFeatures) expect(ids).toContain(id)
      for (const id of host.openedFeatures) {
        expect(ids).toContain(id)
        expect(host.closedFeatures).not.toContain(id)
      }
    }
  })

  it('ouvrent à CrazyGames le défi du jour, qui fait revenir sans serveur', () => {
    expect(crazyGamesHost.openedFeatures).toContain('daily')
    expect(redditHost.openedFeatures).not.toContain('daily')
  })

  it('laissent toute la partie à Android et au web', () => {
    expect(appHost.closedFeatures.size).toBe(0)
  })

  it('laissent à CrazyGames toute la progression qui vit sur l’appareil', () => {
    for (const id of ['powers', 'tutorial', 'stats', 'avatar', 'achievements', 'categoryBans', 'hiddenWords']) {
      expect(crazyGamesHost.closedFeatures).not.toContain(id)
    }
  })

  it('ne classent que les parties du joueur sur CrazyGames, où les classements restent ouverts sans serveur', () => {
    expect(crazyGamesHost.closedFeatures).not.toContain('leaderboards')
    expect(crazyGamesHost.localBoards).toBe(true)
    expect(appHost.localBoards).toBe(false)
    // Reddit n'a pas de classement : il ne se classe pas tout seul.
    expect(redditHost.closedFeatures).toContain('leaderboards')
    expect(redditHost.localBoards).toBe(false)
  })

  it('ne vendent Premium et ne passent les pubs récompensées que sur le téléphone', () => {
    expect(appHost.premiumStore && appHost.rewardedAds).toBe(true)
    for (const host of [crazyGamesHost, redditHost]) {
      expect(host.premiumStore).toBe(false)
      expect(host.rewardedAds).toBe(false)
    }
  })
})

describe('la pub récompensée', () => {
  it('ne récompense rien sans SDK, et ne lève jamais', async () => {
    // Hors du portail, ou un SDK qui ne répond pas : la récompense ne vient
    // qu'au bout d'une pub vue, jamais d'une erreur.
    await expect(crazyGamesHost.showRewarded()).resolves.toBe('unavailable')
    await expect(redditHost.showRewarded()).resolves.toBe('unavailable')
  })
})

describe('le tableau du portail', () => {
  it('chiffre un score que le portail sait relire', async () => {
    // 32 octets en base64, comme le portail les génère ; le déchiffrement suit
    // son snippet à la lettre, IV de 12 octets devant et AES-GCM derrière.
    const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
    const bytes = Uint8Array.from(atob(await encryptScore(152, key)), (character) => character.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey('raw', Uint8Array.from(atob(key), (character) => character.charCodeAt(0)), { name: 'AES-GCM' }, false, ['decrypt'])
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, cryptoKey, bytes.subarray(12))
    expect(bytes.length).toBeGreaterThan(12)
    expect(new TextDecoder().decode(plain)).toBe('152')
  })

  it('n’envoie rien sans SDK, et ne lève jamais', () => {
    // Le portail seul classe : les autres hôtes n'ont pas de tableau, et un
    // envoi qui échoue ne doit coûter qu'un rang.
    expect(() => crazyGamesHost.submitScore(120)).not.toThrow()
    expect(() => appHost.submitScore(120)).not.toThrow()
    expect(() => redditHost.submitScore(120)).not.toThrow()
  })
})
