import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { BoardId, BoardRow, Boards } from '../domain/boards'
import type { Leaderboard, PeriodId, PlacedRow, StatId } from '../domain/leaderboards'
import { challengeWordsOf, type ChallengeEntry, type ChallengeWord } from '../domain/challenge'
import { MODERATION_SESSION_SIZE, type ModeratorOfferReason, type Verdict } from '../domain/moderation'
import type { Profile } from '../domain/progression'
import type { PromptRecord } from '../domain/prompts'
import type { RarityTier } from '../domain/rarity'
import { promptKey, promptOutcomes, type Run } from '../domain/run'
import { withBotRuns } from '../state/botRuns'
import type { PendingSubmission } from '../state/storage'
import { googleIdToken } from './native'
import { connect, forgetSession, supabase } from './supabase'

export interface CrowdUsage {
  /** Normalized word → share of recent runs that contained it. */
  shares: Record<string, number>
}

export interface CommunityWord {
  categoryId: string
  display: string
  sitelinks: number
  frequency: number
}

/**
 * The server knows nothing of languages: a word and a category are written
 * with their language in front — `de:animaux`, `de:katze` — so rarity,
 * discoveries and community words stay within one dictionary. French, the
 * first, keeps the bare names its rows were stored under.
 */
function scoped(lang: string, value: string): string {
  return lang === 'fr' ? value : `${lang}:${value}`
}

/** The value as the given language wrote it, or null when another language did. */
function unscoped(lang: string, value: string): string | null {
  const at = value.indexOf(':')
  if (lang === 'fr') return at === -1 ? value : null
  return value.startsWith(`${lang}:`) ? value.slice(at + 1) : null
}

/**
 * Every call here answers with a fallback instead of throwing: a failed sync
 * must cost the player nothing more than a stale leaderboard.
 */
async function guard<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  if (!supabase) return fallback
  try {
    const identity = await connect()
    if (!identity) return fallback
    return await work()
  } catch {
    return fallback
  }
}

export function fetchCrowdUsage(lang: string): Promise<CrowdUsage> {
  return guard(async () => {
    const { data } = await supabase!.from('word_popularity').select('word, share').limit(5000)
    const shares: Record<string, number> = {}
    for (const row of data ?? []) {
      const word = unscoped(lang, row.word as string)
      if (word !== null) shares[word] = Number(row.share) || 0
    }
    return { shares }
  }, { shares: {} })
}

/**
 * What the players' runs said of each pair (`promptKey`), which bends the
 * draw. Empty without a server, or before anyone has played: the draw then
 * follows the dictionaries alone.
 */
export function fetchPromptStats(lang: string): Promise<Record<string, PromptRecord>> {
  return guard(async () => {
    const { data } = await supabase!.from('prompt_stats').select('category_id, letter, dealt, passed').eq('lang', lang)
    const records: Record<string, PromptRecord> = {}
    for (const row of data ?? []) {
      records[promptKey({ categoryId: row.category_id as string, letter: row.letter as string })] = {
        dealt: Number(row.dealt) || 0,
        passed: Number(row.passed) || 0,
      }
    }
    return records
  }, {})
}

/** Words the community added since the bundled dictionaries were built. */
export function fetchCommunityWords(lang: string): Promise<Record<string, CommunityWord[]>> {
  return guard(async () => {
    const { data } = await supabase!
      .from('dictionary_words')
      .select('category_id, word, display, sitelinks, frequency')
      .eq('source', 'community')

    const byCategory: Record<string, CommunityWord[]> = {}
    for (const row of data ?? []) {
      const categoryId = unscoped(lang, row.category_id as string)
      if (categoryId === null) continue
      const list = (byCategory[categoryId] ??= [])
      list.push({
        categoryId,
        display: row.display as string,
        sitelinks: Number(row.sitelinks) || 0,
        frequency: Number(row.frequency) || 0,
      })
    }
    return byCategory
  }, {})
}

