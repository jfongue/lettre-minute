import { useCallback, useEffect, useState } from 'react'
import { isPowerId } from '../domain/powers'
import { levelFor } from '../domain/progression'
import { useT } from '../i18n'
import type { RoleOutcome, SpiedProfile } from '../lib/cloud'
import { Stat } from './board'
import { ago, fmt } from './format'

/*
 * La fiche d'un joueur au-dessus de son historique, pour un super modérateur
 * (`spy_profile`, 0092) : son compte, ses plateformes, son Premium et d'où il
 * vient, son rôle, ses pouvoirs, sa modération, son rythme. Et les deux gestes
 * qu'on peut faire de là, chacun confirmé : offrir ou reprendre Premium,
 * nommer ou retirer un modérateur (0091).
 *
 * Un outil de développeur : libellés français hors de l'i18n, comme le tableau
 * de bord ; les noms de pouvoirs viennent de l'interface. L'historique qui le
 * porte (`SpyHistory`, dans `src/ui/`) garde, lui, ses quelques textes traduits.
 */

/** Ce que la fiche appelle ; la planche debug y met des doublures qui n'écrivent rien. */
export interface SpyProfileActions {
  profile(player: string): Promise<SpiedProfile | null>
  grantPremium(id: string, on: boolean): Promise<RoleOutcome>
  setModerator(id: string, on: boolean): Promise<RoleOutcome>
}

