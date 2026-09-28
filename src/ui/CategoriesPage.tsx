import { useEffect, useState } from 'react'
import { CATALOGUE } from '../domain/catalogue'
import { bannedOf, banNews, banUnlocked, banVerdict, isPlus } from '../domain/perks'
import type { Profile } from '../domain/progression'
import { ownedCategoryIds } from '../domain/unlocks'
import { categoryText, useT } from '../i18n'
import { Shape } from './bauhaus'
import { categoryMotif } from './motifs'
import { CategoryIcon } from './CategoryIcon'
import { PlusPop } from './PlusPop'
import { useBackDismiss } from './useBackDismiss'

export interface BanActions {
  onBan(categoryId: string): void
  onUnban(categoryId: string): void
  onIntroSeen(): void
  onJoinPlus(): void
}

export function CategoriesPage({ profile, onBan, onUnban, onIntroSeen, onJoinPlus }: { profile: Profile } & BanActions) {
  const t = useT()
  const owned = ownedCategoryIds(profile)
  const banning = banUnlocked(owned)
  const banned = new Set(bannedOf(profile, owned))
  // Read once, on arrival: the dot goes as soon as the page is seen, the explanation stays until closed.
  const [intro, setIntro] = useState(() => banNews(profile, owned))
  const [plusFor, setPlusFor] = useState<string | null>(null)
  const [full, setFull] = useState(false)

  useEffect(() => {
    if (intro) onIntroSeen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tryBan = (id: string) => {
    const verdict = banVerdict(profile, owned, id)
    setFull(verdict === 'full')
    if (verdict === 'ok') onBan(id)
    else if (verdict === 'plus') setPlusFor(id)
  }

  return (
    <section className="stack">
      <div className="spread">
        <p className="section-title">
          {t.home.myCategories}
          {isPlus(profile) && <span className="plus-badge">{t.plus.badge}</span>}
        </p>
        <p className="note">
          {owned.length} / {CATALOGUE.length}
        </p>
      </div>
      {banning && <p className="note">{t.bans.lead}</p>}
      {full && <p className="note note--warn">{t.bans.full}</p>}
      <ul className={`categories${banning ? ' categories--bans' : ''}`}>
        {owned.map((id) => {
          const motif = categoryMotif(id)
          const text = categoryText(t, id)
          const out = banned.has(id)
          return (
            <li key={id} className={out ? 'category--banned' : undefined}>
              <CategoryIcon categoryId={id} tint={motif.tint} className="category-shape" />
              <span className="category-label">
                {text.label}
                {out && <span className="category-banned-tag">{t.bans.banned}</span>}
              </span>
              <span className="note">{text.hint}</span>
              {banning && (
                <button
                  type="button"
                  className={`btn btn--quiet${out ? '' : ' btn--muted'} category-ban`}
                  onClick={() => (out ? onUnban(id) : tryBan(id))}
                  aria-label={`${out ? t.bans.unban : t.bans.ban} : ${text.label}`}
                >
                  {out ? t.bans.unban : t.bans.ban}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {intro && <BanIntro onClose={() => setIntro(false)} />}
      {plusFor && (
        <PlusPop
          reason="ban"
          onClose={() => setPlusFor(null)}
          onJoin={() => {
            onJoinPlus()
            onBan(plusFor)
            setPlusFor(null)
          }}
        />
      )}
    </section>
  )
}

function BanIntro({ onClose }: { onClose(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="ban-intro-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="circle" tint="red" />
          </span>
        </span>
        <h2 id="ban-intro-title" className="offer-pop-title">
          {t.bans.introTitle}
        </h2>
        <p>{t.bans.introLead}</p>
        <div className="offer-pop-actions plus-pop-actions">
          <button type="button" className="btn btn--blue" onClick={onClose}>
            {t.bans.introOk}
          </button>
        </div>
      </div>
    </div>
  )
}
