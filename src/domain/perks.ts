import type { Profile } from './progression'
import { hasPower, promptKey, type Judge, type Prompt, type Run, type SettledPrompt } from './run'

/** Owned categories from which one may be banned from the draw. */
export const BAN_UNLOCK_CATEGORIES = 7

/** Bans a player keeps without Premium; past it, Premium's own. */
export const FREE_BANS = 1

/** The most bans anyone holds, Premium included. */
export const MAX_BANS = 5

/** Playable categories a ban never goes under: a run of five still has one to spare. */
export const MIN_PLAYABLE_CATEGORIES = 6

/** Hidden answers of the summary a player may uncover without Premium, over all their runs. */
export const FREE_PEEKS = 5

/** Runs before the game first asks for the player's opinion, then between two asks. */
export const FEEDBACK_FIRST_RUNS = 10
export const FEEDBACK_EVERY_RUNS = 30

export function isPlus(profile: Profile): boolean {
  return profile.plusSince > 0
}

/** Premium costs nothing for now: joining is a date written down. */
export function joinPlus(profile: Profile, now: number): Profile {
  return isPlus(profile) ? profile : { ...profile, plusSince: now }
}

/** The home screen thanks a new Premium member once, and asks what they think of the game. */
export function plusThanksDue(profile: Profile): boolean {
  return isPlus(profile) && profile.plusThanked === 0
}

export function markPlusThanked(profile: Profile): Profile {
  return profile.plusThanked > 0 ? profile : { ...profile, plusThanked: 1 }
}

export function banUnlocked(ownedIds: readonly string[]): boolean {
  return ownedIds.length >= BAN_UNLOCK_CATEGORIES
}

/**
 * What a ban asks for: `ok` bans at once, `plus` is the free ban already
 * spent, `max` the five bans all held, `floor` would leave fewer than six
 * categories in play.
 */
export type BanVerdict = 'ok' | 'plus' | 'max' | 'floor' | 'locked'

export function banVerdict(profile: Profile, ownedIds: readonly string[], categoryId: string): BanVerdict {
  if (!banUnlocked(ownedIds) || !ownedIds.includes(categoryId)) return 'locked'
  const banned = bannedOf(profile, ownedIds)
  if (banned.includes(categoryId)) return 'ok'
  if (banned.length >= MAX_BANS) return 'max'
  if (ownedIds.length - banned.length - 1 < MIN_PLAYABLE_CATEGORIES) return 'floor'
  if (banned.length >= FREE_BANS && !isPlus(profile)) return 'plus'
  return 'ok'
}

export function ban(profile: Profile, ownedIds: readonly string[], categoryId: string): Profile {
  if (banVerdict(profile, ownedIds, categoryId) !== 'ok' || profile.banned.includes(categoryId)) return profile
  return { ...profile, banned: [...profile.banned, categoryId] }
}

export function unban(profile: Profile, categoryId: string): Profile {
  return profile.banned.includes(categoryId)
    ? { ...profile, banned: profile.banned.filter((id) => id !== categoryId) }
    : profile
}

/**
 * The bans that still hold: on owned categories, and the free one alone once
 * Premium is gone — the latest ones give way first.
 */
export function bannedOf(profile: Profile, ownedIds: readonly string[]): string[] {
  if (!banUnlocked(ownedIds)) return []
  const held = profile.banned.filter((id) => ownedIds.includes(id))
  const allowed = isPlus(profile) ? MAX_BANS : FREE_BANS
  return held.slice(0, Math.max(0, Math.min(allowed, ownedIds.length - MIN_PLAYABLE_CATEGORIES)))
}

/**
 * The categories a solo run deals from. A challenge ignores bans: every
 * player must draw from the same categories.
 */
export function playableCategoryIds(profile: Profile, ownedIds: readonly string[]): string[] {
  const banned = new Set(bannedOf(profile, ownedIds))
  return ownedIds.filter((id) => !banned.has(id))
}

/** The ban is there to be learnt: a dot on the categories until the player has read what it does. */
export function banNews(profile: Profile, ownedIds: readonly string[]): boolean {
  return banUnlocked(ownedIds) && profile.banIntroSeen === 0
}

export function markBanIntroSeen(profile: Profile): Profile {
  return profile.banIntroSeen > 0 ? profile : { ...profile, banIntroSeen: 1 }
}

export function peeksLeft(profile: Profile): number {
  return isPlus(profile) ? Infinity : Math.max(0, FREE_PEEKS - profile.peeks)
}

export function spendPeek(profile: Profile): Profile {
  if (peeksLeft(profile) <= 0) return profile
  return { ...profile, peeks: profile.peeks + 1 }
}

/** A prompt the run left empty, and the word it could have taken. */
export interface HiddenAnswer {
  prompt: Prompt
  display: string
}

/**
 * The prompts the player skipped, each with the word the game still had — what
 * the summary hides under a bar. A pair skipped twice is shown once; a pair
 * with nothing left is left out. Professeur (`rare`) hands over uncommon words
 * instead of the crowd's favourite.
 */
export function hiddenAnswers(run: Run, judge: Judge): HiddenAnswer[] {
  return hiddenAnswersOf(run.settled, run.used, judge, hasPower(run, 'professor'))
}

/** The same, from what a run left behind: its settled prompts and the keys it played. */
export function hiddenAnswersOf(
  settled: readonly SettledPrompt[],
  used: readonly string[],
  judge: Judge,
  rare = false,
): HiddenAnswer[] {
  const seen = new Set<string>()
  const answers: HiddenAnswer[] = []
  for (const { prompt, passed } of settled) {
    const key = promptKey(prompt)
    if (!passed || seen.has(key)) continue
    seen.add(key)
    const display =
      judge.suggest?.(prompt.categoryId, prompt.letter, used, rare) ??
      judge.common?.(prompt.categoryId, prompt.letter, used) ??
      null
    if (display) answers.push({ prompt, display })
  }
  return answers
}

/** Whether the next return home asks for the player's opinion: after ten runs, then every thirty. */
export function feedbackDue(profile: Profile): boolean {
  if (profile.feedbackAskedAt === 0) return profile.runs >= FEEDBACK_FIRST_RUNS
  return profile.runs - profile.feedbackAskedAt >= FEEDBACK_EVERY_RUNS
}

export function markFeedbackAsked(profile: Profile): Profile {
  return profile.feedbackAskedAt === profile.runs ? profile : { ...profile, feedbackAskedAt: profile.runs }
}

/** Runs after which even an anonymous player hears that the game can be shared. */
export const SHARE_NEWS_RUNS = 15

/** The one-time news that friends can now be invited: a named account at once, anyone else after fifteen runs. */
export function shareNewsDue(profile: Profile, named: boolean, seen: boolean): boolean {
  return !seen && (named || profile.runs >= SHARE_NEWS_RUNS)
}
