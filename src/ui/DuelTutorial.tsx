import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DUEL_PASS_PENALTY_SECONDS, DUEL_RESERVE_SECONDS, DUEL_TIME_BONUS, reserveShown } from '../domain/duel'
import { capitalized, initialOf } from '../domain/text'
import { useT, type Messages } from '../i18n'
import { sound } from '../lib/sound'
import { HOUSE_BOTS, type Seat } from '../state/duel'
import { Avatar } from './Avatar'
import { LetterMark } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif, onTint } from './motifs'

/**
 * Les règles du duel, montrées en trois temps : la table, les thèmes, la
 * partie. Chaque temps est une saynète qui tourne en boucle dans un cadre, et
 * le bouton du bas passe au suivant. Une saynète ne garde que ce qui porte la
 * règle — des avatars, des tuiles, une lettre —, jamais un nom ni un libellé :
 * le cadre reste lisible à 375 px comme sur un écran large. Rien n'y est
 * cliquable ; « Je joue » rend la main.
 */

/** Les trois temps du tuto, dans l'ordre : la puce du haut les numérote. */
const STEPS = 3

const POOL = ['couleurs', 'pays', 'animaux', 'metiers', 'fruits-legumes'] as const
/** La catégorie jouée dans la troisième saynète. */
const PLAYED = POOL[0]

/** Une image d'une saynète : ce qu'elle montre pendant `ms`, et son bruit. */
interface Beat {
  ms: number
  cue?: () => void
}

interface SeatBeat extends Beat {
  seated: number
  ready?: boolean
}

/** 1 — les places se remplissent, puis la table se déclare prête. */
const TABLE_BEATS: readonly SeatBeat[] = [
  { ms: 460, cue: () => sound.tile('marimba', 3), seated: 1 },
  { ms: 460, cue: () => sound.tile('marimba', 4), seated: 2 },
  { ms: 460, cue: () => sound.tile('marimba', 5), seated: 3 },
  { ms: 1200, cue: () => sound.go(), seated: 4, ready: true },
]

interface PickBeat extends Beat {
  /** Les tuiles déjà prises, dans l'ordre de la table. */
  picks: number
  /** La dernière catégorie, tombée au sort. */
  luck?: boolean
  /** La place que le tirage allume, puis celle de l'ouvreur. */
  lit?: number
}

/** 2 — les thèmes tombent un à un, le sort complète la liste et ouvre. */
const PICK_BEATS: readonly PickBeat[] = [
  { ms: 600, cue: () => sound.tile('glass', 3), picks: 1 },
  { ms: 600, cue: () => sound.tile('glass', 4), picks: 2 },
  { ms: 600, cue: () => sound.tile('glass', 5), picks: 3 },
  { ms: 600, cue: () => sound.tile('glass', 6), picks: 4 },
  { ms: 1000, cue: () => sound.tile('wood', 4), picks: 4, luck: true },
  { ms: 200, cue: () => sound.tile('wood', 5), picks: 4, luck: true, lit: 0 },
  { ms: 200, cue: () => sound.tile('wood', 5), picks: 4, luck: true, lit: 1 },
  { ms: 200, cue: () => sound.tile('wood', 5), picks: 4, luck: true, lit: 2 },
  { ms: 1200, cue: () => sound.news(), picks: 4, luck: true, lit: 1 },
]

interface PlayBeat extends Beat {
  /** La place dont c'est le tour ; aucune pendant une mort. */
  holder: number | null
  /** La part du mot déjà écrite, de 0 à 1. */
  typed: number
  reserves: readonly number[]
  dead: readonly number[]
  chip?: { player: number; delta: number }
}

