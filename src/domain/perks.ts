import type { Profile } from './progression'
import { hasPower, promptKey, type Judge, type Prompt, type Run, type SettledPrompt } from './run'

/** Bans a player holds without Premium at most, each one a « filter » level bonus; none to begin with. */
export const FREE_BANS_MAX = 2

/** Bans Premium holds. */
export const PLUS_BANS = 6

/** Playable categories a ban never goes under: a run of five still has one to spare. */
export const MIN_PLAYABLE_CATEGORIES = 6

/** Hidden answers uncovered per day: the base, then what bonuses and ads add, up to `REVEALS_MAX`. */
export const BASE_REVEALS = 2
export const REVEAL_BONUS_MAX = 3
export const REVEAL_ADS_MAX = 3
export const REVEALS_MAX = BASE_REVEALS + REVEAL_BONUS_MAX + REVEAL_ADS_MAX

/** What Premium gave beyond the free limits, as the Premium page counts it. */
export type PlusStat = 'reveals' | 'attempts' | 'filterRuns' | 'premiereRuns' | 'adsSkipped'

export const PLUS_STATS: readonly PlusStat[] = ['reveals', 'attempts', 'filterRuns', 'premiereRuns', 'adsSkipped']

export function plusStat(profile: Profile, stat: PlusStat): number {
  return profile.plusStats[stat] ?? 0
}

function bumped(profile: Profile, ...stats: PlusStat[]): Profile {
  const plusStats: Record<string, number> = { ...profile.plusStats }
  for (const stat of stats) plusStats[stat] = (plusStats[stat] ?? 0) + 1
  return { ...profile, plusStats }
}

/** One ad a free player would have watched, and a Premium member did not. */
export function countPlusAdSkipped(profile: Profile): Profile {
  return isPlus(profile) ? bumped(profile, 'adsSkipped') : profile
}

/**
 * A reveal a Premium member took: counted when it goes beyond what the free
 * day allows — a reveal an ad would have paid for also skips that ad, one past
 * the ads' share is simply extra. Free players spend theirs with `spendReveal`.
 */
export function countPlusReveal(profile: Profile, day: string): Profile {
  if (!isPlus(profile)) return profile
  const today = revealsOn(profile, day)
  const used = today.revealsUsed + 1
  const free = BASE_REVEALS + Math.min(REVEAL_BONUS_MAX, profile.bonuses.filter((id) => id === 'reveal').length)
  const beyond = used - free
  const next = { ...today, revealsUsed: used }
  if (beyond <= 0) return next
  return bumped(next, 'reveals', ...(beyond <= REVEAL_ADS_MAX ? (['adsSkipped'] as const) : []))
}

/** What a finished run shows of Premium: filters past the free maximum, and an avant-première dealt. */
export interface PlusRunInfo {
  filtersActive: number
  premiereDealt: boolean
}

export function countPlusRun(profile: Profile, info: PlusRunInfo): Profile {
  if (!isPlus(profile)) return profile
  const stats: PlusStat[] = []
  if (info.filtersActive > FREE_BANS_MAX) stats.push('filterRuns')
  if (info.premiereDealt) stats.push('premiereRuns')
  return stats.length === 0 ? profile : bumped(profile, ...stats)
}

/** Weekly attempt number `n` (1-based) played: from the third on it is Premium's, and the third spares an ad. */
export function countPlusAttempt(profile: Profile, n: number): Profile {
  if (!isPlus(profile) || n < 3) return profile
  return bumped(profile, 'attempts', ...(n === 3 ? (['adsSkipped'] as const) : []))
}

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

/** Bans the player's bonuses allow, Premium aside. */
export function freeBans(profile: Profile): number {
  return Math.min(FREE_BANS_MAX, profile.bonuses.filter((id) => id === 'filter').length)
}

/** Bans anyone can hold: Premium's, or the bonuses'. */
export function bansAllowed(profile: Profile): number {
  return isPlus(profile) ? PLUS_BANS : freeBans(profile)
}

