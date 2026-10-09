import { useEffect, type CSSProperties } from 'react'
import { ENDURANCE_TIME_BONUS, MODE_SECONDS, type ArcadeMode } from '../domain/modes'
import type { RarityTier } from '../domain/rarity'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { TierTag } from './bauhaus'
import { onTint } from './motifs'
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
 * Un chrono à trente secondes qui se vide, puis un mot qui le regonfle : la
 * boucle tient en dix secondes de CSS, sans minuterie.
 */
function EnduranceDemo() {
  const t = useT()
  return (
    <div className="wk-demo" aria-hidden="true">
      <span className="wk-demo-ring" />
      <span className="wk-demo-clock">{MODE_SECONDS.endurance}</span>
      <span className="wk-demo-gain wk-demo-gain--a">{t.weekly.run.bonus(2)}</span>
      <span className="wk-demo-gain wk-demo-gain--b">{t.weekly.run.bonus(4)}</span>
    </div>
  )
}
