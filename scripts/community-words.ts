import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

/**
 * The words the moderators accepted, as the import last read them from
 * Supabase. Committed, so that a rebuild off the project — no CLI, not
 * linked, or a day it is down — still ships them rather than losing them.
 */
const SNAPSHOT = 'scripts/community-words.json'

/** lang → category → spellings, as the players proposed them. */
export type CommunityWords = Record<string, Record<string, string[]>>

function readSnapshot(): CommunityWords {
  return existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as CommunityWords) : {}
}

/**
 * Refreshes the snapshot from `dictionary_words`, then answers with it. The
 * table is only readable by a signed-in player; the linked Supabase CLI reads
 * it as the project's owner, so no service key has to be copied by hand.
 */
export async function loadCommunityWords(): Promise<CommunityWords> {
  try {
    const output = execFileSync(
      'supabase',
      [
        'db', 'query', '--linked', '-o', 'json',
        "select category_id, display from public.dictionary_words where source = 'community' order by category_id, word",
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 },
    )
    const { rows } = JSON.parse(output) as { rows: { category_id: string; display: string }[] }
    const words: CommunityWords = {}
    for (const row of rows) {
      // cloud.ts prefixes every language but French, which keeps its bare names.
      const match = /^([a-z]{2}):(.*)$/.exec(row.category_id)
      const [lang, categoryId] = match ? [match[1]!, match[2]!] : ['fr', row.category_id]
      ;((words[lang] ??= {})[categoryId] ??= []).push(row.display.trim())
    }
    writeFileSync(SNAPSHOT, `${JSON.stringify(words, null, 2)}\n`)
    console.log(`→ mots de la communauté : ${rows.length}`)
    return words
  } catch (error) {
    console.warn(`! mots de la communauté : ${(error as Error).message.split('\n')[0]}, relus depuis ${SNAPSHOT}`)
    return readSnapshot()
  }
}
