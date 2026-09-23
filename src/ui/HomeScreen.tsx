import { useState, type CSSProperties } from 'react'
import { CATALOGUE } from '../domain/catalogue'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import type { LeaderboardRow } from '../lib/cloud'

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
      <header className="stack">
        <p className="eyebrow">Un mot, une lettre, {RUN_SECONDS} secondes</p>
        <h1 className="title">
          Lettre <span className="title-mark">Minute</span>
        </h1>
      </header>

      <section className="card stack">
        <div className="spread">
          <p className="eyebrow eyebrow--accent">Niveau {progress.level}</p>
          <p className="note">
            {progress.into} / {progress.span} XP
          </p>
        </div>
        <div className="progress progress--grow">
          <span style={{ '--ratio': progress.ratio } as CSSProperties} />
        </div>
        <div className="figures">
          <Figure value={profile.bestScore.toLocaleString('fr-FR')} label="meilleur score" />
          <Figure value={profile.runs} label={profile.runs > 1 ? 'parties' : 'partie'} />
          <Figure value={profile.wordsFound} label="mots trouvés" />
          <Figure value={profile.bestCombo} label="meilleure série" />
        </div>
      </section>

      <div className="stack">
        <button type="button" className="btn btn--block" onClick={onPlay} disabled={loading}>
          {loading ? 'Chargement du dictionnaire…' : 'Jouer'}
        </button>
        {error && <p className="note note--warn">{error}</p>}
      </div>

      {leaderboard.length > 0 && (
        <section className="card">
          <p className="eyebrow">Classement</p>
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

      <section className="card stack">
        <p className="eyebrow">Catégories</p>
        <ul className="categories">
          {CATALOGUE.map((category) => {
            const locked = category.unlockLevel > progress.level
            return (
              <li key={category.id} className={locked ? 'locked' : ''}>
                <span>{category.label}</span>
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

function Figure({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="figure">
      <span className="figure-value">{value}</span>
      <span className="figure-label">{label}</span>
    </div>
  )
}