export function pushRun(run: Run, profile: Profile, lang: string): Promise<boolean> {
  return guard(async () => {
    const identity = await connect()
    const { data, error } = await supabase!
      .from('runs')
      .insert({
        player_id: identity!.userId,
        seed: run.seed,
        score: run.score,
        words: run.found.length,
        best_combo: run.bestCombo,
        skips: run.skips,
      })
      .select('id')
      .single()
    if (error || !data) return false

    if (run.found.length > 0) {
      await supabase!.from('run_words').insert(
        run.found.map((found) => ({
          run_id: data.id,
          word: scoped(lang, found.word),
          category_id: scoped(lang, found.prompt.categoryId),
          points: found.points,
        })),
      )
    }

    // What the run says of the pairs it left: the seed never replays server
    // side, so the client is the only one who knows what it was dealt. A
    // challenge reports nothing — its draw follows the seed and the embedded
    // dictionaries alone, whatever the crowd does.
    const outcomes = promptOutcomes(run)
    if (outcomes.length > 0) {
      await supabase!.rpc('report_prompts', {
        p_seed: run.seed,
        p_lang: lang,
        p_prompts: outcomes.map((outcome) => ({
          category: outcome.prompt.categoryId,
          letter: outcome.prompt.letter,
          passed: outcome.passed,
        })),
      })
    }

    await pushProfile(identity!.userId, profile)
    return true
  }, false)
}

async function pushProfile(userId: string, profile: Profile): Promise<void> {
  await supabase!
    .from('profiles')
    .update({
      xp: profile.xp,
      runs: profile.runs,
      best_score: profile.bestScore,
      words_found: profile.wordsFound,
      best_combo: profile.bestCombo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

/** Sends the words proposed while offline; returns those that went through. */
export function pushSubmissions(pending: readonly PendingSubmission[]): Promise<PendingSubmission[]> {
  if (pending.length === 0) return Promise.resolve([])

  return guard(async () => {
    const identity = await connect()
    const { error } = await supabase!.from('word_submissions').upsert(
      pending.map((submission) => ({
        player_id: identity!.userId,
        category_id: scoped(submission.lang ?? 'fr', submission.categoryId),
        word: scoped(submission.lang ?? 'fr', submission.word.trim().toLowerCase()),
        display: submission.word.trim(),
      })),
      { onConflict: 'player_id, category_id, word', ignoreDuplicates: true },
    )
    return error ? [] : [...pending]
  }, [])
}

export type SubmissionStatus = 'pending' | 'accepted' | 'rejected'

/** A word this player proposed, as the server holds it. */
export interface Submission {
  id: string
  lang: string
  categoryId: string
  display: string
  status: SubmissionStatus
  at: number
  /** A moderator has voted on it: its spelling no longer changes. */
  locked: boolean
  /** Accepted since the player last opened « Mes demandes ». */
  fresh: boolean
}

/** The language a scoped value was written in, and the value itself. */
function split(value: string): { lang: string; value: string } {
  const match = /^([a-z]{2}):(.*)$/.exec(value)
  return match ? { lang: match[1]!, value: match[2]! } : { lang: 'fr', value }
}

/** Newest first; null without a server, which the page tells apart from an empty list. */
export function fetchMySubmissions(): Promise<Submission[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('my_submissions')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const { lang, value } = split(row.category_id as string)
      return {
        id: row.id as string,
        lang,
        categoryId: value,
        display: row.display as string,
        status: row.status as SubmissionStatus,
        at: Date.parse(row.created_at as string) || 0,
        locked: row.locked === true,
        fresh: row.fresh === true,
      }
    })
  }, null)
}

/** Clears the badge: the accepted words have been seen. */
export function markRequestsSeen(): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('mark_requests_seen')
    return !error
  }, false)
}

export interface ModerationStatus {
  moderator: boolean
  /** Their « correct » is enough on its own, and they alone settle special cases. */
  super: boolean
  /** Words they validated that entered without a single « incorrect ». */
  validated: number
  /** Words waiting for them in the interface's language. */
  queue: number
  /** What to offer this player, if anything: the reason picks the wording. */
  offer: ModeratorOfferReason | null
  /** The friend who asked, for an offer made by a friend. */
  invitedBy: string | null
  /** Their words accepted since they last looked. */
  news: number
}

