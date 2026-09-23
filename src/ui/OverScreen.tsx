import type { CSSProperties } from 'react'
import { newlyEarned, type AvatarChoice } from '../domain/avatar'
import { categoryMeta } from '../domain/catalogue'
import { capitalized } from '../domain/text'
import { levelProgress, newlyUnlocked, XP_PER_POINT, type Profile } from '../domain/progression'
import type { Run } from '../domain/run'
import type { Account } from '../lib/cloud'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { Avatar } from './Avatar'
import { Figure, LetterMark, Shape, TierTag } from './bauhaus'
import { categoryMotif } from './motifs'
import { useCountUp } from './useCountUp'

interface OverScreenProps {
  run: Run
  profile: Profile
  levelBefore: number
  profileBefore: Profile
  avatar: AvatarChoice
  /** Null while the game runs without a server: there is no account to offer. */
  account: Account | null
  accountActions: AccountActions
  onAvatar(): void
  onReplay(): void
  onHome(): void
}

export function OverScreen({
  run,
  profile,
  levelBefore,
  profileBefore,
  avatar,
  account,
  accountActions,
  onAvatar,
  onReplay,
  onHome,
}: OverScreenProps) {
  const progress = levelProgress(profile.xp)
  const opened = newlyUnlocked(levelBefore, progress.level)
  const earned = newlyEarned(profileBefore, profile)
  const best = [...run.found].sort((a, b) => b.points - a.points)[0]
  const shownScore = useCountUp(run.score)

  return (
    <div className="sheet cascade">
      <header className="score-poster">
        <Shape kind="circle" tint="yellow" className="score-poster-sun" />
        <Shape kind="quarter" tint="red" className="score-poster-quarter" />
        <Shape kind="bars" tint="cream" className="score-poster-bars" />
        <p className="eyebrow">Temps écoulé</p>
        <h1 className="score-final">{shownScore.toLocaleString('fr-FR')}</h1>
        <p className="score-poster-unit">points</p>
      </header>

      <div className="figures">
        <Figure tint="yellow" value={run.found.length} label="mots" />
        <Figure tint="red" value={run.bestCombo} label="série" />
        <Figure tint="pink" value={run.skips} label="passés" />
        <Figure tint="green" value={`+${Math.round(run.score * XP_PER_POINT)}`} label="XP" />
      </div>

      <section className="stack">
        <div className="spread">
          <p className="section-title">Niveau {progress.level}</p>
          <p className="note">
            {progress.into} / {progress.span} XP
          </p>
        </div>
        <div className="progress progress--grow">
          <span style={{ '--ratio': progress.ratio } as CSSProperties} />
        </div>
      </section>

      {progress.level > levelBefore && (
        <section className="unlock">
          <Shape kind="sun" tint="yellow" className="unlock-sun" />
          <p className="eyebrow">Niveau {progress.level} atteint</p>
          {opened.length > 0 ? (
            <p className="unlock-text">
              {opened.map((category) => category.label).join(', ')} — {opened.length > 1 ? 'ouvertes' : 'ouverte'}
            </p>
          ) : (
            <p className="unlock-text unlock-text--quiet">Rien de neuf à débloquer, mais le score monte.</p>
          )}
        </section>
      )}

      {(earned.designs.length > 0 || earned.colours.length > 0) && (
        <section className="panel earned">
          <p className="section-title">Gagné pendant la partie</p>
          <div className="earned-row">
            {earned.designs.map((design) => (
              <Avatar key={design.id} choice={{ ...avatar, design: design.id }} size="sm" />
            ))}
            {earned.colours.map((colour) => (
              <span key={colour.id} className="earned-colour">
                <span className="swatch-dot" style={{ background: colour.hex }} />
                {colour.label}
              </span>
            ))}
          </div>
          <button type="button" className="btn btn--quiet" onClick={onAvatar}>
            Composer mon avatar
          </button>
        </section>
      )}

      {account?.anonymous && (
        <AccountPanel
          title="Garde cette partie"
          lead="Crée un compte ou connecte-toi : cette partie et toute ta progression y entrent tout de suite."
          {...accountActions}
        />
      )}
      {account && !account.anonymous && (
        <p className="account-saved">
          <Avatar choice={avatar} size="sm" />
          <span>
            Partie enregistrée sur le compte <strong>{account.name}</strong>
          </span>
        </p>
      )}

      {best && (
        <p className="best">
          <span className="note">Meilleure trouvaille</span>
          <strong>{capitalized(best.display)}</strong>
          {best.approximate ? <span className="note">orthographe approchée</span> : <TierTag tier={best.tier} />}
          <span className="best-points">+{best.points}</span>
        </p>
      )}

      <section className="panel">
        <p className="section-title">Les mots de la partie</p>
        <ul className="found">
          {run.found.map((found, index) => (
            <li key={found.word} style={{ '--i': index } as CSSProperties}>
              <LetterMark letter={found.prompt.letter} motif={categoryMotif(found.prompt.categoryId)} size="sm" />
              <span className="found-word">
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
        <button type="button" className="btn btn--play btn--block" onClick={onReplay}>
          <span>Rejouer</span>
          <span className="play-glyph" aria-hidden="true">
            <Shape kind="circle" tint="yellow" />
            <Shape kind="triangle" tint="red" className="play-triangle" />
          </span>
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onHome}>
          Accueil
        </button>
      </div>
    </div>
  )
}
