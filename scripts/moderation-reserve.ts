import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { capitalized, compactWord } from '../src/domain/text.ts'
import type { WordRow } from '../src/domain/words.ts'

/**
 * Loads the moderation reserve (0019) into the linked Supabase project: the
 * obvious words the dictionaries miss, which `top_up_moderation` pours into a
 * moderator's queue once he has finished it. Rerunnable — a word already in
 * the reserve keeps its release date — and a word some import has since put
 * in the embedded dictionary is left out rather than asked about again.
 *
 *   npm run seed:moderation            load
 *   npm run seed:moderation -- --dry   print the SQL only
 */
const RESERVE = 'scripts/moderation-reserve.json'

/** lang → category → spellings, as a player would have proposed them. */
type Reserve = Record<string, Record<string, string[]>>

const reserve = JSON.parse(readFileSync(RESERVE, 'utf8')) as Reserve
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`
// cloud.ts prefixes every language but French, which keeps its bare names.
const scoped = (lang: string, value: string) => (lang === 'fr' ? value : `${lang}:${value}`)

const rows: string[] = []
for (const [lang, categories] of Object.entries(reserve)) {
  for (const [categoryId, words] of Object.entries(categories)) {
    const path = `src/data/words/${lang}/${categoryId}.json`
    if (!existsSync(path)) {
      console.warn(`! ${lang}/${categoryId} : pas de dictionnaire, mots écartés`)
      continue
    }
    const known = new Set((JSON.parse(readFileSync(path, 'utf8')) as WordRow[]).map(([display]) => compactWord(display)))
    let kept = 0
    for (const display of words) {
      if (known.has(compactWord(display))) continue
      // A house bot proposes them, and a proposal reads as a name — « Omoplate »
      // —, unless the spelling already carries its own capitals (eBay, YouTube).
      const trimmed = display.trim()
      const word = trimmed === trimmed.toLowerCase() ? capitalized(trimmed) : trimmed
      rows.push(`(${quote(scoped(lang, categoryId))}, ${quote(scoped(lang, word.toLowerCase()))}, ${quote(word)})`)
      kept++
    }
    console.error(`→ ${lang}/${categoryId} : ${kept}/${words.length}`)
  }
}

const sql = `insert into public.moderation_reserve (category_id, word, display) values\n${rows.join(',\n')}\non conflict do nothing;\n`

if (process.argv.includes('--dry')) {
  process.stdout.write(sql)
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'reserve-')), 'reserve.sql')
  writeFileSync(file, sql)
  execFileSync('supabase', ['db', 'query', '--linked', '-f', file], { stdio: 'inherit', timeout: 120_000 })
  console.log(`→ réserve : ${rows.length} mots envoyés`)
}
