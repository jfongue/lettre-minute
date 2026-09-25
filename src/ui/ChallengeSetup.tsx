import { MAX_CATEGORIES_PER_RUN } from '../domain/unlocks'
import { categoryText, useT } from '../i18n'
import { CategoryIcon } from './CategoryIcon'
import { categoryMotif, onTint } from './motifs'

export interface ChallengeRules {
  categoryIds: readonly string[]
  powers: boolean
}

interface ChallengeSetupProps {
  /** The owner's own categories that ship in the challenge's language. */
  owned: readonly string[]
  /** Without a power of their own, the owner has nothing to allow or bar. */
  hasPowers: boolean
  rules: ChallengeRules
  onRules(rules: ChallengeRules): void
}

/** Above the friends to invite: which of one's categories the challenge plays, and whether powers come along. */
export function ChallengeSetup({ owned, hasPowers, rules, onRules }: ChallengeSetupProps) {
  const t = useT()
  const toggle = (id: string) => {
    const on = rules.categoryIds.includes(id)
    if (on && rules.categoryIds.length === 1) return
    if (!on && rules.categoryIds.length >= MAX_CATEGORIES_PER_RUN) return
    onRules({ ...rules, categoryIds: on ? rules.categoryIds.filter((other) => other !== id) : [...rules.categoryIds, id] })
  }
  return (
    <div className="challenge-setup">
      <div className="spread">
        <p className="section-title">{t.challenge.setupCategories}</p>
        <p className="note">
          {rules.categoryIds.length} / {Math.min(MAX_CATEGORIES_PER_RUN, owned.length)}
        </p>
      </div>
      <ul className="setup-categories">
        {owned.map((id) => {
          const on = rules.categoryIds.includes(id)
          const motif = categoryMotif(id)
          return (
            <li key={id}>
              <button
                type="button"
                className={`setup-category${on ? ' setup-category--on' : ''}`}
                aria-pressed={on}
                disabled={!on && rules.categoryIds.length >= MAX_CATEGORIES_PER_RUN}
                onClick={() => toggle(id)}
              >
                <span className="setup-category-mark" style={{ background: `var(--${motif.tint})` }} aria-hidden="true">
                  <CategoryIcon categoryId={id} tint={onTint(motif.tint)} />
                </span>
                {categoryText(t, id).label}
              </button>
            </li>
          )
        })}
      </ul>
      <label className={`setup-switch${hasPowers ? '' : ' setup-switch--off'}`}>
        <input
          type="checkbox"
          role="switch"
          checked={hasPowers && rules.powers}
          disabled={!hasPowers}
          onChange={(event) => onRules({ ...rules, powers: event.target.checked })}
        />
        <span className="setup-switch-track" aria-hidden="true" />
        <span className="setup-switch-text">
          <strong>{t.challenge.setupPowers}</strong>
          <span className="note">{hasPowers ? t.challenge.setupPowersNote : t.challenge.setupNoPowers}</span>
        </span>
      </label>
    </div>
  )
}
