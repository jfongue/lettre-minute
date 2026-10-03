import { normalizeWord } from '../src/domain/text.ts'

/** Une ligne de dictionnaire livrée : [affichage, sitelinks, fréquence, canonique ?, visites ?]. */
export type Row = readonly [string, number, number, string?, number?]

/** Une décision réglée d'un modérateur, telle que `word_reviews` la range. */
export interface Decided {
  category_id: string
  word: string
  kind: string
  decided_at?: string | null
  created_at?: string
}

/** La clé sous laquelle le domaine lit une ligne (`WordEntry.key`). */
export const keyOf = (row: Row): string => row[3] ?? normalizeWord(row[0])

/**
 * Ce qu'un mot peut porter : ajouté au dictionnaire, ou signalé pour en sortir.
 * Une seule décision compte par mot et par catégorie, la dernière réglée —
 * un ajout accepté après un ban fait revenir le mot.
 */
export function bannedByLang(rows: readonly Decided[]): Map<string, Map<string, string[]>> {
  const at = (row: Decided) => Date.parse(row.decided_at ?? row.created_at ?? '') || 0
  // La dernière décision de chaque mot tranche : un ajout accepté après un ban
  // fait revenir le mot, un ban après un ajout le ressort.
  const settled = new Map<string, Decided>()
  for (const row of [...rows].sort((one, other) => at(one) - at(other))) {
    settled.set(`${row.category_id} ${row.word}`, row)
  }

  const byLang = new Map<string, Map<string, string[]>>()
  for (const [key, row] of settled) {
    if (row.kind !== 'ban') continue
    const space = key.indexOf(' ')
    const category = key.slice(0, space)
    const word = key.slice(space + 1)
    // cloud.ts préfixe les mots et les catégories de leur langue (de:animaux).
    const cut = category.indexOf(':')
    const lang = cut === -1 ? 'fr' : category.slice(0, cut)
    const id = cut === -1 ? category : category.slice(cut + 1)
    const words = byLang.get(lang) ?? new Map<string, string[]>()
    words.set(id, [...(words.get(id) ?? []), word].sort())
    byLang.set(lang, words)
  }
  return byLang
}

/**
 * Le dictionnaire sans les mots bannis, et les formes qui les fléchissent :
 * une ligne tombe quand sa clé est bannie, et quand son orthographe repliée
 * l'est — c'est sous elle que l'import range une forme.
 */
export function withoutBanned(rows: readonly Row[], banned: ReadonlySet<string>): Row[] {
  return rows.filter((row) => !banned.has(keyOf(row)) && !banned.has(normalizeWord(row[0])))
}

/** Assez de lignes pour qu'une proportion veuille dire quelque chose. */
const DAMPING_FLOOR = 6

/**
 * Les couples lettre + catégorie qu'un ban a vidés à moitié : leur cote est
 * multipliée par ce facteur. Le poids habituel ne tombe que comme le logarithme
 * du nombre de mots (`run.ts`), ce qui ne suffit pas quand une catégorie perd la
 * moitié de ce qu'on pouvait écrire — d'où ce frein, écrit à l'import.
 *
 * La lettre est celle de l'orthographe, comme le tirage la range.
 */
export function dampingFor(rows: readonly Row[], banned: ReadonlySet<string>): Record<string, number> {
  const before = new Map<string, number>()
  const after = new Map<string, number>()
  for (const row of rows) {
    const letter = normalizeWord(row[0]).charAt(0).toUpperCase()
    if (letter === '') continue
    before.set(letter, (before.get(letter) ?? 0) + 1)
    if (withoutBanned([row], banned).length > 0) after.set(letter, (after.get(letter) ?? 0) + 1)
  }

  const damped: Record<string, number> = {}
  for (const [letter, total] of before) {
    if (total < DAMPING_FLOOR || total === (after.get(letter) ?? 0)) continue
    const share = (after.get(letter) ?? 0) / total
    if (share <= 0.25) damped[letter] = 0.05
    else if (share <= 0.5) damped[letter] = 0.2
  }
  return damped
}
