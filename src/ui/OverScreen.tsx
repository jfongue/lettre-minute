import type { CSSProperties } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { capitalized } from '../domain/text'
import { levelProgress, newlyUnlocked, XP_PER_POINT, type Profile } from '../domain/progression'
import type { Run } from '../domain/run'
import { useCountUp } from './useCountUp'

interface OverScreenProps {
  run: Run
  profile: Profile
  levelBefore: number
  onReplay(): void
  onHome(): void
}

export function OverScreen({ run, profile, levelBefore, onReplay, onHome }: OverScreenProps) {
  const progress = levelProgress(profile.xp)
  const opened = newlyUnlocked(levelBefore, progress.level)
  const best = [...run.found].sort((a, b) => b.points - a.points)[0]
  const shownScore = useCountUp(run.score)

  return (
    <div className="sheet cascade">
      <header className="stack">
        <p className="eyebrow">Temps écoulé</p>
        <h1 className="title score-final">{shownScore.toLocaleString('fr-FR')}</h1>
      </header>

      <section className="card stack">
        <div className="figures">
          <Figure value={run.found.length} label="mots" />
          <Figure value={run.bestCombo} label="série" />
          <Figure value={run.skips} label="passés" />
          <Figure value={`+${Math.round(run.score * XP_PER_POINT)}`} label="XP" />
        </div>
        <div className="spread">
          <p className="eyebrow eyebrow--accent">Niveau {progress.level}</p>
          <p className="note">
            {progress.into} / {progress.span} XP
          </p>
        </div>
        <div className="progress progress--grow">
          <span style={{ '--ratio': progress.ratio } as CSSProperties} />
        </div>
      </section>

      {progress.level > levelBefore && (
        <section className="card stack unlock">
          <p className="eyebrow eyebrow--accent">Niveau {progress.level} atteint</p>
          {opened.length > 0 ? (
            <p className="serif">
              {opened.map((category) => category.label).join(', ')} — {opened.length > 1 ? 'ouvertes' : 'ouverte'}
            </p>
          ) : (
            <p className="note">Rien de neuf à débloquer à ce niveau, mais le score monte.</p>
          )}
        </section>
      )}

      {best && (
        <p className="note">
          Meilleure trouvaille : <strong className="serif">{capitalized(best.display)}</strong> ·{' '}
          {best.approximate ? 'orthographe approchée' : best.tier} · +{best.points}
        </p>
      )}

      <section className="card">
        <p className="eyebrow">Les mots de la partie</p>
        <ul className="found">
          {run.found.map((found, index) => (
            <li key={found.word} style={{ '--i': index } as CSSProperties}>
              <span className="letter-chip letter-chip--sm">{found.prompt.letter}</span>
              <span className="serif">
                {found.approximate && <span className="note">≈ </span>}
                {capitalized(found.display)}
              </span>
              <span className="note">{categoryMeta(found.prompt.categoryId)?.label}</span>
              <span className={`points tier-${found.tier.replace(/\s/g, '-')}`}>+{found.points}</span>
            </li>
          ))}
          {run.found.length === 0 && <li className="note">Pas un seul mot. Ça arrive.</li>}
        </ul>
      </section>

      <div className="stack">
        <button type="button" className="btn btn--block" onClick={onReplay}>
          Rejouer
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onHome}>
          Accueil
        </button>
      </div>
    </div>
  )
}

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="figure">
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  )
}
