import { useT } from '../i18n'

/** Sharing a recap is on its way: the button shows where it will be, and does nothing yet. */
export function ShareSoon() {
  const t = useT()
  return (
    <button type="button" className="btn btn--ghost btn--block share-soon" disabled>
      {t.challenge.share}
      <span className="tag tag--plain">{t.challenge.soon}</span>
    </button>
  )
}
