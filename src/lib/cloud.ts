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
}

export function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  return guard(async () => {
    const { data } = await supabase!.from('leaderboard').select('display_name, best_score, runs').limit(20)
    return (data ?? []).map((row) => ({
      name: (row.display_name as string) ?? 'Anonyme',
      bestScore: Number(row.best_score) || 0,
      runs: Number(row.runs) || 0,
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
