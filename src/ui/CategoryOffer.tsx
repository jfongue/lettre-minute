import type { CSSProperties } from 'react'
import { categoryMeta } from '../domain/catalogue'
import { picksOwed } from '../domain/unlocks'
import type { Profile } from '../domain/progression'
import { Shape } from './bauhaus'
import { categoryMotif, onTint } from './motifs'

interface CategoryOfferProps {
  profile: Profile
  onChoose(categoryId: string): void
}

/** The three categories a level up puts on the table; one tap keeps one. */
export function CategoryOffer({ profile, onChoose }: CategoryOfferProps) {
  if (profile.offer.length === 0) return null
  const owed = picksOwed(profile)

  return (
    <section className="offer">
      <div className="spread">
        <p className="section-title">Nouvelle catégorie</p>
        {owed > 1 && <p className="note">encore {owed - 1} à choisir</p>}
      </div>
      <p className="note">Choisis celle qui rejoint tes parties.</p>
      <ul className="offer-cards" key={profile.offer.join()}>
        {profile.offer.map((id, index) => {
          const meta = categoryMeta(id)
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
                <strong>{meta?.label ?? id}</strong>
                <span>{meta?.hint}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
