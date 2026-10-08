// The fonts ship with the bundle: Reddit's webview may not reach Google Fonts.
import '@fontsource-variable/jost/index.css'
import '../../../src/styles.css'
import './game.css'

import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { challengeWordsOf } from '../../../src/domain/challenge'
import { createRun, inspect, remainingSeconds, skip, submit, type Judge, type Run, type Verdict } from '../../../src/domain/run'
import { loadPacks } from '../../../src/data/packs'
import { loadMessages, MessagesContext, useT } from '../../../src/i18n'
import { armSound, configureSound, setMusic, sound, tierSound } from '../../../src/lib/sound'
import { createJudge } from '../../../src/state/judge'
import { loadSoundPrefs, saveSoundPrefs } from '../../../src/state/sound'
import type { Cheer } from '../../../src/state/session'
import { useElapsed } from '../../../src/state/useElapsed'
import { CountdownScreen } from '../../../src/ui/CountdownScreen'
import { FeaturesContext } from '../../../src/ui/features'
import { MuteButton } from '../../../src/ui/MuteButton'
import { RunScreen } from '../../../src/ui/RunScreen'
import { ALL_FEATURES } from '../../../src/domain/features'
import { hostFeatures } from '../../../src/platform'
import { dailySeed } from '../../../src/domain/daily'
import type { DailyPostData, DailyResult, DayResponse, PlayResponse, Standing } from '../shared/api'
import { fetchDay, postPlay } from './api'
import { DailyOver } from './DailyOver'
import { postData, postLocale } from './post'
import { useMessages } from './useMessages'

/**
 * The daily game, expanded: the real run screen of the app, dealt from the
 * day's seed with a judge that knows no usage — every reader is paid the same
 * for the same word. No powers, no proposals: the post is one game for all.
 */

// What `redditHost` closes (src/platform/reddit.ts) — dictionary proposals,
// powers, every server feature — stays closed on the post.
const FEATURES = hostFeatures(ALL_FEATURES)
const NO_PROPOSALS: readonly string[] = []
const NOTHING = () => undefined

type Play = {
  run: Run
  draft: string
  live: Verdict | null
  cheer: Cheer | null
}

type PlayAction =
  | { type: 'type'; draft: string; judge: Judge }
  | { type: 'submit'; at: number; auto: boolean; judge: Judge }
  | { type: 'skip'; at: number; judge: Judge }
  | { type: 'time-up'; at: number; judge: Judge }

function playReducer(play: Play, action: PlayAction): Play {
  switch (action.type) {
    case 'type':
      return { ...play, draft: action.draft, live: inspect(play.run, action.draft, action.judge) }
    case 'submit': {
      const played = submit(play.run, play.draft, action.judge, action.at)
      const found = played.verdict.kind === 'accepted' ? played.verdict.found : null
      if (!found) return play
      return {
        run: played.run,
        draft: '',
        live: null,
        cheer: { ...found, auto: action.auto },
      }
    }
    case 'skip':
      return { ...play, run: skip(play.run, action.judge, action.at), draft: '', live: null, cheer: null }
    case 'time-up':
      // A right word still in the field when the clock falls counts, as in the app.
      return { ...play, run: submit(play.run, play.draft, action.judge, action.at).run, draft: '', live: null }
  }
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'countdown' }
  | { kind: 'playing'; startedAt: number }
  /** `run` is the game just played, which the reveal replays; null for a result read back from the server. */
  | { kind: 'over'; run: Run | null; result: DailyResult; standing: Standing | null; counted: boolean; sent: boolean }

function deal(data: DailyPostData, judge: Judge): Play {
  const run = createRun({ seed: dailySeed(data.day, data.lang), categoryIds: data.categories, shared: true }, judge)
  return { run, draft: '', live: null, cheer: null }
}

function resultOf(run: Run): DailyResult {
  return { score: run.score, words: challengeWordsOf(run), skips: run.skips, bestCombo: run.bestCombo }
}

