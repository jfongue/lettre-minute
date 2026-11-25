import { afterEach, describe, expect, it, vi } from 'vitest'

type AdState = 'loading' | 'opened' | 'closed' | 'rewarded' | 'failed'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** The Bridge as the portal runs it: each ad request is answered by `answer`, later, by hand. */
async function withBridge() {
  vi.resetModules()
  const listeners = new Map<string, (state: AdState) => void>()
  const advertisement = {
    isInterstitialSupported: true,
    isRewardedSupported: true,
    interstitialState: 'closed' as AdState,
    rewardedState: 'closed' as AdState,
    showInterstitial: vi.fn(),
    showRewarded: vi.fn(),
    on: (event: string, listener: (state: AdState) => void) => void listeners.set(event, listener),
  }
  const bridge = {
    initialize: () => Promise.resolve(),
    platform: { id: 'playgama', language: 'en', isAudioEnabled: true, isPaused: false, sendMessage: () => Promise.resolve(), on() {} },
    advertisement,
    storage: { get: () => Promise.resolve([]), set: () => Promise.resolve(), delete: () => Promise.resolve() },
  }
  vi.stubGlobal('window', { bridge })
  const portal = await import('./playgama')
  await portal.initPlaygama()
  const interstitial = (state: AdState) => {
    advertisement.interstitialState = state
    listeners.get('interstitial_state_changed')?.(state)
  }
  return { host: portal.playgamaHost, advertisement, interstitial }
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
