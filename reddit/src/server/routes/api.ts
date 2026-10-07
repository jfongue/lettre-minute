import { Hono } from 'hono'
import { context, reddit, redis } from '@devvit/web/server'
import { plausibleDaily } from '../../../../src/domain/daily'
import type { DayResponse, ErrorResponse, PlayRequest, PlayResponse, ShareRequest, ShareResponse } from '../../shared/api'
import { today } from '../core/daily'
import { keys, readPlay, readPost, readStreak, readTop, standingOf, touchStreak, wordId } from '../core/store'

export const api = new Hono()

/** A shared grid is a short comment: anything longer was not written by the game. */
const MAX_SHARE_LENGTH = 1000

const missingPost = (message: string) => ({ type: 'error', message }) satisfies ErrorResponse

api.get('/day', async (c) => {
  const { postId, userId } = context
  if (!postId) return c.json(missingPost('postId missing from context'), 400)
  const [board, username, mine] = await Promise.all([
    readTop(postId),
    reddit.getCurrentUsername(),
    userId ? readPlay(postId, userId) : Promise.resolve(null),
  ])
  const post = await readPost(postId)
  const streak = userId && post ? await readStreak(userId, today()) : 0
  return c.json<DayResponse>({
    type: 'day',
    username: userId ? (username ?? null) : null,
    players: board.players,
    top: board.top,
    played: mine ? { ...mine, ...(await standingOf(postId, mine, streak)) } : null,
  })
})

api.post('/play', async (c) => {
  const { postId, userId } = context
  if (!postId) return c.json(missingPost('postId missing from context'), 400)
  const post = await readPost(postId)
  if (!post) return c.json(missingPost('not a daily post'), 404)

  const body = await c.req.json<PlayRequest>()
  const result: PlayRequest = {
    score: body.score,
    words: Array.isArray(body.words) ? body.words : [],
    skips: Number(body.skips) || 0,
    bestCombo: Number(body.bestCombo) || 0,
  }
  if (!plausibleDaily(result.score, result.words, post.categories)) return c.json(missingPost('implausible result'), 422)

  // A logged-out reader played, and sees where they would stand; nothing is kept.
  const first = userId ? (await redis.hSetNX(keys.plays(postId), userId, JSON.stringify(result))) === 1 : false
  if (userId && first) {
    const username = (await reddit.getCurrentUsername()) ?? '?'
    await Promise.all([
      redis.zAdd(keys.board(postId), { member: userId, score: result.score }),
      redis.hSet(keys.names(postId), { [userId]: username }),
      ...result.words.map((word) => redis.hIncrBy(keys.finders(postId), wordId(word), 1)),
    ])
  }
  const streak = userId && first ? await touchStreak(userId, post.day, today()) : userId ? await readStreak(userId, today()) : 0
  const board = await readTop(postId)
  return c.json<PlayResponse>({
    type: 'play',
    counted: first,
    top: board.top,
    players: board.players,
    standing: await standingOf(postId, result, streak),
  })
})

api.post('/share', async (c) => {
  const { postId, userId } = context
  if (!postId || !userId) return c.json<ShareResponse>({ type: 'share', ok: false }, 400)
  const { text } = await c.req.json<ShareRequest>()
  if (typeof text !== 'string' || text.trim() === '' || text.length > MAX_SHARE_LENGTH) {
    return c.json<ShareResponse>({ type: 'share', ok: false }, 400)
  }
  const pinned = await redis.get(keys.pinned(postId))
  try {
    // The reader's own comment, on their tap only: Reddit's rule for a shared score.
    await reddit.submitComment({ id: (pinned ?? postId) as `t1_${string}` | `t3_${string}`, text, runAs: 'USER' })
    return c.json<ShareResponse>({ type: 'share', ok: true })
  } catch (error) {
    console.error(`share failed on ${postId}: ${String(error)}`)
    return c.json<ShareResponse>({ type: 'share', ok: false }, 500)
  }
})
