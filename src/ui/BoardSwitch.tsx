import type { CSSProperties } from 'react'
import { useT } from '../i18n'

/** Les familles de la page des classements : les parties, le défi, puis le duel classé. */
export type BoardFamily = 'runs' | 'weekly' | 'duel'

/**
 * Le commutateur de la page des classements, sur la ligne de son titre : deux
 * cases, un curseur qui glisse sous celle qui est ouverte et une flèche qui
 * montre le sens — vers le défi, puis vers le solo une fois passé.
 */
export function BoardSwitch({
  family,
  onFamily,
  families = ['runs', 'weekly'],
}: {
  family: BoardFamily
  onFamily(next: BoardFamily): void
  /** Les cases offertes : le duel s'y ajoute quand il est ouvert au joueur. */
  families?: readonly BoardFamily[]
}) {
  const t = useT()
  const at = Math.max(0, families.indexOf(family))
  return (
    <div
      className={`board-switch${at === families.length - 1 ? ' board-switch--last' : ''}`}
      data-family={family}
      role="tablist"
      aria-label={t.menu.pages.boards}
      style={{ '--tabs': families.length, '--at': at } as CSSProperties}
    >
      <span className="board-switch-rail">
        <span className="board-switch-thumb" aria-hidden="true" />
        {families.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={family === id}
            className="board-switch-tab"
            onClick={() => onFamily(id)}
          >
            {id === 'runs' ? t.leaderboards.solo : id === 'weekly' ? t.leaderboards.challenge : t.duel.title}
          </button>
        ))}
      </span>
      <span className="board-switch-arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </div>
  )
}