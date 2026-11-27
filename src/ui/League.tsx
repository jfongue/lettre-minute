import type { LeagueId } from '../domain/ranked'
import { PLACEMENT_GAMES, standing } from '../domain/ranked'
import { formatNumber, useT } from '../i18n'
import { Shape } from './bauhaus'
import type { ShapeKind, Tint } from './motifs'

/**
 * Chaque ligue a sa forme, de la plus simple à la plus taillée, et sa couleur
 * de la palette : la forme se lit à côté du nom, jamais derrière.
 */
export const LEAGUE_MARKS: Readonly<Record<LeagueId, { kind: ShapeKind; tint: Tint }>> = {
  bronze: { kind: 'triangle', tint: 'red' },
  silver: { kind: 'square', tint: 'ink' },
  gold: { kind: 'circle', tint: 'yellow' },
  platinum: { kind: 'hexagon', tint: 'green' },
  diamond: { kind: 'diamond', tint: 'blue' },
}

/** La forme d'une ligue, ou le cadre vide des placements. */
export function LeagueMark({ league, className = '' }: { league: LeagueId | null; className?: string }) {
  const mark = league ? LEAGUE_MARKS[league] : { kind: 'frame' as const, tint: 'ink' as const }
  return <Shape kind={mark.kind} tint={mark.tint} className={`league-mark ${className}`} />
}

/**
 * La ligue d'un joueur et son Elo, en une étiquette : « Or · 1 142 », ou
 * « Placement 2/5 » tant qu'elle n'est pas jouée.
 */
export function LeagueChip({ rating, games, compact = false, points = true }: { rating: number; games: number; compact?: boolean; points?: boolean }) {
  const t = useT()
  const { league, placed } = standing({ rating, games })
  return (
    <span className={`league-chip${league ? ` league-chip--${league}` : ' league-chip--placement'}${compact ? ' league-chip--compact' : ''}`}>
      <LeagueMark league={league} />
      <b>{league ? t.ranked.leagues[league] : t.ranked.placement(placed, PLACEMENT_GAMES)}</b>
      {league && points ? <span className="league-chip__points">{formatNumber(t, rating)}</span> : null}
    </span>
  )
}
