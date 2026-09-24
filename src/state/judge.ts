import type { PlayableLetter } from '../domain/letters'
import { MIN_WORDS_PER_PROMPT, type Judge } from '../domain/run'
import { NO_USAGE, type WordUsage } from '../domain/rarity'
import { findWord, lettersWithEnough, type WordPack } from '../domain/words'

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
export function createJudge(packs: readonly WordPack[], usage: UsageSource, deck: readonly PlayableLetter[]): Judge {
  const byId = new Map(packs.map((pack) => [pack.categoryId, pack]))
  const letters = new Map(packs.map((pack) => [pack.categoryId, lettersWithEnough(pack, MIN_WORDS_PER_PROMPT)]))

  return {
    deck,
    find(categoryId, word) {
      const pack = byId.get(categoryId)
      return pack ? findWord(pack, word) : null
    },
    usage(word): WordUsage {
      const own = usage.own[word] ?? 0
      const crowd = usage.crowd[word] ?? 0
      if (own === 0 && crowd === 0) return NO_USAGE
      return { own, globalShare: crowd }
    },
    letters(categoryId) {
      return letters.get(categoryId) ?? []
    },
  }
}
