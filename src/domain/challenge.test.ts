import { describe, expect, it } from 'vitest'
import {
  applyChallengeRun,
  awardTrophies,
  challengeXp,
  defaultChallengePowers,
  mostSharedWords,
  needsPowerPick,
  scoreAt,
  settleChallenge,
  uniqueWords,
  type ChallengeEntry,
  type ChallengeWord,
} from './challenge'
import { NEW_PROFILE } from './progression'

function word(key: string, points: number, extra: Partial<ChallengeWord> = {}): ChallengeWord {
  return {
    categoryId: 'animaux',
    letter: key[0]!.toUpperCase(),
    key,
    display: key,
    points,
    tier: 'courant',
    approximate: false,
    seconds: 3,
    at: 10,
    ...extra,
  }
}

function entry(playerId: string, playedAt: number | null, words: ChallengeWord[], extra: Partial<ChallengeEntry> = {}): ChallengeEntry {
  return {
    playerId,
    playedAt,
    score: words.reduce((sum, found) => sum + found.points, 0),
    skips: 0,
    bestCombo: 1,
    words,
    ...extra,
  }
}

describe('settleChallenge', () => {
  it('halves a word someone else also found, and keeps a unique one whole', () => {
    const standings = settleChallenge([
      entry('ana', 1, [word('chat', 10), word('lynx', 25)]),
      entry('bob', 2, [word('chat', 14), word('zebre', 12)]),
    ])

    const ana = standings.find((standing) => standing.playerId === 'ana')!
    expect(ana.score).toBe(5 + 25)
    expect(ana.unique).toBe(1)
    expect(ana.shared).toBe(1)
    expect(standings.find((standing) => standing.playerId === 'bob')!.score).toBe(7 + 12)
    expect(standings[0]!.playerId).toBe('ana')
  })

  it('leaves out who has not played, and ranks a tie by raw score then by who played first', () => {
    const standings = settleChallenge([
      entry('late', 5, [word('ane', 10)]),
      entry('early', 2, [word('ours', 10)]),
      entry('rich', 9, [word('ane', 20)]),
      entry('away', null, []),
    ])

    expect(standings.map((standing) => standing.playerId)).toEqual(['rich', 'early', 'late'])
  })

  it('tells words apart by category: « Mars » the planet is not « Mars » the fish', () => {
    const standings = settleChallenge([
      entry('ana', 1, [word('mars', 10, { categoryId: 'planetes' })]),
      entry('bob', 2, [word('mars', 10, { categoryId: 'poissons' })]),
    ])
    expect(standings.every((standing) => standing.unique === 1)).toBe(true)
  })
})

describe('recap words', () => {
  const entries = [
    entry('ana', 1, [word('chat', 10), word('lynx', 25, { tier: 'rare' })]),
    entry('bob', 2, [word('chat', 10), word('zebre', 12, { tier: 'peu commun' })]),
    entry('cyd', 3, [word('chat', 10), word('zebre', 12)]),
  ]

  it('names the most shared words, with who found them', () => {
    expect(mostSharedWords(entries).map((found) => [found.key, found.players])).toEqual([
      ['chat', ['ana', 'bob', 'cyd']],
      ['zebre', ['bob', 'cyd']],
    ])
  })

  it('names the words only one player found, rarest first', () => {
    expect(uniqueWords(entries).map((found) => found.key)).toEqual(['lynx'])
  })
})

describe('awardTrophies', () => {
  it('needs two runs to compare', () => {
    expect(awardTrophies([entry('ana', 1, [word('chat', 10)])])).toEqual([])
  })

  it('awards the slowest and fastest answers with their word, and skips an award nobody earned', () => {
    const trophies = awardTrophies([
      entry('ana', 1, [word('chat', 10, { seconds: 2 }), word('lynx', 25, { seconds: 19 })]),
      entry('bob', 2, [word('ours', 10, { seconds: 1.5 })], { skips: 3 }),
    ])
    const byId = Object.fromEntries(trophies.map((trophy) => [trophy.id, trophy]))

    expect(byId.slowest).toMatchObject({ playerId: 'ana', value: 19, word: 'lynx' })
    expect(byId.fastest).toMatchObject({ playerId: 'bob', value: 1.5, word: 'ours' })
    expect(byId.skipper).toMatchObject({ playerId: 'bob', value: 3 })
    expect(byId.typos).toBeUndefined()
    expect(byId.sheep).toBeUndefined()
  })

  it('gives a tie to whoever played first', () => {
    const trophies = awardTrophies([
      entry('late', 8, [word('ane', 10)], { skips: 2 }),
      entry('early', 1, [word('ours', 10)], { skips: 2 }),
    ])
    expect(trophies.find((trophy) => trophy.id === 'skipper')?.playerId).toBe('early')
  })
})

describe('scoreAt', () => {
  it('replays a rival: only the words validated by that second count', () => {
    const words = [word('chat', 10, { at: 4 }), word('lynx', 25, { at: 30 })]
    expect(scoreAt(words, 3)).toBe(0)
    expect(scoreAt(words, 4)).toBe(10)
    expect(scoreAt(words, 60)).toBe(35)
  })
})

describe('challenge progression', () => {
  it('pays a quarter more XP, and leaves the record and the locked prompts alone', () => {
    const profile = { ...NEW_PROFILE, bestScore: 50, lastPrompts: ['animaux:C'] }
    const after = applyChallengeRun(profile, { score: 200, words: ['chat'], bestCombo: 3, prompts: ['pays:F'] })

    expect(challengeXp(200)).toBe(250)
    expect(after.xp).toBe(250)
    expect(after.bestScore).toBe(50)
    expect(after.runs).toBe(1)
    expect(after.lastPrompts).toEqual(['animaux:C'])
  })

  it('bars Permutation, and asks for a pick only past two allowed powers', () => {
    const three = { ...NEW_PROFILE, powers: ['permutation', 'joker', 'dodge'], equipped: ['permutation', 'dodge'] }
    expect(needsPowerPick(three)).toBe(false)
    expect(defaultChallengePowers(three)).toEqual(['dodge', 'joker'])
    expect(needsPowerPick({ ...three, powers: [...three.powers, 'magic'] })).toBe(true)
  })
})
