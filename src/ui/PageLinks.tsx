import { useContext, type CSSProperties } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { Shape } from './bauhaus'
import { FeaturesContext } from './features'
import { onTint, type ShapeKind, type Tint } from './motifs'

export type LinkedPage = 'profile' | 'stats' | 'requests' | 'categories'

const LOOKS: Record<Exclude<LinkedPage, 'profile'>, { kind: ShapeKind; tint: Tint; ground: Tint }> = {
  stats: { kind: 'bars', tint: 'black', ground: 'yellow' },
  requests: { kind: 'quarter', tint: 'cream', ground: 'blue' },
  categories: { kind: 'circle', tint: 'yellow', ground: 'red' },
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
/** La fonctionnalité qui ouvre chaque page : une page fermée perd sa tuile. */
const GATES: Partial<Record<LinkedPage, string>> = { stats: 'stats', requests: 'myRequests' }

export function PageLinks({ pages: all, avatar, badges, queueAlert = false, onOpen }: PageLinksProps) {
  const t = useT()
  const features = useContext(FeaturesContext)
  const pages = all.filter((page) => !GATES[page] || features.has(GATES[page]))
  return (
    <nav className="page-links" style={{ '--count': pages.length } as CSSProperties}>
      {pages.map((page, index) => {
        const look = page === 'profile' ? null : LOOKS[page]
        const ground: Tint = look?.ground ?? 'paper'
        const badge = badges?.[page] ?? 0
        const alert = badge === 0 && queueAlert && page === 'requests'
        return (
          <button
            key={page}
            type="button"
            className={`page-link page-link--${page}`}
            style={{ background: `var(--${ground})`, color: `var(--${onTint(ground)})`, '--i': index } as CSSProperties}
            onClick={() => onOpen(page)}
            aria-label={badge > 0 ? `${t.home.links[page]} · ${t.home.news(badge)}` : alert ? `${t.home.links[page]} · ${t.home.queueWaiting}` : undefined}
          >
            <span className="page-link-art">
              {page === 'profile' && avatar ? (
                <Avatar choice={avatar} size="fill" />
              ) : (
                look && <Shape kind={look.kind} tint={look.tint} />
              )}
            </span>
            <span className="page-link-label">{t.home.links[page]}</span>
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
