import { bannedOf, bansAllowed, isPlus, revealBudget } from '../domain/perks'
import type { Profile } from '../domain/progression'
import { MAX_EQUIPPED, slotsOf } from '../domain/powers'
import { ownedCategoryIds } from '../domain/unlocks'
import { useT } from '../i18n'
import { todayKey } from '../lib/today'
import { ResourceChip } from './premium'

/**
 * What the player holds, one chip each — padlocks, the day's reveals, power
 * slots — the same chips the screens that spend them show. A Premium member's
 * go black and yellow: ∞ reveals, the six padlocks, and the slots as they are.
 */
export function CurrencyRow({ profile, day = todayKey(), title = false }: { profile: Profile; day?: string; title?: boolean }) {
  const t = useT()
  const plus = isPlus(profile)
  const allowed = bansAllowed(profile)
  const used = bannedOf(profile, ownedCategoryIds(profile)).length
  const reveals = revealBudget(profile, day)
  const slots = slotsOf(profile)

  return (
    <section className="currency-row" aria-label={t.currencies.title}>
      {title && <p className="section-title">{t.currencies.title}</p>}
      <div className="currency-chips">
        <ResourceChip
          icon="lock"
          count={used}
          max={allowed}
          premium={plus}
          state={allowed > 0 ? 'normal' : 'spent'}
          label={allowed > 0 ? t.currencies.filters(used, allowed) : t.currencies.filtersLocked}
        />
        <ResourceChip
          icon="eye"
          count={reveals.left}
          max={reveals.allowed}
          unlimited={reveals.unlimited}
          state={reveals.unlimited || reveals.left > 0 ? 'normal' : 'spent'}
          label={reveals.unlimited ? t.currencies.revealsPlus : t.currencies.reveals(reveals.left, reveals.allowed)}
        />
        <ResourceChip icon="slot" count={slots} max={MAX_EQUIPPED} label={t.currencies.slots(slots, MAX_EQUIPPED)} />
      </div>
    </section>
  )
}
