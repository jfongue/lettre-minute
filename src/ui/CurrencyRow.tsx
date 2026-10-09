import { useState, type ReactNode } from 'react'
import { bannedOf, bansAllowed, isPlus, revealBudget } from '../domain/perks'
import type { Profile } from '../domain/progression'
import { MAX_EQUIPPED, slotsOf } from '../domain/powers'
import { ownedCategoryIds } from '../domain/unlocks'
import { useT } from '../i18n'
import { todayKey } from '../lib/today'
import { ResourceChip } from './premium'

/** Les trois pastilles du profil, celles qu'une tape explique. */
type CurrencyHint = 'filters' | 'reveals' | 'slots'

/**
 * What the player holds, one chip each — padlocks, the day's reveals, power
 * slots — the same chips the screens that spend them show. A Premium member's
 * go black and yellow: ∞ reveals, the six padlocks, and the slots as they are.
 * A tap on a chip says what it stands for: a bubble under the row, which the
 * next tap closes.
 */
export function CurrencyRow({ profile, day = todayKey(), title = false }: { profile: Profile; day?: string; title?: boolean }) {
  const t = useT()
  const plus = isPlus(profile)
  const allowed = bansAllowed(profile)
  const used = bannedOf(profile, ownedCategoryIds(profile)).length
  const reveals = revealBudget(profile, day)
  const slots = slotsOf(profile)
  const [hint, setHint] = useState<CurrencyHint | null>(null)

  /** Une pastille, ce qu'elle compte, et ce qu'une tape en dit. */
  const chips: { id: CurrencyHint; hint: string; chip: ReactNode }[] = [
    {
      id: 'filters',
      hint: t.currencies.hintFilters,
      chip: (
        <ResourceChip
          icon="lock"
          count={used}
          max={allowed}
          premium={plus}
          state={allowed > 0 ? 'normal' : 'spent'}
          label={allowed > 0 ? t.currencies.filters(used, allowed) : t.currencies.filtersLocked}
        />
      ),
    },
    {
      id: 'reveals',
      hint: t.currencies.hintReveals,
      chip: (
        <ResourceChip
          icon="eye"
          count={reveals.left}
          max={reveals.allowed}
          unlimited={reveals.unlimited}
          state={reveals.unlimited || reveals.left > 0 ? 'normal' : 'spent'}
          label={reveals.unlimited ? t.currencies.revealsPlus : t.currencies.reveals(reveals.left, reveals.allowed)}
        />
      ),
    },
    {
      id: 'slots',
      hint: t.currencies.hintSlots,
      chip: <ResourceChip icon="slot" count={slots} max={MAX_EQUIPPED} label={t.currencies.slots(slots, MAX_EQUIPPED)} />,
    },
  ]

  const shown = chips.find((entry) => entry.id === hint)

  return (
    <section className="currency-row" aria-label={t.currencies.title}>
      {title && <p className="section-title">{t.currencies.title}</p>}
      <div className="currency-chips">
        {chips.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="currency-chip"
            data-track={`currency-${entry.id}`}
            aria-expanded={hint === entry.id}
            onClick={() => setHint(hint === entry.id ? null : entry.id)}
          >
            {entry.chip}
          </button>
        ))}
      </div>
      {shown && (
        <p className="currency-bubble" role="status">
          {shown.hint}
        </p>
      )}
    </section>
  )
}
