import { useEffect, useRef, useState } from 'react'
import { focusedRows, type BoardId, type Boards as BoardsData } from '../domain/boards'
import { formatNumber, useT } from '../i18n'
import { fetchFriends } from '../lib/cloud'
import { Avatar } from './Avatar'
import { PlayerName } from './PlayerSheet'

const BOARDS: readonly BoardId[] = ['day', 'week', 'discoveries']

interface BoardsProps {
  boards: BoardsData
  /** The player's account name, highlighted where it ranks. */
  me: string | null
}

/**
 * One board per page of a horizontal scroller that snaps: the swipe is the
 * browser's own, with its momentum and its accessibility, and the tabs above
 * scroll it for those who tap rather than swipe.
 */
export function Boards({ boards, me }: BoardsProps) {
  const t = useT()
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [whole, setWhole] = useState(false)
  const [friends, setFriends] = useState<readonly string[]>([])
  useEffect(() => {
    let live = true
    if (me) fetchFriends().then((list) => live && setFriends((list ?? []).filter((friend) => friend.relation === 'friend').map((friend) => friend.name)))
    return () => {
      live = false
    }
  }, [me])

  const show = (index: number) => {
    const element = track.current
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="panel boards" data-no-swipe>
      <div className="spread">
        <p className="section-title">{t.boards.title}</p>
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
      </div>

      <div
        className="board-track"
        ref={track}
        onScroll={(event) => {
          const element = event.currentTarget
          setActive(Math.min(BOARDS.length - 1, Math.round(element.scrollLeft / element.clientWidth)))
        }}
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
                    return (
                      <div
                        className={`standing${rank === 1 ? ' standing--leader' : ''}${mine ? ' standing--me' : ''}${gap ? ' standing--gap' : ''}`}
                        key={`${row.name}-${rank}`}
                      >
                        <span className="rank">{rank}</span>
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
                          {formatNumber(t, row.value)}
                          {board === 'discoveries' && <small> {t.boards.words(row.value)}</small>}
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
      </div>

      <div className="board-dots" aria-hidden="true">
        {BOARDS.map((board, index) => (
          <span key={board} className={`board-dot${active === index ? ' board-dot--on' : ''}`} />
        ))}
      </div>
    </section>
  )
}
