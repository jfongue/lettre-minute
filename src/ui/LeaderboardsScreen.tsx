import { useMemo, useState } from 'react'
import type { AvatarChoice } from '../domain/avatar'
import type { RunRecord } from '../domain/history'
import { useT } from '../i18n'
import { guestLoader } from './guestBoards'
import type { fetchDuelLadderView } from '../lib/cloud'
import type { BadgeLoader } from './useDuelBadges'
import { BoardSwitch, type BoardFamily } from './BoardSwitch'
import { DuelLadder } from './DuelLadder'
import { LeaderboardsPage, type LoadLeaderboard } from './LeaderboardsPage'
import { useBackDismiss } from './useBackDismiss'

/**
 * Tous les classements, sur une page entière plutôt que dans le tiroir : les
 * parties seules, le défi du moment et, quand il est ouvert au joueur, le
 * duel classé. La flèche ramène d'où l'on vient.
 */
export function LeaderboardsScreen({
  named,
  guest = false,
  onSignIn,
  moderator = false,
  duel = false,
  initial = 'runs',
  history = [],
  avatar,
  load: given,
  loadLadder,
  badges,
  onBack,
}: {
  named: boolean
  guest?: boolean
  onSignIn?(): void
  moderator?: boolean
  /** Le duel classé a sa case : un compte nommé, la fonctionnalité ouverte. */
  duel?: boolean
  initial?: BoardFamily
  /** Ce que l'invité du portail compte sur l'appareil pour sa ligne « Moi ». */
  history?: readonly RunRecord[]
  avatar?: AvatarChoice
  load?: LoadLeaderboard
  loadLadder?: typeof fetchDuelLadderView
  badges?: BadgeLoader
  onBack(): void
}) {
  const t = useT()
  useBackDismiss(onBack)
  const load = useMemo(
    () => given ?? (guest && avatar ? guestLoader({ history, avatar, name: t.boards.me, tag: t.tag }) : undefined),
    [avatar, given, guest, history, t],
  )
  const families: readonly BoardFamily[] = guest ? ['runs'] : duel ? ['runs', 'weekly', 'duel'] : ['runs', 'weekly']
  const [family, setFamily] = useState<BoardFamily>(families.includes(initial) ? initial : 'runs')
  return (
    <main className="stage stage--boards">
      <div className="sheet boards-page">
        <header className="boards-page__head">
          <button type="button" className="subpage-back" aria-label={t.duel.errorBack} onClick={onBack}>
            ←
          </button>
          <h1 className="boards-page__title">{t.menu.pages.boards}</h1>
        </header>
        {families.length > 1 ? <BoardSwitch family={family} onFamily={setFamily} families={families} /> : null}
        {family === 'duel' ? (
          <DuelLadder load={loadLadder} />
        ) : (
          <LeaderboardsPage named={named} guest={guest} onSignIn={onSignIn} load={load} badges={badges} moderator={moderator} family={family} onFamily={setFamily} />
        )}
      </div>
    </main>
  )
}
