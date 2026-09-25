import { useState } from 'react'
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

/** The counts under a trophy or a word, always shown once someone reacted. */
export function ReactionCounts({ target, reactions }: { target: string; reactions: RecapReactions }) {
  const here = reactions.list.filter((reaction) => reaction.target === target)
  if (here.length === 0) return null
  return (
    <span className="reaction-counts">
      {REACTIONS.map((emoji) => {
        const count = here.filter((reaction) => reaction.emoji === emoji).length
        const mine = here.some((reaction) => reaction.emoji === emoji && reaction.playerId === reactions.myId)
        return count > 0 ? (
          <span key={emoji} className={`reaction-count${mine ? ' reaction-count--mine' : ''}`}>
            {emoji}
            <small>{count}</small>
          </span>
        ) : null
      })}
    </span>
  )
}

/** Unfolded under a trophy or a word: the palette, and who reacted with what. */
export function ReactionPanel({ target, reactions }: { target: string; reactions: RecapReactions }) {
  const t = useT()
  const here = reactions.list.filter((reaction) => reaction.target === target)
  const mine = here.find((reaction) => reaction.playerId === reactions.myId)?.emoji ?? null
  return (
    <div className="reaction-panel">
      {reactions.canReact && (
        <div className="reaction-palette" role="group" aria-label={t.challenge.reactLabel}>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`reaction-pick${mine === emoji ? ' reaction-pick--on' : ''}`}
              aria-pressed={mine === emoji}
              onClick={() => reactions.react(target, mine === emoji ? null : emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {here.length === 0 ? (
        <p className="note">{t.challenge.noReaction}</p>
      ) : (
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
