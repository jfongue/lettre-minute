import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import type { AccountMode } from './AccountPanel'
import type { Boards as BoardsData } from '../domain/boards'
import { homePageOpen } from '../domain/home'
import { levelProgress, type Profile } from '../domain/progression'
import { RUN_SECONDS } from '../domain/run'
import { formatNumber, useT } from '../i18n'
import { host } from '../platform'
import { Boards } from './Boards'
import type { ChallengeSummary } from '../lib/cloud'
import { ChallengeList } from './ChallengeHome'
import { Figure, Shape } from './bauhaus'
import type { MenuPage } from './Menu'
import type { ShapeKind, Tint } from './motifs'
import { PageLinks, type LinkedPage } from './PageLinks'
import { PowerSlots } from './PowerSlots'
import { useFeature } from './features'
import { ownedPowers, type PowerId } from '../domain/powers'
import { useHiddenTaps } from './useHiddenTaps'
import { useSwipe } from './useSwipe'

const HOME_LINKS: readonly LinkedPage[] = ['profile', 'stats', 'requests', 'categories']

// Long enough for the poster's tiles and the title to have landed.
const INTRO_MS = 650

interface HomeScreenProps {
  profile: Profile
  error: string | null
  loading: boolean
  /**
   * Whether what fills the page has answered (profile, account, boards, challenges).
   * Until then only the poster and the title show: blocks swapped or pushed
   * down as each answer lands would shuffle the page under the player's eyes.
   */
  settled: boolean
  /** Null when the game runs without a server, which hides the section entirely. */
  boards: BoardsData | null
  /** The player's account name, highlighted on the boards; null for an anonymous player. */
  me: string | null
  /** Places the last run won on the day's board, shown climbing once. */
  climbed?: number
  avatar: AvatarChoice
  /** Un mot proposé : la tuile « Mes demandes » s'ouvre à l'accueil. */
  requestsMade: boolean
  /** The player's words accepted since they last opened « Mes demandes ». */
  requestsNews: number
  queueAlert?: boolean
  /** A dot on « Mes catégories » until the player has read what a ban does. */
  categoriesNews?: number
  /** Friend requests waiting for an answer: a dot on the menu tile. */
  friendRequests: number
  /** Null without a named account: challenges are played between friends. */
  challenges: readonly ChallengeSummary[] | null
  /** La pastille du bouton « Multijoueur », tant qu'aucune partie à plusieurs n'a été lancée. */
  multiplayerNews: boolean
  /** Les invitations à une table de duel qui attendent le joueur, sous « Jouer ». */
  invites?: ReactNode
  /** L'entrée du défi du moment, quand la fonctionnalité est ouverte. */
  weekly?: ReactNode
  onChallenge(id: string): void
  onCreateChallenge(): void
  onPastChallenges(): void
  onMenu(page?: MenuPage): void
  onPlay(): void
  onEquip(slot: number, powerId: PowerId | null): void
  /** Absent without a server, where there is no account to make. */
  onAccount?(mode: AccountMode): void
  /** Five quick taps on the poster's top-right tile: the debug board, hidden from players. */
  onDebug?(): void
  /** Cinq tapes rapprochés sur « Classement » : la page des classements, en mode débug. */
  onBoardsHidden?(): void
}

