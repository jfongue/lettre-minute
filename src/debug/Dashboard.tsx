import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { parseAvatar } from '../domain/avatar'
import { isPowerId } from '../domain/powers'
import { levelFor } from '../domain/progression'
import { categoryText, useT } from '../i18n'
import { fetchDashboard, fetchDashboardSlot } from '../lib/cloud'
import { Avatar } from '../ui/Avatar'
import { Card, Kpi, Legend, Section, Stat, Table } from './board'
import { ago, decimal, fmt, pct, share } from './format'
import type { DayRow, HourRow, Invites, PromptRow, Prompts, SlotEntry, Snapshot } from './snapshot'

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
export type LoadSlot = (day: string, hour?: number) => Promise<SlotEntry[] | null>

/** Le chargeur, posé sur `body` : le tiroir du menu est trop étroit pour lui. */
export function Dashboard({
  onClose,
  load = fetchDashboard,
  loadSlot = fetchDashboardSlot,
}: {
  onClose(): void
  load?: LoadDashboard
  loadSlot?: LoadSlot
}) {
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
      <DashboardView data={data} loadSlot={loadSlot} onClose={onClose} onReload={() => {
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

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/* ------------------------------------------------------------------ la vue */

const RANGES = [1, 7, 14, 30] as const
type Range = (typeof RANGES)[number]

/** `undefined` : le relevé arrive ; `null` : pas administrateur, ou serveur muet. */
export function DashboardView({
  data,
  loadSlot = fetchDashboardSlot,
  onClose,
  onReload,
}: {
  data: Snapshot | null | undefined
  loadSlot?: LoadSlot
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
          <Body data={data} loadSlot={loadSlot} />
        )}
      </div>
      <Bubble tip={tip} />
    </TipContext.Provider>
  )
}

function Body({ data: d, loadSlot }: { data: Snapshot; loadSlot: LoadSlot }) {
  const t = useT()
  const [range, setRange] = useState<Range>(14)
  const [picked, setPicked] = useState<Picked | null>(null)
  const pick = (title: string, series: Series[]) => (row: Day) => setPicked({ title, row, series })
  // « 1 j » : aujourd'hui heure par heure, et non une seule barre.
  const daily: (DayRow | HourRow)[] = range === 1 ? (d.today_hourly ?? []) : d.daily.slice(-range)
  const per = range === 1 ? 'par heure' : 'par jour'
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
          <Card title={`Parties ${per}`} tag={fmt(sum('runs'))}>
            <DayBars rows={daily} series={RUNS} onPick={pick('Parties', RUNS)} />
          </Card>
          <Card title={`Joueurs actifs ${per}`}>
            <DayBars rows={daily} series={PLAYERS} onPick={pick('Joueurs actifs', PLAYERS)} />
          </Card>
          <Card title="Arrivées et inscriptions" tag={`${fmt(sum('new_players'))} arrivées · ${fmt(sum('signups'))} inscrits`}>
            <Legend items={[{ label: 'Restés anonymes', color: 'var(--blue)' }, { label: 'Comptes nommés', color: 'var(--red)' }]} />
            <DayBars
              rows={daily.map((row) => ({ ...row, anon: Math.max(0, row.new_players - row.signups) }))}
              series={ARRIVALS}
              onPick={pick('Arrivées et inscriptions', ARRIVALS)}
            />
            <p className="note">Un joueur arrive anonyme à sa première ouverture ; l’inscription se date à la confirmation de son adresse.</p>
          </Card>
          <Card title="Ouvertures de l’app, avec ou sans partie">
            {tracked ? (
              <>
                <Legend items={[{ label: 'Avec partie', color: 'var(--green)' }, { label: 'Sans partie', color: 'var(--yellow)' }]} />
                <DayBars rows={daily} series={SESSIONS} onPick={pick('Ouvertures de l’app', SESSIONS)} />
              </>
            ) : (
              noTrack
            )}
          </Card>
        </div>
        <p className="note">Touche une barre pour voir les joueurs qu’elle compte.</p>
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

      {d.prompts && <PromptsSection prompts={d.prompts} />}

      {d.invites && <InvitesSection invites={d.invites} onPick={pick('Invitations', INVITES)} />}

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
        « app. » compte les appareils distincts. Les joueurs maison (Maxitoon, Terretciel) et l’administrateur, appareils compris, sont exclus partout. Chiffres
        calculés par <code>analytics_snapshot</code> à l’ouverture.
      </p>
      {picked && <SlotSheet key={`${picked.title}:${picked.row.day}:${picked.row.hour}`} picked={picked} load={loadSlot} onClose={() => setPicked(null)} />}
    </div>
  )
}

