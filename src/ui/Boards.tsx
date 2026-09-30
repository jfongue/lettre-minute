import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { focusedRows, type BoardId, type Boards as BoardsData } from '../domain/boards'
import { formatNumber, useT } from '../i18n'
import { fetchFriends } from '../lib/cloud'
import { sound } from '../lib/sound'
import { Avatar } from './Avatar'
import { PlayerName } from './PlayerSheet'
import { reducedMotion, useCountUp } from './useCountUp'
import { useHiddenTaps } from './useHiddenTaps'

// Discoveries live on the leaderboards page, which « Plus… » opens.
const BOARDS: readonly BoardId[] = ['day', 'week']

const CLIMB_DELAY_MS = 700
const CLIMB_MS = 900

/** The rank the line held before the run, counted down to the one it won, as the line rises. */
function ClimbingRank({ rank, climbed }: { rank: number; climbed: number }) {
  useEffect(() => {
    if (!reducedMotion()) sound.climb(climbed, CLIMB_MS / 1000, CLIMB_DELAY_MS / 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <>{useCountUp(rank, CLIMB_MS, rank + climbed, CLIMB_DELAY_MS)}</>
}

interface BoardsProps {
  boards: BoardsData
  /** The player's account name, highlighted where it ranks. */
  me: string | null
  /** Places the last run won on the day's board: the player's line climbs them, once. */
  climbed?: number
  /** Opens the leaderboards page: from the title, or by swiping past the last board. */
  onAll?(): void
  /** Cinq tapes rapprochés sur « Classement » : la même page, en mode débug. */
  onHidden?(): void
}

/**
 * One board per page of a horizontal scroller that snaps: the swipe is the
 * browser's own, with its momentum and its accessibility, and the tabs above
 * scroll it for those who tap rather than swipe.
 */
export function Boards({ boards, me, climbed = 0, onAll, onHidden }: BoardsProps) {
  const t = useT()
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [whole, setWhole] = useState(false)
  // Le mot « Classement » ouvre la page ; cinq tapes rapprochées l'ouvrent en
  // mode débug. Le compte survit au tiroir qui s'ouvre et se referme entre
  // deux tapes : la planche passe par le même geste, sans le dire.
  const tapTitle = useHiddenTaps()
  // Snapping onto the onward page fires several scroll events: it opens once.
  const leaving = useRef(false)
  const [friends, setFriends] = useState<readonly string[]>([])
  useEffect(() => {
    let live = true
    if (me) fetchFriends().then((list) => live && setFriends((list ?? []).filter((friend) => friend.relation === 'friend').map((friend) => friend.name)))
    return () => {
      live = false
    }
  }, [me])

  // Back on the last board for when the page closes over the home screen.
  const settle = (element: HTMLDivElement) => {
    if (!leaving.current) return
    leaving.current = false
    element.scrollTo({ left: (BOARDS.length - 1) * element.clientWidth })
  }

  const follow = (element: HTMLDivElement, ended = false) => {
    const page = Math.round(element.scrollLeft / element.clientWidth)
    setActive(Math.min(BOARDS.length - 1, page))
    // Jumping back while the fling still runs fought the snap: the track
    // flickered between the two pages under the drawer coming in.
    if (leaving.current) {
      if (ended) settle(element)
      return
    }
    // Only once the onward page is all but in: a swipe let go halfway snaps back.
    if (onAll && page >= BOARDS.length && element.scrollLeft >= (BOARDS.length - 0.1) * element.clientWidth) {
      leaving.current = true
      onAll()
      // WebViews before Chrome 114 never say when the scroll ends.
      if (!('onscrollend' in window)) setTimeout(() => settle(element), 700)
    }
  }

  const show = (index: number) => {
    const element = track.current
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="panel boards" data-no-swipe>
      <div className="spread">
        {onAll ? (
          <button
            type="button"
            className="section-title challenge-past"
            onClick={() => {
              if (onHidden && tapTitle()) onHidden()
              else onAll()
            }}
          >
            {t.boards.title}
          </button>
        ) : (
          <p className="section-title">{t.boards.title}</p>
        )}
        <p className="note">{t.boards[BOARDS[active]].caption}</p>
      </div>

      <div className="layer-tabs" role="tablist">
        {BOARDS.map((board, index) => (
          <button
            key={board}
            type="button"
            role="tab"
            aria-selected={active === index}
            className={`layer-tab${active === index ? ' layer-tab--on' : ''}`}
            onClick={() => show(index)}
          >
            {t.boards[board].label}
          </button>
        ))}
        {onAll && (
          <button type="button" className="layer-tab" onClick={onAll}>
            {t.boards.plus}
          </button>
        )}
      </div>

      <div
        className="board-track"
        ref={track}
        onScroll={(event) => follow(event.currentTarget)}
        onScrollEnd={(event) => follow(event.currentTarget, true)}
      >
        {BOARDS.map((board) => {
          const focused = focusedRows(boards[board], me ? [me, ...friends] : friends)
          const rows = whole ? boards[board].map((row, index) => ({ row, rank: index + 1 })) : focused.rows
          return (
            <div className="board" key={board} role="tabpanel" aria-label={t.boards[board].label}>
              {rows.length === 0 ? (
                <p className="note board-empty">{t.boards[board].empty}</p>
              ) : (
                <div className="standings">
                  {rows.map(({ row, rank }, index) => {
                    const mine = me !== null && row.name.toLowerCase() === me.toLowerCase()
                    // A gap in the ranks says rows were left out between them.
                    const gap = index > 0 && rank - rows[index - 1]!.rank > 1
                    const climbing = mine && board === 'day' && climbed > 0
                    return (
                      <div
                        className={`standing${rank === 1 ? ' standing--leader' : ''}${mine ? ' standing--me' : ''}${gap ? ' standing--gap' : ''}${climbing ? ' standing--climbing' : ''}`}
                        style={climbing ? ({ '--climb': Math.max(1, Math.min(climbed, rows.length - index - 1)) } as CSSProperties) : undefined}
                        key={`${row.name}-${rank}`}
                      >
                        <span className="rank">{climbing ? <ClimbingRank rank={rank} climbed={climbed} /> : rank}</span>
                        <Avatar choice={row.avatar} size="sm" />
                        <span className="name">
                          {mine ? (
                            row.name
                          ) : (
                            <PlayerName name={row.name} avatar={row.avatar}>
                              {row.name}
                            </PlayerName>
                          )}
                        </span>
                        <span className="points">
                          {climbing && <span className="standing-climb">+{climbed}</span>}
                          {formatNumber(t, row.value)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              {(focused.more || whole) && (
                <button type="button" className="btn btn--quiet board-more" onClick={() => setWhole(!whole)}>
                  {whole ? t.boards.less : t.boards.more(boards[board].length)}
                </button>
              )}
            </div>
          )
        })}
        {onAll && (
          <div className="board board-onward">
            <button type="button" className="btn btn--blue" onClick={onAll}>
              {t.boards.all} ›
            </button>
          </div>
        )}
      </div>

      <div className="board-dots" aria-hidden="true">
        {BOARDS.map((board, index) => (
          <span key={board} className={`board-dot${active === index ? ' board-dot--on' : ''}`} />
        ))}
        {onAll && <span className="board-dot board-dot--onward" />}
      </div>
    </section>
  )
}
