import { context } from '@devvit/web/client'
import { isLocale, type Locale } from '../../../src/i18n'
import type { DailyPostData } from '../shared/api'

/** The day this post plays, read from its postData: no request needed to paint it. */
export function postData(): DailyPostData | null {
  const data = context.postData as Partial<DailyPostData> | undefined
  if (!data || typeof data.day !== 'string' || typeof data.lang !== 'string' || !Array.isArray(data.categories)) return null
  return { day: data.day, lang: data.lang, number: Number(data.number) || 0, categories: data.categories.map(String) }
}

/** The post's language: a post is one game for all its readers, whatever their own settings. */
export function postLocale(data: DailyPostData | null): Locale {
  return data && isLocale(data.lang) ? data.lang : 'en'
}
