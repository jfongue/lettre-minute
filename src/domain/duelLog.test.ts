import { describe, expect, it } from 'vitest'
import { NO_USAGE } from './rarity'
import { buildWordPack, commonWord, findWord, lettersWithEnough, type WordPack } from './words'
import type { Judge } from './run'
import {
  draftPlayer,
  duelRanking,
  duelPrompt,
  pickDeadline,
  reserveSeconds,
  DUEL_DEATH_BONUS_SECONDS,
  DUEL_DEATH_PAUSE_SECONDS,
  DUEL_GRACE_SECONDS,
  DUEL_OPENING_SECONDS,
  DUEL_PASS_PENALTY_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_RESERVE_SECONDS,
  type BotProfile,
  type Duel,
} from './duel'
import { driverMove, driverOf, mergeJournal, postMove, replay, settle, startDuel, DUEL_ANNOUNCE_SECONDS, DUEL_POST_TRIES, type DuelMove, type DuelPostOutcome, type DuelPoster, type DuelSetup } from './duelLog'

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

  it('saute un temps écoulé arrivé en plein draft au lieu de s’y figer', () => {
    // Le journal d'une revanche ouvert par le « temps écoulé » de la partie
    // d'avant, resté dans la file d'envoi : les choix qui suivent comptent.
    const stray: DuelMove = { seq: 1, seat: 0, kind: 'timeout', payload: '', at: draftOpens + 0.5 }
    const picks = draftMoves().map((move) => ({ ...move, seq: move.seq + 1 }))
    for (const dictionaries of [null, judge]) {
      const done = replay(setup, [stray, ...picks], dictionaries)
      expect(done.duel.picks).toEqual(replay(setup, draftMoves(), dictionaries).duel.picks)
      expect(done.applied).toBe(5)
    }
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

  it('ne paie pas un passe que la réserve ne couvre pas : la main reste', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const short: DuelMove = { seq: 5, seat: opened.turn!.player, kind: 'pass', payload: '', at: opened.turn!.startedAt + DUEL_RESERVE_SECONDS - 2 }
    const after = replay(setup, [...picks, short], judge)
    expect(after.duel).toEqual(replay(setup, picks, judge).duel)
    expect(after.facts.some((fact) => fact.kind === 'passed')).toBe(false)
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

describe('les mots trouvés pendant le tour d’un autre', () => {
  function opened() {
    const picks = draftMoves()
    const duel = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const holder = duel.turn!.player
    return { picks, duel, holder, watcher: 1 - holder, at: duel.turn!.startedAt }
  }
  const word = (duel: Duel, n: number) => `${duelPrompt(duel)!.letter}${duelPrompt(duel)!.categoryId}${n}`

  it('rend une seconde au premier, une demi ensuite, sans toucher au tour de l’autre', () => {
    const { picks, duel, holder, watcher, at } = opened()
    const echoes: DuelMove[] = [1, 2].map((n, i) => ({ seq: 5 + i, seat: watcher, kind: 'echo', payload: word(duel, n), at: at + 2 + i }))
    const after = replay(setup, [...picks, ...echoes], judge)
    expect(after.duel.players[watcher]!.reserve).toBe(DUEL_RESERVE_SECONDS + 1.5)
    expect(after.duel.turn!.player).toBe(holder)
    expect(after.duel.dealt).toEqual(duel.dealt)
    expect(after.facts.filter((fact) => fact.kind === 'echoed').map((fact) => fact.delta)).toEqual([1, 0.5])
  })

  it('ne compte ni un mot déjà trouvé, ni plus de trois par tour, ni celui qui a la main', () => {
    const { picks, duel, holder, watcher, at } = opened()
    const moves: DuelMove[] = [1, 1, 2, 3, 4].map((n, i) => ({ seq: 5 + i, seat: watcher, kind: 'echo', payload: word(duel, n), at: at + 1 + i * 0.2 }))
    const own: DuelMove = { seq: 10, seat: holder, kind: 'echo', payload: word(duel, 5), at: at + 3 }
    const after = replay(setup, [...picks, ...moves, own], judge)
    expect(after.duel.players[watcher]!.reserve).toBe(DUEL_RESERVE_SECONDS + 1 + 0.5 + 0.5)
    expect(after.duel.players[holder]!.reserve).toBe(DUEL_RESERVE_SECONDS)
  })

  it('repart à une seconde au tour suivant, et le mot ne se rejoue plus', () => {
    const { picks, duel, holder, watcher, at } = opened()
    const echo: DuelMove = { seq: 5, seat: watcher, kind: 'echo', payload: word(duel, 1), at: at + 1 }
    const solve: DuelMove = { seq: 6, seat: holder, kind: 'word', payload: word(duel, 2), at: at + 2 }
    const mid = replay(setup, [...picks, echo, solve], judge)
    expect(mid.duel.turn!.player).toBe(watcher)
    expect(mid.duel.turn!.echoes).toEqual([])
    const back: DuelMove = { seq: 7, seat: holder, kind: 'echo', payload: word(mid.duel, 3), at: mid.duel.turn!.startedAt + 1 }
    expect(replay(setup, [...picks, echo, solve, back], judge).facts.at(-1)).toMatchObject({ kind: 'echoed', delta: 1 })
  })
})

describe('l’abandon', () => {
  const trio: DuelSetup = { ...setup, playerIds: ['me', 'ondine', 'maxitoon'], owned: [5, 5, 5] }

  it('finit la partie à deux, dès le draft et sans dictionnaires', () => {
    const resign: DuelMove = { seq: 1, seat: 1, kind: 'resign', payload: '', at: draftOpens + 2 }
    const done = replay(setup, [resign], null)
    expect(done.applied).toBe(1)
    expect(done.duel.phase).toBe('over')
    expect(duelRanking(done.duel)).toEqual([0, 1])
    expect(done.facts).toEqual([{ id: '1:dead', kind: 'dead', player: 1, at: draftOpens + 2, resigned: true }])
  })

  it('tue à son tour comme une mort, et la main repart après la mise en scène', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const seat = opened.turn!.player
    const resign: DuelMove = { seq: 5, seat, kind: 'resign', payload: '', at: opened.turn!.startedAt + 3 }
    const after = replay(setup, [...picks, resign], judge)
    expect(after.duel.phase).toBe('over')
    expect(duelRanking(after.duel)[0]).toBe(1 - seat)
  })

  it('hors de son tour, laisse jouer celui qui a la main', () => {
    const picks: DuelMove[] = []
    let current = startDuel(trio)
    for (let seq = 1; seq <= 3; seq++) {
      const seat = current.order[current.picks.length % current.order.length]!
      picks.push({ seq, seat, kind: 'pick', payload: IDS.find((id) => !current.picks.includes(id))!, at: draftOpens + seq })
      current = replay(trio, picks, null).duel
    }
    const opened = settle(current, judge, 1e9)
    const other = [0, 1, 2].find((index) => index !== opened.turn!.player)!
    const resign: DuelMove = { seq: 4, seat: other, kind: 'resign', payload: '', at: opened.turn!.startedAt + 2 }
    const after = replay(trio, [...picks, resign], judge)
    expect(after.duel.phase).toBe('play')
    expect(after.duel.turn!.player).toBe(opened.turn!.player)
    expect(after.duel.players[other]!.alive).toBe(false)
    // Un second abandon ne tue pas deux fois.
    const twice = replay(trio, [...picks, resign, { ...resign, seq: 5 }], judge)
    expect(twice.duel.deaths).toEqual([other])
  })

  it('fait choisir d’office, tout de suite, celui qui a abandonné au draft', () => {
    const duel = startDuel(trio)
    const seat = duel.order[0]!
    const gone = replay(trio, [{ seq: 1, seat, kind: 'resign', payload: '', at: draftOpens + 1 }], null).duel
    expect(gone.phase).toBe('draft')
    expect(driverMove(gone, null, draftOpens + 1.2, {})).toMatchObject({ seat, kind: 'pick' })
  })
})

describe('le meneur', () => {
  const bot: BotProfile = { id: 'maxitoon', think: [2, 4], answerChance: 1 }

  it('choisit pour le joueur ordinateur quand il a fini de réfléchir, jamais avant', () => {
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

  it('fait jouer le joueur ordinateur à l’heure de son coup', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const seat = opened.turn!.player
    const bots = { [seat]: { ...bot, id: opened.players[seat]!.id } }
    expect(driverMove(opened, judge, opened.turn!.startedAt + 0.5, bots)).toBeNull()
    expect(driverMove(opened, judge, opened.turn!.startedAt + 4, bots)).toMatchObject({ seat, kind: 'word' })
  })

  it('n’annonce pas un passe que le joueur ordinateur ne peut pas payer : il meurt à zéro', () => {
    const picks = draftMoves()
    const opened = settle(replay(setup, picks, judge).duel, judge, 1e9)
    const seat = opened.turn!.player
    // Le robot hérite d'une réserve sous la pénalité, et ne trouvera rien.
    const thin: Duel = { ...opened, players: opened.players.map((player, index) => (index === seat ? { ...player, reserve: DUEL_PASS_PENALTY_SECONDS - 1 } : player)) }
    const bots = { [seat]: { ...bot, id: thin.players[seat]!.id, answerChance: 0 } }
    expect(driverMove(thin, judge, thin.turn!.startedAt + 4.5, bots)).toBeNull()
    const zero = thin.turn!.startedAt + DUEL_PASS_PENALTY_SECONDS - 1
    expect(driverMove(thin, judge, zero + DUEL_GRACE_SECONDS + 0.01, bots)).toMatchObject({ seat, kind: 'timeout' })
  })

  it('finit un duel entre deux joueurs ordinateur', () => {
    const duo: DuelSetup = { ...setup, playerIds: ['maxitoon', 'terretciel'], owned: [5, 5] }
    const bots = { 0: { ...bot, id: 'maxitoon' }, 1: { ...bot, id: 'terretciel' } }
    const moves: DuelMove[] = []
    let duel = startDuel(duo)
    for (let at = draftOpens; duel.phase !== 'over' && at < 600; at += 0.5) {
      duel = settle(replay(duo, moves, judge).duel, judge, at)
      const due = driverMove(duel, judge, at, bots)
      if (due) moves.push({ ...due, seq: moves.length + 1, at })
    }

    expect(duel.phase).toBe('over')
    expect(moves.length).toBeLessThan(120)
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

describe('le meneur', () => {
  const seat = (id: string, extra: Partial<{ bot: boolean; gone: boolean; seen: number }> = {}) => ({
    id,
    bot: false,
    gone: false,
    seen: 100,
    ...extra,
  })
  const mine = { id: 'a', hidden: false }

  it('est le premier présent dans l’ordre des places', () => {
    expect(driverOf([seat('a'), seat('b')], 100, mine)).toBe('a')
  })

  it('passe au suivant quand le meneur quitte la table', () => {
    expect(driverOf([seat('a', { gone: true }), seat('b')], 100, mine)).toBe('b')
  })

  it('passe au suivant quand le meneur se tait plus de huit secondes', () => {
    expect(driverOf([seat('a', { seen: 91 }), seat('b')], 100, mine)).toBe('b')
  })

  it('saute les joueurs ordinateur', () => {
    expect(driverOf([seat('bot', { bot: true }), seat('b')], 100, mine)).toBe('b')
  })

  it('laisse ma main quand mon onglet est caché', () => {
    expect(driverOf([seat('a'), seat('b')], 100, { id: 'a', hidden: true })).toBe('b')
    expect(driverOf([seat('a'), seat('b')], 100, { id: 'b', hidden: true })).toBe('a')
  })

  it('ne mène personne quand la table est vide de joueurs présents', () => {
    expect(driverOf([seat('a', { gone: true }), seat('b', { seen: 0 })], 100, mine)).toBeNull()
    expect(driverOf([], 100, mine)).toBeNull()
  })
})

describe('l’envoi d’un coup', () => {
  const mine = { seat: 0, kind: 'word', payload: 'Aanimaux0' } as const

  /** Un serveur de carton : le journal qu’il tient, les réponses qu’il donne, ce que sa relecture ajoute. */
  function serverOf(answers: readonly string[], grow: readonly DuelMove[] = []) {
    const journal: DuelMove[] = []
    const posted: DuelMove[] = []
    let reads = 0
    const poster: DuelPoster = {
      lastSeq: () => journal.reduce((max, move) => Math.max(max, move.seq), 0),
      movesAfter: (seq) => journal.filter((move) => move.seq > seq),
      post: async (move) => {
        posted.push(move)
        // La dernière réponse vaut pour les essais suivants : un serveur qui dit
        // « stale » le dit tant que le numéro reste pris.
        return (answers[Math.min(posted.length, answers.length) - 1] ?? 'ok') as DuelPostOutcome
      },
      read: async () => {
        reads += 1
        journal.push(...grow)
      },
    }
    return { poster, posted, reads: () => reads }
  }

  it('renvoie le coup au numéro suivant quand un autre a pris le sien', async () => {
    const other: DuelMove = { seq: 1, seat: 1, kind: 'pick', payload: 'pays', at: 4 }
    const { poster, posted, reads } = serverOf(['stale', 'ok'], [other])
    const done = await postMove(poster, { move: mine, mark: 0 })
    expect(done).toEqual({ outcome: 'ok', seq: 2 })
    expect(posted.map((move) => move.seq)).toEqual([1, 2])
    expect(reads()).toBe(1)
  })

  it('ne rejoue pas un coup dont la réponse s’est perdue', async () => {
    const inscribed: DuelMove = { ...mine, seq: 1, at: 7 }
    const { poster, posted } = serverOf(['unreachable'], [inscribed])
    const done = await postMove(poster, { move: mine, mark: 0 })
    expect(done).toEqual({ outcome: 'ok', seq: 1 })
    expect(posted).toHaveLength(1)
  })

  it('laisse le coup à l’appelant quand la table est injoignable', async () => {
    const { poster, posted } = serverOf(['unreachable'])
    const done = await postMove(poster, { move: mine, mark: 0 })
    expect(done.outcome).toBe('unreachable')
    expect(posted).toHaveLength(1)
  })

  it('renonce après quelques essais sur un numéro toujours pris', async () => {
    const { poster, posted } = serverOf(['stale'])
    const done = await postMove(poster, { move: mine, mark: 0 })
    expect(done.outcome).toBe('stale')
    expect(posted).toHaveLength(DUEL_POST_TRIES)
  })

  it('ne renvoie ni un coup refusé ni un coup dans une table fermée', async () => {
    for (const outcome of ['forbidden', 'closed'] as const) {
      const { poster, posted, reads } = serverOf([outcome])
      expect((await postMove(poster, { move: mine, mark: 0 })).outcome).toBe(outcome)
      expect(posted).toHaveLength(1)
      expect(reads()).toBe(0)
    }
  })
})

describe('le journal relu', () => {
  const one: DuelMove = { seq: 1, seat: 0, kind: 'pick', payload: 'pays', at: 4 }
  const two: DuelMove = { seq: 2, seat: 1, kind: 'pick', payload: 'animaux', at: 5 }
  const three: DuelMove = { seq: 3, seat: 0, kind: 'word', payload: 'Aanimaux0', at: 9 }

  it('garde la même référence quand la relecture n’apprend rien', () => {
    const moves = [one, two]
    expect(mergeJournal({ id: 't', moves }, { id: 't', moves: [...moves] }).moves).toBe(moves)
  })

  it('ajoute les coups nouveaux à la suite, sans doublon de numéro', () => {
    const merged = mergeJournal({ id: 't', moves: [one] }, { id: 't', moves: [two, three, one] })
    expect(merged.moves.map((move) => move.seq)).toEqual([1, 2, 3])
  })

  it('repart de zéro sur une autre table', () => {
    const merged = mergeJournal({ id: 'a', moves: [one, two] }, { id: 'b', moves: [one] })
    expect(merged).toEqual({ id: 'b', moves: [one] })
  })
})
