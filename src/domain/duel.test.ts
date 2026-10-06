import { describe, expect, it } from 'vitest'
import { NO_USAGE } from './rarity'
import { buildWordPack, commonWord, findWord, lettersWithEnough, type WordPack } from './words'
import type { Judge } from './run'
import {
  botMove,
  botPick,
  createDuel,
  draftChoices,
  draftComplete,
  draftShape,
  drawnShownAt,
  DUEL_DEATH_BONUS_SECONDS,
  DUEL_DEATH_PAUSE_SECONDS,
  DUEL_DRAW_SECONDS,
  DUEL_FLOOR_SECONDS,
  DUEL_FORCED_PICK_SECONDS,
  DUEL_GRACE_SECONDS,
  DUEL_OPENING_SECONDS,
  DUEL_PASS_PENALTY_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_RESERVE_SECONDS,
  DUEL_TIME_BONUS,
  duelOver,
  duelPrompt,
  duelRanking,
  duelTimeout,
  forcedPick,
  inspectFor,
  onlyChoice,
  openDuel,
  openingAt,
  pickDeadline,
  passTurn,
  pickCategory,
  playWord,
  reserveSeconds,
  reserveShown,
  timeGained,
  type BotProfile,
  type Duel,
} from './duel'

const LETTERS = ['A', 'B', 'C']
const PER_LETTER = 12
const IDS = ['animaux', 'pays', 'villes', 'metiers', 'sports']
const IDS4 = [...IDS, 'objets', 'plantes', 'marques']

function packOf(id: string): WordPack {
  return buildWordPack(
    id,
    LETTERS.flatMap((letter) => Array.from({ length: PER_LETTER }, (_, i) => [`${letter}${id}${i}`, 50, 1] as const)),
  )
}

const packs = new Map(IDS4.map((id) => [id, packOf(id)]))

const judge: Judge = {
  find: (id, word) => {
    const pack = packs.get(id)
    return pack ? findWord(pack, word) : null
  },
  usage: () => NO_USAGE,
  known: () => PER_LETTER,
  letters: (id) => {
    const pack = packs.get(id)
    return pack ? lettersWithEnough(pack, PER_LETTER) : []
  },
  common: (id, letter, played) => {
    const pack = packs.get(id)
    return pack ? commonWord(pack, letter, played) : null
  },
}

/** Le mot que la table connaît sur le couple en cours. */
function answer(duel: Duel): string {
  const prompt = duelPrompt(duel)!
  return `${prompt.letter}${prompt.categoryId}0`
}

const NAMES = ['me', 'maxitoon', 'terretciel', 'demontoon']

function draft(players: number, seed = 7): Duel {
  let duel = createDuel({ seed, playerIds: NAMES.slice(0, players), categories: IDS, opener: 0 })
  while (duel.phase === 'draft' && !draftComplete(duel)) {
    const choices = draftChoices(duel)
    const picked = choices[duel.picks.length % Math.max(1, choices.length)]
    if (!picked) break
    duel = pickCategory(duel, picked)
  }
  return openDuel(duel, judge, 0)
}

describe('createDuel', () => {
  it('ouvre une table de deux à quatre joueurs, tous à trente secondes', () => {
    const duel = createDuel({ seed: 1, playerIds: ['me', 'maxitoon'], categories: IDS })

    expect(duel.phase).toBe('draft')
    expect(duel.players.map((player) => player.reserve)).toEqual([DUEL_RESERVE_SECONDS, DUEL_RESERVE_SECONDS])
    expect(duel.players.every((player) => player.alive)).toBe(true)
    expect(duel.players.map((player) => player.id)).toEqual(['me', 'maxitoon'])
  })

  it('refuse une table hors de deux à quatre', () => {
    expect(() => createDuel({ seed: 1, playerIds: ['me'], categories: IDS })).toThrow()
    expect(() => createDuel({ seed: 1, playerIds: NAMES.concat('cinq'), categories: IDS })).toThrow()
  })
})

