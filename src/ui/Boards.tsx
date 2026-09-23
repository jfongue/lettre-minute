import { useRef, useState } from 'react'
import type { BoardId, Boards as BoardsData } from '../domain/boards'
import { Avatar } from './Avatar'

const BOARDS: readonly { id: BoardId; label: string; caption: string; empty: string }[] = [
  {
    id: 'day',
    label: 'Jour',
    caption: 'Meilleure partie d’aujourd’hui',
    empty: 'Personne n’a encore joué aujourd’hui.',
  },
  {
    id: 'week',
    label: 'Semaine',
    caption: 'Meilleure partie de la semaine',
    empty: 'Personne n’a encore joué cette semaine.',
  },
  {
    id: 'discoveries',
    label: 'Découvertes',
    caption: 'Mots que personne n’avait écrits depuis une semaine',
    empty: 'Aucune découverte cette semaine : à toi d’ouvrir le bal.',
  },
]

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
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const show = (index: number) => {
    const element = track.current
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
  }

  return (
    <section className="panel boards">
      <div className="spread">
        <p className="section-title">Classement</p>
        <p className="note">{BOARDS[active].caption}</p>
      </div>

      <div className="layer-tabs" role="tablist">
        {BOARDS.map((board, index) => (
          <button
            key={board.id}
            type="button"
            role="tab"
            aria-selected={active === index}
            className={`layer-tab${active === index ? ' layer-tab--on' : ''}`}
            onClick={() => show(index)}
          >
            {board.label}
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
          const rows = boards[board.id].slice(0, 10)
          return (
            <div className="board" key={board.id} role="tabpanel" aria-label={board.label}>
              {rows.length === 0 ? (
                <p className="note board-empty">{board.empty}</p>
              ) : (
                <div className="standings">
                  {rows.map((row, index) => (
                    <div
                      className={`standing${index === 0 ? ' standing--leader' : ''}${
                        me && row.name.toLowerCase() === me.toLowerCase() ? ' standing--me' : ''
                      }`}
                      key={`${row.name}-${index}`}
                    >
                      <span className="rank">{index + 1}</span>
                      <Avatar choice={row.avatar} size="sm" />
                      <span className="name">{row.name}</span>
                      <span className="points">
                        {row.value.toLocaleString('fr-FR')}
                        {board.id === 'discoveries' && <small> {row.value > 1 ? 'mots' : 'mot'}</small>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="board-dots" aria-hidden="true">
        {BOARDS.map((board, index) => (
          <span key={board.id} className={`board-dot${active === index ? ' board-dot--on' : ''}`} />
        ))}
      </div>
    </section>
  )
}
