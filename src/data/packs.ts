import { parseWordPack, type WordPack } from '../domain/words'

/**
 * The dictionaries are shipped as raw text and pulled in on demand: loading the
 * thirteen categories up front would cost megabytes for a player who only ever
 * plays the four they have unlocked.
 */
const FILES = import.meta.glob('./words/*.txt', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>

const loaded = new Map<string, WordPack>()
const loading = new Map<string, Promise<WordPack>>()

export function availableCategoryIds(): string[] {
  return Object.keys(FILES).map((path) => path.replace('./words/', '').replace('.txt', ''))
}

export function loadedPack(categoryId: string): WordPack | null {
  return loaded.get(categoryId) ?? null
}

export function loadPack(categoryId: string): Promise<WordPack> {
  const ready = loaded.get(categoryId)
  if (ready) return Promise.resolve(ready)

  const pending = loading.get(categoryId)
  if (pending) return pending

  const file = FILES[`./words/${categoryId}.txt`]
  if (!file) return Promise.reject(new Error(`dictionnaire absent : ${categoryId}`))

  const promise = file().then((raw) => {
    const pack = parseWordPack(categoryId, raw)
    loaded.set(categoryId, pack)
    loading.delete(categoryId)
    return pack
  })
  loading.set(categoryId, promise)
  return promise
}

export function loadPacks(categoryIds: readonly string[]): Promise<WordPack[]> {
  return Promise.all(categoryIds.map(loadPack))
}
