import { applyChallengeRun } from '../domain/challenge'
import { applyRun, levelFor, type Profile } from '../domain/progression'
import type { RarityTier } from '../domain/rarity'
import { capitalized, normalizeWord } from '../domain/text'
import { chooseCategory, dealOffer, ownedCategoryIds } from '../domain/unlocks'
import { markSupportAsked } from '../domain/support'
import { ban, joinPlus, markBanIntroSeen, markFeedbackAsked, markPlusThanked, spendPeek, unban } from '../domain/perks'
import { choosePower, dealPowerOffer, equippedPowers, equipPower, grantPower, POWER_CHARGES, type PowerId } from '../domain/powers'
import { countsForProgress, type GameMode } from '../domain/modes'
import {
  arm,
  createRun,
  inspect,
  recall,
  reroll,
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
  /** Swaps Permutation still allows during the countdown; 0 without the power. */
  swapsLeft: number
  /** The challenge this run is played for, or null for a solo run. */
  challengeId: string | null
  /** What is in the field right now, judged on every keystroke. */
  draft: string
  live: Verdict | null
  /**
   * The word that just scored, kept a beat so the interface can celebrate it.
   * Its points and rarity are only ever shown here, once validated: while the
   * player types, the field says whether the word counts, never what it pays.
   */
  cheer: Cheer | null
  /** The words proposed during this run — the field acknowledges them inline, the last screen hands them back. */
  proposals: readonly Proposal[]
  /** The level held when the run started, so the end screen can announce what it opened. */
  levelBefore: number
  /** The profile as it stood before the run — what the end screen compares to announce new avatars and colours. */
  profileBefore: Profile
  error: string | null
}

/**
 * A word proposed while the dictionary did not know it, as it was typed. The
 * same shape as the queue on the device (`PendingSubmission`): a proposal lives
 * there until the server takes it, and a correction rewrites whichever holds it.
 */
export interface Proposal {
  word: string
  categoryId: string
  at: number
  lang: string
}

export interface Cheer {
  display: string
  points: number
  tier: RarityTier
  approximate: boolean
  edits: number
  joker: boolean
  boost: number
  /** Validated by Célérité, without a tap. */
  auto: boolean
}

export type SessionAction =
  | { type: 'profile-loaded'; profile: Profile }
  | { type: 'play' }
  | {
      type: 'ready'
      judge: Judge
      seed: number
      categoryIds: readonly string[]
      reserve: readonly string[]
      /** A challenge brings its own lineup and the powers picked for it. */
      challenge?: { id: string; powers: readonly PowerId[] }
      /** Les pouvoirs sont fermés à ce joueur : la partie se joue sans, même portés. */
      noPowers?: boolean
      /**
       * La réserve : « solo » par défaut. Un mode de la réserve se joue sans
       * pouvoir et sans progression — son score ne vit qu'à l'écran.
       */
      mode?: GameMode
    }
  /** The countdown traded a category: same seed, new lineup, a judge that knows the incoming dictionary. */
  | { type: 'swapped'; judge: Judge; categoryIds: readonly string[]; reserve: readonly string[] }
  | { type: 'offer'; availableIds: readonly string[]; seed: number }
  | { type: 'choose'; categoryId: string }
  | { type: 'choose-power'; powerId: string }
  | { type: 'grant-power'; powerId: PowerId }
  | { type: 'equip'; slot: number; powerId: PowerId | null }
  | { type: 'start' }
  /** Le retard commence : la question à l'écran part sans réponse et le chrono démarre. */
  | { type: 'arm' }
  /** Le retard : revoir la question à remplir coûte des secondes. */
  | { type: 'recall' }
  | { type: 'load-failed'; message: string }
  | { type: 'type'; draft: string }
  /** `at`: the run clock in seconds, which the rules do not keep themselves. */
  | { type: 'submit'; at: number; auto?: boolean }
  /** Magie: the letter on screen is traded for another. */
  | { type: 'reroll'; at: number }
  | { type: 'skip'; at: number }
  | { type: 'time-up'; at: number }
  | { type: 'propose'; proposal: Proposal }
  /** The last screen respelled a request still waiting, or took it back. */
  | { type: 'proposal-amended'; at: number; display: string }
  | { type: 'proposal-withdrawn'; at: number }
  | { type: 'support-asked' }
  | { type: 'feedback-asked' }
  | { type: 'ban'; categoryId: string }
  | { type: 'unban'; categoryId: string }
  | { type: 'ban-intro-seen' }
  /** A hidden answer of the summary uncovered. */
  | { type: 'peek' }
  /** `at`: the wall clock, which the rules do not read themselves. */
  | { type: 'join-plus'; at: number }
  | { type: 'plus-thanked' }
  | { type: 'home' }

