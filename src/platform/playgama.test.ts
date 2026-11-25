import { afterEach, describe, expect, it, vi } from 'vitest'
import config from '../../playgama/public/playgama-bridge-config.json'
import { ACHIEVEMENTS, isNamed } from '../domain/achievements'

type AdState = 'loading' | 'opened' | 'closed' | 'rewarded' | 'failed'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** The Bridge as the portal runs it: each ad request is answered by `answer`, later, by hand. */
async function withBridge(unlocked: string[] = []) {
  vi.resetModules()
  const listeners = new Map<string, (state: string) => void>()
  const advertisement = {
    isAdvancedBannersSupported: true,
    showAdvancedBanners: vi.fn(),
    hideAdvancedBanners: vi.fn(),
    isInterstitialSupported: true,
    isRewardedSupported: true,
    interstitialState: 'closed' as AdState,
    rewardedState: 'closed' as AdState,
    showInterstitial: vi.fn(),
    showRewarded: vi.fn(),
    on: (event: string, listener: (state: string) => void) => void listeners.set(event, listener),
  }
  const bridge = {
    initialize: () => Promise.resolve(),
    platform: { id: 'playgama', language: 'en', isAudioEnabled: true, isPaused: false, sendMessage: () => Promise.resolve(), on() {} },
    advertisement,
    storage: { get: () => Promise.resolve([]), set: () => Promise.resolve(), delete: () => Promise.resolve() },
    achievements: {
      unlock: vi.fn(() => Promise.resolve()),
      getAchievements: () => Promise.resolve(unlocked.map((id) => ({ id, unlocked: true }))),
    },
  }
  const root = { dataset: {} as Record<string, string> }
  vi.stubGlobal('window', { bridge })
  vi.stubGlobal('document', { documentElement: root })
  const portal = await import('./playgama')
  await portal.initPlaygama()
  const interstitial = (state: AdState) => {
    advertisement.interstitialState = state
    listeners.get('interstitial_state_changed')?.(state)
  }
  const banner = (state: string) => listeners.get('advanced_banners_state_changed')?.(state)
  return { host: portal.playgamaHost, advertisement, interstitial, banner, root, bridge }
}

describe('les pubs du Bridge', () => {
  it('attend une pub encore en chargement au-delà de dix secondes', async () => {
    vi.useFakeTimers()
    const { host, interstitial } = await withBridge()
    let result: string | null = null
    void host.midgame(false).then((answer) => (result = answer))
    interstitial('loading')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(result).toBeNull()
    interstitial('opened')
    interstitial('closed')
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toBe('shown')
  })

  it('ne redemande pas une pub tant que la précédente n’est pas finie', async () => {
    vi.useFakeTimers()
    const { host, advertisement, interstitial } = await withBridge()
    void host.midgame(false)
    interstitial('loading')
    await vi.advanceTimersByTimeAsync(30_000)
    let result: string | null = null
    void host.midgame(false).then((answer) => (result = answer))
    expect(advertisement.showInterstitial).toHaveBeenCalledTimes(1)
    interstitial('opened')
    interstitial('closed')
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toBe('unavailable')
  })

  it('signale une pub ouverte après l’abandon, pour figer la partie', async () => {
    vi.useFakeTimers()
    const { host, interstitial } = await withBridge()
    const covered: boolean[] = []
    host.onAdBreak((on) => covered.push(on))
    void host.midgame(false)
    await vi.advanceTimersByTimeAsync(10_000)
    interstitial('opened')
    interstitial('closed')
    expect(covered).toEqual([false, true, false])
  })
})

describe('la bannière du Bridge', () => {
  it('ne réserve sa bande qu’une fois la bannière affichée, et la rend à son retrait', async () => {
    const { host, advertisement, banner, root } = await withBridge()
    host.setBanner(true)
    expect(advertisement.showAdvancedBanners).toHaveBeenCalledWith('run')
    expect('portalBanner' in root.dataset).toBe(false)
    banner('shown')
    expect('portalBanner' in root.dataset).toBe(true)
    host.setBanner(false)
    expect(advertisement.hideAdvancedBanners).toHaveBeenCalledTimes(1)
    expect('portalBanner' in root.dataset).toBe(false)
  })

  it('ne laisse pas de bande vide pour une bannière qui échoue', async () => {
    const { host, banner, root } = await withBridge()
    host.setBanner(true)
    banner('failed')
    expect('portalBanner' in root.dataset).toBe(false)
  })
})

describe('les succès du Bridge', () => {
  it('envoie une fois chaque succès nommé qu’il n’a pas déjà', async () => {
    const { host, bridge } = await withBridge(['level_4'])
    host.unlockAchievements(['level-4', 'runs-10'])
    host.unlockAchievements(['runs-10'])
    await vi.waitFor(() => expect(bridge.achievements.unlock).toHaveBeenCalledTimes(1))
    expect(bridge.achievements.unlock).toHaveBeenCalledWith('runs_10')
  })

  it('déclare dans la config exactement les succès nommés du jeu', () => {
    const named = ACHIEVEMENTS.filter((achievement) => isNamed(achievement.id)).map((achievement) => achievement.id.replace(/-/g, '_'))
    expect(config.achievements.map((achievement) => achievement.id).sort()).toEqual([...named].sort())
  })
})
