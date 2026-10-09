import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { categoryText, useT } from '../i18n'
import type { GameMode } from '../domain/modes'
import { attemptState, attemptsAllowed, metricOf, WEEKLY_FREE_ATTEMPTS, type AttemptSlot, type WeeklyMetric } from '../domain/weekly'
import { sound } from '../lib/sound'
import { tapFeedback } from '../lib/native'
import { loadWeeklyStatus, type WeeklyStatus } from '../state/weeklyPlay'
import { Shape } from './bauhaus'
import { onTint } from './motifs'
import { PlusLockedSlot, PlusSeal } from './premium'
import { MODE_TINTS, ModeGlyph, Ticket, WeeklyStat, timeLeft, useNow, valueText } from './WeeklyParts'
import { useBackDismiss } from './useBackDismiss'

export interface WeeklyViewProps {
  mode: GameMode
  closesAt: number
  /** Fixée par la planche debug ; sinon l'horloge. */
  now?: number
  lineup: readonly string[]
  /** Null tant que le serveur n'a pas répondu. */
  status: Pick<WeeklyStatus, 'used' | 'ads' | 'best' | 'rank' | 'players' | 'online'> | null
  plus: boolean
  /** Les pubs récompensées existent sur cet appareil (Android seul). */
  adsOpen: boolean
  /** L'achat Premium existe sur cet appareil (Android seul). */
  premiumOpen: boolean
  busy?: 'ad' | 'launch' | null
  message?: string | null
  onLaunch(): void
  onWatchAd(): void
  onPremium(): void
  onTutorial(): void
  onResults(): void
  onBack(): void
}