/* -------------------------------------------------------------- sections */

function PromptsSection({ prompts }: { prompts: Prompts }) {
  const t = useT()
  const [order, setOrder] = useState<'passed' | 'rate'>('passed')
  const [whole, setWhole] = useState(false)
  const rows = order === 'passed' ? prompts.most_passed : prompts.worst_rate
  const shown = whole ? rows : rows.slice(0, 15)
  const many = prompts.langs.length > 1
  const pair = (row: PromptRow) => (
    <>
      <b className="dashboard-letter">{row.letter}</b> {categoryText(t, row.category).label}
      {many && <span className="dashboard-tag">{row.lang.toUpperCase()}</span>}
    </>
  )
  return (
    <Section
      title="Couples lettre + catégorie"
      mark="var(--yellow)"
      aside={
        <div className="layer-tabs dashboard-range" role="tablist" aria-label="Ordre">
          {(['passed', 'rate'] as const).map((one) => (
            <button
              key={one}
              type="button"
              role="tab"
              aria-selected={order === one}
              className={`layer-tab${order === one ? ' layer-tab--on' : ''}`}
              onClick={() => setOrder(one)}
            >
              {one === 'passed' ? 'Plus passés' : 'Taux de passe'}
            </button>
          ))}
        </div>
      }
    >
      <div className="dashboard-stats">
        {prompts.langs.map((lang) => (
          <Stat
            key={lang.lang}
            value={pct(lang.passed, lang.dealt)}
            label={`passés${many ? ` en ${lang.lang.toUpperCase()}` : ''} · ${fmt(lang.dealt)} tirages, ${fmt(lang.pairs)} couples`}
          />
        ))}
      </div>
      {rows.length ? (
        <Table head={['Couple', 'Tirages', 'Apparition', 'Passés', 'Taux de passe', 'Mots / tirage']}>
          {shown.map((row) => (
            <tr key={`${row.lang}:${row.category}:${row.letter}`}>
              <td>{pair(row)}</td>
              <td className="n">{fmt(row.dealt)}</td>
              <td className="n">{share(row.dealt, row.lang_dealt)}</td>
              <td className="n">{fmt(row.passed)}</td>
              <td className="n">
                <span className="dashboard-cell" style={{ background: `color-mix(in srgb, var(--red) ${Math.round((row.passed / row.dealt) * 60)}%, transparent)` }}>
                  {pct(row.passed, row.dealt)}
                </span>
              </td>
              <td className="n">{decimal(Math.round((row.words / row.dealt) * 10) / 10)}</td>
            </tr>
          ))}
        </Table>
      ) : (
        <div className="dashboard-empty">Aucun couple assez tiré encore.</div>
      )}
      {rows.length > 15 && (
        <button type="button" className="btn btn--quiet dashboard-more" onClick={() => setWhole(!whole)}>
          {whole ? 'Voir moins' : `Voir les ${rows.length} couples`}
        </button>
      )}
      <p className="note">
        Depuis toujours, parties seules seulement : les compteurs du tirage ne savent pas qui a joué. « Apparition » : part des tirages de sa langue.
        {order === 'rate' && ' Taux de passe classé sur les couples tirés au moins dix fois.'}
      </p>
    </Section>
  )
}