describe('le draft', () => {
  it('donne deux choix à chacun à deux joueurs, puis tire la cinquième', () => {
    const duel = draft(2)

    expect(duel.phase).toBe('play')
    expect(duel.picks).toHaveLength(5)
    expect(new Set(duel.picks).size).toBe(5)
    expect(duel.picks.every((id) => IDS.includes(id))).toBe(true)
  })

  it('donne un choix à chacun à trois et quatre joueurs', () => {
    for (const players of [3, 4]) {
      const duel = draft(players)
      expect(duel.picks).toHaveLength(5)
      expect(new Set(duel.picks).size).toBe(5)
    }
  })

  it('ignore une catégorie déjà prise ou hors du vivier', () => {
    let duel = createDuel({ seed: 3, playerIds: ['me', 'maxitoon'], categories: IDS })
    duel = pickCategory(duel, 'animaux')

    expect(pickCategory(duel, 'animaux')).toBe(duel)
    expect(pickCategory(duel, 'inconnue')).toBe(duel)
    expect(pickCategory(duel, 'pays').picks).toEqual(['animaux', 'pays'])
  })

  it('ouvre la première manche au premier joueur, avec un couple jouable', () => {
    const duel = draft(2)

    expect(duel.turn?.player).toBe(0)
    expect(duel.turn?.startedAt).toBe(0)
    expect(duel.turn?.declined).toEqual([])
    expect(judge.letters(duelPrompt(duel)!.categoryId)).toContain(duelPrompt(duel)!.letter)
  })
})

describe('l’ouvreur', () => {
  it('est tiré de la graine, pas de la place à table', () => {
    const openers = new Set(
      Array.from({ length: 40 }, (_, seed) => createDuel({ seed, playerIds: NAMES, categories: IDS }).opener),
    )
    expect([...openers].sort()).toEqual([0, 1, 2, 3])
    expect(createDuel({ seed: 11, playerIds: NAMES, categories: IDS }).opener).toBe(
      createDuel({ seed: 11, playerIds: NAMES, categories: IDS }).opener,
    )
  })

  it('ouvre la première manche', () => {
    let duel = createDuel({ seed: 1, playerIds: NAMES.slice(0, 3), categories: IDS, opener: 2 })
    while (!draftComplete(duel)) duel = pickCategory(duel, draftChoices(duel)[0]!)
    expect(openDuel(duel, judge, 0).turn?.player).toBe(2)
  })
})

describe('les choix d’office', () => {
  it('prend la dernière catégorie qui reste plutôt que de la faire choisir', () => {
    let duel = createDuel({ seed: 1, playerIds: ['me', 'maxitoon'], categories: IDS.slice(0, 3) })
    expect(onlyChoice(duel)).toBeNull()
    duel = pickCategory(pickCategory(duel, 'animaux'), 'pays')
    expect(onlyChoice(duel)).toBe('villes')
    expect(onlyChoice(pickCategory(duel, 'villes'))).toBeNull()
  })

  it('dit combien chacun choisit et combien le sort ajoute', () => {
    expect(draftShape(2, 5)).toEqual({ picks: 2, chosen: 4, drawn: 1 })
    expect(draftShape(3, 8)).toEqual({ picks: 1, chosen: 3, drawn: 2 })
    expect(draftShape(4, 8)).toEqual({ picks: 1, chosen: 4, drawn: 1 })
    expect(draftShape(2, 3)).toEqual({ picks: 2, chosen: 3, drawn: 0 })
  })
})

describe('le temps rendu', () => {
  it('additionne le palier de chaque mot validé', () => {
    const played = playWord(draft(2), answer(draft(2)), judge, 3)
    const player = played.duel.players[0]!
    expect(timeGained(player)).toBe(DUEL_TIME_BONUS[player.words[0]!.tier])
  })
})

