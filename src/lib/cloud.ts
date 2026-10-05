import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { BoardId, BoardRow, Boards } from '../domain/boards'
import type { SlotEntry, Snapshot } from '../debug/snapshot'
import type { WordsReport } from '../debug/words'
import { parseRecord, RECENT_MIN_DAYS, RECENT_MIN_RUNS, type RunRecord } from '../domain/history'
import { parseProgress, progressOf, type Progress } from '../domain/progress'
import type { Leaderboard, PeriodId, PlacedRow, StatId } from '../domain/leaderboards'
import { challengeWordsOf, type ChallengeEntry, type ChallengeWord } from '../domain/challenge'
import type { DuelMove } from '../domain/duelLog'
import type { Audience, FlagRow, FlagValue } from '../domain/features'
import { MODERATION_SESSION_SIZE, type ModeratorOfferReason, type Verdict } from '../domain/moderation'
import type { Profile } from '../domain/progression'
import type { PromptRecord } from '../domain/prompts'
import type { RarityTier } from '../domain/rarity'
import { promptKey, promptOutcomes, type Run } from '../domain/run'
import { withBotRuns } from '../state/botRuns'
import { loadSubmissions, saveSubmissions, type PendingSubmission } from '../state/storage'
import { googleIdToken } from './native'
import { connect, forgetSession, supabase } from './supabase'
import { testClient } from './testClient'

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

