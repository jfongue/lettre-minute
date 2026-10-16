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
      for (const id of host.superModeratorFeatures) expect(ids).toContain(id)
      for (const id of host.openedFeatures) {
        expect(ids).toContain(id)
        expect(host.closedFeatures).not.toContain(id)
      }
    }
  })

  it('ouvrent à CrazyGames le défi du moment, qui fait revenir sans serveur', () => {
    expect(crazyGamesHost.openedFeatures).toContain('weekly')
  })

  it('rendent au super modérateur de CrazyGames ses outils et la modération, jamais un achat ni un lien hors de la page', () => {
    for (const id of ['debugBoard', 'dashboard', 'wordsBoard', 'spyHistory', 'moderation', 'myRequests']) {
      expect(crazyGamesHost.superModeratorFeatures).toContain(id)
    }
    for (const id of ['premium', 'share', 'support', 'storeUpdate', 'ads', 'playGames']) {
      expect(crazyGamesHost.superModeratorFeatures).not.toContain(id)
    }
    expect(redditHost.superModeratorFeatures.size).toBe(0)
  })

  it('laissent toute la partie à Android et au web', () => {
    expect(appHost.closedFeatures.size).toBe(0)
  })

  it('laissent à CrazyGames toute la progression qui vit sur l’appareil', () => {
    for (const id of ['powers', 'tutorial', 'stats', 'avatar', 'achievements', 'hiddenWords']) {
      expect(crazyGamesHost.closedFeatures).not.toContain(id)
    }
  })

  it('ferment le filtrage sur CrazyGames, où ni bonus de niveau ni Premium ne l’ouvrent', () => {
    expect(crazyGamesHost.levelBonuses).toBe(false)
    expect(crazyGamesHost.closedFeatures).toContain('categoryBans')
  })

  it('ouvrent à l’invité de CrazyGames les classements du serveur, sans lui donner de compte anonyme', () => {
    expect(crazyGamesHost.closedFeatures).not.toContain('leaderboards')
    expect(crazyGamesHost.guestBoards).toBe(true)
    expect(crazyGamesHost.anonymousAccounts).toBe(false)
    expect(appHost.guestBoards).toBe(false)
    expect(appHost.anonymousAccounts).toBe(true)
    expect(appHost.account).toBeUndefined()
    // Reddit n'a pas de classement : il ne se classe pas tout seul.
    expect(redditHost.closedFeatures).toContain('leaderboards')
    expect(redditHost.guestBoards).toBe(false)
  })

  it('ouvrent à CrazyGames les amis, le duel et la modération qu’un compte nommé du portail porte, jamais ce qui mène hors de la page', () => {
    // Le compte que `crazygames-auth` (0073) ouvre au joueur connecté est nommé :
    // les amis, le face-à-face, le duel — matchmaking compris — et la modération
    // avec les mots qu'il propose le lisent.
    for (const id of [
      'friends',
      'rivalry',
      'duel',
      'proposeWord',
      'myRequests',
      'wordsNews',
      'moderation',
      'moderatorOffer',
      'electModerator',
      'wordFlag',
    ]) {
      expect(crazyGamesHost.closedFeatures).not.toContain(id)
    }
    // Le défi de 24 h, l'invitation par e-mail ou par lien, les réactions qui
    // s'y accrochent, la boîte à idées et tout ce qui demande plus que le serveur
    // du portail.
    for (const id of ['challenges', 'friendInvite', 'reactions', 'ideasBox']) {
      expect(crazyGamesHost.closedFeatures).toContain(id)
    }
  })

  it('ne vendent Premium que sur le téléphone, et ne passent de pubs récompensées que là et sur CrazyGames', () => {
    expect(appHost.premiumStore && appHost.rewardedAds).toBe(true)
    for (const host of [crazyGamesHost, redditHost]) expect(host.premiumStore).toBe(false)
    // La Full Launch du portail les autorise ; une révélation payée qu'on ne
    // peut pas payer n'y serait plus illimitée pour rien.
    expect(crazyGamesHost.rewardedAds).toBe(true)
    expect(crazyGamesHost.unlimitedReveals).toBe(false)
    expect(redditHost.rewardedAds).toBe(false)
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
