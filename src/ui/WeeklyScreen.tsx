import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import type { GameMode } from '../domain/modes'
import { attemptState, attemptsAllowed, metricOf, type AttemptSlot, type WeeklyMetric } from '../domain/weekly'
import { sound } from '../lib/sound'
import { tapFeedback } from '../lib/native'
import { loadWeeklyStatus, type WeeklyStatus } from '../state/weeklyPlay'
import { Shape } from './bauhaus'
import { onTint } from './motifs'
import { PlusSeal } from './premium'
import { MODE_TINTS, ModeGlyph, Ticket, WeeklyStat, timeLeft, useNow, valueText, type SlotLook } from './WeeklyParts'
import { useBackDismiss } from './useBackDismiss'

export interface WeeklyViewProps {
  mode: GameMode
  closesAt: number
  /** Fixée par la planche debug ; sinon l'horloge. */
  now?: number
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

/** Le billet d'une place : jouée, à jouer, à ouvrir par une pub, ou derrière Premium. */
const ticketLook = (slot: AttemptSlot): SlotLook | 'ad' | 'locked' =>
  slot === 'used' ? 'used' : slot === 'ad' ? 'ad' : slot === 'locked' ? 'locked' : 'free'

/**
 * L'écran du défi, lu : la planche debug le montre sans serveur. Trois billets
 * disent les tentatives, un seul bouton dit quoi faire — jouer, regarder une
 * pub, ou passer Premium —, les offres ne se montrant que lorsqu'il ne reste
 * rien à jouer.
 */
export function WeeklyView({
  mode,
  closesAt,
  now,
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
  // La pub est le seul chemin qui reste : elle prend la place du bouton de jeu.
  const adNext = next < 0 && adsOpen && slots.includes('ad')
  const outOfTries = status !== null && next < 0 && !adNext

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

      <div className="wk-stats wk-stats--line">
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
        <section className="wk-play">
          <div className="wk-tickets">
            <span className="wk-card-tickets">
              {slots.map((slot, place) => (
                <span key={place} role="img" aria-label={t.weekly.screen.slot[slot]}>
                  <Ticket look={ticketLook(slot)} size={30} />
                </span>
              ))}
            </span>
            {next >= 0 && (
              <p className="wk-heading" role="status">
                {t.weekly.card.attempts(left)}
              </p>
            )}
            {plus && <PlusSeal size="md" />}
          </div>

          {next >= 0 && (
            <button type="button" className="btn btn--play wk-play-button btn--block" disabled={busy !== null} onClick={() => setConfirming(true)}>
              <span>{busy === 'launch' ? t.loading : t.weekly.card.play}</span>
              <span className="play-glyph" aria-hidden="true">
                <Shape kind="circle" tint="yellow" />
                <span className="motion play-triangle">
                  <Shape kind="triangle" tint="red" />
                </span>
              </span>
            </button>
          )}

          {adNext && (
            <button type="button" className="btn btn--blue btn--block" disabled={busy === 'ad'} onClick={onWatchAd}>
              {busy === 'ad' ? t.weekly.screen.adBusy : t.weekly.screen.watchAd}
            </button>
          )}

          {outOfTries && <p className="note">{t.weekly.screen.allUsed}</p>}
          {!plus && premiumOpen && (adNext || outOfTries) && (
            <button type="button" className="wk-premium-link" onClick={onPremium}>
              <PlusSeal size="sm" />
              {t.weekly.screen.goPremium}
            </button>
          )}
          {!status.online && <p className="note">{t.weekly.screen.offline}</p>}
          {message && (
            <p className="note note--warn" role="alert">
              {message}
            </p>
          )}
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

/** Le défi, chargé : ce que le joueur en a déjà fait vient du serveur, et à défaut de l'appareil. */
export function WeeklyScreen({
  mode,
  closesAt,
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