export function pushRun(run: Run, record: RunRecord, profile: Profile): Promise<boolean> {
  return guard(async () => {
    const identity = await connect()
    // Ce que le profil ne garde pas (les pouvoirs restent sur l'appareil) :
    // la partie dit avec quoi elle a été jouée, pour les classements avancés
    // du mode débug. La colonne date de 0025.
    //
    // Le compte emporte aussi le relevé de la partie (0033) : c'est lui que la
    // page des statistiques relit sur un autre appareil, avec l'orthographe de
    // chaque mot et le temps qu'il a mis.
    //
    // Un client d'agent (`testClient`) étiquette enfin sa partie (0040) : le
    // tableau de bord l'écarte. Aucune de ces trois colonnes n'existe sur un
    // projet plus ancien, et chacune refusée ferait perdre la partie — elles
    // tombent donc l'une après l'autre, la partie nue passant toujours.
    const fields: [string, () => unknown][] = [
      ['record', () => record],
      ['powers', () => [...run.powers]],
      ['test', () => testClient()],
    ]
    const payload = () => ({
      player_id: identity!.userId,
      seed: run.seed,
      score: run.score,
      words: run.found.length,
      best_combo: run.bestCombo,
      skips: run.skips,
      ...Object.fromEntries(fields.map(([name, value]) => [name, value()])),
    })

    let data: { id?: string } | null = null
    let error: unknown = null
    for (;;) {
      const answer = await supabase!.from('runs').insert(payload()).select('id').single()
      data = answer.data
      error = answer.error
      if (!error || fields.length === 0) break
      fields.pop()
    }
    if (error || !data) return false

    if (record.words.length > 0) {
      const shots = record.words.map((found) => ({
        run_id: data.id,
        word: scoped(record.lang, found.word),
        category_id: scoped(record.lang, found.categoryId),
        points: found.points,
        // Un mot que le dictionnaire a corrigé : l'écran des mots le compte à
        // part (0043), la rareté ne le paie déjà pas.
        approximate: found.approximate === true,
      }))
      // La colonne n'existe pas sur un projet d'avant 0043 : la partie passe
      // sans elle plutôt que d'être perdue.
      const { error: missed } = await supabase!.from('run_words').insert(shots)
      if (missed) {
        await supabase!.from('run_words').insert(
          shots.map((shot) => ({
            run_id: shot.run_id,
            word: shot.word,
            category_id: shot.category_id,
            points: shot.points,
          })),
        )
      }
    }

    // What the run says of the pairs it left: the seed never replays server
    // side, so the client is the only one who knows what it was dealt. A
    // challenge reports nothing — its draw follows the seed and the embedded
    // dictionaries alone, whatever the crowd does.
    const outcomes = promptOutcomes(run)
    if (outcomes.length > 0) {
      // Ce que chaque couple a rendu : les points et les mots de ses réponses.
      // Un couple tiré deux fois dans la partie ne les compte qu'une fois, sur
      // son premier passage — la somme reste celle de la partie.
      const scored = new Map<string, { points: number; words: number }>()
      for (const found of run.found) {
        const key = promptKey(found.prompt)
        const tally = scored.get(key) ?? { points: 0, words: 0 }
        tally.points += found.points
        tally.words += 1
        scored.set(key, tally)
      }
      const counted = new Set<string>()
      await supabase!.rpc('report_prompts', {
        p_seed: run.seed,
        p_lang: record.lang,
        p_prompts: outcomes.map((outcome) => {
          const key = promptKey(outcome.prompt)
          const first = !counted.has(key)
          counted.add(key)
          const tally = scored.get(key)
          return {
            category: outcome.prompt.categoryId,
            letter: outcome.prompt.letter,
            passed: outcome.passed,
            points: first ? (tally?.points ?? 0) : 0,
            words: first ? (tally?.words ?? 0) : 0,
          }
        }),
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

/** A run as `runs` holds it: the totals, its record (0033) and, for older ones, only its words. */
interface StoredRun {
  id: string
  created_at: string
  score: number
  best_combo: number
  skips: number
  record?: unknown
  run_words?: { word: string; category_id: string; points: number }[]
}

// Les mots viennent avec la partie : une liste d'identifiants passée à `.in()`
// ferait une adresse de plusieurs kilo-octets, que le serveur refuse.
const RUN_COLUMNS = 'id, created_at, score, best_combo, skips, record, run_words(word, category_id, points)'
const RUN_COLUMNS_WITHOUT_RECORD = 'id, created_at, score, best_combo, skips, run_words(word, category_id, points)'

/** The language the server filed a run's words under: their prefix, French's rows staying bare. */
function langOf(values: readonly string[]): string {
  for (const value of values) {
    const at = value.indexOf(':')
    if (at !== -1) return value.slice(0, at)
  }
  return 'fr'
}

function recordOfRow(row: StoredRun): RunRecord | null {
  const record = parseRecord(row.record)
  if (record) return record
  const played = (row.run_words ?? []).map((word) => ({ word: word.word, categoryId: word.category_id, points: Number(word.points) || 0 }))
  const lang = langOf(played.map((entry) => entry.categoryId))
  const category = (value: string) => unscoped(lang, value) ?? value
  return {
    at: Date.parse(row.created_at) || 0,
    lang,
    score: Number(row.score) || 0,
    bestCombo: Number(row.best_combo) || 0,
    skips: Number(row.skips) || 0,
    categoryIds: [...new Set(played.map((entry) => category(entry.categoryId)))],
    words: played.map((entry) => ({ categoryId: category(entry.categoryId), word: category(entry.word), display: category(entry.word), points: entry.points })),
  }
}

/**
 * One page of the account's runs older than `before`, newest first: the
 * statistics' history reaches back through every device, thirty at a time.
 * Null when the server does not answer, and for a player without an account.
 */
export function fetchRunsBefore(before: number, limit: number): Promise<RunRecord[] | null> {
  return guard(async () => {
    const identity = await connect()
    if (!identity) return null
    const read = (columns: string) =>
      supabase!
        .from('runs')
        .select(columns)
        .eq('player_id', identity.userId)
        .lt('created_at', new Date(before).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit)
    let page = await read(RUN_COLUMNS)
    if (page.error) page = await read(RUN_COLUMNS_WITHOUT_RECORD)
    if (page.error) return null
    return ((page.data ?? []) as unknown as StoredRun[]).map(recordOfRow).filter((record): record is RunRecord => record !== null)
  }, null)
}

/**
 * Les parties du joueur telles que le serveur les garde : au moins les vingt
 * dernières ou les trois derniers jours, la plus large des deux, pour que la
 * page des statistiques dise la même chose sur un téléphone qui vient de se
 * connecter que sur celui qui a joué. Une partie poussée depuis 0033 emporte
 * son relevé entier ; les plus anciennes, qui n'ont gardé que leurs mots, se
 * recomposent sans leur orthographe ni leur chrono.
 */
export function fetchMyRuns(): Promise<RunRecord[] | null> {
  return guard(async () => {
    const identity = await connect()
    const read = (columns: string) => {
      const since = new Date(Date.now() - RECENT_MIN_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const newest = supabase!.from('runs').select(columns).eq('player_id', identity!.userId).order('created_at', { ascending: false }).limit(RECENT_MIN_RUNS)
      const windowed = supabase!.from('runs').select(columns).eq('player_id', identity!.userId).gte('created_at', since).order('created_at', { ascending: false }).limit(500)
      return Promise.all([newest, windowed])
    }
    let [newest, windowed] = await read(RUN_COLUMNS)
    // 0033 pas encore appliquée : `record` n'existe pas, on relit ce qui existe.
    if (newest.error || windowed.error) [newest, windowed] = await read(RUN_COLUMNS_WITHOUT_RECORD)
    const rows = [
      ...new Map(
        [...((newest.data ?? []) as unknown as StoredRun[]), ...((windowed.data ?? []) as unknown as StoredRun[])].map((row) => [row.id, row]),
      ).values(),
    ]

    return rows
      .map(recordOfRow)
      .filter((record): record is RunRecord => record !== null)
      .sort((one, other) => other.at - one.at)
  }, null)
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

/**
 * Un mot proposé hors d'une partie — depuis l'écran des mots, ouvert par cinq
 * tapes sur « Mes catégories » : il attend dans la file de l'appareil quand le
 * serveur ne répond pas, puis rejoint la modération comme n'importe quelle
 * proposition. Rien n'est validé ici, pas même d'un modérateur.
 *
 * `false` : le mot est gardé sur l'appareil, il partira au prochain envoi.
 */
export function proposeWord(lang: string, categoryId: string, word: string): Promise<boolean> {
  const trimmed = word.trim()
  if (trimmed.length < 2 || categoryId === '') return Promise.resolve(false)

  const entry: PendingSubmission = { word: trimmed, categoryId, at: Date.now(), lang }
  // La file de l'appareil est une frontière comme le réseau : sans elle, rien
  // ne s'écrit — et rien ne lève.
  try {
    const pending = loadSubmissions()
    const known = (item: PendingSubmission) =>
      item.categoryId === categoryId &&
      (item.lang ?? 'fr') === lang &&
      item.word.trim().toLowerCase() === trimmed.toLowerCase()
    if (pending.some(known)) return Promise.resolve(true)
    saveSubmissions([...pending, entry])
  } catch {
    return Promise.resolve(false)
  }

  return pushSubmissions([entry]).then((sent) => {
    if (sent.length === 0) return false
    try {
      saveSubmissions(loadSubmissions().filter((item) => item.at !== entry.at))
    } catch {
      // Le mot est parti ; une file qu'on ne peut pas relire ne le rappellera pas.
    }
    return true
  })
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
  /** `ban` is a word of the dictionary a moderator flagged: `correct` means remove it. */
  kind: 'add' | 'ban'
  display: string
  /** Players who asked for it, or moderators who agreed to remove it. */
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
      kind: row.kind === 'ban' ? 'ban' : 'add',
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

/** A word flagged for removal: counted, already settled, settled by this vote, or refused. */
export type BanOutcome = 'sent' | 'accepted' | 'rejected' | 'known' | 'forbidden' | 'unreachable'

/**
 * A moderator flags a word of the dictionary he was just given: his word counts
 * for one vote, and the others judge it in « Mes demandes » — with his reason,
 * which they read on the card. The word only leaves the game at the next
 * dictionary build (`scripts/banned-words.ts`).
 */
export function proposeBan(
  lang: string,
  categoryId: string,
  word: string,
  display: string,
  reason: string,
  /** Le signaleur demande l'avis des autres : sa voix ne règle pas la revue seule (0048). */
  wait = false,
): Promise<BanOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('propose_ban', {
      p_category: scoped(lang, categoryId),
      p_word: word,
      p_display: display,
      p_note: reason.trim() || null,
      p_wait: wait,
    })
    return error ? 'unreachable' : (data as BanOutcome)
  }, 'unreachable')
}

/**
 * Un super modérateur retire un mot d'office, depuis l'écran des mots : sa
 * voix règle le signalement seule, et la copie communautaire quitte le serveur
 * tout de suite — le dictionnaire livré, lui, ne bouge qu'au prochain import.
 * `forbidden` à qui n'est pas super modérateur : le serveur le vérifie aussi.
 */
export function forceRemoveWord(
  lang: string,
  categoryId: string,
  word: string,
  display: string,
  reason: string,
): Promise<BanOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('force_ban', {
      p_category: scoped(lang, categoryId),
      p_word: word,
      p_display: display,
      p_note: reason.trim() || null,
    })
    return error ? 'unreachable' : (data as BanOutcome)
  }, 'unreachable')
}

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

/**
 * La sauvegarde cloud du joueur connecté (0032) : null sans serveur, sans
 * sauvegarde encore, ou quand le serveur ne répond pas — le profil de
 * l'appareil reste alors tel quel.
 */
export function fetchProgress(): Promise<Progress | null> {
  return guard(async () => {
    const identity = await connect()
    const { data, error } = await supabase!.from('player_progress').select('progress').eq('id', identity!.userId).maybeSingle()
    if (error || !data) return null
    return parseProgress(data.progress)
  }, null)
}

export function pushProgress(profile: Profile): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('save_progress', { p_progress: progressOf(profile) })
    return !error && data === true
  }, false)
}