describe('la réserve', () => {
  it('lit « 1 » sur son plancher, qui en donne une et demie', () => {
    expect(DUEL_FLOOR_SECONDS).toBeGreaterThan(1)
    expect(reserveShown(DUEL_FLOOR_SECONDS)).toBe(1)
    expect(reserveShown(1.2)).toBe(1)
    expect(reserveShown(DUEL_RESERVE_SECONDS)).toBe(30)
    expect(reserveShown(4.2)).toBe(5)
  })

  it('ne court que pendant le tour de son joueur', () => {
    const duel = draft(2)

    expect(reserveSeconds(duel, 0, 12)).toBe(DUEL_RESERVE_SECONDS - 12)
    expect(reserveSeconds(duel, 1, 12)).toBe(DUEL_RESERVE_SECONDS)
    expect(reserveSeconds(duel, 1, 900)).toBe(DUEL_RESERVE_SECONDS)
  })

  it('tombe à zéro et emporte le joueur qui ne répond plus', () => {
    const duel = duelTimeout(draft(2), judge, DUEL_RESERVE_SECONDS + 0.1)

    expect(duel.players[0]?.alive).toBe(false)
    expect(duel.players[0]?.reserve).toBe(0)
    expect(duelOver(duel)).toBe(true)
    expect(duelRanking(duel)).toEqual([1, 0])
  })

  it('ne fait pas courir la réserve du survivant pendant la mise en scène', () => {
    const killed = duelTimeout(draft(3), judge, DUEL_RESERVE_SECONDS + 0.1)
    const next = killed.turn!.player

    const died = DUEL_RESERVE_SECONDS + 0.1
    // Le tour du survivant ne s'ouvre qu'après la mise en scène de la mort…
    expect(killed.turn!.startedAt).toBeCloseTo(died + DUEL_DEATH_PAUSE_SECONDS)
    expect(reserveSeconds(killed, next, died + 1)).toBe(DUEL_RESERVE_SECONDS + DUEL_DEATH_BONUS_SECONDS)
    // …puis sa réserve court normalement.
    expect(reserveSeconds(killed, next, died + DUEL_DEATH_PAUSE_SECONDS + 2.5)).toBeCloseTo(DUEL_RESERVE_SECONDS + DUEL_DEATH_BONUS_SECONDS - 2.5)
  })

  it('rend un peu de temps à chaque survivant quand un joueur meurt, pas aux morts', () => {
    const once = duelTimeout(draft(4), judge, DUEL_RESERVE_SECONDS + 0.1)
    expect(once.players.map((player) => player.reserve)).toEqual([0, 1, 1, 1].map((alive) => alive * (DUEL_RESERVE_SECONDS + DUEL_DEATH_BONUS_SECONDS)))

    const twice = duelTimeout(once, judge, 100)
    expect(twice.players[0]!.reserve).toBe(0)
    expect(twice.players[1]!.reserve).toBe(0)
    expect(twice.players[2]!.reserve).toBe(DUEL_RESERVE_SECONDS + 2 * DUEL_DEATH_BONUS_SECONDS)
  })

  it('laisse la partie continuer sans le mort, en sautant son tour', () => {    let duel = duelTimeout(draft(4), judge, DUEL_RESERVE_SECONDS + 0.1)
    expect(duel.turn?.player).toBe(1)

    duel = duelTimeout(duel, judge, 100)
    duel = duelTimeout(duel, judge, 200)

    expect(duelOver(duel)).toBe(true)
    expect(duel.deaths).toEqual([0, 1, 2])
    expect(duelRanking(duel)).toEqual([3, 2, 1, 0])
  })
})

describe('le plancher', () => {
  it('donne toujours au moins une seconde à qui reçoit la main', () => {
    let duel = draft(2)
    // Le premier joueur passe en ne gardant qu'une demi-seconde.
    duel = passTurn(duel, judge, DUEL_RESERVE_SECONDS - DUEL_PASS_PENALTY_SECONDS - 0.5)
    expect(duel.players[0]!.reserve).toBeCloseTo(0.5)
    duel = passTurn(duel, judge, 30)
    // La main lui revient : il repart d'une seconde, pas d'une demi.
    expect(duel.turn?.player).toBe(0)
    expect(duel.players[0]!.reserve).toBe(DUEL_FLOOR_SECONDS)
  })
})

describe('le mot sauvé à zéro', () => {
  it('valide un mot juste arrivé dans la marge et ramène son joueur au plancher', () => {
    const opening = draft(2)
    const played = playWord(opening, answer(opening), judge, DUEL_RESERVE_SECONDS + DUEL_GRACE_SECONDS / 2)

    expect(played.verdict.kind).toBe('accepted')
    expect(played.saved).toBe(true)
    expect(played.duel.players[0]!.alive).toBe(true)
    expect(played.duel.players[0]!.reserve).toBeGreaterThanOrEqual(DUEL_FLOOR_SECONDS)
    expect(played.duel.turn?.player).toBe(1)
  })

  it('ne sauve plus personne après la marge, ni avec un mot faux à zéro', () => {
    const opening = draft(2)
    expect(playWord(opening, answer(opening), judge, DUEL_RESERVE_SECONDS + DUEL_GRACE_SECONDS + 0.1).duel.players[0]!.alive).toBe(false)
    expect(playWord(opening, 'zzzz', judge, DUEL_RESERVE_SECONDS).duel.players[0]!.alive).toBe(false)
  })

  it('ne parle pas de sauvetage pour un mot dans le temps', () => {
    const opening = draft(2)
    expect(playWord(opening, answer(opening), judge, 4).saved).toBe(false)
  })
})