function InvitesSection({ invites: v, onPick }: { invites: Invites; onPick(row: Day): void }) {
  const sent = v.mails + v.shares
  const joins = v.mail_joins + v.link_joins
  return (
    <Section title="Invitations" mark="var(--green)" round>
      <div className="dashboard-stats">
        <Stat value={fmt(sent)} label={`invitations · ${fmt(v.mails)} mails, ${fmt(v.shares)} liens partagés`} />
        <Stat value={pct(joins, sent)} label={`converties · ${fmt(joins)} venus`} />
        <Stat value={pct(v.mail_joins, v.mails)} label={`des mails · ${fmt(v.mail_joins)} venus`} />
        <Stat value={fmt(v.link_joins)} label={`venus par un lien · ${fmt(v.sharers)} app. ont partagé`} />
        <Stat value={pct(v.played, joins)} label={`des venus ont joué · ${fmt(v.played)}`} />
        <Stat value={fmt(v.mails_to_players)} label="mails vers un joueur déjà là" />
      </div>
      <div className="dashboard-grid">
        <Card title="Invitations par jour" tag={`${fmt(sent)} · ${fmt(joins)} venus`}>
          <Legend items={INVITES.map(({ label, color }) => ({ label, color }))} />
          <DayBars rows={v.daily} series={INVITES} onPick={onPick} />
        </Card>
        <Card title="Meilleurs inviteurs" note="Depuis toujours, classés par joueurs amenés.">
          {v.top.length ? (
            <Table head={['Joueur', 'Mails', 'Partages', 'Venus', 'Ont joué', 'Conversion']}>
              {v.top.map((player, index) => (
                <tr key={index}>
                  <td>
                    {player.name}
                    {player.anonymous && <span className="dashboard-tag">anonyme</span>}
                  </td>
                  <td className="n">{fmt(player.mails)}</td>
                  <td className="n">{fmt(player.shares)}</td>
                  <td className="n">{fmt(player.joins)}</td>
                  <td className="n">{fmt(player.played)}</td>
                  <td className="n">{pct(player.joins, player.mails + player.shares)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className="dashboard-empty">Personne n’a encore invité.</div>
          )}
        </Card>
      </div>
      <p className="note">
        Un partage est un toucher sur WhatsApp, Messenger, SMS… dans « Ajouter un ami » ; un mail vers une adresse qui joue déjà n’est qu’une demande d’ami.
        {v.links_since
          ? ` Venues par lien comptées depuis le ${new Date(v.links_since).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`
          : ' Les venues par lien se comptent depuis la migration 0036.'}
      </p>
    </Section>
  )
}

/* -------------------------------------------------- le détail d'une barre */

interface Picked {
  title: string
  row: Day
  series: Series[]
}

const RUNS: Series[] = [{ key: 'runs', label: 'Parties', color: 'var(--blue)' }]
const PLAYERS: Series[] = [{ key: 'players', label: 'Joueurs actifs', color: 'var(--green)' }]
const ARRIVALS: Series[] = [
  { key: 'signups', label: 'Comptes nommés', color: 'var(--red)' },
  { key: 'anon', label: 'Restés anonymes', color: 'var(--blue)' },
]
const SESSIONS: Series[] = [
  { key: 'sessions_with_run', label: 'Avec partie', color: 'var(--green)' },
  { key: 'sessions_without_run', label: 'Sans partie', color: 'var(--yellow)' },
]
const INVITES: Series[] = [
  { key: 'joins', label: 'Venus', color: 'var(--green)' },
  { key: 'mails', label: 'Mails', color: 'var(--blue)' },
  { key: 'shares', label: 'Liens partagés', color: 'var(--yellow)' },
]

/** Qui une série compte : la même règle que la barre, joueur par joueur. */
const COUNTS: Record<Series['key'], (entry: SlotEntry) => boolean> = {
  runs: (entry) => !entry.device && entry.runs > 0,
  players: (entry) => !entry.device && entry.active,
  signups: (entry) => !entry.device && entry.signed,
  anon: (entry) => !entry.device && entry.arrived && !entry.signed,
  sessions_with_run: (entry) => entry.sessions_with_run > 0,
  sessions_without_run: (entry) => entry.sessions_without_run > 0,
  mails: (entry) => !entry.device && entry.mails > 0,
  shares: (entry) => !entry.device && entry.shares > 0,
  joins: (entry) => !entry.device && entry.invited_by != null,
}

function SlotSheet({ picked, load, onClose }: { picked: Picked; load: LoadSlot; onClose(): void }) {
  const { row, series, title } = picked
  const [entries, setEntries] = useState<SlotEntry[] | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    load(row.day, row.hour).then((found) => live && setEntries(found))
    return () => {
      live = false
    }
  }, [load, row.day, row.hour])
  // Échap ferme la feuille, pas tout le tableau de bord qui écoute aussi.
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', close, true)
    return () => window.removeEventListener('keydown', close, true)
  }, [onClose])

  const counted = entries?.filter((entry) => series.some((one) => COUNTS[one.key](entry))) ?? []
  const when = row.hour == null ? dayLabel(row.day) : `${dayLabel(row.day)}, ${row.hour} h–${row.hour + 1} h`
  return createPortal(
    <div className="dashboard dashboard-slot" data-no-swipe role="dialog" aria-label={`${title}, ${when}`}>
      <button type="button" className="dashboard-slot-backdrop" aria-label="Fermer le détail" onClick={onClose} />
      <div className="dashboard-slot-panel">
        <div className="dashboard-slot-head">
          <div>
            <h3>{title}</h3>
            <p className="note">
              {when}
              {series.map((one) => (
                <span key={one.key}>
                  {' · '}
                  {one.label} <b>{fmt(read(row, one.key))}</b>
                </span>
              ))}
            </p>
          </div>
          <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
            Fermer
          </button>
        </div>
        {entries === undefined ? (
          <div className="dashboard-state">
            <div className="home-loader" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : entries === null ? (
          <div className="dashboard-empty">Détail réservé à l’administrateur (ou serveur injoignable).</div>
        ) : counted.length === 0 ? (
          <div className="dashboard-empty">Personne à nommer sur ce créneau.</div>
        ) : (
          <ul className="dashboard-people">
            {counted.map((entry) => (
              <SlotLine key={entry.key} entry={entry} series={series} />
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}

function SlotLine({ entry, series }: { entry: SlotEntry; series: Series[] }) {
  const marks = series.filter((one) => COUNTS[one.key](entry))
  const sessions = (entry.sessions_with_run || entry.sessions_without_run) && series.some((one) => one.key.startsWith('sessions'))
    ? `${fmt(entry.sessions_with_run)} ouverture${entry.sessions_with_run > 1 ? 's' : ''} avec partie, ${fmt(entry.sessions_without_run)} sans`
    : null
  if (entry.device) {
    return (
      <li className="dashboard-person">
        <span className="dashboard-person-blank" aria-hidden="true" />
        <div>
          <b>{entry.name}</b> <span className="dashboard-tag">sans compte</span>
          {series.length > 1 && <Marks marks={marks} />}
          {sessions && <p className="note">{sessions}</p>}
        </div>
      </li>
    )
  }
  const did = [
    entry.runs > 0 && `${fmt(entry.runs)} partie${entry.runs > 1 ? 's' : ''}, meilleure ${fmt(entry.best)}, ${fmt(entry.words)} mots`,
    sessions,
    entry.mails > 0 && `${fmt(entry.mails)} mail${entry.mails > 1 ? 's' : ''} d’invitation`,
    entry.shares > 0 && `${fmt(entry.shares)} lien${entry.shares > 1 ? 's' : ''} partagé${entry.shares > 1 ? 's' : ''}`,
    entry.invited_by && `invité par ${entry.invited_by}`,
  ].filter(Boolean)
  const profile = [
    `niv. ${levelFor(entry.xp)}`,
    `${fmt(entry.total_runs)} partie${entry.total_runs > 1 ? 's' : ''}`,
    `record ${fmt(entry.total_best)}`,
    `${fmt(entry.words_found)} mots`,
    `${fmt(entry.friends)} ami${entry.friends > 1 ? 's' : ''}`,
    `arrivé ${ago(entry.created_at)}`,
    entry.named_at && !entry.signed && `nommé ${ago(entry.named_at)}`,
    entry.platform && `${entry.platform === 'android' ? 'Android' : entry.platform === 'web' ? 'Web' : entry.platform} ${entry.version ?? ''}`.trim(),
    entry.lang?.toUpperCase(),
  ].filter(Boolean)
  return (
    <li className="dashboard-person">
      <Avatar choice={parseAvatar(entry.avatar)} size="sm" />
      <div>
        <b>{entry.name}</b>
        {entry.anonymous && <span className="dashboard-tag">anonyme</span>}
        {entry.moderator && <span className="dashboard-tag">modérateur</span>}
        {entry.arrived && <span className="dashboard-tag">nouveau</span>}
        {entry.signed && <span className="dashboard-tag">inscrit</span>}
        {series.length > 1 && <Marks marks={marks} />}
        {did.length > 0 && <p className="dashboard-person-did">{did.join(' · ')}</p>}
        <p className="note">{profile.join(' · ')}</p>
      </div>
    </li>
  )
}

function Marks({ marks }: { marks: Series[] }) {
  return (
    <span className="dashboard-marks" aria-label={marks.map((one) => one.label).join(', ')}>
      {marks.map((one) => (
        <i key={one.key} style={{ background: one.color }} title={one.label} />
      ))}
    </span>
  )
}

/* ------------------------------------------------------------ morceaux */

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
const columnLabel = (row: Day) => (row.hour == null ? dayLabel(row.day) : `${row.hour} h`)

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

interface Series {
  key: 'runs' | 'players' | 'signups' | 'anon' | 'sessions_with_run' | 'sessions_without_run' | 'mails' | 'shares' | 'joins'
  label: string
  color: string
}

/** Une colonne : un jour de `daily`, une heure de `today_hourly`, ou un jour d'invitations. */
type Day = { day: string; hour?: number } & Partial<Record<Series['key'], number>>

/** Une barre par jour ; plusieurs séries s'empilent depuis l'axe. */
function DayBars({ rows, series, onPick }: { rows: readonly Day[]; series: Series[]; onPick?(row: Day): void }) {
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
        <DayColumn key={`${row.day}:${row.hour}`} row={row} index={index} series={series} band={band} left={left} y={y} top={top} height={H - top - bottom} onPick={onPick} />
      ))}
      {rows.map((row, index) =>
        (index % every === 0 && rows.length - 1 - index >= every * 0.6) || index === rows.length - 1 ? (
          <text key={`${row.day}:${row.hour}`} x={left + index * band + band / 2} y={H - 6} textAnchor="middle">
            {columnLabel(row)}
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
  onPick,
}: {
  row: Day
  index: number
  series: Series[]
  band: number
  left: number
  y(value: number): number
  top: number
  height: number
  onPick?(row: Day): void
}) {
  const hide = useContext(TipContext)
  const tip = useTip(
    <>
      <b>{row.hour == null ? dayLabel(row.day) : `${row.hour} h–${row.hour + 1} h`}</b>
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
      <rect
        className={`dashboard-hit${onPick ? ' dashboard-hit--pick' : ''}`}
        x={x}
        y={top}
        width={band}
        height={height}
        {...tip}
        onClick={
          onPick &&
          (() => {
            hide(null)
            onPick(row)
          })
        }
      />
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
