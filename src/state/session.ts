import { applyRun, levelFor, type Profile } from '../domain/progression'
import { normalizeWord } from '../domain/text'
import {
  createRun,
  inspect,
  skip as skipPrompt,
  submit,
  type Judge,
  type Run,
  type Verdict,
} from '../domain/run'

/** `countdown` holds a dealt run whose clock has not started: categories announced, then 3, 2, 1. */
export type Phase = 'home' | 'loading' | 'countdown' | 'playing' | 'over'

export interface Session {
  phase: Phase
  profile: Profile
  judge: Judge | null
  run: Run | null
  /** What is in the field right now, judged on every keystroke. */
  draft: string
  live: Verdict | null
  /**
   * The word that just scored, kept a beat so the interface can celebrate it.
   * Its points and rarity are only ever shown here, once validated: while the
   * player types, the field says whether the word counts, never what it pays.
   */
  cheer: Cheer | null
  /** Words proposed during this run, normalized — the field acknowledges them inline. */
  proposed: readonly string[]
  /** The level held when the run started, so the end screen can announce what it opened. */
  levelBefore: number
  error: string | null
}

export interface Cheer {
  display: string
  points: number
  tier: string
  approximate: boolean
}

export type SessionAction =
  | { type: 'profile-loaded'; profile: Profile }
  | { type: 'play' }
  | { type: 'ready'; judge: Judge; seed: number; categoryIds: readonly string[] }
  | { type: 'start' }
  | { type: 'load-failed'; message: string }
  | { type: 'type'; draft: string }
  | { type: 'submit' }
  | { type: 'skip' }
  | { type: 'time-up' }
  | { type: 'propose'; word: string }
  | { type: 'home' }

export function initialSession(profile: Profile): Session {
  return {
    phase: 'home',
    profile,
    judge: null,
    run: null,
    draft: '',
    live: null,
    cheer: null,
    proposed: [],
    levelBefore: levelFor(profile.xp),
    error: null,
  }
}

export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'profile-loaded':
      return { ...session, profile: action.profile }

    case 'play':
      return { ...session, phase: 'loading', error: null }

    case 'ready': {
      return {
        ...session,
        phase: 'countdown',
        judge: action.judge,
        run: createRun({ seed: action.seed, categoryIds: action.categoryIds }, action.judge),
        levelBefore: levelFor(session.profile.xp),
        draft: '',
        live: null,
        cheer: null,
        proposed: [],
      }
    }

    case 'start':
      return session.phase === 'countdown' ? { ...session, phase: 'playing' } : session

    case 'load-failed':
      return { ...session, phase: 'home', error: action.message }

    case 'type': {
      if (!session.run || !session.judge) return session
      return {
        ...session,
        draft: action.draft,
        live: inspect(session.run, action.draft, session.judge),
      }
    }

    case 'submit': {
      if (!session.run || !session.judge) return session
      const played = submit(session.run, session.draft, session.judge)
      if (played.verdict.kind !== 'accepted' || !played.verdict.found) return session

      const found = played.verdict.found
      return {
        ...session,
        run: played.run,
        draft: '',
        live: null,
        cheer: { display: found.display, points: found.points, tier: found.tier, approximate: found.approximate },
      }
    }

    case 'skip': {
      if (!session.run || !session.judge) return session
      return { ...session, run: skipPrompt(session.run, session.judge), draft: '', live: null, cheer: null }
    }

    case 'time-up': {
      if (!session.run) return session
      return {
        ...session,
        phase: 'over',
        profile: applyRun(session.profile, {
          score: session.run.score,
          words: session.run.found.map((found) => found.word),
          bestCombo: session.run.bestCombo,
        }),
      }
    }

    case 'propose': {
      const word = normalizeWord(action.word)
      if (word === '' || session.proposed.includes(word)) return session
      return { ...session, proposed: [...session.proposed, word] }
    }

    case 'home':
      return { ...session, phase: 'home', run: null, draft: '', live: null, cheer: null, proposed: [] }
  }
}
