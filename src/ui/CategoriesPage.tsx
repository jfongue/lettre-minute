import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { CATALOGUE, categoryMeta } from '../domain/catalogue'
import { bannedOf, banNews, banUnlocked, banVerdict, bansAllowed, isPlus, PLUS_BANS } from '../domain/perks'
import { ownedPlainCount } from '../domain/owned'
import type { Profile } from '../domain/progression'
import { ownedCategoryIds } from '../domain/unlocks'
import { categoryText, useT } from '../i18n'
import { tapFeedback } from '../lib/native'
import { sound } from '../lib/sound'
import { Shape } from './bauhaus'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { LockIcon, PlusLockedSlot, PlusSeal, PremiereIcon, ResourceChip } from './premium'
import { usePremium } from './premiumContext'
import { useBackDismiss } from './useBackDismiss'
import { useHiddenTaps } from './useHiddenTaps'
import { useFeature } from './features'

export interface BanActions {
  onBan(categoryId: string): void
  onUnban(categoryId: string): void
  onIntroSeen(): void
}

export function CategoriesPage({
  profile,
  onHidden,
  onBan,
  onUnban,
  onIntroSeen,
}: { profile: Profile; /** Cinq tapes rapprochées sur le titre : le tableau des mots, caché comme la planche. */ onHidden(): void } & BanActions) {
  const t = useT()
  const premium = usePremium()
  const owned = ownedCategoryIds(profile)
  const filtering = useFeature('categoryBans')
  const unlocked = filtering && banUnlocked(profile)
  const plus = isPlus(profile)
  const banned = new Set(bannedOf(profile, owned))
  const allowed = bansAllowed(profile)
  // Read once, on arrival: the dot goes as soon as the page is seen, the explanation stays until closed.
  const [intro, setIntro] = useState(() => banNews(profile))
  const [warning, setWarning] = useState<'floor' | 'max' | 'limit' | null>(null)
  const tapTitle = useHiddenTaps()
  // An avant-première the player does not own is Premium's door; where nothing is sold it is not shown.
  const premieres = CATALOGUE.filter((category) => category.premiere && !owned.includes(category.id))

  useEffect(() => {
    if (intro) onIntroSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tryBan = (id: string) => {
    const verdict = banVerdict(profile, owned, id)
    setWarning(verdict === 'floor' || verdict === 'max' ? verdict : null)
    if (verdict === 'ok') onBan(id)
    else if (verdict === 'plus') {
      if (premium.storeOpen) premium.open('filter')
      else setWarning('limit')
    }
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
        <p
          className="section-title"
          onClick={() => {
            if (tapTitle()) onHidden()
          }}
        >
          {t.home.myCategories}
          {plus && <span className="plus-badge">{t.plus.badge}</span>}
        </p>
        <p className="note">
          {ownedPlainCount(profile)} / {CATALOGUE.filter((category) => !category.premiere).length}
        </p>
      </div>

      {unlocked && (
        <div className="filter-bar">
          <ResourceChip
            icon="lock"
            count={banned.size}
            max={allowed}
            premium={plus}
            label={t.bans.chip(banned.size, allowed)}
          />
          <p className="note filter-note">{t.bans.lead}</p>
        </div>
      )}
      {filtering && !unlocked && !premium.storeOpen && (
        <div className="filter-locked">
          <LockIcon className="filter-locked-icon" />
          <span className="filter-locked-text">
            <strong>{t.bans.lockedTitle}</strong>
            <span className="note">{t.bans.lockedHow}</span>
          </span>
        </div>
      )}
      {/* Une seule porte : la carte Premium dit aussi le chemin gratuit. */}
      {filtering && !unlocked && premium.storeOpen && (
        <PlusLockedSlot icon="lock" label={t.bans.lockedTitle} hint={t.bans.lockedHowPlus} onOpen={() => premium.open('filter')} />
      )}
      {warning && <p className="note note--warn">{warning === 'max' ? t.bans.max(PLUS_BANS) : t.bans[warning]}</p>}
      <ul className={`categories${unlocked ? ' categories--bans' : ''}`} data-no-swipe={unlocked || undefined}>
        {owned.map((id) => {
          const motif = categoryMotif(id)
          const text = categoryText(t, id)
          const out = banned.has(id)
          const premiere = categoryMeta(id)?.premiere === true
          const row = (
            <>
              <CategoryIcon categoryId={id} tint={motif.tint} className="category-shape" />
              <span className="category-text">
                <span className="category-label">
                  {text.label}
                  {out && <span className="category-banned-tag">{t.bans.banned}</span>}
                  {premiere && (
                    <span className="category-premiere-tag">
                      <PremiereIcon plus size={16} />
                      <PlusSeal size="sm" />
                    </span>
                  )}
                </span>
                <span className="note">{text.hint}</span>
              </span>
              {unlocked && (
                <button
                  type="button"
                  className={`category-lock${out ? ' category-lock--on' : ''}`}
                  onClick={() => toggle(id, out)}
                  aria-pressed={out}
                  aria-label={`${out ? t.bans.unban : t.bans.ban} : ${text.label}`}
                >
                  <LockIcon plus={out} />
                </button>
              )}
            </>
          )
          if (!unlocked) return <li key={id}>{row}</li>
          return (
            <SwipeRow key={id} out={out} label={out ? t.bans.unban : t.bans.ban} onSwipe={() => toggle(id, out)}>
              {row}
            </SwipeRow>
          )
        })}
        {premium.storeOpen &&
          premieres.map((category) => (
            <li key={category.id} className="category--premiere-locked">
              <PlusLockedSlot
                icon="premiere"
                label={categoryText(t, category.id).label}
                hint={`${t.plus.premiere} · ${t.premium.locked}`}
                onOpen={() => premium.open('premiere')}
              />
            </li>
          ))}
      </ul>

      {intro && <BanIntro onClose={() => setIntro(false)} />}
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
