import type { LeagueId, Tier } from '../domain/ranked'
import { PLACEMENT_GAMES, standing } from '../domain/ranked'
import { useT, type Messages } from '../i18n'
import { Shape } from './bauhaus'
import type { ShapeKind, Tint } from './motifs'

/**
 * Chaque ligue a sa forme, de la plus simple à la plus taillée, et sa couleur
 * de la palette : la forme se lit à côté du nom, jamais derrière. Le Maître a
 * l'étoile.
 */
export const LEAGUE_MARKS: Readonly<Record<LeagueId | 'master', { kind: ShapeKind; tint: Tint }>> = {
  bronze: { kind: 'triangle', tint: 'red' },
  silver: { kind: 'square', tint: 'ink' },
  gold: { kind: 'circle', tint: 'yellow' },
  platinum: { kind: 'hexagon', tint: 'green' },
  diamond: { kind: 'diamond', tint: 'blue' },
  master: { kind: 'star', tint: 'pink' },
}

const ROMAN = ['', 'I', 'II', 'III'] as const

/** Le rang en toutes lettres : « Or II », « Maître n° 3 », « Placement 1/3 ». */
export function tierText(t: Messages, tier: Tier): string {
  if (tier.kind === 'placement') return t.ranked.placement(tier.placed, PLACEMENT_GAMES)
  if (tier.kind === 'master') return t.ranked.master(tier.spot)
  return t.ranked.division(t.ranked.leagues[tier.league], ROMAN[tier.division])
}

/** La forme d'un rang, ou le cadre vide des placements. */
export function TierMark({ tier, className = '' }: { tier: Tier; className?: string }) {
  const mark = tier.kind === 'placement' ? { kind: 'frame' as const, tint: 'ink' as const } : LEAGUE_MARKS[tier.kind === 'master' ? 'master' : tier.league]
  return <Shape kind={mark.kind} tint={mark.tint} className={`league-mark ${className}`} />
}

/** La forme d'une ligue seule, sans division : le lien du classement. */
export function LeagueMark({ league, className = '' }: { league: LeagueId; className?: string }) {
  const mark = LEAGUE_MARKS[league]
  return <Shape kind={mark.kind} tint={mark.tint} className={`league-mark ${className}`} />
}

/**
 * Le rang d'un joueur en une étiquette — jamais son Elo, qui reste le calcul
 * du serveur : « Or II », « Maître n° 3 », ou « Placement 1/3 ».
 */
export function LeagueChip({
  rating,
  games,
  rank = null,
  compact = false,
  short = false,
}: {
  rating: number
  games: number
  rank?: number | null
  compact?: boolean
  /** Dans une liste qui dit déjà la place : « Maître » sans son numéro. */
  short?: boolean
}) {
  const t = useT()
  const { tier } = standing({ rating, games }, rank)
  const kind = tier.kind === 'league' ? tier.league : tier.kind
  return (
    <span className={`league-chip league-chip--${kind}${compact ? ' league-chip--compact' : ''}`}>
      <TierMark tier={tier} />
      <b>{short && tier.kind === 'master' ? t.ranked.masterShort : tierText(t, tier)}</b>
    </span>
  )
}
