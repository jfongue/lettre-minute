import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { compactWord, normalizeWord } from '../src/domain/text.ts'
import type { WordRow } from '../src/domain/words.ts'
import { acceptable } from './word-shape.ts'

/**
 * The spelling corrections a super moderator made from the words board
 * (`amend_word`, 0102), as the import last read them from Supabase. Committed,
 * like the banned and community words, so that a rebuild off the project still
 * ships them.
 *
 * The embedded dictionaries are the game's truth for challenges and bots, so a
 * correction reaches them here only — never as a runtime override.
 */
const SNAPSHOT = 'scripts/amended-words.json'

export interface Amendment {
  /** The bare key the word had (`WordEntry.key`), or its old spelling: both normalize alike. */
  from: string
  /** The corrected spelling. */
  to: string
}

/** lang → category → corrections, oldest first so that a later one wins. */
export type AmendedWords = Record<string, Record<string, Amendment[]>>

function readSnapshot(): AmendedWords {
  return existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as AmendedWords) : {}
}

/** Refreshes the snapshot from `word_amendments`, then answers with it. */
export async function loadAmendedWords(): Promise<AmendedWords> {
  try {
    const output = execFileSync(
      'supabase',
      [
        'db', 'query', '--linked', '-o', 'json',
        'select category_id, word, display from public.word_amendments order by created_at, category_id, word',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 120_000 },
    )
    const parsed = JSON.parse(output) as
      | { category_id: string; word: string; display: string }[]
      | { rows: { category_id: string; word: string; display: string }[] }
    const rows = Array.isArray(parsed) ? parsed : parsed.rows
    const words: AmendedWords = {}
    let kept = 0
    for (const row of rows) {
      // A spelling the dictionaries would never hold is left out, as for the
      // community words: kept, it would make the shipped-words test fail.
      if (!acceptable(row.display)) continue
      // cloud.ts prefixes every language but French, which keeps its bare names.
      const match = /^([a-z]{2}):(.*)$/.exec(row.category_id)
      const [lang, categoryId] = match ? [match[1]!, match[2]!] : ['fr', row.category_id]
      ;((words[lang] ??= {})[categoryId] ??= []).push({ from: row.word.trim(), to: row.display.trim() })
      kept++
    }
    writeFileSync(SNAPSHOT, `${JSON.stringify(words, null, 2)}\n`)
    console.log(`→ mots corrigés : ${kept}/${rows.length}`)
    return words
  } catch (error) {
    console.warn(`! mots corrigés : ${(error as Error).message.split('\n')[0]}, relus depuis ${SNAPSHOT}`)
    return readSnapshot()
  }
}

/**
 * Renames dictionary entries in place. A row keeps what it knows — sitelinks,
 * frequency, visits — and only takes the new spelling and key; the forms of
 * the old spelling go with it when its key changes, and a row some other word
 * already holds under the new key gives way to it. A correction whose word is not in the dictionary (banned
 * since, or never shipped) is returned in `missing`.
 */
export function applyAmendments(rows: Map<string, WordRow>, amendments: readonly Amendment[]): { applied: number; missing: string[] } {
  let applied = 0
  const missing: string[] = []
  for (const { from, to } of amendments) {
    const fromKey = normalizeWord(from)
    const toKey = normalizeWord(to)
    const row = rows.get(fromKey)
    if (!row || toKey === '' || !acceptable(to)) {
      missing.push(from)
      continue
    }
    // A row keeps its lemma (an inflected form stays a form of the same word).
    // The forms that bent to the old spelling are spelled like it: they go with
    // it when the key changes, and stay when only the display did (a capital,
    // an accent the key already folds).
    rows.delete(fromKey)
    rows.set(toKey, [to, ...row.slice(1)] as unknown as WordRow)
    const follow = (oldKey: string) => {
      for (const [key, form] of rows) {
        if (form[3] === oldKey) rows.set(key, [...form.slice(0, 3), toKey, ...form.slice(4)] as unknown as WordRow)
      }
    }
    if (toKey !== fromKey) {
      for (const [key, form] of [...rows]) if (form[3] === fromKey) rows.delete(key)
    }
    // The domain keeps the first of two spellings it compacts alike: the
    // corrected one must not be the one left out, and the forms of the row that
    // gives way follow the one kept.
    const compact = compactWord(to)
    for (const [key, other] of [...rows]) {
      if (key !== toKey && !other[3] && compactWord(other[0]) === compact) {
        rows.delete(key)
        follow(key)
      }
    }
    applied++
  }
  return { applied, missing }
}
