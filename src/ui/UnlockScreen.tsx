import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { capitalized, initialOf } from '../domain/text'
import { showcaseWords } from '../domain/words'
import { loadPack } from '../data/packs'
import { categoryText, useT } from '../i18n'
import { showInterstitial, tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Burst, LetterMark, Shape } from './bauhaus'
import { categoryMotif, onTint } from './motifs'
import { reducedMotion } from './useCountUp'

interface UnlockScreenProps {
  offer: readonly string[]
  lang: string
  /** Picks still owed, this one included. */
  owed: number
  /** The level this run reached, when it crossed one. */
  level: number | null
  withAd: boolean
  onChoose(categoryId: string): void
  onDone(): void
}

/** Words typed out per category: enough to feel endless, few enough to stay the famous ones. */
const SHOWN_WORDS = 10
/** Drawn from the best-known this many, so two offers of the same category do not read alike. */
const SHOWCASE_POOL = 30

/** The losing cards fall away, then the kept one takes the whole screen. */
const LEAVE_MS = 420
const SEALED_MS = 2600

type Phase = 'choosing' | 'leaving' | 'sealed'

/**
 * A level up's reward, given a screen of its own between the reveal and the
 * summary. A field types out words of the category under the finger — what
 * picking it would put in play — until one is kept.
 */
