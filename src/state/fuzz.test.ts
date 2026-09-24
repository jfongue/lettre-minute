import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createRng, type Rng } from '../domain/rng'
import { POWER_IDS } from '../domain/powers'
import { createRun, inspect, promptKey, remainingSeconds, reroll, skip, submit, THIN_PROMPT_WORDS, type Judge, type Run } from '../domain/run'
import { compactWord, initialOf } from '../domain/text'
import { buildWordPack, findWord, knownByLetter, type WordPack, type WordRow } from '../domain/words'
import { createJudge } from './judge'

/**
 * Random games on the real dictionaries, checked against the invariants the
 * rules promise. Fixed seed by default so `npm test` stays reproducible;
 * `FUZZ_SEED` and `FUZZ_RUNS` let a loop explore new ground and replay a
 * failure from the seed it prints.
 */
const SEED = Number(process.env.FUZZ_SEED ?? 20260924) >>> 0
const RUNS = Number(process.env.FUZZ_RUNS ?? 40)

const WORDS_DIR = join(import.meta.dirname, '../data/words')
const LANGS = readdirSync(WORDS_DIR)

const packsByLang = new Map<string, WordPack[]>(
  LANGS.map((lang) => [
    lang,
    readdirSync(join(WORDS_DIR, lang))
      .filter((file) => file.endsWith('.json'))
      .map((file) => {
        const rows = JSON.parse(readFileSync(join(WORDS_DIR, lang, file), 'utf8')) as WordRow[]
        return buildWordPack(file.replace('.json', ''), rows)
      }),
  ]),
)

const knownOf = new Map([...packsByLang.values()].flat().map((pack) => [pack, knownByLetter(pack)]))

/** Every display of a pack, listed once: spreading 23 000 animals on every move was most of the fuzz's time. */
const displaysOf = new Map<WordPack, readonly string[]>()
function displays(pack: WordPack): readonly string[] {
  let list = displaysOf.get(pack)
  if (!list) displaysOf.set(pack, (list = [...pack.entries.values()].map((entry) => entry.display)))
  return list
}

const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng.next() * items.length)]!

const GARBAGE = ['', ' ', '-', '’', '😀', 'ß', 'Œ', 'ǅ', '\u0301', 'a\u0000b', 'x'.repeat(200), '12', 'İ', 'ﬁ']

/** A slip a player could make: case, accents dropped, spacing, or one letter off. */
function mangle(rng: Rng, word: string): string {
  switch (Math.floor(rng.next() * 7)) {
    case 0:
      return word.toUpperCase()
    case 1:
      return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    case 2:
      return `  ${word.replace(/ /g, '')} `
    case 3: {
      const at = Math.floor(rng.next() * word.length)
      return word.slice(0, at) + word.slice(at + 1)
    }
    case 4: {
      const at = Math.floor(rng.next() * (word.length + 1))
      return word.slice(0, at) + 'e' + word.slice(at)
    }
    case 5:
      return word + pick(rng, GARBAGE)
    default:
      return pick(rng, GARBAGE) + word
  }
}

function answerFor(rng: Rng, run: Run, pack: WordPack, other: WordPack): string {
  const roll = rng.next()
  const words = pack.byLetter.get(run.prompt.letter) ?? []
  if (roll < 0.5 && words.length > 0) return pack.entries.get(pick(rng, words))!.display
  if (roll < 0.7 && words.length > 0) return mangle(rng, pack.entries.get(pick(rng, words))!.display)
  if (roll < 0.8 && run.found.length > 0) return pick(rng, run.found).display
  if (roll < 0.85) return pick(rng, ['Joker', 'chut', 'JOKER ', 'chuut'])
  if (roll < 0.9) return pick(rng, displays(other))
  return pick(rng, GARBAGE)
}

/** One judge per language: building one reads every word of every pack, twenty milliseconds a game. */
const judges = new Map<string, Judge>()
function judgeFor(lang: string): Judge {
  let judge = judges.get(lang)
  if (!judge) judges.set(lang, (judge = createJudge(packsByLang.get(lang)!, { own: {}, crowd: {} }, { joker: ['joker'], hush: ['chut'] })))
  return judge
}

