import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THIN_PROMPT_WORDS } from '../domain/run'
import { compactWord, initialOf, normalizeWord } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordRow } from '../domain/words'

/**
 * The dictionaries prepared but not shipped (see `DRAFT_SOURCES` in
 * scripts/sources.ts). Nothing loads them and no catalogue entry names them,
 * so nothing else would catch a draft the day it is activated: a row the
 * domain cannot read, an answer the category is about and does not hold, or a
 * category too thin for the draw to deal. Read as the game reads them.
 */
const DIR = join(import.meta.dirname, 'drafts')

const packs = new Map<string, WordRow[]>()
for (const lang of readdirSync(DIR)) {
  for (const file of readdirSync(join(DIR, lang))) {
    if (file.endsWith('.json')) packs.set(`${lang}/${file.replace('.json', '')}`, JSON.parse(readFileSync(join(DIR, lang, file), 'utf8')) as WordRow[])
  }
}

/** The first answers a table would shout — the drafts are French only. */
const OBVIOUS: Record<string, readonly string[]> = {
  ingredients: [
    'sel', 'poivre', 'farine', 'sucre', 'beurre', 'huile', 'huile d’olive', 'lait', 'œuf', 'miel', 'vinaigre',
    'moutarde', 'mayonnaise', 'chocolat', 'chocolat noir', 'cacao', 'vanille', 'cannelle', 'curry', 'cumin',
    'persil', 'basilic', 'thym', 'romarin', 'ail', 'oignon', 'tomate', 'carotte', 'pomme de terre', 'champignon',
    'riz', 'pâtes', 'lentilles', 'fromage', 'crème', 'yaourt', 'poulet', 'bœuf', 'porc', 'agneau', 'veau', 'dinde',
    'jambon', 'saucisse', 'thon', 'saumon', 'cabillaud', 'crevette', 'moule', 'huître', 'noix', 'amande', 'eau',
  ],
  adjectifs: [
    'gentil', 'méchant', 'drôle', 'aimable', 'sympathique', 'antipathique', 'calme', 'nerveux', 'timide',
    'courageux', 'peureux', 'lâche', 'honnête', 'menteur', 'généreux', 'avare', 'égoïste', 'poli', 'grossier',
    'patient', 'impatient', 'têtu', 'sérieux', 'joyeux', 'triste', 'heureux', 'malheureux', 'optimiste',
    'pessimiste', 'curieux', 'intelligent', 'idiot', 'malin', 'naïf', 'paresseux', 'sportif', 'sage', 'fou',
    'bavard', 'discret', 'doux', 'violent', 'cruel', 'sensible', 'arrogant', 'fier', 'beau', 'laid', 'grand',
    'petit', 'gros', 'fort', 'faible', 'rapide', 'lent', 'jeune', 'vieux',
  ],
  lieux: [
    'usine', 'boulangerie', 'mairie', 'piscine', 'parc', 'place', 'jardin public', 'école', 'hôpital', 'gare',
    'aéroport', 'supermarché', 'marché', 'banque', 'poste', 'restaurant', 'café', 'hôtel',
    'musée', 'bibliothèque', 'stade', 'gymnase', 'église', 'cathédrale', 'mosquée', 'synagogue', 'château', 'pont',
    'immeuble', 'maison', 'appartement', 'ferme', 'moulin', 'entrepôt', 'atelier', 'garage', 'parking',
    'pharmacie', 'librairie', 'boucherie', 'poissonnerie', 'fromagerie', 'cinéma', 'théâtre', 'prison', 'tribunal',
    'casino', 'cimetière', 'fontaine',
  ],
}

/** A slip anyone makes at speed: no accents, no capital, no hyphen. */
const hurried = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-’']/g, ' ')

describe('draft dictionaries', () => {
  it('has drafts to check', () => {
    expect(packs.size).toBeGreaterThan(0)
  })

  for (const [name, rows] of packs) {
    describe(name, () => {
      it('holds well-formed rows, one per word, sorted as the import writes them', () => {
        const keys = rows.map(([display]) => normalizeWord(display))
        expect(new Set(keys).size).toBe(keys.length)
        expect([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(keys)

        const bad: string[] = []
        for (const row of rows) {
          const [display, sitelinks, frequency, canonical, views] = row
          const wrong = (why: string) => bad.push(`${display}: ${why}`)
          if (row.length < 3 || row.length > 5) wrong('width')
          if (display !== display.trim() || /\s{2}/.test(display)) wrong('spacing')
          if (!/^\p{L}[\p{L}'’ -]*$/u.test(display)) wrong('characters')
          if (initialOf(display) === '' || compactWord(display).length < 2) wrong('too short')
          if (!Number.isInteger(sitelinks) || sitelinks < 0) wrong('sitelinks')
          if (!Number.isFinite(frequency) || frequency < 0) wrong('frequency')
          if (views !== undefined && (!Number.isInteger(views) || views < 0)) wrong('views')
          if (views !== undefined && canonical !== '') wrong('form with views')
        }
        expect(bad).toEqual([])
      })

      it('finds every word under its own key', () => {
        const pack = buildWordPack(name, rows)
        const clashes: string[] = []
        for (const [display, , , canonical] of rows) {
          const key = canonical || normalizeWord(display)
          const found = findWord(pack, display, 0)?.entry
          if (found?.key !== key && found?.key !== normalizeWord(display)) clashes.push(`${display} → ${found?.display}`)
        }
        expect(clashes).toEqual([])
      })

      it('has known words on enough letters to be drawn', () => {
        const known = knownByLetter(buildWordPack(name, rows))
        expect(known.size, name).toBeGreaterThanOrEqual(12)
        expect(Math.max(...known.values()), name).toBeGreaterThanOrEqual(THIN_PROMPT_WORDS)
      })
    })
  }

  for (const [id, words] of Object.entries(OBVIOUS)) {
    const rows = [...packs].filter(([name]) => name.endsWith(`/${id}`))
    it(`${id} exists`, () => {
      expect(rows.length).toBe(1)
    })

    for (const [name, pack] of rows) {
      it(`${name} knows ${words.length} obvious answers`, () => {
        const built = buildWordPack(name, pack)
        const missing = words.filter((word) => findWord(built, word, 0) === null)
        expect(missing).toEqual([])
        const lost = words.filter((word) => findWord(built, hurried(word), 0) === null)
        expect(lost).toEqual([])
      })
    }
  }
})
