import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AUDIENCES, enabledFeatures, FEATURES, type Audience, type FlagRow, type FlagValue, type Roles } from '../domain/features'
import { fetchFeatureFlags, setFeatureFlag, type FlagOutcome } from '../lib/cloud'
import { useBackDismiss } from '../ui/useBackDismiss'

/*
 * Le réglage des fonctionnalités : ce que chaque public peut ouvrir, case par
 * case. Réservé aux super modérateurs — le serveur refuse les autres
 * (`set_feature_flag`, 0045) —, ouvert depuis les options. Chaque appareil lit
 * la table à son démarrage et ne l'applique qu'au suivant : rien ne change
 * sous les doigts d'un joueur.
 *
 * Un outil de développeur : libellés français hors de l'i18n, comme la planche.
 */

const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: 'Tout le monde',
  moderator: 'Modérateur',
  premium: 'Premium',
  superModerator: 'Super modérateur',
}

const VALUE_LABELS: Record<FlagValue, string> = { on: 'Dispo', off: 'Bloqué', neutral: 'Neutre' }
const NEXT: Record<FlagValue, FlagValue> = { on: 'off', off: 'neutral', neutral: 'on' }

export type LoadFlags = () => Promise<Record<string, FlagRow> | null>
export type SaveFlag = (feature: string, audience: Audience, value: FlagValue) => Promise<FlagOutcome>

/** Le chargeur, posé sur `body` comme le tableau de bord. */
export function FeaturesBoard({
  onClose,
  roles,
  load = fetchFeatureFlags,
  save = setFeatureFlag,
}: {
  onClose(): void
  /** Les rôles du joueur qui règle : la dernière colonne lui dit ce qu'il verra lui-même. */
  roles: Roles
  load?: LoadFlags
  save?: SaveFlag
}) {
  useBackDismiss(onClose)
  return createPortal(
    <div className="dashboard dashboard--overlay" data-no-swipe role="dialog" aria-label="Fonctionnalités">
      <FeaturesBoardView load={load} save={save} roles={roles} onClose={onClose} />
    </div>,
    document.body,
  )
}

export function FeaturesBoardView({ load, save, roles, onClose }: { load: LoadFlags; save: SaveFlag; roles: Roles; onClose?(): void }) {
  const [flags, setFlags] = useState<Record<string, FlagRow> | null | 'failed'>(null)
  const [busy, setBusy] = useState<Record<string, 'saving' | 'error'>>({})

  useEffect(() => {
    let live = true
    void load().then((rows) => live && setFlags(rows ?? 'failed'))
    return () => {
      live = false
    }
  }, [load])

  const table = useMemo(() => (flags === null || flags === 'failed' ? {} : flags), [flags])
  const mine = useMemo(() => enabledFeatures(table, roles), [roles, table])

  const cycle = async (feature: string, audience: Audience) => {
    if (flags === null || flags === 'failed') return
    const row = table[feature] ?? FEATURES.find((one) => one.id === feature)!.defaults
    const value = NEXT[row[audience]]
    const key = `${feature}:${audience}`
    setFlags({ ...table, [feature]: { ...row, [audience]: value } })
    setBusy((current) => ({ ...current, [key]: 'saving' }))
    const outcome = await save(feature, audience, value)
    setBusy((current) => {
      const next = { ...current }
      if (outcome === 'saved') delete next[key]
      else next[key] = 'error'
      return next
    })
    if (outcome !== 'saved') setFlags((current) => (current && current !== 'failed' ? { ...current, [feature]: row } : current))
  }

  return (
    <div className="dashboard-wrap features-board">
      <header className="dashboard-head">
        {onClose && (
          <button type="button" className="btn btn--quiet btn--muted dashboard-close" onClick={onClose}>
            ← Fermer
          </button>
        )}
        <div className="dashboard-headline">
          <h1>
            Lettre <em>Minute</em>
            <br />
            fonctionnalités
          </h1>
        </div>
        <p className="note">
          Une case dispo suffit à ouvrir ; sinon une case bloquée ferme ; une ligne toute neutre suit le code. Chaque joueur reçoit
          ces réglages au prochain démarrage de son application.
        </p>
      </header>

      {flags === null ? <p className="note">Lecture des réglages…</p> : null}
      {flags === 'failed' ? <p className="note note--warn">Le serveur ne répond pas : les réglages ne peuvent pas être changés.</p> : null}

      {flags !== null && flags !== 'failed' ? (
        <div className="features-grid" role="table" aria-label="Fonctionnalités par public">
          <div className="features-row features-row--head" role="row">
            <span role="columnheader">Fonctionnalité</span>
            {AUDIENCES.map((audience) => (
              <span key={audience} role="columnheader">
                {AUDIENCE_LABELS[audience]}
              </span>
            ))}
            <span role="columnheader">Pour toi</span>
          </div>
          {FEATURES.map((feature) => {
            const row = table[feature.id] ?? feature.defaults
            const custom = !!table[feature.id]
            return (
              <div key={feature.id} className="features-row" role="row">
                <span className="features-name" role="rowheader">
                  <b>{feature.label}</b>
                  <small>
                    {feature.note}
                    {custom ? '' : ' · valeurs du code'}
                  </small>
                </span>
                {AUDIENCES.map((audience) => {
                  const key = `${feature.id}:${audience}`
                  return (
                    <button
                      key={audience}
                      type="button"
                      role="cell"
                      className={`features-cell features-cell--${row[audience]}${busy[key] ? ` features-cell--${busy[key]}` : ''}`}
                      aria-label={`${feature.label}, ${AUDIENCE_LABELS[audience]} : ${VALUE_LABELS[row[audience]]}`}
                      onClick={() => void cycle(feature.id, audience)}
                    >
                      {VALUE_LABELS[row[audience]]}
                    </button>
                  )
                })}
                <span className={`features-mine${mine.has(feature.id) ? ' features-mine--on' : ''}`} role="cell">
                  {mine.has(feature.id) ? 'Ouvert' : 'Fermé'}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
