import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { LEAGUES, PLACEMENT_GAMES, standing, type LeagueId } from '../domain/ranked'
import { useT } from '../i18n'
import { fetchDuelLadderView, type DuelLadderView } from '../lib/cloud'
import { loadAccount } from '../state/storage'
import { Avatar } from './Avatar'
import { LeagueChip, LeagueMark, TierMark } from './League'
import '../ranked.css'

/** Les onglets du classement, du haut vers le bas : le top, les Maîtres, chaque ligue, puis ma place. */
const VIEWS: readonly DuelLadderView[] = ['top', 'master', ...[...LEAGUES].reverse().map((league) => league.id), 'me']

/**
 * Le classement du duel classé, dans la page des classements : rang par rang
 * — le top, les Maîtres, chaque ligue —, jamais l'Elo, et en pied ma place,
 * qu'un geste ouvre au milieu de mes voisins.
 */
export function DuelLadder({ load = fetchDuelLadderView }: { load?: typeof fetchDuelLadderView }) {
  const t = useT()
  const [view, setView] = useState<DuelLadderView>('top')
  const [ladder, setLadder] = useState<Awaited<ReturnType<typeof fetchDuelLadderView>> | 'loading'>('loading')
  const [take, setTake] = useState(0)
  const me = useMemo(() => loadAccount(), [])
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    let live = true
    setLadder('loading')
    void load(view, 50).then((rows) => live && setLadder(rows))
    return () => {
      live = false
    }
  }, [load, view, take])

  const rows = ladder === 'loading' || !ladder ? [] : ladder.rows
  const mine = ladder !== 'loading' && ladder?.me ? ladder.me : null
  // Ma ligne : mon nom, ou ma place quand l'appareil ne connaît pas mon compte.
  const isMe = (name: string, rank: number | null) => (!!me && name === me.name) || (!me && !!mine?.rank && rank === mine.rank)
  // Ouverte sur ma place, la liste se centre sur ma ligne.
  useEffect(() => {
    if (view !== 'me') return
    list.current?.querySelector<HTMLElement>('.duel-ladder__row--me')?.scrollIntoView({ block: 'center' })
  }, [rows, view])
  const placed = !!mine && mine.games >= PLACEMENT_GAMES

  return (
    <section className="duel-ladder" aria-label={t.ranked.ladder}>
      <p className="note duel-ladder__lead">{t.ranked.ladderLead}</p>
      <div className="duel-ladder__views" role="tablist" aria-label={t.ranked.ladder}>
        {VIEWS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={`duel-ladder__view${view === id ? ' duel-ladder__view--on' : ''}`}
            onClick={() => setView(id)}
          >
            {id === 'top' || id === 'me' ? null : id === 'master' ? <TierMark tier={{ kind: 'master', spot: 1 }} /> : <LeagueMark league={id as LeagueId} />}
            {id === 'top' || id === 'master' || id === 'me' ? t.ranked.views[id] : t.ranked.leagues[id as LeagueId]}
          </button>
        ))}
      </div>
      {ladder === 'loading' ? (
        <p className="note">{t.ranked.ladderLoading}</p>
      ) : !ladder ? (
        <div className="duel-ladder__failed">
          <p className="note">{t.ranked.ladderFailed}</p>
          <button type="button" className="btn btn--quiet" onClick={() => setTake((n) => n + 1)}>
            {t.ranked.retry}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="note">{view === 'top' ? t.ranked.ladderEmpty : view === 'me' && !placed ? t.ranked.meUnplaced(PLACEMENT_GAMES - (mine?.games ?? 0)) : t.ranked.viewEmpty}</p>
      ) : (
        <ol className="duel-ladder__rows" ref={list}>
          {rows.map((row) => {
            const self = isMe(row.name, row.rank)
            return (
              <li key={row.player} className={`duel-ladder__row${self ? ' duel-ladder__row--me' : ''}${row.rank !== null && row.rank <= 3 ? ' duel-ladder__row--podium' : ''}`}>
                <span className="duel-ladder__rank">{row.rank ?? '–'}</span>
                <Avatar choice={row.avatar} size="sm" />
                <span className="duel-ladder__name">{self ? t.ranked.ladderYou : row.name}</span>
                <LeagueChip rating={row.rating} games={row.games} rank={row.rank} compact short />
              </li>
            )
          })}
        </ol>
      )}
      {mine ? (
        <div className="duel-ladder__mine">
          <b>{t.ranked.ladderYou}</b>
          <span>{placed && mine.rank ? t.ranked.rank(mine.rank) : t.ranked.placement(Math.min(mine.games, PLACEMENT_GAMES), PLACEMENT_GAMES)}</span>
          <LeagueChip rating={mine.rating} games={mine.games} rank={mine.rank} compact />
          {placed && view !== 'me' ? (
            <button type="button" className="duel-ladder__jump" onClick={() => setView('me')}>
              {t.ranked.views.me}
            </button>
          ) : null}
        </div>
      ) : null}
      {/* Le rang de chaque ligue se lit d'un coup d'œil : la jauge de ma division. */}
      {mine && placed && view === 'me' ? (
        <div className="progress duel-ladder__gauge" aria-hidden="true">
          <span style={{ '--ratio': standing(mine, mine.rank).progress } as CSSProperties} />
        </div>
      ) : null}
    </section>
  )
}
