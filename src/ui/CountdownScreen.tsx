import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { categoryText, useT } from '../i18n'
import { sound, type Timbre } from '../lib/sound'
import type { ShapeKind } from '../domain/avatar'
import { Shape } from './bauhaus'
import { categoryMotif, onTint, type Motif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { PowerBadge } from './PowerIcon'

const ANNOUNCE_MS = 2600
/** With a reserve, the player needs the time to read the list and decide what to trade. */
const ANNOUNCE_WITH_RESERVE_MS = 4200
const COUNT_FROM = 3
const BEAT_MS = 800

/** Matches the dealt tiles' entrance in styles.css: each one sounds as it lands. */
const TILE_DELAY_S = 0.15
const TILE_STAGGER_S = 0.2

const timbreOf = (kind: ShapeKind): Timbre => (kind === 'square' ? 'wood' : kind === 'triangle' ? 'glass' : 'marimba')

const BEATS: Record<number, Motif> = {
  3: { kind: 'circle', tint: 'red' },
  2: { kind: 'square', tint: 'blue' },
  1: { kind: 'arch', tint: 'yellow' },
}

interface CountdownScreenProps {
  categoryIds: readonly string[]
  /** How many owned categories sit out this run and can be swapped in. */
  reserve: number
  /** Swaps the Permutation power still allows; 0 without it, and nothing can be traded. */
  swaps: number
  /** A swap is waiting on its dictionary: the count holds until it arrives. */
  swapping: boolean
  onSwap(index: number): void
  onDone(): void
}

/** Announces the dealt categories, then counts 3, 2, 1 before the clock starts. */
export function CountdownScreen({ categoryIds, reserve, swaps, swapping, onSwap, onDone }: CountdownScreenProps) {
  // null while the categories are on screen, then the number being shown.
  const t = useT()
  const [count, setCount] = useState<number | null>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  const [initial] = useState(categoryIds)
  // Read once: spending the last swap must not cut the announcement short under the player's finger.
  const [tradable] = useState(reserve > 0 && swaps > 0)
  const announceMs = tradable ? ANNOUNCE_WITH_RESERVE_MS : ANNOUNCE_MS

  // The whole lineup sings once; after a swap, only the category that came in.
  const heard = useRef<readonly string[]>([])
  useEffect(() => {
    if (heard.current.length > 0) sound.power('permutation')
    categoryIds.forEach((id, index) => {
      if (heard.current.includes(id)) return
      const delay = heard.current.length === 0 ? TILE_DELAY_S + index * TILE_STAGGER_S : 0
      sound.tile(timbreOf(categoryMotif(id).kind), index, delay)
    })
    heard.current = categoryIds
  }, [categoryIds])

  // Every swap restarts the announcement: the player gets to see what came in.
  useEffect(() => {
    if (count !== null || swapping) return
    const timer = setTimeout(() => setCount(COUNT_FROM), announceMs)
    return () => clearTimeout(timer)
  }, [count, swapping, categoryIds, announceMs])

  useEffect(() => {
    if (count === null) return
    sound.beat()
    const timer = setTimeout(() => {
      if (count > 1) return setCount(count - 1)
      sound.go()
      done.current()
    }, BEAT_MS)
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

  const canSwap = reserve > 0 && swaps > 0 && !swapping
  return (
    <div className={`sheet countdown${tradable ? ' countdown--permutation' : ''}`}>
      <p className="eyebrow countdown-eyebrow">{t.countdown.lineup}</p>
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
                <CategoryIcon categoryId={id} tint={onTint(motif.tint)} className="dealt-shape" />
                <span>{categoryText(t, id).label}</span>
                {canSwap && <span className="dealt-swap" aria-hidden="true">⇄</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {tradable && (
        <>
          <p className="note countdown-hint">
            <PowerBadge id="permutation" left={swaps} />
            {swapping ? t.countdown.swapping : t.countdown.swapHint(swaps, reserve)}
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
