import { baselinePass, promptPull, type PromptRecord } from '../domain/prompts'
import { NO_USAGE, type WordUsage } from '../domain/rarity'
import type { Spell } from '../domain/powers'
import { countOf } from '../domain/progression'
import { promptKey, type Judge } from '../domain/run'
import { compactWord } from '../domain/text'
import { commonWord, findWord, knownByLetter, type WordPack } from '../domain/words'

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
 * `records` are the crowd's tally per pair, in the dictionary's own language.
 * A challenge leaves them out: two players must draw the same prompts, whatever
 * the crowd did with them since.
 */
export function createJudge(
  packs: readonly WordPack[],
  usage: UsageSource,
  spells?: Readonly<Record<Spell, readonly string[]>>,
  records?: Readonly<Record<string, PromptRecord>>,
): Judge {
  const byId = new Map(packs.map((pack) => [pack.categoryId, pack]))
  const known = new Map(packs.map((pack) => [pack.categoryId, knownByLetter(pack)]))
  const letters = new Map([...known].map(([id, counts]) => [id, [...counts.keys()].sort()]))
  // One pass per category, on the first pair drawn from it: the average every
  // pair of that category is judged against.
  const baselines = new Map<string, number>()

  return {
    ...(spells && {
      spells: {
        joker: spells.joker.map(compactWord),
        hush: spells.hush.map(compactWord),
      },
    }),
    find(categoryId, word, tolerance) {
      const pack = byId.get(categoryId)
      return pack ? findWord(pack, word, tolerance) : null
    },
    common(categoryId, letter, played) {
      const pack = byId.get(categoryId)
      return pack ? commonWord(pack, letter, played) : null
    },
    usage(word): WordUsage {
      const own = countOf(usage.own, word)
      const crowd = countOf(usage.crowd, word)
      if (own === 0 && crowd === 0) return NO_USAGE
      return { own, globalShare: crowd }
    },
    letters(categoryId) {
      return letters.get(categoryId) ?? []
    },
    known(categoryId, letter) {
      return known.get(categoryId)?.get(letter) ?? 0
    },
    ...(records && {
      pull(categoryId: string, letter: string) {
        let baseline = baselines.get(categoryId)
        if (baseline === undefined) {
          baseline = baselinePass((letters.get(categoryId) ?? []).map((id) => records[promptKey({ categoryId, letter: id })]))
          baselines.set(categoryId, baseline)
        }
        return promptPull(records[promptKey({ categoryId, letter })], baseline)
      },
    }),
  }
}