/** 3 — une passe, une mort, un mot trouvé, la dernière place qui lâche. */
const PLAY_BEATS: readonly PlayBeat[] = [
  { ms: 700, cue: () => sound.tile('glass', 4), holder: 1, typed: 0, reserves: [27, 26, 24, 25], dead: [] },
  {
    ms: 900,
    cue: () => sound.skipped(),
    holder: 1,
    typed: 0,
    reserves: [27, 24, 24, 25],
    dead: [],
    chip: { player: 1, delta: -DUEL_PASS_PENALTY_SECONDS },
  },
  { ms: 700, cue: () => sound.tile('glass', 5), holder: 2, typed: 0, reserves: [27, 24, 24, 25], dead: [] },
  { ms: 900, cue: () => sound.tick(3), holder: 2, typed: 0, reserves: [27, 24, 3, 25], dead: [] },
  { ms: 1700, cue: () => sound.timeUp(), holder: null, typed: 0, reserves: [28, 25, 0, 26], dead: [2] },
  { ms: 700, cue: () => sound.tile('glass', 4), holder: 0, typed: 0, reserves: [28, 25, 0, 26], dead: [2] },
  { ms: 320, cue: () => sound.key(), holder: 0, typed: 0.45, reserves: [27.7, 25, 0, 26], dead: [2] },
  { ms: 340, cue: () => sound.key(), holder: 0, typed: 1, reserves: [27.5, 25, 0, 26], dead: [2] },
  {
    ms: 1500,
    cue: () => sound.recognized(),
    holder: 0,
    typed: 1,
    reserves: [27.5 + DUEL_TIME_BONUS.rare, 25, 0, 26],
    dead: [2],
    chip: { player: 0, delta: DUEL_TIME_BONUS.rare },
  },
  { ms: 2200, cue: () => sound.crowned(true), holder: null, typed: 1, reserves: [27, 26, 0, 0], dead: [2, 3] },
]

/** Rejoue les images d'une saynète en boucle : chacune tient son temps. */
function useScene<F extends Beat>(beats: readonly F[]): F {
  const [at, setAt] = useState(0)
  const frame = beats[at % beats.length]!
  // Le bruit d'une image se joue une fois : un rendu de plus ne le répète pas.
  const heard = useRef<F | null>(null)
  useEffect(() => {
    if (heard.current !== frame) {
      heard.current = frame
      frame.cue?.()
    }
    const timer = setTimeout(() => setAt((current) => (current + 1) % beats.length), frame.ms)
    return () => clearTimeout(timer)
  }, [frame, beats])
  return frame
}