/**
 * Les découvertes du joueur depuis toujours, telles que le classement du même
 * nom les compte : pour le succès Play Games des quinze découvertes. Null sans
 * serveur ou pour un joueur anonyme, que ce classement ne range pas.
 */
export async function fetchMyDiscoveries(): Promise<number | null> {
  const board = await fetchLeaderboard('discoveries', 'all')
  if (!board) return null
  return (board.rows.find((row) => row.mine) ?? board.me)?.value ?? null
}

/**
 * Le tableau de bord de l'administrateur (0030), d'un bloc. Null pour qui
 * n'est pas administrateur, ou quand le serveur ne répond pas.
 */
export function fetchDashboard(days = 30): Promise<Snapshot | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('admin_analytics', { p_days: days })
    if (error || !data) return null
    return data as Snapshot
  }, null)
}

/** Les joueurs d'un jour, ou d'une heure (heure de Paris) : `admin_slot`, 0036. */
export function fetchDashboardSlot(day: string, hour?: number): Promise<SlotEntry[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('admin_slot', { p_day: day, p_hour: hour ?? null })
    if (error || !data) return null
    return data as SlotEntry[]
  }, null)
}

/**
 * Le tableau des mots (`admin_words`, 0043) : ce que le tirage a donné à
 * chaque couple lettre + catégorie, ce que les joueurs ont écrit, et ce que la
 * modération a ajouté, retiré ou garde. `null` hors administrateur, comme
 * `fetchDashboard`, ou sans serveur.
 */
