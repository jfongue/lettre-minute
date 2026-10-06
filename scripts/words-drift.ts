import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { acceptable } from './word-shape.ts'
import type { CommunityWords } from './community-words.ts'

/**
 * What the moderators accepted online against the snapshot the dictionaries
 * were built from. A word accepted after the last import lives on the server
 * alone: invisible offline and in a challenge, and no moderation can repair
 * that — only a new import can. `npm run check` cannot see it either, its
 * tests reading the committed snapshot, so this is the one guard that looks
 * at the live project.
 *
 * Unlike `loadCommunityWords`, it never writes the snapshot and never falls
 * back to it: run offline it fails, which is the point — a drift report that
 * answers from the file it audits says nothing.
 */
const SNAPSHOT = 'scripts/community-words.json'

function serverWords(): CommunityWords {
  const output = execFileSync(
    'supabase',
    [
      'db', 'query', '--linked', '-o', 'json',
      "select category_id, display from public.dictionary_words where source = 'community' order by category_id, word",
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 120_000 },
  )
  const parsed = JSON.parse(output) as
    | { category_id: string; display: string }[]
    | { rows: { category_id: string; display: string }[] }
  const rows = Array.isArray(parsed) ? parsed : parsed.rows
  const words: CommunityWords = {}
  for (const row of rows) {
    // The same gate as the import: a spelling no dictionary could hold stays
    // out of the snapshot, so it cannot count as a drift either.
    if (!acceptable(row.display)) continue
    const match = /^([a-z]{2}):(.*)$/.exec(row.category_id)
    const [lang, categoryId] = match ? [match[1]!, match[2]!] : ['fr', row.category_id]
    ;((words[lang] ??= {})[categoryId] ??= []).push(row.display.trim())
  }
  return words
}

function byCategory(words: CommunityWords): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const [lang, categories] of Object.entries(words)) {
    for (const [category, spellings] of Object.entries(categories)) {
      out.set(`${lang}/${category}`, new Set(spellings))
    }
  }
  return out
}

function main(): number {
  const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as CommunityWords
  const online = byCategory(serverWords())
  const committed = byCategory(snapshot)
  const keys = [...new Set([...online.keys(), ...committed.keys()])].sort()
  let missing = 0
  let extra = 0
  for (const key of keys) {
    const here = online.get(key) ?? new Set<string>()
    const there = committed.get(key) ?? new Set<string>()
    for (const word of [...here].filter((word) => !there.has(word)).sort()) {
      missing++
      console.error(`! ${key}: ${word} accepté en ligne, absent de l'instantané`)
    }
    for (const word of [...there].filter((word) => !here.has(word)).sort()) {
      extra++
      console.error(`! ${key}: ${word} dans l'instantané, retiré en ligne`)
    }
  }
  if (missing === 0 && extra === 0) {
    console.log(`→ dictionnaires et communauté d'accord (${online.size} catégories)`)
    return 0
  }
  console.error(`→ ${missing} mot(s) à embarquer, ${extra} à retirer : relancer l'import et commiter les dictionnaires`)
  return 1
}

process.exitCode = main()
