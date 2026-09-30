import type { PowerId } from '../domain/powers'
import { POWER_CHARGES } from '../domain/powers'
import { capitalized } from '../domain/text'
import { categoryText, useT } from '../i18n'
import type { Submission } from '../lib/cloud'
import { Burst, Shape } from './bauhaus'
import { onTint, POWER_TINTS, powerGround } from './motifs'
import { PowerIcon } from './PowerIcon'
import { useBackDismiss } from './useBackDismiss'

/** On opening the game: the words of the player's that moderators let in since they last looked. */
export function WordsNewsPop({ words, onClose, onOpen }: { words: readonly Submission[]; onClose(): void; onOpen(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="words-news-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop words-news">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="sun" tint="yellow" />
          </span>
          <Burst />
        </span>
        <h2 id="words-news-title" className="offer-pop-title">
          {t.requests.newsTitle(words.length)}
        </h2>
        <ul className="words-news-list">
          {words.map((word) => (
            <li key={word.id}>
              <strong>{capitalized(word.display)}</strong>
              <span className="note">{categoryText(t, word.categoryId).label}</span>
            </li>
          ))}
        </ul>
        <p className="note">{t.requests.newsLead}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onOpen}>
            {t.requests.newsOpen}
          </button>
          <button type="button" className="btn btn--blue" onClick={onClose}>
            {t.requests.newsOk}
          </button>
        </div>
      </div>
    </div>
  )
}

/** A power given for the player's words rather than picked at a level. */
export function PowerGiftPop({ powerId, onClose }: { powerId: PowerId; onClose(): void }) {
  const t = useT()
  // The only way out is the button, so the gesture is it: the power is earned.
  useBackDismiss(onClose)
  const [name, description] = t.powers.names[powerId]
  const uses = POWER_CHARGES[powerId]
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="power-gift-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="offer-pop power-gift">
        <h2 id="power-gift-title" className="offer-pop-title">
          {t.powers.giftTitle}
        </h2>
        <p className="note">{t.powers.giftLead}</p>
        <div className={`offer-card unlock-card power-card power--${powerId} power-gift-card`} style={powerGround(powerId)}>
          <span className="power-card-art">
            <PowerIcon id={powerId} tint={onTint(POWER_TINTS[powerId])} className="offer-shape unlock-card-shape" />
          </span>
          <strong>{name}</strong>
          <span>{description}</span>
          <span className="power-card-uses">{uses ? t.powers.uses(uses) : t.powers.always}</span>
        </div>
        <button type="button" className="btn btn--blue btn--block" onClick={onClose}>
          {t.powers.giftOk}
        </button>
      </div>
    </div>
  )
}

/** Once, on opening the game: friends can now be invited, and « Okay ! » leads to the invitation. */
export function ShareNewsPop({ onLater, onOpen }: { onLater(): void; onOpen(): void }) {
  const t = useT()
  useBackDismiss(onLater)
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="share-news-title">
      <div className="offer-pop-scrim" onClick={onLater} />
      <div className="offer-pop">
        <span className="offer-pop-art" aria-hidden="true">
          <span className="offer-pop-shape offer-pop-shape--circle">
            <Shape kind="circle" tint="red" />
          </span>
          <Burst />
        </span>
        <h2 id="share-news-title" className="offer-pop-title">
          {t.social.shareNews.title}
        </h2>
        <p className="note">{t.social.shareNews.lead}</p>
        <div className="offer-pop-actions">
          <button type="button" className="btn btn--ghost" onClick={onLater}>
            {t.social.shareNews.later}
          </button>
          <button type="button" className="btn btn--blue" onClick={onOpen}>
            {t.social.shareNews.ok}
          </button>
        </div>
      </div>
    </div>
  )
}
