import { useEffect, type CSSProperties } from 'react'
import type { BoardRow } from '../domain/boards'
import { standingMove } from '../domain/standing'
import { formatNumber, useT, type Messages } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Avatar } from './Avatar'
import { reducedMotion, useCountUp } from './useCountUp'

interface RankMoveProps {
  title: string
  before: readonly BoardRow[]
  after: readonly BoardRow[]
  me: string
}

/** The rows around the player: the one still to catch above, and a few just overtaken below. */
const ROWS_ABOVE = 1
const ROWS_BELOW = 3
/** Let the section settle into the cascade before the climb starts. */
const CLIMB_DELAY_MS = 700
const CLIMB_MS = 1100

/**
 * The player's line climbs past everyone the run overtook, who step down one
 * place each. Rows are laid out in the board's order after the run and slid
 * from where they stood before it, so the end state needs no animation at all.
 */
export function RankMove({ title, before, after, me }: RankMoveProps) {
  const t = useT()
  const move = standingMove(before, after, me)
  const start = move ? Math.max(0, move.to - 1 - ROWS_ABOVE) : 0
  const rows = move ? after.slice(start, move.to + ROWS_BELOW) : []
  const passed = new Set(move?.passed.map((row) => row.name))
  const overtaken = rows.filter((row) => passed.has(row.name)).length
  const entering = move?.from === null
  // A newcomer rises from just below the window; a climber from the row it held.
  const climb = overtaken + (entering ? 1 : 0)
  const target = move?.to ?? 0
  const rank = useCountUp(target, CLIMB_MS, move?.from ?? target + climb, CLIMB_DELAY_MS)

  // The phone knocks once as the line lands, not as it sets off; the sound climbs with it.
  useEffect(() => {
    if (climb === 0 || reducedMotion()) return
    sound.climb(climb, CLIMB_MS / 1000, CLIMB_DELAY_MS / 1000)
    const timer = setTimeout(() => tapFeedback('medium'), CLIMB_DELAY_MS + CLIMB_MS * 0.8)
    return () => clearTimeout(timer)
  }, [target, climb])

  if (!move) return null

  return (
    <section className="panel rank-move">
      <div className="spread">
        <p className="section-title">{title}</p>
        <p className="rank-move-headline">{headline(t, move.from, move.to)}</p>
      </div>
      <div className="standings rank-move-board" style={{ '--climb-delay': `${CLIMB_DELAY_MS}ms`, '--climb-ms': `${CLIMB_MS}ms` } as CSSProperties}>
        {rows.map((row, index) => {
          const mine = start + index === move.to - 1
          const shift = mine ? climb : passed.has(row.name) ? -1 : 0
          return (
            <div
              key={row.name}
              className={`standing${start + index === 0 ? ' standing--leader' : ''}${mine ? ' standing--me' : ''}${mine && entering ? ' standing--entering' : ''}`}
              style={shift ? ({ '--shift': shift } as CSSProperties) : undefined}
            >
              <span className="rank">{mine ? rank : start + index + 1}</span>
              <Avatar choice={row.avatar} size="sm" />
              <span className="name">{row.name}</span>
              <span className="points">{formatNumber(t, row.value)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function headline(t: Messages, from: number | null, to: number): string {
  const place = t.boards.ordinal(to)
  if (from === null) return t.boards.entered(place)
  if (to < from) return t.boards.climbed(from - to, place)
  if (to === from) return t.boards.held(place)
  return place
}
