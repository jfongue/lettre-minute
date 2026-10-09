import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type ReactNode } from 'react'
import { availableCategoryIds } from '../data/packs'
import { sharedCategoryIds } from '../domain/catalogue'
import { modeEdge, type ArcadeMode, type GameMode } from '../domain/modes'
import { countPlusAttempt, isPlus } from '../domain/perks'
import type { Profile } from '../domain/progression'
import {
  WEEKLY_FREE_ATTEMPTS,
  attemptsAllowed,
  metricOf,
  weekById,
  weekOf,
  weeklyChallenge,
  weeklyMode,
  weeklyRunOptions,
  weeklyValue,
} from '../domain/weekly'
import type { Messages } from '../i18n'
import { prepareRewardedAd, showRewardedAd } from '../lib/billing'
import { weeklyFinish, fetchWeeklyLastPlayed, fetchWeeklyRecap } from '../lib/cloud'
import { cloudConfigured } from '../lib/supabase'
import { rewardedAdsOpen } from '../platform'
import type { Judge } from '../domain/run'
import type { SessionAction, Session } from '../state/session'
import { loadLocalAttempts, markRecapSeen, recapDue, recordLocalAd } from '../state/weekly'
import { loadWeeklyStatus, markWeeklyIntroSeen, startWeeklyAttempt, weeklyIntroSeen, windowAt } from '../state/weeklyPlay'
import { lazyScreen } from './lazyScreen'
import { ModeIntro } from './ModeIntro'
import { ModeTutorial } from './ModeTutorial'
import type { PremiumReason } from './PremiumSheet'
import { WeeklyCard } from './WeeklyCard'

export const WeeklyScreen = lazyScreen(() => import('./WeeklyScreen').then((module) => module.WeeklyScreen))
export const WeeklyResults = lazyScreen(() => import('./WeeklyResults').then((module) => module.WeeklyResults))
export const WeeklyDone = lazyScreen(() => import('./WeeklyDone').then((module) => module.WeeklyDone))
export const WeeklyRecap = lazyScreen(() => import('./WeeklyRecap').then((module) => module.WeeklyRecap))

type View = { kind: 'screen' } | { kind: 'results'; weekId: string; closed: boolean }

interface Attempt {
  attemptId: string | null
  weekId: string
  lang: string
  plus: boolean
  window: { weekId: string; day: string }
}

interface DoneInfo {
  mode: GameMode
  value: number
  previousBest: number | null
  words: number
  left: number
  total: number
  rank: number | null
  players: number
  sending: 'sending' | 'sent' | 'failed'
}

interface FlowInput {
  enabled: boolean
  lang: string
  t: Messages
  session: Session
  dispatch: Dispatch<SessionAction>
  judgeFor(categoryIds: readonly string[], lang: string, challenge: boolean, edge: 'first' | 'last'): Promise<Judge>
  profile: MutableRefObject<Profile>
  /** La fiche Premium commune (`App.tsx`), ouverte d'ici pour une tentative. */
  openPremium(reason: PremiumReason): void
  /** Le magasin est ouvert : Android, et la fonctionnalité `premium`. */
  premiumOpen: boolean
  preloadRun(): Promise<unknown>
  /** Seul l'accueil montre la carte, et seul lui peut ouvrir le récap. */
  home: boolean
}

/** Pour la planche debug et le tutoriel : les modes que le défi peut prendre sont ceux de la réserve. */
const arcade = (mode: GameMode): ArcadeMode | null => (mode === 'solo' ? null : mode)

/**
 * Tout le défi du moment côté appli : la carte de l'accueil, l'écran du défi,
 * son tutoriel, la partie, la fin de tentative, les résultats, le récap et la
 * fiche Premium qu'il ouvre. `App.tsx` n'en garde qu'un appel, ce qu'il pose
 * à l'accueil et ce qu'il montre en fin de partie.
 */
