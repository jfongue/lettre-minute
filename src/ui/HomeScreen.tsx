import { useState, type CSSProperties } from 'react'
import { CATALOGUE } from '../domain/catalogue'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import type { LeaderboardRow } from '../lib/cloud'
import { Figure, Shape } from './bauhaus'
import { categoryMotif, type ShapeKind, type Tint } from './motifs'

interface HomeScreenProps {
  profile: Profile
  error: string | null
  loading: boolean
  /** Empty when the game runs without a server, which hides the section entirely. */
  leaderboard: readonly LeaderboardRow[]
  onPlay(): void
  /** Answers false when the server could not erase the account. */
  onErase(): Promise<boolean>
}

// A published app must link its privacy policy. Inside the phone shell a
// relative link would navigate the game's own view away, hence a full URL.
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || '/confidentialite.html'

export function HomeScreen({ profile, error, loading, leaderboard, onPlay, onErase }: HomeScreenProps) {
  const progress = levelProgress(profile.xp)

  return (
    <div className="sheet cascade">
      <Poster />

      <header className="masthead">
        <h1 className="title">
          <span>Lettre</span>
          <span>Minute</span>
        </h1>
        <p className="eyebrow">Un mot · une lettre · {RUN_SECONDS} secondes</p>
      </header>

      <div className="stack">
        <button type="button" className="btn btn--play btn--block" onClick={onPlay} disabled={loading}>
          <span>{loading ? 'Chargement…' : 'Jouer'}</span>
          <span className="play-glyph" aria-hidden="true">
            <Shape kind="circle" tint="yellow" />
            <Shape kind="triangle" tint="red" className="play-triangle" />
          </span>
        </button>
        {error && <p className="note note--warn">{error}</p>}
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
        <div className="figures">
          <Figure tint="yellow" value={profile.bestScore.toLocaleString('fr-FR')} label="meilleur score" />
          <Figure tint="blue" value={profile.runs} label={profile.runs > 1 ? 'parties' : 'partie'} />
          <Figure tint="red" value={profile.wordsFound} label="mots trouvés" />
          <Figure tint="pink" value={profile.bestCombo} label="meilleure série" />
        </div>
      </section>

      {leaderboard.length > 0 && (
        <section className="panel">
          <p className="section-title">Classement</p>
          <div className="standings">
            {leaderboard.slice(0, 10).map((row, index) => (
              <div className={`standing${index === 0 ? ' standing--leader' : ''}`} key={`${row.name}-${index}`}>
                <span className="rank">{index + 1}</span>
                <span className="name">{row.name}</span>
                <span className="points">{row.bestScore.toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <p className="section-title">Catégories</p>
        <ul className="categories">
          {CATALOGUE.map((category) => {
            const locked = category.unlockLevel > progress.level
            const motif = categoryMotif(category.id)
            return (
              <li key={category.id} className={locked ? 'locked' : ''}>
                <Shape kind={locked ? 'ring' : motif.kind} tint={locked ? 'ink' : motif.tint} className="category-shape" />
                <span className="category-label">{category.label}</span>
                <span className="note">{locked ? `niveau ${category.unlockLevel}` : category.hint}</span>
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="colophon">
        <a className="btn btn--quiet" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          Confidentialité
        </a>
        <EraseData onErase={onErase} />
      </footer>
    </div>
  )
}

type Cell = [kind: ShapeKind, tint: Tint, ground: Tint, motion?: 'turn' | 'pulse' | 'spin']

// Composed by hand rather than drawn at random: a poster needs its colours
// balanced across the grid, which a shuffle does not guarantee.
const POSTER: readonly Cell[] = [
  ['quarter', 'yellow', 'blue', 'turn'],
  ['circle', 'red', 'paper', 'pulse'],
  ['bars', 'ink', 'pink'],
  ['arch', 'green', 'yellow', 'turn'],
  ['triangle', 'blue', 'paper', 'turn'],
  ['half', 'paper', 'red', 'turn'],
  ['diamond', 'yellow', 'ink', 'turn'],
  ['ring', 'blue', 'yellow', 'pulse'],
  ['corner', 'red', 'paper', 'turn'],
  ['circle', 'pink', 'green', 'pulse'],
  ['sun', 'red', 'yellow', 'spin'],
  ['quarter', 'blue', 'pink', 'turn'],
  ['half', 'ink', 'paper', 'turn'],
  ['triangle', 'yellow', 'red', 'turn'],
  ['arch', 'red', 'blue', 'turn'],
]

function Poster() {
  return (
    <div className="poster" aria-hidden="true">
      {POSTER.map(([kind, tint, ground, motion], index) => (
        <span
          key={index}
          className="poster-cell"
          style={{ background: `var(--${ground})`, '--i': index } as CSSProperties}
        >
          <Shape kind={kind} tint={tint} className={motion ? `motion-${motion}` : undefined} />
        </span>
      ))}
    </div>
  )
}

/** Erasing is irreversible, so it takes a second, explicit tap. */
function EraseData({ onErase }: { onErase(): Promise<boolean> }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'erasing' | 'failed' | 'done'>('idle')

  const erase = async () => {
    setStep('erasing')
    setStep((await onErase()) ? 'done' : 'failed')
  }

  switch (step) {
    case 'idle':
      return (
        <button type="button" className="btn btn--quiet btn--muted" onClick={() => setStep('confirm')}>
          Effacer mes données
        </button>
      )
    case 'confirm':
    case 'erasing':
      return (
        <p className="erase-confirm">
          <span className="note">Niveau, records et mots proposés seront perdus.</span>
          <button type="button" className="btn btn--quiet" onClick={erase} disabled={step === 'erasing'}>
            {step === 'erasing' ? 'Effacement…' : 'Tout effacer'}
          </button>
          <button type="button" className="btn btn--quiet btn--muted" onClick={() => setStep('idle')}>
            Annuler
          </button>
        </p>
      )
    case 'failed':
      return (
        <p className="erase-confirm">
          <span className="note note--warn">Le serveur n’a pas répondu, rien n’a été effacé.</span>
          <button type="button" className="btn btn--quiet" onClick={erase}>
            Réessayer
          </button>
        </p>
      )
    case 'done':
      return <p className="note">Données effacées.</p>
  }
}
