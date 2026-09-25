import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useT } from '../i18n'
import { REACTIONS, type Reaction, type ReactionEmoji } from '../lib/cloud'

/** What the recap's trophies and words share: the reactions so far, and the way to add one. */
export interface RecapReactions {
  list: readonly Reaction[]
  myId: string | undefined
  /** Only a player who played reacts: the others have not seen the words. */
  canReact: boolean
  name(playerId: string): string
  react(target: string, emoji: ReactionEmoji | null): void
}

/**
 * Optimistic: the tap shows at once, and a refusal from the server puts the
 * list back as it was.
 */
export function useRecapReactions(
  initial: readonly Reaction[],
  myId: string | undefined,
  canReact: boolean,
  name: (playerId: string) => string,
  send: (target: string, emoji: ReactionEmoji | null) => Promise<boolean>,
): RecapReactions {
  const [list, setList] = useState(initial)
  return {
    list,
    myId,
    canReact,
    name,
    react(target, emoji) {
      if (!myId) return
      const before = list
      const others = list.filter((reaction) => !(reaction.target === target && reaction.playerId === myId))
      setList(emoji ? [...others, { target, emoji, playerId: myId }] : others)
      send(target, emoji).then((ok) => ok || setList(before))
    },
  }
}

type Open = 'menu' | 'people' | null

/**
 * A trophy or a word one reacts to as in a chat app: a tap raises a small bar
 * of emojis above it, the reactions sit in a bubble on its corner, and a tap
 * on the bubble tells who reacted with what.
 */
export function Reactable({
  target,
  reactions,
  className,
  children,
}: {
  target: string
  reactions: RecapReactions
  className?: string
  children: ReactNode
}) {
  const t = useT()
  const [open, setOpen] = useState<Open>(null)
  const box = useRef<HTMLDivElement>(null)
  const here = reactions.list.filter((reaction) => reaction.target === target)
  const mine = here.find((reaction) => reaction.playerId === reactions.myId)?.emoji ?? null

  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(null)
    }
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(null)
    document.addEventListener('pointerdown', away)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  const tap = () => setOpen(open ? null : reactions.canReact ? 'menu' : here.length > 0 ? 'people' : null)

  return (
    <div ref={box} className={`reactable${open ? ' reactable--open' : ''}${className ? ` ${className}` : ''}`}>
      <button type="button" className="reactable-body" aria-haspopup="true" aria-expanded={open === 'menu'} onClick={tap}>
        {children}
      </button>
      {here.length > 0 && (
        <button
          type="button"
          className="reaction-bubble"
          aria-label={t.challenge.reactLabel}
          onClick={() => setOpen(open === 'people' ? null : 'people')}
        >
          {REACTIONS.filter((emoji) => here.some((reaction) => reaction.emoji === emoji)).map((emoji) => (
            <span key={emoji}>{emoji}</span>
          ))}
          {here.length > 1 && <small>{here.length}</small>}
        </button>
      )}
      {open === 'menu' && (
        <div className="reaction-menu" role="menu" aria-label={t.challenge.reactLabel}>
          {REACTIONS.map((emoji, index) => (
            <button
              key={emoji}
              type="button"
              role="menuitemradio"
              aria-checked={mine === emoji}
              className={`reaction-pick${mine === emoji ? ' reaction-pick--on' : ''}`}
              style={{ '--i': index } as CSSProperties}
              onClick={() => {
                reactions.react(target, mine === emoji ? null : emoji)
                setOpen(null)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {open === 'people' && (
        <ul className="reaction-people">
          {here.map((reaction) => (
            <li key={reaction.playerId}>
              <span aria-hidden="true">{reaction.emoji}</span>
              {reaction.playerId === reactions.myId ? t.challenge.you : reactions.name(reaction.playerId)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
