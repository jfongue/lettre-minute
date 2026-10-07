import { baselinePass, promptPull, type PromptRecord } from '../domain/prompts'
import { NO_USAGE, type WordUsage } from '../domain/rarity'
import type { Spell } from '../domain/powers'
import { countOf } from '../domain/progression'
import { promptKey, type Judge } from '../domain/run'
import { compactWord } from '../domain/text'
import { commonWord, findWord, knownByLetter, mirrorPack, suggestedWord, type WordPack } from '../domain/words'

export interface UsageSource {
  /** Times the player answered this word before, from the local profile. */
  own: Readonly<Record<string, number>>
  /** Share of recent runs, all players, that contained the word — empty until the server answers. */
  crowd: Readonly<Record<string, number>>
}

/**
 * Ties the loaded dictionaries and the usage counters into the single object
 * the rules ask questions of. Letters are precomputed once per pack: the field
 * judges every keystroke, and nothing here may walk the word list.
 *
 * `records` are the crowd's tally per pair, in the dictionary's own language,
 * and `damped` the pairs the maintainer slowed by hand (`DAMPED_PROMPTS`). A
 * challenge leaves both out: two players must draw the same prompts, whatever
 * the crowd did with them since.
 */
export function createJudge(
  packs: readonly WordPack[],
  usage: UsageSource,
  spells?: Readonly<Record<Spell, readonly string[]>>,
  records?: Readonly<Record<string, PromptRecord>>,
  damped?: Readonly<Record<string, number>>,
  edge: 'first' | 'last' = 'first',
): Judge {
  const byId = new Map(packs.map((pack) => [pack.categoryId, pack]))
  // Un mode renversé juge sur la dernière lettre : son dictionnaire est relu
  // par la fin une fois, plutôt qu'à chaque frappe, et ses lettres tirées sont
  // celles qui finissent vraiment un mot — M, parce qu'il y a le Vietnam.
  const searchById = edge === 'last' ? new Map(packs.map((pack) => [pack.categoryId, mirrorPack(pack)])) : byId
  const known = new Map(packs.map((pack) => [pack.categoryId, knownByLetter(pack, edge)]))
  const letters = new Map([...known].map(([id, counts]) => [id, [...counts.keys()].sort()]))
  // One pass per category, on the first pair drawn from it: the average every
  // pair of that category is judged against.
  const baselines = new Map<string, number>()
  // Ce que la foule et le joueur ont dit d'un mot : le tarif d'une réponse, et
  // ce que le bilan propose.
  const wordUsage = (word: string): WordUsage => {
    const own = countOf(usage.own, word)
    const crowd = countOf(usage.crowd, word)
    if (own === 0 && crowd === 0) return NO_USAGE
    return { own, globalShare: crowd }
  }

  return {
    edge,
    ...(spells && {
      spells: {
        joker: spells.joker.map(compactWord),
        hush: spells.hush.map(compactWord),
      },
    }),
    find(categoryId, word, tolerance) {
      const pack = searchById.get(categoryId)
      const typed = edge === 'last' ? [...compactWord(word)].reverse().join('') : word
      return pack ? findWord(pack, typed, tolerance) : null
    },
    common(categoryId, letter, played) {
      // Le dictionnaire relu par la fin : le mot proposé doit vraiment finir
      // par la lettre de la question, pas la commencer.
      const pack = searchById.get(categoryId)
      return pack ? commonWord(pack, letter, played) : null
    },
    suggest(categoryId, letter, played, rare) {
      const pack = searchById.get(categoryId)
      return pack ? suggestedWord(pack, letter, played, (entry) => wordUsage(entry.key), rare) : null
    },
    usage: wordUsage,
    letters(categoryId) {
      return letters.get(categoryId) ?? []
    },
    known(categoryId, letter) {
      return known.get(categoryId)?.get(letter) ?? 0
    },
    ...((records || damped) && {
      pull(categoryId: string, letter: string) {
        const key = promptKey({ categoryId, letter })
        const hand = damped?.[key] ?? 1
        if (!records) return hand
        let baseline = baselines.get(categoryId)
        if (baseline === undefined) {
          baseline = baselinePass((letters.get(categoryId) ?? []).map((id) => records[promptKey({ categoryId, letter: id })]))
          baselines.set(categoryId, baseline)
        }
        return promptPull(records[key], baseline) * hand
      },
    }),
  }
}
