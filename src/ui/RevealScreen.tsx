import { roundNumber, type Match } from '../domain'

interface RevealScreenProps {
  match: Match
  onStart(): void
}

export function RevealScreen({ match, onStart }: RevealScreenProps) {
  return (
    <div className="sheet">
      <div className="spread">
        <p className="eyebrow">
          Manche {roundNumber(match)} sur {match.settings.rounds}
        </p>
        <p className="eyebrow">{match.settings.seconds} secondes</p>
      </div>

      <section className="card stack">
        <p className="letter enter-letter" aria-label={`Lettre ${match.card.letter}`}>
          {match.card.letter}
        </p>
        <ul className="categories">
          {match.card.categories.map((category, index) => (
            <li key={category.id} className="enter" style={{ animationDelay: `${260 + index * 110}ms` }}>
              <span className="index">{String(index + 1).padStart(2, '0')}</span>
              {category.label}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="btn btn--block enter" style={{ animationDelay: '600ms' }} onClick={onStart}>
        Top départ
      </button>
      <p className="note enter" style={{ animationDelay: '700ms' }}>
        Un mot par catégorie, commençant par {match.card.letter}. Stylos prêts.
      </p>
    </div>
  )
}
