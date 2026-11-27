import { useT } from '../i18n'
import type { DuelQueue } from '../state/duelQueue'
import { clockOf, estimateText } from './rankedText'

/**
 * La file classée, quand on n'est pas sur son écran : une pastille qui dit
 * qu'on cherche toujours, depuis combien de temps, et ce qu'on attend encore.
 * La toucher rouvre la recherche ; la croix l'arrête. En bas de l'accueil, en
 * haut d'une table de duel, où le champ et le clavier tiennent le bas.
 */
export function QueuePill({ queue, place = 'bottom', onOpen }: { queue: DuelQueue; place?: 'bottom' | 'top'; onOpen(): void }) {
  const t = useT()
  const { state, now } = queue
  if (state.kind !== 'searching') return null
  const waited = Math.max(0, now - state.since)
  const estimate = state.info?.estimate ?? null
  return (
    <div className={`queue-pill queue-pill--${place}`} data-no-swipe>
      <button type="button" className="queue-pill__open" aria-label={`${t.ranked.pillOpen} · ${t.ranked.status(clockOf(waited), estimateText(t, estimate))}`} onClick={onOpen}>
        <span className="queue-pill__dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <b>{t.ranked.pill}</b>
        <span className="queue-pill__clock clock">{clockOf(waited)}</span>
        <small>{estimateText(t, estimate)}</small>
      </button>
      <button type="button" className="queue-pill__cancel" aria-label={t.ranked.pillCancel} onClick={queue.cancel}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
        </svg>
      </button>
    </div>
  )
}
