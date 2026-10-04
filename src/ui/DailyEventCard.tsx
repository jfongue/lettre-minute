import type { CSSProperties } from 'react'
import { useT } from '../i18n'
import { Shape } from './bauhaus'

/** Front-end concept card until recurring events have a server-backed schedule. */
export function DailyEventCard({ onOpen }: { onOpen(): void }) {
 const t = useT()
 return (
  <button type="button" className="daily-event-card" onClick={onOpen}>
   <span className="daily-event-art" aria-hidden="true">
    <Shape kind="sun" tint="ink" />
   </span>
   <span className="daily-event-copy">
    <span className="eyebrow">{t.home.dailyEvent}</span>
    <strong>{t.premium.eventTitle}</strong>
    <span className="note">{t.premium.eventLead}</span>
   </span>
   <span className="daily-event-arrow" aria-hidden="true">›</span>
  </button>
 )
}

export function DailyEventPage({ onOpenPremium }: { onOpenPremium(): void }) {
 const t = useT()
 return (
  <div className="stack daily-event-page">
   <header className="stack">
    <p className="eyebrow">{t.premium.eventTitle}</p>
    <h2>{t.premium.eventLead}</h2>
    <p className="note">{t.premium.eventStatus}</p>
   </header>
   <section className="panel daily-event-panel">
    <div className="spread"><strong>{t.premium.eventTimer}</strong><span>13 j 08 h</span></div>
    <div className="progress progress--grow"><span style={{ '--ratio': 0.38 } as CSSProperties} /></div>
    <p className="note">{t.premium.eventRecap}</p>
   </section>
   <section className="stack">
    <p className="section-title">{t.premium.eventPreview}</p>
    <div className="figures">
     <div className="figure"><span className="figure-value">#128</span><span className="figure-label">{t.premium.eventRank}</span></div>
     <div className="figure"><span className="figure-value">425</span><span className="figure-label">{t.premium.eventMedian}</span></div>
    </div>
    <p className="note">{t.premium.eventFree}</p>
    <p className="note">{t.premium.eventPlus}</p>
   </section>
   <button type="button" className="btn btn--play btn--block">{t.premium.eventPlay}</button>
   <button type="button" className="btn btn--blue btn--block" onClick={onOpenPremium}>{t.menu.premiumButton}</button>
   <p className="note">{t.premium.proto}</p>
  </div>
 )
}