/** Null without a server, which hides everything moderation shows. */
export function fetchModerationStatus(lang: string): Promise<ModerationStatus | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('moderation_status', { p_lang: lang })
    if (error || !data) return null
    const row = data as Record<string, unknown>
    return {
      moderator: row.moderator === true,
      super: row.super === true,
      validated: Number(row.validated) || 0,
      queue: Number(row.queue) || 0,
      offer: (row.offer as ModeratorOfferReason | null) ?? null,
      invitedBy: (row.invited_by as string | null) ?? null,
      news: Number(row.news) || 0,
    }
  }, null)
}

/**
 * On opening « Mes demandes »: a moderator who finished his queue last time
 * gets it topped up from the server's reserve (0019). How many words came in.
 */
export function topUpModeration(lang: string): Promise<number> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('top_up_moderation', { p_lang: lang })
    return error ? 0 : Number(data) || 0
  }, 0)
}

/** A word waiting for a moderator's verdict. */
export interface ReviewCard {
  id: string
  categoryId: string
  display: string
  /** How many players asked for it. */
  proposals: number
  special: boolean
  /** Why a moderator sent it to the super moderators. */
  note: string | null
  /** Nobody has voted yet: the spelling can still be fixed. */
  canRespell: boolean
  /** The moderator's friends among those who asked: their words come first. */
  friends: string[]
}

/** Null when the server could not be reached, which the screen tells apart from nothing to judge. */
export function fetchModerationQueue(lang: string): Promise<ReviewCard[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('moderation_queue', { p_lang: lang, p_limit: MODERATION_SESSION_SIZE })
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      categoryId: split(row.category_id as string).value,
      display: row.display as string,
      proposals: Number(row.proposals) || 1,
      special: row.special === true,
      note: (row.note as string | null) ?? null,
      canRespell: row.can_respell === true,
      friends: (row.friends as string[] | null) ?? [],
    }))
  }, null)
}

/** What became of the word: `gone` when the vote could not be taken, `unreachable` when it never arrived. */
export type VoteOutcome = 'pending' | 'special' | 'accepted' | 'rejected' | 'gone' | 'unreachable'

export function castVote(
  card: ReviewCard,
  lang: string,
  verdict: Verdict,
  extra: { note?: string; respell?: string } = {},
): Promise<VoteOutcome> {
  const respell = extra.respell?.trim()
  return guard(async () => {
    const { data, error } = await supabase!.rpc('cast_vote', {
      p_review: card.id,
      p_verdict: verdict,
      p_note: extra.note?.trim() || null,
      p_word: respell ? scoped(lang, respell.toLowerCase()) : null,
      p_display: respell || null,
    })
    return error ? 'unreachable' : (data as VoteOutcome)
  }, 'unreachable')
}

/** False when the offer had expired, or when an anonymous player tried to accept it. */
export function answerModeratorOffer(reason: ModeratorOfferReason, accept: boolean): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('answer_moderator_offer', { p_reason: reason, p_accept: accept })
    return !error && data === true
  }, false)
}

export type InviteOutcome = 'sent' | 'already' | 'not-friend' | 'forbidden' | 'unreachable'

/** A moderator puts a friend forward; the friend is asked, not appointed. */
export function inviteModerator(friend: string): Promise<InviteOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('invite_moderator', { p_friend: friend })
    return error ? 'unreachable' : (data as InviteOutcome)
  }, 'unreachable')
}

/** Withdraws a word still waiting; false once it was accepted or refused, or offline. */
export function cancelSubmission(id: string): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!
      .from('word_submissions')
      .delete()
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
    return !error && (data ?? []).length > 0
  }, false)
}

/** Replaces a waiting word by its corrected spelling. */
export function correctSubmission(submission: Submission, display: string): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('amend_submission', {
      p_id: submission.id,
      p_word: scoped(submission.lang, display.trim().toLowerCase()),
      p_display: display.trim(),
    })
    return !error && data === true
  }, false)
}

/** Null without a server, which hides the boards rather than showing them empty. */
export function fetchBoards(): Promise<Boards | null> {
  return guard(async () => {
    const board = async (id: BoardId): Promise<BoardRow[]> => {
      const { data, error } = await supabase!.rpc('leaderboard_board', { p_board: id })
      if (error) throw error
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        name: row.display_name as string,
        avatar: parseAvatar(row.avatar),
        value: Number(row.value) || 0,
      }))
    }
    const [day, week, discoveries] = await Promise.all([board('day'), board('week'), board('discoveries')])
    return { day, week, discoveries }
  }, null)
}

