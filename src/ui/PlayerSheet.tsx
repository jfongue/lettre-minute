import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { blockPlayer, fetchFriends, requestFriend, type BlockOutcome, type FriendRequestOutcome } from '../lib/cloud'
import { Avatar } from './Avatar'

export interface PlayerActions {
  befriend(name: string): Promise<FriendRequestOutcome>
  block(name: string): Promise<BlockOutcome>
  /** The friend's id when that name is already a friend, null otherwise. */
  friendId(name: string): Promise<string | null>
  /** Opens a new challenge with that friend ticked; absent where none can start. */
  challenge?(friendId: string): void
}

async function friendIdOf(name: string): Promise<string | null> {
  const friends = await fetchFriends()
  const lower = name.toLowerCase()
  return friends?.find((friend) => friend.relation === 'friend' && friend.name.toLowerCase() === lower)?.id ?? null
}

export const DEFAULT_PLAYER_ACTIONS: PlayerActions = { befriend: requestFriend, block: blockPlayer, friendId: friendIdOf }

/** The app adds the way to a challenge; the debug board swaps in stand-ins, never writing to the server. */
export const PlayerActionsContext = createContext<PlayerActions>(DEFAULT_PLAYER_ACTIONS)

interface PlayerNameProps {
  name: string
  avatar: AvatarChoice
  className?: string
  children: ReactNode
}

/** A name on a board or in standings: a tap opens what one can do about that player. */
export function PlayerName({ name, avatar, className, children }: PlayerNameProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`player-link${className ? ` ${className}` : ''}`}
        aria-label={t.player.open(name)}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {/* Out of the list: an animated ancestor would pin the layer to itself instead of the window. */}
      {open && createPortal(<PlayerSheet name={name} avatar={avatar} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

type Step = 'idle' | 'confirm-block' | 'busy' | { said: string }

function PlayerSheet({ name, avatar, onClose }: { name: string; avatar: AvatarChoice; onClose(): void }) {
  const t = useT()
  const actions = useContext(PlayerActionsContext)
  const [step, setStep] = useState<Step>('idle')
  // Asked on opening: a friend is offered a challenge, not a request.
  const [friend, setFriend] = useState<string | null | 'loading'>('loading')
  useEffect(() => {
    let live = true
    actions.friendId(name).then((id) => live && setFriend(id))
    return () => {
      live = false
    }
  }, [actions, name])

  useEffect(() => {
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  const befriend = async () => {
    setStep('busy')
    const outcome = await actions.befriend(name)
    setStep({ said: t.social.requests[outcome](name) })
  }
  const block = async () => {
    setStep('busy')
    const outcome = await actions.block(name)
    setStep({ said: t.player.blocked[outcome](name) })
  }

  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="player-sheet-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop player-sheet">
        <Avatar choice={avatar} size="md" />
        <h2 id="player-sheet-title" className="offer-pop-title">
          {name}
        </h2>
        {step === 'confirm-block' ? (
          <>
            <p>{t.player.blockWarning(name)}</p>
            <div className="offer-pop-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setStep('idle')}>
                {t.cancel}
              </button>
              <button type="button" className="btn btn--red" onClick={block}>
                {t.player.blockConfirm}
              </button>
            </div>
          </>
        ) : typeof step === 'object' ? (
          <>
            <p>{step.said}</p>
            <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
              {t.player.close}
            </button>
          </>
        ) : (
          <div className="stack">
            {typeof friend === 'string' ? (
              actions.challenge && (
                <button
                  type="button"
                  className="btn btn--blue btn--block"
                  onClick={() => {
                    onClose()
                    actions.challenge!(friend)
                  }}
                >
                  {t.player.challenge}
                </button>
              )
            ) : (
              <button
                type="button"
                className="btn btn--blue btn--block"
                disabled={step === 'busy' || friend === 'loading'}
                onClick={befriend}
              >
                {step === 'busy' || friend === 'loading' ? t.wait : t.player.befriend}
              </button>
            )}
            <button
              type="button"
              className="btn btn--quiet btn--muted"
              disabled={step === 'busy'}
              onClick={() => setStep('confirm-block')}
            >
              {t.player.block}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
