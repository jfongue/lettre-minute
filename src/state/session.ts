import { unlockedCategories } from '../domain/catalogue'
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

export type Phase = 'home' | 'loading' | 'playing' | 'over'

export interface Session {
  phase: Phase
  profile: Profile
  judge: Judge | null
  run: Run | null
  /** What is in the field right now, judged on every keystroke. */
  draft: string
  live: Verdict | null
  /** The word that just scored, kept a beat so the interface can celebrate it. */
  cheer: { display: string; points: number; tier: string } | null
  /** Words proposed during this run, normalized — the field acknowledges them inline. */
  proposed: readonly string[]
  /** The level held when the run started, so the end screen can announce what it opened. */
  levelBefore: number
  error: string | null
}

export type SessionAction =
  | { type: 'profile-loaded'; profile: Profile }
  | { type: 'play' }
  | { type: 'ready'; judge: Judge; seed: number }
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
      const categoryIds = unlockedCategories(levelFor(session.profile.xp)).map((category) => category.id)
      return {
        ...session,
        phase: 'playing',
        judge: action.judge,
        run: createRun({ seed: action.seed, categoryIds }, action.judge),
        levelBefore: levelFor(session.profile.xp),
        draft: '',
        live: null,
        cheer: null,
        proposed: [],
      }
    }

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
        cheer: { display: found.display, points: found.points, tier: found.tier },
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
