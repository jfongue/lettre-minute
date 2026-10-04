import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { HOUSE_BOTS, MAX_TABLE, MIN_TABLE, useDuelTable, type DuelTable, type Seat } from '../state/duel'
import { DUEL_PASS_PENALTY_SECONDS, DUEL_PICK_SECONDS, DUEL_RESERVE_SECONDS, duelRanking, humanPicks, type Duel } from '../domain/duel'
import type { Verdict } from '../domain/run'
import type { RarityTier } from '../domain/rarity'
import { categoryText, formatNumber, useT } from '../i18n'
import { capitalized } from '../domain/text'
import { armSound, sound, tierSound } from '../lib/sound'
import { Avatar } from './Avatar'
import { Burst, LetterMark, Shape, TierTag } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { CountdownScreen } from './CountdownScreen'
import { categoryMotif, onTint } from './motifs'
import { reducedMotion } from './useCountUp'

/**
 * L'écran du duel : le salon, l'annonce, le draft, l'écran des catégories
 * tirées et son compte à rebours, puis la partie et son récapitulatif. Il
 * reprend les écrans et les classes du mode solo — `.stage`, `.sheet`,
 * `.run`, `.answer`, `.verdict`, `CountdownScreen` — et n'ajoute que ce que le
 * multijoueur demande : le bandeau de la table et le draft.
 */

const BONUS: Record<RarityTier, number> = { courant: 0, 'peu commun': 1, rare: 1.5, 'très rare': 1.5 }
/** Sous ce reste, la barre du joueur qui répond bat en rouge. */
const LOW_SECONDS = 3

function reserveOf(duel: Duel, index: number, at: number): number {
  const player = duel.players[index]
  if (!player) return 0
  if (duel.turn?.player !== index) return Math.max(0, player.reserve)
  return Math.max(0, player.reserve - Math.max(0, at - duel.turn.startedAt))
}

const nameOf = (seat: Seat | undefined, you: string): string => (seat?.bot ? seat.name : you)

/** La table, en bandeau : qui joue, ce qu'il lui reste, qui est tombé. */
function TableStrip({ duel, seats, at, me, fallen }: { duel: Duel; seats: readonly Seat[]; at: number; me: number; fallen: number | null }) {
  const t = useT()
  return (
    <ol className="duel-strip" aria-label={t.duel.table}>
      {seats.map((seat, index) => {
        const player = duel.players[index]
        const dead = player?.alive === false
        const active = duel.turn?.player === index
        const seconds = reserveOf(duel, index, at)
        // Les trois dernières secondes de celui qui répond battent en rouge.
        const late = active && !dead && seconds <= LOW_SECONDS
        return (
          <li
            key={seat.id}
            className={`duel-seat${active ? ' duel-seat--active' : ''}${dead ? ' duel-seat--dead' : ''}${index === me ? ' duel-seat--me' : ''}${late ? ' duel-seat--late' : ''}${fallen === index ? ' duel-seat--fallen' : ''}`}
          >
            <span className="duel-seat__face">
              <Avatar choice={seat.avatar} size="sm" />
              {dead ? (
                <span className="duel-seat__cross" aria-hidden="true">
                  ✕
                </span>
              ) : null}
            </span>
            <span className="duel-seat__name">{nameOf(seat, t.duel.you)}</span>
            <span className="duel-seat__bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.min(1, seconds / DUEL_RESERVE_SECONDS)})` } as CSSProperties} />
            </span>
            <span className="duel-seat__clock">{dead ? t.duel.out : `${Math.ceil(seconds)} s`}</span>
          </li>
        )
      })}
    </ol>
  )
}

