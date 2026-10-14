import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import type { SpiedRuns } from '../lib/cloud'
import { Avatar } from './Avatar'
import { StatsPage, type RecapActions } from './StatsPage'
import { useBackDismiss } from './useBackDismiss'

const PAGE = 30

/** What a super moderator needs to read another player's runs; the debug board swaps in stand-ins. */
export interface SpyActions {
  load(player: string, before: number | null, limit: number): Promise<SpiedRuns | null>
  recap: RecapActions
}

/**
 * Another player's history, as the statistics page shows one's own: its
 * runs, then each run's words. `player` is an account id or a name — the
 * dashboard has the first, a player sheet only the second.
 */
export function SpyHistory({ player, name, actions, onClose }: { player: string; name: string; actions: SpyActions; onClose(): void }) {
  const t = useT()
  // `undefined` while the first page comes, `null` for nobody to show.
  const [spied, setSpied] = useState<SpiedRuns | null | undefined>(undefined)
  const load = actions.load

  useEffect(() => {
    let live = true
    load(player, null, PAGE).then((found) => live && setSpied(found))
    return () => {
      live = false
    }
  }, [load, player])

  // La carte de signalement se pose sur `body`, où cette vue la couvrirait :
  // tant qu'elle est ouverte, la carte passe au-dessus.
  useEffect(() => {
    document.body.dataset.spy = 'open'
    return () => {
      delete document.body.dataset.spy
    }
  }, [])
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // Échap ferme l'historique, pas le tableau de bord qui écoute aussi.
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', escape, true)
    return () => window.removeEventListener('keydown', escape, true)
  }, [onClose])
  useBackDismiss(onClose)

  return createPortal(
    <div className="spy-history" data-no-swipe role="dialog" aria-modal="true" aria-labelledby="spy-history-title">
      <div className="spy-history-page stack">
        <header className="spy-history-head">
          <button type="button" className="btn btn--quiet btn--muted" onClick={onClose}>
            ← {t.player.close}
          </button>
          <div className="spy-history-who">
            {spied && <Avatar choice={spied.avatar} size="sm" />}
            <h2 id="spy-history-title">{t.player.spyTitle(name)}</h2>
          </div>
        </header>
        {spied === undefined ? (
          <p className="note">{t.loading}</p>
        ) : spied === null ? (
          <p className="note note--warn">{t.player.spyMissing}</p>
        ) : spied.runs.length === 0 ? (
          <p className="note">{t.player.spyEmpty}</p>
        ) : (
          <StatsPage
            history={spied.runs}
            profile={{ bestScore: spied.best, runs: spied.runsCount }}
            challenges={null}
            onChallenge={() => {}}
            loadOlder={(before, limit) => load(spied.id, before, limit).then((page) => page?.runs ?? null)}
            recap={actions.recap}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
