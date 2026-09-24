import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { availableCategoryIds, loadPack, loadPacks } from './data/packs'
import {
  deleteAccount,
  fetchAccount,
  fetchCommunityWords,
  fetchCrowdUsage,
  fetchBoards,
  logIn,
  logOut,
  pushAvatar,
  pushRun,
  pushSubmissions,
  register,
  type Account,
  type CommunityWord,
} from './lib/cloud'
import { isNativeApp, onBackButton, prepareAds, tapFeedback } from './lib/native'
import { configureSound, setMusic, setPulseStage, sound, tierSound, type SoundPrefs } from './lib/sound'
import { DEFAULT_AVATAR, type AvatarChoice } from './domain/avatar'
import { appendRecord, recordOf, type RunRecord } from './domain/history'
import { completeBoards, type Boards } from './domain/boards'
import { NEW_PROFILE, type Profile } from './domain/progression'
import { RUN_SECONDS, remainingSeconds } from './domain/run'
import { adsDue, dealLineup, ownedCategoryIds, swapCategory } from './domain/unlocks'
import { LETTER_DECKS, PLAYABLE_LETTERS } from './domain/letters'
import { withExtraWords } from './domain/words'
import { MessagesContext, messagesFor, type Locale } from './i18n'
import { createJudge } from './state/judge'
import { applyLocale, loadLocale, saveLocale } from './state/locale'
import { initialSession, sessionReducer } from './state/session'
import {
  clearLocalData,
  loadAvatar,
  loadHistory,
  loadProfile,
  loadSubmissions,
  saveAvatar,
  saveHistory,
  saveProfile,
  saveSubmissions,
} from './state/storage'
import { loadSoundPrefs, saveSoundPrefs } from './state/sound'
import { applyTheme, loadTheme, saveTheme, type Theme } from './state/theme'
import { useElapsed } from './state/useElapsed'
import type { AccountActions } from './ui/AccountPanel'
import { AvatarScreen } from './ui/AvatarScreen'
import { CountdownScreen } from './ui/CountdownScreen'
import { HomeScreen } from './ui/HomeScreen'
import { LanguagePicker } from './ui/LanguagePicker'
import { Menu, type MenuPage } from './ui/Menu'
import { MuteButton } from './ui/MuteButton'
import { OverScreen } from './ui/OverScreen'
import { RunScreen } from './ui/RunScreen'