export function initialSession(profile: Profile): Session {
  return {
    phase: 'home',
    profile,
    judge: null,
    run: null,
    reserve: [],
    swapsLeft: 0,
    challengeId: null,
    draft: '',
    live: null,
    cheer: null,
    proposals: [],
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
      const { challenge } = action
      const mode = action.mode ?? 'solo'
      // Un mode de la réserve ne se joue pas avec un pouvoir.
      const powers = action.noPowers || !countsForProgress(mode) ? [] : challenge ? challenge.powers : equippedPowers(session.profile)
      // A challenge avoids nothing: every player's draw must follow the seed alone.
      const avoid = challenge ? [] : session.profile.lastPrompts
      return {
        ...session,
        phase: 'countdown',
        judge: action.judge,
        run: createRun({ seed: action.seed, mode, categoryIds: action.categoryIds, avoid, powers, shared: Boolean(challenge) }, action.judge),
        reserve: challenge || !countsForProgress(mode) ? [] : action.reserve,
        swapsLeft: !challenge && powers.includes('permutation') ? (POWER_CHARGES.permutation ?? 0) : 0,
        challengeId: challenge?.id ?? null,
        levelBefore: levelFor(session.profile.xp),
        profileBefore: session.profile,
        draft: '',
        live: null,
        cheer: null,
        proposals: [],
      }
    }

    case 'swapped': {
      if (session.phase !== 'countdown' || !session.run || session.swapsLeft <= 0) return session
      const { seed, avoid, powers } = session.run
      return {
        ...session,
        judge: action.judge,
        run: createRun({ seed, categoryIds: action.categoryIds, avoid, powers }, action.judge),
        reserve: action.reserve,
        swapsLeft: session.swapsLeft - 1,
      }
    }

    case 'offer': {
      const profile = dealPowerOffer(dealOffer(session.profile, action.availableIds, action.seed), action.seed)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'choose': {
      const profile = chooseCategory(session.profile, action.categoryId)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'choose-power': {
      const profile = choosePower(session.profile, action.powerId)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'grant-power': {
      const profile = grantPower(session.profile, action.powerId)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'feedback-asked':
      return withProfile(session, markFeedbackAsked(session.profile))
    case 'ban':
      return withProfile(session, ban(session.profile, ownedCategoryIds(session.profile), action.categoryId))
    case 'unban':
      return withProfile(session, unban(session.profile, action.categoryId))
    case 'ban-intro-seen':
      return withProfile(session, markBanIntroSeen(session.profile))
    case 'peek':
      return withProfile(session, spendPeek(session.profile))
    case 'join-plus':
      return withProfile(session, joinPlus(session.profile, action.at))
    case 'plus-thanked':
      return withProfile(session, markPlusThanked(session.profile))

    case 'support-asked': {
      const profile = markSupportAsked(session.profile)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'equip': {
      const profile = equipPower(session.profile, action.slot, action.powerId)
      return profile === session.profile ? session : { ...session, profile }
    }

    case 'start':
      return session.phase === 'countdown' ? { ...session, phase: 'playing' } : session

    case 'arm': {
      if (!session.run || !session.judge) return session
      // Le champ est passé au domaine : du texte dedans ne lance pas le chrono.
      const run = arm(session.run, session.judge, session.draft)
      return run === session.run ? session : { ...session, run, draft: '', live: null, cheer: null }
    }

    case 'recall': {
      if (!session.run) return session
      const run = recall(session.run)
      return run === session.run ? session : { ...session, run }
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
      const played = submit(session.run, session.draft, session.judge, action.at)
      if (played.verdict.kind === 'spell') {
        if (played.run === session.run) return session
        // The Joker's word lands in the field, judged like any other draft.
        const draft = played.verdict.spell === 'joker' ? capitalized(played.run.joker?.display ?? '') : ''
        return { ...session, run: played.run, draft, live: draft ? inspect(played.run, draft, session.judge) : null, cheer: null }
      }
      if (played.verdict.kind !== 'accepted' || !played.verdict.found) return session

      const found = played.verdict.found
      return {
        ...session,
        run: played.run,
        draft: '',
        live: null,
        cheer: {
          display: found.display,
          points: found.points,
          tier: found.tier,
          approximate: found.approximate,
          edits: found.edits,
          joker: found.joker,
          boost: found.boost,
          auto: action.auto === true,
        },
      }
    }

    case 'reroll': {
      if (session.phase !== 'playing' || !session.run || !session.judge) return session
      const run = reroll(session.run, session.judge, action.at)
      return run === session.run ? session : { ...session, run, draft: '', live: null, cheer: null }
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
        // Un mode de la réserve ne compte pour rien : ni XP, ni record, ni
        // historique — son score ne vit qu'à l'écran.
        profile: !countsForProgress(run.mode)
          ? session.profile
          : (session.challengeId ? applyChallengeRun : applyRun)(session.profile, {
              score: run.score,
              words: run.found.map((found) => found.word),
              bestCombo: run.bestCombo,
              prompts: run.dealt,
            }),
      }
    }

    case 'propose': {
      const word = normalizeWord(action.proposal.word)
      if (word === '' || session.proposals.some((proposal) => normalizeWord(proposal.word) === word)) return session
      return { ...session, proposals: [...session.proposals, action.proposal] }
    }

    case 'proposal-amended': {
      const at = session.proposals.findIndex((proposal) => proposal.at === action.at)
      if (at < 0) return session
      return {
        ...session,
        proposals: session.proposals.map((proposal, index) =>
          index === at ? { ...proposal, word: action.display } : proposal,
        ),
      }
    }

    case 'proposal-withdrawn':
      return { ...session, proposals: session.proposals.filter((proposal) => proposal.at !== action.at) }

    case 'home':
      return { ...session, phase: 'home', run: null, draft: '', live: null, cheer: null, proposals: [] }
  }
}

function withProfile(session: Session, profile: Profile): Session {
  return profile === session.profile ? session : { ...session, profile }
}
