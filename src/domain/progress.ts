import type { Profile } from './progression'

/*
 * La sauvegarde cloud : ce que le profil garde sur l'appareil seul et que le
 * serveur ne recompte pas depuis les parties — catégories et pouvoirs choisis,
 * offres en cours, bans, Premium. Les totaux (XP, parties, record…) viennent
 * déjà du compte ; `runs` n'est ici que pour savoir quelle copie a joué en
 * dernier.
 *
 * Deux copies se fusionnent sans jamais reprendre un choix : ce qui a été
 * gagné sur un appareil reste gagné sur l'autre.
 */

const OWNED = ['unlocked', 'gifted', 'powers', 'powersUsed', 'playedCategories'] as const
const LATEST = ['offer', 'lastOffer', 'powerOffer', 'lastPowerOffer', 'equipped', 'banned'] as const
const HIGHEST = ['banIntroSeen', 'peeks', 'plusThanked', 'supportAskedAt', 'feedbackAskedAt', 'longestWord', 'bestSpeed', 'cleanRuns', 'duelRounds4', 'dailyFirst', 'wordsReviewed'] as const

type ListField = (typeof OWNED)[number] | (typeof LATEST)[number]
type CountField = (typeof HIGHEST)[number] | 'plusSince' | 'runs'

export type Progress = Pick<Profile, ListField | CountField>

export function progressOf(profile: Profile): Progress {
  const progress: Record<string, unknown> = { runs: profile.runs, plusSince: profile.plusSince }
  for (const field of [...OWNED, ...LATEST]) progress[field] = [...profile[field]]
  for (const field of HIGHEST) progress[field] = profile[field]
  return progress as Progress
}

/** Ce que le serveur rend, où n'importe quoi a pu être écrit : null si ce n'est pas une sauvegarde. */
export function parseProgress(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const stored = raw as Record<string, unknown>
  const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0)
  const progress: Record<string, unknown> = { runs: count(stored.runs), plusSince: count(stored.plusSince) }
  for (const field of [...OWNED, ...LATEST]) {
    const value = stored[field]
    progress[field] = Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
  }
  for (const field of HIGHEST) progress[field] = count(stored[field])
  return progress as Progress
}

const union = (first: readonly string[], second: readonly string[]) => [...new Set([...first, ...second])]

/**
 * Le profil de l'appareil, enrichi de la sauvegarde. Ce qui se possède
 * (catégories, pouvoirs) s'additionne ; ce qui est en cours (offres, pouvoirs
 * portés, bans) vient de la copie qui a le plus joué, sans ce que l'autre a
 * déjà choisi ; Premium date de la première fois.
 */
export function withProgress(local: Profile, saved: Progress): Profile {
  const latest = saved.runs > local.runs ? saved : local
  const unlocked = union(local.unlocked, saved.unlocked)
  const gifted = union(local.gifted, saved.gifted).filter((id) => !unlocked.includes(id))
  const powers = union(local.powers, saved.powers)
  const owned = new Set([...unlocked, ...gifted])
  const merged: Profile = {
    ...local,
    unlocked,
    gifted,
    powers,
    offer: latest.offer.filter((id) => !owned.has(id)),
    lastOffer: [...latest.lastOffer],
    powerOffer: latest.powerOffer.filter((id) => !powers.includes(id)),
    lastPowerOffer: [...latest.lastPowerOffer],
    equipped: latest.equipped.filter((id) => powers.includes(id)),
    banned: [...latest.banned],
    plusSince: local.plusSince && saved.plusSince ? Math.min(local.plusSince, saved.plusSince) : local.plusSince || saved.plusSince,
  }
  for (const field of HIGHEST) merged[field] = Math.max(local[field], saved[field])
  return merged
}