/** L'écran du défi, lu : la planche debug le montre sans serveur. */
export function WeeklyView({
  mode,
  closesAt,
  now,
  lineup,
  status,
  plus,
  adsOpen,
  premiumOpen,
  busy = null,
  message = null,
  onLaunch,
  onWatchAd,
  onPremium,
  onTutorial,
  onResults,
  onBack,
}: WeeklyViewProps) {
  const t = useT()
  const clock = useNow(now)
  const [confirming, setConfirming] = useState(false)
  useBackDismiss(confirming ? () => setConfirming(false) : null)
  const tint = MODE_TINTS[mode]
  const metric: WeeklyMetric = metricOf(mode)

  const used = status?.used ?? 0
  const ads = status?.ads ?? 0
  const slots = attemptState(used, plus, ads)
  const total = attemptsAllowed({ plus, adsWatched: ads })
  const left = Math.max(0, total - used)
  const next = slots.findIndex((slot) => slot === 'free' || slot === 'plus')
  const spent = used >= WEEKLY_FREE_ATTEMPTS || plus
  // Avant les deux premières tentatives, seules les deux gratuites se montrent :
  // le reste n'est pas une offre tant qu'il reste de quoi jouer.
  const shown = spent ? slots : slots.slice(0, WEEKLY_FREE_ATTEMPTS)
  const rows = shown
    .map((slot, place) => ({ slot, place }))
    .filter(({ slot }) => (slot === 'ad' ? adsOpen || premiumOpen : slot === 'locked' ? premiumOpen : true))
  const offers = rows.some(({ slot }) => slot === 'ad' || slot === 'locked')

  const heading =
    used === 0 ? t.weekly.screen.intro(total) : left > 0 ? t.weekly.screen.introLeft(left) : offers ? t.weekly.screen.introAfter(used) : t.weekly.screen.allUsed

  const launch = () => {
    sound.go()
    tapFeedback('medium')
    setConfirming(false)
    onLaunch()
  }

  return (
    <div className="sheet cascade wk-screen">
      <div className="subpage-head">
        <button type="button" className="subpage-back" onClick={onBack} aria-label={t.weekly.screen.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="subpage-title">{t.weekly.title}</h1>
      </div>

      <section className="wk-hero" style={{ background: `var(--${tint})`, color: `var(--${onTint(tint)})` } as CSSProperties}>
        <div className="wk-hero-top">
          <span className="wk-hero-mark">
            <ModeGlyph mode={mode} />
          </span>
          <span className="wk-hero-time">{t.weekly.ends(timeLeft(t, clock, closesAt))}</span>
        </div>
        <h2 className="wk-hero-mode">{t.modes[mode]}</h2>
        <p className="wk-hero-rule">{t.weekly.rules[mode]}</p>
      </section>

      <div className="wk-stats">
        <WeeklyStat label={t.weekly.screen.best}>
          {status === null ? '…' : status.best === null ? <span className="wk-none">{t.weekly.screen.noBest}</span> : valueText(t, status.best, metric)}
        </WeeklyStat>
        <WeeklyStat label={t.weekly.screen.rank}>
          {status === null ? '…' : status.rank === null ? <span className="wk-none">—</span> : t.weekly.screen.rankOf(status.rank, Math.max(status.players, status.rank))}
        </WeeklyStat>
      </div>

      {status === null ? (
        <p className="note" role="status">
          {t.weekly.screen.loading}
        </p>
      ) : (
        <section className="wk-attempts">
          <div className="spread">
            <p className="section-title">{t.weekly.screen.attempts}</p>
            {plus && <PlusSeal size="md" />}
          </div>
          <p className="wk-heading" role="status">
            {heading}
          </p>
          <ol className="wk-slots">
            {rows.map(({ slot, place }) => (
              <li key={place} className={place === next ? 'wk-slot-item wk-slot-item--next' : 'wk-slot-item'}>
                <SlotRow
                  slot={slot}
                  index={place}
                  adsOpen={adsOpen}
                  premiumOpen={premiumOpen}
                  busy={busy === 'ad'}
                  onWatchAd={onWatchAd}
                  onPremium={onPremium}
                />
              </li>
            ))}
          </ol>
          {!status.online && <p className="note">{t.weekly.screen.offline}</p>}
          {message && (
            <p className="note note--warn" role="alert">
              {message}
            </p>
          )}
          {next >= 0 && (
            <button type="button" className="btn btn--play wk-play btn--block" disabled={busy !== null} onClick={() => setConfirming(true)}>
              <span>{busy === 'launch' ? t.loading : t.weekly.screen.launch(next + 1)}</span>
              <span className="play-glyph" aria-hidden="true">
                <Shape kind="circle" tint="yellow" />
                <span className="motion play-triangle">
                  <Shape kind="triangle" tint="red" />
                </span>
              </span>
            </button>
          )}
        </section>
      )}

      {lineup.length > 0 && (
        <section className="stack">
          <p className="section-title">{t.weekly.screen.lineup}</p>
          <p className="challenge-lineup">
            {lineup.map((id) => (
              <span key={id} className="tag tag--plain">
                {categoryText(t, id).label}
              </span>
            ))}
          </p>
        </section>
      )}

      <div className="wk-links">
        <button type="button" className="btn btn--ghost btn--block" onClick={onResults}>
          {t.weekly.screen.results}
        </button>
        <button type="button" className="btn btn--quiet btn--block" onClick={onTutorial}>
          {t.weekly.screen.tutorial}
        </button>
      </div>

      {confirming && next >= 0 && (
        <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="wk-confirm-title">
          <div className="offer-pop-scrim" onClick={() => setConfirming(false)} />
          <div className="wk-confirm">
            <Ticket look="free" size={44} />
            <h2 id="wk-confirm-title">{t.weekly.screen.confirmTitle(next + 1)}</h2>
            <p className="note">{t.weekly.screen.confirmBody}</p>
            <button type="button" className="btn btn--blue btn--block" onClick={launch} autoFocus>
              {t.weekly.screen.confirmGo}
            </button>
            <button type="button" className="btn btn--quiet btn--block" onClick={() => setConfirming(false)}>
              {t.weekly.screen.confirmCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SlotRow({
  slot,
  index,
  adsOpen,
  premiumOpen,
  busy,
  onWatchAd,
  onPremium,
}: {
  slot: AttemptSlot
  index: number
  adsOpen: boolean
  premiumOpen: boolean
  busy: boolean
  onWatchAd(): void
  onPremium(): void
}) {
  const t = useT()
  const label = t.weekly.screen.attempt(index + 1)
  if (slot === 'locked')
    return <PlusLockedSlot icon="ticket" label={label} hint={t.weekly.screen.slot.locked} onOpen={onPremium} />
  if (slot === 'ad')
    return (
      <div className="wk-slot wk-slot--ad">
        <Ticket look="ad" />
        <span className="wk-slot-text">
          <strong>{label}</strong>
          <span className="note">{t.weekly.screen.slot.ad}</span>
        </span>
        <span className="wk-slot-actions">
          {adsOpen && (
            <button type="button" className="btn btn--blue" disabled={busy} onClick={onWatchAd}>
              {busy ? t.weekly.screen.adBusy : t.weekly.screen.watchAd}
            </button>
          )}
          {premiumOpen && (
            <button type="button" className="wk-premium-link" onClick={onPremium}>
              <PlusSeal size="sm" />
              {t.weekly.screen.goPremium}
            </button>
          )}
        </span>
      </div>
    )
  const look = slot === 'used' ? 'used' : 'free'
  return (
    <div className={`wk-slot wk-slot--${slot}`}>
      <Ticket look={look} />
      <span className="wk-slot-text">
        <strong>{label}</strong>
        <span className="note">{slot === 'used' ? t.weekly.screen.slot.used : slot === 'plus' ? t.weekly.screen.slot.plus : t.weekly.screen.slot.free}</span>
      </span>
      {slot === 'plus' && <PlusSeal size="sm" />}
    </div>
  )
}

/** Le défi, chargé : ce que le joueur en a déjà fait vient du serveur, et à défaut de l'appareil. */
export function WeeklyScreen({
  mode,
  closesAt,
  lineup,
  lang,
  plus,
  adsOpen,
  premiumOpen,
  busy,
  message,
  refresh,
  onLaunch,
  onWatchAd,
  onPremium,
  onTutorial,
  onResults,
  onBack,
}: Omit<WeeklyViewProps, 'status'> & {
  lang: string
  /** Relu à chaque changement : après une pub, une partie ou un achat. */
  refresh: number
}) {
  const [status, setStatus] = useState<WeeklyStatus | null>(null)
  const load = useCallback(() => {
    let live = true
    loadWeeklyStatus(lang, Date.now()).then((next) => live && setStatus(next))
    return () => {
      live = false
    }
  }, [lang])
  useEffect(() => {
    window.scrollTo(0, 0)
    return load()
  }, [load, refresh])
  return (
    <WeeklyView
      mode={mode}
      closesAt={closesAt}
      lineup={lineup}
      status={status}
      plus={plus}
      adsOpen={adsOpen}
      premiumOpen={premiumOpen}
      busy={busy}
      message={message}
      onLaunch={onLaunch}
      onWatchAd={onWatchAd}
      onPremium={onPremium}
      onTutorial={onTutorial}
      onResults={onResults}
      onBack={onBack}
    />
  )
}