/** Null without a server or when it does not answer: the page says so rather than showing it empty. */
export function fetchLeaderboard(stat: StatId, period: PeriodId): Promise<Leaderboard | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('leaderboard_stat', { p_stat: stat, p_period: period })
    if (error) return null
    const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      extra: row.extra === true,
      row: {
        name: row.display_name as string,
        avatar: parseAvatar(row.avatar),
        value: Number(row.value) || 0,
        place: Number(row.place) || 0,
        mine: row.mine === true,
      } satisfies PlacedRow,
    }))
    return {
      rows: rows.filter((entry) => !entry.extra).map((entry) => entry.row),
      me: rows.find((entry) => entry.extra)?.row ?? null,
    }
  }, null)
}

export interface Friend {
  id: string
  name: string
  avatar: AvatarChoice
  xp: number
  bestScore: number
  weekBest: number
  moderator: boolean
  /** `incoming` waits for this player's answer, `outgoing` for the other's. */
  relation: 'friend' | 'incoming' | 'outgoing'
}

/** Null without a server or for an anonymous player, who has no name to be found by. */
export function fetchFriends(): Promise<Friend[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('my_friends')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      name: row.display_name as string,
      avatar: parseAvatar(row.avatar),
      xp: Number(row.xp) || 0,
      bestScore: Number(row.best_score) || 0,
      weekBest: Number(row.week_best) || 0,
      moderator: row.moderator === true,
      relation: row.relation as Friend['relation'],
    }))
  }, null)
}

export type FriendRequestOutcome = 'sent' | 'accepted' | 'already' | 'self' | 'unknown' | 'anonymous' | 'unreachable'

export function requestFriend(name: string): Promise<FriendRequestOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('request_friend', { p_name: name.trim() })
    return error ? 'unreachable' : (data as FriendRequestOutcome)
  }, 'unreachable')
}

export type TesterInviteOutcome = 'sent' | 'already' | 'invalid' | 'limit' | 'anonymous' | 'unreachable'

/**
 * Invites someone by e-mail to the Play closed test: the address waits on the
 * server until the developer's script lists it as a tester and mails it.
 */
export function inviteTester(email: string, lang: string): Promise<TesterInviteOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('invite_tester', { p_email: email.trim(), p_lang: lang })
    return error ? 'unreachable' : (data as TesterInviteOutcome)
  }, 'unreachable')
}

export function respondFriend(from: string, accept: boolean): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('respond_friend', { p_from: from, p_accept: accept })
    return !error
  }, false)
}

/** Removes a friend, or withdraws a request sent to them. */
export function removeFriend(other: string): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('remove_friend', { p_other: other })
    return !error
  }, false)
}

export type BlockOutcome = 'blocked' | 'self' | 'unknown' | 'anonymous' | 'unreachable'

/** By name, as a board shows a player: ends the friendship, and their next requests vanish. */
export function blockPlayer(name: string): Promise<BlockOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('block_player', { p_name: name.trim() })
    return error ? 'unreachable' : (data as BlockOutcome)
  }, 'unreachable')
}

export function unblockPlayer(id: string): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('unblock_player', { p_other: id })
    return !error
  }, false)
}

export interface BlockedPlayer {
  id: string
  name: string
  avatar: AvatarChoice
}

export function fetchBlocks(): Promise<BlockedPlayer[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('my_blocks')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      name: row.display_name as string,
      avatar: parseAvatar(row.avatar),
    }))
  }, null)
}

/** Sent as typed; the server trims it and turns away a flood. */
export function submitIdea(body: string, lang: string): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('submit_idea', { p_body: body, p_lang: lang })
    return !error && data === true
  }, false)
}

/**
 * Erases the player's account and everything tied to it on the server. Answers
 * false only when an existing account could not be erased: without a server
 * or an account, there is nothing to erase.
 */
export async function deleteAccount(): Promise<boolean> {
  if (!supabase) return true
  try {
    // No session means nothing to erase: connecting here would create an
    // account only to delete it.
    const { data } = await supabase.auth.getSession()
    if (!data.session) return true
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return false
    await supabase.auth.signOut({ scope: 'local' })
    forgetSession()
    return true
  } catch {
    return false
  }
}

