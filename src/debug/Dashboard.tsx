import { createContext, Suspense, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { parseAvatar } from '../domain/avatar'
import { isBonusId } from '../domain/bonus'
import { isPowerId } from '../domain/powers'
import { levelFor } from '../domain/progression'
import { categoryText, useT } from '../i18n'
import { fetchDashboard, fetchDashboardSlot } from '../lib/cloud'
import { Avatar } from '../ui/Avatar'
import { PlayerActionsContext, SpyHistory } from '../ui/PlayerSheet'
import { Card, Kpi, Legend, Section, Stat, Table } from './board'
import { ago, decimal, fmt, pct } from './format'
import type { ByPlatform, ChoiceKind, DayRow, HourRow, Insights, Invites, ModerationByLang, PlatformName, Quality, Revenue, RevenueDay, SlotEntry, Snapshot } from './snapshot'

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
  premium_opened: 'Offre Premium ouverte',
  premium_joined: 'Premium activé',
  ad: 'Pub ouverte',
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
/** « 1 offre », « 2 offres » : les étiquettes du revenu s'accordent. */
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n > 1 ? 's' : ''}`
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
const minutes = (value: number | null) => (value != null ? `${decimal(Math.round((value / 60) * 10) / 10)} min` : '—')
/** Une version telle qu'un événement la dit, « android », « crazygames »… */
const platformName = (platform: string) => PLATFORM_SERIES.find((one) => one.key === platform)?.label ?? platform

/** La langue de jeu d'un joueur, à côté de son nom. */
function LangTag({ lang }: { lang?: string | null }) {
  return lang && lang !== '?' ? <span className="dashboard-tag dashboard-tag--lang">{lang.toUpperCase()}</span> : null
}

/** Un jour (ou une heure d'aujourd'hui) avec ses arrivés du jour et ses revenants (0084). */
function withSplit(row: DayRow | HourRow, insights: Insights | undefined): Day {
  if (!insights) return row
  const hour = 'hour' in row ? row.hour : undefined
  const split = hour == null ? insights.split.find((one) => one.day === row.day) : insights.today_split.find((one) => one.hour === hour)
  const runsNew = split?.runs_new ?? 0
  const playersNew = split?.players_new ?? 0
  return {
    ...row,
    runs_new: runsNew,
    runs_back: Math.max(0, row.runs - runsNew),
    players_new: playersNew,
    players_back: Math.max(0, row.players - playersNew),
  }
}

/** Les ouvertures d'une seule version, à la place de celles de toutes. */
function opensOf(row: Day, platform: PlatformName, insights: Insights): Day {
  const by = insights.sessions_by_platform
  const found =
    row.hour == null
      ? by.daily.find((one) => one.day === row.day && one.platform === platform)
      : by.today_hourly.find((one) => one.hour === row.hour && one.platform === platform)
  return { ...row, sessions_with_run: found?.with_run ?? 0, sessions_without_run: found?.without_run ?? 0 }
}

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
  const [opensOn, setOpensOn] = useState<PlatformName | null>(null)
  const pick = (title: string, series: Series[], platform?: PlatformName) => (row: Day) => setPicked({ title, row, series, platform })
  const ins = d.insights
  // « 1 j » : aujourd'hui heure par heure, et non une seule barre.
  const daily: Day[] = (range === 1 ? (d.today_hourly ?? []) : d.daily.slice(-range)).map((row) => withSplit(row, ins))
  const opens = opensOn && ins ? daily.map((row) => opensOf(row, opensOn, ins)) : daily
  const opensPlatforms = ins?.sessions_by_platform.totals.map((row) => row.platform) ?? []
  const per = range === 1 ? 'par heure' : 'par jour'
  const sum = (key: Series['key']) => daily.reduce((total, row) => total + read(row, key), 0)
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
          <Card title={`Parties ${per}`} tag={ins ? `${fmt(sum('runs'))} · ${fmt(sum('runs_new'))} par des arrivés du jour` : fmt(sum('runs'))}>
            {ins && <Legend items={RUNS_SPLIT.map(({ label, color }) => ({ label, color }))} />}
            <DayBars rows={daily} series={ins ? RUNS_SPLIT : RUNS} onPick={pick('Parties', ins ? RUNS_SPLIT : RUNS)} />
          </Card>
          <Card title={`Joueurs actifs ${per}`}>
            {ins && <Legend items={PLAYERS_SPLIT.map(({ label, color }) => ({ label, color }))} />}
            <DayBars rows={daily} series={ins ? PLAYERS_SPLIT : PLAYERS} onPick={pick('Joueurs actifs', ins ? PLAYERS_SPLIT : PLAYERS)} />
            {ins && <p className="note">Arrivé du jour : son compte est né ce jour-là. Les autres reviennent.</p>}
          </Card>
          <Card title="Arrivées et inscriptions" tag={`${fmt(sum('new_players'))} arrivées · ${fmt(sum('signups'))} inscrits`}>
            <Legend items={[{ label: 'Restés anonymes', color: 'var(--blue)' }, { label: 'Comptes nommés', color: 'var(--red)' }]} />
            <DayBars
              rows={daily.map((row) => ({ ...row, anon: Math.max(0, read(row, 'new_players') - read(row, 'signups')) }))}
              series={ARRIVALS}
              onPick={pick('Arrivées et inscriptions', ARRIVALS)}
            />
            <p className="note">Un joueur arrive anonyme à sa première ouverture ; l’inscription se date à la confirmation de son adresse.</p>
          </Card>
          <Card title="Ouvertures de l’app, avec ou sans partie">
            {tracked ? (
              <>
                {opensPlatforms.length > 1 && (
                  <div className="layer-tabs dashboard-range dashboard-card-tabs" role="tablist" aria-label="Version">
                    {[null, ...opensPlatforms].map((platform) => (
                      <button
                        key={platform ?? 'all'}
                        type="button"
                        role="tab"
                        aria-selected={opensOn === platform}
                        className={`layer-tab${opensOn === platform ? ' layer-tab--on' : ''}`}
                        onClick={() => setOpensOn(platform)}
                      >
                        {platform ? platformLabel(platform) : 'Toutes'}
                      </button>
                    ))}
                  </div>
                )}
                <Legend items={[{ label: 'Avec partie', color: 'var(--green)' }, { label: 'Sans partie', color: 'var(--yellow)' }]} />
                <DayBars
                  rows={opens}
                  series={SESSIONS}
                  onPick={pick(opensOn ? `Ouvertures ${platformLabel(opensOn)}` : 'Ouvertures de l’app', SESSIONS, opensOn ?? undefined)}
                />
                {opensOn === 'crazygames' && <p className="note">Un invité CrazyGames n’envoie ses ouvertures que depuis 0084 : avant, rien.</p>}
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
            <Stat value={minutes(s.median_seconds)} label="durée médiane" />
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
        {ins && ins.sessions_by_platform.totals.length > 0 && (
          <Card title="Sessions par version" note={`Sur les ${d.days} derniers jours.`}>
            <Table head={['Version', 'Ouvertures', 'Avec partie', 'Parties / session', 'Durée médiane']}>
              {ins.sessions_by_platform.totals.map((row) => (
                <tr key={row.platform}>
                  <td>{platformLabel(row.platform)}</td>
                  <td className="n">{fmt(row.total)}</td>
                  <td className="n">{pct(row.with_run, row.total)}</td>
                  <td className="n">{decimal(row.runs_per_session)}</td>
                  <td className="n">{minutes(row.median_seconds)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        )}
        {!ins && (
          <Card title="Rétention par semaine d’arrivée" note="Part des joueurs revenus jouer ou ouvrir l’app.">
            <Retention rows={d.retention} />
          </Card>
        )}
      </Section>

      {ins && <RetentionSection insights={ins} retention={d.retention} />}

      {ins && <ChoicesSection choices={ins.choices} />}

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
        </div>
      </Section>

      {d.revenue && <RevenueSection revenue={d.revenue} />}

{d.invites && <InvitesSection invites={d.invites} onPick={pick('Invitations', INVITES)} />}

      {d.by_platform && <PlatformsSection data={d.by_platform} days={d.daily.map((row) => row.day)} />}

      <Section title="Joueurs" mark="var(--pink)">
        <div className="dashboard-grid">
          <Card title="Les plus assidus">
            <Table head={['Joueur', 'Parties', 'Record']}>
              {d.top_players.map((player, index) => (
                <tr key={index}>
                  <td>
                    <Who player={player.key ?? (player.anonymous ? null : player.name)} name={player.name} />
                    <LangTag lang={player.lang} />
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
                  <td>
                    {player.name ? <Who player={player.key ?? player.name} name={player.name} /> : '—'}
                    <LangTag lang={player.lang} />
                  </td>
                  <td>{ago(player.at)}</td>
                  <td className="n">{fmt(player.runs)}</td>
                  <td className="n">{fmt(player.best)}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      </Section>

      {d.moderation_by_lang && <ModerationSection data={d.moderation_by_lang} />}

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
            {!d.quality && <Card title="Erreurs">
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
            </Card>}
          </div>
        )}
      </Section>

      {d.quality && <QualitySection quality={d.quality} />}

      <p className="note">
        « app. » compte les appareils distincts. Les joueurs ordinateur (Maxitoon, Terretciel) et l’administrateur, appareils compris, sont exclus partout. Chiffres
        calculés par <code>analytics_snapshot</code> à l’ouverture.
      </p>
      {picked && <SlotSheet key={`${picked.title}:${picked.row.day}:${picked.row.hour}`} picked={picked} load={loadSlot} onClose={() => setPicked(null)} />}
    </div>
  )
}

/* -------------------------------------------------------------- sections */

/* --------------------------------------------------------------- revenu */

const PREMIUM_REASONS: Record<string, string> = {
  filter: 'Filtres et catégories',
  reveal: 'Révélations illimitées',
  attempt: 'Essai du défi du moment',
  premiere: 'Avant-premières',
  ads: 'Sans publicité',
  slot: 'Emplacement verrouillé',
  menu: 'Menu',
  '?': 'Sans motif (relevé antérieur)',
}
const PREMIUM_SOURCES: Record<string, string> = {
  buy: 'Achat',
  restore: 'Restauré sur l’appareil',
  owned: 'Retrouvé sur un autre appareil',
  win: 'Prix du défi du moment',
  '?': 'Sans origine (relevé antérieur)',
}
const AD_SOURCES: Record<string, string> = {
  reveal: 'Mots cachés du bilan',
  attempt: 'Essai du défi du moment',
  offer: 'Catégorie gardée',
  '?': 'Sans provenance (relevé antérieur)',
}
const AD_RESULTS: Record<string, string> = {
  rewarded: 'vue jusqu’au bout',
  skipped: 'fermée trop tôt',
  unavailable: 'aucune pub prête',
  shown: 'affichée',
  '?': 'résultat non relevé',
}
const STORES: Record<string, string> = {
  play: 'Google Play',
  lemonsqueezy: 'Web (Lemon Squeezy)',
}

/**
* Ce que le jeu rapporte : les offres Premium ouvertes et ce qui les ouvre,
* les abonnements et les abonnés, les publicités et leur provenance.
*
* Les compteurs et les courbes suivent le filtre de période ; les
* répartitions portent sur toute la fenêtre du relevé, ce que chaque carte
* dit. « Abonné » et « refusé » se lisent dans `purchases`, seule vérité de
* l'achat ; « activé » ne dit que ce que le client a relevé, une restauration
* comprise.
*/
function RevenueSection({ revenue: r }: { revenue: Revenue }) {
  const [range, setRange] = useState<RevenueRange>(7)
  const rows = r.daily.slice(-range)
  const per = range === 1 ? 'aujourd’hui' : `sur ${range} jours`
  const sum = (key: keyof RevenueDay) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)
  const offers = sum('offers')
  const activations = sum('activations')
  const subscribed = sum('subscribed')
  const ads = sum('ads')
  const window = `${r.daily.length} derniers jours`
  const p = r.premium
  return (
    <Section title="Revenu" mark="var(--yellow)" aside={
      <div className="layer-tabs dashboard-range" role="tablist" aria-label="Période">
        {REVENUE_RANGES.map((days) => (
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
      <div className="dashboard-stats">
        <Stat value={fmt(offers)} label={`offres Premium ouvertes · ${per}`} />
        <Stat value={pct(subscribed, offers)} label={`converties · ${plural(subscribed, 'abonnement')}`} />
        <Stat value={fmt(activations)} label={`Premium activés · ${per}`} />
        <Stat value={fmt(p.subscribers)} label="abonnés Premium · depuis toujours" />
        <Stat value={fmt(p.refused)} label="achats remboursés" />
        <Stat value={fmt(ads)} label={`pubs ouvertes · ${per}`} />
      </div>
      <p className="note">
        « Abonnés » et « remboursés » se comptent depuis toujours, sur <code>purchases</code> : un achat rapporté par un autre appareil n’y compte
        qu’une fois, un remboursement n’est plus un abonné. « Activés » n’est que ce que le client a relevé, restauration comprise.
      </p>
      <div className="dashboard-grid">
        <Card title="Premium par jour" tag={`${plural(offers, 'offre')} · ${plural(subscribed, 'abonnement')}`}>
          <Legend items={PLUS_DAYS.map(({ label, color }) => ({ label, color }))} />
          <DayBars rows={rows} series={PLUS_DAYS} />
        </Card>
        <Card title="Pubs par jour" note="Une pub ouverte : une récompense regardée jusqu’au bout, ou un plein écran affiché. Une pub demandée sans qu’aucune soit prête ne compte pas.">
          <DayBars rows={rows} series={AD_DAYS} />
        </Card>
        <Card title="D’où l’offre s’ouvre" note={`Sur les ${window}.`}>
          <Bars
            items={p.reasons}
            name={(one) => PREMIUM_REASONS[one.reason] ?? one.reason}
            value={(one) => one.n}
            sub={(one) => plural(one.devices, 'appareil')}
            color="var(--blue)"
          />
        </Card>
        <Card title="D’où viennent les pubs" note={`Sur les ${window}.`}>
          <Bars
            items={r.ads.sources}
            name={(one) => AD_SOURCES[one.source] ?? one.source}
            value={(one) => one.n}
            sub={(one) => `${plural(one.rewarded, 'récompensée')} · ${fmt(one.unavailable)} sans pub`}
            color="var(--red)"
          />
          <h3>Comment elles finissent</h3>
          <Bars items={r.ads.results} name={(one) => AD_RESULTS[one.result] ?? one.result} value={(one) => one.n} color="var(--red)" limit={4} />
        </Card>
        <Card title="Abonnements par boutique" note={`Achats relevés sur les ${window}.`}>
          <Bars
            items={p.providers}
            name={(one) => STORES[one.provider] ?? one.provider}
            value={(one) => one.n}
            sub={(one) => plural(one.accounts, 'compte')}
            color="var(--green)"
          />
        </Card>
        <Card title="Premium activés, par origine" note={`Sur les ${window}.`}>
          <Bars
            items={p.sources}
            name={(one) => PREMIUM_SOURCES[one.source] ?? one.source}
            value={(one) => one.n}
            sub={(one) => plural(one.devices, 'appareil')}
            color="var(--yellow)"
          />
        </Card>
      </div>
    </Section>
  )
}

/** Une case qui dit la période, puis ce qui s'est cumulé depuis toujours. */
function Since({ value, total }: { value: number; total: number }) {
  return (
    <>
      {fmt(value)}
      {total > value && <small className="dashboard-total"> / {fmt(total)}</small>}
    </>
  )
}

function ModerationSection({ data }: { data: ModerationByLang }) {
  const all = (key: Exclude<keyof ModerationByLang['langs'][number], 'lang' | 'thin'>) =>
    data.langs.reduce((total, one) => total + one[key], 0)
  const per = `sur ${data.days} jours`
  return (
    <Section title="Modération par langue" mark="var(--green)">
      <div className="dashboard-stats">
        <Stat value={fmt(all('moderators'))} label={`modérateurs · ${fmt(all('active'))} ont voté ${per}`} />
        <Stat value={fmt(all('reserve_left'))} label={`mots en réserve · ${fmt(all('reserve_released'))} versés ${per}`} />
        <Stat value={fmt(all('pending_add') + all('pending_ban'))} label={`à juger · ${fmt(all('pending_ban'))} retraits`} />
        <Stat value={fmt(all('sessions'))} label={`sessions menées au bout · ${per}`} />
        <Stat value={fmt(all('added'))} label={`mots ajoutés · ${fmt(all('added_reserve'))} de la réserve`} />
        <Stat value={fmt(all('removed'))} label={`mots retirés · ${fmt(all('rejected'))} refusés`} />
      </div>
      <Table head={['Langue', 'Modérateurs', 'Réserve', 'À juger', 'Sessions', 'Votes', 'Ajoutés', 'Retirés', 'Refusés']}>
        {data.langs.map((one) => (
          <tr key={one.lang}>
            <td>
              {one.lang.toUpperCase()}
              {one.thin && <span className="dashboard-tag">2 « correct »</span>}
            </td>
            <td className="n">
              {fmt(one.moderators)}
              <small className="dashboard-total">
                {' '}
                · {fmt(one.active)} actif{one.active > 1 ? 's' : ''}
                {one.supers > 0 && `, ${fmt(one.supers)} super`}
              </small>
            </td>
            <td className="n">
              {fmt(one.reserve_left)}
              {one.reserve_released > 0 && <small className="dashboard-total"> · {fmt(one.reserve_released)} versés</small>}
            </td>
            <td className="n">
              {fmt(one.pending_add)}
              {one.pending_ban > 0 && <small className="dashboard-total"> + {fmt(one.pending_ban)} retraits</small>}
            </td>
            <td className="n">
              <Since value={one.sessions} total={one.sessions_total} />
            </td>
            <td className="n">{fmt(one.votes)}</td>
            <td className="n">
              <Since value={one.added} total={one.added_total} />
              {one.added_reserve > 0 && <small className="dashboard-total"> · {fmt(one.added_reserve)} réserve</small>}
            </td>
            <td className="n">
              <Since value={one.removed} total={one.removed_total} />
            </td>
            <td className="n">{fmt(one.rejected)}</td>
          </tr>
        ))}
      </Table>
      <p className="note">
        Chiffres {per}, puis « / » ce qui s’est cumulé depuis toujours. La réserve et ce qui attend se comptent à l’instant. La langue d’un
        modérateur est la file qu’il a ouverte en dernier ; une langue sous dix juges fait entrer un mot sur deux « correct ».
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
                    <Who player={player.key ?? (player.anonymous ? null : player.name)} name={player.name} />
                    <LangTag lang={player.lang} />
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

const PLATFORM_SERIES: Series[] = [
  { key: 'android', label: 'Android', color: 'var(--green)' },
  { key: 'web', label: 'Web', color: 'var(--blue)' },
  { key: 'crazygames', label: 'CrazyGames', color: 'var(--yellow)' },
  { key: 'reddit', label: 'Reddit', color: 'var(--red)' },
  { key: 'inconnu', label: 'Inconnu', color: 'var(--grid)' },
]
const platformLabel = (platform: PlatformName) => PLATFORM_SERIES.find((one) => one.key === platform)?.label ?? platform

function PlatformsSection({ data, days }: { data: ByPlatform; days: readonly string[] }) {
  const columns: Day[] = days.map((day) => ({ day }))
  for (const entry of data.daily) {
    const column = columns.find((row) => row.day === entry.day)
    if (column) column[entry.platform] = (column[entry.platform] ?? 0) + entry.runs
  }
  const shown = PLATFORM_SERIES.filter((one) => data.rows.some((row) => row.platform === one.key))
  const runs = data.rows.reduce((total, row) => total + row.runs, 0)
  return (
    <Section title="Versions du jeu" mark="var(--yellow)">
      <div className="dashboard-stats">
        {data.rows.map((row) => (
          <Stat
            key={row.platform}
            value={pct(row.runs, runs)}
            label={`${platformLabel(row.platform)} · ${fmt(row.runs)} parties, ${fmt(row.players)} joueurs`}
          />
        ))}
      </div>
      <div className="dashboard-grid">
        <Card title="Parties par jour et par version" tag={fmt(runs)}>
          <Legend items={shown.map(({ label, color }) => ({ label, color }))} />
          <DayBars rows={columns} series={shown} />
        </Card>
        <Card title="Par version" note="Sur la période, hors administration, joueurs ordinateur et clients de test.">
          <Table head={['Version', 'Parties', 'Étiquetées', 'Joueurs', 'Auj.', 'Score moy.', 'Comptes', 'Duels', 'Défi']}>
            {data.rows.map((row) => (
              <tr key={row.platform}>
                <td>{platformLabel(row.platform)}</td>
                <td className="n">{fmt(row.runs)}</td>
                <td className="n">{pct(row.tagged, row.runs)}</td>
                <td className="n">{fmt(row.players)}</td>
                <td className="n">
                  {fmt(row.runs_today)} · {fmt(row.players_today)}
                </td>
                <td className="n">{row.avg_score == null ? '—' : fmt(row.avg_score)}</td>
                <td className="n">{fmt(row.new_accounts)}</td>
                <td className="n">{fmt(row.duels)}</td>
                <td className="n">
                  {fmt(row.weekly_attempts)} · {fmt(row.weekly_players)} j.
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <p className="note">
        Une partie porte sa version depuis 0072 (« Étiquetées ») ; avant, ou depuis une app qui ne l’envoie pas encore, elle prend celle de son joueur : compte
        CrazyGames, sinon la version que disent ses événements, sinon « Inconnu ». Reddit garde ses parties sur son propre serveur : il n’apparaît pas ici.
      </p>
    </Section>
  )
}

/* ------------------------------------------------------------- rétention */

function RetentionSection({ insights: ins, retention }: { insights: Insights; retention: Snapshot['retention'] }) {
  const curve = ins.retention_curve
  const at = (day: number) => curve.find((one) => one.day === day)
  const stat = (day: number, kind: 'exact' | 'rolling') => {
    const point = at(day)
    return point ? pct(point[kind], point.eligible) : '—'
  }
  const last = ins.stickiness[ins.stickiness.length - 1]
  const weeks = Math.max(0, ...ins.cohorts.map((row) => row.cells.findLastIndex((cell) => cell.eligible > 0) + 1))
  const byWeek = new Map(retention.map((row) => [row.week, row]))
  return (
    <Section title="Rétention" mark="var(--green)" aside={<p className="note">arrivés des 90 derniers jours</p>}>
      <div className="dashboard-stats">
        <Stat value={stat(1, 'exact')} label={`revenus le lendemain · ${fmt(at(1)?.eligible ?? 0)} arrivés`} />
        <Stat value={stat(7, 'exact')} label="revenus le 7ᵉ jour" />
        <Stat value={stat(7, 'rolling')} label="revenus au 7ᵉ jour ou après" />
        <Stat value={stat(30, 'rolling')} label="revenus au 30ᵉ jour ou après" />
        <Stat value={last ? pct(last.dau, last.mau) : '—'} label="actifs du jour sur actifs du mois" />
        <Stat value={last ? pct(last.wau, last.mau) : '—'} label="actifs de la semaine sur actifs du mois" />
      </div>
      <div className="dashboard-grid">
        <Card
          title="Courbe de rétention"
          note="Parmi les joueurs arrivés, la part revenue jouer ou ouvrir l’app au jour dit (plein), ou ce jour-là ou plus tard (pointillé). Un jour ne compte qu’une fois fini."
        >
          <Legend items={CURVE.map(({ label, color }) => ({ label, color }))} />
          <LineChart
            rows={curve}
            series={CURVE.map((one) => ({ ...one, value: (point: Insights['retention_curve'][number]) => (point.eligible ? point[one.key] / point.eligible : null) }))}
            label={(point) => `J${point.day}`}
            tip={(point) => `${fmt(point.eligible)} arrivés comptés`}
            format={(value) => `${Math.round(value * 100)} %`}
            max={1}
          />
        </Card>
        <Card title="Actifs du jour, de la semaine, du mois" note="Joueurs avec une partie ou une ouverture sur 1, 7 ou 30 jours glissants.">
          <Legend items={STICKY.map(({ label, color }) => ({ label, color }))} />
          <LineChart
            rows={ins.stickiness}
            series={STICKY.map((one) => ({ ...one, value: (row: Insights['stickiness'][number]) => row[one.key] }))}
            label={(row) => dayLabel(row.day)}
            tip={(row) => `${pct(row.dau, row.mau)} du mois actifs ce jour`}
            format={(value) => fmt(value)}
          />
        </Card>
      </div>
      <Card title="Cohortes, semaine après semaine" note="Par semaine d’arrivée : la part revenue le lendemain, puis dans chaque semaine qui suit (S1 = jours 1 à 7, S2 = jours 8 à 14…). Une case ne compte que les joueurs dont la semaine a commencé.">
        <Table head={['Semaine d’arrivée', 'Joueurs', 'Lendemain', ...Array.from({ length: weeks }, (_, index) => `S${index + 1}`)]}>
          {ins.cohorts
            .slice()
            .reverse()
            .map((row) => {
              const old = byWeek.get(row.week)
              return (
                <tr key={row.week}>
                  <td>{dayLabel(row.week)}</td>
                  <td className="n">{fmt(row.size)}</td>
                  <RateCell count={old?.d1 ?? 0} size={old?.size ?? 0} />
                  {row.cells.slice(0, weeks).map((cell, index) =>
                    cell.eligible ? <RateCell key={index} count={cell.back} size={cell.eligible} /> : <td key={index} />,
                  )}
                </tr>
              )
            })}
        </Table>
      </Card>
      <div className="dashboard-grid">
        {(['platform', 'lang'] as const).map((by) => (
          <Card key={by} title={by === 'platform' ? 'Rétention par version' : 'Rétention par langue'} note="Lendemain, dans les 7 jours, puis entre le 8ᵉ et le 30ᵉ jour.">
            <Table head={[by === 'platform' ? 'Version' : 'Langue', 'Arrivés', 'Lendemain', '7 jours', 'J8–J30']}>
              {ins.retention_by
                .filter((row) => row.by === by)
                .map((row) => (
                  <tr key={row.value}>
                    <td>{by === 'platform' ? platformName(row.value) : row.value.toUpperCase()}</td>
                    <td className="n">{fmt(row.size)}</td>
                    <RateCell count={row.d1} size={row.d1_eligible} />
                    <RateCell count={row.w1} size={row.w1_eligible} />
                    <RateCell count={row.m1} size={row.m1_eligible} />
                  </tr>
                ))}
            </Table>
          </Card>
        ))}
      </div>
    </Section>
  )
}

const CURVE: { key: 'exact' | 'rolling'; label: string; color: string; dashed?: boolean }[] = [
  { key: 'exact', label: 'Revenus ce jour-là', color: 'var(--blue)' },
  { key: 'rolling', label: 'Ce jour-là ou après', color: 'var(--green)', dashed: true },
]
const STICKY: { key: 'dau' | 'wau' | 'mau'; label: string; color: string }[] = [
  { key: 'mau', label: '30 jours', color: 'var(--yellow)' },
  { key: 'wau', label: '7 jours', color: 'var(--green)' },
  { key: 'dau', label: 'Le jour', color: 'var(--blue)' },
]

/* ------------------------------------------------- choix de montée de niveau */

const CHOICE_TITLES: Record<ChoiceKind, string> = { category: 'Catégories', power: 'Pouvoirs', bonus: 'Bonus' }

function ChoicesSection({ choices }: { choices: Insights['choices'] }) {
  const t = useT()
  const name = (kind: ChoiceKind, item: string) =>
    kind === 'category'
      ? categoryText(t, item).label
      : kind === 'power'
        ? isPowerId(item)
          ? t.powers.names[item][0]
          : item
        : isBonusId(item)
          ? t.bonus.kinds[item][0]
          : item
  const rate = (item: Insights['choices']['items'][number]) => (item.offered ? item.picked / item.offered : -1)
  return (
    <Section title="Choix de montée de niveau" mark="var(--yellow)" aside={<p className="note">ce que les joueurs prennent quand on le leur propose</p>}>
      <div className="dashboard-stats">
        {(['category', 'power', 'bonus'] as const).map((kind) => {
          const row = choices.kinds.find((one) => one.kind === kind)
          return <Stat key={kind} value={fmt(row?.n ?? 0)} label={`${CHOICE_TITLES[kind].toLowerCase()} choisis · ${fmt(row?.devices ?? 0)} app.`} />
        })}
      </div>
      <div className="dashboard-grid">
        {(['category', 'power', 'bonus'] as const).map((kind) => (
          <Card key={kind} title={CHOICE_TITLES[kind]}>
            <Bars
              items={choices.items.filter((item) => item.kind === kind).sort((a, b) => rate(b) - rate(a) || b.chosen - a.chosen)}
              name={(item) => name(kind, item.item)}
              value={(item) => item.chosen}
              fill={(item) => Math.max(0, rate(item))}
              sub={(item) => (item.offered ? `pris dans ${pct(item.picked, item.offered)} de ses ${fmt(item.offered)} offres` : 'offre inconnue')}
              color="var(--yellow)"
              limit={12}
            />
          </Card>
        ))}
      </div>
      <p className="note">
        La barre dit la part de fois où la carte est prise quand elle sort ; le nombre, combien de fois elle a été choisie. Un choix ne dit son offre que depuis
        0084 : les plus anciens comptent dans le nombre, pas dans la part.
      </p>
    </Section>
  )
}

/* --------------------------------------------------------------- qualité */

/** Chaque part sur les sessions qui la mesuraient : rien avant 0084 plutôt qu'un faux zéro. */
const QUALITY_RATES: { key: 'error_sessions' | 'unclean' | 'frozen'; of: 'sessions' | 'watched' | 'measured'; label: string; color: string }[] = [
  { key: 'error_sessions', of: 'sessions', label: 'Avec une erreur', color: 'var(--red)' },
  { key: 'unclean', of: 'watched', label: 'Fermeture brutale', color: 'var(--pink)' },
  { key: 'frozen', of: 'measured', label: 'Avec un gel', color: 'var(--yellow)' },
]
const dailyRate = (row: Quality['daily'][number], one: (typeof QUALITY_RATES)[number]) => (row[one.of] ? row[one.key] / row[one.of] : null)
const READY_LINES: { key: 'ready_p50' | 'ready_p90'; label: string; color: string; dashed?: boolean }[] = [
  { key: 'ready_p50', label: 'Médiane', color: 'var(--blue)' },
  { key: 'ready_p90', label: '9ᵉ décile', color: 'var(--blue)', dashed: true },
]
const sinceLabel = (iso: string | null) =>
  iso ? `depuis le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : 'mesuré depuis 0084, rien encore'
