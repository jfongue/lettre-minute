import type { AvatarChoice } from '../domain/avatar'
import { useT } from '../i18n'
import { Avatar } from './Avatar'
import { useBackDismiss } from './useBackDismiss'

/**
 * Quitter l'éditeur avec un avatar composé mais pas enregistré : l'avant et
 * l'après côte à côte, puis garder ou laisser tomber. Toucher à côté, ou le
 * retour du téléphone, ramène simplement à l'éditeur.
 */
export function AvatarKeepPop({
  before,
  after,
  onKeep,
  onDrop,
  onStay,
}: {
  before: AvatarChoice
  after: AvatarChoice
  onKeep(): void
  onDrop(): void
  onStay(): void
}) {
  const t = useT()
  useBackDismiss(onStay)
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="avatar-keep-title">
      <div className="offer-pop-scrim" onClick={onStay} />
      <div className="offer-pop avatar-keep">
        <h2 id="avatar-keep-title" className="offer-pop-title">
          {t.avatar.keep.title}
        </h2>
        <p className="note">{t.avatar.keep.body}</p>
        <div className="avatar-keep-pair">
          <figure className="avatar-keep-side">
            <Avatar choice={before} size="lg" />
            <figcaption className="note">{t.avatar.keep.before}</figcaption>
          </figure>
          <svg className="avatar-keep-arrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12h15M13 6l6 6-6 6" />
          </svg>
          <figure className="avatar-keep-side">
            <Avatar choice={after} size="lg" />
            <figcaption className="note">{t.avatar.keep.after}</figcaption>
          </figure>
        </div>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onDrop}>
            {t.avatar.keep.no}
          </button>
          <button type="button" className="btn btn--blue" onClick={onKeep}>
            {t.avatar.keep.yes}
          </button>
        </div>
      </div>
    </div>
  )
}