export interface Account {
  name: string
  email: string | null
  /** An anonymous player has played without registering: the end screen offers to keep their runs. */
  anonymous: boolean
  /** Signed in with Google, not yet named: friends and boards need a name to show. */
  needsName: boolean
  stats: Pick<Profile, 'xp' | 'runs' | 'bestScore' | 'wordsFound' | 'bestCombo'>
  avatar: AvatarChoice | null
}

/**
 * Null only when the device holds no session. A server that cannot be reached
 * is not the same answer: the player is still signed in, and the interface
 * keeps showing the account it knew.
 */
export function fetchAccount(): Promise<Account | null | 'unreachable'> {
  return guard(async (): Promise<Account | null | 'unreachable'> => {
    const { data, error } = await supabase!.auth.getSession()
    if (error) return 'unreachable'
    const user = data.session?.user
    if (!user) return null
    const { data: row, error: rowError } = await supabase!
      .from('profiles')
      .select('display_name, xp, runs, best_score, words_found, best_combo, avatar')
      .eq('id', user.id)
      .single()
    if (rowError || !row) return 'unreachable'
    const name = typeof row.display_name === 'string' ? row.display_name : 'Anonyme'
    const anonymous = user.is_anonymous === true
    return {
      name,
      email: user.email || null,
      anonymous,
      needsName: !anonymous && name === 'Anonyme',
      stats: {
        xp: Number(row.xp) || 0,
        runs: Number(row.runs) || 0,
        bestScore: Number(row.best_score) || 0,
        wordsFound: Number(row.words_found) || 0,
        bestCombo: Number(row.best_combo) || 0,
      },
      avatar: row.avatar ? parseAvatar(row.avatar) : null,
    }
  }, 'unreachable')
}

/** Why an account could not be made or reached; the interface words it in the player's language. */
export type AuthError =
  | 'unreachable'
  | 'email-taken'
  | 'weak-password'
  | 'short-password'
  | 'wrong-credentials'
  | 'invalid-email'
  | 'wrong-code'
  | 'rate-limited'
  | 'name-length'
  | 'name-reserved'
  | 'name-taken'

/** `warning`: signed in all the same, but part of the request did not go through. */
export type AuthOutcome = { ok: true; account: Account; warning?: AuthError } | { ok: false; error: AuthError }

function refuse(error: AuthError): AuthOutcome {
  return { ok: false, error }
}

/** Supabase answers in English with a code; the player reads their own language. */
function authError(error: { code?: string; message: string }): AuthError {
  switch (error.code) {
    case 'email_exists':
    case 'user_already_exists':
      return 'email-taken'
    case 'weak_password':
      return 'weak-password'
    case 'invalid_credentials':
      return 'wrong-credentials'
    case 'email_address_invalid':
      return 'invalid-email'
    case 'otp_expired':
    case 'otp_disabled':
      return 'wrong-code'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate-limited'
    default:
      return 'unreachable'
  }
}

/** The friend field reads such an entry as someone to invite, not a name. */
export const isEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

function checkCredentials(email: string, password: string): AuthError | null {
  if (!isEmail(email)) return 'invalid-email'
  if (password.length < 6) return 'short-password'
  return null
}

function checkName(name: string): AuthError | null {
  if (name.length < 2 || name.length > 24) return 'name-length'
  if (name.toLowerCase() === 'anonyme' || isEmail(name)) return 'name-reserved'
  return null
}

async function signedInAccount(): Promise<AuthOutcome> {
  const account = await fetchAccount()
  return account && account !== 'unreachable' ? { ok: true, account } : refuse('unreachable')
}

/**
 * Turns the anonymous player into a permanent account. Nothing moves: the run
 * they just finished already belongs to this user.
 */
