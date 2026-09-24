import type { CSSProperties } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { Shape } from './bauhaus'
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
  onOpen(page: LinkedPage): void
}

/** Poster tiles that open a page of the drawer: the shape jumps when the tile is reached. */
export function PageLinks({ pages, avatar, onOpen }: PageLinksProps) {
  const t = useT()
  return (
    <nav className="page-links" style={{ '--count': pages.length } as CSSProperties}>
      {pages.map((page, index) => {
        const look = page === 'profile' ? null : LOOKS[page]
        const ground: Tint = look?.ground ?? 'paper'
        return (
          <button
            key={page}
            type="button"
            className={`page-link page-link--${page}`}
            style={{ background: `var(--${ground})`, color: `var(--${onTint(ground)})`, '--i': index } as CSSProperties}
            onClick={() => onOpen(page)}
          >
            <span className="page-link-art">
              {page === 'profile' && avatar ? (
                <Avatar choice={avatar} size="fill" />
              ) : (
                look && <Shape kind={look.kind} tint={look.tint} />
              )}
            </span>
            <span className="page-link-label">{t.home.links[page]}</span>
          </button>
        )
      })}
    </nav>
  )
}
