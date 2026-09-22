import { useReducer } from 'react'
import { initialSession, sessionReducer } from './state/session'
import { FinalScreen } from './ui/FinalScreen'
import { RevealScreen } from './ui/RevealScreen'
import { RoundScreen } from './ui/RoundScreen'
import { SetupScreen } from './ui/SetupScreen'
import { TallyScreen } from './ui/TallyScreen'
import { WritingScreen } from './ui/WritingScreen'

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession)
  const { match } = session

  // The seed comes from the boundary, never from the domain: the rules stay
  // replayable, only the app decides which match is being dealt tonight.
  const newSeed = () => Date.now() >>> 0

  if (!match || session.phase === 'setup') {
    return (
      <main className="stage">
        <SetupScreen onStart={(players, settings) => dispatch({ type: 'start', seed: newSeed(), players, settings })} />
      </main>
    )
  }

  return (
    <main className="stage">
      {session.phase === 'reveal' && <RevealScreen match={match} onStart={() => dispatch({ type: 'go-writing' })} />}

      {session.phase === 'writing' && (
        <WritingScreen key={match.history.length} match={match} onDone={() => dispatch({ type: 'time-up' })} />
      )}

      {session.phase === 'tally' && (
        <TallyScreen
          match={match}
          sheet={session.sheet}
          index={session.tallyIndex}
          onWrite={(player, word) => dispatch({ type: 'write', player, category: session.tallyIndex, word })}
          onBack={() => dispatch({ type: 'tally-back' })}
          onForward={() => dispatch({ type: 'tally-forward' })}
        />
      )}

      {session.phase === 'round' && <RoundScreen match={match} onNext={() => dispatch({ type: 'next-round' })} />}

      {session.phase === 'final' && (
        <FinalScreen
          match={match}
          onRematch={() => dispatch({ type: 'rematch', seed: newSeed() })}
          onQuit={() => dispatch({ type: 'quit' })}
        />
      )}
    </main>
  )
}
