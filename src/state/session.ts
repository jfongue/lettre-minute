import {
  createMatch,
  isOver,
  recordRound,
  type Match,
  type MatchSettings,
  type Player,
  type RoundAnswers,
} from '../domain'

export type Phase = 'setup' | 'reveal' | 'writing' | 'tally' | 'round' | 'final'

export interface Session {
  phase: Phase
  match: Match | null
  /** What the table dictates during the read-out: sheet[player][category]. */
  sheet: readonly (readonly string[])[]
  /** The category being read out — the tally goes through them one at a time. */
  tallyIndex: number
}

export type SessionAction =
  | { type: 'start'; seed: number; players: readonly Player[]; settings: MatchSettings }
  | { type: 'go-writing' }
  | { type: 'time-up' }
  | { type: 'write'; player: number; category: number; word: string }
  | { type: 'tally-back' }
  | { type: 'tally-forward' }
  | { type: 'next-round' }
  | { type: 'rematch'; seed: number }
  | { type: 'quit' }

export const initialSession: Session = { phase: 'setup', match: null, sheet: [], tallyIndex: 0 }

function blankSheet(match: Match): string[][] {
  return match.players.map(() => match.card.categories.map(() => ''))
}

function answersOf(match: Match, sheet: Session['sheet']): RoundAnswers[] {
  return match.players.map((player, index) => ({ playerId: player.id, words: sheet[index] ?? [] }))
}

export function sessionReducer(session: Session, action: SessionAction): Session {
  switch (action.type) {
    case 'start': {
      const match = createMatch({ seed: action.seed, players: action.players, settings: action.settings })
      return { phase: 'reveal', match, sheet: blankSheet(match), tallyIndex: 0 }
    }

    case 'go-writing':
      return { ...session, phase: 'writing' }

    case 'time-up':
      return { ...session, phase: 'tally', tallyIndex: 0 }

    case 'write': {
      const sheet = session.sheet.map((words, index) =>
        index === action.player ? words.map((word, at) => (at === action.category ? action.word : word)) : words,
      )
      return { ...session, sheet }
    }

    case 'tally-back':
      if (session.tallyIndex === 0) return { ...session, phase: 'writing' }
      return { ...session, tallyIndex: session.tallyIndex - 1 }

    case 'tally-forward': {
      if (!session.match) return session
      const last = session.match.card.categories.length - 1
      if (session.tallyIndex < last) return { ...session, tallyIndex: session.tallyIndex + 1 }
      return { ...session, phase: 'round', match: recordRound(session.match, answersOf(session.match, session.sheet)) }
    }

    case 'next-round': {
      if (!session.match) return session
      if (isOver(session.match)) return { ...session, phase: 'final' }
      return { ...session, phase: 'reveal', sheet: blankSheet(session.match), tallyIndex: 0 }
    }

    case 'rematch': {
      if (!session.match) return session
      const match = createMatch({
        seed: action.seed,
        players: session.match.players,
        settings: session.match.settings,
      })
      return { phase: 'reveal', match, sheet: blankSheet(match), tallyIndex: 0 }
    }

    case 'quit':
      return initialSession
  }
}
