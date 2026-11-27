import { useEffect, useState } from 'react'
import { fetchDuelBadges, type DuelRatingInfo } from '../lib/cloud'
import { useFeature } from './features'

/**
 * Les rangs de duel classé des noms qu'un classement montre, gardés le temps
 * d'une visite : changer d'onglet ou de période ne redemande que les noms
 * nouveaux. Rien quand le duel n'est pas ouvert au joueur.
 */
const known = new Map<string, DuelRatingInfo | null>()
let askedAt = 0
const KEEP_MS = 5 * 60_000

export type BadgeLoader = typeof fetchDuelBadges

export function useDuelBadges(names: readonly string[], load: BadgeLoader = fetchDuelBadges): ReadonlyMap<string, DuelRatingInfo> {
  const open = useFeature('duel')
  const [, setTick] = useState(0)
  const key = names.join('\u0000')
  useEffect(() => {
    if (!open || names.length === 0) return
    if (Date.now() - askedAt > KEEP_MS) known.clear()
    const missing = names.filter((name) => !known.has(name))
    if (missing.length === 0) return
    let live = true
    askedAt = Date.now()
    void load(missing).then((found) => {
      if (!found) return
      for (const name of missing) known.set(name, found.get(name) ?? null)
      if (live) setTick((n) => n + 1)
    })
    return () => {
      live = false
    }
    // Les noms sont lus par leur clé : un nouveau tableau aux mêmes noms ne redemande rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, load, open])
  const out = new Map<string, DuelRatingInfo>()
  if (!open) return out
  for (const name of names) {
    const badge = known.get(name)
    if (badge) out.set(name, badge)
  }
  return out
}
