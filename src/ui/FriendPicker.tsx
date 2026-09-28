import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { fetchFriends, type Friend } from '../lib/cloud'
import { useT } from '../i18n'
import { Avatar } from './Avatar'

interface FriendPickerProps {
  title: string
  lead?: string
  /** Friends already in: not offered again. */
  exclude: readonly string[]
  max: number
  busy: boolean
  message: string | null
  confirmLabel(count: number): string
  onConfirm(ids: readonly string[]): void
  onClose(): void
  /** Shown above the friends: the new challenge's own rules. */
  children?: ReactNode
  /** Ticked on opening: the friend a challenge was started from. */
  initial?: readonly string[]
}

/** Friends to tick, up to `max`: who a challenge goes to. */
export function FriendPicker({ title, lead, exclude, max, busy, message, confirmLabel, onConfirm, onClose, children, initial = [] }: FriendPickerProps) {
  const t = useT()
  const [friends, setFriends] = useState<Friend[] | null | 'loading'>('loading')
  const [picked, setPicked] = useState<readonly string[]>(initial)

  useEffect(() => {
    fetchFriends().then(setFriends)
  }, [])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  const list =
    friends === 'loading' || friends === null
      ? []
      : friends.filter((friend) => friend.relation === 'friend' && !exclude.includes(friend.id))
  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : current.length < max ? [...current, id] : current,
    )

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="friend-picker-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className={`offer-pop friend-picker${children ? ' friend-picker--setup' : ''}`}>
        <h2 id="friend-picker-title" className="offer-pop-title">
          {title}
        </h2>
        {lead && <p className="note">{lead}</p>}
        {children}
        {friends === 'loading' && <p className="note">{t.loading}</p>}
        {friends === null && <p className="note note--warn">{t.social.loadFailed}</p>}
        {friends !== 'loading' && friends !== null && list.length === 0 && <p className="note">{t.challenge.noFriends}</p>}
        {list.length > 0 && (
          <ul className="friend-picks">
            {list.map((friend, index) => {
              const on = picked.includes(friend.id)
              return (
                <li key={friend.id} style={{ '--i': index } as CSSProperties}>
                  <button
                    type="button"
                    className={`friend-pick${on ? ' friend-pick--on' : ''}`}
                    aria-pressed={on}
                    disabled={!on && picked.length >= max}
                    onClick={() => toggle(friend.id)}
                  >
                    <Avatar choice={friend.avatar} size="sm" />
                    <span className="friend-name">{friend.name}</span>
                    <span className="friend-pick-box" aria-hidden="true">
                      {on ? '✓' : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {list.length > 0 && (
          <p className="note">
            {picked.length} / {max}
            {picked.length >= max && ` · ${t.challenge.full(max)}`}
          </p>
        )}
        {message && <p className="note note--warn">{message}</p>}
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="btn btn--blue"
            disabled={busy || picked.length === 0}
            onClick={() => onConfirm(picked)}
          >
            {busy ? t.wait : picked.length === 0 ? t.challenge.pickFirst : confirmLabel(picked.length)}
          </button>
        </div>
      </div>
    </div>
  )
}
