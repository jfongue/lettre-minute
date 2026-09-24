import { buildWordPack, type WordPack, type WordRow } from '../domain/words'

/**
 * The dictionaries are shipped as JSON arrays of rows, one folder per
 * language, and pulled in on demand: loading the categories up front would
 * cost megabytes for a player who only ever plays the four they have
 * unlocked, in the one language they play in.
 */
const FILES = import.meta.glob('./words/*/*.json', { import: 'default' }) as Record<
  string,
  () => Promise<readonly WordRow[]>
>

const loaded = new Map<string, WordPack>()
const loading = new Map<string, Promise<WordPack>>()

const pathOf = (lang: string, categoryId: string) => `./words/${lang}/${categoryId}.json`

export function availableCategoryIds(lang: string): string[] {
  const prefix = `./words/${lang}/`
  return Object.keys(FILES)
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length).replace('.json', ''))
}

export function loadPack(lang: string, categoryId: string): Promise<WordPack> {
  const path = pathOf(lang, categoryId)
  const ready = loaded.get(path)
  if (ready) return Promise.resolve(ready)

  const pending = loading.get(path)
  if (pending) return pending

  const file = FILES[path]
  if (!file) return Promise.reject(new Error(`dictionnaire absent : ${lang}/${categoryId}`))

  const promise = file().then((rows) => {
    const pack = buildWordPack(categoryId, rows)
    loaded.set(path, pack)
    loading.delete(path)
    return pack
  })
  loading.set(path, promise)
  return promise
}

export function loadPacks(lang: string, categoryIds: readonly string[]): Promise<WordPack[]> {
  return Promise.all(categoryIds.map((id) => loadPack(lang, id)))
}
