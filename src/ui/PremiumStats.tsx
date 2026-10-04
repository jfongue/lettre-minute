import { useMemo, useState, type CSSProperties } from 'react'
import { categoryText, formatNumber, useT } from '../i18n'
import type { RunRecord } from '../domain/history'
import { Shape } from './bauhaus'
import { categoryMotif } from './motifs'

export function PremiumStats({ history, onOpenPremium }: { history: readonly RunRecord[]; onOpenPremium(): void }) {
 const t = useT()
 const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month')
 const cutoff = period === 'week' ? Date.now() - 7 * 86400000 : period === 'month' ? Date.now() - 30 * 86400000 : 0
 const selected = history.filter((run) => run.at >= cutoff)
 const pairs = useMemo(() => {
  const totals = new Map<string, { categoryId: string; letter: string; seen: number; passed: number }>()
  for (const run of selected) {
   for (const item of run.prompts ?? []) {
    const key = `${item.prompt.categoryId}:${item.prompt.letter}`
    const row = totals.get(key) ?? { categoryId: item.prompt.categoryId, letter: item.prompt.letter, seen: 0, passed: 0 }
    row.seen++
    if (item.passed) row.passed++
    totals.set(key, row)
   }
  }
  return [...totals.values()].filter((row) => row.seen >= 2).sort((a, b) => b.passed / b.seen - a.passed / a.seen).slice(0, 5)
 }, [selected])
 const scores = [...selected].reverse().slice(-7)
 const max = Math.max(1, ...scores.map((run) => run.score))

 return (
  <div className="stack premium-stats">
   <section className="premium-stats-intro">
    <span className="eyebrow">{t.premium.preview}</span>
    <h3>{t.premium.title}</h3>
    <p className="note">{t.premium.lead}</p>
   </section>
   <div className="layer-tabs" role="group" aria-label={t.premium.range}>
    {(['week', 'month', 'all'] as const).map((value) => (
     <button type="button" key={value} className={`layer-tab${period === value ? ' layer-tab--on' : ''}`} onClick={() => setPeriod(value)}>
      {t.premium.periods[value]}
     </button>
    ))}
   </div>
   <section className="stack">
    <p className="section-title">{t.premium.trend}</p>
    {scores.length ? (
     <div className="premium-chart" aria-label={t.premium.days}>
      {scores.map((run, index) => <span key={`${run.at}-${index}`} title={`${formatNumber(t, run.score)} ${t.stats.points}`} style={{ '--bar': `${Math.max(8, run.score / max * 100)}%` } as CSSProperties} />)}
     </div>
    ) : <p className="note">{t.premium.empty}</p>}
   </section>
   <section className="stack">
    <p className="section-title">{t.premium.passes}</p>
    {pairs.length ? <ol className="premium-pairs">
     {pairs.map((pair, index) => {
      const motif = categoryMotif(pair.categoryId)
      return <li key={`${pair.categoryId}-${pair.letter}`}>
       <span className="premium-pair-rank">{index + 1}</span>
       <Shape kind={motif.kind} tint={motif.tint} />
       <span className="premium-pair-copy"><strong>{pair.letter} · {categoryText(t, pair.categoryId).label}</strong><span className="note">{t.premium.sample(pair.seen)}</span></span>
       <strong>{t.premium.rate(Math.round(pair.passed / pair.seen * 100))}</strong>
      </li>
     })}
    </ol> : <p className="note">{t.premium.empty}</p>}
   </section>
   <section className="panel premium-note">
    <strong>{t.premium.preview}</strong>
    <p>{t.premium.proto}</p>
   </section>
   <button type="button" className="btn btn--blue btn--block" onClick={onOpenPremium}>{t.menu.premiumButton}</button>
  </div>
 )
}
