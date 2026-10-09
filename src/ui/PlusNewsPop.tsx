import { useEffect } from 'react'
import { useT } from '../i18n'
import { sound } from '../lib/sound'
import { Burst, Shape } from './bauhaus'
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
<div className="offer-pop">
<span className="offer-pop-art" aria-hidden="true">
<span className="offer-pop-shape offer-pop-shape--circle">
<Shape kind="sun" tint="yellow" />
</span>
<Burst />
</span>
<h2 id="premiere-news-title" className="offer-pop-title">
{t.premium.news.title}
</h2>
<p className="note">{t.premium.news.body(names)}</p>
<div className="offer-pop-actions">
<button type="button" className="btn btn--ghost" onClick={onClose}>
{t.premium.later}
</button>
<button type="button" className="btn btn--blue" onClick={onOpen}>
{t.premium.news.cta}
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
<div className="offer-pop">
<span className="offer-pop-art" aria-hidden="true">
<span className="offer-pop-shape offer-pop-shape--circle">
<Shape kind="circle" tint="red" />
</span>
<Burst />
</span>
<h2 id="plus-prize-title" className="offer-pop-title">
{t.premium.winTitle}
</h2>
<p className="note">{t.premium.winNote}</p>
<button type="button" className="btn btn--blue btn--block" onClick={onClose}>
{t.premium.winOk}
</button>
</div>
</div>
)
}