import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUE } from '../domain/catalogue'
import { THIN_PROMPT_WORDS } from '../domain/run'
import { compactWord, initialOf, normalizeWord } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordPack, type WordRow } from '../domain/words'

/**
 * The shipped dictionaries, read as the game reads them. The import is
 * rerun by hand against sources that drift, so what it writes is checked
 * here: the shape the domain relies on, the junk it once let through, and
 * the answers any player would give first.
 */
const WORDS_DIR = join(import.meta.dirname, 'words')
const LANGS = readdirSync(WORDS_DIR).sort()

const rowsOf = new Map<string, readonly WordRow[]>()
const packOf = new Map<string, WordPack>()
for (const lang of LANGS) {
  for (const file of readdirSync(join(WORDS_DIR, lang))) {
    if (!file.endsWith('.json')) continue
    const id = file.replace('.json', '')
    const rows = JSON.parse(readFileSync(join(WORDS_DIR, lang, file), 'utf8')) as WordRow[]
    rowsOf.set(`${lang}/${id}`, rows)
    packOf.set(`${lang}/${id}`, buildWordPack(id, rows))
  }
}

const pack = (lang: string, id: string) => packOf.get(`${lang}/${id}`)!

/** The categories whose words are names: they do not bend, and a form there is a homograph's. */
const NAMES = ['pays', 'capitales', 'marques', 'prenoms']

