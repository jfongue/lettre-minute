import { describe, expect, it } from 'vitest'
import { FEATURES } from '../domain/features'
import { appHost } from './app'
import { crazyGamesHost } from './crazygames'
import { redditHost } from './reddit'

const ids = new Set(FEATURES.map((feature) => feature.id))

describe('les hôtes', () => {
  it('ne ferment que des fonctionnalités qui existent', () => {
    // Un identifiant mal écrit ne fermerait rien, sans erreur.
    for (const host of [appHost, crazyGamesHost, redditHost]) {
      for (const id of host.closedFeatures) expect(ids).toContain(id)
    }
  })

  it('laissent toute la partie à Android et au web', () => {
    expect(appHost.closedFeatures.size).toBe(0)
  })

  it('laissent à CrazyGames toute la progression qui vit sur l’appareil', () => {
    for (const id of ['powers', 'tutorial', 'stats', 'avatar', 'achievements', 'categoryBans', 'hiddenWords']) {
      expect(crazyGamesHost.closedFeatures).not.toContain(id)
    }
  })
})
