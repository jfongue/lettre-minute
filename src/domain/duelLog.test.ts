import { describe, expect, it } from 'vitest'
import { NO_USAGE } from './rarity'
import { buildWordPack, commonWord, findWord, lettersWithEnough, type WordPack } from './words'
import type { Judge } from './run'
import {
  draftPlayer,
  duelPrompt,
  pickDeadline,
  reserveSeconds,
  DUEL_DEATH_BONUS_SECONDS,
  DUEL_DEATH_PAUSE_SECONDS,
  DUEL_GRACE_SECONDS,
  DUEL_OPENING_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_RESERVE_SECONDS,
  type BotProfile,
  type Duel,
} from './duel'
import { driverMove, replay, settle, startDuel, DUEL_ANNOUNCE_SECONDS, type DuelMove, type DuelSetup } from './duelLog'

const IDS = ['animaux', 'pays', 'villes', 'metiers', 'sports']

function packOf(id: string): WordPack {
  return buildWordPack(
    id,
    ['A', 'B', 'C'].flatMap((letter) => Array.from({ length: 12 }, (_, i) => [`${letter}${id}${i}`, 50, 1] as const)),
  )
}

const packs = new Map(IDS.map((id) => [id, packOf(id)]))
const judge: Judge = {
  find: (id, word) => (packs.get(id) ? findWord(packs.get(id)!, word) : null),
  usage: () => NO_USAGE,
  known: () => 12,
  letters: (id) => (packs.get(id) ? lettersWithEnough(packs.get(id)!, 12) : []),
  common: (id, letter, played) => (packs.get(id) ? commonWord(packs.get(id)!, letter, played) : null),
}

const setup: DuelSetup = { seed: 42, playerIds: ['me', 'maxitoon'], categories: IDS, owned: [5, 5], startedAt: 100 }
const draftOpens = 100 + DUEL_ANNOUNCE_SECONDS

/** Le draft entier, un choix par seconde, chacun à son tour. */
function draftMoves(duel: Duel = startDuel(setup)): DuelMove[] {
  const moves: DuelMove[] = []
  let at = draftOpens
  let current = duel
  for (let seq = 1; seq <= 4; seq++) {
    at += 1
    const seat = current.order[current.picks.length % current.order.length]!
    const payload = IDS.find((id) => !current.picks.includes(id))!
    const move: DuelMove = { seq, seat, kind: 'pick', payload, at }
    moves.push(move)
    current = replay(setup, moves, null).duel
  }
  return moves
}

function answer(duel: Duel): string {
  const prompt = duelPrompt(duel)!
  return `${prompt.letter}${prompt.categoryId}0`
}

describe('le rejeu', () => {
  it('ouvre le draft après l’annonce de sa règle', () => {
    const duel = startDuel(setup)
    expect(duel.pickSince).toBe(draftOpens)
    expect(pickDeadline(duel)).toBe(draftOpens + DUEL_PICK_SECONDS)
  })

  it('rejoue le draft sans dictionnaire, puis attend les dictionnaires pour jouer', () => {
    const picks = draftMoves()
    const done = replay(setup, picks, null)
    expect(done.duel.picks).toHaveLength(5)
    expect(done.facts.filter((fact) => fact.kind === 'picked')).toHaveLength(4)

    const opened = settle(done.duel, judge, done.duel.draftedAt! + DUEL_OPENING_SECONDS)
    const word: DuelMove = { seq: 5, seat: opened.turn!.player, kind: 'word', payload: answer(opened), at: opened.turn!.startedAt + 2 }
    expect(replay(setup, [...picks, word], null).applied).toBe(4)
    const played = replay(setup, [...picks, word], judge)
    expect(played.applied).toBe(5)
    expect(played.facts.at(-1)?.kind).toBe('solved')
  })

  it('donne la même partie à deux appareils, et ignore un coup du mauvais joueur', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const wrong: DuelMove = { seq: 5, seat: 1 - opened.turn!.player, kind: 'pass', payload: '', at: opened.turn!.startedAt + 1 }
    const one = replay(setup, [...picks, wrong], judge)
    const other = replay(setup, [...picks, wrong], judge)
    expect(one.duel).toEqual(other.duel)
    expect(one.facts.some((fact) => fact.kind === 'passed')).toBe(false)
  })

  it('laisse un conseil au draft sans toucher à la table, et refuse celui qui choisit', () => {
    const duel = startDuel(setup)
    const picker = draftPlayer(duel)
    const other = 1 - picker
    const cheer: DuelMove = { seq: 1, seat: other, kind: 'cheer', payload: IDS[0]!, at: draftOpens + 1 }

    // Le conseil se lit sans dictionnaire, et ne change rien à la table.
    const heard = replay(setup, [cheer], null)
    expect(heard.duel).toEqual(duel)
    expect(heard.facts).toEqual([{ id: '1', kind: 'cheered', player: other, at: draftOpens + 1, cheer: IDS[0] }])
    expect(heard.applied).toBe(1)

    // Le draft continue après lui : quatre choix par les joueurs, le sort complète.
    const picks = draftMoves().map((move) => ({ ...move, seq: move.seq + 1 }))
    expect(replay(setup, [cheer, ...picks], null).duel.picks).toHaveLength(5)

    // Celui qui choisit, une catégorie hors du vivier ou déjà prise : rien.
    const first = { ...picks[0]!, seq: 1 }
    expect(replay(setup, [{ ...cheer, seat: picker }], null).facts).toEqual([])
    expect(replay(setup, [{ ...cheer, payload: 'inconnue' }], null).facts).toEqual([])
    expect(replay(setup, [first, { ...cheer, seq: 2, at: first.at + 1 }], null).facts.some((fact) => fact.kind === 'cheered')).toBe(false)
  })

  it('met en scène une mort avant que la main reparte', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    // Les heures du duel ne tombent pas sur des entiers : la réserve est jugée au centième.
    const dies = opened.turn!.startedAt + DUEL_RESERVE_SECONDS + 0.01
    const timeout: DuelMove = { seq: 5, seat: opened.turn!.player, kind: 'timeout', payload: '', at: dies }
    const after = replay(setup, [...picks, timeout], judge)
    expect(after.facts.at(-1)?.kind).toBe('dead')
    expect(after.duel.phase).toBe('over')

    // Un temps écoulé déclaré trop tôt ne tue personne.
    const early = replay(setup, [...picks, { ...timeout, at: dies - 3 }], judge)
    expect(early.duel.deaths).toEqual([])
  })
})

