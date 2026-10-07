import { context, reddit, redis, settings } from '@devvit/web/server'
import { CATALOGUE } from '../../../../src/domain/catalogue'
import { dailyLineup, dailyNumber, dayOf } from '../../../../src/domain/daily'
import { categoryText } from '../../../../src/i18n'
import { de } from '../../../../src/i18n/de'
import { en } from '../../../../src/i18n/en'
import { es } from '../../../../src/i18n/es'
import { fr, type Messages } from '../../../../src/i18n/fr'
import { it } from '../../../../src/i18n/it'
import { nl } from '../../../../src/i18n/nl'
import { pt } from '../../../../src/i18n/pt'
import type { DailyPostData } from '../../shared/api'
import { keys, writePost } from './store'

/** Held in `days` while the post is being created. */
export const PENDING = 'pending'

const MESSAGES: Record<string, Messages> = { fr, en, es, de, it, nl, pt }

/** The installation's language, English when the moderators left it unset. */
export async function installLanguage(): Promise<string> {
  const chosen = await settings.get<string | string[]>('language')
  const lang = Array.isArray(chosen) ? chosen[0] : chosen
  return lang && MESSAGES[lang] ? lang : 'en'
}

export function messagesOf(lang: string): Messages {
  return MESSAGES[lang] ?? en
}

/** Today in UTC, read from the wall clock here, never in the domain. */
export function today(): string {
  return dayOf(Date.now())
}

/**
 * Today's post, created once: the day's key is taken before the post exists,
 * so a cron retried while a moderator taps the menu still posts one game.
 */
export async function ensureDailyPost(): Promise<{ postId: string; created: boolean }> {
  const day = today()
  // Claimed before the post exists: two callers in the same second post one game.
  if ((await redis.hSetNX(keys.days, day, PENDING)) === 0) return { postId: (await redis.hGet(keys.days, day)) ?? PENDING, created: false }

  const lang = await installLanguage()
  const t = messagesOf(lang)
  // Every catalogue category ships in all seven languages (`src/data/words/*`).
  const data: DailyPostData = {
    day,
    lang,
    number: dailyNumber(day),
    categories: dailyLineup(day, lang, CATALOGUE.map((category) => category.id)),
  }
  let post
  try {
    post = await reddit.submitCustomPost({
      subredditName: context.subredditName,
      title: t.daily.postTitle(data.number, day),
      entry: 'default',
      postData: data,
      // What old Reddit, third-party apps, search and AutoModerator read instead of the game.
      textFallback: { text: t.daily.fallback(data.categories.map((id) => categoryText(t, id).label).join(', ')) },
    })
  } catch (error) {
    // Released, so the next tap or cron can try again.
    await redis.hDel(keys.days, [day])
    throw error
  }
  await Promise.all([redis.hSet(keys.days, { [day]: post.id }), writePost(post.id, data)])

  // The comment readers share their grid under, as Reddit's rules ask.
  try {
    const comment = await reddit.submitComment({ id: post.id, text: t.daily.pinned, runAs: 'APP' })
    await comment.distinguish(true)
    await redis.set(keys.pinned(post.id), comment.id)
  } catch (error) {
    console.error(`pinned comment failed on ${post.id}: ${String(error)}`)
  }
  return { postId: post.id, created: true }
}
