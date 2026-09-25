import { useEffect, useState, type CSSProperties } from 'react'
import {
  answersTo,
  awardTrophies,
  CHALLENGE_MAX_PLAYERS,
  mostSharedWords,
  settleChallenge,
  uniqueWords,
  type SettledWord,
  type Standing,
  type TalliedWord,
} from '../domain/challenge'
import { capitalized } from '../domain/text'
import { categoryText, formatNumber, useT } from '../i18n'
import {
  fetchChallenge,
  inviteToChallenge,
  markChallengeSeen,
  type ChallengeDetail,
  type ChallengePlayer,
} from '../lib/cloud'
import { challengeTitle, hoursLeft } from '../state/challenges'
import { Avatar } from './Avatar'
import { LetterMark, Shape, TierTag } from './bauhaus'
import { FriendPicker } from './FriendPicker'
import { categoryMotif } from './motifs'

const playerOf = (detail: ChallengeDetail) => {
  const byId = new Map(detail.players.map((player) => [player.playerId, player]))
  return (id: string) => byId.get(id)
}

function Standings({ detail, standings }: { detail: ChallengeDetail; standings: readonly Standing[] }) {
  const t = useT()
  const player = playerOf(detail)
  return (
    <div className="standings">
      {standings.map((standing, index) => {
        const who = player(standing.playerId)
        return (
          <div
            key={standing.playerId}
            className={`standing${index === 0 ? ' standing--leader' : ''}${who?.me ? ' standing--me' : ''}`}
          >
            <span className="rank">{index + 1}</span>
            {who && <Avatar choice={who.avatar} size="sm" />}
            <span className="name challenge-standing-name">
              {who?.me ? t.challenge.you : who?.name}
              {standing.raw !== standing.score && (
                <span className="note">{t.challenge.raw(formatNumber(t, standing.raw))}</span>
              )}
            </span>
            <span className="points">{formatNumber(t, standing.score)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** What the others put on the same letter and category, unfolded under one of the player's words. */
function Answers({ detail, word }: { detail: ChallengeDetail; word: SettledWord }) {
  const t = useT()
  const player = playerOf(detail)
  const others = answersTo(detail.players, word).filter((answer) => !player(answer.playerId)?.me)
  return (
    <ul className="challenge-answers">
      {others.map((answer) => {
        const who = player(answer.playerId)
        return (
          <li key={answer.playerId} className="challenge-answer">
            {who && <Avatar choice={who.avatar} size="sm" />}
            <span className="challenge-answer-name">{who?.name}</span>
            <span className="challenge-answer-words">
              {answer.words.length === 0 ? (
                <span className="note">{t.challenge.nothing}</span>
              ) : (
                answer.words.map((found) => (
                  <span
                    key={found.key}
                    className={`challenge-answer-word${found.key === word.key ? ' challenge-answer-word--same' : ''}`}
                  >
                    {found.approximate && <span className="note">≈ </span>}
                    {capitalized(found.display)}
                  </span>
                ))
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function MyWords({ detail, standing }: { detail: ChallengeDetail; standing: Standing }) {
  const t = useT()
  const [open, setOpen] = useState<string | null>(null)
  const rivals = detail.players.some((player) => !player.me && player.playedAt !== null)
  return (
    <section className="stack">
      <p className="section-title">{t.challenge.yourWords}</p>
      {standing.words.length === 0 ? (
        <p className="note">{t.over.empty}</p>
      ) : (
        <>
          {rivals && <p className="note">{t.challenge.yourWordsHint}</p>}
          <ol className="reveal-words">
            {standing.words.map((word) => {
              const id = `${word.categoryId}:${word.key}`
              const unfolded = open === id
              return (
                <li key={id} className="challenge-word-item">
                  <button
                    type="button"
                    className="reveal-word challenge-word"
                    disabled={!rivals}
                    aria-expanded={rivals ? unfolded : undefined}
                    onClick={() => setOpen(unfolded ? null : id)}
                  >
                    <LetterMark letter={word.letter} motif={categoryMotif(word.categoryId)} size="sm" />
                    <span className="reveal-word-text">
                      {word.approximate && <span className="note">≈ </span>}
                      {capitalized(word.display)}
                      <span className="reveal-word-category">{categoryText(t, word.categoryId).label}</span>
                    </span>
                    <span className={`tag ${word.sharedWith > 0 ? 'tag--plain' : 'challenge-alone'}`}>
                      {word.sharedWith > 0 ? t.challenge.shared(word.sharedWith) : t.challenge.alone}
                    </span>
                    <span className="reveal-word-points">
                      {word.settled !== word.points && <s className="challenge-halved">{word.points}</s>}+{word.settled}
                    </span>
                  </button>
                  {unfolded && <Answers detail={detail} word={word} />}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

/** Who is still to play, and until when. */
function Pending({ detail }: { detail: ChallengeDetail }) {
  const t = useT()
  const waiting = detail.players.filter((player) => player.playedAt === null)
  if (waiting.length === 0 || detail.finished) return null
  return (
    <section className="stack">
      <p className="note">{t.challenge.waitingFor(waiting.length, hoursLeft(detail.expiresAt))}</p>
      <ul className="friends">
        {waiting.map((player) => (
          <li key={player.playerId} className="friend challenge-waiting">
            <Avatar choice={player.avatar} size="sm" />
            <span className="friend-name">{player.me ? t.challenge.you : player.name}</span>
            <span className="note">{t.challenge.notYet}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The leader alone can bring more friends in, while the challenge runs and has seats. */
function InviteMore({ detail, onChanged }: { detail: ChallengeDetail; onChanged(): void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const seats = CHALLENGE_MAX_PLAYERS - detail.players.length
  if (!detail.owned || detail.finished || seats <= 0) return null

  return (
    <>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => setOpen(true)}>
        {t.challenge.inviteMore}
      </button>
      {message && !open && <p className="note">{message}</p>}
      {open && (
        <FriendPicker
          title={t.challenge.inviteTitle}
          exclude={detail.players.map((player) => player.playerId)}
          max={seats}
          busy={busy}
          message={message}
          confirmLabel={t.challenge.inviteSend}
          onClose={() => setOpen(false)}
          onConfirm={async (ids) => {
            setBusy(true)
            const outcome = await inviteToChallenge(detail.id, ids)
            setBusy(false)
            setMessage(t.challenge.invites[outcome])
            if (outcome === 'sent') {
              setOpen(false)
              onChanged()
            }
          }}
        />
      )}
    </>
  )
}

interface ChallengeBoardProps {
  detail: ChallengeDetail
  /** Something changed on the server: the caller reads the challenge again. */
  onChanged(): void
}

/** The standings as they stand: settled again each time a player joins. */
export function ChallengeBoard({ detail, onChanged }: ChallengeBoardProps) {
  const t = useT()
  const standings = settleChallenge(detail.players)
  const mine = standings.find((standing) => playerOf(detail)(standing.playerId)?.me)

  return (
    <>
      <section className="panel">
        <div className="spread">
          <p className="section-title">{detail.finished ? t.challenge.final : t.challenge.provisional}</p>
          <p className="note">{t.challenge.playedCount(standings.length, detail.players.length)}</p>
        </div>
        <Standings detail={detail} standings={standings} />
        <p className="note">{t.challenge.rules}</p>
      </section>
      <Pending detail={detail} />
      <InviteMore detail={detail} onChanged={onChanged} />
      {mine && <MyWords detail={detail} standing={mine} />}
    </>
  )
}

function WordList({ words, detail, title }: { words: readonly TalliedWord[]; detail: ChallengeDetail; title: string }) {
  const t = useT()
  const player = playerOf(detail)
  if (words.length === 0) return null
  const names = (ids: readonly string[]) =>
    ids.map((id) => (player(id)?.me ? t.challenge.you : (player(id)?.name ?? ''))).join(', ')
  return (
    <section className="stack">
      <p className="section-title">{title}</p>
      <ol className="reveal-words">
        {words.map((word) => (
          <li key={`${word.categoryId}:${word.key}`} className="reveal-word challenge-word">
            <LetterMark letter={word.letter} motif={categoryMotif(word.categoryId)} size="sm" />
            <span className="reveal-word-text">
              {capitalized(word.display)}
              <span className="reveal-word-category">
                {categoryText(t, word.categoryId).label} · {names(word.players)}
              </span>
            </span>
            {word.tier !== 'courant' ? <TierTag tier={word.tier} /> : <span />}
            <span className="reveal-word-points">×{word.players.length}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const TROPHY_TINTS = ['yellow', 'red', 'blue', 'pink', 'green'] as const

function Trophies({ detail }: { detail: ChallengeDetail }) {
  const t = useT()
  const trophies = awardTrophies(detail.players)
  const player = playerOf(detail)
  if (trophies.length === 0) return null
  return (
    <section className="stack">
      <p className="section-title">{t.challenge.trophiesTitle}</p>
      <ul className="trophies">
        {trophies.map((trophy, index) => {
          const [name, line] = t.challenge.trophies[trophy.id]
          const who = player(trophy.playerId)
          const tint = TROPHY_TINTS[index % TROPHY_TINTS.length]!
          return (
            <li key={trophy.id} className="trophy" style={{ '--i': index } as CSSProperties}>
              <span className="trophy-mark" aria-hidden="true">
                <Shape kind={index % 2 === 0 ? 'sun' : 'circle'} tint={tint} />
              </span>
              <span className="trophy-text">
                <strong>{name}</strong>
                <span>
                  {who && <Avatar choice={who.avatar} size="sm" />}
                  <span className="trophy-who">{who?.me ? t.challenge.you : who?.name}</span>
                </span>
                <span className="note">{line(trophy.value, capitalized(trophy.word ?? ''))}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

interface ChallengeRecapProps {
  detail: ChallengeDetail
  /** Resolves false when neither a rematch of one's own nor the existing one could be reached. */
  onRematch(detail: ChallengeDetail): Promise<boolean>
}

/** The closing débrief: final standings, the words everyone had and nobody had, and the trophies. */
export function ChallengeRecap({ detail, onRematch }: ChallengeRecapProps) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const standings = settleChallenge(detail.players)
  const me = detail.players.find((player) => player.me)
  const mine = standings.find((standing) => standing.playerId === me?.playerId)

  return (
    <>
      <section className="panel">
        <p className="section-title">{t.challenge.final}</p>
        <Standings detail={detail} standings={standings} />
        <p className="note">{t.challenge.rules}</p>
      </section>
      <Trophies detail={detail} />
      <WordList words={mostSharedWords(detail.players)} detail={detail} title={t.challenge.mostShared} />
      <WordList words={uniqueWords(detail.players)} detail={detail} title={t.challenge.mostUnique} />
      {mine && <MyWords detail={detail} standing={mine} />}
      {me?.playedAt !== null && me !== undefined && (
        <div className="stack">
          {failed && <p className="note note--warn">{t.challenge.rematchFailed}</p>}
          <button
            type="button"
            className="btn btn--play btn--block"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const ok = await onRematch(detail)
              setBusy(false)
              setFailed(!ok)
            }}
          >
            <span>{busy ? t.wait : detail.nextId ? t.challenge.joinRematch : t.challenge.rematch}</span>
            <span className="play-glyph" aria-hidden="true">
              <Shape kind="circle" tint="yellow" />
              <span className="motion play-triangle">
                <Shape kind="triangle" tint="red" />
              </span>
            </span>
          </button>
        </div>
      )}
    </>
  )
}

function Lineup({ categoryIds }: { categoryIds: readonly string[] }) {
  const t = useT()
  return (
    <p className="challenge-lineup">
      {categoryIds.map((id) => (
        <span key={id} className="tag tag--plain">
          {categoryText(t, id).label}
        </span>
      ))}
    </p>
  )
}

interface ChallengeScreenProps {
  id: string
  onPlay(detail: ChallengeDetail): void
  onRematch(detail: ChallengeDetail): Promise<boolean>
  onBack(): void
}

/** One challenge, opened from the home screen: to play, under way, or over. */
export function ChallengeScreen({ id, onPlay, onRematch, onBack }: ChallengeScreenProps) {
  const [detail, setDetail] = useState<ChallengeDetail | null | 'loading'>('loading')
  const load = () => fetchChallenge(id).then(setDetail)

  useEffect(() => {
    setDetail('loading')
    load()
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const finished = detail !== 'loading' && detail !== null && detail.finished
  useEffect(() => {
    if (finished) markChallengeSeen(id, 'recap')
  }, [finished, id])

  return <ChallengeView detail={detail} onPlay={onPlay} onRematch={onRematch} onBack={onBack} onChanged={load} />
}

interface ChallengeViewProps extends Omit<ChallengeScreenProps, 'id'> {
  detail: ChallengeDetail | null | 'loading'
  onChanged(): void
}

/** The challenge screen once read: the debug board shows it without a server. */
export function ChallengeView({ detail, onPlay, onRematch, onBack, onChanged }: ChallengeViewProps) {
  const t = useT()
  const finished = detail !== 'loading' && detail !== null && detail.finished
  const me: ChallengePlayer | undefined = detail !== 'loading' && detail ? detail.players.find((player) => player.me) : undefined

  return (
    <div className="sheet cascade challenge-screen">
      <div className="subpage-head">
        <button type="button" className="subpage-back" onClick={onBack} aria-label={t.challenge.back}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="subpage-title">{detail !== 'loading' && detail ? challengeTitle(t, detail) : t.challenge.title}</h1>
      </div>

      {detail === 'loading' && <p className="note">{t.loading}</p>}
      {detail === null && <p className="note note--warn">{t.challenge.loadFailed}</p>}

      {detail !== 'loading' && detail && (
        <>
          <Lineup categoryIds={detail.categoryIds} />
          {finished ? (
            <ChallengeRecap detail={detail} onRematch={onRematch} />
          ) : me?.playedAt === null ? (
            <>
              <section className="panel">
                <p className="note">{t.challenge.invitePop.lead(detail.players.length, hoursLeft(detail.expiresAt))}</p>
                <ul className="friends">
                  {detail.players.map((player) => (
                    <li key={player.playerId} className="friend challenge-waiting">
                      <Avatar choice={player.avatar} size="sm" />
                      <span className="friend-name">{player.me ? t.challenge.you : player.name}</span>
                      <span className="note">
                        {player.playedAt === null ? t.challenge.notYet : `${formatNumber(t, player.score)} ${t.over.points}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <button type="button" className="btn btn--play btn--block" onClick={() => onPlay(detail)}>
                <span>{t.challenge.play}</span>
                <span className="play-glyph" aria-hidden="true">
                  <Shape kind="circle" tint="yellow" />
                  <span className="motion play-triangle">
                    <Shape kind="triangle" tint="red" />
                  </span>
                </span>
              </button>
            </>
          ) : (
            <ChallengeBoard detail={detail} onChanged={onChanged} />
          )}
        </>
      )}

      <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>
        {t.challenge.home}
      </button>
    </div>
  )
}
