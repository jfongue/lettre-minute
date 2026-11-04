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

describe('l’invitation du portail', () => {
  async function portalWith(game: Record<string, unknown>) {
    vi.resetModules()
    vi.stubGlobal('location', { hostname: 'localhost' })
    vi.stubGlobal('document', { referrer: '' })
    vi.stubGlobal('window', { CrazyGames: { SDK: { environment: 'local', init: () => Promise.resolve(), game, ad: {} } } })
    const portal = await import('./crazygames')
    await portal.initCrazyGames()
    return portal.crazyGamesHost
  }

  it('montre le bouton du portail pour la table du salon, et le retire ensuite', async () => {
    const shown: Record<string, string>[] = []
    let hidden = 0
    const host = await portalWith({ showInviteButton: (p: Record<string, string>) => (shown.push(p), 'link'), hideInviteButton: () => hidden++ })
    host.inviteToTable('0b6d3a52-1c4e-4f7a-9d21-5a8e7c3b1f00')
    host.inviteToTable(null)
    expect(shown).toEqual([{ table: '0b6d3a52-1c4e-4f7a-9d21-5a8e7c3b1f00' }])
    expect(hidden).toBe(1)
  })

  it('ne lit comme table que l’identifiant que le lien porte', async () => {
    const id = '0B6D3A52-1C4E-4F7A-9D21-5A8E7C3B1F00'
    expect((await portalWith({ getInviteParam: () => id })).invitedTable()).toBe(id.toLowerCase())
    expect((await portalWith({ getInviteParam: () => '1; drop table' })).invitedTable()).toBeNull()
    expect((await portalWith({})).invitedTable()).toBeNull()
  })
})
