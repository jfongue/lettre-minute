import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DUEL_PASS_PENALTY_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_RESERVE_SECONDS,
  DUEL_TIME_BONUS,
  reserveShown,
} from '../domain/duel'
import type { RarityTier } from '../domain/rarity'
import { capitalized, initialOf } from '../domain/text'
import { categoryText, useT, type Messages } from '../i18n'
import { sound } from '../lib/sound'
import { HOUSE_BOTS, type Seat } from '../state/duel'
import { Avatar } from './Avatar'
import { LetterMark, TierTag } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif, onTint } from './motifs'

/**
 * Les règles du duel, montrées en jouant : une partie entière — les places, le
 * draft, le tirage de l'ouvreur, puis la table avec ses passes, un mot trouvé
 * et deux morts — tient dans un cadre et se rejoue en boucle, accélérée. Il n'y
 * a pas de page à tourner : les vrais éléments du jeu défilent sous les yeux du
 * joueur, et chaque temps porte sa phrase sous l'image. Rien n'est cliquable,
 * le « Je joue » rend la main.
 */

/** Les temps du duel, dans l'ordre : la puce du haut les numérote. */
const SCENES = ['table', 'draft', 'opening', 'play'] as const
type Scene = (typeof SCENES)[number]

/** Le pool du draft, dans l'ordre où les tuiles tombent : je prends la première. */
const POOL = ['couleurs', 'pays', 'animaux', 'metiers', 'fruits-legumes'] as const
/** Qui prend chaque tuile : moi d'abord, puis les trois joueurs maison. */
const PICKERS = [0, 1, 2, 3]

/** Un fait de la table, ce que le fil du bas raconte. */
interface Fact {
  id: string
  kind: 'solved' | 'passed' | 'dead'
  player: number
  tier?: RarityTier
  delta?: number
}

/**
 * Une image de la partie : ce que l'écran montre pendant `ms`, puis l'image
 * suivante. Ce qu'une image ne dit pas garde ce que la précédente a posé.
 */
interface Frame {
  ms: number
  scene: Scene
  cue?:
    | 'seated'
    | 'ready'
    | 'announce'
    | 'pick'
    | 'draw'
    | 'spin'
    | 'land'
    | 'hand'
    | 'typed'
    | 'tick'
    | 'pass'
    | 'solve'
    | 'out'
    | 'win'
  seated?: number
  ready?: boolean
  picks?: number
  luck?: boolean
  turn?: number
  left?: number
  lit?: number
  opener?: number
  category?: string
  typed?: number
  holder?: number | null
  reserves?: readonly number[]
  dead?: readonly number[]
  chip?: { player: number; delta: number }
  facts?: readonly Fact[]
  card?: { fallen: number; champion?: number }
}

/**
 * Le scénario, image par image. Il n'est écrit qu'une fois : les heures, les
 * réserves et les faits du fil sont ceux qu'un vrai duel produirait, à la
 * vitesse d'une démonstration.
 */