function Game({ data }: { data: DailyPostData }) {
  const t = useT()
  const [stage, setStage] = useState<Stage>({ kind: 'loading' })
  const [judge, setJudge] = useState<Judge | null>(null)
  const [day, setDay] = useState<DayResponse | null>(null)
  const [board, setBoard] = useState<Pick<PlayResponse, 'top' | 'players'> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<Play | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let live = true
    Promise.all([loadPacks(data.lang, data.categories), fetchDay().catch(() => null)])
      .then(([packs, today]) => {
        if (!live) return
        // No usage at all: what a word pays follows the dictionary alone, the same for every reader.
        const fair = createJudge(packs, { own: {}, crowd: {} })
        setJudge(fair)
        setState(deal(data, fair))
        setDay(today)
        if (today) setBoard({ top: today.top, players: today.players })
        const played = today?.played
        setStage(
          played
            ? { kind: 'over', run: null, result: played, standing: played, counted: true, sent: true }
            : { kind: 'countdown' },
        )
      })
      .catch(() => live && setStage({ kind: 'failed' }))
    return () => {
      live = false
    }
  }, [data, attempt])

  const startedAt = stage.kind === 'playing' ? stage.startedAt : null
  const elapsed = useElapsed(startedAt)
  const remaining = state ? remainingSeconds(state.run, elapsed) : 0

  const act = (action: PlayAction) => setState((previous) => (previous ? playReducer(previous, action) : previous))

  // The word's chime follows the cheer, as in the app (`App.tsx`).
  useEffect(() => {
    if (state?.cheer) sound.found(tierSound(state.cheer.tier, state.cheer.approximate), Math.max(0, state.run.combo - 1))
  }, [state?.cheer, state?.run.combo])

  useEffect(() => {
    if (stage.kind !== 'playing' || !state || !judge || remaining > 0) return
    const final = playReducer(state, { type: 'time-up', at: elapsed, judge }).run
    const result = resultOf(final)
    sound.timeUp()
    // The clock decides, as in the app (`time-up`, src/state/session.ts): the run ends here.
    setStage({ kind: 'over', run: final, result, standing: null, counted: false, sent: false })
    postPlay(result)
      .then((answer) => {
        setBoard({ top: answer.top, players: answer.players })
        setStage({ kind: 'over', run: final, result, standing: answer.standing, counted: answer.counted, sent: true })
      })
      .catch(() => setStage({ kind: 'over', run: final, result, standing: null, counted: false, sent: true }))
  }, [stage.kind, state, judge, remaining, elapsed])

  useEffect(() => setMusic(stage.kind === 'playing' ? 'pulse' : null), [stage.kind])

  if (stage.kind === 'loading') {
    return <p className="daily-wait">{t.daily.loading}</p>
  }
  if (stage.kind === 'failed') {
    return (
      <div className="daily-wait">
        <p>{t.daily.loadFailed}</p>
        <button
          type="button"
          className="btn btn--blue"
          onClick={() => {
            setStage({ kind: 'loading' })
            setAttempt((count) => count + 1)
          }}
        >
          {t.daily.retry}
        </button>
      </div>
    )
  }
  if (stage.kind === 'countdown' && state) {
    return (
      <CountdownScreen
        key={round}
        categoryIds={state.run.categoryIds}
        reserve={0}
        swaps={0}
        swapping={false}
        mode="solo"
        onSwap={NOTHING}
        onDone={() => setStage({ kind: 'playing', startedAt: Date.now() })}
      />
    )
  }
  if (stage.kind === 'playing' && state && judge) {
    return (
      <RunScreen
        run={state.run}
        draft={state.draft}
        live={state.live}
        cheer={state.cheer}
        remaining={remaining}
        hushed={false}
        next={null}
        proposed={NO_PROPOSALS}
        onType={(draft) => act({ type: 'type', draft, judge })}
        onSubmit={(auto) => act({ type: 'submit', at: elapsed, auto: auto === true, judge })}
        onSkip={() => act({ type: 'skip', at: elapsed, judge })}
        onReroll={NOTHING}
        onRecall={NOTHING}
        onPropose={NOTHING}
      />
    )
  }
  if (stage.kind === 'over') {
    return (
      <DailyOver
        key={round}
        data={data}
        run={stage.run}
        result={stage.result}
        standing={stage.standing}
        counted={stage.counted}
        sent={stage.sent}
        username={day?.username ?? null}
        board={board}
        onAgain={() => {
          // The practice game is the day's game again: same seed, same prompts.
          if (judge) setState(deal(data, judge))
          setRound((count) => count + 1)
          setStage({ kind: 'countdown' })
        }}
      />
    )
  }
  return null
}

function Root() {
  // Read once: a fresh object on each render would reload the game under the reader.
  const [data] = useState(postData)
  const messages = useMessages(postLocale(data))
  const [prefs, setPrefs] = useState(loadSoundPrefs)
  useEffect(() => {
    configureSound(prefs)
    saveSoundPrefs(prefs)
  }, [prefs])
  return (
    <MessagesContext.Provider value={messages}>
      <FeaturesContext.Provider value={FEATURES}>
        <main className="stage stage--playing stage--muteable daily">
          {data ? <Game data={data} /> : <p className="daily-wait">{messages.daily.loadFailed}</p>}
          <MuteButton muted={prefs.muted} onToggle={() => setPrefs((current) => ({ ...current, muted: !current.muted }))} />
        </main>
      </FeaturesContext.Provider>
    </MessagesContext.Provider>
  )
}

const locale = postLocale(postData())
document.documentElement.lang = locale
void loadMessages(locale)
  .catch(() => undefined)
  .then(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Root />
      </StrictMode>,
    ),
  )

armSound()
