import { redis } from '@devvit/web/server'
import type { ChallengeWord } from '../../../../src/domain/challenge'
import { dayBefore } from '../../../../src/domain/daily'
import type { BoardRow, DailyPostData, DailyResult, Standing } from '../../shared/api'

/**
 * Every key of the app, in one place: `onPostDelete` must be able to erase
 * all a post left behind, which Reddit's rules require. Redis is scoped to
 * the subreddit the app is installed on, so nothing here names it.
 */
export const keys = {
  /** The post's day, language, number and lineup, as its postData says. */
  post: (postId: string) => `post:${postId}`,
  /** Each day's post by day, so a retried cron or a moderator's tap never posts it twice. */
  days: 'days',
  /** Raw scores by user id. */
  board: (postId: string) => `board:${postId}`,
  /** Each counted game, by user id, as JSON. */
  plays: (postId: string) => `plays:${postId}`,
  /** User names by id, for the board. */
  names: (postId: string) => `names:${postId}`,
  /** How many readers found each `categoryId:key`. */
  finders: (postId: string) => `finders:${postId}`,
  /** The app's pinned comment, where shared scores go. */
  pinned: (postId: string) => `pinned:${postId}`,
  /** A reader's run of days, across posts: last day played, length, best. */
  streak: (userId: string) => `streak:${userId}`,
}

export const TOP_SIZE = 10

export const wordId = (word: Pick<ChallengeWord, 'categoryId' | 'key'>) => `${word.categoryId}:${word.key}`

export async function readPost(postId: string): Promise<DailyPostData | null> {
  const fields = await redis.hGetAll(keys.post(postId))
  if (!fields.day || !fields.lang || !fields.categories) return null
  return {
    day: fields.day,
    lang: fields.lang,
    number: Number(fields.number ?? 0),
    categories: JSON.parse(fields.categories) as string[],
  }
}

export async function writePost(postId: string, data: DailyPostData): Promise<void> {
  await redis.hSet(keys.post(postId), {
    day: data.day,
    lang: data.lang,
    number: String(data.number),
    categories: JSON.stringify(data.categories),
  })
}

export async function readTop(postId: string): Promise<{ top: BoardRow[]; players: number }> {
  const [rows, players] = await Promise.all([
    redis.zRange(keys.board(postId), 0, TOP_SIZE - 1, { by: 'rank', reverse: true }),
    redis.zCard(keys.board(postId)),
  ])
  const names = rows.length > 0 ? await redis.hMGet(keys.names(postId), rows.map((row) => row.member)) : []
  return {
    top: rows.map((row, at) => ({ name: names[at] ?? '?', score: row.score })),
    players,
  }
}

export async function readPlay(postId: string, userId: string): Promise<DailyResult | null> {
  const raw = await redis.hGet(keys.plays(postId), userId)
  return raw ? (JSON.parse(raw) as DailyResult) : null
}

/** Where a reader stands: rank among the scores, and which of their words are still theirs alone. */
export async function standingOf(postId: string, result: DailyResult, streak: number): Promise<Standing> {
  const [above, total, counts] = await Promise.all([
    // Devvit's Redis has no ZCOUNT: the scores above, read by score, capped at a thousand per call.
    redis.zRange(keys.board(postId), result.score + 1, '+inf', { by: 'score' }).then((rows) => rows.length),
    redis.zCard(keys.board(postId)),
    result.words.length > 0 ? redis.hMGet(keys.finders(postId), result.words.map(wordId)) : Promise.resolve([]),
  ])
  return {
    rank: above + 1,
    total,
    unique: result.words.filter((_, at) => Number(counts[at] ?? 0) <= 1).map(wordId),
    streak,
  }
}

/** A game of today's post extends the run of days; any other post leaves it be. */
export async function touchStreak(userId: string, day: string, today: string): Promise<number> {
  const fields = await redis.hGetAll(keys.streak(userId))
  const last = fields.last ?? ''
  const count = Number(fields.count ?? 0)
  if (day !== today) return 0
  if (last === day) return count
  const next = last === dayBefore(day) ? count + 1 : 1
  await redis.hSet(keys.streak(userId), {
    last: day,
    count: String(next),
    best: String(Math.max(next, Number(fields.best ?? 0))),
  })
  return next
}

export async function readStreak(userId: string, today: string): Promise<number> {
  const fields = await redis.hGetAll(keys.streak(userId))
  const last = fields.last ?? ''
  // A run is alive until the day after its last game ends.
  return last === today || last === dayBefore(today) ? Number(fields.count ?? 0) : 0
}

export async function erasePost(postId: string): Promise<void> {
  const data = await readPost(postId)
  const stale = [keys.post(postId), keys.board(postId), keys.plays(postId), keys.names(postId), keys.finders(postId), keys.pinned(postId)]
  await redis.del(...stale)
  if (data && (await redis.hGet(keys.days, data.day)) === postId) await redis.hDel(keys.days, [data.day])
}
