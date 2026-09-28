import { useEffect, useState } from 'react'
import { sharedPlayers, type SharedChallenge } from '../domain/rivalry'
import { fetchChallenge, fetchFriendChallenges } from '../lib/cloud'
import { withBotRuns } from './botRuns'

const SHARED_KEY = 'lettre-minute.shared-challenges.v1'
const SHARED_KEPT = 300

/**
 * Closed challenges, settled on this device: a bot's run exists only replayed
 * from the seed, so the server can rank nobody. A closed one no longer moves,
 * and is fetched and replayed once.
 */
function loadShared(): Record<string, SharedChallenge> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(SHARED_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
    return Object.fromEntries(
      Object.entries(stored).filter(
        ([, challenge]) => challenge && typeof challenge === 'object' && Array.isArray((challenge as SharedChallenge).players),
      ),
    ) as Record<string, SharedChallenge>
  } catch {
    return {}
  }
}

function keepShared(challenge: SharedChallenge): void {
  const kept = Object.entries({ ...loadShared(), [challenge.id]: challenge }).slice(-SHARED_KEPT)
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify(Object.fromEntries(kept)))
  } catch {
    /* settled again next time */
  }
}

async function sharedChallenge(id: string): Promise<SharedChallenge | null> {
  const fetched = await fetchChallenge(id)
  if (!fetched) return null
  const detail = await withBotRuns(fetched)
  const challenge: SharedChallenge = {
    id: detail.id,
    name: detail.name,
    ownerName: detail.ownerName,
    owned: detail.owned,
    createdAt: detail.createdAt,
    finished: detail.finished,
    players: sharedPlayers(detail.players, detail.finished),
  }
  if (challenge.finished) keepShared(challenge)
  return challenge
}

export interface FriendHistory {
  /** Friend id → the challenges shared with them, newest first. */
  byFriend: Readonly<Record<string, readonly string[]>>
  challenges: Readonly<Record<string, SharedChallenge>>
  /** False while challenges are still being fetched and settled. */
  complete: boolean
}

/**
 * Every friend's shared challenges, filled in as they are settled — one at a
 * time, newest first, to spare the server a burst of calls. Null offline.
 */
export function useFriendHistory(enabled: boolean): FriendHistory | null {
  const [history, setHistory] = useState<FriendHistory | null>(null)

  useEffect(() => {
    if (!enabled) return
    let live = true
    ;(async () => {
      const rows = await fetchFriendChallenges()
      if (!live || !rows) return
      const byFriend: Record<string, string[]> = {}
      for (const row of rows) (byFriend[row.friendId] ??= []).push(row.challengeId)
      const cached = loadShared()
      const challenges: Record<string, SharedChallenge> = {}
      const missing: string[] = []
      for (const id of new Set(rows.map((row) => row.challengeId))) {
        if (cached[id]) challenges[id] = cached[id]
        else missing.push(id)
      }
      setHistory({ byFriend, challenges: { ...challenges }, complete: missing.length === 0 })
      for (const [at, id] of missing.entries()) {
        const challenge = await sharedChallenge(id)
        if (!live) return
        if (challenge) challenges[id] = challenge
        setHistory({ byFriend, challenges: { ...challenges }, complete: at === missing.length - 1 })
      }
    })()
    return () => {
      live = false
    }
  }, [enabled])

  return history
}