/** 1 — la table : les places se remplissent, puis se cochent. */
function TableScene({ seats }: { seats: readonly Seat[] }) {
  const frame = useScene(TABLE_BEATS)
  return (
    <ol className="demo-seats">
      {seats.map((seat, index) => {
        const state = index >= frame.seated ? 'empty' : frame.ready ? 'ready' : 'seated'
        return (
          <li key={seat.id} className={`demo-seat demo-seat--${state}`}>
            {state === 'empty' ? null : <Avatar choice={seat.avatar} size="md" />}
            {state === 'ready' ? (
              <span className="demo-seat__tick" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** 2 — les thèmes : les tuiles tombent, la dernière au sort, puis l'ouvreur. */
function PickScene({ seats }: { seats: readonly Seat[] }) {
  const frame = useScene(PICK_BEATS)
  const drawn = POOL[POOL.length - 1]!
  const shown = (id: string): CSSProperties => {
    const tint = categoryMotif(id).tint
    return { background: `var(--${tint})`, color: `var(--${onTint(tint)})` }
  }
  return (
    <div className="demo-picks">
      <ol className="demo-pool">
        {POOL.slice(0, POOL.length - 1).map((id, index) => {
          const mine = index < frame.picks
          return (
            <li key={id} className={`demo-pool__tile${mine ? ' demo-pool__tile--taken' : ''}`} style={mine ? shown(id) : undefined}>
              {mine ? (
                <CategoryIcon categoryId={id} tint={onTint(categoryMotif(id).tint)} className="demo-pool__icon" />
              ) : (
                <span className="demo-pool__dot" aria-hidden="true" />
              )}
            </li>
          )
        })}
        <li className={`demo-pool__tile${frame.luck ? ' demo-pool__tile--taken' : ''}`} style={frame.luck ? shown(drawn) : undefined}>
          {frame.luck ? (
            <CategoryIcon categoryId={drawn} tint={onTint(categoryMotif(drawn).tint)} className="demo-pool__icon" />
          ) : (
            <span className="demo-pool__dot demo-pool__dot--luck" aria-hidden="true">
              ?
            </span>
          )}
        </li>
      </ol>

      <ol className="demo-seats">
        {seats.map((seat, index) => (
          <li key={seat.id} className={`demo-seat demo-seat--seated${index === frame.lit ? ' demo-seat--lit' : ''}`}>
            <Avatar choice={seat.avatar} size="md" />
          </li>
        ))}
      </ol>
    </div>
  )
}

/** 3 — la partie : la table, ses réserves, et le mot qui s'écrit. */
function PlayScene({ seats, answer }: { seats: readonly Seat[]; answer: string }) {
  const t = useT()
  const frame = useScene(PLAY_BEATS)
  const letter = initialOf(answer)
  const typed = answer.slice(0, Math.max(1, Math.round(answer.length * frame.typed)))
  const solved = typed === answer
  return (
    <div className="demo-play">
      <ol className="demo-strip">
        {seats.map((seat, index) => {
          const dead = frame.dead.includes(index)
          const active = frame.holder === index && !dead
          const seconds = frame.reserves[index] ?? DUEL_RESERVE_SECONDS
          const chip = frame.chip?.player === index ? frame.chip : null
          return (
            <li key={seat.id} className={`demo-slot${active ? ' demo-slot--active' : ''}${dead ? ' demo-slot--dead' : ''}`}>
              <Avatar choice={seat.avatar} size="sm" />
              <span className="demo-slot__bar" aria-hidden="true">
                <i style={{ transform: `scaleX(${Math.min(1, seconds / DUEL_RESERVE_SECONDS)})` } as CSSProperties} />
              </span>
              <span className="demo-slot__clock">{dead ? '✕' : active ? `${reserveShown(seconds)}s` : ''}</span>
              {chip ? (
                <em className={`demo-slot__delta${chip.delta < 0 ? ' demo-slot__delta--loss' : ''}`}>
                  {t.duel.seconds(chip.delta)}
                </em>
              ) : null}
            </li>
          )
        })}
      </ol>

      <span className="demo-prompt">
        <LetterMark letter={letter} motif={categoryMotif(PLAYED)} size="md" />
      </span>
      <span className={`demo-word${solved ? ' demo-word--valid' : ''}`}>
        {typed}
        {solved ? null : <span className="demo-caret" aria-hidden="true" />}
      </span>
    </div>
  )
}

/** Ce que la feuille dit sous sa saynète, selon le temps qui joue. */
function copyFor(t: Messages, step: number): { title: string; text: string } {
  if (step === 0) return t.duel.tutorial.seats
  return step === 1 ? t.duel.tutorial.draft : t.duel.tutorial.play
}

interface DuelTutorialProps {
  /** Ma place, telle que le salon la pose : mon avatar vient de l'appareil. */
  me: Seat
  /** Le tuto refermé : les règles sont lues, la partie peut commencer. */
  onDone(): void
}

/**
 * Les règles du duel : trois saynètes qui tournent en boucle, avec les vraies
 * figures du jeu. Le salon rouvre la feuille par « Revoir les règles ».
 */
export function DuelTutorial({ me, onDone }: DuelTutorialProps) {
  const t = useT()
  const [step, setStep] = useState(0)
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
  const caption = copyFor(t, step)
  const last = step === STEPS - 1
  const leave = (): void => {
    sound.go()
    onDone()
  }

  return (
    <div className="sheet duel-rules">
      <div className="spread">
        <p className="eyebrow">
          {t.duel.tutorial.label} · {t.duel.tutorial.stepLabel(step + 1, STEPS)}
        </p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={leave}>
          {t.duel.tutorial.skip}
        </button>
      </div>

      <div className="demo-stage" key={step} aria-hidden="true">
        {step === 0 ? (
          <TableScene seats={seats} />
        ) : step === 1 ? (
          <PickScene seats={seats} />
        ) : (
          <PlayScene seats={seats} answer={answer} />
        )}
      </div>

      <h1 className="duel-title" key={`title-${caption.title}`}>
        {caption.title}
      </h1>
      <p className="note demo-text" key={`text-${step}`}>
        {caption.text}
      </p>

      <button
        type="button"
        className="btn btn--play btn--block duel-cta"
        onClick={
          last
            ? leave
            : () => {
                sound.pop()
                setStep(step + 1)
              }
        }
      >
        {last ? t.duel.tutorial.start : t.duel.tutorial.next}
      </button>
    </div>
  )
}
