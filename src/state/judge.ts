import type { Judge } from '../domain/run'
import { NO_USAGE, type WordUsage } from '../domain/rarity'
import type { Spell } from '../domain/powers'
import { countOf } from '../domain/progression'
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
 */
export function createJudge(
  packs: readonly WordPack[],
  usage: UsageSource,
  spells?: Readonly<Record<Spell, readonly string[]>>,
): Judge {
  const byId = new Map(packs.map((pack) => [pack.categoryId, pack]))
  const known = new Map(packs.map((pack) => [pack.categoryId, knownByLetter(pack)]))
  const letters = new Map([...known].map(([id, counts]) => [id, [...counts.keys()].sort()]))

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
  }
}
