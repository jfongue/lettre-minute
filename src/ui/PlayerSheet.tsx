import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { blockPlayer, requestFriend, type BlockOutcome, type FriendRequestOutcome } from '../lib/cloud'
import { Avatar } from './Avatar'

export interface PlayerActions {
  befriend(name: string): Promise<FriendRequestOutcome>
  block(name: string): Promise<BlockOutcome>
}

/** The debug board swaps in stand-ins: it never writes to the server. */
export const PlayerActionsContext = createContext<PlayerActions>({ befriend: requestFriend, block: blockPlayer })

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
            <button type="button" className="btn btn--blue btn--block" disabled={step === 'busy'} onClick={befriend}>
              {step === 'busy' ? t.wait : t.player.befriend}
            </button>
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
