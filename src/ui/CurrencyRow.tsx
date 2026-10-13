import { useState, type ReactNode } from 'react'
import { bannedOf, bansAllowed, isPlus, revealBudget } from '../domain/perks'
import type { Profile } from '../domain/progression'
import type { AttemptCount } from '../domain/weekly'
import { ownedCategoryIds } from '../domain/unlocks'
import { useT } from '../i18n'
import { todayKey } from '../lib/today'
import { ResourceChip } from './premium'
import { host } from '../platform'

/** Les pastilles du profil, celles qu'une tape explique. */
type CurrencyHint = 'filters' | 'reveals' | 'attempts'

/**
* What the player holds, one chip each — padlocks, the day's reveals and the
* challenge's attempts — the same chips the screens that spend them show. A
* Premium member's go black and yellow: ∞ reveals, the six padlocks, and the
* five attempts. A tap on a chip says what it stands for: a bubble under the
* row, which the next tap closes.
*/
export function CurrencyRow({
profile,
day = todayKey(),
attempts = null,
title = false,
}: {
profile: Profile
day?: string
/** Les tentatives du défi du moment ; la pastille s'efface quand il est fermé. */
attempts?: AttemptCount | null
title?: boolean
}) {
const t = useT()
const plus = isPlus(profile)
const allowed = bansAllowed(profile)
const used = bannedOf(profile, ownedCategoryIds(profile)).length
const reveals = revealBudget(profile, day, host.unlimitedReveals)
const [hint, setHint] = useState<CurrencyHint | null>(null)

/** Une pastille, ce qu'elle compte, ce qu'une tape en dit, et sa forme animée. */
const chips: { id: CurrencyHint; hint: string; chip: ReactNode; look?: 'locked' | 'free' }[] = [
{
id: 'filters',
look: used > 0 ? 'locked' : 'free',
hint: t.currencies.hintFilters,
chip: (
<ResourceChip
icon={used > 0 ? 'lock' : 'check'}
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
]

if (attempts) {
const text = attempts.left > 0 ? t.weekly.screen.introLeft(attempts.left) : t.weekly.screen.allUsed
chips.push({
id: 'attempts',
hint: text,
chip: (
<ResourceChip
icon="ticket"
count={attempts.left}
max={attempts.total}
premium={plus}
state={attempts.left > 0 ? 'normal' : 'spent'}
label={text}
/>
),
})
}

// Le filtrage ne se compte qu'une fois débloqué, Premium compris : tant qu'il
// ne l'est pas, la pastille n'aurait qu'un zéro et un check à montrer.
const visible = chips.filter((entry) => entry.id !== 'filters' || allowed > 0)
const shown = visible.find((entry) => entry.id === hint)

return (
<section className="currency-row" aria-label={t.currencies.title}>
{title && <p className="section-title">{t.currencies.title}</p>}
<div className="currency-chips">
{visible.map((entry) => (
<button
key={`${entry.id}-${entry.look ?? 'plain'}`}
type="button"
className={`currency-chip currency-chip--${entry.id}${entry.look ? ` currency-chip--${entry.look}` : ''}`}
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
