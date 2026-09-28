import { lazy, type ComponentType } from 'react'

/**
 * A screen kept out of the first bundle, with a `preload` the app calls while
 * the home screen idles, or before the phase that needs it: a screen fetched
 * only as it is shown would leave a blank frame between two phases.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyScreen<C extends ComponentType<any>>(load: () => Promise<C>) {
  let pending: Promise<C> | null = null
  const preload = () => (pending ??= load().catch((error: unknown) => {
    // A failed fetch (an update swapped the chunks) may be retried at the next need.
    pending = null
    throw error
  }))
  return Object.assign(lazy(() => preload().then((component) => ({ default: component }))), { preload })
}
