import { afterEach, describe, expect, it, vi } from 'vitest'

const PROFILE = 'lettre-minute.profile.v1'
const HANDED_OVER = 'lettre-minute.crazygames-data.v1'

/** A browser of its own per start: its localStorage, and the portal's Data module as it stands. */
async function start(browser: Map<string, string>, module: Map<string, string> | null) {
  vi.resetModules()
  // A class per start: `restoreSavedProgress` patches its prototype.
  class FakeStorage {
    getItem(key: string) {
      return browser.get(key) ?? null
    }
    setItem(key: string, value: string) {
      browser.set(key, value)
    }
    removeItem(key: string) {
      browser.delete(key)
    }
  }
  const localStorage = new FakeStorage()
  const data = module && {
    getItem: (key: string) => module.get(key) ?? null,
    setItem: (key: string, value: string) => void module.set(key, value),
    removeItem: (key: string) => void module.delete(key),
  }
  const disabled = () => {
    throw new Error('dataModuleDisabled')
  }
  const SDK = {
    environment: 'local',
    init: () => Promise.resolve(),
    game: {},
    ad: {},
    data: data ?? { getItem: disabled, setItem: disabled, removeItem: disabled },
  }
  vi.stubGlobal('Storage', FakeStorage)
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('location', { hostname: 'localhost' })
  vi.stubGlobal('document', { referrer: '' })
  vi.stubGlobal('window', { localStorage, CrazyGames: { SDK } })
  const portal = await import('./crazygames')
  await portal.initCrazyGames()
  portal.restoreSavedProgress()
  return localStorage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('la sauvegarde du portail', () => {
  it('confie une fois au module les parties jouées avant lui', async () => {
    const browser = new Map([[PROFILE, 'avant']])
    const module = new Map<string, string>()
    await start(browser, module)
    expect(module.get(PROFILE)).toBe('avant')
    expect(browser.get(HANDED_OVER)).toBe('1')
  })

  it('ne donne pas à l’invité la progression du compte qui vient de se déconnecter', async () => {
    const browser = new Map<string, string>()
    const account = new Map([[PROFILE, 'compte']])
    const played = await start(browser, account)
    played.setItem(PROFILE, 'compte joué')
    expect(account.get(PROFILE)).toBe('compte joué')
    // La déconnexion recharge la page, et le module rend la copie de l’invité.
    const guest = new Map<string, string>()
    await start(browser, guest)
    expect(browser.has(PROFILE)).toBe(false)
    expect(guest.has(PROFILE)).toBe(false)
  })

  it('rend au compte qui revient sa propre copie', async () => {
    const browser = new Map([
      [PROFILE, 'invité'],
      [HANDED_OVER, '1'],
    ])
    await start(browser, new Map([[PROFILE, 'compte']]))
    expect(browser.get(PROFILE)).toBe('compte')
  })

  it('n’efface rien quand le module est désactivé', async () => {
    const browser = new Map([[PROFILE, 'local']])
    await start(browser, null)
    await start(browser, null)
    expect(browser.get(PROFILE)).toBe('local')
    expect(browser.has(HANDED_OVER)).toBe(false)
  })
})

/** A portal whose `requestAd` is the test's: it keeps the callbacks to answer when it wants. */
async function startWithAds(sdk: boolean) {
  vi.resetModules()
  const requests: { type: string; callbacks: { adStarted(): void; adFinished(): void; adError(): void } }[] = []
  const game = { gameplayStart: vi.fn(), gameplayStop: vi.fn() }
  const SDK = {
    environment: 'local',
    init: () => Promise.resolve(),
    game,
    ad: { requestAd: (type: string, callbacks: (typeof requests)[number]['callbacks']) => void requests.push({ type, callbacks }) },
  }
  vi.stubGlobal('location', { hostname: 'localhost' })
  vi.stubGlobal('document', { referrer: '' })
  vi.stubGlobal('window', sdk ? { CrazyGames: { SDK } } : {})
  const portal = await import('./crazygames')
  await portal.initCrazyGames()
  return { host: portal.crazyGamesHost, requests, game }
}

describe('les pubs midgame du portail', () => {
  const finish = (host: Awaited<ReturnType<typeof startWithAds>>['host'], runs: number) => {
    for (let i = 0; i < runs; i++) void host.breakAfterRecap(false)
  }

  it('ne coupe ni la première partie ni le bilan, puis demande une pub à « Rejouer » une partie sur deux', async () => {
    const { host, requests } = await startWithAds(true)
    finish(host, 1)
    expect(await host.breakBeforeReplay(false)).toBe('none')
    finish(host, 1)
    expect(requests).toHaveLength(0)
    const asked = host.breakBeforeReplay(false)
    expect(requests.map((r) => r.type)).toEqual(['midgame'])
    requests[0].callbacks.adFinished()
    expect(await asked).toBe('shown')
    finish(host, 1)
    expect(await host.breakBeforeReplay(false)).toBe('none')
    finish(host, 1)
    void host.breakBeforeReplay(false)
    expect(requests).toHaveLength(2)
  })

  it('attend la fin de la pub pour rendre la main, et la laisse partir quand le portail la refuse', async () => {
    const { host, requests } = await startWithAds(true)
    finish(host, 2)
    let over = false
    const asked = host.breakBeforeReplay(false).then((result) => {
      over = true
      return result
    })
    await Promise.resolve()
    expect(over).toBe(false)
    requests[0].callbacks.adError()
    expect(await asked).toBe('unavailable')
  })

  it('épargne un Premium', async () => {
    const { host, requests } = await startWithAds(true)
    finish(host, 2)
    expect(await host.breakBeforeReplay(true)).toBe('spared')
    expect(requests).toHaveLength(0)
  })

  it('rend la main aussitôt sans le SDK', async () => {
    const { host } = await startWithAds(false)
    finish(host, 2)
    expect(await host.breakBeforeReplay(false)).toBe('none')
  })

  it('n’empile pas deux pubs : un appui pendant l’attente rejoint la demande en cours', async () => {
    const { host, requests } = await startWithAds(true)
    finish(host, 2)
    const first = host.breakBeforeReplay(false)
    const second = host.breakBeforeReplay(false)
    expect(requests).toHaveLength(1)
    requests[0].callbacks.adFinished()
    expect(await first).toBe('shown')
    expect(await second).toBe('shown')
  })
})

describe('les événements de jeu du portail', () => {
  it('ne signale que les changements', async () => {
    const { host, game } = await startWithAds(true)
    host.setGameplay(true)
    host.setGameplay(true)
    host.setGameplay(false)
    expect(game.gameplayStart).toHaveBeenCalledTimes(1)
    expect(game.gameplayStop).toHaveBeenCalledTimes(1)
  })
})
