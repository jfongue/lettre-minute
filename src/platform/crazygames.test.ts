import { afterEach, describe, expect, it, vi } from 'vitest'

const PROFILE = 'lettre-minute.profile.v1'
const HANDED_OVER = 'lettre-minute.crazygames-data.v1'

/** A browser of its own per start: its localStorage, and the portal's Data module as it stands. */
async function start(browser: Map<string, string>, module: Map<string, string> | null, ad: object = {}) {
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
    ad,
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
  return { localStorage, portal }
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
    const { localStorage: played } = await start(browser, account)
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

type AdCallbacks = { adFinished(): void; adError(): void }

/** The portal with ads: each midgame asked waits in `requests` until the test answers it. */
async function startWithAds() {
  const requests: AdCallbacks[] = []
  const requestAd = vi.fn((_type: string, callbacks: AdCallbacks) => void requests.push(callbacks))
  const { portal } = await start(new Map(), null, { requestAd })
  const host = portal.crazyGamesHost
  const finish = (runs: number, afterAd = false) => {
    for (let i = 0; i < runs; i++) void host.breakAfterRecap(false, afterAd)
  }
  return { host, requests, finish }
}

describe('la pub midgame du portail', () => {
  it('ne coupe ni la première partie ni le récap, puis demande une pub à « Rejouer » une partie sur deux', async () => {
    const { host, requests, finish } = await startWithAds()
    finish(1)
    expect(await host.breakBeforeReplay(false)).toBe('none')
    finish(1)
    expect(requests).toHaveLength(0)
    const asked = host.breakBeforeReplay(false)
    expect(requests).toHaveLength(1)
    requests[0].adFinished()
    expect(await asked).toBe('shown')
    finish(1)
    expect(await host.breakBeforeReplay(false)).toBe('none')
    finish(1)
    void host.breakBeforeReplay(false)
    expect(requests).toHaveLength(2)
  })

  it('compte la pub de révélation du récap comme la pause : jamais deux pubs d’affilée', async () => {
    const { host, requests, finish } = await startWithAds()
    finish(1)
    finish(1, true)
    expect(await host.breakBeforeReplay(false)).toBe('none')
    expect(requests).toHaveLength(0)
  })

  it('attend la fin de la pub, et laisse partir la partie quand le portail la refuse', async () => {
    const { host, requests, finish } = await startWithAds()
    finish(2)
    let over = false
    const asked = host.breakBeforeReplay(false).then((result) => {
      over = true
      return result
    })
    await Promise.resolve()
    expect(over).toBe(false)
    requests[0].adError()
    expect(await asked).toBe('unavailable')
  })

  it('épargne un Premium', async () => {
    const { host, requests, finish } = await startWithAds()
    finish(2)
    expect(await host.breakBeforeReplay(true)).toBe('spared')
    expect(requests).toHaveLength(0)
  })

  it('n’empile pas deux pubs : un appui pendant l’attente rejoint la demande en cours', async () => {
    const { host, requests, finish } = await startWithAds()
    finish(2)
    const first = host.breakBeforeReplay(false)
    const second = host.breakBeforeReplay(false)
    expect(requests).toHaveLength(1)
    requests[0].adFinished()
    expect(await first).toBe('shown')
    expect(await second).toBe('shown')
  })
})

const TABLE = '0b7e1c52-3f55-4a8e-9a43-1f2a6a3c9d10'

/** The portal's room calls, with the page's invite parameters and a tab's session storage. */
async function startRooms(game: Record<string, unknown>, session = new Map<string, string>()) {
  vi.resetModules()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => void session.set(key, value),
    removeItem: (key: string) => void session.delete(key),
  })
  vi.stubGlobal('location', { hostname: 'localhost' })
  vi.stubGlobal('document', { referrer: '' })
  vi.stubGlobal('window', { CrazyGames: { SDK: { environment: 'local', init: () => Promise.resolve(), game, ad: {} } } })
  const portal = await import('./crazygames')
  await portal.initCrazyGames()
  return { rooms: portal.crazyGamesHost.rooms!, session }
}

describe('les salles du portail', () => {
  it('garde l’invitation pour la page que la connexion du portail recharge', async () => {
    const { rooms, session } = await startRooms({ inviteParams: { duel: TABLE } })
    expect(rooms.invited()).toBe(TABLE)
    const { rooms: reloaded } = await startRooms({ inviteParams: null }, session)
    expect(reloaded.invited()).toBe(TABLE)
    reloaded.clearInvite()
    expect(reloaded.invited()).toBeNull()
  })

  it('ne retient ni un identifiant qui n’est pas une table, ni un démarrage ordinaire', async () => {
    const { rooms } = await startRooms({ inviteParams: { duel: 'nope' } })
    expect(rooms.invited()).toBeNull()
  })

  it('garde l’invitation d’un ami arrivé pendant la partie', async () => {
    let join: ((params: Record<string, string> | null) => void) | undefined
    const { rooms, session } = await startRooms({ addJoinRoomListener: (listener: typeof join) => (join = listener) })
    const heard = vi.fn()
    rooms.onJoin(heard)
    join?.({ duel: TABLE })
    expect(heard).toHaveBeenCalledWith(TABLE)
    expect([...session.values()]).toEqual([TABLE])
  })

  it('n’annonce aucune salle tant qu’aucune n’est posée', async () => {
    vi.useFakeTimers()
    const updateRoom = vi.fn()
    const leftRoom = vi.fn()
    const { rooms } = await startRooms({ updateRoom, leftRoom })
    rooms.setRoom(null)
    await vi.advanceTimersByTimeAsync(1000)
    expect(updateRoom).not.toHaveBeenCalled()
    expect(leftRoom).not.toHaveBeenCalled()
    rooms.setRoom({ table: TABLE, joinable: true })
    await vi.advanceTimersByTimeAsync(1000)
    expect(updateRoom).toHaveBeenCalledWith({ roomId: TABLE, isJoinable: true, inviteParams: { duel: TABLE } })
    vi.useRealTimers()
  })
})
