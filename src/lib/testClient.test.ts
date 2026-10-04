import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ce qui décide qu'un client est un test (`analytics_snapshot`, 0040) : un
 * navigateur piloté se reconnaît à `navigator.webdriver`, et un développeur
 * peut poser le drapeau à la main. Le choix est mémorisé au premier appel, donc
 * chaque cas repart d'un module frais — et d'un `localStorage` à nous, celui de
 * l'environnement de test n'en étant pas un.
 */
const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function load(driver: boolean, dev = false): Promise<typeof import('./testClient')> {
  vi.resetModules()
  vi.stubEnv('DEV', dev)
  Object.defineProperty(navigator, 'webdriver', { value: driver, configurable: true })
  return import('./testClient')
}

describe('testClient', () => {
  it('reconnaît un navigateur piloté', async () => {
    const { testClient } = await load(true)
    expect(testClient()).toBe(true)
  })

  it('ne marque pas un navigateur ordinaire', async () => {
    const { testClient } = await load(false)
    expect(testClient()).toBe(false)
  })

  it('marque le serveur de développement', async () => {
    const { testClient } = await load(false, true)
    expect(testClient()).toBe(true)
  })

  it('suit le drapeau posé par le développeur, même sur un chrome normal', async () => {
    const { setTestClient, testClient } = await load(false)
    setTestClient(true)
    expect(testClient()).toBe(true)
    expect(store.get('lettre-minute.test-client')).toBe('1')

    setTestClient(false)
    expect(testClient()).toBe(false)
    expect(store.get('lettre-minute.test-client')).toBeUndefined()
  })

  it('n’oublie pas le drapeau au chargement suivant', async () => {
    store.set('lettre-minute.test-client', '1')
    const { testClient } = await load(false)
    expect(testClient()).toBe(true)
  })
})
