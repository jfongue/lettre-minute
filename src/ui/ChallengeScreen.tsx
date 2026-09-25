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
  reactInChallenge,
  type ChallengeDetail,
  type ChallengePlayer,
  type ReactionEmoji,
} from '../lib/cloud'
import { challengeTitle, hoursLeft } from '../state/challenges'
import { Avatar } from './Avatar'
import { LetterMark, Shape, TierTag } from './bauhaus'
import { FriendPicker } from './FriendPicker'
import { categoryMotif, onTint } from './motifs'
import { PlayerName } from './PlayerSheet'
import { ReactionCounts, ReactionPanel, useRecapReactions, type RecapReactions } from './Reactions'
import { ScoreRace } from './ScoreRace'
import { TROPHY_TINTS, TrophyIcon } from './TrophyIcon'

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
              {who && !who.me ? (
                <PlayerName name={who.name} avatar={who.avatar}>
                  {who.name}
                </PlayerName>
              ) : (
                t.challenge.you
              )}
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
                    {rivals && <Chevron open={unfolded} />}
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

/** What tells a row it unfolds. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`row-chevron${open ? ' row-chevron--open' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
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

const wordTarget = (word: { categoryId: string; key: string }) => `word:${word.categoryId}:${word.key}`

function WordList({
  words,
  detail,
  title,
  reactions,
}: {
  words: readonly TalliedWord[]
  detail: ChallengeDetail
  title: string
  reactions: RecapReactions
}) {
  const t = useT()
  const player = playerOf(detail)
  const [open, setOpen] = useState<string | null>(null)
  if (words.length === 0) return null
  const names = (ids: readonly string[]) =>
    ids.map((id) => (player(id)?.me ? t.challenge.you : (player(id)?.name ?? ''))).join(', ')
  return (
    <section className="stack">
      <p className="section-title">{title}</p>
      <ol className="reveal-words">
        {words.map((word) => {
          const target = wordTarget(word)
          const unfolded = open === target
          return (
            <li key={target} className="challenge-word-item">
              <button
                type="button"
                className="reveal-word challenge-word"
                aria-expanded={unfolded}
                onClick={() => setOpen(unfolded ? null : target)}
              >
                <LetterMark letter={word.letter} motif={categoryMotif(word.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {capitalized(word.display)}
                  <span className="reveal-word-category">
                    {categoryText(t, word.categoryId).label} · {names(word.players)}
                  </span>
                  <ReactionCounts target={target} reactions={reactions} />
                </span>
                {word.tier !== 'courant' ? <TierTag tier={word.tier} /> : <span />}
                <span className="reveal-word-points">×{word.players.length}</span>
                <Chevron open={unfolded} />
              </button>
              {unfolded && <ReactionPanel target={target} reactions={reactions} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Trophies({ detail, reactions }: { detail: ChallengeDetail; reactions: RecapReactions }) {
  const t = useT()
  const trophies = awardTrophies(detail.players)
  const player = playerOf(detail)
  const [open, setOpen] = useState<string | null>(null)
  if (trophies.length === 0) return null
  return (
    <section className="stack">
      <p className="section-title">{t.challenge.trophiesTitle}</p>
      <ul className="trophies">
        {trophies.map((trophy, index) => {
          const [name, line] = t.challenge.trophies[trophy.id]
          const who = player(trophy.playerId)
          const target = `trophy:${trophy.id}`
          const unfolded = open === target
          const tint = TROPHY_TINTS[trophy.id]
          return (
            <li key={trophy.id} className="trophy-item" style={{ '--i': index } as CSSProperties}>
              <button
                type="button"
                className="trophy"
                aria-expanded={unfolded}
                onClick={() => setOpen(unfolded ? null : target)}
              >
                <span className="trophy-mark" style={{ background: `var(--${tint})` }} aria-hidden="true">
                  <TrophyIcon id={trophy.id} tint={onTint(tint)} />
                </span>
                <span className="trophy-text">
                  <strong>{name}</strong>
                  <span>
                    {who && <Avatar choice={who.avatar} size="sm" />}
                    <span className="trophy-who">{who?.me ? t.challenge.you : who?.name}</span>
                  </span>
                  <span className="note">{line(trophy.value, capitalized(trophy.word ?? ''))}</span>
                  <ReactionCounts target={target} reactions={reactions} />
                </span>
                <Chevron open={unfolded} />
              </button>
              {unfolded && <ReactionPanel target={target} reactions={reactions} />}
            </li>
          )
        })}
      </ul>
      <p className="note">{t.challenge.reactHint}</p>
    </section>
  )
}

/** The words everyone had and nobody had: behind a toggle, the recap is long enough. */
function MoreStats({ detail, reactions }: { detail: ChallengeDetail; reactions: RecapReactions }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const shared = mostSharedWords(detail.players)
  const unique = uniqueWords(detail.players)
  if (shared.length === 0 && unique.length === 0) return null
  return (
    <>
      <button type="button" className="btn btn--ghost btn--block" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? t.challenge.lessStats : t.challenge.moreStats}
        <Chevron open={open} />
      </button>
      {open && (
        <>
          <WordList words={shared} detail={detail} title={t.challenge.mostShared} reactions={reactions} />
          <WordList words={unique} detail={detail} title={t.challenge.mostUnique} reactions={reactions} />
        </>
      )}
    </>
  )
}

interface ChallengeRecapProps {
  detail: ChallengeDetail
  /** Resolves false when neither a rematch of one's own nor the existing one could be reached. */
  onRematch(detail: ChallengeDetail): Promise<boolean>
  onReact(target: string, emoji: ReactionEmoji | null): Promise<boolean>
}

/** The closing débrief: final standings, the words everyone had and nobody had, and the trophies. */
export function ChallengeRecap({ detail, onRematch, onReact }: ChallengeRecapProps) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const standings = settleChallenge(detail.players)
  const me = detail.players.find((player) => player.me)
  const mine = standings.find((standing) => standing.playerId === me?.playerId)
  const player = playerOf(detail)
  const reactions = useRecapReactions(
    detail.reactions,
    me?.playerId,
    me?.playedAt !== null && me !== undefined,
    (id) => player(id)?.name ?? '',
    onReact,
  )

  return (
    <>
      <section className="panel">
        <p className="section-title">{t.challenge.final}</p>
        <Standings detail={detail} standings={standings} />
        <p className="note">{t.challenge.rules}</p>
      </section>
      <ScoreRace standings={standings} player={player} />
      <Trophies detail={detail} reactions={reactions} />
      {mine && <MyWords detail={detail} standing={mine} />}
      <MoreStats detail={detail} reactions={reactions} />
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

  return (
    <ChallengeView
      detail={detail}
      onPlay={onPlay}
      onRematch={onRematch}
      onReact={(target, emoji) => reactInChallenge(id, target, emoji)}
      onBack={onBack}
      onChanged={load}
    />
  )
}

interface ChallengeViewProps extends Omit<ChallengeScreenProps, 'id'> {
  detail: ChallengeDetail | null | 'loading'
  onChanged(): void
  onReact(target: string, emoji: ReactionEmoji | null): Promise<boolean>
}

/** The challenge screen once read: the debug board shows it without a server. */
export function ChallengeView({ detail, onPlay, onRematch, onReact, onBack, onChanged }: ChallengeViewProps) {
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
            <ChallengeRecap detail={detail} onRematch={onRematch} onReact={onReact} />
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
