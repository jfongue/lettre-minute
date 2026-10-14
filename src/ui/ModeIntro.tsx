import { useEffect, useState, type CSSProperties } from 'react'
import { ENDURANCE_TIME_BONUS, MODE_SECONDS, type ArcadeMode } from '../domain/modes'
import type { RarityTier } from '../domain/rarity'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { TierTag } from './bauhaus'
import { onTint } from './motifs'
import { reducedMotion } from './useCountUp'
import { MODE_TINTS, ModeGlyph } from './WeeklyParts'

const TIERS: readonly RarityTier[] = ['courant', 'peu commun', 'rare', 'très rare']
const STEP_TINTS = ['yellow', 'pink', 'blue'] as const

/**
 * Ce que le mode change, en trois temps et une image : pour l'endurance, un
 * chrono qui se vide, des mots qui le regonflent, et ce que chaque rareté
 * rend. Le même écran sert au défi du moment et à la réserve des modes.
 */
export function ModeIntro({
  mode,
  onDone,
  onTry,
}: {
  mode: ArcadeMode
  onDone(): void
  /** Absent : pas de leçon à jouer derrière. */
  onTry?(): void
}) {
  const t = useT()
  const tint = MODE_TINTS[mode]
  const text = t.weekly.intro[mode]

  useEffect(() => {
    sound.tile('marimba', 2, 0.1)
    sound.tile('glass', 5, 0.3)
  }, [])

  return (
    <div className={`sheet wk-intro wk-intro--${mode}`}>
      <header className="wk-intro-head" style={{ background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}>
        <span className="wk-intro-mark">
          <ModeGlyph mode={mode} />
        </span>
        <div className="wk-intro-title">
          <span className="wk-kicker">{t.weekly.intro.kicker}</span>
          <h1>{t.modes[mode]}</h1>
        </div>
      </header>

      {mode === 'endurance' && <EnduranceDemo />}

      {/* Les règles se lisent ensemble : le cadre paysage de CrazyGames les range
          dans une colonne qui défile, à côté du titre et de « Suivant ». */}
      <div className="wk-intro-rules">
        <ol className="wk-steps">
          {text.steps.map(([head, body], index) => (
            <li key={head} className="wk-step" style={{ '--i': index } as CSSProperties}>
              <span className="wk-step-n" style={{ background: `var(--${STEP_TINTS[index % STEP_TINTS.length]})` }}>
                {index + 1}
              </span>
              <span className="wk-step-text">
                <strong>{head}</strong>
                <span>{body}</span>
              </span>
            </li>
          ))}
        </ol>

        {mode === 'endurance' && (
          <section className="wk-table" aria-label={t.weekly.intro.endurance.table}>
            <p className="section-title">{t.weekly.intro.endurance.table}</p>
            <ul>
              {TIERS.map((tier) => (
                <li key={tier}>
                  <TierTag tier={tier} />
                  <span className="wk-table-bar" aria-hidden="true">
                    <span style={{ width: `${(ENDURANCE_TIME_BONUS[tier] / 4) * 100}%` }} />
                  </span>
                  <strong>+{t.weekly.run.bonus(ENDURANCE_TIME_BONUS[tier]).slice(1)}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <p className="wk-intro-score">
        <span className="wk-intro-score-mark" aria-hidden="true" />
        <span>{text.score}</span>
      </p>

      <div className="stack">
        <button type="button" className="btn btn--blue btn--block" onClick={onDone}>
          {t.weekly.intro.next}
        </button>
        {onTry && (
          <button type="button" className="btn btn--ghost btn--block" onClick={onTry}>
            {t.weekly.intro.try}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Le chrono de la démonstration joue ses trente secondes à deux fois et demie,
 * et deux mots tombent en route : l'anneau et le chiffre sortent de la même
 * valeur, à la seconde près, plutôt que de se contredire.
 */
const DEMO_RATE = 2.5
const DEMO_LOOP_SECONDS = 12
const DEMO_GAINS = [
  { at: 4, side: 'a', seconds: ENDURANCE_TIME_BONUS.courant },
  { at: 8, side: 'b', seconds: ENDURANCE_TIME_BONUS['très rare'] },
] as const

function EnduranceDemo() {
  const t = useT()
  const still = reducedMotion()
  const [atSeconds, setAtSeconds] = useState(0)

  useEffect(() => {
    if (still) return
    const start = performance.now()
    const timer = setInterval(() => setAtSeconds(((performance.now() - start) / 1000) % DEMO_LOOP_SECONDS), 100)
    return () => clearInterval(timer)
  }, [still])

  const gained = DEMO_GAINS.reduce((sum, gain) => (atSeconds >= gain.at ? sum + gain.seconds : sum), 0)
  const left = MODE_SECONDS.endurance + gained - DEMO_RATE * atSeconds
  const remaining = Math.min(MODE_SECONDS.endurance, Math.max(0, left))
  // Chaque pastille arrive à l'instant où son mot tombe : le chiffre monte de
  // ce qu'elle annonce, et l'anneau avec lui.
  const shown = still ? DEMO_GAINS : DEMO_GAINS.filter((gain) => atSeconds >= gain.at)

  return (
    <div className="wk-demo" aria-hidden="true">
      <span className="wk-demo-ring" style={{ '--wk-ring': remaining / MODE_SECONDS.endurance } as CSSProperties} />
      <span className="wk-demo-clock">{Math.ceil(remaining)}</span>
      {shown.map((gain) => (
        <span key={gain.at} className={`wk-demo-gain wk-demo-gain--${gain.side}`}>
          {t.weekly.run.bonus(gain.seconds)}
        </span>
      ))}
    </div>
  )
}