export function fetchAdminWords(lang: string, category: string | null): Promise<WordsReport | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('admin_words', { p_lang: lang, p_category: category })
    if (error || !data) return null
    return data as WordsReport
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
 * Invites someone by e-mail (0034): the server mails them at once and makes
 * them the inviter's friend when an account takes that address. An address
 * that already plays gets a friend request and the same `sent`.
 */
export function inviteTester(email: string, lang: string): Promise<TesterInviteOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('invite_tester', { p_email: email.trim(), p_lang: lang })
    return error ? 'unreachable' : (data as TesterInviteOutcome)
  }, 'unreachable')
}

/** The code a shared invitation carries (0034); null without a named account or a server. */
export function fetchInviteCode(): Promise<string | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('my_invite_code')
    return error || typeof data !== 'string' ? null : data
  }, null)
}

/**
 * Befriends whoever shared the code: their name once done, null when the code
 * leads nowhere (unknown, one's own, a block), `unreachable` to try again.
 */
export function acceptInvite(code: string): Promise<string | null | 'unreachable'> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('accept_invite', { p_code: code })
    return error ? 'unreachable' : typeof data === 'string' ? data : null
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

/** Where an idea was written: the box of « Mes demandes », or the question asked on the way home. */
export type IdeaSource = 'box' | 'prompt'

