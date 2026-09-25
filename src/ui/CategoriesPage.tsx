import { CATALOGUE } from '../domain/catalogue'
import type { Profile } from '../domain/progression'
import { ownedCategoryIds } from '../domain/unlocks'
import { categoryText, useT } from '../i18n'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'

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
              <CategoryIcon categoryId={id} tint={motif.tint} className="category-shape" />
              <span className="category-label">{text.label}</span>
              <span className="note">{text.hint}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
