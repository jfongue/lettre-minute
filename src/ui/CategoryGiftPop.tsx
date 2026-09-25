import { categoryText, useT } from '../i18n'
import { sound } from '../lib/sound'
import { tapFeedback } from '../lib/native'
import { categoryMotif, onTint } from './motifs'
import { CategoryIcon } from './CategoryIcon'

/**
 * On opening the game, for a player who had already unlocked every other
 * category before a new wave shipped: a free pick from what the wave added,
 * so the level-up system they've outgrown isn't the only way in. There is no
 * decline — closing it would either cost the gift for good or bring it back
 * every launch, and a free category is worth neither — so the scrim is inert
 * and the offer stays until one card is tapped.
 */
export function CategoryGiftPop({ offer, onChoose }: { offer: readonly string[]; onChoose(categoryId: string): void }) {
  const t = useT()
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="category-gift-title">
      <div className="offer-pop-scrim" />
      <div className="offer-pop category-gift">
        <h2 id="category-gift-title" className="offer-pop-title">
          {t.categoryGift.title}
        </h2>
        <p className="note">{t.categoryGift.lead}</p>
        <ul className="unlock-cards">
          {offer.map((id) => {
            const text = categoryText(t, id)
            const motif = categoryMotif(id)
            return (
              <li key={id}>
                <button
                  type="button"
                  className="offer-card unlock-card"
                  style={{ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` }}
                  onClick={() => {
                    tapFeedback('medium')
                    sound.levelUp()
                    onChoose(id)
                  }}
                >
                  <CategoryIcon categoryId={id} tint={onTint(motif.tint)} className="offer-shape unlock-card-shape" />
                  <strong>{text.label}</strong>
                  <span>{text.hint}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
