import type { CSSProperties } from 'react'
import { CATALOGUE } from '../domain/catalogue'
import type { Boards as BoardsData } from '../domain/boards'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import { MAX_CATEGORIES_PER_RUN, ownedCategoryIds } from '../domain/unlocks'
import { categoryText, formatNumber, useT } from '../i18n'
import { Boards } from './Boards'
import { Figure, Shape } from './bauhaus'
import { CategoryOffer } from './CategoryOffer'
import { categoryMotif, type ShapeKind, type Tint } from './motifs'
import { useSwipe } from './useSwipe'

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
  const t = useT()
  const progress = levelProgress(profile.xp)
  const owned = ownedCategoryIds(profile)
  // The drawer lives off the left edge: a flick to the right pulls it in.
  const swipe = useSwipe('right', onMenu)

  return (
    <div className="sheet cascade" {...swipe}>
      <Poster onMenu={onMenu} />

      <header className="masthead">
        <h1 className="title">
          <span>{t.appName[0]}</span>
          <span>{t.appName[1]}</span>
        </h1>
        <p className="eyebrow">{t.home.tagline(RUN_SECONDS)}</p>
      </header>

      <div className="stack">
        <button type="button" className="btn btn--play btn--block" onClick={onPlay} disabled={loading}>
          <span>{loading ? t.loading : t.home.play}</span>
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
          <p className="section-title">{t.home.level(progress.level)}</p>
          <p className="note">
            {progress.into} / {progress.span} XP
          </p>
        </div>
        <div className="progress progress--grow">
          <span style={{ '--ratio': progress.ratio } as CSSProperties} />
        </div>
        <div className="figures">
          <Figure tint="yellow" value={formatNumber(t, profile.bestScore)} label={t.home.bestScore} />
          <Figure tint="blue" value={profile.runs} label={t.home.runs(profile.runs)} />
          <Figure tint="red" value={profile.wordsFound} label={t.home.wordsFound} />
          <Figure tint="pink" value={profile.bestCombo} label={t.home.bestCombo} />
        </div>
      </section>

      {boards && <Boards boards={boards} me={me} />}

      <CategoryOffer profile={profile} onChoose={onChoose} />

      <section className="panel">
        <div className="spread">
          <p className="section-title">{t.home.myCategories}</p>
          <p className="note">
            {owned.length} / {CATALOGUE.length}
          </p>
        </div>
        <ul className="categories">
          {owned.map((id) => {
            const motif = categoryMotif(id)
            const text = categoryText(t, id)
            return (
              <li key={id}>
                <Shape kind={motif.kind} tint={motif.tint} className="category-shape" />
                <span className="category-label">{text.label}</span>
                <span className="note">{text.hint}</span>
              </li>
            )
          })}
        </ul>
        <p className="note">
          {owned.length > MAX_CATEGORIES_PER_RUN
            ? t.home.reserve(MAX_CATEGORIES_PER_RUN)
            : t.home.newEachLevel}
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
  const t = useT()
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
            aria-label={t.home.menu}
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
