import { useEffect, type CSSProperties } from 'react'
import { PLUS_STATS, plusStat, type PlusStat } from '../domain/perks'
import type { Profile } from '../domain/progression'
import { formatNumber, useT } from '../i18n'
import { sound } from '../lib/sound'
import { PlusSeal, ResourceGlyph, type ResourceIcon } from './premium'
import { useCountUp } from './useCountUp'

const ICON: Record<PlusStat, ResourceIcon> = {
  reveals: 'eye',
  attempts: 'ticket',
  filterRuns: 'lock',
  premiereRuns: 'premiere',
  adsSkipped: 'noads',
}

function Counter({ stat, value, index }: { stat: PlusStat; value: number; index: number }) {
  const t = useT()
  const shown = useCountUp(value, 1100, 0, 250 + index * 120)
  return (
    <li className="ppage-counter" style={{ '--i': index } as CSSProperties}>
      <ResourceGlyph icon={ICON[stat]} plus size={28} />
      <strong className="ppage-count">{formatNumber(t, shown)}</strong>
      <span className="ppage-label">{t.premiumPage.counters[stat]}</span>
    </li>
  )
}

/** The page a Premium member opens from the menu: what it gave them, counted, and a thank-you. */
export function PremiumPage({ profile }: { profile: Profile }) {
  const t = useT()
  useEffect(() => sound.plus(), [])
  const date = new Date(profile.plusSince).toLocaleDateString(t.tag, { day: 'numeric', month: 'long', year: 'numeric' })
  const empty = PLUS_STATS.every((stat) => plusStat(profile, stat) === 0)

  return (
    <div className="ppage cascade">
      <header className="ppage-head">
        <PlusSeal size="lg" animated />
        <div className="ppage-heading">
          <h2>{t.premium.title}</h2>
          <p className="ppage-since">{profile.plusSince > 0 ? t.premiumPage.since(date) : t.premium.lifetime}</p>
        </div>
      </header>
      <p className="note">{t.premiumPage.lead}</p>
      <ul className="ppage-counters">
        {PLUS_STATS.map((stat, index) => (
          <Counter key={stat} stat={stat} value={plusStat(profile, stat)} index={index} />
        ))}
      </ul>
      {empty && <p className="note ppage-empty">{t.premiumPage.empty}</p>}
      <ul className="ppage-lines">
        <li>
          <ResourceGlyph icon="forever" plus size={22} />
          <span>{t.premiumPage.forever}</span>
        </li>
        <li>
          <ResourceGlyph icon="heart" plus size={22} />
          <span>{t.premiumPage.indie}</span>
        </li>
      </ul>
    </div>
  )
}
