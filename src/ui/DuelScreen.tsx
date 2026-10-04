import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { DUEL_PASS_PENALTY_SECONDS, DUEL_RESERVE_SECONDS, duelRanking, humanPicks, type Duel } from '../domain/duel'
import { HOUSE_BOTS, MAX_TABLE, MIN_TABLE, useDuelTable, type Seat } from '../state/duel'
import type { Verdict } from '../domain/run'
import type { RarityTier } from '../domain/rarity'
import { categoryText, useT } from '../i18n'
import { armSound, sound, tierSound } from '../lib/sound'
import { Avatar } from './Avatar'
import { Burst, Shape, TierTag } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif } from './motifs'

/**
 * L'écran du duel : le salon, le draft, la partie et le récapitulatif. Tout ce
 * qui est règle vient du domaine, tout ce qui est temps vient de la table
 * (`useDuelTable`) ; ici, seulement ce que le joueur voit et entend.
 */

const TAU = Math.PI * 2

function reserveOf(duel: Duel, index: number, at: number): number {
  const player = duel.players[index]
  if (!player) return 0
  if (duel.turn?.player !== index) return Math.max(0, player.reserve)
  return Math.max(0, player.reserve - Math.max(0, at - duel.turn.startedAt))
}

/** La réserve du joueur en cours : un anneau qui se vide, jamais un chiffre seul. */
function ReserveRing({ seconds, urgent }: { seconds: number; urgent: boolean }) {
  const share = Math.max(0, Math.min(1, seconds / DUEL_RESERVE_SECONDS))
  const radius = 42
  return (
    <div className={`duel-ring${seconds <= 5 ? ' duel-ring--low' : ''}${urgent ? ' duel-ring--urgent' : ''}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="duel-ring__track" cx="50" cy="50" r={radius} fill="none" strokeWidth="8" />
        <circle
          className="duel-ring__fill"
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeDasharray={TAU * radius}
          strokeDashoffset={TAU * radius * (1 - share)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <b className="duel-ring__value">{seconds.toFixed(1)}</b>
      <span className="duel-ring__unit">s</span>
    </div>
  )
}

/** Un siège dans la bande du haut : avatar, nom, réserve, état. */
function SeatChip({ seat, seconds, active, dead, mine }: { seat: Seat; seconds: number; active: boolean; dead: boolean; mine: boolean }) {
  const t = useT()
  const share = Math.max(0, Math.min(1, seconds / DUEL_RESERVE_SECONDS))
  return (
    <div className={`duel-chip${active ? ' duel-chip--active' : ''}${dead ? ' duel-chip--dead' : ''}${mine ? ' duel-chip--mine' : ''}`}>
      <span className="duel-chip__face">
        <Avatar choice={seat.avatar} size="sm" />
        {dead ? (
          <span className="duel-chip__cross" aria-hidden="true">
            ✕
          </span>
        ) : null}
      </span>
      <b className="duel-chip__name">{mine ? t.duel.you : seat.name}</b>
      <span className="duel-chip__bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${share})` } as CSSProperties} />
      </span>
      <span className="duel-chip__seconds">{dead ? t.duel.out : `${Math.ceil(seconds)}`}</span>
    </div>
  )
}

/** Le couple : un bloc de couleur, la lettre en grand. */
function PromptCard({ categoryId, letter, note, front }: { categoryId: string; letter: string; note?: string; front: boolean }) {
  const t = useT()
  const text = categoryText(t, categoryId)
  const motif = categoryMotif(categoryId)
  return (
    <div className={`duel-prompt duel-prompt--${motif.tint}${front ? ' duel-prompt--front' : ''}`}>
      <span className="duel-prompt__icon" aria-hidden="true">
        <CategoryIcon categoryId={categoryId} tint={motif.tint} />
      </span>
      <span className="duel-prompt__body">
        <small>{text.label}</small>
        <strong>{letter}</strong>
        {note ? <em>{note}</em> : null}
      </span>
    </div>
  )
}

function saidText(t: ReturnType<typeof useT>, live: Verdict, mine: boolean, typing: boolean): string {
  if (!typing) return mine ? t.duel.hintMine : t.duel.hintWait
  if (live.kind === 'accepted') return live.found?.approximate ? t.duel.verdictClose : t.duel.verdictOk
  if (live.kind === 'unknown') return t.duel.verdictUnknown
  if (live.kind === 'wrong-letter') return t.duel.verdictWrong
  if (live.kind === 'already') return t.duel.verdictAlready
  return t.duel.hintMine
}