/** Sent as typed; the server trims it and turns away a flood. */
export function submitIdea(body: string, lang: string, source: IdeaSource = 'box'): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('submit_idea', { p_body: body, p_lang: lang, p_source: source })
    if (!error) return data === true
    // A project without 0028 knows only the two-argument form: the idea still goes, its source untold.
    if (error.code !== 'PGRST202') return false
    const fallback = await supabase!.rpc('submit_idea', { p_body: body, p_lang: lang })
    return !fallback.error && fallback.data === true
  }, false)
}

/** An idea as the admin reads it (0028). */
export interface AdminIdea {
  id: string
  body: string
  lang: string | null
  source: IdeaSource
  author: string
  /** The author's runs when read: how far into the game they wrote it, roughly. */
  authorRuns: number
  createdAt: string
  archivedAt: string | null
}

/** Null for whoever is not an admin, or without a server; the list otherwise, newest first. */
export function fetchAdminIdeas(): Promise<AdminIdea[] | null> {
  return guard(async () => {
    const { data: admin } = await supabase!.rpc('is_admin')
    if (admin !== true) return null
    const { data, error } = await supabase!.rpc('admin_ideas')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      body: row.body as string,
      lang: (row.lang as string | null) ?? null,
      source: row.source === 'prompt' ? 'prompt' : 'box',
      author: row.author as string,
      authorRuns: Number(row.author_runs) || 0,
      createdAt: row.created_at as string,
      archivedAt: (row.archived_at as string | null) ?? null,
    }))
  }, null)
}

export function archiveIdea(id: string, archived: boolean): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('archive_idea', { p_id: id, p_archived: archived })
    return !error && data === true
  }, false)
}

export function deleteIdea(id: string): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('delete_idea', { p_id: id })
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
export async function logInWithGoogle(ready: Promise<unknown>, quiet = false): Promise<AuthOutcome | null> {
  if (!supabase) return refuse('unreachable')
  try {
    const nonce = crypto.randomUUID()
    const idToken = await googleIdToken(await sha256(nonce), quiet)
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
  /**
   * What the challenge looked like when its player set it aside; null while it
   * is not. Kept by the account, not the device, so the same challenges stay
   * out of the list on the phone and in the browser.
   */
  hiddenStamp: string | null
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
      hiddenStamp: (row.hidden_stamp as string | null) ?? null,
    }))
  }, null)
}

/** A challenge the player shared with an accepted friend, newest first. */
export interface FriendChallenge {
  friendId: string
  challengeId: string
}

