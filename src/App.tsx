import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { availableCategoryIds, loadPacks } from './data/packs'
import {
  fetchCommunityWords,
  fetchCrowdUsage,
  fetchLeaderboard,
  pushRun,
  pushSubmissions,
  type CommunityWord,
  type LeaderboardRow,
} from './lib/cloud'
import { unlockedCategories } from './domain/catalogue'
import { levelFor, NEW_PROFILE } from './domain/progression'
import { remainingSeconds } from './domain/run'
import { withExtraWords } from './domain/words'
import { createJudge } from './state/judge'
import { initialSession, sessionReducer } from './state/session'
import { loadProfile, loadSubmissions, saveProfile, saveSubmissions } from './state/storage'
import { useElapsed } from './state/useElapsed'
import { HomeScreen } from './ui/HomeScreen'
import { OverScreen } from './ui/OverScreen'
import { RunScreen } from './ui/RunScreen'

/** Sends the words proposed while the game was offline, then clears the queue. */
function flushSubmissions(): void {
  const pending = loadSubmissions()
  if (pending.length === 0) return
  pushSubmissions(pending).then((sent) => {
    if (sent.length > 0) saveSubmissions([])
  })
}

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession(NEW_PROFILE))
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [crowd, setCrowd] = useState<Readonly<Record<string, number>>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const community = useRef<Record<string, CommunityWord[]>>({})

  // The stored profile is read after the first paint: touching localStorage
  // during render is a side effect, and the home screen is right either way.
  useEffect(() => {
    dispatch({ type: 'profile-loaded', profile: loadProfile() })
  }, [])

  useEffect(() => {
    if (session.profile !== NEW_PROFILE) saveProfile(session.profile)
  }, [session.profile, crowd])

  // Everything below is best-effort: the cloud calls answer with a fallback
  // rather than throwing, so a missing project simply leaves the game local.
  useEffect(() => {
    fetchCrowdUsage().then((usage) => setCrowd(usage.shares))
    fetchCommunityWords().then((words) => {
      community.current = words
    })
    fetchLeaderboard().then(setLeaderboard)
    flushSubmissions()
  }, [])

  const elapsed = useElapsed(session.phase === 'playing' ? startedAt : null)
  const remaining = session.run ? remainingSeconds(session.run, elapsed) : 0

  useEffect(() => {
    if (session.phase === 'playing' && remaining <= 0) dispatch({ type: 'time-up' })
  }, [session.phase, remaining])

  const play = useCallback(async () => {
    dispatch({ type: 'play' })
    try {
      // A category of the catalogue whose dictionary has not been imported yet
      // is simply not dealt, rather than failing the whole run.
      const shipped = new Set(availableCategoryIds())
      const categoryIds = unlockedCategories(levelFor(session.profile.xp))
        .map((category) => category.id)
        .filter((id) => shipped.has(id))
      const packs = (await loadPacks(categoryIds)).map((pack) =>
        withExtraWords(
          pack,
          (community.current[pack.categoryId] ?? []).map((word) => ({
            key: '',
            display: word.display,
            sitelinks: word.sitelinks,
            frequency: word.frequency,
            notoriety: 0,
          })),
        ),
      )
      const judge = createJudge(packs, { own: session.profile.usage, crowd })
      setStartedAt(Date.now())
      dispatch({ type: 'ready', judge, seed: Date.now() >>> 0 })
    } catch (error) {
      dispatch({ type: 'load-failed', message: (error as Error).message })
    }
  }, [session.profile, crowd])

  // Proposing costs no clock: in a timed run, a confirmation dialog would take
  // the seconds the player is spending on the word they just failed to place.
  const propose = useCallback(
    (word: string) => {
      if (!session.run) return
      saveSubmissions([
        ...loadSubmissions(),
        { word: word.trim(), categoryId: session.run.prompt.categoryId, at: Date.now() },
      ])
      dispatch({ type: 'propose', word })
    },
    [session.run],
  )

  useEffect(() => {
    if (session.phase !== 'over' || !session.run) return
    pushRun(session.run, session.profile)
    flushSubmissions()
    fetchLeaderboard().then(setLeaderboard)
    // The run is pushed once, when the clock stops: the profile that follows it
    // in the same render is the one the score was just added to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase])

  return (
    <main className={`stage stage--${session.phase}`}>
      {(session.phase === 'home' || session.phase === 'loading') && (
        <HomeScreen
          profile={session.profile}
          error={session.error}
          loading={session.phase === 'loading'}
          leaderboard={leaderboard}
          onPlay={play}
        />
      )}

      {session.phase === 'playing' && session.run && (
        <RunScreen
          run={session.run}
          draft={session.draft}
          live={session.live}
          cheer={session.cheer}
          remaining={remaining}
          onType={(draft) => dispatch({ type: 'type', draft })}
          onSubmit={() => dispatch({ type: 'submit' })}
          onSkip={() => dispatch({ type: 'skip' })}
          proposed={session.proposed}
          onPropose={propose}
        />
      )}

      {session.phase === 'over' && session.run && (
        <OverScreen
          run={session.run}
          profile={session.profile}
          levelBefore={session.levelBefore}
          onReplay={play}
          onHome={() => dispatch({ type: 'home' })}
        />
      )}

    </main>
  )
}