/** Le haut d'un axe de parts : la plus petite borne ronde au-dessus du maximum. */
const shareTop = (values: readonly number[]) => [0.05, 0.1, 0.2, 0.25, 0.5, 1].find((top) => top >= Math.max(0, ...values)) ?? 1
const msLabel = (ms: number | null) => (ms == null ? '—' : ms >= 1000 ? seconds(ms) : `${Math.round(ms)} ms`)

function QualitySection({ quality: q }: { quality: Quality }) {
  const t = q.totals
  const recent = Date.now() - 2 * 24 * 3600_000
  return (
    <Section title="Qualité" mark="var(--red)" aside={<p className="note">chargement, erreurs, fermetures brutales, gels</p>}>
      <div className="dashboard-stats">
        <Stat value={pct(t.sessions - t.error_sessions, t.sessions)} label={`des sessions sans erreur · ${fmt(t.errors)} erreurs`} />
        <Stat value={pct(t.unclean, t.watched)} label={`fermetures brutales · ${fmt(t.unclean)} sur ${fmt(t.watched)}, ${sinceLabel(q.since.unclean)}`} />
        <Stat value={msLabel(t.ready_p50)} label={`accueil prêt, médiane · ${msLabel(t.ready_p90)} au 9ᵉ décile, ${msLabel(t.ready_p99)} au 99ᵉ`} />
        <Stat value={fmt(t.slow_starts)} label="lancements de plus de 5 s" />
        <Stat value={pct(t.frozen, t.measured)} label={`des sessions ont gelé (½ s et plus) · ${sinceLabel(q.since.freezes)}`} />
        <Stat value={t.long_per_minute == null ? '—' : `${fmt(t.long_per_minute)} ms`} label={`bloquées par minute de jeu · pire gel ${msLabel(t.long_max_p90)} au 9ᵉ décile`} />
      </div>
      <div className="dashboard-grid">
        <Card title="Sessions touchées, jour par jour" note="Part des sessions du jour avec une erreur, après une fermeture brutale, ou avec un gel — chacune sur les sessions qui la mesuraient.">
          <Legend items={QUALITY_RATES.map(({ label, color }) => ({ label, color }))} />
          <LineChart
            rows={q.daily}
            series={QUALITY_RATES.map((one) => ({ ...one, value: (row: Quality['daily'][number]) => dailyRate(row, one) }))}
            label={(row) => dayLabel(row.day)}
            tip={(row) => `${fmt(row.sessions)} sessions · ${fmt(row.errors)} erreurs`}
            format={(value) => `${Math.round(value * 100)} %`}
            max={shareTop(q.daily.flatMap((row) => QUALITY_RATES.map((one) => dailyRate(row, one) ?? 0)))}
          />
        </Card>
        <Card title="Temps de chargement, jour par jour" note="Du lancement à l’accueil prêt.">
          <Legend items={READY_LINES.map(({ label, color }) => ({ label, color }))} />
          <LineChart
            rows={q.daily}
            series={READY_LINES.map((one) => ({ ...one, value: (row: Quality['daily'][number]) => row[one.key] }))}
            label={(row) => dayLabel(row.day)}
            format={(value) => seconds(value)}
          />
        </Card>
      </div>
      <Card title="Par version" note="Les versions les plus ouvertes sur la période. Une case vide : la version ne mesurait pas encore.">
        <Table head={['Version', 'Sessions', 'App.', 'Avec erreur', 'Ferm. brutales', 'Gels', 'Accueil', '9ᵉ décile']}>
          {q.by_version.map((row) => (
            <tr key={`${row.platform}:${row.version}`}>
              <td>
                {platformName(row.platform)} <small>{row.version}</small>
              </td>
              <td className="n">{fmt(row.sessions)}</td>
              <td className="n">{fmt(row.devices)}</td>
              <BadCell count={row.error_sessions} size={row.sessions} />
              {row.watched ? <BadCell count={row.unclean} size={row.watched} /> : <td />}
              {row.measured ? <BadCell count={row.frozen} size={row.measured} /> : <td />}
              <td className="n">{msLabel(row.ready_p50)}</td>
              <td className="n">{msLabel(row.ready_p90)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="dashboard-grid">
        <Card title="Erreurs" note="Les plus fréquentes sur la période, avec leur dernière source et les versions qui les lèvent.">
          {q.errors.length ? (
            <Table head={['Message', 'Fois', 'Sessions', 'App.', 'Dernière']}>
              {q.errors.map((error, index) => (
                <tr key={index}>
                  <td className="dashboard-error">
                    {error.message}
                    {Date.parse(error.first) > recent && <span className="dashboard-tag">nouvelle</span>}
                    <small>
                      {[error.screen && screenName(error.screen), error.source, error.versions.join(', ')].filter(Boolean).join(' · ')}
                    </small>
                  </td>
                  <td className="n">{fmt(error.n)}</td>
                  <td className="n">{fmt(error.sessions)}</td>
                  <td className="n">{fmt(error.devices)}</td>
                  <td>{ago(error.last)}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className="dashboard-empty">Aucune erreur remontée.</div>
          )}
        </Card>
        <Card title="Où les erreurs tombent" note="Écran ouvert au moment de l’erreur, depuis 0084.">
          <Bars items={q.screens} name={(row) => (row.screen === '?' ? 'Écran inconnu' : screenName(row.screen))} value={(row) => row.n} sub={(row) => `${fmt(row.devices)} app.`} color="var(--red)" />
        </Card>
      </div>
      <p className="note">
        Une fermeture brutale est une session finie sans être passée en arrière-plan : un crash du jeu, ou le système qui le tue au premier plan. Les crashs
        natifs d’Android, qui n’atteignent jamais le jeu, restent dans les « Android vitals » de la Play Console. Un gel est une tâche qui bloque l’écran une
        demi-seconde ou plus, là où la WebView sait la mesurer.
      </p>
    </Section>
  )
}

/** Une part qui devrait rester basse : plus elle monte, plus elle rougit. */
function BadCell({ count, size }: { count: number; size: number }) {
  const ratio = size ? count / size : 0
  return (
    <td className="n">
      <span
        className="dashboard-cell"
        style={{ background: `color-mix(in srgb, var(--red) ${Math.round(Math.min(1, ratio * 4) * 70)}%, transparent)`, color: ratio > 0.16 ? 'var(--cream)' : undefined }}
        title={`${fmt(count)} sur ${fmt(size)}`}
      >
        {pct(count, size)}
      </span>
    </td>
  )
}

/* -------------------------------------------------- le détail d'une barre */

interface Picked {
  title: string
  row: Day
  series: Series[]
  /** Les ouvertures d'une seule version : le détail ne garde que ses joueurs. */
  platform?: PlatformName
}

const RUNS: Series[] = [{ key: 'runs', label: 'Parties', color: 'var(--blue)' }]
const PLAYERS: Series[] = [{ key: 'players', label: 'Joueurs actifs', color: 'var(--green)' }]
const RUNS_SPLIT: Series[] = [
  { key: 'runs_back', label: 'Revenants', color: 'var(--blue)' },
  { key: 'runs_new', label: 'Arrivés du jour', color: 'var(--yellow)' },
]
const PLAYERS_SPLIT: Series[] = [
  { key: 'players_back', label: 'Revenants', color: 'var(--green)' },
  { key: 'players_new', label: 'Arrivés du jour', color: 'var(--yellow)' },
]
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
/** Le revenu suit son propre filtre : 1, 7, 15 ou 30 jours, pas 14. */
const REVENUE_RANGES = [1, 7, 15, 30] as const
type RevenueRange = (typeof REVENUE_RANGES)[number]
const PLUS_DAYS: Series[] = [
  { key: 'offers', label: 'Offres ouvertes', color: 'var(--blue)' },
  { key: 'subscribed', label: 'Abonnements', color: 'var(--green)' },
]
const AD_DAYS: Series[] = [{ key: 'ads', label: 'Pubs ouvertes', color: 'var(--red)' }]

/** Le jour de Paris où un compte est né : celui que `split` compare. */
const parisDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
const arrivedOn = (entry: SlotEntry, row: Day) => !entry.device && parisDay(entry.created_at) === row.day

/** Qui une série compte : la même règle que la barre, joueur par joueur. Le revenu n'a pas de détail par joueur. */
const COUNTS: Record<Series['key'], (entry: SlotEntry, row: Day) => boolean> = {
  runs: (entry) => !entry.device && entry.runs > 0,
  players: (entry) => !entry.device && entry.active,
  runs_new: (entry, row) => !entry.device && entry.runs > 0 && arrivedOn(entry, row),
  runs_back: (entry, row) => !entry.device && entry.runs > 0 && !arrivedOn(entry, row),
  players_new: (entry, row) => !entry.device && entry.active && arrivedOn(entry, row),
  players_back: (entry, row) => !entry.device && entry.active && !arrivedOn(entry, row),
  signups: (entry) => !entry.device && entry.signed,
  new_players: (entry) => !entry.device && entry.arrived,
  anon: (entry) => !entry.device && entry.arrived && !entry.signed,
  sessions_with_run: (entry) => entry.sessions_with_run > 0,
  sessions_without_run: (entry) => entry.sessions_without_run > 0,
  mails: (entry) => !entry.device && entry.mails > 0,
  shares: (entry) => !entry.device && entry.shares > 0,
  joins: (entry) => !entry.device && entry.invited_by != null,
  // Le revenu ne s'ouvre pas joueur par joueur non plus.
  offers: () => false,
  subscribed: () => false,
  ads: () => false,
  // Les parties par version ne s'ouvrent pas joueur par joueur.
  android: () => false,
  web: () => false,
  crazygames: () => false,
  reddit: () => false,
  inconnu: () => false,
}

function SlotSheet({ picked, load, onClose }: { picked: Picked; load: LoadSlot; onClose(): void }) {
  const { row, series, title, platform } = picked
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

  const counted =
    entries?.filter((entry) => (!platform || entry.platform === platform) && series.some((one) => COUNTS[one.key](entry, row))) ?? []
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
              <SlotLine key={entry.key} entry={entry} series={series} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}

function SlotLine({ entry, series, row }: { entry: SlotEntry; series: Series[]; row: Day }) {
  const marks = series.filter((one) => COUNTS[one.key](entry, row))
  const sessions = (entry.sessions_with_run || entry.sessions_without_run) && series.some((one) => one.key.startsWith('sessions'))
    ? `${fmt(entry.sessions_with_run)} ouverture${entry.sessions_with_run > 1 ? 's' : ''} avec partie, ${fmt(entry.sessions_without_run)} sans`
    : null
  if (entry.device) {
    return (
      <li className="dashboard-person">
        <span className="dashboard-person-blank" aria-hidden="true" />
        <div>
          <b>{entry.name}</b> <LangTag lang={entry.lang} />
          <span className="dashboard-tag">sans compte</span>
          {entry.platform && <span className="dashboard-tag">{platformName(entry.platform)}</span>}
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
    entry.platform && `${platformName(entry.platform)} ${entry.version ?? ''}`.trim(),
  ].filter(Boolean)
  return (
    <li className="dashboard-person">
      <Avatar choice={parseAvatar(entry.avatar)} size="sm" />
      <div>
        <b>
          <Who player={entry.key} name={entry.name} />
        </b>
        <LangTag lang={entry.lang} />
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

/**
 * Un nom de joueur : pour un super modérateur (`spyHistory`), une tape ouvre
 * son historique. `player` est son compte quand le relevé le donne, sinon son
 * nom ; null pour un anonyme sans compte nommé — son « Anonyme 3f2a » ne garde
 * que quatre caractères de l'identifiant, et « Anonyme » est à tout le monde.
 */
function Who({ player, name }: { player: string | null; name: string }) {
  const spy = useContext(PlayerActionsContext).spy
  const [open, setOpen] = useState(false)
  if (!spy || !player) return <>{name}</>
  return (
    <>
      <button type="button" className="dashboard-who" onClick={() => setOpen(true)}>
        {name}
      </button>
      {open && (
        <Suspense fallback={null}>
          <SpyHistory player={player} name={name} actions={spy} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
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
  fill,
}: {
  items: readonly T[]
  name(item: T): ReactNode
  value(item: T): number
  sub?(item: T): string
  color?: string
  limit?: number
  max?: number
  /** La longueur de la barre, de 0 à 1, quand elle ne suit pas `value`. */
  fill?(item: T): number
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
              <span style={{ width: `${(fill ? fill(item) : value(item) / top) * 100}%`, background: color }} />
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
  key:
    | 'runs'
    | 'players'
    | 'runs_new'
    | 'runs_back'
    | 'players_new'
    | 'players_back'
    | 'signups'
    | 'anon'
    | 'new_players'
    | 'sessions_with_run'
    | 'sessions_without_run'
    | 'mails'
    | 'shares'
    | 'joins'
    | 'offers'
    | 'subscribed'
    | 'ads'
    | PlatformName
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

/** Une part colorée, plus soutenue à mesure qu'elle monte. */
function RateCell({ count, size }: { count: number; size: number }) {
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

/** Des courbes sur un même axe ; une valeur nulle coupe la ligne. */
function LineChart<T>({
  rows,
  series,
  label,
  tip,
  format,
  max,
}: {
  rows: readonly T[]
  series: { key: string; label: string; color: string; dashed?: boolean; value(row: T): number | null }[]
  label(row: T): string
  tip?(row: T): string
  format(value: number): string
  max?: number
}) {
  if (rows.length === 0) return <div className="dashboard-empty">Rien encore sur la période.</div>
  const H = 180
  const left = 38
  const bottom = 22
  const top = 14
  const values = rows.flatMap((row) => series.map((one) => one.value(row) ?? 0))
  const top_ = max ?? niceMax(Math.max(1, ...values))
  const band = (W - left) / rows.length
  const x = (index: number) => left + index * band + band / 2
  const y = (value: number) => top + (H - top - bottom) * (1 - value / top_)
  const every = Math.ceil(rows.length / 7)
  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {[0, 1, 2].map((step) => (
        <g key={step}>
          <line x1={left} x2={W} y1={y((top_ / 2) * step)} y2={y((top_ / 2) * step)} stroke="var(--grid)" />
          <text x={left - 6} y={y((top_ / 2) * step) + 4} textAnchor="end">
            {format((top_ / 2) * step)}
          </text>
        </g>
      ))}
      {series.map((one) => {
        const runs: string[] = []
        let path = ''
        rows.forEach((row, index) => {
          const value = one.value(row)
          if (value == null) {
            if (path) runs.push(path)
            path = ''
            return
          }
          path += `${path ? ' L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`
        })
        if (path) runs.push(path)
        return runs.map((d, index) => (
          <path key={`${one.key}:${index}`} d={d} fill="none" stroke={one.color} strokeWidth={2} strokeDasharray={one.dashed ? '5 4' : undefined} strokeLinejoin="round" />
        ))
      })}
      {rows.map((row, index) =>
        (index % every === 0 && rows.length - 1 - index >= every * 0.6) || index === rows.length - 1 ? (
          <text key={index} x={x(index)} y={H - 6} textAnchor="middle">
            {label(row)}
          </text>
        ) : null,
      )}
      {rows.map((row, index) => (
        <LinePoint key={index} row={row} x={x(index)} band={band} top={top} height={H - top - bottom} series={series} label={label} tip={tip} format={format} />
      ))}
      <line x1={left} x2={W} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
    </svg>
  )
}

function LinePoint<T>({
  row,
  x,
  band,
  top,
  height,
  series,
  label,
  tip,
  format,
}: {
  row: T
  x: number
  band: number
  top: number
  height: number
  series: { key: string; label: string; value(row: T): number | null }[]
  label(row: T): string
  tip?(row: T): string
  format(value: number): string
}) {
  const bubble = useTip(
    <>
      <b>{label(row)}</b>
      {series.map((one) => {
        const value = one.value(row)
        return (
          <span key={one.key}>
            <br />
            {one.label} : <b>{value == null ? '—' : format(value)}</b>
          </span>
        )
      })}
      {tip && (
        <>
          <br />
          {tip(row)}
        </>
      )}
    </>,
  )
  return <rect className="dashboard-hit" x={x - band / 2} y={top} width={band} height={height} {...bubble} />
}

function Retention({ rows }: { rows: Snapshot['retention'] }) {
  if (rows.length === 0) return <div className="dashboard-empty">Pas encore de cohorte.</div>
  const cell = (count: number, size: number) => <RateCell count={count} size={size} />
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