/** Null offline, or before 0027: the friends' pages then show no history. */
export function fetchFriendChallenges(): Promise<FriendChallenge[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('friend_challenges')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      friendId: row.friend_id as string,
      challengeId: row.challenge_id as string,
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

/** Sets a challenge aside for this account, or brings it back with a null stamp. */
export function markChallengeHidden(id: string, stamp: string | null): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('mark_challenge_hidden', { p_challenge: id, p_stamp: stamp })
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

// -------------------------------------------------- fonctionnalités (0045) --

/** La table des fonctionnalités telle que le serveur la tient ; null s'il ne répond pas. */
export function fetchFeatureFlags(): Promise<Record<string, FlagRow> | null> {
  return guard(async () => {
    const { data, error } = await supabase!.from('feature_flags').select('feature, everyone, moderator, premium, super_moderator')
    if (error || !data) return null
    const rows: Record<string, FlagRow> = {}
    for (const row of data as Record<string, unknown>[]) {
      rows[row.feature as string] = {
        everyone: flagValue(row.everyone),
        moderator: flagValue(row.moderator),
        premium: flagValue(row.premium),
        superModerator: flagValue(row.super_moderator),
      }
    }
    return rows
  }, null)
}

const flagValue = (value: unknown): FlagValue => (value === 'on' || value === 'off' ? value : 'neutral')

export type FlagOutcome = 'saved' | 'forbidden' | 'invalid' | 'unreachable'

const AUDIENCE_COLUMNS: Record<Audience, string> = {
  everyone: 'everyone',
  moderator: 'moderator',
  premium: 'premium',
  superModerator: 'super_moderator',
}

/** Une case du tableau, réglée par un super modérateur. */
export function setFeatureFlag(feature: string, audience: Audience, value: FlagValue): Promise<FlagOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('set_feature_flag', { p_feature: feature, p_audience: AUDIENCE_COLUMNS[audience], p_value: value })
    return error ? 'unreachable' : (data as FlagOutcome)
  }, 'unreachable')
}

// ------------------------------------------------------- duel en ligne (0046) --

export interface DuelCandidate {
  id: string
  name: string
  avatar: AvatarChoice
  bot: boolean
}

/** Qui l'hôte peut inviter : ses amis, et les joueurs maison. */
export function fetchDuelCandidates(): Promise<DuelCandidate[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_candidates')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      name: row.display_name as string,
      avatar: parseAvatar(row.avatar),
      bot: row.bot === true,
    }))
  }, null)
}

/** Ouvre une table dont le joueur est l'hôte ; null sans serveur ou sans compte nommé. */
export function createDuelTable(lang: string, categories: readonly string[], owned: number): Promise<string | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_create', { p_lang: lang, p_categories: categories, p_owned: owned })
    return error ? null : (data as string)
  }, null)
}

export type DuelInviteOutcome = 'sent' | 'seated' | 'full' | 'closed' | 'forbidden' | 'unreachable'

export function inviteToDuel(table: string, player: string): Promise<DuelInviteOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_invite', { p_table: table, p_player: player })
    return error ? 'unreachable' : (data as DuelInviteOutcome)
  }, 'unreachable')
}

export interface DuelInvitation {
  table: string
  host: string
  avatar: AvatarChoice
  players: number
  at: number
}

/** Les invitations qui attendent le joueur ; null s'il n'y a pas de serveur. */
export function fetchDuelInvites(): Promise<DuelInvitation[] | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_my_invites')
    if (error) return null
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      table: row.table_id as string,
      host: row.host_name as string,
      avatar: parseAvatar(row.host_avatar),
      players: Number(row.players) || 0,
      at: Date.parse(row.created_at as string) || 0,
    }))
  }, null)
}

export type DuelJoinOutcome = 'joined' | 'full' | 'closed' | 'kicked' | 'forbidden' | 'unreachable'

export function joinDuel(table: string, owned: number): Promise<DuelJoinOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_join', { p_table: table, p_owned: owned })
    return error ? 'unreachable' : (data as DuelJoinOutcome)
  }, 'unreachable')
}

export function declineDuel(table: string): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('duel_decline', { p_table: table })
    return !error
  }, false)
}

export type DuelReadyOutcome = 'waiting' | 'started' | 'closed' | 'unreachable'

export function setDuelReady(table: string, ready: boolean): Promise<DuelReadyOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_ready', { p_table: table, p_ready: ready })
    return error ? 'unreachable' : (data as DuelReadyOutcome)
  }, 'unreachable')
}

export function kickFromDuel(table: string, player: string): Promise<boolean> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_kick', { p_table: table, p_player: player })
    return !error && data === 'kicked'
  }, false)
}

export function leaveDuel(table: string): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('duel_leave', { p_table: table })
    return !error
  }, false)
}