function demoFrames(): Frame[] {
  const frames: Frame[] = []
  const facts: Fact[] = []
  const put = (one: Omit<Fact, 'id'>): void => {
    facts.push({ ...one, id: `fact-${facts.length}` })
  }
  /** Une image de la partie, avec le fil tel qu'il est à cet instant. */
  const on = (rest: Omit<Frame, 'scene' | 'facts'>): Frame => ({ scene: 'play', facts: [...facts], ...rest })

  // Le salon : les quatre places se remplissent, puis se déclarent prêtes.
  for (let seated = 1; seated <= 4; seated++) {
    frames.push({ ms: 420, scene: 'table', seated, cue: 'seated' })
  }
  frames.push({ ms: 900, scene: 'table', seated: 4, ready: true, cue: 'ready' })

  // Le draft : quatre choix à tour de rôle, la dernière catégorie au sort.
  const lefts = [6, 4.5, 7, 2.6]
  frames.push({ ms: 850, scene: 'draft', picks: 0, turn: 0, left: DUEL_PICK_SECONDS, cue: 'announce' })
  for (let picks = 1; picks <= PICKERS.length; picks++) {
    frames.push({
      ms: 620,
      scene: 'draft',
      picks,
      turn: picks % PICKERS.length,
      left: lefts[picks - 1]!,
      cue: 'pick',
    })
  }
  frames.push({ ms: 950, scene: 'draft', picks: PICKERS.length, luck: true, left: DUEL_PICK_SECONDS, cue: 'draw' })

  // Le tirage de l'ouvreur : la place s'allume tour à tour, puis reste sur lui.
  for (let lit = 0; lit < 4; lit++) {
    frames.push({ ms: 240, scene: 'opening', lit, cue: 'spin' })
  }
  frames.push({ ms: 1100, scene: 'opening', lit: 1, opener: 1, cue: 'land' })

  // La partie : le couple se hérite d'un tour à l'autre. Maxitoon passe,
  // Terretciel tombe à zéro, Demontoon passe à son tour, je trouve, et la
  // dernière place lâche — le duel est fini.
  const couple = { category: 'couleurs' }
  frames.push(on({ ms: 900, cue: 'hand', ...couple, holder: 1, typed: 0, reserves: [26, 27, 8, 24] }))

  put({ kind: 'passed', player: 1, delta: -DUEL_PASS_PENALTY_SECONDS })
  frames.push(
    on({
      ms: 1000,
      cue: 'pass',
      ...couple,
      holder: 1,
      typed: 0,
      reserves: [26, 22, 8, 24],
      chip: { player: 1, delta: -DUEL_PASS_PENALTY_SECONDS },
    }),
  )

  frames.push(on({ ms: 750, cue: 'hand', ...couple, holder: 2, typed: 0, reserves: [26, 22, 8, 24] }))
  frames.push(on({ ms: 900, cue: 'tick', ...couple, holder: 2, typed: 0, reserves: [26, 22, 2.4, 24] }))

  put({ kind: 'dead', player: 2 })
  frames.push(
    on({
      ms: 1800,
      cue: 'out',
      ...couple,
      holder: null,
      typed: 0,
      reserves: [27.5, 23.5, 0, 25.5],
      dead: [2],
      card: { fallen: 2 },
    }),
  )

  frames.push(on({ ms: 750, cue: 'hand', ...couple, holder: 3, typed: 0, reserves: [27.5, 23.5, 0, 25.5], dead: [2] }))

  put({ kind: 'passed', player: 3, delta: -DUEL_PASS_PENALTY_SECONDS })
  frames.push(
    on({
      ms: 1000,
      cue: 'pass',
      ...couple,
      holder: 3,
      typed: 0,
      reserves: [27.5, 18.5, 0, 25.5],
      dead: [2],
      chip: { player: 3, delta: -DUEL_PASS_PENALTY_SECONDS },
    }),
  )

  frames.push(on({ ms: 850, cue: 'hand', ...couple, holder: 0, typed: 0, reserves: [27.5, 18.5, 0, 25.5], dead: [2] }))
  frames.push(on({ ms: 300, cue: 'typed', ...couple, holder: 0, typed: 0.4, reserves: [27.2, 18.5, 0, 25.5], dead: [2] }))
  frames.push(on({ ms: 340, cue: 'typed', ...couple, holder: 0, typed: 1, reserves: [26.9, 18.5, 0, 25.5], dead: [2] }))

  put({ kind: 'solved', player: 0, tier: 'rare', delta: DUEL_TIME_BONUS.rare })
  frames.push(
    on({
      ms: 1200,
      cue: 'solve',
      ...couple,
      holder: 0,
      typed: 1,
      reserves: [26.9 + DUEL_TIME_BONUS.rare, 18.5, 0, 25.5],
      dead: [2],
      chip: { player: 0, delta: DUEL_TIME_BONUS.rare },
    }),
  )

  put({ kind: 'dead', player: 3 })
  frames.push(
    on({
      ms: 2600,
      cue: 'win',
      ...couple,
      holder: null,
      typed: 1,
      reserves: [DUEL_RESERVE_SECONDS, 20, 0, 0],
      dead: [2, 3],
      card: { fallen: 3, champion: 0 },
    }),
  )

  return frames
}

const FRAMES = demoFrames()

const nameOf = (seat: Seat, t: Messages, mine: boolean): string => (mine ? t.duel.you : seat.name)

/** Ce que le fil du bas dit d'un fait, dans la langue du joueur. */
function lineOf(t: Messages, fact: Fact, seat: Seat, answer: string): string {
  const mine = fact.player === 0
  switch (fact.kind) {
    case 'solved':
      return mine ? t.duel.feedYouSolved(answer) : t.duel.feedSolved(nameOf(seat, t, false), answer)
    case 'passed':
      return mine ? t.duel.feedYouPassed : t.duel.feedPassed(nameOf(seat, t, false))
    default:
      return mine ? t.duel.feedYouDead : t.duel.feedDead(nameOf(seat, t, false))
  }
}

