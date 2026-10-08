import { useT } from '../i18n'
import { ON_CRAZYGAMES } from '../lib/crazygames'

/** Sharing a recap is on its way: the button shows where it will be, and does nothing yet. */
export function ShareSoon() {
  const t = useT()
  // A button that does nothing is refused on CrazyGames, and sharing would lead off the portal.
  if (ON_CRAZYGAMES) return null
  return (
    <button type="button" className="btn btn--ghost btn--block share-soon" disabled>
      {t.challenge.share}
      <span className="tag tag--plain">{t.challenge.soon}</span>
    </button>
  )
}
