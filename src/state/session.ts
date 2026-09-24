import { applyRun, levelFor, type Profile } from '../domain/progression'
import type { RarityTier } from '../domain/rarity'
import { normalizeWord } from '../domain/text'
import { chooseCategory, dealOffer } from '../domain/unlocks'
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
  /** Owned categories the run left out: tapping a dealt one during the countdown swaps it for the first of these. */
  reserve: readonly string[]
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
  /** The profile as it stood before the run — what the end screen compares to announce new avatars and colours. */
  profileBefore: Profile
  error: string | null
}

export interface Cheer {
  display: string
  points: number
  tier: RarityTier
  approximate: boolean
}

export type SessionAction =
  | { type: 'profile-loaded'; profile: Profile }
  | { type: 'play' }
  | { type: 'ready'; judge: Judge; seed: number; categoryIds: readonly string[]; reserve: readonly string[] }
  /** The countdown traded a category: same seed, new lineup, a judge that knows the incoming dictionary. */
  | { type: 'swapped'; judge: Judge; categoryIds: readonly string[]; reserve: readonly string[] }
  | { type: 'offer'; availableIds: readonly string[]; seed: number }
  | { type: 'choose'; categoryId: string }
  | { type: 'start' }
  | { type: 'load-failed'; message: string }
  | { type: 'type'; draft: string }
  /** `at`: the run clock in seconds, which the rules do not keep themselves. */
  | { type: 'submit'; at: number }
  | { type: 'skip'; at: number }
  | { type: 'time-up'; at: number }
  | { type: 'propose'; word: string }
  | { type: 'home' }

export function initialSession(profile: Profile): Session {
  return {
    phase: 'home',
    profile,
    judge: null,
    run: null,
    reserve: [],
    draft: '',
    live: null,
    cheer: null,
    proposed: [],
    levelBefore: levelFor(profile.xp),
    profileBefore: profile,
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
        run: createRun(
          { seed: action.seed, categoryIds: action.categoryIds, avoid: session.profile.lastPrompts },
          action.judge,
        ),
        reserve: action.reserve,
        levelBefore: levelFor(session.profile.xp),
        profileBefore: session.profile,
        draft: '',
        live: null,
        cheer: null,
        proposed: [],
      }
    }

    case 'swapped': {
      if (session.phase !== 'countdown' || !session.run) return session
      return {
        ...session,
        judge: action.judge,
        run: createRun({ seed: session.run.seed, categoryIds: action.categoryIds, avoid: session.run.avoid }, action.judge),
        reserve: action.reserve,
      }
    }

    case 'offer': {
      const profile = dealOffer(session.profile, action.availableIds, action.seed)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'choose': {
      const profile = chooseCategory(session.profile, action.categoryId)
      return profile === session.profile ? session : { ...session, profile }
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
      const played = submit(session.run, session.draft, session.judge, action.at)
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
      return { ...session, run: skipPrompt(session.run, session.judge, action.at), draft: '', live: null, cheer: null }
    }

    case 'time-up': {
      if (!session.run) return session
      // A correct word still in the field when the clock runs out counts: the
      // player wrote it in time, only the tap on "valider" came too late.
      const run = session.judge ? submit(session.run, session.draft, session.judge, action.at).run : session.run
      return {
        ...session,
        phase: 'over',
        run,
        draft: '',
        live: null,
        profile: applyRun(session.profile, {
          score: run.score,
          words: run.found.map((found) => found.word),
          bestCombo: run.bestCombo,
          prompts: run.dealt,
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