export async function register(name: string, email: string, password: string): Promise<AuthOutcome> {
  const trimmed = name.trim()
  const invalid = checkName(trimmed) ?? checkCredentials(email.trim(), password)
  if (invalid) return refuse(invalid)
  if (!supabase) return refuse('unreachable')

  try {
    const identity = await connect()
    if (!identity) return refuse('unreachable')

    // The name goes first: the unique index is the cheapest availability check.
    const { error: nameError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', identity.userId)
    if (nameError) return refuse(nameError.code === '23505' ? 'name-taken' : 'unreachable')

    const { error } = await supabase.auth.updateUser({ email: email.trim(), password })
    if (error) {
      await supabase.from('profiles').update({ display_name: 'Anonyme' }).eq('id', identity.userId)
      return refuse(authError(error))
    }

    return await signedInAccount()
  } catch {
    return refuse('unreachable')
  }
}

/**
 * Signs into another user and pours the anonymous player's runs into it. The
 * merge token is taken while the anonymous session still exists: once signed
 * in, nothing else proves the two players are the same person.
 */
async function switchAccount(signIn: () => Promise<{ error: { code?: string; message: string } | null }>): Promise<AuthOutcome> {
  const { data: current } = await supabase!.auth.getSession()
  const token = current.session?.user.is_anonymous ? (await supabase!.rpc('prepare_merge')).data : null

  const { error } = await signIn()
  if (error) return refuse(authError(error))
  forgetSession()

  if (token) await supabase!.rpc('complete_merge', { p_token: token })
  return signedInAccount()
}

export async function logIn(email: string, password: string): Promise<AuthOutcome> {
  const invalid = checkCredentials(email.trim(), password)
  if (invalid) return refuse(invalid)
  if (!supabase) return refuse('unreachable')

  try {
    return await switchAccount(() => supabase!.auth.signInWithPassword({ email: email.trim(), password }))
  } catch {
    return refuse('unreachable')
  }
}

/**
 * Mails a recovery code rather than a link: a link would open the browser,
 * and the app could not be brought back to the form it came from. The mail
 * template must print `{{ .Token }}` (see supabase/README.md).
 */
export async function requestPasswordReset(email: string): Promise<AuthError | null> {
  if (!isEmail(email.trim())) return 'invalid-email'
  if (!supabase) return 'unreachable'
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    return error ? authError(error) : null
  } catch {
    return 'unreachable'
  }
}

/**
 * The code signs the player in; the new password is set afterwards, from
 * inside the account. Were that second step to fail, they stay signed in and
 * can simply ask for another code.
 */
