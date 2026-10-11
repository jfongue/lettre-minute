import { useT } from '../i18n'

/** Les deux familles de la page des classements : les parties, puis le défi. */
export type BoardFamily = 'runs' | 'weekly'

/**
 * Le commutateur de la page des classements, sur la ligne de son titre : deux
 * cases, un curseur qui glisse sous celle qui est ouverte et une flèche qui
 * montre le sens — vers le défi, puis vers le solo une fois passé.
 */
export function BoardSwitch({
  family,
  onFamily,
}: {
  family: BoardFamily
  onFamily(next: BoardFamily): void
}) {
  const t = useT()
  return (
    <div className="board-switch" data-family={family} role="tablist" aria-label={t.menu.pages.boards}>
      <span className="board-switch-rail">
        <span className="board-switch-thumb" aria-hidden="true" />
        {(['runs', 'weekly'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={family === id}
            className="board-switch-tab"
            onClick={() => onFamily(id)}
          >
            {id === 'runs' ? t.leaderboards.solo : t.leaderboards.challenge}
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