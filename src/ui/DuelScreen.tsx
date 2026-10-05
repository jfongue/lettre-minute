import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import {
  BEAT_SECONDS,
  BEATS,
  HOUSE_BOTS,
  MAX_TABLE,
  MIN_TABLE,
  OPENING_LAND_SECONDS,
  OPENING_SPIN_SECONDS,
  useDuelTable,
  type DuelEvent,
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
  timeGained,
  type Duel,
} from '../domain/duel'
import type { Verdict } from '../domain/run'
import { categoryText, useT } from '../i18n'
import { capitalized } from '../domain/text'
import { armSound, sound, tierSound } from '../lib/sound'
import { Avatar } from './Avatar'
import { Burst, LetterMark, Shape, TierTag } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif, onTint, type Motif } from './motifs'
import { reducedMotion } from './useCountUp'

/**
 * L'écran du duel : le salon, le draft, le tirage de l'ouvreur, la partie et
 * son bilan. Il reprend les écrans et les classes du mode solo — `.stage`,
 * `.sheet`, `.run`, `.answer`, `.verdict`, `.dealt`, `.countdown-beat` — et
 * n'ajoute que ce que le multijoueur demande : les sièges, le fil de la table
 * et la mise en scène des morts. Le temps est la seule monnaie du duel : aucun
 * point n'est affiché.
 */

/** Sous ce reste, la réserve de celui qui répond bat en rouge. */
const LOW_SECONDS = 3

const BEAT_MOTIFS: Record<number, Motif> = {
  3: { kind: 'circle', tint: 'red' },
  2: { kind: 'square', tint: 'blue' },
  1: { kind: 'arch', tint: 'yellow' },
}

const nameOf = (seat: Seat | undefined, you: string): string => (seat?.bot ? seat.name : you)

/** La réserve à afficher : jamais négative. */
const reserveOf = (duel: Duel, index: number, at: number): number => Math.max(0, reserveSeconds(duel, index, at))

/* ------------------------------------------------------------- le salon - */

/**
 * Le salon, en un écran : les quatre places de la table — moi, puis les trois
 * joueurs maison, qu'on invite d'une touche —, le bouton « prêt », puis les
 * robots qui se déclarent prêts sous les yeux du joueur, et l'annonce du
 * draft au même endroit. Rien ne change de page tant que la table se forme.
 */