export async function resetPassword(email: string, code: string, password: string): Promise<AuthOutcome> {
  const invalid = checkCredentials(email.trim(), password)
  if (invalid) return refuse(invalid)
  const token = code.replace(/\s/g, '')
  if (!/^\d{6,10}$/.test(token)) return refuse('wrong-code')
  if (!supabase) return refuse('unreachable')

  try {
    const outcome = await switchAccount(() => supabase!.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' }))
    if (!outcome.ok) return outcome
    const { error } = await supabase.auth.updateUser({ password })
    return error ? { ...outcome, warning: authError(error) } : outcome
  } catch {
    return refuse('unreachable')
  }
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Null when the player closed the Google picker: nothing to tell them. Google
 * signs the hashed nonce into the token, Supabase checks it against the raw
 * one, so a token lifted from another app cannot be replayed here. `ready` is
 * awaited only once the picker has answered: in a browser the picker is a
 * popup, which must open while the tap still counts as the player's.
 */
export async function logInWithGoogle(ready: Promise<unknown>): Promise<AuthOutcome | null> {
  if (!supabase) return refuse('unreachable')
  try {
    const nonce = crypto.randomUUID()
    const idToken = await googleIdToken(await sha256(nonce))
    if (!idToken) return null
    await ready
    return await switchAccount(() => supabase!.auth.signInWithIdToken({ provider: 'google', token: idToken, nonce }))
  } catch {
    return refuse('unreachable')
  }
}

/** Names an account that came from Google without one. */
export async function chooseName(name: string): Promise<AuthOutcome> {
  const trimmed = name.trim()
  const invalid = checkName(trimmed)
  if (invalid) return refuse(invalid)
  if (!supabase) return refuse('unreachable')

  try {
    const identity = await connect()
    if (!identity) return refuse('unreachable')
    const { error } = await supabase.from('profiles').update({ display_name: trimmed }).eq('id', identity.userId)
    if (error) return refuse(error.code === '23505' ? 'name-taken' : 'unreachable')
    return await signedInAccount()
  } catch {
    return refuse('unreachable')
  }
}

export async function logOut(): Promise<void> {
  if (!supabase) return
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* the local session is dropped either way */
  }
  forgetSession()
}

export function pushAvatar(avatar: AvatarChoice): Promise<boolean> {
  return guard(async () => {
    const identity = await connect()
    const { error } = await supabase!.from('profiles').update({ avatar }).eq('id', identity!.userId)
    return !error
  }, false)
}

// --------------------------------------------------------------- défis --

/**
 * A challenge carries its language in a column of its own: its category ids
 * and word keys are written bare, unlike the rest of the server.
 */
export interface ChallengeSummary {
  id: string
  ownerName: string
  owned: boolean
  lang: string
  categoryIds: readonly string[]
  createdAt: number
  players: number
  played: number
  mePlayed: boolean
  myScore: number | null
  finished: boolean
  expiresAt: number
  seenInvite: boolean
  seenRecap: boolean
  nextId: string | null
  /** Chosen by the owner, or null: the challenge is then named after them. */
  name: string | null
}

export interface ChallengePlayer extends ChallengeEntry {
  name: string
  avatar: AvatarChoice
  me: boolean
  /** A house bot: its run is played on this device (`withBotRuns`). */
  bot: boolean
}

export const REACTIONS = ['👏', '😂', '😮', '🔥', '❤️', '🏆'] as const
export type ReactionEmoji = (typeof REACTIONS)[number]

/** A reaction on the recap: `target` is `trophy:<id>` or `word:<category>:<key>`. */
export interface Reaction {
  target: string
  emoji: ReactionEmoji
  playerId: string
}

export interface ChallengeDetail {
  id: string
  ownerName: string
  owned: boolean
  lang: string
  seed: number
  categoryIds: readonly string[]
  createdAt: number
  expiresAt: number
  finished: boolean
  nextId: string | null
  /** The owner may bar powers: everyone then plays bare-handed. */
  powersAllowed: boolean
  name: string | null
  players: readonly ChallengePlayer[]
  reactions: readonly Reaction[]
}

const time = (value: unknown) => (typeof value === 'string' ? Date.parse(value) || 0 : 0)
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const TIERS: readonly RarityTier[] = ['courant', 'peu commun', 'rare', 'très rare']

/**
 * Rivals' words arrive as their time and points only until the player has
 * played: the rest is filled with blanks the race never reads.
 */
function challengeWord(raw: unknown): ChallengeWord {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    categoryId: text(row.categoryId),
    letter: text(row.letter),
    key: text(row.key),
    display: text(row.display),
    points: Number(row.points) || 0,
    tier: TIERS.includes(row.tier as RarityTier) ? (row.tier as RarityTier) : 'courant',
    approximate: row.approximate === true,
    seconds: Number(row.seconds) || 0,
    at: Number(row.at) || 0,
  }
}

/** Null without a server or an account; the home screen then shows no challenge at all. */
export function fetchChallenges(): Promise<ChallengeSummary[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('my_challenges')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      ownerName: text(row.owner_name),
      owned: row.owned === true,
      lang: text(row.lang) || 'fr',
      categoryIds: (row.category_ids as string[] | null) ?? [],
      createdAt: time(row.created_at),
      players: Number(row.players) || 0,
      played: Number(row.played) || 0,
      mePlayed: row.me_played === true,
      myScore: row.my_score === null || row.my_score === undefined ? null : Number(row.my_score),
      finished: row.finished === true,
      expiresAt: time(row.expires_at),
      seenInvite: row.seen_invite === true,
      seenRecap: row.seen_recap === true,
      nextId: (row.next_id as string | null) ?? null,
      name: text(row.name) || null,
    }))
  }, null)
}