/** Le chargeur : relit la fiche après chaque geste, pour montrer ce que le serveur a vraiment retenu. */
export function SpyProfile({ player, actions }: { player: string; actions: SpyProfileActions }) {
  // `undefined` pendant le chargement, null pour personne à montrer.
  const [profile, setProfile] = useState<SpiedProfile | null | undefined>(undefined)
  const [version, setVersion] = useState(0)
  const load = actions.profile
  useEffect(() => {
    let live = true
    load(player).then((found) => live && setProfile(found))
    return () => {
      live = false
    }
  }, [load, player, version])
  const reload = useCallback(() => setVersion((n) => n + 1), [])
  if (profile === undefined) return <div className="dashboard-empty">Chargement de la fiche…</div>
  if (profile === null) return null
  return <SpyProfileView profile={profile} actions={actions} onChanged={reload} />
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const PLATFORMS: Record<string, string> = { android: 'Android', web: 'Web', crazygames: 'CrazyGames', reddit: 'Reddit' }
const PROVIDERS: Record<string, string> = { lemonsqueezy: 'Lemon Squeezy', play: 'Google Play' }
const VERDICTS: Record<string, string> = { correct: 'correct', unsure: 'je ne sais pas', incorrect: 'incorrect', special: 'cas spécial' }
const PROPOSED: Record<string, string> = { pending: 'en attente', accepted: 'acceptés', rejected: 'refusés' }

type Action = 'grant' | 'revoke-premium' | 'name' | 'revoke-moderator'

const ASKS: Record<Action, { title: string; body: string; label: string }> = {
  grant: {
    title: 'Offrir Premium ?',
    body: 'Le joueur reçoit tous les avantages Premium à son prochain lancement, sur chaque appareil où il se connecte. Rien n’est facturé, et le revenu du tableau de bord ne le compte pas.',
    label: 'Offrir',
  },
  'revoke-premium': {
    title: 'Reprendre le Premium offert ?',
    body: 'Les avantages disparaissent à son prochain lancement. Un achat ou un Premium gagné sur l’appareil ne sont pas touchés.',
    label: 'Reprendre',
  },
  name: {
    title: 'Nommer modérateur ?',
    body: 'Le joueur juge les mots proposés dès sa prochaine visite de « Mes demandes », comme s’il avait accepté une offre.',
    label: 'Nommer',
  },
  'revoke-moderator': {
    title: 'Retirer le rôle de modérateur ?',
    body: 'Ses votes déjà donnés restent comptés, y compris sur les mots encore en attente. Le serveur ne lui reproposera plus le rôle.',
    label: 'Retirer',
  },
}

const OUTCOMES: Record<Exclude<RoleOutcome, 'ok'>, string> = {
  forbidden: 'Le serveur ne reconnaît pas ce compte comme super modérateur.',
  missing: 'Ce joueur n’existe plus.',
  anonymous: 'Un compte anonyme ne modère pas.',
  super: 'Un super modérateur ne se retire pas d’ici.',
  error: 'Pas de réponse du serveur : rien n’a changé.',
}

export function SpyProfileView({ profile: p, actions, onChanged }: { profile: SpiedProfile; actions: SpyProfileActions; onChanged(): void }) {
  const t = useT()
  const [asking, setAsking] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [span, setSpan] = useState<30 | 90>(30)

  const bought = p.premium.purchases.filter((one) => one.state !== 'refused')
  const premiumLine = bought.length
    ? `Acheté (${bought.map((one) => `${PROVIDERS[one.provider] ?? one.provider}, ${day(one.at)}${one.state === 'verified' ? '' : `, ${one.state}`}`).join(' ; ')})`
    : p.premium.grant
      ? `Offert le ${day(p.premium.grant.at)}${p.premium.grant.by ? ` par ${p.premium.grant.by}` : ''}`
      : p.premium.savedSince > 0
        ? `Sur l’appareil depuis le ${day(new Date(p.premium.savedSince).toISOString())}, sans achat (défi du moment, ou Premium gratuit d’avant)`
        : 'Aucun'
  const refused = p.premium.purchases.filter((one) => one.state === 'refused').length

  const confirm = async () => {
    if (!asking) return
    setBusy(true)
    setFailed(null)
    const outcome =
      asking === 'grant' || asking === 'revoke-premium'
        ? await actions.grantPremium(p.id, asking === 'grant')
        : await actions.setModerator(p.id, asking === 'name')
    setBusy(false)
    setAsking(null)
    if (outcome === 'ok') onChanged()
    else setFailed(OUTCOMES[outcome])
  }

  const premiumButton = bought.length ? (
    <RoleButton disabled why="Un achat réel ne se reprend jamais d’ici : seul un remboursement du store le fait." label="Reprendre Premium" />
  ) : p.premium.grant ? (
    <RoleButton label="Reprendre le Premium offert" onClick={() => setAsking('revoke-premium')} />
  ) : (
    <RoleButton label="Offrir Premium" onClick={() => setAsking('grant')} />
  )
  const moderatorButton = p.moderator?.super ? (
    <RoleButton disabled why="Le rôle de super modérateur se donne et se reprend à la main, jamais depuis l’app." label="Retirer le rôle" />
  ) : p.moderator ? (
    <RoleButton label="Retirer le rôle de modérateur" onClick={() => setAsking('revoke-moderator')} />
  ) : p.anonymous ? (
    <RoleButton disabled why="Un compte anonyme ne modère pas : il lui faut d’abord un nom." label="Nommer modérateur" />
  ) : (
    <RoleButton label="Nommer modérateur" onClick={() => setAsking('name')} />
  )

  const days = p.daily.slice(-span)
  const votes = Object.values(p.moderation.votes).reduce((total, n) => total + n, 0)
  const proposed = Object.values(p.moderation.proposed).reduce((total, n) => total + n, 0)
  const powerName = (id: string) => (isPowerId(id) ? t.powers.names[id][0] : id)
  const avgOf = (runs: number, points: number) => (runs ? Math.round(points / runs) : null)

  return (
    <div className="spy-profile dashboard">
      <div className="spy-profile-tags">
        {p.anonymous && <span className="dashboard-tag">anonyme</span>}
        {p.bot && <span className="dashboard-tag">joueur ordinateur</span>}
        {p.moderator && <span className="dashboard-tag">{p.moderator.super ? 'super modérateur' : 'modérateur'}</span>}
        {(bought.length > 0 || p.premium.grant || p.premium.savedSince > 0) && <span className="dashboard-tag">Premium</span>}
      </div>

      <div className="dashboard-stats">
        <Stat value={fmt(levelFor(p.xp))} label={`niveau · ${fmt(p.xp)} XP`} />
        <Stat value={fmt(p.runsCount)} label="parties" />
        <Stat value={fmt(p.best)} label="record" />
        <Stat value={fmt(p.wordsFound)} label="mots trouvés" />
        <Stat value={fmt(p.friends)} label="amis" />
        <Stat value={fmt(p.devices)} label={p.devices > 1 ? 'appareils' : 'appareil'} />
      </div>

      <dl className="spy-profile-facts">
        <dt>Compte</dt>
        <dd>
          créé le {day(p.createdAt)}
          {p.providers.length > 0 && ` · ${p.providers.join(', ')}`}
        </dd>
        <dt>Vu</dt>
        <dd>
          {p.lastOpen ? `ouvert ${ago(p.lastOpen.at)}` : 'aucune ouverture relevée'}
          {p.lastOpen?.platform && ` · ${PLATFORMS[p.lastOpen.platform] ?? p.lastOpen.platform}`}
          {p.lastOpen?.version && ` ${p.lastOpen.version}`}
          {p.lastOpen?.lang && ` · ${p.lastOpen.lang.toUpperCase()}`}
          {p.lastRunAt && ` · dernière partie ${ago(p.lastRunAt)}`}
        </dd>
        <dt>Plateformes</dt>
        <dd>
          {p.platforms.length
            ? p.platforms.map((one) => `${PLATFORMS[one.platform] ?? one.platform} : ${fmt(one.runs)} parties, ${fmt(one.opens)} ouvertures`).join(' · ')
            : '—'}
        </dd>
        <dt>Premium</dt>
        <dd>
          {premiumLine}
          {refused > 0 && ` · ${fmt(refused)} achat${refused > 1 ? 's' : ''} refusé${refused > 1 ? 's' : ''} par le store`}
        </dd>
        <dt>Modération</dt>
        <dd>
          {p.moderator
            ? `depuis le ${day(p.moderator.since)}${p.moderator.invitedBy ? `, par ${p.moderator.invitedBy}` : ''} · langue ${p.moderator.lang.toUpperCase()}`
            : 'pas modérateur'}
        </dd>
      </dl>

      <div className="spy-profile-roles">
        {premiumButton}
        {moderatorButton}
        {failed && <p className="note note--warn">{failed}</p>}
      </div>

      <div className="spy-profile-block">
        <div className="spread">
          <h3>Parties par jour</h3>
          <div className="spy-profile-span">
            {([30, 90] as const).map((n) => (
              <button key={n} type="button" className={`btn btn--quiet${span === n ? '' : ' btn--muted'}`} aria-pressed={span === n} onClick={() => setSpan(n)}>
                {n} j
              </button>
            ))}
          </div>
        </div>
        <RunBars days={days} />
        <h3>Score par jour</h3>
        <ScoreLines days={days} />
        <p className="note">
          <i className="spy-profile-key" style={{ background: 'var(--green)' }} /> meilleur · <i className="spy-profile-key" style={{ background: 'var(--blue)' }} /> moyen
        </p>
      </div>

      <div className="spy-profile-block">
        <h3>Pouvoirs joués</h3>
        {p.powers.length === 0 ? (
          <div className="dashboard-empty">Aucune partie avec un pouvoir.</div>
        ) : (
          <ul className="dashboard-bars">
            {p.powers.map((one) => (
              <li key={one.power}>
                <span className="dashboard-bars-name">{powerName(one.power)}</span>
                <span className="dashboard-bars-num">
                  <b>{fmt(one.runs)}</b> · {fmt(one.points)} pts · {fmt(avgOf(one.runs, one.points))} moy.
                </span>
                <span className="dashboard-bars-track">
                  <span style={{ width: `${(one.runs / Math.max(1, p.powers[0]!.runs)) * 100}%`, background: 'var(--blue)' }} />
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="note">
          Sans pouvoir : {fmt(p.withoutPowers.runs)} parties, {fmt(avgOf(p.withoutPowers.runs, p.withoutPowers.points))} pts en moyenne.
        </p>
      </div>

      <div className="spy-profile-block">
        <h3>Modération</h3>
        <p className="note">
          {fmt(p.moderation.sessions)} session{p.moderation.sessions > 1 ? 's' : ''}
          {p.moderation.lastSession && ` (dernière ${ago(p.moderation.lastSession)})`} · {fmt(votes)} vote{votes > 1 ? 's' : ''}
          {votes > 0 &&
            ` : ${Object.entries(p.moderation.votes)
              .map(([verdict, n]) => `${fmt(n)} ${VERDICTS[verdict] ?? verdict}`)
              .join(', ')}`}
        </p>
        <p className="note">
          {fmt(proposed)} mot{proposed > 1 ? 's' : ''} proposé{proposed > 1 ? 's' : ''}
          {proposed > 0 &&
            ` : ${Object.entries(p.moderation.proposed)
              .map(([status, n]) => `${fmt(n)} ${PROPOSED[status] ?? status}`)
              .join(', ')}`}
        </p>
      </div>

      <div className="spy-profile-block">
        <h3>Fonctions touchées, 90 jours</h3>
        {p.features.length === 0 ? (
          <div className="dashboard-empty">Rien de relevé.</div>
        ) : (
          <ul className="dashboard-bars">
            {p.features.map((one) => (
              <li key={one.name}>
                <span className="dashboard-bars-name">{one.name}</span>
                <span className="dashboard-bars-num">
                  <b>{fmt(one.n)}</b> · {ago(one.last)}
                </span>
                <span className="dashboard-bars-track">
                  <span style={{ width: `${(one.n / Math.max(1, p.features[0]!.n)) * 100}%`, background: 'var(--green)' }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {asking && (
        <div className="spy-confirm" role="dialog" aria-modal="true" aria-labelledby="spy-confirm-title" onClick={() => !busy && setAsking(null)}>
          <div className="spy-confirm-sheet stack" onClick={(event) => event.stopPropagation()}>
            <h3 id="spy-confirm-title">{ASKS[asking].title}</h3>
            <p className="note">
              <b>{p.name}</b> — {ASKS[asking].body}
            </p>
            <div className="spy-confirm-actions">
              <button type="button" className="btn btn--quiet btn--muted" disabled={busy} onClick={() => setAsking(null)}>
                Annuler
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>
                {busy ? '…' : ASKS[asking].label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RoleButton({ label, onClick, disabled = false, why }: { label: string; onClick?(): void; disabled?: boolean; why?: string }) {
  return (
    <div className="spy-profile-role">
      <button type="button" className="btn btn--quiet" disabled={disabled} onClick={onClick}>
        {label}
      </button>
      {why && <span className="note">{why}</span>}
    </div>
  )
}

/* ------------------------------------------------------------ graphiques */

// Le même dessin que les graphiques du tableau de bord : axe à trois paliers,
// barres au bout arrondi, libellés sous l'axe.
const W = 560

function niceMax(value: number): number {
  if (value <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(value))
  const n = value / power
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power
}

function roundedTop(x: number, base: number, width: number, height: number): string {
  const r = Math.min(3, height, width / 2)
  return `M${x},${base} v${-(height - r)} q0,${-r} ${r},${-r} h${width - 2 * r} q${r},0 ${r},${r} v${height - r} z`
}

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

type Daily = SpiedProfile['daily']

function Axis({ max, y, left, format = fmt }: { max: number; y(value: number): number; left: number; format?(value: number): string }) {
  return (
    <>
      {[0, 1, 2].map((step) => (
        <g key={step}>
          <line x1={left} x2={W} y1={y((max / 2) * step)} y2={y((max / 2) * step)} stroke="var(--grid)" />
          <text x={left - 6} y={y((max / 2) * step) + 4} textAnchor="end">
            {format((max / 2) * step)}
          </text>
        </g>
      ))}
    </>
  )
}

function DayLabels({ days, x, height }: { days: Daily; x(index: number): number; height: number }) {
  const every = Math.ceil(days.length / 6)
  return (
    <>
      {days.map((one, index) =>
        (index % every === 0 && days.length - 1 - index >= every * 0.6) || index === days.length - 1 ? (
          <text key={one.day} x={x(index)} y={height - 6} textAnchor="middle">
            {dayLabel(one.day)}
          </text>
        ) : null,
      )}
    </>
  )
}

function RunBars({ days }: { days: Daily }) {
  const H = 150
  const left = 30
  const bottom = 22
  const top = 14
  const max = niceMax(Math.max(1, ...days.map((one) => one.runs)))
  const band = (W - left) / Math.max(1, days.length)
  const y = (value: number) => top + (H - top - bottom) * (1 - value / max)
  const width = Math.max(2, band - Math.min(6, band * 0.3))
  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Parties par jour">
      <Axis max={max} y={y} left={left} />
      {days.map((one, index) =>
        one.runs > 0 ? (
          <path key={one.day} fill="var(--blue)" d={roundedTop(left + index * band + (band - width) / 2, y(0), width, y(0) - y(one.runs))}>
            <title>
              {dayLabel(one.day)} : {one.runs} partie{one.runs > 1 ? 's' : ''}
            </title>
          </path>
        ) : null,
      )}
      <DayLabels days={days} x={(index) => left + index * band + band / 2} height={H} />
      <line x1={left} x2={W} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
    </svg>
  )
}

/** Meilleur et moyen de chaque jour joué. */
function ScoreLines({ days }: { days: Daily }) {
  if (days.every((one) => one.best == null)) return <div className="dashboard-empty">Aucune partie sur la période.</div>
  const H = 150
  const left = 38
  const bottom = 22
  const top = 14
  const max = niceMax(Math.max(1, ...days.map((one) => one.best ?? 0)))
  const band = (W - left) / Math.max(1, days.length)
  const x = (index: number) => left + index * band + band / 2
  const y = (value: number) => top + (H - top - bottom) * (1 - value / max)
  // Un jour sans partie n'a pas de score : la ligne passe par-dessus, d'un jour
  // joué au suivant, plutôt que de se hacher en tirets.
  const line = (value: (one: Daily[number]) => number | null) => {
    let path = ''
    days.forEach((one, index) => {
      const v = value(one)
      if (v != null) path += `${path ? ' L' : 'M'}${x(index).toFixed(1)},${y(v).toFixed(1)}`
    })
    return path ? [path] : []
  }
  const series = [
    { key: 'best', color: 'var(--green)', value: (one: Daily[number]) => one.best },
    { key: 'avg', color: 'var(--blue)', value: (one: Daily[number]) => one.avg },
  ]
  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score par jour">
      <Axis max={max} y={y} left={left} />
      {series.map((one) =>
        line(one.value).map((d, index) =>
          // Un jour isolé n'a pas de segment : un point le montre.
          d.includes('L') ? (
            <path key={`${one.key}:${index}`} d={d} fill="none" stroke={one.color} strokeWidth={2} strokeLinejoin="round" />
          ) : (
            <circle key={`${one.key}:${index}`} cx={d.slice(1).split(',')[0]} cy={d.split(',')[1]} r={2.5} fill={one.color} />
          ),
        ),
      )}
      {days.map((one, index) =>
        one.best != null ? (
          <rect key={one.day} className="dashboard-hit" x={x(index) - band / 2} y={top} width={band} height={H - top - bottom}>
            <title>
              {dayLabel(one.day)} : meilleur {one.best}, moyen {one.avg ?? '—'} ({one.runs} partie{one.runs > 1 ? 's' : ''})
            </title>
          </rect>
        ) : null,
      )}
      <DayLabels days={days} x={x} height={H} />
      <line x1={left} x2={W} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
    </svg>
  )
}
