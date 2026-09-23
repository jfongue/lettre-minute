import { buildWordPack, type WordPack, type WordRow } from '../domain/words'

/**
 * The dictionaries are shipped as JSON arrays of rows and pulled in on demand:
 * loading the thirteen categories up front would cost megabytes for a player
 * who only ever plays the four they have unlocked.
 */
const FILES = import.meta.glob('./words/*.json', { import: 'default' }) as Record<
  string,
  () => Promise<readonly WordRow[]>
>

const loaded = new Map<string, WordPack>()
const loading = new Map<string, Promise<WordPack>>()

export function availableCategoryIds(): string[] {
  return Object.keys(FILES).map((path) => path.replace('./words/', '').replace('.json', ''))
}

export function loadedPack(categoryId: string): WordPack | null {
  return loaded.get(categoryId) ?? null
}

export function loadPack(categoryId: string): Promise<WordPack> {
  const ready = loaded.get(categoryId)
  if (ready) return Promise.resolve(ready)

  const pending = loading.get(categoryId)
  if (pending) return pending

  const file = FILES[`./words/${categoryId}.json`]
  if (!file) return Promise.reject(new Error(`dictionnaire absent : ${categoryId}`))

  const promise = file().then((rows) => {
    const pack = buildWordPack(categoryId, rows)
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
