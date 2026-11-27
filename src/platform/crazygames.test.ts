import { afterEach, describe, expect, it, vi } from 'vitest'

const PROFILE = 'lettre-minute.profile.v1'
const LOCALE = 'lettre-minute.locale.v1'
const TUTORIAL = 'lettre-minute.tutorial.v1'
const ACCOUNT = 'lettre-minute.account.v1'
const SESSION = 'sb-project-auth-token'
const HANDED_OVER = 'lettre-minute.crazygames-data.v1'
const OWNER = 'lettre-minute.crazygames-owner.v1'
const CLOUD_CACHE = 'SDK_DATA_CLOUD_CACHE_game'

type Save = Map<string, string>

/**
 * A browser of its own per start: its localStorage, the portal's Data module
 * as it stands (null: switched off) and the portal's player (null: a guest).
 */
async function start(browser: Save, module: Save | null, username: string | null = null) {
  vi.resetModules()
  // A class per start: `restoreSavedProgress` patches its prototype.
  class FakeStorage {
    get length() {
      return browser.size
    }
    key(index: number) {
      return [...browser.keys()][index] ?? null
    }
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
  const handler = (save: Save) => ({
    getItem: (key: string) => save.get(key) ?? null,
    setItem: (key: string, value: string) => void save.set(key, value),
    removeItem: (key: string) => void save.delete(key),
  })
  const disabled = () => {
    throw new Error('dataModuleDisabled')
  }
  let listener: ((user: unknown) => void) | null = null
  const SDK = {
    environment: 'local',
    init: () => Promise.resolve(),
    game: {},
    ad: {},
    data: module ? handler(module) : { getItem: disabled, setItem: disabled, removeItem: disabled },
    user: {
      getUser: () => Promise.resolve(username ? { username } : null),
      addAuthListener: (added: (user: unknown) => void) => {
        listener = added
      },
    },
  }
  const reload = vi.fn()
  vi.stubGlobal('Storage', FakeStorage)
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('location', { hostname: 'localhost' })
  vi.stubGlobal('document', { referrer: '' })
  vi.stubGlobal('window', { localStorage, location: { reload }, CrazyGames: { SDK } })
  const portal = await import('./crazygames')
  await portal.initCrazyGames()
  await portal.restoreSavedProgress()
  return {
    localStorage,
    reload,
    /** The portal signs the player in while the game runs: the SDK swaps its module, the page stays. */
    signIn(name: string, account: Save | null) {
      if (account) SDK.data = handler(account)
      listener?.({ username: name })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('la sauvegarde du portail', () => {
  it('confie une fois au module les parties jouées avant lui', async () => {
    const browser = new Map([[PROFILE, 'avant']])
    const module: Save = new Map()
    await start(browser, module)
    expect(module.get(PROFILE)).toBe('avant')
    expect(browser.get(HANDED_OVER)).toBe('1')
  })

  it('ne donne pas à l’invité la progression du compte qui vient de se déconnecter', async () => {
    const browser: Save = new Map()
    const account = new Map([[PROFILE, 'compte']])
    const played = await start(browser, account, 'Ana')
    played.localStorage.setItem(PROFILE, 'compte joué')
    expect(account.get(PROFILE)).toBe('compte joué')
    // La déconnexion recharge la page, et le module rend la copie de l’invité.
    const guest: Save = new Map()
    await start(browser, guest)
    expect(browser.has(PROFILE)).toBe(false)
    expect(guest.has(PROFILE)).toBe(false)
  })

  // Le testeur du portail : un navigateur neuf, déjà connecté, dont le compte
  // n'a encore aucune sauvegarde. Rien n'ayant répondu au premier lancement,
  // la copie du compte était confiée à l'invité au rechargement.
  it('ne la lui donne pas non plus quand le compte n’avait encore rien sauvegardé', async () => {
    const browser: Save = new Map()
    const account: Save = new Map()
    const played = await start(browser, account, 'Ana')
    played.localStorage.setItem(PROFILE, 'compte joué')
    played.localStorage.setItem(ACCOUNT, 'Ana')
    played.localStorage.setItem(SESSION, 'jeton')
    const guest: Save = new Map()
    await start(browser, guest)
    expect(browser.has(PROFILE)).toBe(false)
    expect(guest.has(PROFILE)).toBe(false)
    // Ni le compte gardé pour le hors-ligne, ni sa session.
    expect(browser.has(ACCOUNT)).toBe(false)
    expect(browser.has(SESSION)).toBe(false)
  })

  // Le SDK ne recharge plus la page à la connexion : il échange son module.
  // Écrire dans celui du lancement mettait la progression du compte dans la
  // sauvegarde de l'invité, qui la retrouvait en se déconnectant.
  it('écrit dans le module du compte après une connexion en cours de partie', async () => {
    const browser: Save = new Map()
    const guest = new Map([[PROFILE, 'invité']])
    const played = await start(browser, guest)
    // Un compte sans sauvegarde : le SDK lui donne celle de l'invité.
    const account = new Map(guest)
    played.signIn('Ana', account)
    played.localStorage.setItem(PROFILE, 'compte joué')
    expect(account.get(PROFILE)).toBe('compte joué')
    expect(guest.get(PROFILE)).toBe('invité')
    expect(played.reload).not.toHaveBeenCalled()
    expect(browser.get(OWNER)).toBe('Ana')
    // Déconnexion : l'invité retrouve sa propre progression, pas celle du compte.
    await start(browser, guest)
    expect(browser.get(PROFILE)).toBe('invité')
    expect(guest.get(PROFILE)).toBe('invité')
  })

  it('rend à l’invité sa progression après un compte qui avait la sienne', async () => {
    const browser: Save = new Map()
    const guest = new Map([[PROFILE, 'invité']])
    await start(browser, guest)
    const account = new Map([[PROFILE, 'compte']])
    const played = await start(browser, account, 'Ana')
    played.localStorage.setItem(PROFILE, 'compte joué')
    await start(browser, guest)
    expect(browser.get(PROFILE)).toBe('invité')
    expect(account.get(PROFILE)).toBe('compte joué')
  })

  it('relance le jeu quand le compte qui se connecte a sa propre sauvegarde', async () => {
    const browser: Save = new Map()
    const played = await start(browser, new Map([[PROFILE, 'invité']]))
    played.signIn('Ana', new Map([[PROFILE, 'compte']]))
    expect(played.reload).toHaveBeenCalledOnce()
    // Le lancement suivant trouve la progression d'un autre et fait place nette.
    expect(browser.get(OWNER)).toBe('')
    await start(browser, new Map([[PROFILE, 'compte']]), 'Ana')
    expect(browser.get(PROFILE)).toBe('compte')
    expect(browser.get(OWNER)).toBe('Ana')
  })

  it('attend l’échange du module avant de dire à qui est la progression', async () => {
    vi.useFakeTimers()
    const browser: Save = new Map()
    const guest = new Map([[PROFILE, 'invité']])
    const played = await start(browser, guest)
    played.signIn('Ana', null)
    expect(browser.get(OWNER)).toBe('')
    await vi.advanceTimersByTimeAsync(20_000)
    expect(browser.get(OWNER)).toBe('Ana')
    expect(played.reload).not.toHaveBeenCalled()
  })

  // Les builds d'avant ont pu copier la progression d'un compte chez l'invité :
  // un navigateur qui a tenu la sauvegarde d'un compte repart de zéro, une fois.
  it('remet à zéro l’invité d’un navigateur où un compte a joué avant ce marqueur', async () => {
    const browser = new Map([
      [PROFILE, 'compte copié'],
      [HANDED_OVER, '1'],
      [CLOUD_CACHE, '{}'],
    ])
    const guest = new Map([[PROFILE, 'compte copié']])
    await start(browser, guest)
    expect(browser.has(PROFILE)).toBe(false)
    expect(guest.has(PROFILE)).toBe(false)
    const again = await start(browser, guest)
    again.localStorage.setItem(PROFILE, 'invité')
    await start(browser, guest)
    expect(browser.get(PROFILE)).toBe('invité')
  })

  it('laisse à l’appareil sa langue et sa leçon faite', async () => {
    const browser: Save = new Map()
    const account = new Map([
      [PROFILE, 'compte'],
      [LOCALE, 'fr'],
      [TUTORIAL, 'true'],
    ])
    await start(browser, account, 'Ana')
    const guest: Save = new Map()
    await start(browser, guest)
    expect(browser.get(LOCALE)).toBe('fr')
    expect(browser.get(TUTORIAL)).toBe('true')
    expect(guest.get(LOCALE)).toBe('fr')
    expect(browser.has(PROFILE)).toBe(false)
  })

  it('rend au compte qui revient sa propre copie', async () => {
    const browser = new Map([
      [PROFILE, 'invité'],
      [HANDED_OVER, '1'],
    ])
    await start(browser, new Map([[PROFILE, 'compte']]), 'Ana')
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

/** The portal with nothing but its ads, answered by `requestAd`. */
async function withAds(requestAd: (type: string, callbacks: Record<string, () => void>) => unknown) {
  vi.resetModules()
  const SDK = { environment: 'local', init: () => Promise.resolve(), game: {}, ad: { requestAd } }
  vi.stubGlobal('location', { hostname: 'localhost' })
  vi.stubGlobal('document', { referrer: '' })
  vi.stubGlobal('window', { location: {}, CrazyGames: { SDK } })
  const portal = await import('./crazygames')
  await portal.initCrazyGames()
  return portal.crazyGamesHost
}

describe('les pubs du portail', () => {
  it('rend la main tout de suite quand le SDK lève', async () => {
    const host = await withAds(() => {
      throw new Error('sdk error')
    })
    await expect(host.midgame?.(false)).resolves.toBe('unavailable')
    await expect(host.showRewarded?.()).resolves.toBe('unavailable')
  })

  it('rend la main tout de suite quand le SDK rejette', async () => {
    const host = await withAds(() => Promise.reject(new Error('sdk error')))
    await expect(host.midgame?.(false)).resolves.toBe('unavailable')
  })

  it('n’attend qu’un court instant une pub qui ne démarre jamais', async () => {
    vi.useFakeTimers()
    const host = await withAds(() => undefined)
    let result: string | null = null
    void host.midgame?.(false).then((answer) => (result = answer))
    await vi.advanceTimersByTimeAsync(9_000)
    expect(result).toBeNull()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(result).toBe('unavailable')
  })

  it('laisse finir une pub qui a démarré', async () => {
    vi.useFakeTimers()
    let callbacks: Record<string, () => void> = {}
    const host = await withAds((_, given) => {
      callbacks = given
      given.adStarted()
    })
    let result: string | null = null
    void host.midgame?.(false).then((answer) => (result = answer))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(result).toBeNull()
    callbacks.adFinished()
    await vi.advanceTimersByTimeAsync(0)
    expect(result).toBe('shown')
  })
})

describe('une pub qui démarre après l’abandon', () => {
  it('fige encore la partie qu’elle couvre', async () => {
    vi.useFakeTimers()
    let callbacks: Record<string, () => void> = {}
    const host = await withAds((_, given) => {
      callbacks = given
    })
    const covered: boolean[] = []
    host.onAdBreak((on) => covered.push(on))
    let result: string | null = null
    void host.midgame?.(false).then((answer) => (result = answer))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(result).toBe('unavailable')
    callbacks.adStarted()
    callbacks.adFinished()
    expect(covered).toEqual([false, true, false])
  })
})