/** Le salon : les places se remplissent, puis chacune se tamponne « Prêt ». */
function TableScene({ seats, frame }: { seats: readonly Seat[]; frame: Frame }) {
  const t = useT()
  const seated = frame.seated ?? seats.length
  return (
    <ol className="duel-seats">
      {seats.map((seat, index) => {
        const mine = index === 0
        const ready = !!frame.ready && index < seated
        const state = index >= seated ? 'empty' : ready ? 'ready' : 'seated'
        return (
          <li
            key={seat.id}
            className={`duel-seatcard duel-seatcard--${state}`}
            style={{ '--i': index } as CSSProperties}
          >
            <div className="duel-seatcard__button">
              <span className={`duel-seatcard__face${state === 'empty' ? ' duel-seatcard__face--empty' : ''}`}>
                {state === 'empty' ? null : <Avatar choice={seat.avatar} size="md" />}
              </span>
              <span className="duel-seatcard__text">
                <b>{state === 'empty' ? t.duel.emptySeat : nameOf(seat, t, mine)}</b>
                <small>{state === 'empty' ? ' ' : mine ? t.duel.you : seat.trait ? t.duel.trait[seat.trait] : ' '}</small>
              </span>
              <span className="duel-seatcard__stamp" key={state}>
                {state === 'empty' ? '' : ready ? t.duel.ready : t.duel.notReady}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Le draft : l'ordre des choix en tête, les catégories qui tombent dessous. */
function DraftScene({ seats, frame }: { seats: readonly Seat[]; frame: Frame }) {
  const t = useT()
  const picks = frame.picks ?? 0
  const luck = frame.luck ?? false
  const done = picks >= PICKERS.length
  const takenAt = (index: number): number | 'luck' | null =>
    index < PICKERS.length ? (index < picks ? PICKERS[index]! : null) : luck ? 'luck' : null
  const turn = frame.turn ?? 0
  const line = luck
    ? t.duel.drawing
    : done
      ? t.duel.draftDone
      : turn === 0
        ? t.duel.draftTitle
        : t.duel.draftTurn(nameOf(seats[turn]!, t, false))
  const left = frame.left ?? DUEL_PICK_SECONDS
  return (
    <div className="demo-draft">
      <ol className="duel-order">
        {PICKERS.map((_, slot) => {
          const taken = slot < picks ? POOL[slot]! : null
          const motif = taken ? categoryMotif(taken) : null
          const current = slot === picks && !done
          return (
            <li
              key={slot}
              className={`duel-order__slot${current ? ' duel-order__slot--now' : ''}${taken ? ' duel-order__slot--done' : ''}`}
              style={motif ? ({ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties) : undefined}
            >
              {taken && motif ? (
                <CategoryIcon categoryId={taken} tint={onTint(motif.tint)} className="duel-order__icon" />
              ) : (
                <Avatar choice={seats[PICKERS[slot]!]!.avatar} size="sm" />
              )}
            </li>
          )
        })}
        <li
          className={`duel-order__slot duel-order__slot--luck${luck ? ' duel-order__slot--done' : ''}`}
          style={
            luck
              ? ({
                  background: `var(--${categoryMotif(POOL[POOL.length - 1]!).tint})`,
                  color: `var(--${onTint(categoryMotif(POOL[POOL.length - 1]!).tint)})`,
                } as CSSProperties)
              : undefined
          }
        >
          {luck ? (
            <CategoryIcon
              categoryId={POOL[POOL.length - 1]!}
              tint={onTint(categoryMotif(POOL[POOL.length - 1]!).tint)}
              className="duel-order__icon"
            />
          ) : (
            <span>?</span>
          )}
        </li>
      </ol>

      <p className={`duel-turn${turn === 0 && !done ? ' duel-turn--mine' : ''}`} key={line}>
        {done ? null : <Avatar choice={seats[turn]!.avatar} size="sm" />}
        <b>{line}</b>
        {done ? null : <span className="duel-turn__left">{t.duel.pickLeft(Math.ceil(left))}</span>}
      </p>
      <span className={`duel-fuse${turn === 0 && !done ? ' duel-fuse--mine' : ''}${left <= 3 && !done ? ' duel-fuse--late' : ''}`} aria-hidden="true">
        <i style={{ transform: `scaleX(${done ? 0 : Math.max(0, Math.min(1, left / DUEL_PICK_SECONDS))})` } as CSSProperties} />
      </span>

      <ul className="demo-tiles">
        {POOL.map((id, index) => {
          const motif = categoryMotif(id)
          const taken = takenAt(index)
          return (
            <li
              key={id}
              className={`demo-tile${taken !== null ? ' demo-tile--taken' : ''}`}
              style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
            >
              <CategoryIcon categoryId={id} tint={onTint(motif.tint)} className="demo-tile__icon" />
              <span className="demo-tile__name">{categoryText(t, id).label}</span>
              {taken !== null ? (
                <span className="demo-tile__stamp" key={`${index}-${taken}`}>
                  {taken === 'luck' ? t.duel.drawn : <Avatar choice={seats[taken]!.avatar} size="sm" />}
                  {taken === 'luck' ? null : (
                    <span className="demo-tile__who">{nameOf(seats[taken]!, t, taken === 0)}</span>
                  )}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Le tirage : les cinq catégories prises, puis la place qui s'allume et reste. */
function OpeningScene({ seats, frame }: { seats: readonly Seat[]; frame: Frame }) {
  const t = useT()
  const landed = frame.opener !== undefined
  return (
    <div className="demo-opening">
      <ul className="duel-pool">
        {POOL.map((id, index) => {
          const tint = categoryMotif(id).tint
          return (
            <li
              key={id}
              style={{ '--i': index, background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}
            >
              <CategoryIcon categoryId={id} tint={onTint(tint)} className="duel-pool__icon" />
              <span>{categoryText(t, id).label}</span>
            </li>
          )
        })}
      </ul>
      <ol className="duel-wheel">
        {seats.map((seat, index) => (
          <li
            key={seat.id}
            className={`duel-wheel__seat${index === frame.lit ? ' duel-wheel__seat--lit' : ''}${landed && index === frame.opener ? ' duel-wheel__seat--chosen' : ''}${landed && index !== frame.opener ? ' duel-wheel__seat--rest' : ''}`}
          >
            <Avatar choice={seat.avatar} size="md" />
            <b>{nameOf(seat, t, index === 0)}</b>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** La table en tête d'écran : ma réserve en grand, celles des autres en barre. */
function DemoStrip({ seats, frame, tick }: { seats: readonly Seat[]; frame: Frame; tick: number }) {
  const t = useT()
  return (
    <ol className="duel-strip">
      {seats.map((seat, index) => {
        const mine = index === 0
        const dead = frame.dead?.includes(index) ?? false
        const active = frame.holder === index && !dead
        const seconds = frame.reserves?.[index] ?? DUEL_RESERVE_SECONDS
        const late = active && seconds <= 3
        const delta = frame.chip?.player === index ? frame.chip : null
        return (
          <li
            key={seat.id}
            className={`duel-seat${active ? ' duel-seat--active' : ''}${dead ? ' duel-seat--dead' : ''}${mine ? ' duel-seat--me' : ''}${late ? ' duel-seat--late' : ''}`}
          >
            <span className="duel-seat__face" key={active ? 'on' : 'off'}>
              <Avatar choice={seat.avatar} size="sm" />
              {dead ? (
                <span className="duel-seat__cross" aria-hidden="true">
                  ✕
                </span>
              ) : null}
            </span>
            {mine && !dead ? (
              <span className={`duel-seat__mine clock${late ? ' clock--late' : ''}`}>
                {reserveShown(seconds)}
                <span className="duel-seat__unit">s</span>
              </span>
            ) : (
              <span className="duel-seat__name">{nameOf(seat, t, mine)}</span>
            )}
            {!mine && !dead ? (
              <span className="duel-seat__secs">
                {reserveShown(seconds)}
                <span className="duel-seat__unit">s</span>
              </span>
            ) : null}
            <span className="duel-seat__bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.min(1, seconds / DUEL_RESERVE_SECONDS)})` } as CSSProperties} />
            </span>
            {dead ? <span className="duel-seat__clock">{t.duel.out}</span> : null}
            {delta ? (
              <span key={tick} className={`duel-seat__delta${delta.delta < 0 ? ' duel-seat__delta--loss' : ''}`}>
                {t.duel.seconds(delta.delta)}
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Le fil de la table : les trois derniers faits, le plus récent en tête. */
function DemoFeed({ seats, frame, answer }: { seats: readonly Seat[]; frame: Frame; answer: string }) {
  const t = useT()
  const facts = frame.facts ?? []
  return (
    <ol className="duel-feed">
      {facts
        .slice(-3)
        .reverse()
        .map((fact, rank) => {
          const seat = seats[fact.player]!
          return (
            <li
              key={fact.id}
              className={`duel-feed__line duel-feed__line--${fact.kind}`}
              style={{ '--rank': rank } as CSSProperties}
            >
              {fact.kind === 'dead' ? null : <Avatar choice={seat.avatar} size="sm" />}
              <span className="duel-feed__text">{lineOf(t, fact, seat, answer)}</span>
              {fact.kind === 'solved' && fact.tier ? <TierTag tier={fact.tier} /> : null}
              {fact.delta ? (
                <em className={`duel-feed__delta${fact.delta < 0 ? ' duel-feed__delta--loss' : ''}`}>
                  {t.duel.seconds(fact.delta)}
                </em>
              ) : null}
            </li>
          )
        })}
    </ol>
  )
}

/** La partie : le couple, le mot qui s'écrit, le temps qui va et qui vient. */
function PlayScene({
  seats,
  frame,
  answer,
  tick,
}: {
  seats: readonly Seat[]
  frame: Frame
  answer: string
  tick: number
}) {
  const t = useT()
  const holder = frame.holder ?? 0
  const mine = frame.holder === 0
  const letter = initialOf(answer)
  const typed = answer.slice(0, Math.max(1, Math.round(answer.length * (frame.typed ?? 0))))
  const solved = frame.cue === 'solve'
  const category = frame.category ?? POOL[0]
  const categoryCopy = categoryText(t, category)
  const card = frame.card
  return (
    <div className="demo-play">
      <DemoStrip seats={seats} frame={frame} tick={tick} />
      <DemoFeed seats={seats} frame={frame} answer={answer} />

      <div className="demo-board">
        {card ? (
          <div className="demo-death">
            <div className="duel-death__card">
              <span className="duel-death__face">
                <Avatar choice={seats[card.fallen]!.avatar} size="lg" />
                <span className="duel-death__cross" aria-hidden="true">
                  ✕
                </span>
              </span>
              <p className="duel-death__word">{t.duel.out}</p>
              <b className="duel-death__name">{nameOf(seats[card.fallen]!, t, card.fallen === 0)}</b>
              {card.champion === undefined ? (
                <p className="note">{t.duel.standing(seats.filter((_, index) => !frame.dead?.includes(index)).length)}</p>
              ) : (
                <p className="duel-death__winner">
                  <Avatar choice={seats[card.champion]!.avatar} size="sm" />
                  {card.champion === 0 ? t.duel.youWin : t.duel.overTitle(nameOf(seats[card.champion]!, t, false))}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="duel-board">
              <p className={`duel-face${mine ? ' duel-face--mine' : ' duel-face--watching'}`} key={`face-${holder}`}>
                {mine ? (
                  <span className="duel-face__dot" aria-hidden="true" />
                ) : (
                  <Avatar choice={seats[holder]!.avatar} size="sm" />
                )}
                <b>{mine ? t.duel.yourTurn : t.duel.watching(nameOf(seats[holder]!, t, false))}</b>
              </p>

              <section className="prompt duel-prompt" key={`prompt-${category}`}>
                <span className="duel-prompt__mark">
                  <LetterMark letter={letter} motif={categoryMotif(category)} size="md" />
                </span>
                <div className="prompt-text">
                  <h2 className="prompt-label">{categoryCopy.label}</h2>
                  <p className="note">{categoryCopy.hint}</p>
                </div>
              </section>
            </div>

            <div className={`answer${solved ? ' answer--valid' : ''}`}>
              <div className="answer-field demo-field">
                <span className="demo-typed">{typed}</span>
                {solved ? null : <span className="demo-caret" aria-hidden="true" />}
              </div>
              <p className={`verdict${solved ? ' verdict--valid' : ''}`}>
                {solved ? `✓ ${answer}` : typed === '' ? (mine ? t.duel.yourTurnHint : t.duel.inherited) : t.run.unknown}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Ce que le cadre dit sous ses images, selon le temps qui joue. */
function copyFor(t: Messages, frame: Frame, opener: string): { title: string; text: string } {
  switch (frame.scene) {
    case 'table':
      return t.duel.tutorial.seats
    case 'draft':
      return t.duel.tutorial.draft
    case 'opening':
      return { title: frame.opener === undefined ? t.duel.whoOpens : t.duel.opens(opener), text: t.duel.opensNote }
    default:
      return t.duel.tutorial.play
  }
}

interface DuelTutorialProps {
  /** Ma place, telle que le salon la pose : mon avatar vient de l'appareil. */
  me: Seat
  /** Le tuto refermé : les règles sont lues, la partie peut commencer. */
  onDone(): void
}

/**
 * Les règles du duel : une partie accélérée qui se rejoue toute seule, avec les
 * vrais éléments du jeu. Le salon la rouvre par « Revoir les règles ».
 */
export function DuelTutorial({ me, onDone }: DuelTutorialProps) {
  const t = useT()
  const [step, setStep] = useState(0)
  const frame = FRAMES[step] ?? FRAMES[0]!
  const seats: readonly Seat[] = [
    { id: me.id, name: me.name, avatar: me.avatar, bot: false, owned: 7, ready: true },
    ...HOUSE_BOTS.map((bot) => ({
      id: bot.id,
      name: bot.name,
      avatar: bot.avatar,
      bot: true,
      trait: bot.trait,
      owned: 7,
      ready: true,
    })),
  ]
  const answer = capitalized(t.colours.rouge ?? '')
  const opener = nameOf(seats[1]!, t, false)

  // Chaque image tient son temps : la partie s'enchaîne toute seule et
  // recommence à la dernière mort.
  useEffect(() => {
    const timer = setTimeout(() => setStep((current) => (current + 1) % FRAMES.length), frame.ms)
    return () => clearTimeout(timer)
  }, [frame])

  // Un temps qui arrive s'entend, une fois : le bruit du geste qu'il montre.
  const heard = useRef(-1)
  useEffect(() => {
    if (heard.current === step) return
    heard.current = step
    switch (frame.cue) {
      case 'seated':
        sound.tile('marimba', 2 + (frame.seated ?? 0))
        break
      case 'ready':
        sound.go()
        break
      case 'announce':
        sound.pop()
        break
      case 'pick':
        sound.tile('glass', 2 + (frame.picks ?? 0))
        break
      case 'draw':
        sound.tile('wood', 4)
        break
      case 'spin':
        sound.tile('wood', frame.lit ?? 0)
        break
      case 'land':
        sound.news()
        break
      case 'hand':
        sound.tile('glass', 4)
        break
      case 'typed':
        sound.key()
        break
      case 'tick':
        sound.tick(3)
        break
      case 'pass':
        sound.skipped()
        break
      case 'solve':
        sound.recognized()
        break
      case 'out':
        sound.timeUp()
        break
      case 'win':
        sound.crowned(true)
        break
      default:
        break
    }
  }, [frame, step])

  const done = () => {
    sound.go()
    onDone()
  }

  const scene = SCENES.indexOf(frame.scene) + 1
  const caption = copyFor(t, frame, opener)
  return (
    <div className="sheet duel-rules">
      <div className="spread">
        <p className="eyebrow">
          {t.duel.tutorial.label} · {t.duel.tutorial.stepLabel(scene, SCENES.length)}
        </p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={done}>
          {t.duel.tutorial.skip}
        </button>
      </div>

      <div className="demo-stage" key={frame.scene} aria-hidden="true">
        {frame.scene === 'table' ? (
          <TableScene seats={seats} frame={frame} />
        ) : frame.scene === 'draft' ? (
          <DraftScene seats={seats} frame={frame} />
        ) : frame.scene === 'opening' ? (
          <OpeningScene seats={seats} frame={frame} />
        ) : (
          <PlayScene seats={seats} frame={frame} answer={answer} tick={step} />
        )}
      </div>

      <span className="demo-track" aria-hidden="true">
        <i
          style={
            { transform: `scaleX(${(step + 1) / FRAMES.length})`, transitionDuration: `${frame.ms}ms` } as CSSProperties
          }
        />
      </span>

      <h1 className="duel-title" key={`title-${caption.title}`}>
        {caption.title}
      </h1>
      <p className="note rules-text" key={`text-${frame.scene}`}>
        {caption.text}
      </p>

      <button type="button" className="btn btn--play btn--block duel-cta" onClick={done}>
        {t.duel.tutorial.start}
      </button>
    </div>
  )
}
