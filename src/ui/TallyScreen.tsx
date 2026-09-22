import { useEffect, useRef } from 'react'
import type { Match } from '../domain'

interface TallyScreenProps {
  match: Match
  sheet: readonly (readonly string[])[]
  index: number
  onWrite(player: number, word: string): void
  onBack(): void
  onForward(): void
}

export function TallyScreen({ match, sheet, index, onWrite, onBack, onForward }: TallyScreenProps) {
  const first = useRef<HTMLInputElement>(null)
  const category = match.card.categories[index]
  const last = index === match.card.categories.length - 1

  useEffect(() => {
    first.current?.focus()
  }, [index])

  return (
    <div className="sheet">
      <div className="spread">
        <p className="eyebrow">Dépouillement</p>
        <p className="eyebrow">
          {index + 1} / {match.card.categories.length}
        </p>
      </div>

      <div className="row">
        <span className="letter-chip">{match.card.letter}</span>
        <h2 className="serif" style={{ fontSize: 'clamp(1.4rem, 6vw, 1.9rem)', lineHeight: 1.1 }}>
          {category?.label}
        </h2>
      </div>

      <section className="card tally" key={index}>
        {match.players.map((player, playerIndex) => (
          <div className="field" key={player.id}>
            <label htmlFor={`answer-${player.id}`}>{player.name}</label>
            <input
              id={`answer-${player.id}`}
              ref={playerIndex === 0 ? first : undefined}
              value={sheet[playerIndex]?.[index] ?? ''}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              placeholder="rien écrit"
              onChange={(event) => onWrite(playerIndex, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onForward()
              }}
            />
          </div>
        ))}
      </section>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Retour
        </button>
        <button type="button" className="btn" onClick={onForward}>
          {last ? 'Compter les points' : 'Catégorie suivante'}
        </button>
      </div>
      <p className="note">
        Chacun lit sa réponse à voix haute. Les mots identiques valent moins : la table le découvre à l’écran
        suivant.
      </p>
    </div>
  )
}
