import { useCountdown } from '../state/useCountdown'
import type { Match } from '../domain'

const URGENT_FROM = 10

interface WritingScreenProps {
  match: Match
  onDone(): void
}

export function WritingScreen({ match, onDone }: WritingScreenProps) {
  const { remaining, elapsedRatio, paused, toggle } = useCountdown(match.settings.seconds, onDone)
  const urgent = remaining <= URGENT_FROM

  return (
    <div className="sheet">
      <div className="row">
        <span className="letter-chip">{match.card.letter}</span>
        <p className="note" style={{ flex: 1 }}>
          {match.card.categories.map((category) => category.label).join(' · ')}
        </p>
      </div>

      <div className="stack">
        <p className={`timer${urgent && !paused ? ' timer--urgent' : ''}`} aria-live="off">
          {Math.ceil(remaining)}
        </p>
        <div className={`progress${urgent ? ' progress--urgent' : ''}`}>
          <span style={{ transform: `scaleX(${1 - elapsedRatio})` }} />
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="btn btn--ghost" onClick={toggle}>
          {paused ? 'Reprendre' : 'Pause'}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Stylos en l’air
        </button>
      </div>
    </div>
  )
}
