import { Hono } from 'hono'
import { context } from '@devvit/web/server'
import type { TaskResponse } from '@devvit/web/server'
import type { OnPostDeleteRequest, TriggerResponse, UiResponse } from '@devvit/web/shared'
import { ensureDailyPost, PENDING } from '../core/daily'
import { erasePost } from '../core/store'

export const internal = new Hono()

internal.post('/scheduler/daily-post', async (c) => {
  try {
    const { postId, created } = await ensureDailyPost()
    console.log(`daily post ${created ? 'created' : 'already there'}: ${postId}`)
    return c.json<TaskResponse>({ status: 'ok' }, 200)
  } catch (error) {
    console.error(`daily post failed: ${String(error)}`)
    return c.json<TaskResponse>({ status: 'error' }, 500)
  }
})

internal.post('/menu/daily-post', async (c) => {
  try {
    const { postId } = await ensureDailyPost()
    if (postId === PENDING) return c.json<UiResponse>({ showToast: 'Today’s post is being created, try again in a moment.' }, 200)
    return c.json<UiResponse>({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${postId}` }, 200)
  } catch (error) {
    console.error(`daily post failed: ${String(error)}`)
    return c.json<UiResponse>({ showToast: 'Could not create today’s post.' }, 400)
  }
})

internal.post('/triggers/on-app-install', async (c) => {
  try {
    const { postId } = await ensureDailyPost()
    return c.json<TriggerResponse>({ status: 'success', message: `daily post ${postId}` }, 200)
  } catch (error) {
    return c.json<TriggerResponse>({ status: 'error', message: String(error) }, 400)
  }
})

// Reddit's rules: what a post stored goes with it.
internal.post('/triggers/on-post-delete', async (c) => {
  const { postId } = await c.req.json<OnPostDeleteRequest>()
  if (postId) await erasePost(postId)
  return c.json<TriggerResponse>({ status: 'success', message: `erased ${postId}` }, 200)
})
