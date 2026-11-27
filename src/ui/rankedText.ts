import { waitHint } from '../domain/ranked'
import type { Messages } from '../i18n'

/** Une attente lue à la minute : « 0:42 », « 3:05 ». */
export function clockOf(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** L'attente estimée, dite comme un ordre de grandeur. */
export function estimateText(t: Messages, estimate: number | null): string {
  const hint = waitHint(estimate)
  if (hint.kind === 'seconds') return t.ranked.estimateSeconds(hint.value)
  if (hint.kind === 'minutes') return t.ranked.estimateMinutes(hint.value)
  if (hint.kind === 'long') return t.ranked.estimateLong
  return t.ranked.estimateUnknown
}
