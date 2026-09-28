import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { CATALOGUE } from '../domain/catalogue'
import { bannedOf, banNews, banUnlocked, banVerdict, isPlus } from '../domain/perks'
import type { Profile } from '../domain/progression'
import { ownedCategoryIds } from '../domain/unlocks'
import { categoryText, useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Shape } from './bauhaus'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { PlusPop } from './PlusPop'
import { useBackDismiss } from './useBackDismiss'

export interface BanActions {
  onBan(categoryId: string): void
  onUnban(categoryId: string): void
  onIntroSeen(): void
  onJoinPlus(): void
}

export function CategoriesPage({ profile, onBan, onUnban, onIntroSeen, onJoinPlus }: { profile: Profile } & BanActions) {
  const t = useT()
  const owned = ownedCategoryIds(profile)
  const banning = banUnlocked(owned)
  const banned = new Set(bannedOf(profile, owned))
  // Read once, on arrival: the dot goes as soon as the page is seen, the explanation stays until closed.
  const [intro, setIntro] = useState(() => banNews(profile, owned))
  const [plusFor, setPlusFor] = useState<string | null>(null)
  const [warning, setWarning] = useState<'floor' | 'max' | null>(null)

  useEffect(() => {
    if (intro) onIntroSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tryBan = (id: string) => {
    const verdict = banVerdict(profile, owned, id)
    setWarning(verdict === 'floor' || verdict === 'max' ? verdict : null)
    if (verdict === 'ok') onBan(id)
    else if (verdict === 'plus') setPlusFor(id)
    return verdict === 'ok'
  }
  const toggle = (id: string, out: boolean) => {
    if (out) {
      setWarning(null)
      onUnban(id)
      return true
    }
    return tryBan(id)
  }

  return (
    <section className="stack">
      <div className="spread">
        <p className="section-title">
          {t.home.myCategories}
          {isPlus(profile) && <span className="plus-badge">{t.plus.badge}</span>}
        </p>
        <p className="note">
          {owned.length} / {CATALOGUE.length}
        </p>
      </div>
      {banning && <p className="note">{t.bans.lead}</p>}
      {warning && <p className="note note--warn">{t.bans[warning]}</p>}
      <ul className={`categories${banning ? ' categories--bans' : ''}`} data-no-swipe={banning || undefined}>
        {owned.map((id) => {
          const motif = categoryMotif(id)
          const text = categoryText(t, id)
          const out = banned.has(id)
          const row = (
            <>
              <CategoryIcon categoryId={id} tint={motif.tint} className="category-shape" />
              <span className="category-label">
                {text.label}
                {out && <span className="category-banned-tag">{t.bans.banned}</span>}
              </span>
              <span className="note">{text.hint}</span>
              {banning && (
                <button
                  type="button"
                  className={`btn btn--quiet${out ? '' : ' btn--muted'} category-ban`}
                  onClick={() => toggle(id, out)}
                  aria-label={`${out ? t.bans.unban : t.bans.ban} : ${text.label}`}
                >
                  {out ? t.bans.unban : t.bans.ban}
                </button>
              )}
            </>
          )
          if (!banning) return <li key={id}>{row}</li>
          return (
            <SwipeRow key={id} out={out} label={out ? t.bans.unban : t.bans.ban} onSwipe={() => toggle(id, out)}>
              {row}
            </SwipeRow>
          )
        })}
      </ul>

      {intro && <BanIntro onClose={() => setIntro(false)} />}
      {plusFor && (
        <PlusPop
          reason="ban"
          onClose={() => setPlusFor(null)}
          onJoin={() => {
            onJoinPlus()
            onBan(plusFor)
            setPlusFor(null)
          }}
        />
      )}
    </section>
  )
}

/** How far the thumb must travel before letting go bans or restores. */
const SWIPE_AT_PX = 44
/** The row follows the thumb at this ratio, and never further than this. */
const DRAG_RATIO = 0.7
const DRAG_MAX_PX = 90

/**
 * A category row that a light flick, either way, bans or restores. The row
 * follows the thumb over the colour of what letting go will do; a mostly
 * vertical gesture stays a scroll, and a tap is still a tap.
 */
function SwipeRow({
  out,
  label,
  onSwipe,
  children,
}: {
  out: boolean
  label: string
  /** False when the ban was turned down: the row springs back without a thud. */
  onSwipe(): boolean
  children: ReactNode
}) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const moved = useRef(false)

  const down = (event: PointerEvent<HTMLLIElement>) => {
    if (event.button !== 0) return
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
    moved.current = false
  }
  const move = (event: PointerEvent<HTMLLIElement>) => {
    const from = start.current
    if (!from || from.id !== event.pointerId) return
    const x = event.clientX - from.x
    const y = event.clientY - from.y
    if (!dragging) {
      if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
        start.current = null
        return
      }
      if (Math.abs(x) < 8) return
      setDragging(true)
      moved.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setDx(Math.max(-DRAG_MAX_PX, Math.min(DRAG_MAX_PX, x * DRAG_RATIO)))
  }
  const up = () => {
    const passed = Math.abs(dx) >= SWIPE_AT_PX * DRAG_RATIO
    start.current = null
    setDragging(false)
    setDx(0)
    if (!passed) return
    if (onSwipe()) {
      tapFeedback('medium')
      sound.click()
    } else {
      tapFeedback('light')
    }
  }

  const armed = Math.abs(dx) >= SWIPE_AT_PX * DRAG_RATIO
  return (
    <li
      className={`category-swipe${out ? ' category--banned' : ''}${dragging ? ' category-swipe--drag' : ''}${armed ? ' category-swipe--armed' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      // A drag is not a tap: the button under the thumb must not fire as well.
      onClickCapture={(event) => {
        if (moved.current) {
          event.stopPropagation()
          event.preventDefault()
          moved.current = false
        }
      }}
    >
      <span className={`category-swipe-under category-swipe-under--${out ? 'restore' : 'ban'}`} aria-hidden="true">
        <span style={{ opacity: dx > 0 ? 1 : 0 }}>{label}</span>
        <span style={{ opacity: dx < 0 ? 1 : 0 }}>{label}</span>
      </span>
      <span className="category-swipe-row" style={{ '--dx': `${dx}px` } as CSSProperties}>
        {children}
      </span>
    </li>
  )
}

function BanIntro({ onClose }: { onClose(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="ban-intro-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="circle" tint="red" />
          </span>
        </span>
        <h2 id="ban-intro-title" className="offer-pop-title">
          {t.bans.introTitle}
        </h2>
        <p>{t.bans.introLead}</p>
        <div className="offer-pop-actions plus-pop-actions">
          <button type="button" className="btn btn--blue" onClick={onClose}>
            {t.bans.introOk}
          </button>
        </div>
      </div>
    </div>
  )
}