describe('les heures du draft', () => {
  it('fait courir chaque choix depuis le précédent, et ouvre la partie après la mise en scène', () => {
    let duel = createDuel({ seed: 3, playerIds: ['me', 'maxitoon'], categories: IDS, at: 5 })
    expect(pickDeadline(duel)).toBe(5 + DUEL_PICK_SECONDS)
    duel = pickCategory(duel, 'animaux', 8)
    expect(pickDeadline(duel)).toBe(8 + DUEL_PICK_SECONDS)
    expect(openingAt(duel)).toBeNull()
    for (const [index, id] of ['pays', 'villes', 'metiers'].entries()) duel = pickCategory(duel, id, 9 + index)
    expect(draftComplete(duel)).toBe(true)
    // La catégorie tirée au sort tombe une pause après le dernier choix : le
    // pool n'est complet qu'à ce moment-là, et l'ouverture suit.
    expect(duel.draftedAt).toBe(11 + DUEL_DRAW_SECONDS)
    expect(openingAt(duel)).toBe(11 + DUEL_DRAW_SECONDS + DUEL_OPENING_SECONDS)
    expect(openDuel(duel, judge).turn?.startedAt).toBe(11 + DUEL_DRAW_SECONDS + DUEL_OPENING_SECONDS)
  })

  it('laisse moins de temps à une catégorie restée seule', () => {
    let duel = createDuel({ seed: 1, playerIds: ['me', 'maxitoon'], categories: IDS.slice(0, 3), at: 0 })
    duel = pickCategory(pickCategory(duel, 'animaux', 1), 'pays', 2)
    expect(pickDeadline(duel)).toBe(2 + DUEL_FORCED_PICK_SECONDS)
  })

  it('pose les catégories du sort une à une, une pause chacune', () => {
    // Trois joueurs : trois choix, puis les deux dernières au sort.
    let duel = createDuel({ seed: 3, playerIds: ['me', 'maxitoon', 'terretciel'], categories: IDS, at: 0 })
    for (const [index, id] of ['animaux', 'pays', 'villes'].entries()) duel = pickCategory(duel, id, 1 + index)
    expect(drawnShownAt(duel, 3)).toBe(0)
    expect(drawnShownAt(duel, 3 + DUEL_DRAW_SECONDS)).toBe(1)
    expect(drawnShownAt(duel, 3 + 2 * DUEL_DRAW_SECONDS)).toBe(2)
    expect(duel.draftedAt).toBe(3 + 2 * DUEL_DRAW_SECONDS)
  })
})

describe('le passe hérite le couple', () => {
  it('retire cinq secondes et donne la main sans retirer le couple', () => {
    const opening = draft(2)
    const prompt = duelPrompt(opening)!
    const passed = passTurn(opening, judge, 4)

    expect(passed.turn?.player).toBe(1)
    expect(duelPrompt(passed)).toEqual(prompt)
    expect(passed.players[0]?.reserve).toBe(DUEL_RESERVE_SECONDS - 4 - DUEL_PASS_PENALTY_SECONDS)
    expect(passed.turn?.declined).toEqual([0])
    expect(passed.dealt).toEqual([])
  })

  it('tire un couple neuf quand toute la table a refusé, à l’ouvreur', () => {
    let duel = draft(2)
    const prompt = duelPrompt(duel)!

    duel = passTurn(duel, judge, 4)
    duel = passTurn(duel, judge, 6)

    expect(duel.dealt).toEqual([`${prompt.categoryId}:${prompt.letter}`])
    expect(duel.turn?.player).toBe(0)
    expect(duel.turn?.declined).toEqual([])
    expect(duelPrompt(duel)?.categoryId).not.toBe(prompt.categoryId)
  })

  it('ne compte que les vivants quand un joueur est mort', () => {
    let duel = draft(3)
    duel = passTurn(duel, judge, 2)
    duel = passTurn(duel, judge, 3)
    // Le troisième vit encore : le couple n'est pas échoué.
    expect(duel.dealt).toEqual([])
    expect(duel.turn?.player).toBe(2)

    duel = passTurn(duel, judge, 4)
    expect(duel.dealt).toHaveLength(1)
    expect(duel.turn?.player).toBe(0)
  })
})