/** Filtering exists once a ban is possible: a bonus taken, or Premium. */
export function banUnlocked(profile: Profile): boolean {
  return bansAllowed(profile) > 0
}

/**
 * What a ban asks for: `ok` bans at once, `plus` the bans the bonuses give
 * all laid (Premium holds more), `max` Premium's all laid, `floor` would
 * leave fewer than six categories in play, `locked` filtering not earned.
 */
export type BanVerdict = 'ok' | 'plus' | 'max' | 'floor' | 'locked'

export function banVerdict(profile: Profile, ownedIds: readonly string[], categoryId: string): BanVerdict {
  if (!banUnlocked(profile) || !ownedIds.includes(categoryId)) return 'locked'
  const banned = bannedOf(profile, ownedIds)
  if (banned.includes(categoryId)) return 'ok'
  if (ownedIds.length - banned.length - 1 < MIN_PLAYABLE_CATEGORIES) return 'floor'
  if (banned.length >= bansAllowed(profile)) return isPlus(profile) ? 'max' : 'plus'
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
 * The bans that still hold: on owned categories, within what the bonuses or
 * Premium allow — the latest ones give way first.
 */
export function bannedOf(profile: Profile, ownedIds: readonly string[]): string[] {
  const held = profile.banned.filter((id) => ownedIds.includes(id))
  return held.slice(0, Math.max(0, Math.min(bansAllowed(profile), ownedIds.length - MIN_PLAYABLE_CATEGORIES)))
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
export function banNews(profile: Profile): boolean {
  return banUnlocked(profile) && profile.banIntroSeen === 0
}

export function markBanIntroSeen(profile: Profile): Profile {
  return profile.banIntroSeen > 0 ? profile : { ...profile, banIntroSeen: 1 }
}

/** The profile's reveal count, restarted if it was kept for another day. */
function revealsOn(profile: Profile, day: string): Profile {
  return profile.revealDay === day ? profile : { ...profile, revealDay: day, revealsUsed: 0, revealAds: 0 }
}

/** Reveals the day allows: the base, the reveal bonuses, the ads watched. Premium has no count. */
export function revealsAllowed(profile: Profile, day: string): number {
  const bonus = Math.min(REVEAL_BONUS_MAX, profile.bonuses.filter((id) => id === 'reveal').length)
  return BASE_REVEALS + bonus + revealsOn(profile, day).revealAds
}

/** Hidden answers still to uncover on `day` (Paris, `YYYY-MM-DD`); infinite for Premium. */
export function revealsLeft(profile: Profile, day: string): number {
  if (isPlus(profile)) return Infinity
  return Math.max(0, revealsAllowed(profile, day) - revealsOn(profile, day).revealsUsed)
}

export function spendReveal(profile: Profile, day: string): Profile {
  if (revealsLeft(profile, day) <= 0 || isPlus(profile)) return profile
  const today = revealsOn(profile, day)
  return { ...today, revealsUsed: today.revealsUsed + 1 }
}

/** Rewarded ads that can still pay a reveal today; none for Premium, who needs none. */
export function revealAdsLeft(profile: Profile, day: string): number {
  if (isPlus(profile)) return 0
  return Math.max(0, REVEAL_ADS_MAX - revealsOn(profile, day).revealAds)
}

/** One more reveal for a watched ad, up to `REVEAL_ADS_MAX` a day. */
export function grantRevealAd(profile: Profile, day: string): Profile {
  if (revealAdsLeft(profile, day) <= 0) return profile
  const today = revealsOn(profile, day)
  return { ...today, revealAds: today.revealAds + 1 }
}

/** What a screen shows of the day's reveals: `left` of `allowed`, the ads still to watch, or no count for Premium. */
export interface RevealBudget {
  left: number
  allowed: number
  adsLeft: number
  unlimited: boolean
}

export function revealBudget(profile: Profile, day: string): RevealBudget {
  return {
    left: revealsLeft(profile, day),
    allowed: revealsAllowed(profile, day),
    adsLeft: revealAdsLeft(profile, day),
    unlimited: isPlus(profile),
  }
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
