import type { CSSProperties } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { Shape } from './bauhaus'
import { onTint, type ShapeKind, type Tint } from './motifs'

export type LinkedPage = 'profile' | 'stats' | 'requests' | 'categories' | 'premium'
type LabelPage = Exclude<LinkedPage, 'premium'>

// `soon` : la tuile se montre à sa place, mais son contenu n'est pas prêt et
// elle ne mène nulle part — même traitement que le partage d'un bilan.
const LOOKS: Record<Exclude<LinkedPage, 'profile'>, { kind: ShapeKind; tint: Tint; ground: Tint; soon?: boolean }> = {
  stats: { kind: 'bars', tint: 'black', ground: 'yellow' },
  requests: { kind: 'quarter', tint: 'cream', ground: 'blue' },
  categories: { kind: 'circle', tint: 'yellow', ground: 'red' },
  premium: { kind: 'sun', tint: 'red', ground: 'pink', soon: true },
}

function labelOf(t: ReturnType<typeof useT>, page: LinkedPage): string {
  if (page === 'premium') return t.menu.pages.premium
  const ordinary: LabelPage = page
  return t.home.links[ordinary]
}

interface PageLinksProps {
  pages: readonly LinkedPage[]
  /** Worn on the profile tile. */
  avatar?: AvatarChoice
  /** News waiting behind a tile, counted on a sticker in its corner. */
  badges?: Partial<Record<LinkedPage, number>>
  /** Many words waiting for this moderator: a « ! » on « Mes demandes » when no count is there. */
  queueAlert?: boolean
  onOpen(page: LinkedPage): void
}

/** Poster tiles that open a page of the drawer: the shape jumps when the tile is reached. */
export function PageLinks({ pages, avatar, badges, queueAlert = false, onOpen }: PageLinksProps) {
  const t = useT()
  return (
    <nav className="page-links" style={{ '--count': pages.length } as CSSProperties}>
      {pages.map((page, index) => {
        const look = page === 'profile' ? null : LOOKS[page]
        const ground: Tint = look?.ground ?? 'paper'
        const badge = badges?.[page] ?? 0
        const alert = badge === 0 && queueAlert && page === 'requests'
        const soon = Boolean(look?.soon)
        return (
          <button
            key={page}
            type="button"
            className={`page-link page-link--${page}${soon ? ' coming-soon' : ''}`}
            style={{ background: `var(--${ground})`, color: `var(--${onTint(ground)})`, '--i': index } as CSSProperties}
            onClick={() => onOpen(page)}
            disabled={soon}
            aria-disabled={soon || undefined}
            aria-label={badge > 0 ? `${labelOf(t, page)} · ${t.home.news(badge)}` : alert ? `${labelOf(t, page)} · ${t.home.queueWaiting}` : undefined}
          >
            <span className="page-link-art">
              {page === 'profile' && avatar ? (
                <Avatar choice={avatar} size="fill" />
              ) : (
                look && <Shape kind={look.kind} tint={look.tint} />
              )}
            </span>
            <span className="page-link-label">
              {labelOf(t, page)}
              {soon && <span className="tag tag--plain">{t.challenge.soon}</span>}
            </span>
            {badge > 0 && (
              <span className="page-link-badge" aria-hidden="true">
                {badge}
              </span>
            )}
            {alert && (
              <span className="page-link-badge" aria-hidden="true">
                !
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
