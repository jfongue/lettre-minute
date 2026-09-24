import type { CSSProperties } from 'react'
import { picksOwed } from '../domain/unlocks'
import type { Profile } from '../domain/progression'
import { categoryText, useT } from '../i18n'
import { Shape } from './bauhaus'
import { categoryMotif, onTint } from './motifs'

interface CategoryOfferProps {
  profile: Profile
  onChoose(categoryId: string): void
}

/** The three categories a level up puts on the table; one tap keeps one. */
export function CategoryOffer({ profile, onChoose }: CategoryOfferProps) {
  const t = useT()
  if (profile.offer.length === 0) return null
  const owed = picksOwed(profile)

  return (
    <section className="offer">
      <div className="spread">
        <p className="section-title">{t.offer.title}</p>
        {owed > 1 && <p className="note">{t.offer.more(owed - 1)}</p>}
      </div>
      <p className="note">{t.offer.lead}</p>
      <ul className="offer-cards" key={profile.offer.join()}>
        {profile.offer.map((id, index) => {
          const text = categoryText(t, id)
          const motif = categoryMotif(id)
          return (
            <li key={id} style={{ '--i': index } as CSSProperties}>
              <button
                type="button"
                className="offer-card"
                style={{ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` }}
                onClick={() => onChoose(id)}
              >
                <Shape kind={motif.kind} tint={onTint(motif.tint)} className="offer-shape" />
                <strong>{text.label}</strong>
                <span>{text.hint}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
