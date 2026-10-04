import { useT } from '../i18n'
import { Shape } from './bauhaus'
import type { ShapeKind } from './motifs'

/** Product concept only: it changes no entitlement and starts no purchase. */
export function PremiumPage() {
 const t = useT()
 const perks: readonly [ShapeKind, string][] = [
  ['sun', t.checkout.perkEvents],
  ['bars', t.checkout.perkCategories],
  ['star', t.checkout.perkBans],
  ['diamond', t.checkout.perkPeeks],
  ['circle', t.premium.eventPlus],
 ]
 return (
  <div className="stack premium-page">
   <header className="premium-hero">
    <Shape kind="sun" tint="red" />
    <p className="eyebrow">Lettre Minute · Premium</p>
    <h2>{t.premium.title}</h2>
    <p>{t.premium.lead}</p>
    <p className="premium-price">2,49 €</p>
   </header>
   <section className="stack">
    <p className="section-title">{t.premium.preview}</p>
    <ul className="premium-perks">
     {perks.map(([shape, text]) => (
      <li key={shape}>
       <Shape kind={shape} tint="blue" />
       <span>{text}</span>
      </li>
     ))}
    </ul>
   </section>
   <section className="panel premium-note">
    <p>{t.premium.proto}</p>
   </section>
  </div>
 )
}