describe('shipped dictionaries', () => {
  it('ship every catalogue category in every language', () => {
    for (const lang of LANGS) {
      const ids = readdirSync(join(WORDS_DIR, lang)).map((file) => file.replace('.json', '')).sort()
      expect(ids, lang).toEqual(CATALOGUE.map((category) => category.id).sort())
    }
  })

  for (const [name, rows] of rowsOf) {
    describe(name, () => {
      it('holds well-formed rows, one per word, sorted as the import writes them', () => {
        const keys = rows.map(([display]) => normalizeWord(display))
        expect(new Set(keys).size).toBe(keys.length)
        expect([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(keys)

        // Collected rather than asserted row by row: 80 000 English animals.
        const bad: string[] = []
        for (const row of rows) {
          const [display, sitelinks, frequency, canonical, views] = row
          const wrong = (why: string) => bad.push(`${display}: ${why}`)
          if (row.length < 3 || row.length > 5) wrong('width')
          if (display !== display.trim() || /\s{2}/.test(display)) wrong('spacing')
          // What a player can type in a hurry: letters, and what joins them.
          if (!/^\p{L}[\p{L}'’ -]*$/u.test(display)) wrong('characters')
          // A letter the matching cannot spell in ASCII would vanish from the answer.
          if ([...display].some((char) => /\p{L}/u.test(char) && normalizeWord(char) === '')) wrong('unspellable letter')
          if (initialOf(display) === '' || compactWord(display).length < 2) wrong('too short')
          if (!Number.isInteger(sitelinks) || sitelinks < 0) wrong('sitelinks')
          if (!Number.isFinite(frequency) || frequency < 0) wrong('frequency')
          if (views !== undefined && (!Number.isInteger(views) || views < 0)) wrong('views')
          // A form borrows its lemma's views.
          if (views !== undefined && canonical !== '') wrong('form with views')
        }
        expect(bad).toEqual([])
      })

      it('points every inflected form at a word of the same file', () => {
        const keys = new Set(rows.map(([display]) => normalizeWord(display)))
        const forms = new Set(rows.filter(([, , , canonical]) => canonical).map(([display]) => normalizeWord(display)))
        for (const [display, , , canonical] of rows) {
          if (!canonical) continue
          expect(canonical, display).toBe(canonical.trim())
          expect(canonical, display).not.toBe(normalizeWord(display))
          expect(keys.has(canonical), `${display} → ${canonical}`).toBe(true)
          // One hop: a lemma that is itself a form would score under a key no answer carries.
          expect(forms.has(canonical), `${display} → ${canonical}`).toBe(false)
        }
      })

      it('finds every word under its own key', () => {
        // Two spellings that compact alike — « Formule E », « formulée » — keep
        // only the first: the second would score as a word it is not.
        const clashes: string[] = []
        for (const [display, , , canonical] of rows) {
          const key = canonical || normalizeWord(display)
          const found = findWord(packOf.get(name)!, display, 0)?.entry
          if (found?.key !== key && found?.key !== normalizeWord(display)) clashes.push(`${display} → ${found?.display}`)
        }
        expect(clashes).toEqual([])
      })

      it('has known words on enough letters to be drawn', () => {
        // One known word is enough for a letter to come out; a category drawn
        // on a handful of letters would deal the same prompts run after run.
        const known = knownByLetter(packOf.get(name)!)
        expect(known.size, name).toBeGreaterThanOrEqual(12)
        expect(Math.max(...known.values()), name).toBeGreaterThanOrEqual(THIN_PROMPT_WORDS)
      })
    })
  }

  it('bend no name: a form in a category of names is an alias, never a plural', () => {
    // « USA » for the United States is an alias; « Berlins », « Adobes » are
    // plurals of a homograph's, which is all a name's inflections ever were.
    for (const lang of LANGS) {
      for (const id of NAMES) {
        const plurals = rowsOf
          .get(`${lang}/${id}`)!
          .filter(([display, , , canonical]) => {
            if (!canonical) return false
            const form = compactWord(display)
            const base = canonical.replace(/ /g, '')
            return form.startsWith(base) && ['s', 'es', 'n', 'en', 'x'].includes(form.slice(base.length))
          })
        expect(plurals.map(([display]) => display), `${lang}/${id}`).toEqual([])
      }
    }
  })

  it('score no country on a code: two letters are an ISO code, three capitals an IOC one', () => {
    // Save the two codes that are the name everyone says (SHORT_NAMES).
    const names = new Set(['usa', 'uk'])
    for (const lang of LANGS) {
      const codes = rowsOf
        .get(`${lang}/pays`)!
        .map(([display]) => display)
        .filter((display) => !names.has(compactWord(display)))
        .filter((display) => compactWord(display).length <= 2 || /^[A-Z]{3}$/.test(display))
      expect(codes, lang).toEqual([])
    }
  })
})

/**
 * The first answers a table would shout, per language and category. Each must
 * be found exactly — and, typed in a hurry, still found.
 */
const OBVIOUS: Record<string, Record<string, readonly string[]>> = {
  fr: {
    pays: ['France', 'Allemagne', 'Japon', 'Brésil', 'Canada', 'États-Unis', 'Côte d’Ivoire', 'Maroc', 'Zimbabwe', 'Angleterre', 'Écosse'],
    animaux: ['chat', 'chien', 'cheval', 'éléphant', 'abeille', 'requin', 'vache', 'lion', 'zèbre'],
    couleurs: ['rouge', 'bleu', 'vert', 'jaune', 'noir', 'blanc', 'orange', 'violet'],
    'fruits-legumes': ['pomme', 'banane', 'carotte', 'tomate', 'fraise', 'poireau', 'kiwi', 'champignon', 'basilic', 'persil', 'thym'],
    metiers: ['boulanger', 'médecin', 'avocat', 'plombier', 'infirmière', 'professeur', 'pompier', 'laboureur'],
    sports: ['football', 'tennis', 'judo', 'natation', 'rugby', 'ski', 'boxe', 'escrime'],
    'corps-humain': ['bras', 'jambe', 'cœur', 'œil', 'nez', 'genou', 'foie', 'orteil', 'ventre', 'narine'],
    matieres: ['fer', 'bois', 'or', 'oxygène', 'cuivre', 'verre', 'béton', 'coton', 'plastique', 'sel'],
    capitales: ['Paris', 'Londres', 'Tokyo', 'Berlin', 'Rome', 'Madrid', 'Ottawa', 'Nairobi', 'Lyon', 'Marseille', 'Munich', 'Anvers', 'Genève', 'Esch-sur-Alzette', 'Francfort'],
    marques: ['Nike', 'Apple', 'Renault', 'Peugeot', 'Coca-Cola', 'Google', 'Adidas', 'Samsung', 'Mercedes', 'Instagram', 'Ford', 'Amazon'],
    prenoms: ['Léa', 'Marie', 'Pierre', 'Jean', 'Emma', 'Lucas', 'Mohammed', 'Fatima', 'Karim', 'Yasmine'],
    plantes: ['rose', 'chêne', 'tulipe', 'ortie', 'fougère', 'sapin', 'lavande'],
    objets: ['chaise', 'fourchette', 'clé', 'téléphone', 'parapluie', 'lampe'],
  },
  en: {
    pays: ['France', 'Germany', 'Japan', 'Brazil', 'Canada', 'United States', 'Mexico', 'USA', 'UK', 'England'],
    animaux: ['cat', 'dog', 'horse', 'elephant', 'bee', 'shark', 'cow', 'lion', 'zebra'],
    couleurs: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'purple'],
    'fruits-legumes': ['apple', 'banana', 'carrot', 'tomato', 'strawberry', 'potato', 'mushroom', 'basil', 'parsley', 'thyme'],
    metiers: ['baker', 'doctor', 'lawyer', 'plumber', 'nurse', 'teacher', 'firefighter'],
    sports: ['football', 'tennis', 'judo', 'swimming', 'rugby', 'golf', 'boxing'],
    'corps-humain': ['arm', 'leg', 'heart', 'eye', 'nose', 'knee', 'liver', 'belly', 'nostril'],
    matieres: ['iron', 'wood', 'gold', 'oxygen', 'copper', 'glass', 'cotton', 'salt', 'oil'],
    capitales: ['Paris', 'London', 'Tokyo', 'Berlin', 'Rome', 'Madrid', 'Ottawa', 'Lyon', 'Munich', 'Chicago', 'Manchester', 'Oslo', 'Kiev', 'Frankfurt', 'Tel Aviv'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Toyota', 'Samsung', 'Ford', 'Mercedes', 'Amazon', 'Facebook', 'Instagram'],
    prenoms: ['Emma', 'John', 'Mary', 'James', 'Sarah', 'Mohammed', 'Fatima', 'Kevin'],
    plantes: ['rose', 'oak', 'tulip', 'nettle', 'fern', 'fir', 'lavender'],
    objets: ['chair', 'fork', 'key', 'phone', 'umbrella', 'lamp'],
  },
  de: {
    pays: ['Frankreich', 'Deutschland', 'Japan', 'Brasilien', 'Kanada', 'Österreich', 'USA'],
    animaux: ['Katze', 'Hund', 'Pferd', 'Elefant', 'Biene', 'Hai', 'Kuh', 'Löwe'],
    couleurs: ['Rot', 'Blau', 'Grün', 'Gelb', 'Schwarz', 'Weiß'],
    'fruits-legumes': ['Apfel', 'Banane', 'Karotte', 'Tomate', 'Erdbeere', 'Kartoffel', 'Pilz', 'Petersilie', 'Basilikum'],
    metiers: ['Bäcker', 'Arzt', 'Anwalt', 'Klempner', 'Lehrer', 'Feuerwehrmann'],
    sports: ['Fußball', 'Tennis', 'Judo', 'Schwimmen', 'Rugby', 'Golf'],
    'corps-humain': ['Arm', 'Bein', 'Herz', 'Auge', 'Nase', 'Knie', 'Bauch'],
    matieres: ['Eisen', 'Holz', 'Gold', 'Sauerstoff', 'Kupfer', 'Glas', 'Öl', 'Salz'],
    capitales: ['Paris', 'London', 'Tokio', 'Berlin', 'Rom', 'Madrid', 'Oslo', 'Frankfurt', 'Tel Aviv'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Volkswagen', 'Mercedes', 'Amazon', 'Samsung'],
    prenoms: ['Hans', 'Emma', 'Maria', 'Kevin', 'Mohammed'],
    plantes: ['Rose', 'Eiche', 'Tulpe', 'Brennnessel', 'Farn', 'Tanne', 'Lavendel'],
    objets: ['Stuhl', 'Gabel', 'Schlüssel', 'Telefon', 'Regenschirm', 'Lampe'],
  },
  es: {
    pays: ['Francia', 'Alemania', 'Japón', 'Brasil', 'Canadá', 'México'],
    animaux: ['gato', 'perro', 'caballo', 'elefante', 'abeja', 'tiburón', 'vaca', 'león'],
    couleurs: ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco'],
    'fruits-legumes': ['manzana', 'plátano', 'zanahoria', 'tomate', 'fresa', 'patata', 'champiñón', 'perejil'],
    metiers: ['panadero', 'médico', 'abogado', 'fontanero', 'enfermera', 'profesor', 'bombero'],
    sports: ['fútbol', 'tenis', 'judo', 'natación', 'rugby', 'golf', 'boxeo'],
    'corps-humain': ['brazo', 'pierna', 'corazón', 'ojo', 'nariz', 'rodilla', 'oreja'],
    matieres: ['hierro', 'madera', 'oro', 'oxígeno', 'cobre', 'vidrio', 'seda'],
    capitales: ['París', 'Londres', 'Tokio', 'Berlín', 'Roma', 'Madrid'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Zara'],
    prenoms: ['José', 'María', 'Juan', 'Sofía', 'Mohammed', 'Fatima'],
    plantes: ['rosa', 'roble', 'tulipán', 'ortiga', 'helecho', 'abeto', 'lavanda'],
    objets: ['silla', 'tenedor', 'llave', 'teléfono', 'paraguas', 'lámpara'],
  },
  it: {
    pays: ['Francia', 'Germania', 'Giappone', 'Brasile', 'Canada', 'Messico'],
    animaux: ['gatto', 'cane', 'cavallo', 'elefante', 'ape', 'squalo', 'mucca', 'leone'],
    couleurs: ['rosso', 'blu', 'verde', 'giallo', 'nero', 'bianco'],
    'fruits-legumes': ['mela', 'banana', 'carota', 'pomodoro', 'fragola', 'patata', 'fungo', 'basilico'],
    metiers: ['panettiere', 'medico', 'avvocato', 'idraulico', 'infermiere', 'insegnante', 'pompiere'],
    sports: ['calcio', 'tennis', 'judo', 'nuoto', 'rugby', 'golf', 'pugilato'],
    'corps-humain': ['braccio', 'gamba', 'cuore', 'occhio', 'naso', 'ginocchio'],
    matieres: ['ferro', 'legno', 'oro', 'ossigeno', 'rame', 'vetro'],
    capitales: ['Parigi', 'Londra', 'Tokyo', 'Berlino', 'Roma', 'Madrid'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Fiat', 'Ducati'],
    prenoms: ['Giulia', 'Marco', 'Maria', 'Giuseppe', 'Mohammed'],
    plantes: ['rosa', 'quercia', 'tulipano', 'ortica', 'felce', 'abete', 'lavanda'],
    objets: ['sedia', 'forchetta', 'chiave', 'telefono', 'ombrello', 'lampada'],
  },
  nl: {
    pays: ['Frankrijk', 'Duitsland', 'Japan', 'Brazilië', 'Canada', 'België'],
    animaux: ['kat', 'hond', 'paard', 'olifant', 'bij', 'haai', 'koe', 'leeuw'],
    couleurs: ['rood', 'blauw', 'groen', 'geel', 'zwart', 'wit'],
    'fruits-legumes': ['appel', 'banaan', 'wortel', 'tomaat', 'aardbei', 'aardappel', 'champignon', 'peterselie'],
    metiers: ['bakker', 'arts', 'advocaat', 'loodgieter', 'verpleegster', 'leraar', 'brandweerman'],
    sports: ['voetbal', 'tennis', 'judo', 'zwemmen', 'rugby', 'golf', 'boksen'],
    'corps-humain': ['arm', 'been', 'hart', 'oog', 'neus', 'knie', 'gezicht'],
    matieres: ['ijzer', 'hout', 'goud', 'zuurstof', 'koper', 'glas', 'olie', 'plastic'],
    capitales: ['Parijs', 'Londen', 'Tokio', 'Berlijn', 'Rome', 'Madrid'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Philips'],
    prenoms: ['Emma', 'Jan', 'Sanne', 'Mohammed', 'Fatima'],
    plantes: ['roos', 'eik', 'tulp', 'brandnetel', 'varen', 'spar', 'lavendel'],
    objets: ['stoel', 'vork', 'sleutel', 'telefoon', 'paraplu', 'lamp'],
  },
  pt: {
    pays: ['França', 'Alemanha', 'Japão', 'Brasil', 'Canadá', 'México'],
    animaux: ['gato', 'cão', 'cavalo', 'elefante', 'abelha', 'tubarão', 'vaca', 'leão'],
    couleurs: ['vermelho', 'azul', 'verde', 'amarelo', 'preto', 'branco'],
    'fruits-legumes': ['maçã', 'banana', 'cenoura', 'tomate', 'morango', 'batata', 'cogumelo'],
    metiers: ['padeiro', 'médico', 'advogado', 'encanador', 'enfermeira', 'professor', 'bombeiro'],
    sports: ['futebol', 'tênis', 'judô', 'natação', 'rugby', 'golfe', 'boxe'],
    'corps-humain': ['braço', 'perna', 'coração', 'olho', 'nariz', 'joelho'],
    matieres: ['ferro', 'madeira', 'ouro', 'oxigênio', 'cobre', 'vidro'],
    capitales: ['Paris', 'Londres', 'Tóquio', 'Berlim', 'Roma', 'Madrid'],
    marques: ['Nike', 'Apple', 'Google', 'Adidas', 'Natura', 'Toyota', 'Ford'],
    prenoms: ['Maria', 'José', 'João', 'Ana', 'Mohammed'],
    plantes: ['rosa', 'carvalho', 'tulipa', 'urtiga', 'samambaia', 'abeto', 'lavanda'],
    objets: ['cadeira', 'garfo', 'chave', 'telefone', 'guarda-chuva', 'lâmpada'],
  },
}

/** Answers the import once let through: codes, homographs' forms, a category's bookkeeping. */
const REFUSED: Record<string, Record<string, readonly string[]>> = {
  fr: {
    pays: ['bb', 'ne', 'née', 'bénigne', 'argentins', 'mes', 'suissesse', 'chinée'],
    capitales: ['mâles'],
    marques: ['accolades', 'Adobes'],
    animaux: ['table', 'voiture'],
  },
  en: {
    pays: ['bars', 'bas', 'cans', 'des', 'Canadas', 'chillun', 'fi'],
    capitales: ['Berlins', 'bangkoks'],
    marques: ['acers', 'HPs'],
    animaux: ['malaria', 'saddle', 'Twilight Sparkle'],
  },
  de: { pays: ['Polin', 'bs', 'VN'], capitales: ['Havannas'] },
  es: { pays: ['argentinas', 'aw'], capitales: ['berlines'] },
  it: { pays: ['cube', 'SK'], capitales: ['damaschi'] },
  nl: { pays: ['chilis', 'nl', 'MUS'], capitales: [] },
  pt: { pays: ['angolas', 'pt', 'sãs'], capitales: ['cairos'] },
}

/** A slip anyone makes at speed: no accents, no capital, no hyphen. */
const hurried = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-’']/g, ' ')

/** What the moderators accepted, as the last import read it (scripts/community-words.ts). */
const COMMUNITY = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../scripts/community-words.json'), 'utf8'),
) as Record<string, Record<string, string[]>>

// No suite until a word is accepted: vitest fails an empty one.
for (const [lang, categories] of Object.entries(COMMUNITY)) {
  for (const [id, words] of Object.entries(categories)) {
    it(`${lang}/${id} ships the ${words.length} words its moderators accepted`, () => {
      expect(words.filter((word) => findWord(pack(lang, id), word, 0) === null)).toEqual([])
    })
  }
}

describe('obvious answers', () => {
  for (const [lang, categories] of Object.entries(OBVIOUS)) {
    for (const [id, words] of Object.entries(categories)) {
      it(`${lang}/${id} knows ${words.join(', ')}`, () => {
        const missing = words.filter((word) => findWord(pack(lang, id), word, 0) === null)
        expect(missing).toEqual([])
        const lost = words.filter((word) => findWord(pack(lang, id), hurried(word), 0) === null)
        expect(lost).toEqual([])
      })
    }
  }

  for (const [lang, categories] of Object.entries(REFUSED)) {
    for (const [id, words] of Object.entries(categories)) {
      if (words.length === 0) continue
      it(`${lang}/${id} refuses ${words.join(', ')}`, () => {
        const accepted = words.filter((word) => findWord(pack(lang, id), word, 0) !== null)
        expect(accepted).toEqual([])
      })
    }
  }

  it('scores a form under the word it bends', () => {
    const cases: [string, string, string, string][] = [
      ['fr', 'animaux', 'chevaux', 'cheval'],
      ['fr', 'animaux', 'chats', 'chat'],
      ['fr', 'couleurs', 'vertes', 'vert'],
      ['fr', 'metiers', 'boulangers', 'boulanger'],
      ['en', 'animaux', 'horses', 'horse'],
      ['de', 'animaux', 'Katzen', 'katze'],
      ['es', 'animaux', 'perros', 'perro'],
      ['it', 'animaux', 'gatti', 'gatto'],
      ['nl', 'animaux', 'honden', 'hond'],
      ['pt', 'animaux', 'gatos', 'gato'],
      // An alias scores as the word it names.
      ['en', 'pays', 'USA', 'united states'],
      ['de', 'pays', 'USA', 'vereinigte staaten'],
      ['fr', 'pays', 'Chine populaire', 'chine'],
      ['en', 'marques', 'Mercedes', 'mercedes benz'],
      ['de', 'capitales', 'Frankfurt', 'frankfurt am main'],
    ]
    for (const [lang, id, form, lemma] of cases) {
      expect(findWord(pack(lang, id), form, 0)?.entry.key, `${lang}/${id} ${form}`).toBe(lemma)
    }
  })

  it('draws the letters a table expects on its best-known categories', () => {
    // Not F: France, Fidji and Finlande are all there is, and the « Fédération
    // de Russie » that once stocked it is Russia's alias.
    for (const [lang, id, letters] of [
      ['fr', 'pays', 'ABCIMP'],
      ['fr', 'animaux', 'ABCHLMPR'],
      ['en', 'pays', 'ABCGIMS'],
      ['de', 'pays', 'BDIKS'],
    ] as const) {
      const known = knownByLetter(pack(lang, id))
      const thin = [...letters].filter((letter) => (known.get(letter) ?? 0) < THIN_PROMPT_WORDS / 2)
      expect(thin, `${lang}/${id}`).toEqual([])
    }
  })
})
