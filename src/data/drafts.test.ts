import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SOON } from '../domain/catalogue'
import { THIN_PROMPT_WORDS } from '../domain/run'
import { compactWord, initialOf, normalizeWord } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordRow } from '../domain/words'

/**
 * The categories prepared but not shipped (`DRAFT_SOURCES`, `SOON`): their
 * dictionaries wait under src/data/drafts, which the game never loads. Before
 * one moves to src/data/words, it must hold the answers a table would shout
 * in each of the seven languages, and enough known letters to be drawn.
 */
const DIR = join(import.meta.dirname, 'drafts')
const WORDS = join(import.meta.dirname, 'words')
const LANGS = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pt']
const DRAFTS = SOON.map((category) => category.id)

const rowsOf = new Map<string, readonly WordRow[]>()
const packOf = new Map<string, ReturnType<typeof buildWordPack>>()
for (const lang of existsSync(DIR) ? readdirSync(DIR) : []) {
  for (const file of readdirSync(join(DIR, lang))) {
    if (!file.endsWith('.json')) continue
    const name = `${lang}/${file.replace('.json', '')}`
    const rows = JSON.parse(readFileSync(join(DIR, lang, file), 'utf8')) as WordRow[]
    rowsOf.set(name, rows)
    packOf.set(name, buildWordPack(name, rows))
  }
}

/**
 * Drafts no letter of which holds THIN_PROMPT_WORDS known words yet: Dutch
 * corpora rate « koptelefoon » or « bakfiets » too rare to count as known.
 * Not ready to ship as they stand — a run would deal the same few pairs —,
 * and held below the bar here so that the day an import lifts one, this list
 * has to shrink with it.
 */
const THIN_YET = ['nl/electronique', 'nl/meubles']

/** The first answers a table would shout, per language. */
const OBVIOUS: Record<string, Record<string, readonly string[]>> = {
  fr: {
    meubles: [
      'lit', 'armoire', 'canapé', 'table', 'chaise', 'fauteuil', 'commode', 'buffet', 'bureau', 'étagère', 'tabouret',
      'banc', 'réfrigérateur', 'frigo', 'congélateur', 'lave-linge', 'lave-vaisselle', 'four', 'micro-ondes', 'télévision',
      'aspirateur', 'piano', 'baignoire', 'matelas', 'échelle', 'brouette', 'valise', 'horloge',
    ],
    electronique: [
      'ordinateur', 'caisse enregistreuse', 'ordinateur portable', 'casque', 'téléphone', 'smartphone', 'télévision',
      'imprimante', 'tablette', 'console', 'écouteurs', 'enceinte', 'appareil photo', 'clavier', 'souris', 'écran',
      'radio', 'télécommande', 'calculatrice', 'scanner', 'micro', 'webcam', 'routeur', 'clé USB', 'chargeur',
    ],
  },
  en: {
    meubles: [
      'bed', 'wardrobe', 'sofa', 'couch', 'table', 'chair', 'armchair', 'desk', 'shelf', 'stool', 'bench', 'fridge',
      'refrigerator', 'freezer', 'washing machine', 'dishwasher', 'oven', 'microwave', 'television', 'vacuum cleaner',
      'piano', 'bathtub', 'mattress', 'ladder', 'wheelbarrow', 'suitcase', 'clock',
    ],
    electronique: [
      'computer', 'cash register', 'laptop', 'headphones', 'phone', 'smartphone', 'television', 'TV', 'printer', 'tablet',
      'console', 'earphones', 'speaker', 'camera', 'keyboard', 'mouse', 'monitor', 'screen', 'radio', 'remote',
      'calculator', 'scanner', 'microphone', 'webcam', 'router', 'charger',
    ],
  },
  de: {
    meubles: [
      'Bett', 'Schrank', 'Sofa', 'Tisch', 'Stuhl', 'Sessel', 'Kommode', 'Schreibtisch', 'Regal', 'Hocker', 'Bank',
      'Kühlschrank', 'Gefrierschrank', 'Waschmaschine', 'Spülmaschine', 'Backofen', 'Mikrowelle', 'Fernseher',
      'Staubsauger', 'Klavier', 'Badewanne', 'Matratze', 'Leiter', 'Schubkarre', 'Koffer',
    ],
    electronique: [
      'Computer', 'Registrierkasse', 'Laptop', 'Kopfhörer', 'Telefon', 'Handy', 'Smartphone', 'Fernseher', 'Drucker',
      'Tablet', 'Spielkonsole', 'Lautsprecher', 'Kamera', 'Tastatur', 'Maus', 'Bildschirm', 'Radio', 'Fernbedienung',
      'Taschenrechner', 'Scanner', 'Mikrofon', 'Webcam', 'Router', 'Ladegerät',
    ],
  },
  es: {
    meubles: [
      'cama', 'armario', 'sofá', 'mesa', 'silla', 'sillón', 'cómoda', 'escritorio', 'estantería', 'taburete', 'banco',
      'nevera', 'frigorífico', 'congelador', 'lavadora', 'lavavajillas', 'horno', 'microondas', 'televisor',
      'aspiradora', 'piano', 'bañera', 'colchón', 'escalera', 'carretilla', 'maleta',
    ],
    electronique: [
      'ordenador', 'computadora', 'caja registradora', 'portátil', 'auriculares', 'teléfono', 'móvil', 'smartphone',
      'televisor', 'televisión', 'impresora', 'tableta', 'consola', 'altavoz', 'cámara', 'teclado', 'ratón', 'pantalla',
      'radio', 'mando', 'calculadora', 'escáner', 'micrófono', 'webcam', 'router', 'cargador',
    ],
  },
  it: {
    meubles: [
      'letto', 'armadio', 'divano', 'tavolo', 'sedia', 'poltrona', 'comò', 'scrivania', 'scaffale', 'sgabello', 'panca',
      'frigorifero', 'frigo', 'congelatore', 'lavatrice', 'lavastoviglie', 'forno', 'microonde', 'televisore',
      'aspirapolvere', 'pianoforte', 'vasca da bagno', 'materasso', 'scala', 'carriola', 'valigia',
    ],
    electronique: [
      'computer', 'registratore di cassa', 'portatile', 'cuffie', 'telefono', 'cellulare', 'smartphone', 'televisore',
      'televisione', 'stampante', 'tablet', 'console', 'altoparlante', 'fotocamera', 'tastiera', 'mouse', 'schermo',
      'radio', 'telecomando', 'calcolatrice', 'scanner', 'microfono', 'webcam', 'router', 'caricabatterie',
    ],
  },
  nl: {
    meubles: [
      'bed', 'kast', 'bank', 'tafel', 'stoel', 'fauteuil', 'commode', 'bureau', 'boekenkast', 'kruk', 'koelkast', 'vriezer',
      'wasmachine', 'vaatwasser', 'oven', 'magnetron', 'televisie', 'stofzuiger', 'piano', 'bad', 'matras', 'ladder',
      'kruiwagen', 'koffer', 'klok',
    ],
    electronique: [
      'computer', 'kassa', 'laptop', 'koptelefoon', 'telefoon', 'mobiel', 'smartphone', 'televisie', 'tv', 'printer',
      'tablet', 'spelcomputer', 'luidspreker', 'camera', 'toetsenbord', 'muis', 'beeldscherm', 'radio',
      'afstandsbediening', 'rekenmachine', 'scanner', 'microfoon', 'webcam', 'router', 'oplader',
    ],
  },
  pt: {
    meubles: [
      'cama', 'armário', 'sofá', 'mesa', 'cadeira', 'poltrona', 'cômoda', 'escrivaninha', 'estante', 'banco', 'geladeira',
      'congelador', 'máquina de lavar', 'lava-louças', 'forno', 'micro-ondas', 'televisão', 'aspirador', 'piano',
      'banheira', 'colchão', 'escada', 'carrinho de mão', 'mala',
    ],
    electronique: [
      'computador', 'caixa registradora', 'notebook', 'fone de ouvido', 'telefone', 'celular', 'smartphone', 'televisão',
      'impressora', 'tablet', 'console', 'alto-falante', 'câmera', 'teclado', 'mouse', 'tela', 'monitor', 'rádio',
      'controle remoto', 'calculadora', 'scanner', 'microfone', 'webcam', 'roteador', 'carregador',
    ],
  },
}

