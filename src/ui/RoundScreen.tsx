import { isOver, standings, type AnswerStatus, type Match } from '../domain'

const STATUS_LABEL: Record<AnswerStatus, string> = {
  unique: 'personne d’autre',
  shared: 'en double',
  'wrong-letter': 'mauvaise lettre',
  blank: 'rien écrit',
}

interface RoundScreenProps {
  match: Match
  onNext(): void
}

export function RoundScreen({ match, onNext }: RoundScreenProps) {
  const round = match.history[match.history.length - 1]
  if (!round) return null

  const nameOf = (playerId: string) => match.players.find((player) => player.id === playerId)?.name ?? playerId

  return (
    <div className="sheet sheet--wide">
      <div className="spread">
        <p className="eyebrow">
          Manche {match.history.length} sur {match.settings.rounds}
        </p>
        <p className="eyebrow">Lettre {round.card.letter}</p>
      </div>

      {round.card.categories.map((category, index) => (
        <section className="card enter" key={category.id} style={{ animationDelay: `${index * 120}ms` }}>
          <h3 className="serif" style={{ fontSize: '1.15rem', marginBottom: '0.4rem' }}>
            {category.label}
          </h3>
          {round.scores.map((score) => {
            const answer = score.answers[index]
            if (!answer) return null
            return (
              <div className="answer-row" key={score.playerId}>
                <div>
                  <p className="note">{nameOf(score.playerId)}</p>
                  <p className={`word word--${answer.status}`}>{answer.word}</p>
                </div>
                <span className="points">
                  {answer.points > 0 ? `+${answer.points}` : '0'} · {STATUS_LABEL[answer.status]}
                </span>
              </div>
            )
          })}
        </section>
      ))}

      <section className="card">
        <p className="eyebrow">Total après cette manche</p>
        <div className="standings">
          {standings(match).map((entry) => {
            const scored = round.scores.find((score) => score.playerId === entry.player.id)
            return (
              <div className={`standing${entry.rank === 1 ? ' standing--leader' : ''}`} key={entry.player.id}>
                <span className="rank">{entry.rank}</span>
                <span className="name">
                  {entry.player.name}
                  {scored?.bonus ? <span className="note"> · carton plein</span> : null}
                </span>
                <span className="points">
                  {entry.points}
                  <span className="note"> (+{scored?.total ?? 0})</span>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <button type="button" className="btn btn--block" onClick={onNext}>
        {isOver(match) ? 'Classement final' : 'Manche suivante'}
      </button>
    </div>
  )
}