export function fetchChallenge(id: string): Promise<ChallengeDetail | null> {
  return guard(async () => {
    const [{ data, error }, reacted] = await Promise.all([
      supabase!.rpc('challenge_detail', { p_challenge: id }),
      // Before 0014 the call fails: the recap simply shows no reactions.
      supabase!.rpc('reactions_of_challenge', { p_challenge: id }),
    ])
    if (error || !data) return null
    const row = data as Record<string, unknown>
    const reactions = ((reacted.data ?? []) as Record<string, unknown>[]).flatMap((reaction): Reaction[] =>
      REACTIONS.includes(reaction.emoji as ReactionEmoji)
        ? [{ target: text(reaction.target), emoji: reaction.emoji as ReactionEmoji, playerId: text(reaction.player_id) }]
        : [],
    )
    return withBotRuns({
      id: row.id as string,
      ownerName: text(row.owner_name),
      owned: row.owned === true,
      lang: text(row.lang) || 'fr',
      seed: Number(row.seed) >>> 0,
      categoryIds: (row.category_ids as string[] | null) ?? [],
      createdAt: time(row.created_at),
      expiresAt: time(row.expires_at),
      finished: row.finished === true,
      nextId: (row.next_id as string | null) ?? null,
      powersAllowed: row.powers_allowed !== false,
      name: text(row.name) || null,
      players: ((row.players ?? []) as Record<string, unknown>[]).map((player) => ({
        playerId: player.id as string,
        name: text(player.name),
        avatar: parseAvatar(player.avatar),
        me: player.me === true,
        bot: player.bot === true,
        playedAt: player.played_at ? time(player.played_at) : null,
        score: Number(player.score) || 0,
        skips: Number(player.skips) || 0,
        bestCombo: Number(player.best_combo) || 0,
        words: ((player.words ?? []) as unknown[]).map(challengeWord),
      })),
      reactions,
    })
  }, null)
}

/** The new challenge's id, or null when it could not open: no friend left to invite, or offline. */
export function createChallenge(
  lang: string,
  seed: number,
  categoryIds: readonly string[],
  friends: readonly string[],
  powersAllowed: boolean,
  name: string,
): Promise<string | null> {
  return guard(async () => {
    const args = { p_lang: lang, p_seed: seed, p_categories: categoryIds, p_friends: friends, p_powers: powersAllowed }
    const named = name.trim()
    let { data, error } = await supabase!.rpc('create_challenge', named ? { ...args, p_name: named } : args)
    // Before 0017 the server knows no name: the challenge opens without one rather than not at all.
    if (error && named) ({ data, error } = await supabase!.rpc('create_challenge', args))
    return error ? null : ((data as string | null) ?? null)
  }, null)
}

export type ChallengeInviteOutcome = 'sent' | 'full' | 'finished' | 'forbidden' | 'unreachable'

export function inviteToChallenge(id: string, friends: readonly string[]): Promise<ChallengeInviteOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('invite_to_challenge', { p_challenge: id, p_friends: friends })
    return error ? 'unreachable' : (data as ChallengeInviteOutcome)
  }, 'unreachable')
}

/**
 * Sends the run to its challenge, never to `runs`: it stays off the boards and
 * out of the rarity counts. The profile's totals go up all the same.
 */
export function pushChallengeRun(id: string, run: Run, profile: Profile): Promise<boolean> {
  return guard(async () => {
    const identity = await connect()
    const { data, error } = await supabase!.rpc('submit_challenge_run', {
      p_challenge: id,
      p_score: run.score,
      p_skips: run.skips,
      p_best_combo: run.bestCombo,
      p_words: challengeWordsOf(run),
    })
    await pushProfile(identity!.userId, profile)
    return !error && data === true
  }, false)
}

/** A null emoji takes the player's reaction back. */
export function reactInChallenge(id: string, target: string, emoji: ReactionEmoji | null): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('react_in_challenge', { p_challenge: id, p_target: target, p_emoji: emoji })
    return !error && data === true
  }, false)
}

export function markChallengeSeen(id: string, what: 'invite' | 'recap'): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('mark_challenge_seen', { p_challenge: id, p_what: what })
    return !error
  }, false)
}

/** The rematch's id: this player's own, or the one somebody launched first. */
export function rematchChallenge(id: string, seed: number, categoryIds: readonly string[]): Promise<string | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('rematch_challenge', {
      p_challenge: id,
      p_seed: seed,
      p_categories: categoryIds,
    })
    return error ? null : ((data as string | null) ?? null)
  }, null)
}

/** Where the server sends this phone's pushes, and in which language. */
export function savePushToken(token: string, lang: string): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('save_push_token', { p_token: token, p_platform: 'android', p_lang: lang })
    return !error && data === true
  }, false)
}

/** Before signing out: the phone stops receiving this account's pushes. */
export function forgetPushToken(token: string): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('forget_push_token', { p_token: token })
    return !error
  }, false)
}
