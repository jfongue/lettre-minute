import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  BEAT_SECONDS,
  BEATS,
  MAX_TABLE,
  OPENING_LAND_SECONDS,
  OPENING_SPIN_SECONDS,
  useDuelTable,
  type Candidate,
  type DuelExit,
  type DuelMode,
  type DuelTable,
  type Seat,
} from '../state/duel'
import {
  DUEL_PASS_PENALTY_SECONDS,
  DUEL_PICK_SECONDS,
  DUEL_RESERVE_SECONDS,
  draftShape,
  duelRanking,
  reserveSeconds,
  reserveShown,
  timeGained,
  type Duel,
} from '../domain/duel'
import type { DuelFact } from '../domain/duelLog'
import type { Verdict } from '../domain/run'
import { categoryText, useT } from '../i18n'
import { capitalized } from '../domain/text'
import { armSound, sound, tierSound } from '../lib/sound'
import { Avatar } from './Avatar'
import { Burst, LetterMark, Shape, TierTag } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif, onTint, type Motif } from './motifs'
import { reducedMotion } from './useCountUp'
import { useLongPress } from './useLongPress'
import { DuelTutorial } from './DuelTutorial'
import { loadDuelRulesSeen, saveDuelRulesSeen } from '../state/storage'
// Le duel ne charge ses styles qu'avec son écran : l'accueil n'en paie rien.
import '../duel.css'

/**
 * L'écran du duel : le salon, le draft, le tirage de l'ouvreur, la partie et
 * son bilan. Il reprend les écrans et les classes du mode solo — `.stage`,
 * `.sheet`, `.run`, `.answer`, `.verdict`, `.dealt`, `.countdown-beat` — et
 * n'ajoute que ce que le multijoueur demande : les places, le fil de la table
 * et la mise en scène des morts. Le temps est la seule monnaie du duel : aucun
 * point n'est affiché.
 */

/** Sous ce reste, la réserve de celui qui répond bat en rouge. */
const LOW_SECONDS = 3
/** Le temps que la main reprise après une mort s'annonce. */
const RESUME_FLASH_MS = 1100

const BEAT_MOTIFS: Record<number, Motif> = {
  3: { kind: 'circle', tint: 'red' },
  2: { kind: 'square', tint: 'blue' },
  1: { kind: 'arch', tint: 'yellow' },
}

const nameOf = (seat: Seat | Candidate | undefined, you: string, mine = false): string => (mine || !seat ? you : seat.name)

/** La réserve à afficher : jamais négative. */
const reserveOf = (duel: Duel, index: number, at: number): number => Math.max(0, reserveSeconds(duel, index, at))

/* ------------------------------------------------------------- le salon - */

/**
 * Le salon, en un écran : les quatre places de la table, les joueurs qu'on peut
 * y inviter, le bouton « prêt », puis l'annonce du draft au même endroit.
 * L'hôte retire quelqu'un par un appui long sur sa place, jamais d'une touche :
 * un geste qui renvoie un ami chez lui ne se fait pas par mégarde.
 */