export type DuelMoveOutcome = 'ok' | 'stale' | 'closed' | 'forbidden' | 'unreachable'

export function postDuelMove(table: string, move: DuelMove): Promise<DuelMoveOutcome> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_move', {
      p_table: table,
      p_seq: move.seq,
      p_seat: move.seat,
      p_kind: move.kind,
      p_payload: move.payload,
    })
    return error ? 'unreachable' : (data as DuelMoveOutcome)
  }, 'unreachable')
}

export function finishDuel(table: string): Promise<boolean> {
  return guard(async () => {
    const { error } = await supabase!.rpc('duel_finish', { p_table: table })
    return !error
  }, false)
}

export function openDuelRematch(table: string, owned: number): Promise<string | null> {
  return guard(async () => {
    const { data, error } = await supabase!.rpc('duel_rematch', { p_table: table, p_owned: owned })
    return error ? null : (data as string)
  }, null)
}

export interface DuelSeatRow {
  player: string
  name: string
  avatar: AvatarChoice
  bot: boolean
  owned: number
  ready: boolean
  seat: number | null
  left: boolean
  kicked: boolean
  /** La dernière lecture de cet appareil, à l'horloge du serveur. */
  seen: number
}

export interface DuelSnapshot {
  /** L'heure du serveur à la réponse, en secondes. */
  now: number
  table: {
    id: string
    host: string
    lang: string
    seed: number
    categories: readonly string[]
    status: 'lobby' | 'playing' | 'over' | 'closed'
    startedAt: number | null
    rematch: string | null
  }
  seats: readonly DuelSeatRow[]
  invites: readonly { player: string; name: string; avatar: AvatarChoice }[]
  moves: readonly DuelMove[]
}

/** La table et les coups après `after` ; null si le joueur n'y est pas, 'unreachable' si le serveur se tait. */
export function syncDuel(table: string, after: number): Promise<DuelSnapshot | null | 'unreachable'> {
  return guard<DuelSnapshot | null | 'unreachable'>(async () => {
    const { data, error } = await supabase!.rpc('duel_sync', { p_table: table, p_after: after })
    if (error) return 'unreachable'
    if (!data) return null
    const row = data as Record<string, unknown>
    const info = row.table as Record<string, unknown>
    return {
      now: Number(row.now) || 0,
      table: {
        id: info.id as string,
        host: info.host as string,
        lang: info.lang as string,
        seed: Number(info.seed) >>> 0,
        categories: (info.categories as string[]) ?? [],
        status: info.status as DuelSnapshot['table']['status'],
        startedAt: info.started_at === null || info.started_at === undefined ? null : Number(info.started_at),
        rematch: (info.rematch as string | null) ?? null,
      },
      seats: ((row.seats as Record<string, unknown>[]) ?? []).map((seat) => ({
        player: seat.player as string,
        name: seat.name as string,
        avatar: parseAvatar(seat.avatar),
        bot: seat.bot === true,
        owned: Number(seat.owned) || 0,
        ready: seat.ready === true,
        seat: seat.seat === null || seat.seat === undefined ? null : Number(seat.seat),
        left: seat.left === true,
        kicked: seat.kicked === true,
        seen: Number(seat.seen) || 0,
      })),
      invites: ((row.invites as Record<string, unknown>[]) ?? []).map((invite) => ({
        player: invite.player as string,
        name: invite.name as string,
        avatar: parseAvatar(invite.avatar),
      })),
      moves: ((row.moves as Record<string, unknown>[]) ?? []).map((move) => ({
        seq: Number(move.seq),
        seat: Number(move.seat),
        kind: move.kind as DuelMove['kind'],
        payload: (move.payload as string) ?? '',
        at: Number(move.at),
      })),
    }
  }, 'unreachable')
}

/** L'identifiant du joueur sur le serveur : c'est sous lui que le duel range sa place. */
export function fetchPlayerId(): Promise<string | null> {
  return guard(async () => (await connect())?.userId ?? null, null)
}
