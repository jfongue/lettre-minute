import type { CSSProperties } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import type { AccountMode } from './AccountPanel'
import type { Boards as BoardsData } from '../domain/boards'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import { formatNumber, useT } from '../i18n'
import { Boards } from './Boards'
import type { ChallengeSummary } from '../lib/cloud'
import { ChallengeList } from './ChallengeHome'
import { Figure, Shape } from './bauhaus'
import type { MenuPage } from './Menu'
import type { ShapeKind, Tint } from './motifs'
import { PageLinks, type LinkedPage } from './PageLinks'
import { PowerSlots } from './PowerSlots'
import type { PowerId } from '../domain/powers'
import { useSwipe } from './useSwipe'

const HOME_LINKS: readonly LinkedPage[] = ['profile', 'stats', 'requests', 'categories']

interface HomeScreenProps {
  profile: Profile
  error: string | null
  loading: boolean
  /** Null when the game runs without a server, which hides the section entirely. */
  boards: BoardsData | null
  /** The player's account name, highlighted on the boards; null for an anonymous player. */
  me: string | null
  avatar: AvatarChoice
  /** The player's words accepted since they last opened « Mes demandes ». */
  requestsNews: number
  /** Null without a named account: challenges are played between friends. */
  challenges: readonly ChallengeSummary[] | null
  onChallenge(id: string): void
  onCreateChallenge(): void
  onMenu(page?: MenuPage): void
  onPlay(): void
  onEquip(slot: number, powerId: PowerId | null): void
  /** Absent without a server, where there is no account to make. */
  onAccount?(mode: AccountMode): void
}

export function HomeScreen({
  profile,
  error,
  loading,
  boards,
  me,
  avatar,
  requestsNews,
  challenges,
  onChallenge,
  onCreateChallenge,
  onMenu,
  onPlay,
  onEquip,
  onAccount,
}: HomeScreenProps) {
  const t = useT()
  const progress = levelProgress(profile.xp)
  // A row of zeros and an empty board say nothing to a newcomer: the space
  // goes to what would keep their first scores instead.
  const newcomer =
    me === null && profile.runs === 0 && profile.bestScore === 0 && profile.wordsFound === 0 && profile.bestCombo === 0
  // The drawer lives off the left edge: a flick to the right pulls it in.
  const swipe = useSwipe('right', () => onMenu())

  return (
    <div className="sheet cascade" {...swipe}>
      <Poster onMenu={() => onMenu()} />

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
        <PowerSlots profile={profile} disabled={loading} onEquip={onEquip} />
      </div>

      {challenges && <ChallengeList challenges={challenges} onOpen={onChallenge} onCreate={onCreateChallenge} />}

      {newcomer ? (
        onAccount && (
          <section className="stack">
            <p className="note">{t.home.accountLead}</p>
            <div className="home-account">
              <button type="button" className="btn btn--blue" onClick={() => onAccount('register')}>
                {t.account.register}
              </button>
              <button type="button" className="btn btn--red" onClick={() => onAccount('login')}>
                {t.account.logIn}
              </button>
            </div>
          </section>
        )
      ) : (
        <>
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
        </>
      )}

      <PageLinks pages={HOME_LINKS} avatar={avatar} badges={{ requests: requestsNews }} onOpen={onMenu} />

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
