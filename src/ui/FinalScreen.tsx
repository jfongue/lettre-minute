import { standings, type Match } from '../domain'

interface FinalScreenProps {
  match: Match
  onRematch(): void
  onQuit(): void
}

export function FinalScreen({ match, onRematch, onQuit }: FinalScreenProps) {
  const board = standings(match)
  const winners = board.filter((entry) => entry.rank === 1)

  return (
    <div className="sheet enter">
      <p className="eyebrow">Fin de partie · {match.settings.rounds} manches</p>
      <h1 className="title">
        {winners.length === 1 ? `${winners[0]!.player.name} l’emporte` : 'Égalité parfaite'}
      </h1>

      <section className="card">
        <div className="standings">
          {board.map((entry) => (
            <div className={`standing${entry.rank === 1 ? ' standing--leader' : ''}`} key={entry.player.id}>
              <span className="rank">{entry.rank}</span>
              <span className="name">{entry.player.name}</span>
              <span className="points">{entry.points}</span>
            </div>
          ))}
        </div>
      </section>

      <button type="button" className="btn btn--block" onClick={onRematch}>
        Revanche
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={onQuit}>
        Changer de joueurs
      </button>
    </div>
  )
}