function playOne(seed: number, lang: string): void {
  const rng = createRng(seed)
  const packs = packsByLang.get(lang)!
  const judge = judgeFor(lang)
  const powers = POWER_IDS.filter(() => rng.next() < 0.25).slice(0, 2)
  const categoryIds = packs.map((pack) => pack.categoryId).filter(() => rng.next() < 0.6)
  if (categoryIds.length === 0) categoryIds.push(packs[0]!.categoryId)
  const byId = new Map(packs.map((pack) => [pack.categoryId, pack]))

  let run = createRun({ seed, categoryIds, powers }, judge)
  const seen = new Set<string>()
  let shown: Run['prompt'] | null = null
  const context = () => `lang=${lang} seed=${seed} powers=${powers.join()} prompt=${run.prompt.categoryId}:${run.prompt.letter}`

  for (let step = 0; step < 30; step++) {
    const { categoryId, letter } = run.prompt
    expect(categoryIds, context()).toContain(categoryId)
    expect(judge.letters(categoryId), `${context()} — letter not honourable`).toContain(letter)
    const known = knownOf.get(byId.get(categoryId)!)!.get(letter) ?? 0
    expect(known, `${context()} — no known word`).toBeGreaterThanOrEqual(1)
    if (run.prompt !== shown) {
      const unseen = categoryIds.some((id) => judge.letters(id).some((other) => !seen.has(`${id}:${other}`)))
      if (known < THIN_PROMPT_WORDS && seen.has(promptKey(run.prompt)) && unseen) expect.fail(`${context()} — thin pair dealt twice`)
      seen.add(promptKey(run.prompt))
      shown = run.prompt
    }

    expect(remainingSeconds(run, step), context()).toBeLessThanOrEqual(60 + 10)

    if (rng.next() < 0.05) {
      run = reroll(run, judge, step)
      continue
    }

    if (rng.next() < 0.1) {
      const before = run
      run = skip(run, judge, step)
      expect(run.skips, context()).toBe(before.skips + 1)
      const missed = run.missed.length > before.missed.length ? run.missed[run.missed.length - 1]! : null
      if (missed) {
        const taught = inspect({ ...before, prompt: missed.prompt }, missed.display, judge)
        expect(taught.kind, `${context()} — Professeur whispered ${missed.display}`).toBe('accepted')
      }
      expect(run.combo, context()).toBe(0)
      continue
    }

    const raw = answerFor(rng, run, byId.get(categoryId)!, pick(rng, packs))
    const verdict = inspect(run, raw, judge)
    const played = submit(run, raw, judge, step)
    const tag = `${context()} raw=${JSON.stringify(raw)}`

    expect(played.verdict, `${tag} — inspect and submit diverge`).toEqual(verdict)

    if (verdict.kind === 'spell') {
      run = played.run
      if (run.joker) expect(inspect(run, run.joker.display, judge).found?.joker, `${tag} — joker word refused`).toBe(true)
      continue
    }

    if (verdict.kind !== 'accepted') {
      expect(played.run, tag).toBe(run)
      continue
    }

    const found = verdict.found!
    expect(initialOf(found.display), tag).toBe(letter)
    expect(Number.isFinite(found.points) && found.points >= 0, `${tag} points=${found.points}`).toBe(true)
    expect(found.rarity >= 0 && found.rarity <= 1, `${tag} rarity=${found.rarity}`).toBe(true)
    expect(played.run.score, tag).toBe(run.score + found.points)
    expect(played.run.used, tag).toContain(found.word)
    expect(new Set(played.run.used).size, `${tag} — a key was scored twice`).toBe(played.run.used.length)

    run = played.run
    // The same answer, at the same prompt, must not score again.
    const again = inspect({ ...run, prompt: found.prompt }, raw, judge)
    expect(again.kind, `${tag} — replay scored twice`).toBe('already')
  }
}

describe('fuzz: random games on the real dictionaries', () => {
  it.each(LANGS)('%s: every invariant holds', (lang) => {
    const master = createRng(SEED ^ compactWord(lang).charCodeAt(0))
    for (let i = 0; i < RUNS; i++) playOne(Math.floor(master.next() * 2 ** 32), lang)
  }, 5_000 + RUNS * 10)

  it.each(LANGS)('%s: the same seed replays the same game', (lang) => {
    const packs = packsByLang.get(lang)!
    const judge = createJudge(packs, { own: {}, crowd: {} })
    const ids = packs.map((pack) => pack.categoryId)
    const play = () => {
      let run = createRun({ seed: SEED, categoryIds: ids }, judge)
      for (let i = 0; i < 15; i++) run = skip(run, judge, i)
      return run.dealt
    }
    expect(play()).toEqual(play())
  })
})

describe('fuzz: dictionary integrity', () => {
  it.each(LANGS)('%s: every word is found exactly under its own spelling', (lang) => {
    for (const pack of packsByLang.get(lang)!) {
      for (const [compact, entry] of pack.entries) {
        const match = findWord(pack, entry.display)
        expect(match?.approximate, `${lang}/${pack.categoryId}: ${entry.display}`).toBe(false)
        expect(match?.entry, `${lang}/${pack.categoryId}: ${entry.display}`).toBe(pack.entries.get(compact))
        expect(entry.notoriety >= 0 && entry.notoriety <= 1, `${entry.display} notoriety`).toBe(true)
      }
    }
  })
})

describe('the domain stays pure', () => {
  const DOMAIN = join(import.meta.dirname, '../domain')
  const FORBIDDEN = [/Math\.random/, /Date\.now/, /new Date\(/, /from ['"]react/, /from ['"]@supabase/, /from ['"]@capacitor/, /\bdocument\./, /\bwindow\./]

  it.each(readdirSync(DOMAIN).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts')))('%s', (file) => {
    // Comments may name what the code must not do.
    const source = readFileSync(join(DOMAIN, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    for (const pattern of FORBIDDEN) expect(source, `${file} uses ${pattern}`).not.toMatch(pattern)
  })
})