const BONUS: Record<RarityTier, number> = { courant: 0, 'peu commun': 1, rare: 1.5, 'très rare': 1.5 }
const VERDICT_CLASS: Partial<Record<Verdict['kind'], string>> = {
  unknown: 'duel-field--unknown',
  'wrong-letter': 'duel-field--wrong',
  already: 'duel-field--already',
  accepted: 'duel-field--ok',
}

export function DuelScreen({ lang }: { lang: string }) {
  const t = useT()
  const table = useDuelTable(lang)
  const { phase, seats, duel, at, event, prompt } = table
  // Le champ se vide quand le couple change, jamais quand il est hérité :
  // la frappe vit sous la clé du couple, et une clé neuve repart à vide.
  const roundKey = `${prompt?.categoryId ?? ''}:${prompt?.letter ?? ''}`
  const [typed, setTyped] = useState({ key: '', text: '' })
  const draft = typed.key === roundKey ? typed.text : ''
  const field = useRef<HTMLInputElement>(null)
  const mine = table.myTurn
  const alive = duel ? duel.players[table.myIndex]?.alive !== false : true
  const live = useMemo<Verdict>(
    () => (phase === 'play' && alive ? table.inspect(draft) : { kind: 'empty', found: null }),
    [alive, draft, phase, table],
  )
  const accepted = live.kind === 'accepted'
  const seconds = duel ? reserveOf(duel, table.myIndex, at) : 0
  const wake = useCallback(() => armSound(), [])
  const type = useCallback((text: string) => setTyped({ key: roundKey, text }), [roundKey])

  // Le champ garde le focus : perdre le clavier coûte la manche suivante.
  useEffect(() => {
    if (phase === 'play' && alive) field.current?.focus()
  }, [alive, mine, phase, prompt?.categoryId, prompt?.letter])

  // Ce que le champ dit s'entend : nommé, ou à une lettre près — jamais le palier.
  const heard = !accepted ? null : live.found?.approximate ? 'close' : 'named'
  useEffect(() => {
    if (heard === 'named') sound.recognized()
    else if (heard === 'close') sound.oneLetterOff()
  }, [heard])

  const seen = useRef(0)
  useEffect(() => {
    if (!event) return
    if (event.kind === 'dead') sound.timeUp()
    else if (event.kind === 'failed') sound.refused()
    else if (event.kind === 'over') sound.go()
    else if (event.kind === 'solved' && event.tier && event.id !== seen.current) {
      sound.found(tierSound(event.tier, false), Math.min(3, event.player))
    }
    seen.current = event.id
  }, [event])

  // Les dernières secondes battent, une fois par seconde.
  const shown = Math.ceil(seconds)
  useEffect(() => {
    if (!mine || shown > 5 || shown <= 0) return
    sound.tick(shown)
  }, [mine, shown])

  const submit = useCallback(
    (formEvent?: FormEvent) => {
      formEvent?.preventDefault()
      wake()
      if (!mine) return
      if (!accepted && draft.trim() !== '') sound.refused()
      table.play(draft)
    },
    [accepted, draft, mine, table, wake],
  )

  if (phase === 'setup') {
    return (
      <main className="duel duel--setup">
        <h1 className="duel__title">{t.duel.title}</h1>
        <p className="duel__lead">{t.duel.lead}</p>
        <ul className="duel__bots">
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
                  <Avatar choice={bot.avatar} size="fill" />
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
        <p className="duel__note">{t.duel.inviteNote}</p>
        {table.pool.length === 0 ? (
          <p className="duel__note">{t.duel.loadFailed}</p>
        ) : (
          <button
            type="button"
            className="duel__go"
            onClick={() => {
              wake()
              sound.go()
              table.open()
            }}
          >
            {t.duel.invite(seats.length)}
          </button>
        )}
      </main>
    )
  }

  if (phase === 'lobby' || phase === 'countdown') {
    const left = Math.max(0, Math.ceil(table.countdownEndsAt - at))
    return (
      <main className="duel duel--lobby">
        <h1 className="duel__title">{phase === 'countdown' ? t.duel.go : t.duel.lobbyTitle}</h1>
        <ul className="duel__table">
          {seats.map((seat, index) => (
            <li key={seat.id} className={`duel-seat${table.ready[seat.id] ? ' duel-seat--ready' : ''}`} style={{ '--i': index } as CSSProperties}>
              <Avatar choice={seat.avatar} size="fill" />
              <b>{seat.bot ? seat.name : t.duel.you}</b>
              <span className="duel-seat__stamp">{table.ready[seat.id] ? t.duel.ready : t.duel.waiting}</span>
            </li>
          ))}
        </ul>
        {phase === 'countdown' ? (
          <p className="duel__count" aria-live="assertive">
            <b key={left}>{left > 0 ? left : t.duel.go}</b>
          </p>
        ) : (
          <button
            type="button"
            className={`duel__go${table.ready.me ? ' duel__go--done' : ''}`}
            disabled={!!table.ready.me}
            onClick={() => {
              wake()
              sound.beat()
              table.markReady()
            }}
          >
            {table.ready.me ? t.duel.waitingOthers : t.duel.readyButton}
          </button>
        )}
        <button type="button" className="duel__leave" onClick={() => table.leave()}>
          {t.duel.quit}
        </button>
      </main>
    )
  }

  if (phase === 'loading' || table.error) {
    return (
      <main className="duel duel--loading">
        <span className="duel-loader" aria-hidden="true">
          <Shape kind="triangle" tint="red" />
          <Shape kind="circle" tint="blue" />
          <Shape kind="square" tint="yellow" />
        </span>
        <p>{table.error ? t.duel.loadFailed : t.duel.loading}</p>
        {table.error ? (
          <button type="button" className="duel__go" onClick={() => table.leave()}>
            {t.duel.back}
          </button>
        ) : null}
      </main>
    )
  }

  if (phase === 'draft' && duel) {
    const actor = duel.order[duel.picks.length % duel.order.length] ?? 0
    const actorSeat = seats[actor]
    const mineToPick = actor === table.myIndex
    const chosen = humanPicks(duel.players.length)
    return (
      <main className="duel duel--draft">
        <h1 className="duel__title">{t.duel.draftTitle}</h1>
        <p className="duel__turn" aria-live="polite">
          {mineToPick ? <b>{t.duel.draftYours}</b> : t.duel.draftTurn(actorSeat?.bot ? actorSeat.name : t.duel.you)}
        </p>
        <div className="duel__pool" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => {
            const id = duel.picks[index]
            return (
              <span
                key={index}
                className={`duel-slot${id ? ' duel-slot--full' : ''}${index >= chosen ? ' duel-slot--drawn' : ''}`}
                style={{ '--i': index } as CSSProperties}
              >
                {id ? <CategoryIcon categoryId={id} tint={categoryMotif(id).tint} /> : null}
              </span>
            )
          })}
        </div>
        <div className="duel__grid">
          {table.pool.map((id) => {
            const text = categoryText(t, id)
            const place = duel.picks.indexOf(id)
            const used = place >= 0
            const who = used && place < chosen ? seats[duel.order[place % duel.order.length] ?? 0] : null
            return (
              <button
                key={id}
                type="button"
                className={`duel-pick${used ? ' duel-pick--used' : ''}${used && place >= chosen ? ' duel-pick--drawn' : ''}`}
                disabled={!mineToPick || used}
                onClick={() => {
                  wake()
                  sound.tile('glass', 2)
                  table.pick(id)
                }}
              >
                <span className="duel-pick__icon" aria-hidden="true">
                  <CategoryIcon categoryId={id} tint={categoryMotif(id).tint} />
                </span>
                <b>{text.label}</b>
                <small>{used ? (place >= chosen ? t.duel.drawn : who?.bot ? who.name : t.duel.you) : text.hint}</small>
              </button>
            )
          })}
        </div>
      </main>
    )
  }

  if (phase === 'over' && duel) {
    const order = duelRanking(duel)
    const champion = order[0] ?? 0
    const win = champion === table.myIndex
    return (
      <main className="duel duel--over">
        {win ? <Burst /> : null}
        <h1 className="duel__title">{win ? t.duel.youWin : t.duel.overTitle(seats[champion]?.bot ? seats[champion]!.name : t.duel.you)}</h1>
        <ol className="duel__ranking">
          {order.map((index, place) => {
            const seat = seats[index]
            const player = duel.players[index]
            if (!seat || !player) return null
            return (
              <li key={seat.id} className={`duel-rank${place === 0 ? ' duel-rank--first' : ''}${player.alive ? '' : ' duel-rank--dead'}`}>
                <span className="duel-rank__place">{place + 1}</span>
                <Avatar choice={seat.avatar} size="sm" />
                <span className="duel-rank__who">
                  <b>{seat.bot ? seat.name : t.duel.you}</b>
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
        <div className="duel__actions">
          <button
            type="button"
            className="duel__go"
            onClick={() => {
              wake()
              sound.go()
              table.rematch()
            }}
          >
            {t.duel.rematch}
          </button>
          <button type="button" className="duel__leave" onClick={() => table.leave()}>
            {t.duel.quit}
          </button>
        </div>
      </main>
    )
  }

  if (phase === 'play' && duel && prompt) {
    const turn = duel.turn
    const turnSeat = turn ? seats[turn.player] : null
    const watching = table.watching
    const typing = draft.trim() !== ''
    return (
      <main className={`duel duel--play${watching ? ' duel--watching' : ''}${alive ? '' : ' duel--out'}`}>
        <ul className="duel__strip">
          {seats.map((seat, index) => (
            <li key={seat.id}>
              <SeatChip
                seat={seat}
                seconds={reserveOf(duel, index, at)}
                active={turn?.player === index}
                dead={duel.players[index]?.alive === false}
                mine={index === table.myIndex}
              />
            </li>
          ))}
        </ul>

        <div className="duel__stage">
          <div className="duel__against">
            {watching && turnSeat ? (
              <>
                <span className="duel__against-who">
                  <Avatar choice={turnSeat.avatar} size="sm" />
                  <b>{turnSeat.bot ? turnSeat.name : t.duel.you}</b>
                </span>
                <PromptCard categoryId={prompt.categoryId} letter={prompt.letter} front={false} />
                <span className="duel__against-ring">
                  <ReserveRing seconds={reserveOf(duel, turn!.player, at)} urgent={false} />
                </span>
              </>
            ) : (
              <span className="duel__against-idle">{t.duel.faceNote}</span>
            )}
          </div>

          <section className="duel__front">
            {alive ? (
              <>
                <PromptCard
                  categoryId={prompt.categoryId}
                  letter={prompt.letter}
                  note={mine ? undefined : t.duel.inherited}
                  front
                />
                {mine ? <ReserveRing seconds={seconds} urgent={seconds <= 5} /> : null}
                <form className={`duel-field${VERDICT_CLASS[live.kind] ? ` ${VERDICT_CLASS[live.kind]}` : ''}`} onSubmit={submit}>
                  <input
                    ref={field}
                    value={draft}
                    onChange={(changeEvent) => {
                      wake()
                      sound.key(changeEvent.target.value.length < draft.length)
                      type(changeEvent.target.value)
                    }}
                    onFocus={wake}
                    placeholder={t.duel.fieldPlaceholder}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="send"
                    aria-label={t.duel.fieldPlaceholder}
                  />
                  <p className={`duel-field__said${accepted ? ' duel-field__said--ok' : ''}`} aria-live="polite">
                    {saidText(t, live, mine, typing)}
                  </p>
                  <div className="duel-field__row">
                    <button type="submit" className="duel-field__go" disabled={!mine || (!accepted && !typing)}>
                      {t.duel.validate}
                    </button>
                    <button
                      type="button"
                      className="duel-field__pass"
                      disabled={!mine}
                      onClick={() => {
                        wake()
                        sound.skipped()
                        table.pass()
                      }}
                    >
                      {t.duel.pass(DUEL_PASS_PENALTY_SECONDS)}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <p className="duel__out-note">{t.duel.spectating}</p>
            )}
          </section>
        </div>

        {/* Les faits de la table : un tampon qui passe, jamais une boîte de dialogue. */}
        {event && event.kind !== 'ready' && event.kind !== 'picked' ? (
          <div key={event.id} className={`duel-flash duel-flash--${event.kind}`} aria-live="polite">
            {event.kind === 'dead' ? <b>{t.duel.dead(seats[event.player]?.bot ? seats[event.player]!.name : t.duel.you)}</b> : null}
            {event.kind === 'failed' ? <b>{t.duel.failed}</b> : null}
            {event.kind === 'over' ? <b>{t.duel.overTitle(seats[event.player]?.bot ? seats[event.player]!.name : t.duel.you)}</b> : null}
            {event.kind === 'solved' ? (
              <>
                <b>
                  {event.player === table.myIndex
                    ? t.duel.youFound(event.word ?? '')
                    : t.duel.solved(seats[event.player]?.bot ? seats[event.player]!.name : t.duel.you, event.word ?? '')}
                </b>
                {event.tier ? <TierTag tier={event.tier} /> : null}
                {event.tier && event.tier !== 'courant' ? <em>{t.duel.bonus(BONUS[event.tier])}</em> : null}
              </>
            ) : null}
          </div>
        ) : null}
      </main>
    )
  }

  return null
}