/** Le salon : la table qui se met en place, l'annonce, et la revanche ouverte. */
function Lobby({ table }: { table: DuelTable }) {
  const t = useT()
  const counting = table.phase === 'announcing'
  const going = table.seats.filter((seat) => table.ready[seat.id]).length
  const left = table.leavers
    .map((id) => table.seats.find((seat) => seat.id === id))
    .filter((seat): seat is Seat => Boolean(seat))
  return (
    <main className="stage stage--duel">
      <div className="sheet">
        <p className="eyebrow">{table.rematchOpen ? t.duel.revenging : t.duel.title}</p>
        <h1 className="duel-title">{counting ? t.duel.announceTitle : table.rematchOpen ? t.duel.rematchTitle : t.duel.lobbyTitle}</h1>
        <p className="note">
          {counting ? t.duel.announceLead : table.rematchOpen ? (going >= MIN_TABLE ? t.duel.rematchLead(going) : t.duel.rematchNeed) : t.duel.inviteNote}
        </p>
        <ul className="duel-table">
          {table.seats.map((seat, index) => (
            <li key={seat.id} className={`duel-player${table.ready[seat.id] ? ' duel-player--ready' : ''}`} style={{ '--i': index } as CSSProperties}>
              <Avatar choice={seat.avatar} size="fill" />
              <b>{nameOf(seat, t.duel.you)}</b>
              <span className="duel-player__stamp">{table.ready[seat.id] ? t.duel.ready : t.duel.waiting}</span>
            </li>
          ))}
        </ul>
        {left.length > 0 ? <p className="note duel-left">{t.duel.left(left.map((seat) => nameOf(seat, t.duel.you)).join(', '))}</p> : null}
        {table.rematchOpen ? (
          <ul className="duel-bots">
            {HOUSE_BOTS.filter((bot) => !table.invited.includes(bot.id)).map((bot) => (
              <li key={bot.id}>
                <button
                  type="button"
                  className="duel-bot"
                  disabled={table.seats.length >= MAX_TABLE}
                  onClick={() => {
                    armSound()
                    sound.tile('marimba', 5)
                    table.toggleInvite(bot.id)
                  }}
                >
                  <Avatar choice={bot.avatar} size="md" />
                  <b>{bot.name}</b>
                  <small>{t.duel.trait[bot.trait]}</small>
                  <span className="duel-bot__mark" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {counting ? (
          <p className="duel-announce" aria-live="assertive">
            <Shape kind="arch" tint="yellow" />
            <b>{t.duel.announceTitle}</b>
          </p>
        ) : table.rematchOpen ? (
          <div className="stack">
            <button
              type="button"
              className="btn btn--play btn--block"
              disabled={going < MIN_TABLE}
              onClick={() => {
                armSound()
                sound.go()
                table.launch()
              }}
            >
              {t.duel.startNow(going)}
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => table.backToRecap()}>
              {t.duel.back}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn--play btn--block"
            disabled={!!table.ready.me}
            onClick={() => {
              armSound()
              sound.beat()
              table.markReady()
            }}
          >
            {table.ready.me ? t.duel.waitingOthers : t.duel.readyButton}
          </button>
        )}
        <button
          type="button"
          className="btn btn--quiet btn--block"
          onClick={() => {
            table.closeRematch()
            table.leave()
          }}
        >
          {t.duel.quit}
        </button>
      </div>
    </main>
  )
}

/** Le draft : une tuile par catégorie jouable, dix secondes par choix. */
function Draft({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const picker = table.picker
  const mine = table.myPickTurn
  const chosen = humanPicks(duel.players.length)
  return (
    <main className="stage stage--duel">
      <div className="sheet">
        <div className="spread">
          <p className="eyebrow">{t.duel.announceTitle}</p>
          <p className="note">{t.duel.pickLeft(Math.ceil(table.pickLeft))}</p>
        </div>
        <p className="duel-turn" aria-live="polite">
          {picker ? <b>{mine ? t.duel.draftTitle : t.duel.draftTurn(nameOf(picker, t.duel.you))}</b> : null}
        </p>
        <span className="duel-fuse" aria-hidden="true">
          <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, table.pickLeft / DUEL_PICK_SECONDS))})` } as CSSProperties} />
        </span>
        <ul className="dealt dealt--pick">
          {table.pool.map((id, index) => {
            const place = duel.picks.indexOf(id)
            const taken = place >= 0
            const who = taken && place < chosen ? table.seats[duel.order[place % duel.order.length] ?? 0] : null
            const motif = categoryMotif(id)
            return (
              <li
                key={id}
                style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
              >
                <button
                  type="button"
                  className={`dealt-tile${taken ? ' dealt-tile--taken' : ''}`}
                  disabled={!mine || taken}
                  onClick={() => {
                    armSound()
                    sound.tile('glass', 2)
                    table.pick(id)
                  }}
                >
                  <CategoryIcon categoryId={id} tint={onTint(motif.tint)} className="dealt-shape" />
                  <span>{categoryText(t, id).label}</span>
                  {taken ? (
                    <span className="dealt-taken">
                      {place >= chosen ? t.duel.drawn : nameOf(who ?? undefined, t.duel.you)}
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

/** La partie : l'écran du solo, avec le bandeau de la table en plus. */
function Play({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const prompt = table.prompt!
  const at = table.at
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
  const clockAt = frozen ? (duel.turn?.startedAt ?? at) : at
  const seconds = reserveOf(duel, me, clockAt)
  const critical = mine && seconds <= LOW_SECONDS
  const urgent = mine && seconds <= 10
  const shown = Math.ceil(seconds)

  // Le champ prend le focus quand la main m'arrive — pas pendant le tour des
  // autres : le clavier du téléphone n'a pas à s'ouvrir sur un écran qu'on
  // regarde. Qui veut taper d'avance touche le champ.
  useEffect(() => {
    if (alive && mine) field.current?.focus()
  }, [alive, mine, roundKey])

  const heard = !accepted ? null : exact ? 'named' : 'close'
  useEffect(() => {
    if (heard === 'named') sound.recognized()
    else if (heard === 'close') sound.oneLetterOff()
  }, [heard])

  useEffect(() => {
    if (urgent && shown > 0) sound.tick(shown)
  }, [urgent, shown])

  // Les faits de la table s'entendent : la note du palier, la mort, le couple refusé.
  useEffect(() => {
    const news = table.event
    if (!news) return
    if (news.kind === 'dead') sound.timeUp()
    else if (news.kind === 'failed') sound.refused()
    else if (news.kind === 'solved' && news.tier) sound.found(tierSound(news.tier, false), Math.min(3, news.player))
  }, [table.event])

  const turn = duel.turn
  const watching = table.watching
  const news = table.event
  const faller = table.fallen !== null ? table.seats[table.fallen] : undefined
  const standing = duel.players.filter((player) => player.alive).length
  // Ce que le champ dit : les mots du jeu, et le duel en plus.
  const said =
    draft.trim() === ''
      ? mine
        ? t.duel.yourTurn
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

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    armSound()
    if (!accepted && draft.trim() !== '') {
      setShaking(true)
      sound.refused()
    }
    if (canValidate) table.play(draft)
  }
  const canValidate = mine && (accepted || live.kind === 'spell')

  return (
    // `data-phase` : la mise en scène d'une mort se joue par-dessus la partie,
    // donc les classes de l'écran ne suffisent pas à dire où en est le duel.
    <main className={`stage stage--playing${alive ? '' : ' stage--out'}`} data-phase={table.phase}>
      <div className={`sheet run${urgent ? ' run--urgent' : ''}${critical ? ' run--critical' : ''}`}>
        <div className="run-head">
          <div className="timer">
            <span className="timer-disc" style={{ '--ratio': Math.min(1, seconds / DUEL_RESERVE_SECONDS) } as CSSProperties} aria-hidden="true" />
            <p className={`clock${mine ? '' : ' clock--away'}`} key={urgent ? shown : 'calm'}>
              {shown}
            </p>
          </div>
          <div className="score">
            {duel.players[me]!.score > 0 ? <Burst key={`burst-${duel.players[me]!.score}`} /> : null}
            <span className="score-value" key={duel.players[me]!.score}>
              {formatNumber(t, duel.players[me]!.score)}
            </span>
          </div>
        </div>

        <p className="run-meta">
          <span className="note">{t.duel.meta(duel.players[me]!.words.length, duel.players.length)}</span>
        </p>

        <TableStrip duel={duel} seats={table.seats} at={clockAt} me={me} fallen={table.fallen} />

        {/* Le fait de la table : une ligne, comme le verdict du solo, jamais une boîte. */}
        {news && (news.kind === 'solved' || news.kind === 'failed') ? (
          <p key={news.id} className={`verdict duel-news duel-news--${news.kind}`}>
            {news.kind === 'failed' ? <span>{t.duel.failed}</span> : null}
            {news.kind === 'solved' ? (
              <>
                <span className="cheer-word">
                  {news.player === me
                    ? t.duel.youFound(capitalized(news.word ?? ''))
                    : t.duel.solved(nameOf(table.seats[news.player], t.duel.you), capitalized(news.word ?? ''))}
                </span>
                {news.tier ? <TierTag tier={news.tier} /> : null}
                {news.tier && news.tier !== 'courant' ? <em className="cheer-points">{t.duel.bonus(BONUS[news.tier])}</em> : null}
              </>
            ) : null}
          </p>
        ) : null}

        <p className={`duel-face${watching ? ' duel-face--watching' : ''}`} aria-live="polite">
          <span className="duel-face__dot" aria-hidden="true" />
          {watching ? t.duel.watching(nameOf(table.seats[turn?.player ?? 0], t.duel.you)) : t.duel.yourTurn}
        </p>

        <section className="prompt" key={roundKey}>
          <LetterMark letter={prompt.letter} motif={categoryMotif(prompt.categoryId)} size="lg" />
          <div className="prompt-text">
            <h2 className="prompt-label">{categoryText(t, prompt.categoryId).label}</h2>
            <p className="note">{categoryText(t, prompt.categoryId).hint}</p>
          </div>
        </section>

        {alive ? (
          <form className={`answer${exact ? ' answer--valid' : ''}`} onSubmit={submit}>
            <div className={`answer-field${shaking ? ' answer-field--shake' : ''}`} onAnimationEnd={() => setShaking(false)}>              <input
                ref={field}
                value={draft}
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
              <button type="submit" className="btn btn--blue" disabled={!canValidate}>
                {t.run.submit}
              </button>
            </div>
          </form>
        ) : (
          <p className="note duel-out">{t.duel.spectating}</p>
        )}
      </div>

      {/* La mort d'un joueur se joue par-dessus la partie, qui reste visible
          derrière : la table s'assombrit, le tombé se barre, trois temps
          passent, et la main revient. */}
      {frozen && table.fallen !== null ? (
        <div className="duel-death" aria-live="assertive">
          <div className="duel-death__card">
            <span className="duel-death__face">
              {faller ? <Avatar choice={faller.avatar} size="lg" /> : <Shape kind="circle" tint="red" />}
              <span className="duel-death__cross" aria-hidden="true">
                ✕
              </span>
            </span>
            <p className="duel-death__word">{t.duel.out}</p>
            <b className="duel-death__name">{nameOf(faller, t.duel.you)}</b>
            <p className="note">{standing > 1 ? t.duel.standing(standing) : t.duel.lastStanding}</p>
            {table.resumeIn > 0 ? (
              <p className="duel-death__beat" key={table.resumeIn}>
                {table.resumeIn}
              </p>
            ) : (
              <p className="eyebrow">{t.duel.next}</p>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}

/** Le récapitulatif : les joueurs révélés un à un, puis les figures. */
function Over({ table }: { table: DuelTable }) {
  const t = useT()
  const duel = table.duel!
  const order = duelRanking(duel)
  const champion = order[0] ?? 0
  const win = champion === table.myIndex
  const [shown, setShown] = useState(() => (reducedMotion() ? order.length : 0))
  const heard = useRef(0)

  useEffect(() => {
    if (shown >= order.length) return
    const timer = setTimeout(() => setShown((current) => current + 1), shown === 0 ? 500 : 620)
    return () => clearTimeout(timer)
  }, [order.length, shown])

  useEffect(() => {
    if (shown === 0 || shown === heard.current) return
    heard.current = shown
    const words = duel.players[order[shown - 1] ?? 0]?.words ?? []
    const best = words[words.length - 1]
    if (best) sound.recap(tierSound(best.tier, best.approximate), shown - 1)
    else sound.tile('marimba', shown - 1)
  }, [duel.players, order, shown])

  const done = shown >= order.length
  return (
    <main className="stage stage--duel">
      <div className="sheet reveal">
        {win ? <Burst /> : null}
        <header className="reveal-score">
          <p className="eyebrow">{t.duel.overEyebrow}</p>
          <h1 className="duel-winner">{win ? t.duel.youWin : t.duel.overTitle(nameOf(table.seats[champion], t.duel.you))}</h1>
        </header>
        <ol className="duel-ranking">
          {order.map((index, place) => {
            const seat = table.seats[index]
            const player = duel.players[index]
            if (!seat || !player) return null
            return (
              <li
                key={seat.id}
                className={`duel-rank${place === 0 ? ' duel-rank--first' : ''}${player.alive ? '' : ' duel-rank--dead'}${place < shown ? ' duel-rank--in' : ''}`}
                aria-hidden={place >= shown}
              >
                <span className="duel-rank__place">{place + 1}</span>
                <Avatar choice={seat.avatar} size="sm" />
                <span className="duel-rank__who">
                  <b>{nameOf(seat, t.duel.you)}</b>
                  <small>{t.duel.scoreLine(player.score, player.words.length)}</small>
                </span>
                <span className="duel-rank__words">
                  {player.words.slice(-3).map((word, rank) => (
                    <em key={`${word.word}-${rank}`}>{word.display}</em>
                  ))}
                </span>
              </li>
            )
          })}
        </ol>
        {done ? (
          <div className="sheet cascade duel-actions">
            {table.rematchOpen ? (
              <>
                <p className="note">{t.duel.rematchWaiting}</p>
                <button
                  type="button"
                  className="btn btn--play btn--block"
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
                onClick={() => {
                  armSound()
                  sound.go()
                  table.openRematch()
                }}
              >
                {t.duel.rematch}
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                table.closeRematch()
                table.leave()
              }}
            >
              {t.duel.quit}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}

export function DuelScreen({ lang }: { lang: string }) {
  const t = useT()
  const table = useDuelTable(lang)
  const wake = useCallback(() => armSound(), [])
  const { phase, seats } = table

  if (phase === 'setup') {
    return (
      <main className="stage stage--duel">
        <div className="sheet">
          <p className="eyebrow">{t.duel.title}</p>
          <h1 className="duel-title">{t.duel.leadTitle}</h1>
          <p className="note">{t.duel.lead}</p>
          <ul className="duel-bots">
            {HOUSE_BOTS.map((bot) => {
              const picked = table.invited.includes(bot.id)
              return (
                <li key={bot.id}>
                  <button
                    type="button"
                    className={`duel-bot${picked ? ' duel-bot--on' : ''}`}
                    aria-pressed={picked}
                    disabled={!picked && seats.length >= MAX_TABLE}
                    onClick={() => {
                      wake()
                      sound.tile('marimba', picked ? 3 : 5)
                      table.toggleInvite(bot.id)
                    }}
                  >
                    <Avatar choice={bot.avatar} size="md" />
                    <b>{bot.name}</b>
                    <small>{t.duel.trait[bot.trait]}</small>
                    <span className="duel-bot__mark" aria-hidden="true">
                      {picked ? (seats.length <= MIN_TABLE ? '•' : '✓') : '+'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {table.pool.length === 0 ? (
            <p className="note note--warn">{t.duel.loadFailed}</p>
          ) : (
            <button
              type="button"
              className="btn btn--play btn--block"
              onClick={() => {
                wake()
                sound.go()
                table.open()
              }}
            >
              {t.duel.invite(seats.length)}
            </button>
          )}
        </div>
      </main>
    )
  }

  if (phase === 'lobby' || phase === 'announcing') return <Lobby table={table} />
  if (table.error) {
    return (
      <main className="stage stage--duel">
        <div className="sheet">
          <p className="eyebrow">{t.duel.title}</p>
          <p className="note note--warn">{t.duel.loadFailed}</p>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => table.leave()}>
            {t.duel.back}
          </button>
        </div>
      </main>
    )
  }
  if (phase === 'draft' && table.duel) return <Draft table={table} />
  if (phase === 'countdown' && table.duel) {
    return (
      <main className="stage">
        <CountdownScreen
          categoryIds={table.duel.picks}
          reserve={0}
          swaps={0}
          swapping={false}
          onSwap={() => undefined}
          onDone={table.startPlay}
        />
      </main>
    )
  }
  if (phase === 'play' || phase === 'deaths') {
    if (table.duel && table.judge && table.prompt) return <Play table={table} />
  }
  if (phase === 'over' && table.duel) return <Over table={table} />
  return (
    <main className="stage stage--duel">
      <div className="sheet">
        <p className="eyebrow">{t.duel.title}</p>
      </div>
    </main>
  )
}