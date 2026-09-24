import { CATALOGUE } from '../domain/catalogue'
import type { Profile } from '../domain/progression'
import { MAX_CATEGORIES_PER_RUN, ownedCategoryIds } from '../domain/unlocks'
import { categoryText, useT } from '../i18n'
import { Shape } from './bauhaus'
import { categoryMotif } from './motifs'

export function CategoriesPage({ profile }: { profile: Profile }) {
  const t = useT()
  const owned = ownedCategoryIds(profile)

  return (
    <section className="stack">
      <div className="spread">
        <p className="section-title">{t.home.myCategories}</p>
        <p className="note">
          {owned.length} / {CATALOGUE.length}
        </p>
      </div>
      <ul className="categories">
        {owned.map((id) => {
          const motif = categoryMotif(id)
          const text = categoryText(t, id)
          return (
            <li key={id}>
              <Shape kind={motif.kind} tint={motif.tint} className="category-shape" />
              <span className="category-label">{text.label}</span>
              <span className="note">{text.hint}</span>
            </li>
          )
        })}
      </ul>
      {owned.length > MAX_CATEGORIES_PER_RUN && <p className="note">{t.home.reserve(MAX_CATEGORIES_PER_RUN)}</p>}
    </section>
  )
}