describe('le mot validé', () => {
  it('consomme la manche, paie le palier et passe la main', () => {
    const opening = draft(2)
    const prompt = duelPrompt(opening)!
    const played = playWord(opening, answer(opening), judge, 6)

    expect(played.verdict.kind).toBe('accepted')
    const tier = played.verdict.found!.tier
    expect(played.duel.players[0]?.reserve).toBe(DUEL_RESERVE_SECONDS - 6 + DUEL_TIME_BONUS[tier])
    expect(played.duel.players[0]?.words).toHaveLength(1)
    expect(played.duel.players[0]!.score).toBeGreaterThan(0)
    expect(played.duel.dealt).toEqual([`${prompt.categoryId}:${prompt.letter}`])
    expect(played.duel.turn?.player).toBe(1)
    expect(duelPrompt(played.duel)?.categoryId).not.toBe(prompt.categoryId)
  })

  it('paie le palier du mot, jamais plus que la table', () => {
    expect(DUEL_TIME_BONUS.courant).toBe(0)
    expect(DUEL_TIME_BONUS['peu commun']).toBe(1)
    expect(DUEL_TIME_BONUS.rare).toBe(1.5)
    expect(DUEL_TIME_BONUS['très rare']).toBe(2)
  })

  it('laisse le tour continuer sur un mot refusé', () => {
    const opening = draft(2)
    const played = playWord(opening, 'zzzz', judge, 5)

    expect(played.verdict.kind).not.toBe('accepted')
    expect(played.duel).toBe(opening)
  })

  it('juge d’avance le mot du joueur qui attend, sans le jouer', () => {
    const opening = draft(2)
    const waiter = inspectFor(opening, 1, answer(opening), judge)

    expect(waiter.kind).toBe('accepted')
    expect(opening.players[1]?.words).toHaveLength(0)
    expect(playWord(opening, answer(opening), judge, 1).verdict.kind).toBe('accepted')
  })
})

describe('la reproductibilité', () => {
  it('distribue les mêmes couples et les mêmes réserves à graine égale', () => {
    let one = draft(2, 42)
    let other = draft(2, 42)

    for (let turn = 0; turn < 4; turn++) {
      const at = turn + 0.5
      const card = duelPrompt(one)!
      expect(duelPrompt(other)).toEqual(card)
      one = playWord(one, answer(one), judge, at).duel
      other = playWord(other, answer(other), judge, at).duel
    }

    expect(one.players.map((player) => player.reserve)).toEqual(other.players.map((player) => player.reserve))
    expect(one.players.map((player) => player.score)).toEqual(other.players.map((player) => player.score))
  })

  it('ne redonne pas le même couple deux fois dans le duel', () => {
    let duel = draft(2, 5)
    const seen = new Set<string>()

    for (let turn = 0; turn < 8 && !duelOver(duel); turn++) {
      const prompt = duelPrompt(duel)!
      const key = `${prompt.categoryId}:${prompt.letter}`
      seen.add(key)
      duel = passTurn(duel, judge, duel.turn!.startedAt + 1)
    }

    expect(seen.size).toBeGreaterThan(3)
  })
})

describe('les joueurs maison', () => {
  const bot: BotProfile = { id: 'maxitoon', think: [2, 6], answerChance: 1 }

  it('ne joue que pendant son tour', () => {
    const duel = draft(2)
    expect(duel.turn?.player).toBe(0)
    expect(botMove(duel, judge, bot)).toBeNull()
    expect(botMove(passTurn(duel, judge, 1), judge, bot)).not.toBeNull()
  })

  it('répond avec un mot que le dictionnaire accepte, dans le temps qui lui reste', () => {
    const passed = passTurn(draft(2), judge, 1)
    const move = botMove(passed, judge, bot)!

    expect(move.after).toBeGreaterThan(0)
    expect(move.after).toBeLessThanOrEqual(DUEL_RESERVE_SECONDS)
    expect(move.word).not.toBeNull()
    expect(playWord(passed, move.word!, judge, move.after).verdict.kind).toBe('accepted')
  })

  it('passe tout le temps s’il ne trouve rien', () => {
    const passed = passTurn(draft(2), judge, 1)
    expect(botMove(passed, judge, { ...bot, answerChance: 0 })?.word).toBeNull()
  })

  it('rejoue le même coup à graine égale', () => {
    const passed = passTurn(draft(2, 9), judge, 1)
    expect(botMove(passed, judge, bot)).toEqual(botMove(passed, judge, bot))
  })

  it('choisit sa catégorie pendant son tour de draft', () => {
    let duel = createDuel({ seed: 2, playerIds: ['me', 'maxitoon'], categories: IDS })
    expect(botPick(duel, bot)).toBeNull()
    duel = pickCategory(duel, draftChoices(duel)[0]!)
    expect(IDS).toContain(botPick(duel, bot))
  })

  it('tire une catégorie du sort quand le joueur n’a pas choisi à temps', () => {
    const duel = createDuel({ seed: 4, playerIds: ['me', 'maxitoon'], categories: IDS })
    const forced = forcedPick(duel)

    expect(IDS).toContain(forced)
    expect(forcedPick(duel)).toBe(forced)
    expect(forcedPick(pickCategory(duel, forced!))).not.toBe(forced)
    expect(forcedPick({ ...duel, phase: 'play' })).toBeNull()
  })
})