function Lobby({ table }: { table: DuelTable }) {
  const t = useT()
  const counting = table.phase === 'announcing'
  const locked = !!table.ready.me || counting
  const [warned, setWarned] = useState(0)
  const me = table.seats[table.myIndex]
  const left = table.leavers.map((id) => HOUSE_BOTS.find((bot) => bot.id === id)?.name).filter(Boolean) as string[]
  const shape = draftShape(table.seats.length, table.pool.length)

  // Un robot qui se déclare prêt s'entend, chacun sur sa note.
  const heard = useRef(0)
  useEffect(() => {
    const news = table.event
    if (!news || news.id <= heard.current || news.kind !== 'ready') return
    heard.current = news.id
    sound.tile('marimba', 2 + news.player)
  }, [table.event])

  useEffect(() => {
    if (counting) sound.pop()
  }, [counting])

  const tiles: { seat: Seat | null; bot: (typeof HOUSE_BOTS)[number] | null }[] = [
    { seat: me ?? null, bot: null },
    ...HOUSE_BOTS.map((bot) => ({ seat: table.seats.find((seat) => seat.id === bot.id) ?? null, bot })),
  ]

  return (
    <main className="stage stage--duel">
      <div className="sheet duel-lobby">
        <p className="eyebrow">{table.rematchOpen ? t.duel.revenging : t.duel.title}</p>
        <h1 className="duel-title" key={counting ? 'draft' : 'table'}>
          {counting ? t.duel.announceTitle : table.rematchOpen ? t.duel.rematchTitle : t.duel.leadTitle}
        </h1>
        <p className="note duel-lead" key={counting ? 'rule' : 'lead'}>
          {counting ? t.duel.draftRule(shape.picks, shape.drawn) : table.rematchOpen ? t.duel.rematchLead : t.duel.lead}
        </p>
        {counting ? (
          <span className="duel-fuse duel-fuse--announce" aria-hidden="true">
            <i />
          </span>
        ) : null}

        <ul className="duel-seats" aria-label={t.duel.table}>
          {tiles.map(({ seat, bot }, index) => {
            const id = seat?.id ?? bot!.id
            const gone = !!bot && table.leavers.includes(bot.id)
            const ready = !!seat && !!table.ready[seat.id]
            const open = !seat && !gone
            const avatar = seat?.avatar ?? bot!.avatar
            const last = !!bot && !!seat && table.invited.length <= MIN_TABLE - 1
            const full = open && table.seats.length >= MAX_TABLE
            const stamp = gone
              ? t.duel.leftStamp
              : ready
                ? t.duel.ready
                : !seat
                  ? t.duel.inviteAction
                  : bot
                    ? t.duel.invited
                    : t.duel.notReady
            const state = gone ? 'gone' : ready ? 'ready' : open ? 'open' : 'seated'
            const body = (
              <>
                <span className="duel-seatcard__face">
                  <Avatar choice={avatar} size="md" />
                </span>
                <span className="duel-seatcard__text">
                  <b>{bot ? bot.name : seat?.name || t.duel.you}</b>
                  <small>{bot ? t.duel.trait[bot.trait] : seat?.name ? t.duel.you : '\u00a0'}</small>
                </span>
                <span className="duel-seatcard__stamp" key={stamp}>
                  {open ? <span aria-hidden="true">+ </span> : null}
                  {stamp}
                </span>
              </>
            )
            return (
              <li key={id} className={`duel-seatcard duel-seatcard--${state}${locked && open ? ' duel-seatcard--shut' : ''}`} style={{ '--i': index } as CSSProperties}>
                {bot ? (
                  <button
                    type="button"
                    className="duel-seatcard__button"
                    aria-pressed={!!seat}
                    disabled={locked || gone || full}
                    onClick={() => {
                      armSound()
                      if (last) {
                        sound.refused()
                        setWarned((count) => count + 1)
                        return
                      }
                      sound.tile('marimba', seat ? 3 : 5)
                      table.toggleInvite(bot.id)
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="duel-seatcard__button">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="note duel-hint" aria-live="polite" key={warned}>
          {warned > 0 && !locked ? t.duel.keepOne : left.length > 0 ? t.duel.left(left.join(', '), left.length) : ' '}
        </p>

        {table.pool.length === 0 ? (
          <p className="note note--warn">{t.duel.loadFailed}</p>
        ) : counting ? null : (
          <div className="stack">
            <button
              type="button"
              className="btn btn--play btn--block duel-cta"
              disabled={locked}
              onClick={() => {
                armSound()
                sound.go()
                table.markReady()
              }}
            >
              <span>{locked ? t.duel.waitingOthers : t.duel.readyButton}</span>
              {locked ? null : <small>{t.duel.tableSize(table.seats.length)}</small>}
            </button>
            {locked ? (
              <button type="button" className="btn btn--ghost btn--block" onClick={() => table.unready()}>
                {t.duel.cancel}
              </button>
            ) : table.rematchOpen ? (
              <>
                <button type="button" className="btn btn--ghost btn--block" onClick={() => table.backToRecap()}>
                  {t.duel.back}
                </button>
                <button type="button" className="btn btn--quiet btn--block" onClick={() => table.leave()}>
                  {t.duel.quit}
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </main>
  )
}

/* -------------------------------------------------------------- le draft - */

/** Le draft : l'ordre des choix en tête, puis une tuile par catégorie jouable. */
function Draft({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const picker = table.picker
  const mine = table.myPickTurn
  const { chosen: total, drawn } = draftShape(duel.players.length, duel.categories.length)
  const done = !picker
  const forcedLabel = table.forced ? categoryText(t, table.forced).label : ''

  // Mon tour de choisir s'annonce ; chaque choix des autres s'entend.
  useEffect(() => {
    if (mine && !table.forced) sound.pop()
  }, [mine, table.forced, duel.picks.length])
  const heard = useRef(0)
  useEffect(() => {
    const news = table.event
    if (!news || news.id <= heard.current || news.kind !== 'picked') return
    heard.current = news.id
    if (news.player !== table.myIndex) sound.tile('glass', duel.picks.length)
  }, [duel.picks.length, table.event, table.myIndex])
  useEffect(() => {
    if (!done) return
    duel.picks.slice(total).forEach((_, index) => sound.tile('wood', 3 + index, 0.15 + index * 0.18))
  }, [done, duel.picks, total])

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
            const taken = duel.picks[total + index]
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
        <span className={`duel-fuse${mine ? ' duel-fuse--mine' : ''}${table.pickLeft <= 3 && !done && !table.forced ? ' duel-fuse--late' : ''}`} aria-hidden="true">
          <i style={{ transform: `scaleX(${done || table.forced ? 0 : Math.max(0, Math.min(1, table.pickLeft / DUEL_PICK_SECONDS))})` } as CSSProperties} />
        </span>

        <ul className="dealt dealt--pick">
          {table.pool.map((id, index) => {
            const place = duel.picks.indexOf(id)
            const taken = place >= 0
            const luck = taken && place >= total
            const who = taken && !luck ? table.seats[duel.order[place % duel.order.length] ?? 0] : null
            const motif = categoryMotif(id)
            const offered = !taken && table.forced === id
            return (
              <li
                key={id}
                style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
                className={`${taken ? 'dealt--chosen' : ''}${offered ? ' dealt--offered' : ''}${luck ? ' dealt--luck' : ''}`}
              >
                <button
                  type="button"
                  className={`dealt-tile${taken ? ' dealt-tile--taken' : ''}${mine && !taken ? ' dealt-tile--open' : ''}`}
                  disabled={!mine || taken || !!table.forced}
                  onClick={() => {
                    armSound()
                    sound.tile('glass', 2)
                    table.pick(id)
                  }}
                >
                  <CategoryIcon categoryId={id} tint={onTint(motif.tint)} className="dealt-shape" />
                  <span>{categoryText(t, id).label}</span>
                  {taken ? (
                    <span className="dealt-taken" key={place}>
                      {luck ? t.duel.drawn : who ? <Avatar choice={who.avatar} size="sm" /> : null}
                      {luck ? null : nameOf(who ?? undefined, t.duel.you)}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
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
              <b>{nameOf(seat, t.duel.you)}</b>
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
      </div>
    </main>
  )
}

/* --------------------------------------------------------- la partie - */

/** La table, en bandeau : qui joue, ce qu'il lui reste, ce qu'il vient de gagner ou perdre. */
function TableStrip({ table, at, urgent }: { table: DuelTable; at: number; urgent: boolean }) {
  const t = useT()
  const duel = table.duel!
  const news = table.event
  return (
    <ol className="duel-strip" aria-label={t.duel.table}>
      {table.seats.map((seat, index) => {
        const player = duel.players[index]
        const dead = player?.alive === false
        const active = duel.turn?.player === index && !dead
        const seconds = reserveOf(duel, index, at)
        // Les trois dernières secondes de celui qui répond battent en rouge.
        const late = active && seconds <= LOW_SECONDS && table.phase === 'play'
        const delta = news && news.player === index && news.delta ? news : null
        return (
          <li
            key={seat.id}
            className={`duel-seat${active ? ' duel-seat--active' : ''}${dead ? ' duel-seat--dead' : ''}${index === table.myIndex ? ' duel-seat--me' : ''}${late ? ' duel-seat--late' : ''}${table.fallen === index ? ' duel-seat--fallen' : ''}`}
          >
            <span className="duel-seat__face" key={active ? 'on' : 'off'}>
              <Avatar choice={seat.avatar} size="sm" />
              {dead ? (
                <span className="duel-seat__cross" aria-hidden="true">
                  ✕
                </span>
              ) : null}
            </span>
            {index === table.myIndex && !dead ? (
              // Ma réserve, en grand, dans ma place : c'est le seul chrono que je lis.
              <span className={`duel-seat__mine clock${late ? ' clock--late' : ''}`} key={urgent ? Math.ceil(seconds) : 'calm'}>
                {Math.ceil(seconds)}
              </span>
            ) : (
              <span className="duel-seat__name">{nameOf(seat, t.duel.you)}</span>
            )}
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
  const line = (fact: DuelEvent) => {
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
  const facts = table.feed.filter((fact) => fact.kind === 'solved' || fact.kind === 'passed' || fact.kind === 'failed' || fact.kind === 'dead')
  return (
    <ol className="duel-feed" aria-live="polite">
      {facts.map((fact, rank) => {
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
            {fact.kind === 'solved' && fact.tier ? <TierTag tier={fact.tier} /> : null}
            {fact.delta ? <em className={`duel-feed__delta${fact.delta < 0 ? ' duel-feed__delta--loss' : ''}`}>{t.duel.seconds(fact.delta)}</em> : null}
          </li>
        )
      })}
    </ol>
  )
}

/** La partie : l'écran du solo, avec la table, son fil et la montre de celui qui a la main. */
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
  // Pendant la mise en scène d'une mort, la montre est arrêtée : on lit la
  // réserve telle qu'elle repartira, pas le temps de l'animation.
  const frozen = table.phase === 'deaths'
  const turn = duel.turn
  const clockAt = frozen ? (turn?.startedAt ?? table.at) : table.at
  // Le gros chrono est toujours le mien : la réserve des autres se lit à leur barre.
  const seconds = reserveOf(duel, me, clockAt)
  const critical = mine && seconds <= LOW_SECONDS && !frozen
  const urgent = mine && seconds <= 10
  const shown = Math.ceil(seconds)
  const holderSeat = table.seats[turn?.player ?? me]
  const inheritedFrom = turn && turn.declined.length > 0 ? table.seats[turn.declined[turn.declined.length - 1]!] : undefined

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
  // le passe des autres (le mien a déjà sonné sous le doigt), le couple
  // refusé de tous, la mort.
  const lastHeard = useRef(table.feed[0]?.id ?? 0)
  useEffect(() => {
    const fresh = table.feed.filter((fact) => fact.id > lastHeard.current).reverse()
    if (fresh.length === 0) return
    lastHeard.current = fresh[fresh.length - 1]!.id
    for (const fact of fresh) {
      if (fact.kind === 'dead') sound.timeUp()
      else if (fact.kind === 'failed') sound.refused()
      else if (fact.kind === 'passed' && fact.player !== me) sound.skipped()
      else if (fact.kind === 'solved' && fact.tier) sound.found(tierSound(fact.tier, false), Math.min(3, fact.player))
    }
  }, [me, table.feed])

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
      <div className={`sheet run duel-run${urgent ? ' run--urgent' : ''}${critical ? ' run--critical' : ''}`}>
        <TableStrip table={table} at={clockAt} urgent={urgent} />
        <Feed table={table} />

        <div className="duel-board">
          <p className={`duel-face${watching ? ' duel-face--watching' : ' duel-face--mine'}`} key={`${duel.turns}`} aria-live="polite">
            {watching && holderSeat ? <Avatar choice={holderSeat.avatar} size="sm" /> : <span className="duel-face__dot" aria-hidden="true" />}
            <b>{watching ? t.duel.watching(nameOf(holderSeat, t.duel.you)) : alive ? t.duel.yourTurn : t.duel.spectating}</b>
            {inheritedFrom ? <span className="duel-inherited">{t.duel.inheritedFrom(nameOf(inheritedFrom, t.duel.you))}</span> : null}
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
                  if (event.key === 'Escape' && !event.repeat && mine) {
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
                disabled={!mine}
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

      {/* La mort d'un joueur se joue par-dessus la partie, qui reste visible
          derrière : la table s'assombrit, le tombé se barre, trois temps
          passent et la main revient — ou, à la dernière, le gagnant est nommé. */}
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
            <b className="duel-death__name">{nameOf(faller, t.duel.you)}</b>
            {over ? (
              <p className="duel-death__winner">
                <Avatar choice={table.seats[champion]!.avatar} size="sm" />
                {champion === me ? t.duel.youWin : t.duel.overTitle(nameOf(table.seats[champion], t.duel.you))}
              </p>
            ) : (
              <p className="note">{table.fallen === me ? t.duel.spectating : t.duel.standing(standing)}</p>
            )}
            {over ? null : table.resumeIn > 0 ? (
              <p className="duel-death__beat" key={table.resumeIn}>
                {table.resumeIn}
              </p>
            ) : (
              <p className="eyebrow duel-death__next">{t.duel.next}</p>
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
  return (
    <main className="stage stage--duel">
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
                  <b>{nameOf(row, t.duel.you)}</b>
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
          {table.rematchOpen ? (
            <>
              <p className="note">{t.duel.rematchWaiting}</p>
              <button
                type="button"
                className="btn btn--play btn--block"
                disabled={!done}
                onClick={() => {
                  armSound()
                  sound.go()
                  table.joinRematch()
                }}
              >
                {t.duel.joinRematch}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--play btn--block"
              disabled={!done}
              onClick={() => {
                armSound()
                sound.go()
                table.openRematch()
              }}
            >
              {t.duel.rematch}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--block" disabled={!done} onClick={() => table.leave()}>
            {t.duel.quit}
          </button>
        </div>
      </div>
    </main>
  )
}

export function DuelScreen({ lang }: { lang: string }) {
  const t = useT()
  const table = useDuelTable(lang)
  const { phase } = table

  if (table.error) {
    return (
      <main className="stage stage--duel">
        <div className="sheet">
          <p className="eyebrow">{t.duel.title}</p>
          <p className="note note--warn">{t.duel.loadFailed}</p>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => table.leave()}>
            {t.duel.errorBack}
          </button>
        </div>
      </main>
    )
  }
  if (phase === 'lobby' || phase === 'announcing') return <Lobby table={table} />
  if (phase === 'draft' && table.duel) return <Draft table={table} />
  if (phase === 'opening' && table.duel) return <Opening table={table} />
  if ((phase === 'play' || phase === 'deaths') && table.duel && table.judge && table.prompt) return <Play table={table} />
  if (phase === 'over' && table.duel) return <Over table={table} />
  return (
    <main className="stage stage--duel">
      <div className="sheet">
        <p className="eyebrow">{t.duel.title}</p>
      </div>
    </main>
  )
}