export function HomeScreen({
  profile,
  error,
  loading,
  settled,
  boards,
  me,
  climbed,
  avatar,
  requestsMade,
  requestsNews,
  queueAlert,
  categoriesNews = 0,
  friendRequests,
  challenges,
  multiplayerNews,
  onChallenge,
  onCreateChallenge,
  onPastChallenges,
  onMenu,
  onPlay,
  onEquip,
  onAccount,
  onDebug,
  onBoardsHidden,
  invites,
  weekly,
}: HomeScreenProps) {
  const t = useT()
  const powers = useFeature('powers')
  const progress = levelProgress(profile.xp)
  // A row of zeros and an empty board say nothing to a newcomer: the space
  // goes to what would keep their first scores instead.
  const newcomer =
    me === null && profile.runs === 0 && profile.bestScore === 0 && profile.wordsFound === 0 && profile.bestCombo === 0
  // Chaque tuile s'ouvre à sa condition : un appareil neuf n'en montre aucune.
  const pages = HOME_LINKS.filter((page) => homePageOpen(page, { profile, named: me !== null, requested: requestsMade }))
// Un appareil neuf n'a rien d'autre à montrer que « Jouer » : le cadre
// paysage le pose au milieu de sa colonne au lieu de le laisser en haut.
const alone =
  newcomer &&
  !error &&
  challenges === null &&
  !invites &&
  !onAccount &&
  pages.length === 0 &&
  (!powers || ownedPowers(profile).length === 0)
  // The drawer lives off the left edge: a flick to the right pulls it in.
  const swipe = useSwipe('right', () => onMenu())
  const [introDone, setIntroDone] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setIntroDone(true), INTRO_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="sheet sheet--home" {...swipe}>
      <Poster requests={friendRequests} onMenu={() => onMenu(friendRequests > 0 ? 'social' : undefined)} onDebug={onDebug} />

      <header className="masthead">
        <h1 className="title">
          <span>{(host.title ?? t.appName)[0]}</span>
          <span>{(host.title ?? t.appName)[1]}</span>
        </h1>
        <p className="eyebrow">{t.home.tagline(RUN_SECONDS)}</p>
      </header>

      {/* Only once the poster and the title have landed, and only while the
          page still waits: a quick answer never shows it at all. */}
      {introDone && !settled && (
        <div className="home-loader" role="status" aria-label={t.loading}>
          <span />
          <span />
          <span />
        </div>
      )}

      {settled && (
        <div className={`home-body cascade${alone ? ' home-body--alone' : ''}`}>
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
          {/* Le second appel de l’accueil : sous « Jouer », sans aplat, pour ne pas lui disputer le premier rang. */}
          {challenges !== null && (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={onCreateChallenge}
              aria-label={multiplayerNews ? `${t.home.multiplayer} · ${t.home.multiplayerNews}` : undefined}
            >
              <span>{t.home.multiplayer}</span>
              {multiplayerNews && <span className="btn-news" aria-hidden="true" />}
            </button>
          )}
            {powers ? <PowerSlots profile={profile} disabled={loading} onEquip={onEquip} /> : null}
          </div>

          {invites}

          {weekly}

          {challenges && challenges.length > 0 && (
            <ChallengeList challenges={challenges} onOpen={onChallenge} onPast={onPastChallenges} />
          )}

          {newcomer ? (
            onAccount && (
              <section className="stack">
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

              {boards && (
                <Boards boards={boards} me={me} climbed={climbed} onAll={() => onMenu('boards')} onHidden={onBoardsHidden} />
              )}
            </>
          )}

          <PageLinks pages={pages} avatar={avatar} badges={{ requests: requestsNews, categories: categoriesNews }} queueAlert={queueAlert} onOpen={onMenu} />
        </div>
      )}
    </div>
  )
}

type Cell = [kind: ShapeKind, tint: Tint, ground: Tint, motion?: 'turn' | 'pulse' | 'spin']

// Composed by hand rather than drawn at random: a poster needs its colours
// balanced across the grid, which a shuffle does not guarantee.
export const POSTER: readonly Cell[] = [
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

const DEBUG_TILE = 4

/** The top-left tile doubles as the menu button: three bars where the quarter used to turn. */
function Poster({ requests, onMenu, onDebug }: { requests: number; onMenu(): void; onDebug?(): void }) {
  const t = useT()
  const tapTile = useHiddenTaps()
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
            aria-label={requests > 0 ? `${t.home.menu} · ${t.home.friendRequests(requests)}` : t.home.menu}
          >
            {requests > 0 && <span className="badge-dot poster-menu-dot" aria-hidden="true" />}
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
            onClick={
              index === DEBUG_TILE
                ? () => {
                    if (tapTile()) onDebug?.()
                  }
                : undefined
            }
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
