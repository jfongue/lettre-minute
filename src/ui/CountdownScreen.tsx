import { useEffect, useState, type CSSProperties } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { Shape } from './bauhaus'
import { categoryMotif, onTint, type Motif } from './motifs'

const ANNOUNCE_MS = 2600
const COUNT_FROM = 3
const BEAT_MS = 800

const BEATS: Record<number, Motif> = {
  3: { kind: 'circle', tint: 'red' },
  2: { kind: 'square', tint: 'blue' },
  1: { kind: 'arch', tint: 'yellow' },
}

interface CountdownScreenProps {
  categoryIds: readonly string[]
  onDone(): void
}

/** Announces the dealt categories, then counts 3, 2, 1 before the clock starts. */
export function CountdownScreen({ categoryIds, onDone }: CountdownScreenProps) {
  // null while the categories are on screen, then the number being shown.
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const timers = [setTimeout(() => setCount(COUNT_FROM), ANNOUNCE_MS)]
    for (let step = 1; step < COUNT_FROM; step++) {
      timers.push(setTimeout(() => setCount(COUNT_FROM - step), ANNOUNCE_MS + step * BEAT_MS))
    }
    timers.push(setTimeout(onDone, ANNOUNCE_MS + COUNT_FROM * BEAT_MS))
    return () => timers.forEach(clearTimeout)
    // Scheduled once per run: a new onDone identity must not restart the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <div className="sheet countdown">
      <p className="eyebrow countdown-eyebrow">Au programme</p>
      <ul className="dealt">
        {categoryIds.map((id, index) => {
          const motif = categoryMotif(id)
          return (
            <li
              key={id}
              style={{ '--i': index, background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` } as CSSProperties}
            >
              <Shape kind={motif.kind} tint={onTint(motif.tint)} className="dealt-shape" />
              {categoryMeta(id)?.label ?? id}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
