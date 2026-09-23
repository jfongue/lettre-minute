import type { CSSProperties } from 'react'
import { categoryMeta, CATALOGUE } from '../domain/catalogue'
import type { Boards as BoardsData } from '../domain/boards'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import { MAX_CATEGORIES_PER_RUN, ownedCategoryIds } from '../domain/unlocks'
import { Boards } from './Boards'
import { Figure, Shape } from './bauhaus'
import { CategoryOffer } from './CategoryOffer'
import { categoryMotif, type ShapeKind, type Tint } from './motifs'

interface HomeScreenProps {
  profile: Profile
  error: string | null
  loading: boolean
  /** Null when the game runs without a server, which hides the section entirely. */
  boards: BoardsData | null
  /** The player's account name, highlighted on the boards; null for an anonymous player. */
  me: string | null
  onMenu(): void
  onPlay(): void
  onChoose(categoryId: string): void
}

export function HomeScreen({ profile, error, loading, boards, me, onMenu, onPlay, onChoose }: HomeScreenProps) {
  const progress = levelProgress(profile.xp)
  const owned = ownedCategoryIds(profile)

  return (
    <div className="sheet cascade">
      <Poster onMenu={onMenu} />

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
            <span className="motion play-triangle">
              <Shape kind="triangle" tint="red" />
            </span>
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

      {boards && <Boards boards={boards} me={me} />}

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

/** The top-left tile doubles as the menu button: three bars where the quarter used to turn. */
function Poster({ onMenu }: { onMenu(): void }) {
  return (
    <div className="poster">
      {POSTER.map(([kind, tint, ground, motion], index) =>
        index === 0 ? (
          <button
            key={index}
            type="button"
            className="poster-cell poster-menu"
            style={{ background: `var(--${ground})`, '--i': index } as CSSProperties}
            onClick={onMenu}
            aria-label="Menu : profil, amis, options"
          >
            <span className="poster-menu-bars" style={{ color: `var(--${tint})` }} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        ) : (
          <span
            key={index}
            className="poster-cell"
            style={{ background: `var(--${ground})`, '--i': index } as CSSProperties}
            aria-hidden="true"
          >
            <span className={`motion${motion ? ` motion-${motion}` : ''}`}>
              <Shape kind={kind} tint={tint} />
            </span>
          </span>
        ),
      )}
    </div>
  )
}
