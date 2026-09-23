import { useEffect, useState, type CSSProperties } from 'react'
import { categoryMeta } from '../domain/catalogue'

const ANNOUNCE_MS = 2600
const COUNT_FROM = 3
const BEAT_MS = 800

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

  if (count !== null)
    return (
      <div className="sheet countdown">
        <p className="countdown-number" key={count} aria-live="assertive">
          {count}
        </p>
      </div>
    )

  return (
    <div className="sheet countdown cascade">
      <p className="eyebrow">Au programme</p>
      <ul className="dealt">
        {categoryIds.map((id, index) => (
          <li key={id} className="serif" style={{ '--i': index } as CSSProperties}>
            {categoryMeta(id)?.label ?? id}
          </li>
        ))}
      </ul>
    </div>
  )
}