export function useWeeklyFlow({ enabled, lang, t, session, dispatch, judgeFor, profile, openPremium, premiumOpen, preloadRun, home }: FlowInput) {
  const plus = isPlus(session.profile)
  const week = weekOf(Date.now())
  const challenge = useMemo(
    () => weeklyChallenge(week.weekId, lang, sharedCategoryIds(availableCategoryIds(lang))),
    [week.weekId, lang],
  )

  const [view, setView] = useState<View | null>(null)
  const [intro, setIntro] = useState<{ mode: ArcadeMode; lesson: boolean; launch: boolean } | null>(null)
  const [busy, setBusy] = useState<'ad' | 'launch' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [today, setToday] = useState(() => loadLocalAttempts(windowAt(Date.now())))
  const [played, setPlayed] = useState(false)
  const [done, setDone] = useState<DoneInfo | null>(null)
  const [recapWeek, setRecapWeek] = useState<string | null>(null)
  const attempt = useRef<Attempt | null>(null)
  const best = useRef<number | null>(null)

  // Ce que le joueur a fait aujourd'hui : relu au retour à l'accueil, à l'ouverture de l'écran et après chaque changement.
  const watching = enabled && session.phase === 'home'
  useEffect(() => {
    if (!watching) return
    let live = true
    loadWeeklyStatus(lang, Date.now()).then((status) => {
      if (!live) return
      setToday({ used: status.used, ads: status.ads })
      setPlayed(status.best !== null || status.used > 0)
      best.current = status.best
    })
    return () => {
      live = false
    }
  }, [watching, lang, view?.kind, refresh])

  // Le récap d'une semaine jouée qui vient de se clore, une fois par ouverture.
  const recapChecked = useRef(false)
  useEffect(() => {
    if (!enabled || !home || recapChecked.current || !cloudConfigured()) return
    recapChecked.current = true
    fetchWeeklyLastPlayed(lang).then((playedWeek) => {
      if (playedWeek && recapDue(week.weekId, playedWeek)) setRecapWeek(playedWeek)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, home, lang])

  useEffect(() => {
    if (view?.kind === 'screen' && rewardedAdsOpen) prepareRewardedAd()
  }, [view?.kind])

  const launch = useCallback(async () => {
    const now = Date.now()
    const window = windowAt(now)
    const local = loadLocalAttempts(window)
    setBusy('launch')
    setMessage(null)
    const started = await startWeeklyAttempt(challenge.weekId, lang, window, { plus, ads: local.ads })
    if (!started.ok) {
      setBusy(null)
      setMessage(t.weekly.screen.refused)
      setRefresh((count) => count + 1)
      return
    }
    attempt.current = { attemptId: started.attemptId, weekId: challenge.weekId, lang, plus, window }
    // Une tentative de Premium au-delà des gratuites, et la troisième sans la pub qu'un autre aurait regardée.
    if (plus && started.n > WEEKLY_FREE_ATTEMPTS) {
      dispatch({
        type: 'profile-loaded',
        profile: countPlusAttempt(profile.current, started.n),
      })
    }
    const options = weeklyRunOptions(challenge)
    dispatch({ type: 'play' })
    setView(null)
    try {
      const [judge] = await Promise.all([judgeFor(options.categoryIds ?? [], lang, true, modeEdge(challenge.mode)), preloadRun()])
      dispatch({
        type: 'ready',
        judge,
        seed: options.seed ?? 0,
        categoryIds: options.categoryIds ?? [],
        reserve: [],
        mode: challenge.mode,
        weekly: true,
        noPowers: true,
      })
    } catch {
      dispatch({ type: 'load-failed', message: t.loadFailed })
    }
    setBusy(null)
  }, [challenge, lang, plus, t, dispatch, judgeFor, profile, preloadRun])

  /** Le tutoriel d'un mode s'ouvre seul au premier lancement ; ensuite, la partie part. */
  const start = useCallback(() => {
    const mode = arcade(challenge.mode)
    if (mode && !weeklyIntroSeen(mode)) setIntro({ mode, lesson: false, launch: true })
    else void launch()
  }, [challenge.mode, launch])

  const endIntro = useCallback(() => {
    if (!intro) return
    markWeeklyIntroSeen(intro.mode)
    const again = intro.launch
    setIntro(null)
    if (again) void launch()
  }, [intro, launch])

  const watchAd = useCallback(async () => {
    setBusy('ad')
    setMessage(null)
    const result = await showRewardedAd()
    if (result === 'rewarded') {
      recordLocalAd(windowAt(Date.now()))
      setRefresh((count) => count + 1)
    } else if (result === 'unavailable') setMessage(t.weekly.screen.adFailed)
    setBusy(null)
  }, [t])

  // La fin d'une tentative : la partie part à son défi, jamais au classement du solo.
  const run = session.phase === 'over' && session.weekly ? session.run : null
  useEffect(() => {
    const current = attempt.current
    if (!run || !current) return
    const metric = metricOf(run.mode)
    const local = loadLocalAttempts(current.window)
    const total = attemptsAllowed({ plus: current.plus, adsWatched: local.ads })
    const base: DoneInfo = {
      mode: run.mode,
      value: weeklyValue(run, metric),
      previousBest: best.current,
      words: run.found.length,
      left: Math.max(0, total - local.used),
      total,
      rank: null,
      players: 0,
      sending: 'sending',
    }
    setDone(base)
    let live = true
    const sent = current.attemptId ? weeklyFinish(current.attemptId, run, metric) : Promise.resolve(false)
    void sent.then(async (ok) => {
      if (!live) return
      if (!ok) return setDone({ ...base, sending: 'failed' })
      const recap = await fetchWeeklyRecap(current.weekId, current.lang)
      if (!live) return
      best.current = Math.max(best.current ?? 0, base.value)
      setDone({ ...base, rank: recap?.rank ?? null, players: recap?.players ?? 0, sending: 'sent' })
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  const backFromDone = useCallback(() => {
    dispatch({ type: 'home' })
    setDone(null)
    setView({ kind: 'screen' })
    setRefresh((count) => count + 1)
  }, [dispatch])

  const closeRecap = useCallback(
    (then?: View) => {
      if (recapWeek) markRecapSeen(recapWeek)
      setRecapWeek(null)
      if (then) setView(then)
    },
    [recapWeek],
  )

  const card: ReactNode =
    enabled && home ? (
      <WeeklyCard
        mode={challenge.mode}
        closesAt={week.closesAt}
        used={today.used}
        free={attemptsAllowed({ plus, adsWatched: today.ads })}
        onOpen={() => setView({ kind: 'screen' })}
      />
    ) : null

  /** Un écran du défi couvre l'accueil, qui ne se montre alors ni ne se notifie. */
  const covering = enabled && (view !== null || intro !== null || recapWeek !== null)

  const overlay: ReactNode = !enabled ? null : (
    <>
      {intro && session.phase === 'home' && (
        intro.lesson ? (
          <ModeTutorial mode={intro.mode} lang={lang} skipIntro onDone={endIntro} />
        ) : (
          <ModeIntro mode={intro.mode} onDone={endIntro} onTry={() => setIntro({ ...intro, lesson: true })} />
        )
      )}

      {!intro && view?.kind === 'screen' && session.phase === 'home' && (
        <Suspense fallback={null}>
          <WeeklyScreen
            mode={challenge.mode}
            closesAt={week.closesAt}
            lineup={challenge.lineup}
            lang={lang}
            plus={plus}
            adsOpen={rewardedAdsOpen}
            premiumOpen={premiumOpen}
            busy={busy}
            message={message}
            refresh={refresh}
            onLaunch={start}
            onWatchAd={watchAd}
            onPremium={() => openPremium('attempt')}
            onTutorial={() => {
              const mode = arcade(challenge.mode)
              if (mode) setIntro({ mode, lesson: false, launch: false })
            }}
            onResults={() => setView({ kind: 'results', weekId: challenge.weekId, closed: false })}
            onBack={() => setView(null)}
          />
        </Suspense>
      )}

      {!intro && view?.kind === 'results' && session.phase === 'home' && (
        <Suspense fallback={null}>
          <WeeklyResults
            key={view.weekId}
            weekId={view.weekId}
            lang={lang}
            mode={weeklyMode(view.weekId)}
            closed={view.closed}
            closesAt={weekById(view.weekId).closesAt}
            played={played}
            onBack={() => setView(view.closed ? null : { kind: 'screen' })}
            onPlay={view.closed ? undefined : () => setView({ kind: 'screen' })}
          />
        </Suspense>
      )}

      {recapWeek && home && !view && !intro && (
        <Suspense fallback={null}>
          <WeeklyRecap
            weekId={recapWeek}
            lang={lang}
            mode={weeklyMode(recapWeek)}
            onGo={() => closeRecap({ kind: 'screen' })}
            onResults={() => closeRecap({ kind: 'results', weekId: recapWeek, closed: true })}
            onLater={() => closeRecap()}
          />
        </Suspense>
      )}

    </>
  )

  const over: ReactNode =
    enabled && session.phase === 'over' && session.weekly && session.run && done ? (
      <Suspense fallback={null}>
        <WeeklyDone
          mode={done.mode}
          value={done.value}
          previousBest={done.previousBest}
          words={done.words}
          left={done.left}
          total={done.total}
          rank={done.rank}
          players={done.players}
          sending={done.sending}
          onBack={backFromDone}
        />
      </Suspense>
    ) : null

  return { card, covering, overlay, over, preload: [WeeklyScreen, WeeklyResults, WeeklyDone, WeeklyRecap] as const }
}
