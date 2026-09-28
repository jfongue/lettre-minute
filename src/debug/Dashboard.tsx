import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { isPowerId } from '../domain/powers'
import { categoryText, useT } from '../i18n'
import { fetchDashboard } from '../lib/cloud'
import type { DayRow, Snapshot } from './snapshot'

/*
 * Le tableau de bord de l'administrateur : cinq tapes sur « Classements »
 * l'ouvrent, par-dessus tout le reste, et seul un administrateur (0030,
 * `admin_analytics`) y reçoit des chiffres. Le même relevé que l'artefact
 * nourri par `npm run analytics`, mais lu à l'ouverture.
 *
 * Un outil de développeur : libellés français hors de l'i18n, comme la
 * planche ; les noms de pouvoirs et de catégories viennent de l'interface.
 */

export type LoadDashboard = () => Promise<Snapshot | null>

/** Le chargeur, posé sur `body` : le tiroir du menu est trop étroit pour lui. */
export function Dashboard({ onClose, load = fetchDashboard }: { onClose(): void; load?: LoadDashboard }) {
  const [data, setData] = useState<Snapshot | null | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    load().then((found) => live && setData(found))
    return () => {
      live = false
    }
  }, [load, attempt])
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return createPortal(
    <div className="dashboard dashboard--overlay" data-no-swipe role="dialog" aria-label="Tableau de bord">
      <DashboardView data={data} onClose={onClose} onReload={() => {
          setData(undefined)
          setAttempt(attempt + 1)
        }} />
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ bulle */

interface Tip {
  x: number
  y: number
  body: ReactNode
}

const TipContext = createContext<(tip: Tip | null) => void>(() => {})

/** Survol à la souris, toucher au doigt : la bulle suit, puis s'efface d'elle-même au doigt. */
function useTip(body: ReactNode) {
  const show = useContext(TipContext)
  const at = (event: React.PointerEvent) => show({ x: event.clientX, y: event.clientY, body })
  return {
    onPointerEnter: (event: React.PointerEvent) => event.pointerType !== 'touch' && at(event),
    onPointerMove: (event: React.PointerEvent) => event.pointerType !== 'touch' && at(event),
    onPointerLeave: (event: React.PointerEvent) => event.pointerType !== 'touch' && show(null),
    onPointerDown: (event: React.PointerEvent) => event.pointerType === 'touch' && at(event),
  }
}

function Bubble({ tip }: { tip: Tip | null }) {
  const box = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<CSSProperties>({})
  useEffect(() => {
    const element = box.current
    if (!tip || !element) return
    const { width, height } = element.getBoundingClientRect()
    let x = tip.x + 14
    let y = tip.y - height - 10
    if (x + width > window.innerWidth - 8) x = Math.max(8, tip.x - width - 14)
    if (y < 8) y = tip.y + 16
    setPlace({ left: x, top: y })
  }, [tip])
  return (
    <div ref={box} className={`dashboard-tip${tip ? ' dashboard-tip--on' : ''}`} style={place} role="tooltip">
      {tip?.body}
    </div>
  )
}

/* ---------------------------------------------------------------- libellés */

const DOW = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
const SCREENS: Record<string, string> = {
  home: 'Accueil',
  loading: 'Chargement',
  countdown: 'Annonce',
  playing: 'Partie',
  over: 'Bilan',
  tutorial: 'Tutoriel',
  avatar: 'Avatar',
  moderation: 'Modération',
  challenge: 'Défi',
  'challenge-create': 'Créer un défi',
  'challenge-powers': 'Pouvoirs du défi',
}
const FEATURES: Record<string, string> = {
  swap: 'Échange de catégorie',
  category_chosen: 'Catégorie choisie',
  power_chosen: 'Pouvoir choisi',
  premium_joined: 'Premium',
  hidden_words_peek: 'Mots cachés révélés',
  category_ban: 'Catégorie bannie',
  category_unban: 'Catégorie rétablie',
  word_proposed: 'Mot proposé',
  challenge_created: 'Défi créé',
  challenge_rematch: 'Revanche',
  theme: 'Thème changé',
  push_accepted: 'Notifications acceptées',
  store_update: 'Mise à jour Play',
  avatar_saved: 'Avatar changé',
  language: 'Langue choisie',
}
const KINDS: Record<string, string> = {
  open: 'Ouvertures',
  ready: 'Accueil prêt',
  screen: 'Écrans',
  tap: 'Boutons touchés',
  run_start: 'Parties lancées',
  run_end: 'Parties finies',
  feature: 'Fonctions',
  signup: 'Inscriptions',
  login: 'Connexions',
  logout: 'Déconnexions',
  erase: 'Comptes effacés',
  error: 'Erreurs',
  hide: 'Mises en arrière-plan',
}

const screenName = (screen: string) =>
  SCREENS[screen] ?? (screen.startsWith('menu:') ? `Menu · ${screen.slice(5)}` : screen || '?')

const fmt = (value: number | null | undefined) => (value == null ? '—' : Number(value).toLocaleString('fr-FR'))
const decimal = (value: number | null | undefined) => (value == null ? '—' : String(value).replace('.', ','))
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)} %` : '—')
const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `il y a ${hours} h` : `il y a ${Math.round(hours / 24)} jours`
}

/* ------------------------------------------------------------------ la vue */

const RANGES = [7, 14, 30] as const
type Range = (typeof RANGES)[number]

/** `undefined` : le relevé arrive ; `null` : pas administrateur, ou serveur muet. */
export function DashboardView({
  data,
  onClose,
  onReload,
}: {
  data: Snapshot | null | undefined
  onClose?(): void
  onReload?(): void
}) {
  const [tip, setTip] = useState<Tip | null>(null)
  const clear = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = (next: Tip | null) => {
    clearTimeout(clear.current)
    setTip(next)
    if (next) clear.current = setTimeout(() => setTip(null), 4000)
  }

  return (
    <TipContext.Provider value={show}>
      <div className="dashboard-wrap">
        <header className="dashboard-head">
          {onClose && (
            <button type="button" className="btn btn--quiet btn--muted dashboard-close" onClick={onClose}>
              ← Fermer
            </button>
          )}
          <div className="dashboard-tiles" aria-hidden="true">
            <span className="a" />
            <span className="b" />
            <span className="c" />
            <span className="d" />
            <span className="e" />
          </div>
          <div className="dashboard-headline">
            <h1>
              Lettre <em>Minute</em>
              <br />
              tableau de bord
            </h1>
            {data && (
              <div className="dashboard-stamp">
                <span className="dashboard-pill">
                  <i />
                  Relevé {ago(data.generated_at)}
                </span>
                {onReload && (
                  <button type="button" className="btn btn--quiet" onClick={onReload}>
                    Rafraîchir
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
        {data === undefined ? (
          <div className="dashboard-state">
            <div className="home-loader" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p>Lecture des chiffres du jeu…</p>
          </div>
        ) : data === null ? (
          <div className="dashboard-state">
            <p>Réservé à l’administrateur (ou serveur injoignable).</p>
            {onReload && (
              <button type="button" className="btn btn--quiet" onClick={onReload}>
                Réessayer
              </button>
            )}
          </div>
        ) : (
          <Body data={data} />
        )}
      </div>
      <Bubble tip={tip} />
    </TipContext.Provider>
  )
}

function Body({ data: d }: { data: Snapshot }) {
  const t = useT()
  const [range, setRange] = useState<Range>(14)
  const daily = d.daily.slice(-range)
  const sum = (key: keyof DayRow) => daily.reduce((total, row) => total + (Number(row[key]) || 0), 0)
  const tracked = Boolean(d.tracking_since)
  const s = d.sessions
  const noTrack = (
    <div className="dashboard-empty">
      {tracked
        ? `Suivi détaillé depuis le ${new Date(d.tracking_since!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`
        : 'Le suivi détaillé démarre avec la version qui l’embarque : web dès sa publication, Android à la prochaine mise à jour.'}
    </div>
  )

  return (
    <div className="dashboard-body">
      <div className="dashboard-kpis">
        <Kpi label="Joueurs" value={fmt(d.totals.players)}>
          <b>+{fmt(d.today.new_players)}</b> aujourd’hui
        </Kpi>
        <Kpi label="Comptes nommés" value={fmt(d.totals.named)}>
          <b>+{fmt(d.today.signups)}</b> aujourd’hui · {pct(d.totals.named, d.totals.players)}
        </Kpi>
        <Kpi label="Actifs" value={fmt(d.active.dau)}>
          aujourd’hui · <b>{fmt(d.active.wau)}</b> sur 7 j · <b>{fmt(d.active.mau)}</b> sur 30 j
        </Kpi>
        <Kpi label="Parties" value={fmt(d.today.runs)}>
          aujourd’hui · <b>{fmt(d.totals.runs)}</b> au total
        </Kpi>
        <Kpi label="Ouvertures" value={tracked ? fmt(d.today.opens) : '—'}>
          aujourd’hui{tracked ? <> · <b>{pct(s.without_run, s.total)}</b> sans partie</> : ' · suivi à venir'}
        </Kpi>
        <Kpi label="Accueil prêt" value={s.ready_p50_ms != null ? seconds(s.ready_p50_ms) : '—'}>
          médiane{s.ready_p90_ms != null && <> · <b>{seconds(s.ready_p90_ms)}</b> au 9ᵉ décile</>}
        </Kpi>
      </div>

      <Section title="Activité" mark="var(--blue)" aside={
        <div className="layer-tabs dashboard-range" role="tablist" aria-label="Période">
          {RANGES.map((days) => (
            <button
              key={days}
              type="button"
              role="tab"
              aria-selected={range === days}
              className={`layer-tab${range === days ? ' layer-tab--on' : ''}`}
              onClick={() => setRange(days)}
            >
              {days} j
            </button>
          ))}
        </div>
      }>
        <div className="dashboard-grid">
          <Card title="Parties par jour" tag={fmt(sum('runs'))}>
            <DayBars rows={daily} series={[{ key: 'runs', label: 'Parties', color: 'var(--blue)' }]} />
          </Card>
          <Card title="Joueurs actifs par jour">
            <DayBars rows={daily} series={[{ key: 'players', label: 'Joueurs actifs', color: 'var(--green)' }]} />
          </Card>
          <Card title="Arrivées et inscriptions" tag={`${fmt(sum('new_players'))} arrivées · ${fmt(sum('signups'))} inscrits`}>
            <Legend items={[{ label: 'Restés anonymes', color: 'var(--blue)' }, { label: 'Comptes nommés', color: 'var(--red)' }]} />
            <DayBars
              rows={daily.map((row) => ({ ...row, anon: Math.max(0, row.new_players - row.signups) }))}
              series={[
                { key: 'signups', label: 'Comptes nommés', color: 'var(--red)' },
                { key: 'anon', label: 'Restés anonymes', color: 'var(--blue)' },
              ]}
            />
            <p className="note">Un joueur arrive anonyme à sa première ouverture ; l’inscription se date à la confirmation de son adresse.</p>
          </Card>
          <Card title="Ouvertures de l’app, avec ou sans partie">
            {tracked ? (
              <>
                <Legend items={[{ label: 'Avec partie', color: 'var(--green)' }, { label: 'Sans partie', color: 'var(--yellow)' }]} />
                <DayBars
                  rows={daily}
                  series={[
                    { key: 'sessions_with_run', label: 'Avec partie', color: 'var(--green)' },
                    { key: 'sessions_without_run', label: 'Sans partie', color: 'var(--yellow)' },
                  ]}
                />
              </>
            ) : (
              noTrack
            )}
          </Card>
        </div>
      </Section>

      <Section title="Sessions" mark="var(--yellow)" round aside={<p className="note">{d.days} derniers jours</p>}>
        {tracked ? (
          <div className="dashboard-stats">
            <Stat value={fmt(s.total)} label="ouvertures" />
            <Stat value={fmt(s.with_run)} label={`avec partie · ${pct(s.with_run, s.total)}`} />
            <Stat value={fmt(s.without_run)} label={`sans partie · ${pct(s.without_run, s.total)}`} />
            <Stat value={decimal(s.runs_per_session)} label="parties par session jouée" />
            <Stat value={s.median_seconds != null ? `${decimal(Math.round((s.median_seconds / 60) * 10) / 10)} min` : '—'} label="durée médiane" />
            <Stat value={fmt(s.cold_opens)} label={`lancements · ${fmt(s.resumes)} retours`} />
          </div>
        ) : (
          noTrack
        )}
        <div className="dashboard-grid">
          <Card title="Quand on joue" note="Parties par jour de la semaine et heure de Paris.">
            <Heatmap cells={d.hourly} />
          </Card>
          <Card title="Du premier lancement au compte" note="Joueurs arrivés sur la période, selon ce qu’ils ont fait depuis.">
            <Bars
              items={[
                ['Nouveaux joueurs', d.funnel.new_players],
                ['Au moins 1 partie', d.funnel.played_1],
                ['Au moins 3 parties', d.funnel.played_3],
                ['Au moins 10 parties', d.funnel.played_10],
                ['Compte nommé', d.funnel.named],
              ] as const}
              name={([label]) => label}
              value={([, count]) => count}
              sub={([, count]) => pct(count, d.funnel.new_players)}
              max={Math.max(1, d.funnel.new_players)}
            />
          </Card>
        </div>
        <Card title="Rétention par semaine d’arrivée" note="Part des joueurs revenus jouer ou ouvrir l’app.">
          <Retention rows={d.retention} />
        </Card>
      </Section>

      <Section title="Ce que les joueurs touchent" mark="var(--red)" aside={tracked && <p className="note">boutons et liens, écran par écran</p>}>
        {tracked ? (
          <div className="dashboard-grid">
            <Card title="Boutons les plus touchés">
              <Bars
                items={d.taps}
                name={(tap) => (
                  <>
                    <small>{screenName(tap.screen)}</small>
                    {tap.label}
                  </>
                )}
                value={(tap) => tap.n}
                sub={(tap) => `${fmt(tap.devices)} app.`}
                color="var(--red)"
                limit={12}
              />
            </Card>
            <Card title="Fonctions utilisées">
              <Bars
                items={d.features}
                name={(feature) => FEATURES[feature.name] ?? feature.name}
                value={(feature) => feature.n}
                sub={(feature) => `${fmt(feature.devices)} app.`}
                color="var(--green)"
              />
              <h3>Écrans ouverts</h3>
              <Bars items={d.screens} name={(screen) => screenName(screen.name)} value={(screen) => screen.n} sub={(screen) => `${fmt(screen.devices)} app.`} />
            </Card>
            <Card title="Tous les événements">
              <Bars items={d.kinds} name={(kind) => KINDS[kind.kind] ?? kind.kind} value={(kind) => kind.n} sub={(kind) => `${fmt(kind.devices)} app.`} limit={14} />
            </Card>
          </div>
        ) : (
          noTrack
        )}
      </Section>

      <Section
        title="Parties"
        mark="var(--green)"
        aside={<p className="note">{fmt(d.runs.count)} parties seules et {fmt(d.runs.challenge_runs)} en défi sur {d.days} jours</p>}
      >
        <div className="dashboard-stats">
          <Stat value={fmt(d.runs.avg_score)} label="points en moyenne" />
          <Stat value={fmt(d.runs.median_score)} label="points médians" />
          <Stat value={decimal(d.runs.avg_words)} label="mots par partie" />
          <Stat value={decimal(d.runs.avg_skips)} label="passes par partie" />
        </div>
        <div className="dashboard-grid">
          <Card title="Scores" note="Parties par tranche de 50 points.">
            <Histogram buckets={d.runs.scores} />
          </Card>
          <Card title="Pouvoirs joués">
            <Bars
              items={d.runs.powers}
              name={(power) => (isPowerId(power.power) ? t.powers.names[power.power][0] : power.power)}
              value={(power) => power.runs}
              sub={(power) => `${fmt(power.avg_score)} pts moy.`}
              color="var(--yellow)"
            />
          </Card>
          <Card title="Catégories">
            <Bars
              items={d.runs.categories}
              name={(category) => categoryText(t, category.category).label}
              value={(category) => category.words}
              sub={(category) => `${fmt(category.points)} pts`}
            />
          </Card>
          <Card title="Mots les plus écrits">
            <Bars
              items={d.runs.top_words}
              name={(word) => (
                <>
                  <small>{categoryText(t, word.category).label}</small>
                  {word.word}
                </>
              )}
              value={(word) => word.n}
              color="var(--green)"
            />
          </Card>
        </div>
      </Section>

      <Section title="Joueurs" mark="var(--pink)">
        <div className="dashboard-grid">
          <Card title="Les plus assidus">
            <Table head={['Joueur', 'Parties', 'Record']}>
              {d.top_players.map((player, index) => (
                <tr key={index}>
                  <td>
                    {player.name}
                    {player.anonymous && <span className="dashboard-tag">anonyme</span>}
                  </td>
                  <td className="n">{fmt(player.runs)}</td>
                  <td className="n">{fmt(player.best)}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Dernières inscriptions">
            <Table head={['Nom', 'Inscrit', 'Parties', 'Record']}>
              {d.recent_signups.map((player, index) => (
                <tr key={index}>
                  <td>{player.name ?? '—'}</td>
                  <td>{ago(player.at)}</td>
                  <td className="n">{fmt(player.runs)}</td>
                  <td className="n">{fmt(player.best)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </Section>

      <Section title="Communauté et appareils" mark="var(--blue)" round>
        <div className="dashboard-stats">
          <Stat value={fmt(d.challenges.created)} label={`défis créés · ${decimal(d.challenges.avg_players)} joueurs moy.`} />
          <Stat value={pct(d.challenges.played_share ?? 0, 1)} label="des invités ont joué" />
          <Stat value={fmt(d.totals.friendships)} label="amitiés" />
          <Stat value={fmt(d.moderation.submitted)} label={`mots proposés · ${fmt(d.moderation.accepted)} acceptés`} />
          <Stat value={fmt(d.totals.submissions_pending)} label="mots en attente" />
          <Stat value={fmt(d.moderation.votes)} label={`votes · ${fmt(d.totals.moderators)} modérateurs`} />
          <Stat value={fmt(d.totals.ideas_open)} label="idées à lire" />
          <Stat value={fmt(d.totals.push_devices)} label="téléphones notifiables" />
        </div>
        {tracked && (
          <div className="dashboard-grid">
            <Card title="Plateformes et versions">
              <Bars
                items={d.platforms}
                name={(platform) => (
                  <>
                    {platform.platform === 'android' ? 'Android' : platform.platform === 'web' ? 'Web' : platform.platform}{' '}
                    <small>{platform.version}</small>
                  </>
                )}
                value={(platform) => platform.devices}
                sub={() => 'app.'}
              />
            </Card>
            <Card title="Langues">
              <Bars items={d.langs} name={(lang) => lang.lang.toUpperCase()} value={(lang) => lang.devices} sub={() => 'app.'} color="var(--green)" />
            </Card>
            <Card title="Erreurs">
              {d.errors.length ? (
                <Table head={['Message', 'Fois', 'App.', 'Dernière']}>
                  {d.errors.map((error, index) => (
                    <tr key={index}>
                      <td className="dashboard-error">{error.message}</td>
                      <td className="n">{fmt(error.n)}</td>
                      <td className="n">{fmt(error.devices)}</td>
                      <td>{ago(error.last)}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <div className="dashboard-empty">Aucune erreur remontée.</div>
              )}
            </Card>
          </div>
        )}
      </Section>

      <p className="note">
        « app. » compte les appareils distincts. Les joueurs maison (Maxitoon, Terretciel) sont exclus partout. Chiffres
        calculés par <code>analytics_snapshot</code> à l’ouverture.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ morceaux */

function Kpi({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="dashboard-kpi">
      <span className="dashboard-kpi-label">{label}</span>
      <span className="dashboard-kpi-value">{value}</span>
      <span className="note">{children}</span>
    </div>
  )
}

function Section({
  title,
  mark,
  round = false,
  aside,
  children,
}: {
  title: string
  mark: string
  round?: boolean
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-head">
        <h2>
          <span className="dashboard-mark" style={{ background: mark, borderRadius: round ? '50%' : 0 }} aria-hidden="true" />
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Card({ title, tag, note, children }: { title: string; tag?: string; note?: string; children: ReactNode }) {
  return (
    <div className="dashboard-card">
      <h3>
        {title} {tag && <span className="dashboard-tag">{tag}</span>}
      </h3>
      {note && <p className="note">{note}</p>}
      {children}
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="dashboard-stat">
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="dashboard-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="dashboard-table">
      <table>
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={cell} className={index > 0 && cell !== 'Inscrit' && cell !== 'Dernière' ? 'n' : undefined}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

/** Une liste à barres ; au-delà de `limit`, « Voir les N lignes ». */
function Bars<T>({
  items,
  name,
  value,
  sub,
  color = 'var(--blue)',
  limit = 10,
  max,
}: {
  items: readonly T[]
  name(item: T): ReactNode
  value(item: T): number
  sub?(item: T): string
  color?: string
  limit?: number
  max?: number
}) {
  const [whole, setWhole] = useState(false)
  if (items.length === 0) return <div className="dashboard-empty">Rien encore sur la période.</div>
  const top = max ?? Math.max(1, ...items.map(value))
  const shown = whole ? items : items.slice(0, limit)
  return (
    <>
      <ul className="dashboard-bars">
        {shown.map((item, index) => (
          <li key={index}>
            <span className="dashboard-bars-name">{name(item)}</span>
            <span className="dashboard-bars-num">
              <b>{fmt(value(item))}</b>
              {sub && ` · ${sub(item)}`}
            </span>
            <span className="dashboard-bars-track">
              <span style={{ width: `${(value(item) / top) * 100}%`, background: color }} />
            </span>
          </li>
        ))}
      </ul>
      {items.length > limit && (
        <button type="button" className="btn btn--quiet dashboard-more" onClick={() => setWhole(!whole)}>
          {whole ? 'Voir moins' : `Voir les ${items.length} lignes`}
        </button>
      )}
    </>
  )
}

const W = 560

const read = (row: Day, key: Series['key']) => row[key] ?? 0

function niceMax(value: number): number {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  const n = value / power
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power
}

/** Le bout d'une barre arrondi, sa base droite sur l'axe. */
function roundedTop(x: number, base: number, width: number, height: number): string {
  const r = Math.min(3, height, width / 2)
  return `M${x},${base} v${-(height - r)} q0,${-r} ${r},${-r} h${width - 2 * r} q${r},0 ${r},${r} v${height - r} z`
}

type Day = DayRow & { anon?: number }

interface Series {
  key: 'runs' | 'players' | 'signups' | 'anon' | 'sessions_with_run' | 'sessions_without_run'
  label: string
  color: string
}

/** Une barre par jour ; plusieurs séries s'empilent depuis l'axe. */
function DayBars({ rows, series }: { rows: readonly Day[]; series: Series[] }) {
  const H = 170
  const left = 30
  const bottom = 22
  const top = 16
  const totals = rows.map((row) => series.reduce((total, one) => total + read(row, one.key), 0))
  const max = niceMax(Math.max(1, ...totals))
  const band = (W - left) / Math.max(1, rows.length)
  const y = (value: number) => top + (H - top - bottom) * (1 - value / max)
  const every = Math.ceil(rows.length / 7)
  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[0, 1, 2].map((step) => (
        <g key={step}>
          <line x1={left} x2={W} y1={y((max / 2) * step)} y2={y((max / 2) * step)} stroke="var(--grid)" />
          <text x={left - 6} y={y((max / 2) * step) + 4} textAnchor="end">
            {fmt((max / 2) * step)}
          </text>
        </g>
      ))}
      {rows.map((row, index) => (
        <DayColumn key={row.day} row={row} index={index} series={series} band={band} left={left} y={y} top={top} height={H - top - bottom} />
      ))}
      {rows.map((row, index) =>
        (index % every === 0 && rows.length - 1 - index >= every * 0.6) || index === rows.length - 1 ? (
          <text key={row.day} x={left + index * band + band / 2} y={H - 6} textAnchor="middle">
            {dayLabel(row.day)}
          </text>
        ) : null,
      )}
      {series.length === 1 && rows.length > 0 && (
        <text className="dashboard-chart-value" x={left + (rows.length - 0.5) * band} y={y(totals[totals.length - 1]!) - 5} textAnchor="middle">
          {fmt(totals[totals.length - 1])}
        </text>
      )}
      <line x1={left} x2={W} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
    </svg>
  )
}

function DayColumn({
  row,
  index,
  series,
  band,
  left,
  y,
  top,
  height,
}: {
  row: Day
  index: number
  series: Series[]
  band: number
  left: number
  y(value: number): number
  top: number
  height: number
}) {
  const tip = useTip(
    <>
      <b>{dayLabel(row.day)}</b>
      {series
        .slice()
        .reverse()
        .map((one) => (
          <span key={one.key}>
            <br />
            {one.label} : <b>{fmt(read(row, one.key))}</b>
          </span>
        ))}
    </>,
  )
  const x = left + index * band
  const width = Math.max(2, band - Math.min(6, band * 0.3))
  const values = series.map((one) => read(row, one.key))
  const last = values.findLastIndex((value) => value > 0)
  const bases = values.map((_, rank) => values.slice(0, rank).reduce((total, value) => total + value, 0))
  return (
    <g className="dashboard-column">
      {series.map((one, rank) => {
        const value = values[rank]!
        const base = bases[rank]!
        if (!value) return null
        const gap = base > 0 ? 2 : 0
        const y0 = y(base) - gap
        const h = Math.max(1, y(base) - y(base + value) - gap)
        return rank === last ? (
          <path key={one.key} fill={one.color} d={roundedTop(x + (band - width) / 2, y0, width, h)} />
        ) : (
          <rect key={one.key} fill={one.color} x={x + (band - width) / 2} y={y0 - h} width={width} height={h} />
        )
      })}
      <rect className="dashboard-hit" x={x} y={top} width={band} height={height} {...tip} />
    </g>
  )
}

function Heatmap({ cells }: { cells: Snapshot['hourly'] }) {
  const grid = new Map(cells.map((cell) => [`${cell.dow}:${cell.hour}`, cell.runs]))
  const max = Math.max(1, ...cells.map((cell) => cell.runs))
  const left = 34
  const cw = (W - left) / 24
  const ch = 18
  const H = ch * 7 + 24
  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {DOW.map((day, row) => (
        <g key={day}>
          <text x={left - 6} y={4 + row * ch + ch / 2 + 4} textAnchor="end">
            {day}
          </text>
          {Array.from({ length: 24 }, (_, hour) => (
            <HeatCell key={hour} x={left + hour * cw + 1} y={4 + row * ch + 1} w={cw - 2} h={ch - 2} value={grid.get(`${row + 1}:${hour}`) ?? 0} max={max} label={`${day} ${hour} h–${hour + 1} h`} />
          ))}
        </g>
      ))}
      {[0, 6, 12, 18, 23].map((hour) => (
        <text key={hour} x={left + hour * cw + cw / 2} y={H - 4} textAnchor="middle">
          {hour} h
        </text>
      ))}
    </svg>
  )
}

function HeatCell({ x, y, w, h, value, max, label }: { x: number; y: number; w: number; h: number; value: number; max: number; label: string }) {
  const tip = useTip(
    <>
      <b>{label}</b>
      <br />
      {fmt(value)} partie{value > 1 ? 's' : ''}
    </>,
  )
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={2}
      fill={value ? 'var(--blue)' : 'var(--grid)'}
      fillOpacity={value ? 0.15 + 0.85 * (value / max) : 1}
      {...tip}
    />
  )
}

function Histogram({ buckets }: { buckets: Snapshot['runs']['scores'] }) {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    from: index * 50,
    n: buckets.find((bucket) => bucket.from === index * 50)?.n ?? 0,
  }))
  while (rows.length > 4 && rows[rows.length - 1]!.n === 0) rows.pop()
  const H = 160
  const left = 30
  const bottom = 22
  const top = 14
  const max = niceMax(Math.max(1, ...rows.map((row) => row.n)))
  const band = (W - left) / rows.length
  const y = (value: number) => top + (H - top - bottom) * (1 - value / max)
  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[0, 1, 2].map((step) => (
        <g key={step}>
          <line x1={left} x2={W} y1={y((max / 2) * step)} y2={y((max / 2) * step)} stroke="var(--grid)" />
          <text x={left - 6} y={y((max / 2) * step) + 4} textAnchor="end">
            {fmt((max / 2) * step)}
          </text>
        </g>
      ))}
      {rows.map((row, index) => (
        <ScoreBar key={row.from} row={row} x={left + index * band} band={band} y={y} top={top} height={H - top - bottom} />
      ))}
      {rows.map((row, index) =>
        index % 2 === 0 ? (
          <text key={row.from} x={left + index * band + band / 2} y={H - 6} textAnchor="middle">
            {row.from}
          </text>
        ) : null,
      )}
      <line x1={left} x2={W} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
    </svg>
  )
}

function ScoreBar({ row, x, band, y, top, height }: { row: { from: number; n: number }; x: number; band: number; y(value: number): number; top: number; height: number }) {
  const tip = useTip(
    <>
      <b>{row.from >= 1000 ? '1 000 et +' : `${row.from}–${row.from + 49}`} points</b>
      <br />
      {fmt(row.n)} partie{row.n > 1 ? 's' : ''}
    </>,
  )
  return (
    <g className="dashboard-column">
      {row.n > 0 && <path fill="var(--green)" d={roundedTop(x + 1.5, y(0), band - 3, y(0) - y(row.n))} />}
      <rect className="dashboard-hit" x={x} y={top} width={band} height={height} {...tip} />
    </g>
  )
}

function Retention({ rows }: { rows: Snapshot['retention'] }) {
  if (rows.length === 0) return <div className="dashboard-empty">Pas encore de cohorte.</div>
  const cell = (count: number, size: number) => {
    const ratio = size ? count / size : 0
    return (
      <td className="n">
        <span
          className="dashboard-cell"
          style={{
            background: `color-mix(in srgb, var(--blue) ${Math.round(ratio * 70)}%, transparent)`,
            color: ratio > 0.45 ? 'var(--cream)' : undefined,
          }}
          title={`${fmt(count)} sur ${fmt(size)}`}
        >
          {pct(count, size)}
        </span>
      </td>
    )
  }
  return (
    <Table head={['Semaine d’arrivée', 'Joueurs', 'Le lendemain', 'Dans la semaine', 'Après 7 j']}>
      {rows
        .slice()
        .reverse()
        .map((row) => (
          <tr key={row.week}>
            <td>{dayLabel(row.week)}</td>
            <td className="n">{fmt(row.size)}</td>
            {cell(row.d1, row.size)}
            {cell(row.w1, row.size)}
            {cell(row.later, row.size)}
          </tr>
        ))}
    </Table>
  )
}
