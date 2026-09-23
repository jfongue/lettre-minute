import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { Shape } from './bauhaus'
import { categoryMotif, onTint, type Motif } from './motifs'

const ANNOUNCE_MS = 2600
/** With a reserve, the player needs the time to read the list and decide what to trade. */
const ANNOUNCE_WITH_RESERVE_MS = 4200
const COUNT_FROM = 3
const BEAT_MS = 800

const BEATS: Record<number, Motif> = {
  3: { kind: 'circle', tint: 'red' },
  2: { kind: 'square', tint: 'blue' },
  1: { kind: 'arch', tint: 'yellow' },
}

interface CountdownScreenProps {
  categoryIds: readonly string[]
  /** How many owned categories sit out this run and can be swapped in. */
  reserve: number
  /** A swap is waiting on its dictionary: the count holds until it arrives. */
  swapping: boolean
  onSwap(index: number): void
  onDone(): void
}

/** Announces the dealt categories, then counts 3, 2, 1 before the clock starts. */
export function CountdownScreen({ categoryIds, reserve, swapping, onSwap, onDone }: CountdownScreenProps) {
  // null while the categories are on screen, then the number being shown.
  const [count, setCount] = useState<number | null>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  const [initial] = useState(categoryIds)
  const announceMs = reserve > 0 ? ANNOUNCE_WITH_RESERVE_MS : ANNOUNCE_MS

  // Every swap restarts the announcement: the player gets to see what came in.
  useEffect(() => {
    if (count !== null || swapping) return
    const timer = setTimeout(() => setCount(COUNT_FROM), announceMs)
    return () => clearTimeout(timer)
  }, [count, swapping, categoryIds, announceMs])

  useEffect(() => {
    if (count === null) return
    const timer = setTimeout(() => (count > 1 ? setCount(count - 1) : done.current()), BEAT_MS)
    return () => clearTimeout(timer)
  }, [count])

  if (count !== null) {
    const beat = BEATS[count] ?? BEATS[1]
    return (
      <div className="sheet countdown">
        <p
          className={`countdown-beat mark--${beat.kind}`}
          key={count}
          aria-live="assertive"
          style={{ color: `var(--${onTint(beat.tint)})` }}
        >
          <Shape kind={beat.kind} tint={beat.tint} />
          <span className="countdown-number">{count}</span>
        </p>
      </div>
    )
  }

  const canSwap = reserve > 0 && !swapping
  return (
    <div className="sheet countdown">
      <p className="eyebrow countdown-eyebrow">Au programme</p>
      <ul className="dealt">
        {categoryIds.map((id, index) => {
          const motif = categoryMotif(id)
          const incoming = !initial.includes(id)
          return (
            <li
              key={id}
              className={incoming ? 'dealt-incoming' : undefined}
              style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
            >
              <button type="button" className="dealt-tile" disabled={!canSwap} onClick={() => onSwap(index)}>
                <Shape kind={motif.kind} tint={onTint(motif.tint)} className="dealt-shape" />
                <span>{categoryMeta(id)?.label ?? id}</span>
                {reserve > 0 && <span className="dealt-swap" aria-hidden="true">⇄</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {reserve > 0 && (
        <>
          <p className="note countdown-hint">
            {swapping
              ? 'Échange en cours…'
              : `Touche un thème pour l’échanger · ${reserve} en réserve`}
          </p>
          <span
            className="countdown-fuse"
            key={`${categoryIds.join()}-${swapping}`}
            style={{ '--fuse': `${announceMs}ms`, animationPlayState: swapping ? 'paused' : 'running' } as CSSProperties}
          />
        </>
      )}
    </div>
  )
}
