import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { DUEL_PASS_PENALTY_SECONDS, DUEL_TIME_BONUS } from '../domain/duel'
import { capitalized, initialOf } from '../domain/text'
import { categoryText, useT } from '../i18n'
import { sound } from '../lib/sound'
import { HOUSE_BOTS, type Seat } from '../state/duel'
import { Avatar } from './Avatar'
import { LetterMark } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif, onTint } from './motifs'

/**
 * Le tuto du premier lancement : trois vignettes animées, une par temps du
 * duel, que le joueur fait défiler lui-même. Elles tournent en boucle sous son
 * doigt et ne l'emmènent jamais — les trois étapes tiennent dans un seul écran,
 * et le salon garde de quoi les revoir.
 */

/** Les trois temps, dans l'ordre du duel : la table, le draft, la partie. */
const STEPS = ['seats', 'draft', 'play'] as const
/** Les catégories de la vignette du draft : celles que le duel distribue en premier. */
const DRAFT_TILES = ['pays', 'animaux', 'couleurs'] as const

/** Les places qui se forment : la mienne, puis les trois joueurs maison. */
function SeatsArt({ me }: { me: Seat }) {
  const t = useT()
  const tiles = [
    { id: 'me', name: t.duel.you, avatar: me.avatar },
    ...HOUSE_BOTS.map((bot) => ({ id: bot.id, name: bot.name, avatar: bot.avatar })),
  ]
  return (
    <ul className="rules-seats">
      {tiles.map((seat, index) => (
        <li key={seat.id} className="rules-seat" style={{ '--i': index } as CSSProperties}>
          <Avatar choice={seat.avatar} size="md" />
          <b>{seat.name}</b>
          <span className="rules-seat__stamp">{t.duel.ready}</span>
        </li>
      ))}
    </ul>
  )
}

/** Le draft : trois catégories prises à tour de rôle, la dernière au sort, dix secondes par choix. */
function DraftArt() {
  const t = useT()
  return (
    <div className="rules-draft">
      <ul className="rules-tiles">
        {DRAFT_TILES.map((id, index) => {
          const motif = categoryMotif(id)
          return (
            <li
              key={id}
              className="rules-tile"
              style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
            >
              <CategoryIcon categoryId={id} tint={onTint(motif.tint)} className="rules-tile__icon" />
              <span>{categoryText(t, id).label}</span>
            </li>
          )
        })}
        <li className="rules-tile rules-tile--luck" style={{ '--i': DRAFT_TILES.length } as CSSProperties}>
          <b>?</b>
          <span>{t.duel.drawn}</span>
        </li>
      </ul>
      <span className="rules-fuse" aria-hidden="true">
        <i />
      </span>
    </div>
  )
}

/** La partie : le couple, le mot qui s'écrit, et le temps que le mot rend ou coûte. */
function PlayArt() {
  const t = useT()
  const answer = capitalized(t.colours.rouge ?? '')
  const motif = categoryMotif('couleurs')
  const category = categoryText(t, 'couleurs')
  return (
    <div className="rules-play">
      <section className="prompt rules-prompt">
        <span className="duel-prompt__mark">
          <LetterMark letter={initialOf(answer)} motif={motif} size="md" />
        </span>
        <div className="prompt-text">
          <h2 className="prompt-label">{category.label}</h2>
          <p className="note">{category.hint}</p>
        </div>
      </section>
      <span className="rules-field">
        <b className="rules-typed">{answer}</b>
      </span>
      <span className="rules-meter">
        <span className="rules-bar" aria-hidden="true">
          <i />
        </span>
        <em className="rules-bonus">{t.duel.seconds(DUEL_TIME_BONUS.rare)}</em>
        <em className="rules-cost">{t.run.skip(DUEL_PASS_PENALTY_SECONDS)}</em>
      </span>
    </div>
  )
}

interface DuelTutorialProps {
  /** Ma place, telle que le salon la pose : mon avatar vient de l'appareil. */
  me: Seat
  /** Le tuto refermé : les règles sont lues, la partie peut commencer. */
  onDone(): void
}

/**
 * Les règles du duel, montrées plutôt que racontées : chaque étape allume sa
 * vignette, la puce dit où l'on en est, et le bouton porte le pas suivant.
 * La feuille seule : `DuelScreen` la pose dans la scène du duel, la planche
 * debug dans la sienne.
 */
export function DuelTutorial({ me, onDone }: DuelTutorialProps) {
  const t = useT()
  const [step, setStep] = useState<(typeof STEPS)[number]>('seats')
  const index = STEPS.indexOf(step)
  const last = index === STEPS.length - 1
  const text = t.duel.tutorial[step]

  // Une étape qui arrive s'entend, comme les tuiles du compte à rebours.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    sound.tile('glass', 2 + index)
  }, [index])

  const done = () => {
    sound.go()
    onDone()
  }

  return (
    <div className="sheet duel-rules">
      <div className="spread">
        <p className="eyebrow">{t.duel.tutorial.label}</p>
        <button type="button" className="btn btn--quiet btn--muted" onClick={done}>
          {t.duel.tutorial.skip}
        </button>
      </div>

      <h1 className="duel-title" key={`title-${step}`}>
        {text.title}
      </h1>

      <div className="rules-vignette" key={`art-${step}`} aria-hidden="true">
        {step === 'seats' ? <SeatsArt me={me} /> : step === 'draft' ? <DraftArt /> : <PlayArt />}
      </div>

      <p className="note rules-text" key={`text-${step}`}>
        {text.text}
      </p>

      <ol className="rules-dots">
        {STEPS.map((id, place) => (
          <li key={id}>
            <button
              type="button"
              className={`rules-dot${id === step ? ' rules-dot--on' : ''}`}
              aria-label={t.duel.tutorial.stepLabel(place + 1, STEPS.length)}
              aria-current={id === step}
              onClick={() => setStep(id)}
            />
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn btn--play btn--block duel-cta"
        onClick={() => {
          if (last) done()
          else setStep(STEPS[index + 1]!)
        }}
      >
        {last ? t.duel.tutorial.start : t.duel.tutorial.next}
      </button>
    </div>
  )
}