function Lobby({ table, onRules }: { table: DuelTable; onRules(): void }) {
  const t = useT()
  const counting = table.phase === 'announcing'
  const me = table.seats[table.myIndex]
  const locked = !!me?.ready || counting
  const [kicking, setKicking] = useState<Seat | null>(null)
  const shape = draftShape(table.seats.filter((seat) => !seat.pending).length, table.pool.length)
  const left = table.leavers.map((id) => id.charAt(0).toUpperCase() + id.slice(1))
  const press = useLongPress<Seat>((seat) => {
    if (!table.host || locked || seat.id === me?.id) return
    sound.pop()
    setKicking(seat)
  })

  // Une place qui se déclare prête s'entend, chacune sur sa note.
  const readyCount = table.seats.filter((seat) => seat.ready).length
  const heard = useRef(readyCount)
  useEffect(() => {
    if (readyCount > heard.current) sound.tile('marimba', 2 + readyCount)
    heard.current = readyCount
  }, [readyCount])

  useEffect(() => {
    if (counting) sound.pop()
  }, [counting])

  const slots = Array.from({ length: MAX_TABLE }, (_, index) => table.seats[index] ?? null)
  const full = table.seats.length >= MAX_TABLE

  return (
    <main className="stage stage--duel">
      <Cut table={table} />
      <div className="sheet duel-lobby">
        <p className="eyebrow">{table.rematchOpen ? t.duel.revenging : t.duel.title}</p>
        <h1 className="duel-title" key={counting ? 'draft' : 'table'}>
          {counting ? t.duel.announceTitle : table.rematchOpen ? t.duel.rematchTitle : t.duel.leadTitle}
        </h1>
        {counting || table.rematchOpen ? (
          <p className="note duel-lead" key={counting ? 'rule' : 'lead'}>
            {counting ? t.duel.draftRule(shape.picks, shape.drawn) : t.duel.rematchLead}
          </p>
        ) : null}
        {counting ? (
          <span className="duel-fuse duel-fuse--announce" aria-hidden="true">
            <i />
          </span>
        ) : null}

        <ul className="duel-seats" aria-label={t.duel.table}>
          {slots.map((seat, index) => {
            if (!seat) {
              return (
                <li key={`empty-${index}`} className="duel-seatcard duel-seatcard--empty" style={{ '--i': index } as CSSProperties}>
                  <div className="duel-seatcard__button">
                    <span className="duel-seatcard__face duel-seatcard__face--empty" aria-hidden="true" />
                    <span className="duel-seatcard__text">
                      <b>{t.duel.emptySeat}</b>
                    </span>
                  </div>
                </li>
              )
            }
            const mine = index === table.myIndex
            const state = seat.ready ? 'ready' : seat.pending ? 'pending' : 'seated'
            const stamp = seat.ready ? t.duel.ready : seat.pending ? t.duel.pendingStamp : seat.bot ? t.duel.invited : t.duel.notReady
            const kickable = table.host && !locked && !mine
            return (
              <li
                key={seat.id}
                className={`duel-seatcard duel-seatcard--${state}${kickable ? ' duel-seatcard--kickable' : ''}`}
                style={{ '--i': index } as CSSProperties}
                {...(kickable ? press(seat) : {})}
              >
                <div className="duel-seatcard__button">
                  <span className="duel-seatcard__face">
                    <Avatar choice={seat.avatar} size="md" />
                  </span>
                  <span className="duel-seatcard__text">
                    <b>{mine ? seat.name || t.duel.you : seat.name}</b>
                    <small>{seat.bot && seat.trait ? t.duel.trait[seat.trait] : mine ? t.duel.you : table.mode === 'online' && index === 0 ? t.duel.hostStamp : ' '}</small>
                  </span>
                  <span className="duel-seatcard__stamp" key={stamp}>
                    {stamp}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="note duel-hint" aria-live="polite">
          {left.length > 0 ? t.duel.left(left.join(', '), left.length) : table.host && !locked && table.seats.length > 1 ? t.duel.kickHint : ' '}
        </p>

        {table.host && !locked && !full ? <InviteList table={table} /> : null}

        {table.pool.length === 0 ? (
          <p className="note note--warn">{t.duel.loadFailed}</p>
        ) : counting ? null : (
          <div className="stack">
            <button
              type="button"
              className="btn btn--play btn--block duel-cta"
              disabled={locked || table.seats.filter((seat) => !seat.pending).length < 2}
              onClick={() => {
                armSound()
                sound.go()
                table.markReady()
              }}
            >
              <span>{locked ? t.duel.waitingOthers : t.duel.readyButton}</span>
              {locked ? null : <small>{t.duel.tableSize(table.seats.filter((seat) => !seat.pending).length)}</small>}
            </button>
            {locked ? (
              <button type="button" className="btn btn--ghost btn--block" onClick={() => table.unready()}>
                {t.duel.cancel}
              </button>
            ) : null}
            {!locked && table.mode === 'local' && table.rematchOpen ? (
              <button type="button" className="btn btn--ghost btn--block" onClick={() => table.backToRecap()}>
                {t.duel.back}
              </button>
            ) : null}
            {!locked && (table.mode === 'online' || table.rematchOpen || table.embedded) ? (
              <button type="button" className="btn btn--quiet btn--block" onClick={() => table.leave()}>
                {t.duel.quit}
              </button>
            ) : null}
            {locked ? null : (
              <button
                type="button"
                className="btn btn--quiet btn--block"
                onClick={() => {
                  armSound()
                  onRules()
                }}
              >
                {t.duel.tutorial.again}
              </button>
            )}
          </div>
        )}
      </div>

      {kicking ? (
        <div className="duel-sheet" role="dialog" aria-label={t.duel.kick(kicking.name)} onClick={() => setKicking(null)}>
          <div className="duel-sheet__card" onClick={(event) => event.stopPropagation()}>
            <span className="duel-sheet__face">
              <Avatar choice={kicking.avatar} size="md" />
            </span>
            <b>{kicking.name}</b>
            <button
              type="button"
              className="btn btn--block duel-kick"
              onClick={() => {
                armSound()
                sound.refused()
                table.kick(kicking.id)
                setKicking(null)
              }}
            >
              {kicking.pending ? t.duel.kickInvite : t.duel.kick(kicking.name)}
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setKicking(null)}>
              {t.duel.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

/** Qui l'hôte peut asseoir à sa table : les joueurs maison, et ses amis en ligne. */
function InviteList({ table }: { table: DuelTable }) {
  const t = useT()
  return (
    <section className="duel-invite">
      <p className="eyebrow">{t.duel.inviteTitle}</p>
      {table.candidates.length === 0 ? (
        <p className="note">{t.duel.inviteEmpty}</p>
      ) : (
        <ul className="duel-invite__list">
          {table.candidates.map((candidate, index) => (
            <li key={candidate.id} style={{ '--i': index } as CSSProperties}>
              <button
                type="button"
                className="duel-invite__row"
                onClick={() => {
                  armSound()
                  sound.tile('marimba', 5)
                  table.invite(candidate.id)
                }}
              >
                <Avatar choice={candidate.avatar} size="sm" />
                <span className="duel-invite__name">
                  <b>{candidate.name}</b>
                  <small>{candidate.bot && candidate.trait ? t.duel.trait[candidate.trait] : candidate.bot ? t.duel.houseBot : t.duel.friend}</small>
                </span>
                <span className="duel-invite__plus" aria-hidden="true">
                  +
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* -------------------------------------------------------------- le draft - */

/** Le draft : l'ordre des choix en tête, puis une tuile par catégorie jouable. */
export function Draft({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const picker = table.picker
  const mine = table.myPickTurn
  const { chosen: total, drawn } = draftShape(duel.players.length, duel.categories.length)
  const done = !picker
  // Ce que l'écran a déjà posé : les choix des joueurs, puis les catégories que
  // le sort a posées une à une — celles qui restent ne sont pas encore tombées.
  const revealed = total + table.drawnShown
  const forcedLabel = table.forced ? categoryText(t, table.forced).label : ''

  // Mon tour de choisir s'annonce ; chaque choix des autres s'entend.
  useEffect(() => {
    if (mine && !table.forced) sound.pop()
  }, [mine, table.forced, duel.picks.length])
  const heardPicks = useRef(duel.picks.length)
  useEffect(() => {
    if (duel.picks.length > heardPicks.current && !done) sound.tile('glass', duel.picks.length)
    heardPicks.current = duel.picks.length
  }, [done, duel.picks.length])
  // Chaque catégorie que le sort pose s'entend en tombant, pas toutes ensemble :
  // c'est la pause entre deux qui fait le tirage.
  const heardDraw = useRef(table.drawnShown)
  useEffect(() => {
    for (let index = heardDraw.current; index < table.drawnShown; index++) sound.tile('wood', 3 + index)
    heardDraw.current = table.drawnShown
  }, [table.drawnShown])
  // Un conseil venu d'un autre s'entend, une fois : le mien a déjà sonné sous
  // le doigt au moment du geste.
  const heardCheers = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!heardCheers.current) {
      heardCheers.current = new Set(table.facts.map((fact) => fact.id))
      return
    }
    for (const fact of table.facts) {
      if (fact.kind !== 'cheered' || heardCheers.current.has(fact.id)) continue
      heardCheers.current.add(fact.id)
      if (fact.player !== table.myIndex) sound.tile('marimba', 3)
    }
  }, [table.facts, table.myIndex])

  const line = done
    ? drawn > 0
      ? t.duel.drawing
      : t.duel.draftDone
    : table.forced
      ? t.duel.forced(forcedLabel)
      : mine
        ? t.duel.draftTitle
        : t.duel.draftTurn(nameOf(picker ?? undefined, t.duel.you))

  return (
    <main className="stage stage--duel">
      <Cut table={table} />
      <div className="sheet duel-draft">
        <div className="spread">
          <p className="eyebrow">{t.duel.announceTitle}</p>
          <p className="note">{done ? ' ' : t.duel.draftStep(Math.min(total, duel.picks.length + 1), total)}</p>
        </div>

        <ol className="duel-order" aria-hidden="true">
          {Array.from({ length: total }, (_, slot) => {
            const seat = table.seats[duel.order[slot % duel.order.length] ?? 0]
            const taken = duel.picks[slot]
            const current = slot === duel.picks.length && !done
            const motif = taken ? categoryMotif(taken) : null
            return (
              <li
                key={slot}
                className={`duel-order__slot${current ? ' duel-order__slot--now' : ''}${taken ? ' duel-order__slot--done' : ''}`}
                style={motif ? ({ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties) : undefined}
              >
                {taken ? <CategoryIcon categoryId={taken} tint={onTint(motif!.tint)} className="duel-order__icon" /> : seat ? <Avatar choice={seat.avatar} size="sm" /> : null}
              </li>
            )
          })}
          {Array.from({ length: drawn }, (_, index) => {
            const taken = index < table.drawnShown ? duel.picks[total + index] : undefined
            const motif = taken ? categoryMotif(taken) : null
            return (
              <li
                key={`drawn-${index}`}
                className={`duel-order__slot duel-order__slot--luck${taken ? ' duel-order__slot--done' : ''}`}
                style={motif ? ({ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties) : undefined}
              >
                {taken ? <CategoryIcon categoryId={taken} tint={onTint(motif!.tint)} className="duel-order__icon" /> : <span>?</span>}
              </li>
            )
          })}
        </ol>

        <p className={`duel-turn${mine && !table.forced ? ' duel-turn--mine' : ''}`} aria-live="polite" key={line}>
          {table.forced ? (
            <CategoryIcon categoryId={table.forced} tint={categoryMotif(table.forced).tint} className="duel-turn__icon" />
          ) : picker && !done ? (
            <Avatar choice={picker.avatar} size="sm" />
          ) : null}
          <b>{line}</b>
          {!done && !table.forced ? <span className="duel-turn__left">{t.duel.pickLeft(Math.ceil(table.pickLeft))}</span> : null}
        </p>
        {!done && !mine && !table.forced ? <p className="note duel-cheer">{t.duel.cheerHint}</p> : null}
        <span className={`duel-fuse${mine ? ' duel-fuse--mine' : ''}${table.pickLeft <= 3 && !done && !table.forced ? ' duel-fuse--late' : ''}`} aria-hidden="true">
          <i style={{ transform: `scaleX(${done || table.forced ? 0 : Math.max(0, Math.min(1, table.pickLeft / DUEL_PICK_SECONDS))})` } as CSSProperties} />
        </span>

        <ul className="dealt dealt--pick">
          {table.pool.map((id, index) => {
            const place = duel.picks.indexOf(id)
            const taken = place >= 0 && place < revealed
            const luck = taken && place >= total
            const whoIndex = taken && !luck ? (duel.order[place % duel.order.length] ?? 0) : -1
            const who = whoIndex >= 0 ? table.seats[whoIndex] : null
            const motif = categoryMotif(id)
            const offered = !taken && table.forced === id
            // Ce n'est pas mon tour : la tuile devient un conseil. Et celle
            // qu'un autre conseille frémit chez toute la table, celui qui
            // choisit compris — c'est pour lui qu'on la met en avant.
            const canPick = mine && !taken && !table.forced
            const canCheer = !mine && !taken && !table.forced && !done
            const cheered = taken || table.forced || done ? undefined : table.cheers.find((fact) => fact.cheer === id)
            return (
              <li
                key={id}
                style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
                className={`${taken ? 'dealt--chosen' : ''}${offered ? ' dealt--offered' : ''}${luck ? ' dealt--luck' : ''}`}
              >
                <button
                  type="button"
                  className={`dealt-tile${taken ? ' dealt-tile--taken' : ''}${canPick ? ' dealt-tile--open' : ''}${canCheer ? ' dealt-tile--cheer' : ''}${cheered ? ' dealt-tile--cheered' : ''}`}
                  disabled={!canPick && !canCheer}
                  aria-label={canCheer ? t.duel.cheerAria(categoryText(t, id).label) : undefined}
                  onClick={() => {
                    armSound()
                    if (canPick) {
                      sound.tile('glass', 2)
                      table.pick(id)
                      return
                    }
                    sound.tile('marimba', 2 + index)
                    table.cheer(id)
                  }}
                >
                  <CategoryIcon key={cheered?.id ?? 'still'} categoryId={id} tint={onTint(motif.tint)} className="dealt-shape" />
                  <span>{categoryText(t, id).label}</span>
                  {taken ? (
                    <span className="dealt-taken" key={place}>
                      {luck ? t.duel.drawn : who ? <Avatar choice={who.avatar} size="sm" /> : null}
                      {luck ? null : nameOf(who ?? undefined, t.duel.you, whoIndex === table.myIndex)}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
        <Quit table={table} />
      </div>
    </main>
  )
}

/* -------------------------------------------------------- le tirage - */

/**
 * Les instants où la roulette de l'ouvreur avance : de plus en plus espacés,
 * et le dernier pas tombe sur l'ouvreur. Deux tours de table au moins.
 */
function spinSteps(players: number, opener: number): { at: number; seat: number }[] {
  const count = players * 2 + 3
  const widths = Array.from({ length: count }, (_, index) => Math.pow(1.17, index))
  const scale = OPENING_SPIN_SECONDS / widths.reduce((sum, width) => sum + width, 0)
  let at = 0
  const first = (((opener - (count - 1)) % players) + players) % players
  return widths.map((width, index) => {
    const step = { at, seat: (first + index) % players }
    at += width * scale
    return step
  })
}

/** Le programme, puis l'ouvreur tiré au sort, puis trois temps. */
function Opening({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const elapsed = Math.max(0, table.at - table.openingAt)
  const steps = useMemo(() => spinSteps(duel.players.length, duel.opener), [duel.opener, duel.players.length])
  const landed = elapsed >= OPENING_SPIN_SECONDS || reducedMotion()
  const step = landed ? steps.length - 1 : Math.max(0, steps.filter((one) => one.at <= elapsed).length - 1)
  const lit = steps[step]?.seat ?? duel.opener
  const counting = elapsed - OPENING_SPIN_SECONDS - OPENING_LAND_SECONDS
  const beat = counting < 0 ? null : Math.max(1, BEATS - Math.floor(counting / BEAT_SECONDS))
  const opener = table.seats[duel.opener]

  useEffect(() => {
    if (!landed) sound.tile('wood', step % 6)
  }, [landed, step])
  useEffect(() => {
    if (landed) sound.news()
  }, [landed])
  useEffect(() => {
    if (beat !== null) sound.beat()
  }, [beat])

  const motif = beat ? BEAT_MOTIFS[beat]! : null
  return (
    <main className="stage stage--duel">
      <Cut table={table} />
      <div className="sheet duel-opening">
        <ul className="duel-pool" aria-label={t.duel.announceTitle}>
          {duel.picks.map((id, index) => {
            const tint = categoryMotif(id).tint
            return (
              <li key={id} style={{ '--i': index, background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}>
                <CategoryIcon categoryId={id} tint={onTint(tint)} className="duel-pool__icon" />
                <span>{categoryText(t, id).label}</span>
              </li>
            )
          })}
        </ul>

        <p className="eyebrow">{t.duel.whoOpens}</p>
        <ol className="duel-wheel">
          {table.seats.map((seat, index) => (
            <li
              key={seat.id}
              className={`duel-wheel__seat${index === lit ? ' duel-wheel__seat--lit' : ''}${landed && index === duel.opener ? ' duel-wheel__seat--chosen' : ''}${landed && index !== duel.opener ? ' duel-wheel__seat--rest' : ''}`}
            >
              <Avatar choice={seat.avatar} size="md" />
              <b>{nameOf(seat, t.duel.you, index === table.myIndex)}</b>
            </li>
          ))}
        </ol>

        <div className="duel-opening__stage" aria-live="assertive">
          {motif && beat ? (
            <p className={`countdown-beat duel-beat mark--${motif.kind}`} key={beat} style={{ color: `var(--${onTint(motif.tint)})` }}>
              <Shape kind={motif.kind} tint={motif.tint} />
              <span className="countdown-number">{beat}</span>
            </p>
          ) : landed ? (
            <div className="duel-opening__name">
              <h1 className="duel-title">{duel.opener === table.myIndex ? t.duel.youOpen : t.duel.opens(nameOf(opener, t.duel.you))}</h1>
              <p className="note">{t.duel.opensNote}</p>
            </div>
          ) : null}
        </div>
        <Quit table={table} />
      </div>
    </main>
  )
}

/* --------------------------------------------------------- la partie - */

/**
 * La table, en tête d'écran : ma place d'abord, plus large, qui porte ma
 * réserve en grand ; les autres ont leur barre et, en tout petit au-dessus,
 * leurs secondes.
 */
function TableStrip({ table, at, urgent, resumed }: { table: DuelTable; at: number; urgent: boolean; resumed: number | null }) {
  const t = useT()
  const duel = table.duel!
  const news = table.event
  const order = useMemo(() => {
    const all = table.seats.map((_, index) => index)
    return [table.myIndex, ...all.filter((index) => index !== table.myIndex)].filter((index) => index >= 0)
  }, [table.myIndex, table.seats])
  return (
    <ol className="duel-strip" aria-label={t.duel.table}>
      {order.map((index) => {
        const seat = table.seats[index]!
        const player = duel.players[index]
        const dead = player?.alive === false
        const active = duel.turn?.player === index && !dead && at >= duel.turn.startedAt
        const seconds = reserveOf(duel, index, at)
        const mine = index === table.myIndex
        // Les trois dernières secondes de celui qui répond battent en rouge.
        const late = active && seconds <= LOW_SECONDS && table.phase === 'play'
        const delta = news && news.player === index && news.delta ? news : null
        return (
          <li
            key={seat.id}
            className={`duel-seat${active ? ' duel-seat--active' : ''}${dead ? ' duel-seat--dead' : ''}${mine ? ' duel-seat--me' : ''}${late ? ' duel-seat--late' : ''}${table.fallen === index ? ' duel-seat--fallen' : ''}${resumed === index ? ' duel-seat--resume' : ''}`}
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
              // Ma réserve, en grand, dans ma place : c'est le seul chrono que je lis.
              <span className={`duel-seat__mine clock${late ? ' clock--late' : ''}`} key={urgent ? Math.ceil(seconds) : 'calm'}>
                {reserveShown(seconds)}
                <span className="duel-seat__unit">s</span>
              </span>
            ) : (
              <span className="duel-seat__name">{nameOf(seat, t.duel.you, mine)}</span>
            )}
            {!mine && !dead ? (
              <span className="duel-seat__secs" aria-label={t.duel.secondsLeft(reserveShown(seconds))}>
                {reserveShown(seconds)}
                <span className="duel-seat__unit">s</span>
              </span>
            ) : null}
            <span className="duel-seat__bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.min(1, seconds / DUEL_RESERVE_SECONDS)})` } as CSSProperties} />
            </span>
            {dead ? <span className="duel-seat__clock">{t.duel.out}</span> : null}
            {delta ? (
              <span key={delta.id} className={`duel-seat__delta${delta.delta! < 0 ? ' duel-seat__delta--loss' : ''}`} aria-hidden="true">
                {t.duel.seconds(delta.delta!)}
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Les trois derniers faits de la table, le plus récent en tête, sur une hauteur fixe. */
function Feed({ table }: { table: DuelTable }) {
  const t = useT()
  const me = table.myIndex
  const line = (fact: DuelFact) => {
    const seat = table.seats[fact.player]
    const name = nameOf(seat, t.duel.you)
    const self = fact.player === me
    switch (fact.kind) {
      case 'solved':
        return self ? t.duel.feedYouSolved(capitalized(fact.word ?? '')) : t.duel.feedSolved(name, capitalized(fact.word ?? ''))
      case 'passed':
        return self ? t.duel.feedYouPassed : t.duel.feedPassed(name)
      case 'failed':
        return t.duel.feedFailed
      case 'dead':
        return self ? t.duel.feedYouDead : t.duel.feedDead(name)
      default:
        return ''
    }
  }
  return (
    <ol className="duel-feed" aria-live="polite">
      {table.feed.map((fact, rank) => {
        const seat = table.seats[fact.player]
        return (
          <li key={fact.id} className={`duel-feed__line duel-feed__line--${fact.kind}`} style={{ '--rank': rank } as CSSProperties}>
            {fact.kind === 'failed' ? (
              <span className="duel-feed__mark" aria-hidden="true">
                ↻
              </span>
            ) : seat ? (
              <Avatar choice={seat.avatar} size="sm" />
            ) : null}
            <span className="duel-feed__text">{line(fact)}</span>
            {fact.saved ? <span className="duel-feed__saved">{t.duel.saved}</span> : null}
            {fact.kind === 'solved' && fact.tier ? <TierTag tier={fact.tier} /> : null}
            {fact.delta ? <em className={`duel-feed__delta${fact.delta < 0 ? ' duel-feed__delta--loss' : ''}`}>{t.duel.seconds(fact.delta)}</em> : null}
          </li>
        )
      })}
    </ol>
  )
}

/** La partie : l'écran du solo, avec la table, son fil, et la main qui passe. */
function Play({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const prompt = table.prompt!
  const me = table.myIndex
  const mine = table.myTurn
  const alive = duel.players[me]?.alive !== false
  const [typed, setTyped] = useState({ key: '', text: '' })
  const roundKey = `${prompt.categoryId}:${prompt.letter}`
  const draft = typed.key === roundKey ? typed.text : ''
  const field = useRef<HTMLInputElement>(null)
  const [shaking, setShaking] = useState(false)

  const live = useMemo<Verdict>(() => (alive ? table.inspect(draft) : { kind: 'empty', found: null }), [alive, draft, table])
  const accepted = live.kind === 'accepted'
  const exact = accepted && !live.found?.approximate
  const frozen = table.phase === 'deaths'
  const turn = duel.turn
  const clockAt = table.at
  const seconds = reserveOf(duel, me, clockAt)
  // Le passe se paie 5 s : sous la pénalité, le bouton ne s'offre plus.
  const canPass = mine && seconds >= DUEL_PASS_PENALTY_SECONDS
  const critical = mine && seconds <= LOW_SECONDS && !frozen
  const urgent = mine && seconds <= 10
  const shown = Math.ceil(seconds)
  const holderSeat = table.seats[turn?.player ?? me]
  const inheritedFrom = turn && turn.declined.length > 0 ? table.seats[turn.declined[turn.declined.length - 1]!] : undefined
  const inheritedMine = turn && turn.declined.length > 0 && turn.declined[turn.declined.length - 1] === me

  // Ce que mon champ tient, l'état le valide tout seul à zéro s'il est juste.
  useEffect(() => {
    table.hold(draft)
  }, [draft, table])

  // Le champ prend le focus quand la main m'arrive — pas pendant le tour des
  // autres : le clavier du téléphone n'a pas à s'ouvrir sur un écran qu'on
  // regarde. Qui veut taper d'avance touche le champ.
  useEffect(() => {
    if (!alive || !mine) return
    field.current?.focus()
    sound.tile('glass', 4)
  }, [alive, mine, duel.turns])

  const heard = !accepted ? null : exact ? 'named' : 'close'
  useEffect(() => {
    if (heard === 'named') sound.recognized()
    else if (heard === 'close') sound.oneLetterOff()
  }, [heard])

  useEffect(() => {
    if (urgent && shown > 0 && !frozen) sound.tick(shown)
  }, [frozen, urgent, shown])

  // Les faits de la table s'entendent, une fois chacun : le palier d'un mot,
  // le passe des autres (le mien a déjà sonné sous le doigt), le couple refusé
  // de tous, la mort. Ceux d'avant l'ouverture de l'écran se taisent.
  const heardFacts = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!heardFacts.current) {
      heardFacts.current = new Set(table.facts.map((fact) => fact.id))
      return
    }
    for (const fact of table.facts) {
      if (heardFacts.current.has(fact.id)) continue
      heardFacts.current.add(fact.id)
      if (fact.kind === 'dead') sound.timeUp()
      else if (fact.kind === 'failed') sound.refused()
      else if (fact.kind === 'passed' && fact.player !== me) sound.skipped()
      else if (fact.kind === 'solved' && fact.tier) sound.found(tierSound(fact.tier, false), Math.min(3, fact.player))
    }
  }, [me, table.facts])

  // La reprise après une mort : pas de compte à rebours, la place qui reprend
  // la main s'allume et le dit, d'un son.
  const [resumed, setResumed] = useState<{ player: number; key: number } | null>(null)
  const wasFrozen = useRef(frozen)
  useEffect(() => {
    if (wasFrozen.current && !frozen && turn) {
      sound.go()
      setResumed({ player: turn.player, key: Date.now() })
    }
    wasFrozen.current = frozen
  }, [frozen, turn])
  useEffect(() => {
    if (!resumed) return
    const timer = setTimeout(() => setResumed(null), RESUME_FLASH_MS)
    return () => clearTimeout(timer)
  }, [resumed])

  const watching = table.watching
  const faller = table.fallen !== null ? table.seats[table.fallen] : undefined
  const standing = duel.players.filter((player) => player.alive).length
  const champion = duelRanking(duel)[0] ?? 0
  const over = duel.phase === 'over'

  // Ce que le champ dit : les mots du jeu, et le duel en plus.
  const said =
    draft.trim() === ''
      ? mine
        ? t.duel.yourTurnHint
        : t.duel.inherited
      : live.kind === 'accepted'
        ? exact
          ? `✓ ${capitalized(live.found?.display ?? '')}`
          : t.run.oneLetterOff
        : live.kind === 'wrong-letter'
          ? t.run.startsWith(prompt.letter)
          : live.kind === 'already'
            ? t.run.already
            : live.kind === 'spell'
              ? ''
              : t.run.unknown

  const canValidate = mine && accepted
  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    armSound()
    if (!accepted && draft.trim() !== '') {
      setShaking(true)
      sound.refused()
    }
    if (canValidate) table.play(draft)
  }

  return (
    // `data-phase` : la mise en scène d'une mort se joue par-dessus la partie,
    // donc les classes de l'écran ne suffisent pas à dire où en est le duel.
    <main className={`stage stage--playing stage--duel-play${alive ? '' : ' stage--out'}`} data-phase={table.phase}>
      <Cut table={table} />
      <div className={`sheet run duel-run${urgent ? ' run--urgent' : ''}${critical ? ' run--critical' : ''}`}>
        <TableStrip table={table} at={clockAt} urgent={urgent} resumed={resumed?.player ?? null} />
        <Feed table={table} />

        <div className="duel-board">
          <p className={`duel-face${watching ? ' duel-face--watching' : ' duel-face--mine'}`} key={`${duel.turns}`} aria-live="polite">
            {watching && holderSeat ? <Avatar choice={holderSeat.avatar} size="sm" /> : <span className="duel-face__dot" aria-hidden="true" />}
            <b>{watching ? t.duel.watching(nameOf(holderSeat, t.duel.you)) : alive ? t.duel.yourTurn : t.duel.spectating}</b>
            {inheritedFrom ? <span className="duel-inherited">{t.duel.inheritedFrom(nameOf(inheritedFrom, t.duel.you, !!inheritedMine))}</span> : null}
          </p>

          <section className={`prompt duel-prompt${inheritedFrom ? ' duel-prompt--inherited' : ''}`} key={roundKey}>
            <span className="duel-prompt__mark" key={duel.turns}>
              <LetterMark letter={prompt.letter} motif={categoryMotif(prompt.categoryId)} size="lg" />
            </span>
            <div className="prompt-text">
              <h2 className="prompt-label">{categoryText(t, prompt.categoryId).label}</h2>
              <p className="note">{categoryText(t, prompt.categoryId).hint}</p>
            </div>
          </section>
        </div>

        {alive ? (
          <form className={`answer${exact ? ' answer--valid' : ''}${mine ? '' : ' answer--ahead'}`} onSubmit={submit}>
            <div className={`answer-field${shaking ? ' answer-field--shake' : ''}`} onAnimationEnd={() => setShaking(false)}>
              <input
                ref={field}
                value={draft}
                data-keys=""
                onChange={(event) => {
                  armSound()
                  sound.key(event.target.value.length < draft.length)
                  setTyped({ key: roundKey, text: capitalized(event.target.value) })
                }}
                placeholder={t.run.placeholder(prompt.letter)}
                aria-label={t.run.fieldLabel(prompt.letter, categoryText(t, prompt.categoryId).label)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                enterKeyHint="done"
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !event.repeat && canPass) {
                    event.preventDefault()
                    sound.skipped()
                    table.pass()
                    return
                  }
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  submit()
                }}
              />
              <span className="answer-line" aria-hidden="true" />
            </div>
            <p className={`verdict${exact ? ' verdict--valid' : ''}${live.kind === 'accepted' && !exact ? ' verdict--approx' : ''}`}>
              {!mine && draft.trim() !== '' ? <span className="duel-ahead">{t.duel.advance}</span> : null}
              {said}
            </p>
            <div className="answer-actions">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!canPass}
                onClick={() => {
                  armSound()
                  sound.skipped()
                  table.pass()
                }}
              >
                {t.run.skip(DUEL_PASS_PENALTY_SECONDS)}
              </button>
              <button type="submit" className={`btn btn--blue${canValidate ? ' duel-armed' : ''}`} disabled={!canValidate}>
                {t.run.submit}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <Quit table={table} />

      {resumed && !frozen ? (
        <p className="duel-resume" key={resumed.key} aria-live="assertive">
          <Avatar choice={table.seats[resumed.player]!.avatar} size="sm" />
          <b>{resumed.player === me ? t.duel.resumeYou : t.duel.resumeOf(nameOf(table.seats[resumed.player], t.duel.you))}</b>
        </p>
      ) : null}

      {/* La mort d'un joueur se joue par-dessus la partie, qui reste visible
          derrière : la table s'assombrit, le tombé se barre, et la main
          revient — ou, à la dernière, le gagnant est nommé. */}
      {frozen && faller ? (
        <div className="duel-death" aria-live="assertive">
          <div className="duel-death__card">
            <span className="duel-death__face">
              <Avatar choice={faller.avatar} size="lg" />
              <span className="duel-death__cross" aria-hidden="true">
                ✕
              </span>
            </span>
            <p className="duel-death__word">{t.duel.out}</p>
            <b className="duel-death__name">{nameOf(faller, t.duel.you, table.fallen === me)}</b>
            {over ? (
              <p className="duel-death__winner">
                <Avatar choice={table.seats[champion]!.avatar} size="sm" />
                {champion === me ? t.duel.youWin : t.duel.overTitle(nameOf(table.seats[champion], t.duel.you))}
              </p>
            ) : (
              <p className="note">{table.fallen === me ? t.duel.spectating : t.duel.standing(standing)}</p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}

/* ---------------------------------------------------- le récapitulatif - */

/** Le bilan : le gagnant à l'affiche, puis la table révélée de la dernière place à la première. */
function Over({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const order = duelRanking(duel)
  const champion = order[0] ?? 0
  const win = champion === table.myIndex
  const [shown, setShown] = useState(() => (reducedMotion() ? order.length : 0))
  const rounds = duel.dealt.length + 1

  useEffect(() => {
    const timer = setTimeout(() => sound.crowned(win), 280)
    return () => clearTimeout(timer)
  }, [win])

  useEffect(() => {
    if (shown >= order.length) return
    const timer = setTimeout(() => setShown((current) => current + 1), shown === 0 ? 900 : 420)
    return () => clearTimeout(timer)
  }, [order.length, shown])

  // Les places s'allument de la dernière à la première, en montant.
  useEffect(() => {
    if (shown > 0) sound.unveil(order.length - shown)
  }, [order.length, shown])

  const done = shown >= order.length
  const seat = table.seats[champion]
  const someoneElse = table.mode === 'online' && table.rematchOpen
  return (
    <main className="stage stage--duel">
      <Cut table={table} />
      <div className="sheet reveal duel-over">
        <header className={`duel-poster${win ? ' duel-poster--win' : ''}`}>
          {win ? <Burst /> : null}
          <span className="duel-poster__face">{seat ? <Avatar choice={seat.avatar} size="lg" /> : null}</span>
          <p className="eyebrow">{t.duel.overEyebrow}</p>
          <h1 className="duel-winner">{win ? t.duel.youWin : t.duel.overTitle(nameOf(seat, t.duel.you))}</h1>
          <p className="note">{t.duel.overLead(rounds)}</p>
        </header>
        <ol className="duel-ranking">
          {order.map((index, place) => {
            const row = table.seats[index]
            const player = duel.players[index]
            if (!row || !player) return null
            // La place se révèle en montant : la dernière d'abord, le gagnant en dernier.
            const visible = order.length - 1 - place < shown
            const best = [...player.words].sort((a, b) => b.rarity - a.rarity).slice(0, 3)
            return (
              <li
                key={row.id}
                className={`duel-rank${place === 0 ? ' duel-rank--first' : ''}${player.alive ? '' : ' duel-rank--dead'}${visible ? ' duel-rank--in' : ''}${index === table.myIndex ? ' duel-rank--me' : ''}`}
                aria-hidden={!visible}
              >
                <span className="duel-rank__place">{place + 1}</span>
                <Avatar choice={row.avatar} size="sm" />
                <span className="duel-rank__who">
                  <b>{nameOf(row, t.duel.you, index === table.myIndex)}</b>
                  <small>{t.duel.recapLine(player.words.length, timeGained(player))}</small>
                </span>
                <span className="duel-rank__words">
                  {best.map((word) => (
                    <em key={word.word} className={word.tier === 'courant' ? '' : 'duel-rank__word--rare'}>
                      {capitalized(word.display)}
                    </em>
                  ))}
                </span>
              </li>
            )
          })}
        </ol>
        <div className={`stack duel-actions${done ? ' duel-actions--in' : ''}`}>
          {someoneElse ? <p className="note">{t.duel.rematchWaiting}</p> : null}
          <button
            type="button"
            className="btn btn--play btn--block"
            disabled={!done}
            onClick={() => {
              armSound()
              sound.go()
              if (someoneElse) table.joinRematch()
              else table.openRematch()
            }}
          >
            {someoneElse ? t.duel.joinRematch : t.duel.rematch}
          </button>
          <button type="button" className="btn btn--ghost btn--block" disabled={!done} onClick={() => table.leave()}>
            {t.duel.quit}
          </button>
        </div>
      </div>
    </main>
  )
}

/** Un écran d'attente ou d'erreur, dans la feuille du duel. */
/**
 * Quitter en pleine partie : la porte reste ouverte à tous les moments, mais
 * elle demande confirmation — sa réserve coule sans lui jusqu'à sa mort.
 */
function Quit({ table }: { table: DuelTable }) {
  const t = useT()
  const [asking, setAsking] = useState(false)
  return (
    <>
      <button type="button" className="btn btn--quiet duel-quit" onClick={() => setAsking(true)}>
        {t.duel.quit}
      </button>
      {asking ? (
        <div className="duel-sheet" role="dialog" aria-label={t.duel.quit} onClick={() => setAsking(false)}>
          <div className="duel-sheet__card" onClick={(event) => event.stopPropagation()}>
            <b className="duel-quitask">{t.duel.quitAsk}</b>
            <button
              type="button"
              className="btn btn--block duel-kick"
              onClick={() => {
                armSound()
                sound.refused()
                table.leave()
              }}
            >
              {t.duel.quit}
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setAsking(false)}>
              {t.duel.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}

/**
 * Une coupure ne quitte pas la table : le dernier état connu reste à l'écran,
 * et le joueur sait pourquoi plus rien ne bouge.
 */
function Cut({ table }: { table: DuelTable }) {
  const t = useT()
  if (!table.offline || !table.joined) return null
  return (
    <p className="duel-cut" role="status">
      {t.duel.cutLead}
    </p>
  )
}

function Notice({
  title,
  text,
  onBack,
  back,
  onBots,
}: {
  title?: string
  text: string
  onBack?: () => void
  back?: string
  onBots?: () => void
}) {
  const t = useT()
  return (
    <main className="stage stage--duel">
      <div className="sheet duel-notice">
        <p className="eyebrow">{t.duel.title}</p>
        {title ? <h1 className="duel-title">{title}</h1> : null}
        <p className="note">{text}</p>
        {onBots ? (
          <button
            type="button"
            className="btn btn--play btn--block duel-cta"
            onClick={() => {
              armSound()
              sound.go()
              onBots()
            }}
          >
            <span>{t.duel.playBots}</span>
          </button>
        ) : null}
        {onBack ? (
          <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>
            {back ?? t.duel.errorBack}
          </button>
        ) : (
          <span className="duel-notice__dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
    </main>
  )
}

export interface DuelScreenProps {
  lang: string
  mode?: DuelMode
  /** La table où l'on a été invité ; sans elle, l'écran ouvre une table neuve. */
  join?: string | null
  onExit?(reason: DuelExit): void
}

export function DuelScreen({ lang, mode = 'local', join = null, onExit }: DuelScreenProps) {
  // Hors ligne, la table en ligne cède la place à une table locale, sur le même écran.
  const [local, setLocal] = useState(false)
  return <DuelTableScreen key={local ? 'local' : mode} lang={lang} mode={local ? 'local' : mode} join={local ? null : join} onExit={onExit} onBots={() => setLocal(true)} />
}

function DuelTableScreen({ lang, mode, join, onExit, onBots }: Required<Omit<DuelScreenProps, 'onExit'>> & Pick<DuelScreenProps, 'onExit'> & { onBots(): void }) {
  const t = useT()
  const table = useDuelTable({ lang, mode, join, onExit })
  const { phase } = table
  // Les règles s'ouvrent au premier lancement de la table, puis se revoient du salon.
  const [rules, setRules] = useState(() => !loadDuelRulesSeen())

  if (rules) {
    return (
      <main className="stage stage--duel">
        <DuelTutorial
          me={table.seats[table.myIndex]!}
          onDone={() => {
            saveDuelRulesSeen()
            setRules(false)
          }}
        />
      </main>
    )
  }

  if (table.offline && !table.joined) return <Notice title={t.duel.offlineTitle} text={t.duel.offlineLead} onBots={onBots} onBack={() => onExit?.(null)} />
  if (table.error) return <Notice text={t.duel.loadFailed} onBack={() => (onExit ? onExit(null) : table.leave())} />
  if (phase === 'connecting') return <Notice text={t.duel.connecting} onBack={() => (onExit ? onExit(null) : table.leave())} />
  if (phase === 'gone') return <Notice text={t.duel.gone} onBack={() => (onExit ? onExit(null) : table.leave())} />
  if (phase === 'lobby' || phase === 'announcing') return <Lobby table={table} onRules={() => setRules(true)} />
  if (phase === 'draft' && table.duel) return <Draft table={table} />
  if (phase === 'opening' && table.duel) return <Opening table={table} />
  if ((phase === 'play' || phase === 'deaths') && table.duel && table.judge && table.prompt) return <Play table={table} />
  if (phase === 'over' && table.duel) return <Over table={table} />
  // Un état que l'écran n'attendait pas ne doit pas enfermer le joueur.
  return <Notice text={t.duel.connecting} onBack={() => (onExit ? onExit(null) : table.leave())} />
}
