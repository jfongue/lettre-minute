import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { fetchDuelLadder } from '../lib/cloud'
import { loadAccount } from '../state/storage'
import { Avatar } from './Avatar'
import { LeagueChip } from './League'
import '../ranked.css'

/**
 * Le classement du duel classé, dans la page des classements : les joueurs
 * placés, leur rang — Maître pour les dix premiers, puis ligue et division —,
 * jamais leur Elo, et ma ligne en bas quand je n'y suis pas.
 */
export function DuelLadder({ load = fetchDuelLadder }: { load?: typeof fetchDuelLadder }) {
  const t = useT()
  const [ladder, setLadder] = useState<Awaited<ReturnType<typeof fetchDuelLadder>> | 'loading'>('loading')
  const me = useMemo(() => loadAccount(), [])
  const [take, setTake] = useState(0)
  useEffect(() => {
    let live = true
    setLadder('loading')
    void load(50).then((rows) => live && setLadder(rows))
    return () => {
      live = false
    }
  }, [load, take])
  const rows = ladder === 'loading' || !ladder ? [] : ladder.rows
  const mine = ladder !== 'loading' && ladder?.me ? ladder.me : null
  const listed = !!me && rows.some((row) => row.name === me.name)
  return (
    <section className="duel-ladder" aria-label={t.ranked.ladder}>
      <p className="note duel-ladder__lead">{t.ranked.ladderLead}</p>
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
        <p className="note">{t.ranked.ladderEmpty}</p>
      ) : (
        <ol className="duel-ladder__rows">
          {rows.map((row) => {
            const self = !!me && row.name === me.name
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
      {mine && !listed ? (
        <p className="duel-ladder__mine">
          <b>{t.ranked.ladderYou}</b>
          {mine.rank ? <span>{t.ranked.rank(mine.rank)}</span> : <span />}
          <LeagueChip rating={mine.rating} games={mine.games} rank={mine.rank} compact />
        </p>
      ) : null}
    </section>
  )
}