describe('le meneur', () => {
  const bot: BotProfile = { id: 'maxitoon', think: [2, 4], answerChance: 1 }

  it('choisit pour le joueur maison quand il a fini de réfléchir, jamais avant', () => {
    let duel = startDuel(setup)
    const seat = duel.order[0]!
    const bots = { [seat]: { ...bot, id: duel.players[seat]!.id } }
    expect(driverMove(duel, null, draftOpens + 0.5, bots)).toBeNull()
    expect(driverMove(duel, null, draftOpens + 4, bots)).toMatchObject({ seat, kind: 'pick' })
    duel = replay(setup, [{ seq: 1, seat, kind: 'pick', payload: 'animaux', at: draftOpens + 4 }], null).duel
    expect(driverMove(duel, null, draftOpens + 5, bots)).toBeNull()
  })

  it('tranche le choix d’un joueur qui ne choisit pas, au bout de ses dix secondes', () => {
    const duel = startDuel(setup)
    expect(driverMove(duel, null, draftOpens + DUEL_PICK_SECONDS - 0.1, {})).toBeNull()
    expect(driverMove(duel, null, draftOpens + DUEL_PICK_SECONDS, {})).toMatchObject({ kind: 'pick' })
  })

  it('fait jouer le joueur maison à l’heure de son coup', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const seat = opened.turn!.player
    const bots = { [seat]: { ...bot, id: opened.players[seat]!.id } }
    expect(driverMove(opened, judge, opened.turn!.startedAt + 0.5, bots)).toBeNull()
    expect(driverMove(opened, judge, opened.turn!.startedAt + 4, bots)).toMatchObject({ seat, kind: 'word' })
  })

  it('ne déclare le temps écoulé d’un absent qu’après la marge', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const zero = opened.turn!.startedAt + DUEL_RESERVE_SECONDS
    expect(driverMove(opened, judge, zero, {})).toBeNull()
    expect(driverMove(opened, judge, zero + DUEL_GRACE_SECONDS + 0.01, {})).toMatchObject({ seat: opened.turn!.player, kind: 'timeout' })
  })

  it('attend la fin de la mise en scène d’une mort', () => {
    const three: DuelSetup = { ...setup, playerIds: ['me', 'maxitoon', 'terretciel'], owned: [5, 5, 5] }
    const moves: DuelMove[] = []
    let duel = startDuel(three)
    for (let seq = 1; duel.phase === 'draft' && seq < 10; seq++) {
      const seat = duel.order[duel.picks.length % duel.order.length]!
      moves.push({ seq, seat, kind: 'pick', payload: IDS.find((id) => !duel.picks.includes(id))!, at: draftOpens + seq })
      duel = replay(three, moves, judge).duel
    }
    duel = settle(duel, judge, 1e9)
    const dies = duel.turn!.startedAt + DUEL_RESERVE_SECONDS
    moves.push({ seq: moves.length + 1, seat: duel.turn!.player, kind: 'timeout', payload: '', at: dies })
    const after = replay(three, moves, judge).duel
    expect(after.turn!.startedAt).toBeCloseTo(dies + DUEL_DEATH_PAUSE_SECONDS)
    expect(reserveSeconds(after, after.turn!.player, dies + 1)).toBe(DUEL_RESERVE_SECONDS + DUEL_DEATH_BONUS_SECONDS)
    expect(driverMove(after, judge, dies + 1, {})).toBeNull()
  })
})
