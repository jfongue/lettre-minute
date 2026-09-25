const KEY = 'lettre-minute.push-offer.v1'

/** Friends counted when the game last offered notifications, on this device. */
function offeredAt(): number {
  try {
    const stored = Number(localStorage.getItem(KEY))
    return Number.isFinite(stored) ? stored : 0
  } catch {
    return 0
  }
}

/**
 * The phone's question is asked only after a new friendship, never on
 * opening: until then there is nobody to send a challenge. A « no » waits
 * for the next friend rather than for the next launch.
 */
export function pushOfferDue(friends: number): boolean {
  return friends > offeredAt()
}

export function markPushOffered(friends: number): void {
  try {
    localStorage.setItem(KEY, String(friends))
  } catch {
    /* offered again at the next friend list */
  }
}
