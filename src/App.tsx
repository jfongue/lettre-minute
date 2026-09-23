import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { availableCategoryIds, loadPack, loadPacks } from './data/packs'
import {
  deleteAccount,
  fetchAccount,
  fetchCommunityWords,
  fetchCrowdUsage,
  fetchLeaderboard,
  logIn,
  logOut,
  pushAvatar,
  pushRun,
  pushSubmissions,
  register,
  type Account,
  type CommunityWord,
  type LeaderboardRow,
} from './lib/cloud'
import { onBackButton, tapFeedback } from './lib/native'
import { DEFAULT_AVATAR, type AvatarChoice } from './domain/avatar'
import { NEW_PROFILE, type Profile } from './domain/progression'
import { remainingSeconds } from './domain/run'
import { dealLineup, ownedCategoryIds, swapCategory } from './domain/unlocks'
import { withExtraWords } from './domain/words'
import { createJudge } from './state/judge'
import { initialSession, sessionReducer } from './state/session'
import {
  clearLocalData,
  loadAvatar,
  loadProfile,
  loadSubmissions,
  saveAvatar,
  saveProfile,
  saveSubmissions,
} from './state/storage'
import { useElapsed } from './state/useElapsed'
import type { AccountActions } from './ui/AccountPanel'
import { AvatarScreen } from './ui/AvatarScreen'
import { CountdownScreen } from './ui/CountdownScreen'
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
  const [avatar, setAvatar] = useState<AvatarChoice>(DEFAULT_AVATAR)
  const [account, setAccount] = useState<Account | null>(null)
  const [editingAvatar, setEditingAvatar] = useState(false)
  // The seed of the run whose reveal has played: leaving for the avatar editor
  // and coming back must not replay it.
  const [revealed, setRevealed] = useState<number | null>(null)
  // Signing in must wait for the run to reach the server: the merge moves the
  // anonymous player's runs, and a run still in flight would be left behind.
  const pushing = useRef<Promise<unknown>>(Promise.resolve())
  const profile = useRef(session.profile)
  profile.current = session.profile

  // The stored profile is read after the first paint: touching localStorage
  // during render is a side effect, and the home screen is right either way.
  useEffect(() => {
    dispatch({ type: 'profile-loaded', profile: loadProfile() })
    setAvatar(loadAvatar())
  }, [])

  const wear = useCallback((next: AvatarChoice) => {
    setAvatar(next)
    saveAvatar(next)
  }, [])

  /** A permanent account is the reference: another device may have played on it since. */
  const adopt = useCallback(
    (next: Account) => {
      setAccount(next)
      if (next.anonymous) return
      const local: Profile = profile.current
      if (next.stats.runs >= local.runs) {
        // The server keeps totals, not category picks: those stay on the device.
        dispatch({ type: 'profile-loaded', profile: { ...local, ...next.stats } })
      }
      if (next.avatar) wear(next.avatar)
    },
    [wear],
  )

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
    fetchAccount().then((found) => found && adopt(found))
    flushSubmissions()
  }, [adopt])

  const accountActions: AccountActions = {
    async onRegister(name, email, password) {
      await pushing.current
      const outcome = await register(name, email, password)
      if (!outcome.ok) return outcome.message
      setAccount(outcome.account)
      pushAvatar(avatar)
      fetchLeaderboard().then(setLeaderboard)
      // With email confirmation on, the account stays anonymous until the link is followed.
      return outcome.account.anonymous ? `Un lien de confirmation est parti à ${email.trim()}.` : null
    },
    async onLogIn(email, password) {
      await pushing.current
      const outcome = await logIn(email, password)
      if (!outcome.ok) return outcome.message
      adopt(outcome.account)
      // The merge summed both players on the server: its totals are the truth now.
      dispatch({ type: 'profile-loaded', profile: { ...profile.current, ...outcome.account.stats } })
      if (!outcome.account.avatar) pushAvatar(avatar)
      fetchLeaderboard().then(setLeaderboard)
      return null
    },
  }

  // Android's back gesture leaves a run for the home screen, and closes the app
  // from there. A ref keeps one listener for the whole session.
  const phase = useRef(session.phase)
  phase.current = session.phase
  useEffect(
    () =>
      onBackButton(() => {
        if (phase.current === 'home' || phase.current === 'loading') return false
        dispatch({ type: 'home' })
        return true
      }),
    [],
  )

  useEffect(() => {
    if (session.cheer) tapFeedback()
  }, [session.cheer])

  const elapsed = useElapsed(session.phase === 'playing' ? startedAt : null)
  const remaining = session.run ? remainingSeconds(session.run, elapsed) : 0

  useEffect(() => {
    if (session.phase === 'playing' && remaining <= 0) dispatch({ type: 'time-up' })
  }, [session.phase, remaining])

  // A pick owed and no offer on the table — after a level up, or on a device
  // that has never seen this player's picks — deals three categories to choose from.
  useEffect(() => {
    dispatch({ type: 'offer', availableIds: availableCategoryIds(), seed: Date.now() >>> 0 })
  }, [session.profile])

  const judgeFor = useCallback(
    async (categoryIds: readonly string[]) => {
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
      return createJudge(packs, { own: session.profile.usage, crowd })
    },
    [session.profile.usage, crowd],
  )

  const play = useCallback(async () => {
    dispatch({ type: 'play' })
    try {
      // A category of the catalogue whose dictionary has not been imported yet
      // is simply not dealt, rather than failing the whole run.
      const shipped = new Set(availableCategoryIds())
      const seed = Date.now() >>> 0
      const lineup = dealLineup(
        seed,
        ownedCategoryIds(session.profile).filter((id) => shipped.has(id)),
      )
      const judge = await judgeFor(lineup.dealt)
      dispatch({ type: 'ready', judge, seed, categoryIds: lineup.dealt, reserve: lineup.reserve })
      // Warmed while the categories are announced, so the first swap is instant.
      if (lineup.reserve[0]) loadPack(lineup.reserve[0]).catch(() => undefined)
    } catch (error) {
      dispatch({ type: 'load-failed', message: (error as Error).message })
    }
  }, [session.profile, judgeFor])

  const [swapping, setSwapping] = useState(false)
  const swap = useCallback(
    async (index: number) => {
      if (!session.run || swapping) return
      const lineup = swapCategory({ dealt: session.run.categoryIds, reserve: session.reserve }, index)
      if (lineup.dealt === session.run.categoryIds) return
      setSwapping(true)
      try {
        const judge = await judgeFor(lineup.dealt)
        dispatch({ type: 'swapped', judge, categoryIds: lineup.dealt, reserve: lineup.reserve })
        if (lineup.reserve[0]) loadPack(lineup.reserve[0]).catch(() => undefined)
      } catch {
        /* the dictionary did not come: the run keeps the category it had */
      } finally {
        setSwapping(false)
      }
    },
    [session.run, session.reserve, swapping, judgeFor],
  )

  const choose = useCallback((categoryId: string) => dispatch({ type: 'choose', categoryId }), [])

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
    pushing.current = pushRun(session.run, session.profile)
    flushSubmissions()
    fetchLeaderboard().then(setLeaderboard)
    // The run is pushed once, when the clock stops: the profile that follows it
    // in the same render is the one the score was just added to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase])

  return (
    <main className={`stage stage--${session.phase}`}>
      {editingAvatar && (
        <AvatarScreen
          profile={session.profile}
          avatar={avatar}
          onSave={(next) => {
            wear(next)
            pushAvatar(next)
            setEditingAvatar(false)
          }}
          onBack={() => setEditingAvatar(false)}
        />
      )}

      {!editingAvatar && (session.phase === 'home' || session.phase === 'loading') && (
        <HomeScreen
          profile={session.profile}
          error={session.error}
          loading={session.phase === 'loading'}
          leaderboard={leaderboard}
          avatar={avatar}
          account={account}
          accountActions={accountActions}
          onAvatar={() => setEditingAvatar(true)}
          onLogOut={async () => {
            await logOut()
            clearLocalData()
            dispatch({ type: 'profile-loaded', profile: NEW_PROFILE })
            setAvatar(DEFAULT_AVATAR)
            setAccount(null)
            fetchAccount().then((found) => found && setAccount(found))
            fetchLeaderboard().then(setLeaderboard)
          }}
          onPlay={play}
          onChoose={choose}
          onErase={async () => {
            // The device keeps its copy until the server has let go of its
            // own: a failed erase must not leave the player half-deleted.
            if (!(await deleteAccount())) return false
            clearLocalData()
            dispatch({ type: 'profile-loaded', profile: NEW_PROFILE })
            setAvatar(DEFAULT_AVATAR)
            setAccount(null)
            fetchAccount().then((found) => found && setAccount(found))
            fetchLeaderboard().then(setLeaderboard)
            return true
          }}
        />
      )}

      {session.phase === 'countdown' && session.run && (
        <CountdownScreen
          key={session.run.seed}
          categoryIds={session.run.categoryIds}
          reserve={session.reserve.length}
          swapping={swapping}
          onSwap={swap}
          onDone={() => {
            setStartedAt(Date.now())
            dispatch({ type: 'start' })
          }}
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

      {!editingAvatar && session.phase === 'over' && session.run && (
        <OverScreen
          run={session.run}
          profile={session.profile}
          profileBefore={session.profileBefore}
          revealed={revealed === session.run.seed}
          onRevealed={() => setRevealed(session.run?.seed ?? null)}
          avatar={avatar}
          account={account}
          accountActions={accountActions}
          onAvatar={() => setEditingAvatar(true)}
          onChoose={choose}
          onReplay={play}
          onHome={() => dispatch({ type: 'home' })}
        />
      )}

    </main>
  )
}
