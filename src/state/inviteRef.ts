/**
 * The code of whoever invited this device (`my_invite_code`, 0034), kept
 * until an account with a name can cash it: the invitee often installs, plays
 * a first game anonymously, and only then creates the account that befriends
 * the inviter.
 */
const KEY = 'invite-ref'
const CODE = /^[0-9a-f]{12}$/

export function loadInviteRef(): string | null {
  try {
    const ref = localStorage.getItem(KEY)
    return ref && CODE.test(ref) ? ref : null
  } catch {
    return null
  }
}

/** Keeps a code arrived by any way; resolves to it when well formed. */
export function keepInviteRef(ref: string | null | undefined): string | null {
  if (!ref || !CODE.test(ref)) return null
  try {
    localStorage.setItem(KEY, ref)
  } catch {
    // Lost with the storage: the invitee adds the inviter by name instead.
  }
  return ref
}

export function clearInviteRef(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing kept, nothing to forget.
  }
}

/** The web version's `?ref=`, taken off the address once kept. */
export function takeAddressRef(): void {
  const query = new URLSearchParams(window.location.search)
  if (!keepInviteRef(query.get('ref'))) return
  query.delete('ref')
  const rest = query.toString()
  window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash)
}

/** A code inside a Play referrer or an address: `ref=…` in its query. */
export function refIn(text: string): string | null {
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text
  const ref = new URLSearchParams(query).get('ref')
  return ref && CODE.test(ref) ? ref : null
}