export function UnlockScreen({ lang, onChoose, onDone, ...dealt }: UnlockScreenProps) {
  const t = useT()
  // Read once: the pick empties the offer and settles the ad, and the
  // celebration still has to show the cards it was chosen from.
  const [{ offer, owed, level, withAd }] = useState(dealt)
  const [words, setWords] = useState<Record<string, readonly string[]>>({})
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('choosing')
  const focus = phase === 'choosing' ? (hovered ?? selected) : selected

  useEffect(() => {
    let live = true
    for (const id of offer) {
      loadPack(lang, id)
        .then((pack) => {
          const picked = shuffle(showcaseWords(pack, SHOWCASE_POOL)).slice(0, SHOWN_WORDS).map(capitalized)
          if (live) setWords((previous) => ({ ...previous, [id]: picked }))
        })
        .catch(() => undefined)
    }
    return () => {
      live = false
    }
  }, [offer, lang])

  // Nothing under the finger: the field goes round the three cards, one word each.
  const lines = useMemo(() => {
    if (focus) return (words[focus] ?? []).map((text) => ({ id: focus, text }))
    const longest = Math.max(0, ...offer.map((id) => words[id]?.length ?? 0))
    return Array.from({ length: longest }, (_, index) =>
      offer.flatMap((id) => {
        const text = words[id]?.[index]
        return text ? [{ id, text }] : []
      }),
    ).flat()
  }, [focus, words, offer])
  const typed = useTypewriter(lines, focus !== null)
  const typedMotif = typed.id ? categoryMotif(typed.id) : null

  const finish = useRef(onDone)
  finish.current = onDone
  const done = () => {
    finish.current()
    if (withAd) showInterstitial()
  }

  useEffect(() => {
    if (phase === 'choosing') return
    const fast = reducedMotion()
    const timer =
      phase === 'leaving'
        ? setTimeout(() => setPhase('sealed'), fast ? 0 : LEAVE_MS)
        : setTimeout(done, fast ? 1200 : SEALED_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // The pick is kept before anything plays: closing the app during the
  // celebration, or the ad after it, must not cost the player the category.
  const confirm = () => {
    if (!selected || phase !== 'choosing') return
    onChoose(selected)
    tapFeedback('medium')
    sound.levelUp()
    setPhase('leaving')
  }

  const pick = (id: string) => {
    if (phase !== 'choosing') return
    setSelected(id)
    tapFeedback()
  }

  const kept = selected ? categoryText(t, selected) : null
  const keptMotif = selected ? categoryMotif(selected) : null

  return (
    <div
      className={`sheet unlock-screen unlock-screen--${phase}`}
      onClick={phase === 'sealed' ? done : undefined}
      role="presentation"
    >
      <header className="unlock-head">
        <Shape kind="sun" tint="yellow" className="unlock-head-sun" />
        <p className="eyebrow">
          {level !== null ? t.over.levelReached(level) : t.over.levelUp}
          {owed > 1 && ` · ${t.offer.more(owed - 1)}`}
        </p>
        <h1 className="unlock-title">{t.offer.title}</h1>
      </header>

      <div
        className="unlock-typer"
        style={typedMotif ? ({ '--tint': `var(--${typedMotif.tint})` } as CSSProperties) : undefined}
        aria-hidden="true"
      >
        <span className="unlock-typer-mark" key={typed.target}>
          {typedMotif && typed.target && (
            <LetterMark letter={initialOf(typed.target)} motif={typedMotif} size="md" />
          )}
        </span>
        <span className="unlock-typer-text">
          {typed.text}
          <span className="unlock-caret" />
        </span>
        <span className="unlock-typer-line" />
      </div>

      {phase === 'sealed' && kept && keptMotif && selected ? (
        <div
          className="unlock-seal"
          style={{ background: `var(--${keptMotif.tint})`, color: `var(--${onTint(keptMotif.tint)})` }}
        >
          <Shape kind={keptMotif.kind} tint={onTint(keptMotif.tint)} className="unlock-seal-shape" />
          <span className="unlock-seal-burst">
            <Burst />
          </span>
          <p className="unlock-seal-label">{kept.label}</p>
          <p className="unlock-seal-joined">{t.offer.joined}</p>
          <span className="unlock-seal-stamp">
            <Shape kind="circle" tint="ink" />
            <span>✓</span>
          </span>
        </div>
      ) : (
        <ul className="unlock-cards">
          {offer.map((id, index) => {
            const text = categoryText(t, id)
            const motif = categoryMotif(id)
            const state =
              id === selected ? ' unlock-card--selected' : focus && id !== focus ? ' unlock-card--dim' : ''
            const lit = phase === 'choosing' && focus === null && typed.id === id
            return (
              <li
                key={id}
                style={{ '--i': index } as CSSProperties}
                className={phase === 'leaving' ? (id === selected ? 'unlock-card-keep' : 'unlock-card-drop') : ''}
              >
                <button
                  type="button"
                  className={`offer-card unlock-card${state}${lit ? ' unlock-card--lit' : ''}`}
                  aria-pressed={id === selected}
                  style={{ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` }}
                  onPointerEnter={(event) => event.pointerType === 'mouse' && setHovered(id)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => setHovered(id)}
                  onBlur={() => setHovered(null)}
                  onClick={() => pick(id)}
                >
                  <Shape kind={motif.kind} tint={onTint(motif.tint)} className="offer-shape unlock-card-shape" />
                  <strong>{text.label}</strong>
                  <span>{text.hint}</span>
                  {id === selected && (
                    <span className="unlock-card-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {phase === 'choosing' && (
        <div className="stack unlock-actions">
          {withAd && <p className="note">{t.offer.adNotice}</p>}
          <button type="button" className="btn btn--play btn--block" disabled={!selected} onClick={confirm}>
            <span>{selected ? t.offer.confirm : t.offer.pickFirst}</span>
            <span className="play-glyph unlock-glyph" aria-hidden="true">
              <Shape kind="circle" tint="yellow" />
              <span className="motion play-triangle">
                <Shape kind="triangle" tint="red" />
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

interface Line {
  id: string
  text: string
}

const TYPE_MS = 62
const TYPE_JITTER_MS = 55
const ERASE_MS = 26
const HOLD_MS = 1150
const GAP_MS = 180

/**
 * Types each line out, holds it, erases it and moves on, round and round. A
 * new set of lines erases what is on screen first, so switching card reads as
 * the field changing its mind rather than cutting.
 */
function useTypewriter(lines: readonly Line[], audible: boolean): { text: string; id: string | null; target: string } {
  const [shown, setShown] = useState({ text: '', id: null as string | null, target: '' })
  const current = useRef(shown)
  current.current = shown
  const loud = useRef(audible)
  loud.current = audible

  useEffect(() => {
    if (lines.length === 0) return
    let index = 0
    let text = current.current.text
    let id = current.current.id
    let mode: 'erase' | 'type' | 'hold' = text === '' ? 'type' : 'erase'
    let timer: ReturnType<typeof setTimeout>

    const tick = () => {
      const line = lines[index % lines.length] as Line
      if (mode === 'erase') {
        if (text === '') {
          mode = 'type'
          id = line.id
          setShown({ text, id, target: line.text })
          timer = setTimeout(tick, GAP_MS)
          return
        }
        text = text.slice(0, -1)
        setShown({ text, id, target: current.current.target })
        timer = setTimeout(tick, ERASE_MS)
        return
      }
      if (mode === 'type') {
        if (text === line.text) {
          mode = 'hold'
          timer = setTimeout(tick, HOLD_MS)
          return
        }
        id = line.id
        text = line.text.slice(0, text.length + 1)
        setShown({ text, id, target: line.text })
        if (loud.current) sound.key()
        timer = setTimeout(tick, TYPE_MS + Math.random() * TYPE_JITTER_MS)
        return
      }
      mode = 'erase'
      index += 1
      tick()
    }

    tick()
    return () => clearTimeout(timer)
  }, [lines])

  return shown
}