/** The boards as the home screen shows them: without a server, none at all. */
async function loadBoards(): Promise<Boards | null> {
  const boards = await fetchBoards()
  return boards && completeBoards(boards)
}

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
  const [boards, setBoards] = useState<Boards | null>(null)
  // The boards as they stood when the run started, and once it reached the
  // server: the end screen animates the player's move from one to the other.
  const [boardsBefore, setBoardsBefore] = useState<Boards | null>(null)
  const [boardsAfter, setBoardsAfter] = useState<Boards | null>(null)
  const boardsNow = useRef(boards)
  boardsNow.current = boards
  // Where the drawer opened, or null while it is closed.
  const [menuPage, setMenuPage] = useState<MenuPage | null>(null)
  const menuOpen = menuPage !== null
  const closeMenu = useCallback(() => setMenuPage(null), [])
  const [history, setHistory] = useState<RunRecord[]>([])
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [soundPrefs, setSoundPrefs] = useState<SoundPrefs>(loadSoundPrefs)
  const tune = useCallback((next: SoundPrefs) => {
    setSoundPrefs(next)
    saveSoundPrefs(next)
  }, [])
  useEffect(() => configureSound(soundPrefs), [soundPrefs])
  // Null only when the device speaks none of the game's languages and the
  // player has not picked one yet: the picker then comes before anything else.
  const [locale, setLocale] = useState<Locale | null>(loadLocale)
  const t = messagesFor(locale ?? 'fr')
  // The dictionary follows the interface: a German player answers in German.
  const lang = locale ?? 'fr'
  const speak = useCallback((next: Locale) => {
    setLocale(next)
    saveLocale(next)
  }, [])
  useEffect(() => {
    if (locale) applyLocale(locale)
  }, [locale])
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
    setHistory(loadHistory())
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
    fetchCrowdUsage(lang).then((usage) => setCrowd(usage.shares))
    fetchCommunityWords(lang).then((words) => {
      community.current = words
    })
  }, [lang])

  useEffect(() => {
    loadBoards().then(setBoards)
    fetchAccount().then((found) => found && adopt(found))
    flushSubmissions()
  }, [adopt])

  const accountActions: AccountActions = {
    async onRegister(name, email, password) {
      await pushing.current
      const outcome = await register(name, email, password)
      if (!outcome.ok) return t.account.errors[outcome.error]
      setAccount(outcome.account)
      pushAvatar(avatar)
      loadBoards().then(setBoards)
      // With email confirmation on, the account stays anonymous until the link is followed.
      return outcome.account.anonymous ? t.account.confirmationSent(email.trim()) : null
    },
    async onLogIn(email, password) {
      await pushing.current
      const outcome = await logIn(email, password)
      if (!outcome.ok) return t.account.errors[outcome.error]
      adopt(outcome.account)
      // The merge summed both players on the server: its totals are the truth now.
      dispatch({ type: 'profile-loaded', profile: { ...profile.current, ...outcome.account.stats } })
      if (!outcome.account.avatar) pushAvatar(avatar)
      loadBoards().then(setBoards)
      return null
    },
  }

  /** Starts the device over as a new anonymous player, after a sign-out or an erase. */
  const forget = () => {
    clearLocalData()
    dispatch({ type: 'profile-loaded', profile: NEW_PROFILE })
    setAvatar(DEFAULT_AVATAR)
    setHistory([])
    setAccount(null)
    fetchAccount().then((found) => found && setAccount(found))
    loadBoards().then(setBoards)
  }

  // Android's back gesture leaves a run for the home screen, and closes the app
  // from there. A ref keeps one listener for the whole session.
  const phase = useRef(session.phase)
  phase.current = session.phase
  const menuShown = useRef(menuOpen)
  menuShown.current = menuOpen
  useEffect(
    () =>
      onBackButton(() => {
        if (menuShown.current) {
          setMenuPage(null)
          return true
        }
        if (phase.current === 'home' || phase.current === 'loading') return false
        dispatch({ type: 'home' })
        return true
      }),
    [],
  )

  useEffect(() => {
    if (!session.cheer) return
    tapFeedback()
    // The combo counts this prompt's finds, this one included: the note climbs with it.
    sound.found(tierSound(session.cheer.tier, session.cheer.approximate), Math.max(0, (session.run?.combo ?? 1) - 1))
    // Only a new cheer sings; the run it came with is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.cheer])

  // The music keeps to the screens around the run; the run itself has its pulse, if wanted.
  useEffect(() => {
    const around = session.phase === 'home' || session.phase === 'loading' || session.phase === 'over'
    setMusic(around ? 'menu' : session.phase === 'playing' ? 'pulse' : null)
    if (session.phase === 'over') sound.timeUp()
  }, [session.phase])

  // Every tap on the screens around the run clicks, like the phone's own keys.
  const quietTaps = session.phase === 'countdown' || session.phase === 'playing'
  useEffect(() => {
    if (quietTaps) return
    const click = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('button, a')) sound.click()
    }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [quietTaps])

  const elapsed = useElapsed(session.phase === 'playing' ? startedAt : null)
  const remaining = session.run ? remainingSeconds(session.run, elapsed) : 0
  const pulseStage = Math.min(2, Math.floor(((RUN_SECONDS - remaining) / RUN_SECONDS) * 3))
  useEffect(() => setPulseStage(pulseStage), [pulseStage])

  useEffect(() => {
    if (session.phase === 'playing' && remaining <= 0) dispatch({ type: 'time-up', at: elapsed })
  }, [session.phase, remaining, elapsed])

  // A pick owed and no offer on the table — after a level up, or on a device
  // that has never seen this player's picks — deals three categories to choose from.
  useEffect(() => {
    dispatch({ type: 'offer', availableIds: availableCategoryIds(lang), seed: Date.now() >>> 0 })
  }, [session.profile, lang])

  // Loading an ad takes seconds, consent included: started once the free pick
  // is spent, it is ready by the next offer. Never mid-run, where the consent
  // form would cover the clock.
  const adsWanted = adsDue(session.profile) && (session.phase === 'home' || session.phase === 'over')
  useEffect(() => {
    if (adsWanted) prepareAds()
  }, [adsWanted])

  const judgeFor = useCallback(
    async (categoryIds: readonly string[]) => {
      const packs = (await loadPacks(lang, categoryIds)).map((pack) =>
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
      return createJudge(packs, { own: session.profile.usage, crowd }, LETTER_DECKS[lang] ?? PLAYABLE_LETTERS)
    },
    [session.profile.usage, crowd, lang],
  )

  const play = useCallback(async () => {
    dispatch({ type: 'play' })
    setBoardsBefore(boardsNow.current)
    setBoardsAfter(null)
    try {
      // A category of the catalogue whose dictionary has not been imported yet
      // is simply not dealt, rather than failing the whole run.
      const shipped = new Set(availableCategoryIds(lang))
      const seed = Date.now() >>> 0
      const lineup = dealLineup(
        seed,
        ownedCategoryIds(session.profile).filter((id) => shipped.has(id)),
      )
      const judge = await judgeFor(lineup.dealt)
      dispatch({ type: 'ready', judge, seed, categoryIds: lineup.dealt, reserve: lineup.reserve })
      // Warmed while the categories are announced, so the first swap is instant.
      if (lineup.reserve[0]) loadPack(lang, lineup.reserve[0]).catch(() => undefined)
    } catch {
      dispatch({ type: 'load-failed', message: t.loadFailed })
    }
  }, [session.profile, judgeFor, t, lang])

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
        if (lineup.reserve[0]) loadPack(lang, lineup.reserve[0]).catch(() => undefined)
      } catch {
        /* the dictionary did not come: the run keeps the category it had */
      } finally {
        setSwapping(false)
      }
    },
    [session.run, session.reserve, swapping, judgeFor, lang],
  )

  const choose = useCallback((categoryId: string) => dispatch({ type: 'choose', categoryId }), [])

  // Proposing costs no clock: in a timed run, a confirmation dialog would take
  // the seconds the player is spending on the word they just failed to place.
  const propose = useCallback(
    (word: string) => {
      if (!session.run) return
      saveSubmissions([
        ...loadSubmissions(),
        { word: word.trim(), categoryId: session.run.prompt.categoryId, at: Date.now(), lang },
      ])
      dispatch({ type: 'propose', word })
    },
    [session.run, lang],
  )

  useEffect(() => {
    if (session.phase !== 'over' || !session.run) return
    const record = recordOf(session.run, Date.now(), lang)
    setHistory((previous) => {
      const next = appendRecord(previous, record)
      saveHistory(next)
      return next
    })
    const pushed = pushRun(session.run, session.profile, lang)
    pushing.current = pushed
    flushSubmissions()
    // Read after the run is in, or the boards would not count it yet.
    pushed
      .then(loadBoards)
      .then((next) => {
        setBoards(next)
        setBoardsAfter(next)
      })
    // The run is pushed once, when the clock stops: the profile that follows it
    // in the same render is the one the score was just added to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase])

  if (locale === null) {
    return (
      <main className="stage stage--home">
        <LanguagePicker onPick={speak} />
      </main>
    )
  }

  return (
    <MessagesContext value={t}>
    <main className={`stage stage--${session.phase}${isNativeApp() ? '' : ' stage--muteable'}`}>
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
          boards={boards}
          me={account && !account.anonymous ? account.name : null}
          avatar={avatar}
          onMenu={(page = 'profile') => setMenuPage(page)}
          onPlay={play}
          onChoose={choose}
        />
      )}

      {menuOpen && !editingAvatar && (session.phase === 'home' || session.phase === 'loading') && (
        <Menu
          page={menuPage}
          profile={session.profile}
          history={history}
          avatar={avatar}
          account={account}
          accountActions={accountActions}
          theme={theme}
          locale={locale}
          onLocale={speak}
          sound={soundPrefs}
          onSound={tune}
          onTheme={(next) => {
            setTheme(next)
            saveTheme(next)
            applyTheme(next)
          }}
          onAvatar={() => {
            setMenuPage(null)
            setEditingAvatar(true)
          }}
          onLogOut={async () => {
            await logOut()
            forget()
          }}
          onErase={async () => {
            // The device keeps its copy until the server has let go of its
            // own: a failed erase must not leave the player half-deleted.
            if (!(await deleteAccount())) return false
            forget()
            return true
          }}
          onClose={closeMenu}
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
          onSubmit={() => dispatch({ type: 'submit', at: elapsed })}
          onSkip={() => dispatch({ type: 'skip', at: elapsed })}
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
          lang={lang}
          avatar={avatar}
          account={account}
          accountActions={accountActions}
          onAvatar={() => setEditingAvatar(true)}
          onChoose={choose}
          boardsBefore={boardsBefore}
          boardsAfter={boardsAfter}
          me={account && !account.anonymous ? account.name : null}
          onReplay={play}
          onHome={() => dispatch({ type: 'home' })}
        />
      )}

      {!isNativeApp() && <MuteButton muted={soundPrefs.muted} onToggle={() => tune({ ...soundPrefs, muted: !soundPrefs.muted })} />}
    </main>
    </MessagesContext>
  )
}
