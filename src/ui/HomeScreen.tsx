import { useState, type CSSProperties } from 'react'
import { categoryMeta, CATALOGUE } from '../domain/catalogue'
import type { AvatarChoice } from '../domain/avatar'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import { MAX_CATEGORIES_PER_RUN, ownedCategoryIds } from '../domain/unlocks'
import type { Account, LeaderboardRow } from '../lib/cloud'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { Avatar } from './Avatar'
import { Figure, Shape } from './bauhaus'
import { CategoryOffer } from './CategoryOffer'
import { categoryMotif, type ShapeKind, type Tint } from './motifs'

interface HomeScreenProps {
  profile: Profile
  error: string | null
  loading: boolean
  /** Empty when the game runs without a server, which hides the section entirely. */
  leaderboard: readonly LeaderboardRow[]
  avatar: AvatarChoice
  /** Null while the game runs without a server: the player has no account, only an avatar. */
  account: Account | null
  accountActions: AccountActions
  onAvatar(): void
  onLogOut(): void
  onPlay(): void
  onChoose(categoryId: string): void
  /** Answers false when the server could not erase the account. */
  onErase(): Promise<boolean>
}

// A published app must link its privacy policy. Inside the phone shell a
// relative link would navigate the game's own view away, hence a full URL.
const PRIVACY_URL = import.meta.env.VITE_PRIVACY_URL || '/confidentialite.html'

export function HomeScreen({
  profile,
  error,
  loading,
  leaderboard,
  avatar,
  account,
  accountActions,
  onAvatar,
  onLogOut,
  onPlay,
  onChoose,
  onErase,
}: HomeScreenProps) {
  const progress = levelProgress(profile.xp)
  const owned = ownedCategoryIds(profile)
  const [signingIn, setSigningIn] = useState(false)

  return (
    <div className="sheet cascade">
      <Poster />

      <header className="masthead">
        <h1 className="title">
          <span>Lettre</span>
          <span>Minute</span>
        </h1>
        <p className="eyebrow">Une lettre · un thème · {RUN_SECONDS} secondes</p>
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

      <section className="player">
        <button type="button" className="player-avatar" onClick={onAvatar} aria-label="Modifier mon avatar">
          <Avatar choice={avatar} size="md" />
        </button>
        <div className="player-id">
          <strong>{account && !account.anonymous ? account.name : 'Joueur anonyme'}</strong>
          <button type="button" className="btn btn--quiet" onClick={onAvatar}>
            Modifier l’avatar
          </button>
        </div>
        {account &&
          (account.anonymous ? (
            <button type="button" className="btn btn--quiet" onClick={() => setSigningIn(!signingIn)}>
              {signingIn ? 'Fermer' : 'Se connecter'}
            </button>
          ) : (
            <button type="button" className="btn btn--quiet btn--muted" onClick={onLogOut}>
              Se déconnecter
            </button>
          ))}
      </section>

      {account?.anonymous && signingIn && (
        <AccountPanel
          title="Ton compte"
          lead="Tes parties te suivent d’un appareil à l’autre."
          onRegister={async (...args) => {
            const answer = await accountActions.onRegister(...args)
            if (!answer) setSigningIn(false)
            return answer
          }}
          onLogIn={async (...args) => {
            const answer = await accountActions.onLogIn(...args)
            if (!answer) setSigningIn(false)
            return answer
          }}
        />
      )}

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
                <Avatar choice={row.avatar} size="sm" />
                <span className="name">{row.name}</span>
                <span className="points">{row.bestScore.toLocaleString('fr-FR')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <CategoryOffer profile={profile} onChoose={onChoose} />

      <section className="panel">
        <div className="spread">
          <p className="section-title">Mes catégories</p>
          <p className="note">
            {owned.length} / {CATALOGUE.length}
          </p>
        </div>
        <ul className="categories">
          {owned.map((id) => {
            const motif = categoryMotif(id)
            return (
              <li key={id}>
                <Shape kind={motif.kind} tint={motif.tint} className="category-shape" />
                <span className="category-label">{categoryMeta(id)?.label ?? id}</span>
                <span className="note">{categoryMeta(id)?.hint}</span>
              </li>
            )
          })}
        </ul>
        <p className="note">
          {owned.length > MAX_CATEGORIES_PER_RUN
            ? `Chaque partie en tire ${MAX_CATEGORIES_PER_RUN} ; les autres restent en réserve pour un échange au lancement.`
            : 'Une nouvelle catégorie à choisir à chaque niveau.'}
        </p>
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
  ['sun', 'red', 'yellow', 'spin'],
  ['diamond', 'yellow', 'ink', 'turn'],
  ['circle', 'pink', 'green', 'pulse'],
  ['quarter', 'blue', 'pink', 'turn'],
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
