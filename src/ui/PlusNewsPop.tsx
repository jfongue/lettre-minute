import { useEffect } from 'react'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { Burst } from './bauhaus'
import { PremiumBenefits } from './PremiumSheet'
import { PlusSeal } from './premium'
import { useBackDismiss } from './useBackDismiss'

/**
 * Au retour à l'accueil : les catégories en avant-première qu'un envoi vient de
 * livrer. Premium les joue déjà ; les autres passent par sa fiche, d'où le
 * bouton que l'appelant mène à l'un ou à l'autre.
 */
export function PlusNewsPop({ names, onOpen, onClose }: { names: string; onOpen(): void; onClose(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  useEffect(() => sound.news(), [])
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="premiere-news-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="psheet">
        <div className="psheet-done">
          <span className="psheet-done-art">
            <PlusSeal size="lg" animated />
            <Burst />
          </span>
          <h2 id="premiere-news-title" className="psheet-welcome">
            {t.premium.news.title}
          </h2>
          <p className="psheet-note">{t.premium.news.body(names)}</p>
          <button type="button" className="btn psheet-buy" onClick={onOpen}>
            {t.premium.news.cta}
          </button>
          <button type="button" className="psheet-link" onClick={onClose}>
            {t.premium.later}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Juste après le récap : le premier de la semaine gagne Premium, et l'apprend ici. */
export function PlusPrizePop({ onClose }: { onClose(): void }) {
  const t = useT()
  useBackDismiss(onClose)
  useEffect(() => sound.news(), [])
  return (
    <div className="offer-pop-layer" role="dialog" aria-modal="true" aria-labelledby="plus-prize-title">
      <div className="offer-pop-scrim" onClick={onClose} />
      <div className="psheet">
        <div className="psheet-done">
          <span className="psheet-done-art">
            <PlusSeal size="lg" animated />
            <Burst />
          </span>
          <h2 id="plus-prize-title" className="psheet-welcome">
            {t.premium.winTitle}
          </h2>
          <p className="psheet-note">{t.premium.winNote}</p>
          {/* Le prix remercie le gagnant : ni le paiement unique, ni l'appel au développeur indé. */}
          <PremiumBenefits omit={['indie', 'lifetime']} />
          <button type="button" className="btn psheet-buy" onClick={onClose}>
            {t.premium.winOk}
          </button>
        </div>
      </div>
    </div>
  )
}
