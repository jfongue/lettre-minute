import type { Props } from './track'

/**
 * A feature the player used, for the owner's dashboard. Kept apart from
 * `track.ts` so a screen shared with Reddit can report one without pulling the
 * Supabase client into the post: `startTracking` plugs the real sink in, and
 * until it does — on a host that never tracks — the event is simply dropped.
 */
let sink: ((name: string, props: Props) => void) | null = null

export function setFeatureSink(next: (name: string, props: Props) => void): void {
  sink = next
}

export function trackFeature(name: string, props: Props = {}): void {
  sink?.(name, props)
}
