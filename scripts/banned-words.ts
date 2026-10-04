import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * The words the moderators flagged for removal — the ones an addition has not
 * brought back since — as the import last read them from Supabase. Committed,
 * like the community words, so that a rebuild off the project still drops them
 * rather than letting them back in.
 *
 * The keys, not the spellings: a ban names the entry the dictionary holds, and
 * that is what `import-words` removes — its inflected forms with it.
 */
const SNAPSHOT = 'scripts/banned-words.json'

/** lang → category → canonical keys, as the moderators settled them. */
export type BannedWords = Record<string, Record<string, string[]>>

function readSnapshot(): BannedWords {
  return existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as BannedWords) : {}
}

/**
 * Refreshes the snapshot from `word_reviews`, then answers with it. A word can
 * carry both a ban and an addition (0038): only the latest settled one counts,
 * so an addition accepted after a ban brings the word back.
 */
export async function loadBannedWords(): Promise<BannedWords> {
  try {
    const output = execFileSync(
      'supabase',
      [
        'db', 'query', '--linked', '-o', 'json',
        "select distinct on (category_id, word) category_id, word, kind from public.word_reviews where status = 'accepted' order by category_id, word, coalesce(decided_at, created_at) desc",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 },
    )
    const parsed = JSON.parse(output) as
      | { category_id: string; word: string; kind: string }[]
      | { rows: { category_id: string; word: string; kind: string }[] }
    const rows = Array.isArray(parsed) ? parsed : parsed.rows
    const words: BannedWords = {}
    let kept = 0
    for (const row of rows) {
      if (row.kind !== 'ban') continue
      // cloud.ts prefixes every language but French, which keeps its bare names.
      const match = /^([a-z]{2}):(.*)$/.exec(row.category_id)
      const [lang, categoryId] = match ? [match[1]!, match[2]!] : ['fr', row.category_id]
      ;((words[lang] ??= {})[categoryId] ??= []).push(row.word.trim())
      kept++
    }
    writeFileSync(SNAPSHOT, `${JSON.stringify(words, null, 2)}\n`)
    console.log(`→ mots bannis : ${kept}/${rows.length}`)
    return words
  } catch (error) {
    console.warn(`! mots bannis : ${(error as Error).message.split('\n')[0]}, relus depuis ${SNAPSHOT}`)
    return readSnapshot()
  }
}
