import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  averagePoints,
  INSIGHT_ROWS,
  MIN_PAIR_DEALT,
  MIN_POWER_RUNS,
  mostEquipped,
  mostProfitable,
  mostProfitablePairs,
  mostPassedPairs,
  pairYield,
  passRate,
  peak,
  type ActivityBucket,
  type Insights as InsightData,
  type PairTally,
} from '../domain/insights'
import { isPowerId } from '../domain/powers'
import type { PeriodId } from '../domain/leaderboards'
import { categoryText, formatNumber, useT } from '../i18n'
import { fetchInsights } from '../lib/cloud'

/*
 * Les classements avancés : le mode débug caché derrière cinq tapes sur
 * « Classements ». Ce que le serveur agrège (0025) — pouvoirs portés, rythme
 * des parties et des comptes, couples les plus rentables ou les plus quittés —
 * que la page des classements ne montre pas.
 *
 * Un outil de développeur : ses propres libellés restent en français, hors de
 * l'i18n, comme la planche ; les noms de pouvoirs et de catégories, eux,
 * viennent de l'interface, qui les a déjà.
 */

export type LoadInsights = (lang: string) => Promise<InsightData | null>

interface InsightsProps {
  lang: string
  period: PeriodId
  /** La planche passe ses propres chiffres. */
  load?: LoadInsights
  /** Ferme le mode débug : absent de la planche, où il n'y a rien à fermer. */
  onClose?(): void
}

/** Le chargeur : la vue ne lit jamais le serveur, la planche peut la nourrir. */
export function Insights({ lang, period, load = fetchInsights, onClose }: InsightsProps) {
  const [data, setData] = useState<InsightData | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    load(lang).then((found) => live && setData(found))
    return () => {
      live = false
    }
  }, [lang, load])

  if (data === undefined) return <p className="note">Chargement des classements avancés…</p>
  if (data === null) return <p className="note note--warn">Le serveur ne répond pas : les classements avancés attendent.</p>
  return <InsightsView data={data} period={period} onClose={onClose} />
}

interface InsightsViewProps {
  data: InsightData
  period: PeriodId
  /** Ferme le mode débug : absent de la planche, où il n'y a rien à fermer. */
  onClose?(): void
}

export function InsightsView({ data, period, onClose }: InsightsViewProps) {
  const t = useT()
  const buckets = period === 'day' ? data.hours : period === 'week' ? data.days : data.weeks
  const step = period === 'day' ? 'hour' : period === 'week' ? 'day' : 'week'
  const every = step === 'hour' ? 'par heure' : step === 'day' ? 'par jour' : 'par semaine'
  const span = step === 'hour' ? '24 h' : step === 'day' ? '7 jours' : '12 semaines'
  const powers = mostEquipped(data.powers)
  const profitable = mostProfitable(data.powers)
  const rich = mostProfitablePairs(data.pairs)
  const passed = mostPassedPairs(data.pairs)

  return (
    <section className="insights stack">
      <div className="spread">
        <p className="section-title">Classements avancés</p>
        {onClose && (
          <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
            Quitter le mode débug
          </button>
        )}
      </div>
      <p className="note">
        Mode débug : cinq tapes sur « Classements » l’ouvrent. Les chiffres viennent du serveur et ne nomment aucun joueur.
      </p>

      <Ranking
        title="Pouvoirs les plus portés"
        note="Parties qui l’ont emporté, et les points qu’elles ont marqués."
        rows={powers}
        render={(row) => (
          <>
            <strong>{powerName(t, row.power)}</strong>
            <span className="note">
              {formatNumber(t, row.runs)} parties · {formatNumber(t, row.points)} pts · record {formatNumber(t, row.best)}
            </span>
          </>
        )}
      />

      <Ranking
        title="Points moyens par partie, par pouvoir"
        note={`Les pouvoirs portés au moins ${MIN_POWER_RUNS} fois : en dessous, une moyenne ne dit rien.`}
        rows={profitable}
        empty="Aucun pouvoir n’a encore assez joué."
        render={(row) => (
          <>
            <strong>{powerName(t, row.power)}</strong>
            <span className="note">
              {Math.round(averagePoints(row))} pts en moyenne · {formatNumber(t, row.runs)} parties
            </span>
          </>
        )}
      />

      <Chart
        title={`Parties ${every}`}
        note={`Les ${span} qui précèdent, heure de Paris.`}
        buckets={buckets}
        step={step}
        field="runs"
        unit={(count) => (count > 1 ? 'parties' : 'partie')}
      />

      <Chart
        title={`Nouveaux comptes ${every}`}
        note="Comptes nommés créés, sans les joueurs anonymes d’un premier lancement."
        buckets={buckets}
        step={step}
        field="accounts"
        unit={(count) => (count > 1 ? 'comptes' : 'compte')}
      />

      <Ranking
        title="Couples catégorie + lettre les plus rentables"
        note={`Points qu’un tirage rapporte en moyenne, parmi les couples tirés au moins ${MIN_PAIR_DEALT} fois.`}
        rows={rich}
        empty="Aucun couple n’a encore assez tourné."
        render={(row) => (
          <>
            <strong>{pairName(t, row)}</strong>
            <span className="note">
              {Math.round(pairYield(row))} pts par tirage · {formatNumber(t, row.words)} mots · {formatNumber(t, row.dealt)} tirages
            </span>
          </>
        )}
      />

      <Ranking
        title="Couples les plus passés"
        note={`Part des tirages quittés sans rien écrire, parmi les couples tirés au moins ${MIN_PAIR_DEALT} fois.`}
        rows={passed}
        empty="Aucun couple n’a encore assez tourné."
        render={(row) => (
          <>
            <strong>{pairName(t, row)}</strong>
            <span className="note">
              {Math.round(passRate(row) * 100)} % quittés · {formatNumber(t, row.passed)} sur {formatNumber(t, row.dealt)} tirages
            </span>
          </>
        )}
      />
    </section>
  )
}