/** A slip anyone makes at speed: no accents, no capital, no hyphen. */
const hurried = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-’']/g, ' ')

describe('draft dictionaries', () => {
  it('prepares each announced category in every language, and nothing else', () => {
    for (const lang of LANGS) {
      const ids = readdirSync(join(DIR, lang))
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.replace('.json', ''))
      expect(ids.sort(), lang).toEqual([...DRAFTS].sort())
    }
  })

  it('keeps « Petit objet » and « Meubles et gros objets » apart, each word in one of the two', () => {
    for (const lang of LANGS) {
      const small = new Set(
        (JSON.parse(readFileSync(join(WORDS, lang, 'objets.json'), 'utf8')) as WordRow[]).map(([display]) => normalizeWord(display)),
      )
      const shared = rowsOf
        .get(`${lang}/meubles`)!
        .filter(([display, , , canonical]) => !canonical && small.has(normalizeWord(display)))
        .map(([display]) => display)
      expect(shared, lang).toEqual([])
    }
  })

  for (const [name, rows] of rowsOf) {
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
        const pack = packOf.get(name)!
        const clashes: string[] = []
        for (const [display, , , canonical] of rows) {
          const key = canonical || normalizeWord(display)
          const found = findWord(pack, display, 0)?.entry
          if (found?.key !== key && found?.key !== normalizeWord(display)) clashes.push(`${display} → ${found?.display}`)
        }
        expect(clashes).toEqual([])
      })

      it('has known words on enough letters to be drawn', () => {
        const known = knownByLetter(packOf.get(name)!)
        expect(known.size, name).toBeGreaterThanOrEqual(12)
        const best = Math.max(...known.values())
        if (THIN_YET.includes(name)) expect(best, name).toBeLessThan(THIN_PROMPT_WORDS)
        else expect(best, name).toBeGreaterThanOrEqual(THIN_PROMPT_WORDS)
      })
    })
  }

  for (const [lang, categories] of Object.entries(OBVIOUS)) {
    for (const [id, words] of Object.entries(categories)) {
      it(`${lang}/${id} knows ${words.length} obvious answers`, () => {
        const pack = packOf.get(`${lang}/${id}`)!
        const missing = words.filter((word) => findWord(pack, word, 0) === null)
        expect(missing).toEqual([])
        const lost = words.filter((word) => findWord(pack, hurried(word), 0) === null)
        expect(lost).toEqual([])
      })
    }
  }
})
