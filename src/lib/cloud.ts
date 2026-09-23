import { parseAvatar, type AvatarChoice } from '../domain/avatar'
import type { Profile } from '../domain/progression'
import type { Run } from '../domain/run'
import type { PendingSubmission } from '../state/storage'
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

export function fetchCrowdUsage(): Promise<CrowdUsage> {
  return guard(async () => {
    const { data } = await supabase!.from('word_popularity').select('word, share').limit(5000)
    const shares: Record<string, number> = {}
    for (const row of data ?? []) shares[row.word as string] = Number(row.share) || 0
    return { shares }
  }, { shares: {} })
}

/** Words the community added since the bundled dictionaries were built. */
export function fetchCommunityWords(): Promise<Record<string, CommunityWord[]>> {
  return guard(async () => {
    const { data } = await supabase!
      .from('dictionary_words')
      .select('category_id, word, display, sitelinks, frequency')
      .eq('source', 'community')

    const byCategory: Record<string, CommunityWord[]> = {}
    for (const row of data ?? []) {
      const list = (byCategory[row.category_id as string] ??= [])
      list.push({
        categoryId: row.category_id as string,
        display: row.display as string,
        sitelinks: Number(row.sitelinks) || 0,
        frequency: Number(row.frequency) || 0,
      })
    }
    return byCategory
  }, {})
}

export function pushRun(run: Run, profile: Profile): Promise<boolean> {
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
          word: found.word,
          category_id: found.prompt.categoryId,
          points: found.points,
        })),
      )
    }

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
      .eq('id', identity!.userId)

    return true
  }, false)
}

/** Sends the words proposed while offline; returns those that went through. */
export function pushSubmissions(pending: readonly PendingSubmission[]): Promise<PendingSubmission[]> {
  if (pending.length === 0) return Promise.resolve([])

  return guard(async () => {
    const identity = await connect()
    const { error } = await supabase!.from('word_submissions').upsert(
      pending.map((submission) => ({
        player_id: identity!.userId,
        category_id: submission.categoryId,
        word: submission.word.trim().toLowerCase(),
        display: submission.word.trim(),
      })),
      { onConflict: 'player_id, category_id, word', ignoreDuplicates: true },
    )
    return error ? [] : [...pending]
  }, [])
}

export interface LeaderboardRow {
  name: string
  bestScore: number
  runs: number
  avatar: AvatarChoice
}

export function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  return guard(async () => {
    const { data } = await supabase!.from('leaderboard').select('display_name, best_score, runs, avatar').limit(20)
    return (data ?? []).map((row) => ({
      name: (row.display_name as string) ?? 'Anonyme',
      bestScore: Number(row.best_score) || 0,
      runs: Number(row.runs) || 0,
      avatar: parseAvatar(row.avatar),
    }))
  }, [])
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
  stats: Omit<Profile, 'usage'>
  avatar: AvatarChoice | null
}

export function fetchAccount(): Promise<Account | null> {
  return guard(async () => {
    const { data } = await supabase!.auth.getSession()
    const user = data.session?.user
    if (!user) return null
    const { data: row } = await supabase!
      .from('profiles')
      .select('display_name, xp, runs, best_score, words_found, best_combo, avatar')
      .eq('id', user.id)
      .single()
    return {
      name: (row?.display_name as string) ?? 'Anonyme',
      email: user.email || null,
      anonymous: user.is_anonymous ?? false,
      stats: {
        xp: Number(row?.xp) || 0,
        runs: Number(row?.runs) || 0,
        bestScore: Number(row?.best_score) || 0,
        wordsFound: Number(row?.words_found) || 0,
        bestCombo: Number(row?.best_combo) || 0,
      },
      avatar: row?.avatar ? parseAvatar(row.avatar) : null,
    }
  }, null)
}

export type AuthOutcome = { ok: true; account: Account } | { ok: false; message: string }

const UNREACHABLE = 'Le serveur ne répond pas. Réessaie dans un instant.'

function refuse(message: string): AuthOutcome {
  return { ok: false, message }
}

/** Supabase answers in English with a code; the player reads French. */
function authMessage(error: { code?: string; message: string }): string {
  switch (error.code) {
    case 'email_exists':
    case 'user_already_exists':
      return 'Cette adresse a déjà un compte : connecte-toi plutôt.'
    case 'weak_password':
      return 'Mot de passe trop faible : six caractères au moins.'
    case 'invalid_credentials':
      return 'Adresse ou mot de passe incorrect.'
    case 'email_address_invalid':
      return 'Cette adresse n’est pas valide.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Trop d’essais d’un coup. Patiente une minute.'
    default:
      return UNREACHABLE
  }
}

function checkCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Cette adresse n’est pas valide.'
  if (password.length < 6) return 'Mot de passe trop court : six caractères au moins.'
  return null
}

/**
 * Turns the anonymous player into a permanent account. Nothing moves: the run
 * they just finished already belongs to this user.
 */
export async function register(name: string, email: string, password: string): Promise<AuthOutcome> {
  const trimmed = name.trim()
  if (trimmed.length < 2 || trimmed.length > 24) return refuse('Le nom fait entre 2 et 24 caractères.')
  if (trimmed.toLowerCase() === 'anonyme') return refuse('Ce nom est réservé.')
  const invalid = checkCredentials(email.trim(), password)
  if (invalid) return refuse(invalid)
  if (!supabase) return refuse(UNREACHABLE)

  try {
    const identity = await connect()
    if (!identity) return refuse(UNREACHABLE)

    // The name goes first: the unique index is the cheapest availability check.
    const { error: nameError } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', identity.userId)
    if (nameError) return refuse(nameError.code === '23505' ? 'Ce nom est déjà pris.' : UNREACHABLE)

    const { error } = await supabase.auth.updateUser({ email: email.trim(), password })
    if (error) {
      await supabase.from('profiles').update({ display_name: 'Anonyme' }).eq('id', identity.userId)
      return refuse(authMessage(error))
    }

    const account = await fetchAccount()
    return account ? { ok: true, account } : refuse(UNREACHABLE)
  } catch {
    return refuse(UNREACHABLE)
  }
}

/**
 * Signs into an existing account and pours the anonymous player's runs into
 * it. The merge token is taken while the anonymous session still exists: once
 * signed in, nothing else proves the two players are the same person.
 */
export async function logIn(email: string, password: string): Promise<AuthOutcome> {
  const invalid = checkCredentials(email.trim(), password)
  if (invalid) return refuse(invalid)
  if (!supabase) return refuse(UNREACHABLE)

  try {
    const { data: current } = await supabase.auth.getSession()
    const token = current.session?.user.is_anonymous ? (await supabase.rpc('prepare_merge')).data : null

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) return refuse(authMessage(error))
    forgetSession()

    if (token) await supabase.rpc('complete_merge', { p_token: token })
    const account = await fetchAccount()
    return account ? { ok: true, account } : refuse(UNREACHABLE)
  } catch {
    return refuse(UNREACHABLE)
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