type Translator = ReturnType<typeof useT>

function powerName(t: Translator, power: string): string {
  return isPowerId(power) ? t.powers.names[power][0] : power
}

function pairName(t: Translator, pair: PairTally): string {
  return `${categoryText(t, pair.categoryId).label} · ${pair.letter}`
}

/**
 * Un classement avancé : ses lignes, et « Voir plus » au-delà de dix — les
 * queues de classement n'intéressent personne, mais elles restent là.
 */
function Ranking<T>({
  title,
  note,
  rows,
  render,
  empty = 'Rien à montrer pour l’instant.',
}: {
  title: string
  note: string
  rows: readonly T[]
  render(row: T): ReactNode
  empty?: string
}) {
  const [whole, setWhole] = useState(false)
  const shown = whole ? rows : rows.slice(0, INSIGHT_ROWS)
  return (
    <section className="insight stack">
      <p className="section-title">{title}</p>
      <p className="note">{note}</p>
      {shown.length === 0 ? (
        <p className="note">{empty}</p>
      ) : (
        <ol className="insight-rows">
          {shown.map((row, index) => (
            <li className="insight-row" key={index}>
              <span className="rank">{index + 1}</span>
              <span className="insight-line">{render(row)}</span>
            </li>
          ))}
        </ol>
      )}
      {rows.length > INSIGHT_ROWS && (
        <button type="button" className="btn btn--quiet" onClick={() => setWhole(!whole)}>
          {whole ? 'Voir moins' : `Voir plus (${rows.length - INSIGHT_ROWS})`}
        </button>
      )}
    </section>
  )
}

/** Le rythme du jeu, une barre par heure, par jour ou par semaine. */
function Chart({
  title,
  note,
  buckets,
  step,
  field,
  unit,
}: {
  title: string
  note: string
  buckets: readonly ActivityBucket[]
  step: 'hour' | 'day' | 'week'
  field: 'runs' | 'accounts'
  unit(count: number): string
}) {
  const t = useT()
  const top = peak(buckets, field)
  const total = buckets.reduce((sum, bucket) => sum + bucket[field], 0)
  return (
    <section className="insight stack">
      <div className="spread">
        <p className="section-title">{title}</p>
        <p className="note">
          {formatNumber(t, total)} {unit(total)}
        </p>
      </div>
      <p className="note">{note}</p>
      <div
        className={`insight-chart insight-chart--${field}`}
        role="img"
        aria-label={`${title} : ${formatNumber(t, total)} ${unit(total)}`}
      >
        {buckets.map((bucket) => (
          <span className="insight-bar" key={bucket.at} title={`${when(t, bucket.at, step)} · ${bucket[field]}`}>
            <span className="insight-bar-fill" style={{ '--ratio': bucket[field] / top } as CSSProperties} />
          </span>
        ))}
      </div>
      <p className="note">
        {when(t, buckets[0]?.at ?? 0, step)} → {when(t, buckets[buckets.length - 1]?.at ?? 0, step)} · au plus{' '}
        {formatNumber(t, top)} par case
      </p>
    </section>
  )
}

/** Le nom d'une case : l'heure, le jour ou le lundi de la semaine, dans la langue de l'interface. */
function when(t: Translator, at: number, step: 'hour' | 'day' | 'week'): string {
  const date = new Date(at)
  if (step === 'hour') return date.toLocaleTimeString(t.tag, { hour: 'numeric' })
  if (step === 'day') return date.toLocaleDateString(t.tag, { weekday: 'short', day: 'numeric', month: 'short' })
  return date.toLocaleDateString(t.tag, { day: 'numeric', month: 'short', year: 'numeric' })
}
