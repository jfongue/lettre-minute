import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  answersTo,
  awardTrophies,
  CHALLENGE_MAX_PLAYERS,
  UNIQUE_WORD_BONUS,
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
import { sound } from '../lib/sound'
import {
  challengeTitle,
  hideChallengeDetail,
  hoursLeft,
  markRecapRevealed,
  recapRevealed,
  rememberWinner,
  winnerOf,
} from '../state/challenges'
import { Avatar } from './Avatar'
import { Burst, LetterMark, Shape, TierTag } from './bauhaus'
import { ChallengeNotice } from './ChallengeHome'
import { FriendPicker } from './FriendPicker'
import { categoryMotif, onTint } from './motifs'
import { PlayerName } from './PlayerSheet'
import { Reactable, useRecapReactions, type RecapReactions } from './Reactions'
import { ScoreRace } from './ScoreRace'
import { ShareSoon } from './ShareSoon'
import { TROPHY_TINTS, TrophyIcon } from './TrophyIcon'
import { reducedMotion } from './useCountUp'

const playerOf = (detail: ChallengeDetail) => {
  const byId = new Map(detail.players.map((player) => [player.playerId, player]))
  return (id: string) => byId.get(id)
}

const MY_WORDS_ID = 'challenge-my-words'

const REVEAL_STEP_MS = 900
const REVEAL_DRUMROLL_MS = 1900

/**
 * How many standings show, counted from the last: one more at each step, and
 * a longer pause before the winner. Whole at once when there is no suspense.
 */
function useReveal(count: number, suspense: boolean, onDone?: () => void): number {
  const [shown, setShown] = useState(() => (suspense && !reducedMotion() ? 0 : count))
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (shown >= count) {
      done.current?.()
      return
    }
    const timer = setTimeout(() => setShown((current) => current + 1), shown === count - 1 ? REVEAL_DRUMROLL_MS : REVEAL_STEP_MS)
    return () => clearTimeout(timer)
  }, [shown, count])
  return Math.min(shown, count)
}

interface StandingsProps {
  detail: ChallengeDetail
  standings: readonly Standing[]
  /** Standings revealed so far, from the last; all of them when absent. */
  revealed?: number
  /** Confetti on the winner once the last veil lifts. */
  crown?: boolean
  /** Each standing rises into place as its veil lifts. */
  lift?: boolean
}

function Standings({ detail, standings, revealed = standings.length, crown = false, lift = false }: StandingsProps) {
  const t = useT()
  const player = playerOf(detail)
  const veiled = standings.length - revealed
  const toMyWords = () => document.getElementById(MY_WORDS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <div className="standings">
      {veiled === 1 && standings.length > 1 && <p className="standings-drumroll">{t.challenge.drumroll}</p>}
      {standings.map((standing, index) => {
        const who = player(standing.playerId)
        const hidden = index < veiled
        return (
          <div
            key={standing.playerId}
            className={`standing${index === 0 ? ' standing--leader' : ''}${who?.me ? ' standing--me' : ''}${hidden ? ' standing--veiled' : lift ? ' standing--lifted' : ''}`}
            aria-hidden={hidden || undefined}
          >
            {index === 0 && crown && veiled === 0 && <Burst />}
            <span className="rank">{index + 1}</span>
            {who && <Avatar choice={who.avatar} size="sm" />}
            <span className="name challenge-standing-name">
              {who && !who.me ? (
                <PlayerName name={who.name} avatar={who.avatar}>
                  {who.name}
                </PlayerName>
              ) : standing.words.length > 0 ? (
                <button type="button" className="standing-me-link" onClick={toMyWords}>
                  {t.challenge.you}
                </button>
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
    <section className="stack" id={MY_WORDS_ID}>
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
                      +{word.settled}
                      {word.settled > word.points && (
                        <small className="challenge-bonus">{t.challenge.bonus(Math.round((UNIQUE_WORD_BONUS - 1) * 100))}</small>
                      )}
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
              sound.sent()
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
  /** The challenge closed while the board was open: the way to its recap. */
  onOpenFinal?(): void
}

/** The standings as they stand: settled again each time a player joins. */
export function ChallengeBoard({ detail, onChanged, onOpenFinal }: ChallengeBoardProps) {
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
      {onOpenFinal && (
        <button type="button" className="btn btn--blue btn--block" onClick={onOpenFinal}>
          {t.challenge.overPop.open}
        </button>
      )}
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
  if (words.length === 0) return null
  const names = (ids: readonly string[]) =>
    ids.map((id) => (player(id)?.me ? t.challenge.you : (player(id)?.name ?? ''))).join(', ')
  return (
    <section className="stack">
      <p className="section-title">{title}</p>
      <ol className="reveal-words">
        {words.map((word) => {
          const target = wordTarget(word)
          return (
            <li key={target} className="challenge-word-item">
              <Reactable target={target} reactions={reactions}>
                <span className="reveal-word challenge-word">
                  <LetterMark letter={word.letter} motif={categoryMotif(word.categoryId)} size="sm" />
                  <span className="reveal-word-text">
                    {capitalized(word.display)}
                    <span className="reveal-word-category">
                      {categoryText(t, word.categoryId).label} · {names(word.players)}
                    </span>
                  </span>
                  {word.tier !== 'courant' ? <TierTag tier={word.tier} /> : <span />}
                  <span className="reveal-word-points">×{word.players.length}</span>
                </span>
              </Reactable>
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
  if (trophies.length === 0) return null
  return (
    <section className="stack">
      <p className="section-title">{t.challenge.trophiesTitle}</p>
      <ul className="trophies">
        {trophies.map((trophy, index) => {
          const [name, line] = t.challenge.trophies[trophy.id]
          const who = player(trophy.playerId)
          const tint = TROPHY_TINTS[trophy.id]
          return (
            <li key={trophy.id} className="trophy-item" style={{ '--i': index } as CSSProperties}>
              <Reactable target={`trophy:${trophy.id}`} reactions={reactions}>
                <span className="trophy">
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
                  </span>
                </span>
              </Reactable>
            </li>
          )
        })}
      </ul>
      {reactions.canReact && <p className="note">{t.challenge.reactHint}</p>}
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
  /** The first opening of the recap: the standings come out one by one, the winner last. */
  suspense?: boolean
  onRevealed?(): void
  /** Resolves false when neither a rematch of one's own nor the existing one could be reached. */
  onRematch(detail: ChallengeDetail): Promise<boolean>
  onReact(target: string, emoji: ReactionEmoji | null): Promise<boolean>
}

/** The closing débrief: final standings, the words everyone had and nobody had, and the trophies. */
export function ChallengeRecap({ detail, suspense = false, onRevealed, onRematch, onReact }: ChallengeRecapProps) {
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
  const revealed = useReveal(standings.length, suspense, onRevealed)
  // Each veil lifts on a note one step higher; the winner's waits under a roll.
  const heardVeil = useRef(revealed)
  useEffect(() => {
    if (!suspense || revealed === heardVeil.current) return
    heardVeil.current = revealed
    const count = standings.length
    if (revealed < count) sound.unveil(revealed - 1)
    if (revealed === count - 1 && count > 1) sound.drumroll(REVEAL_DRUMROLL_MS / 1000)
    if (revealed === count) sound.crowned(standings[0]?.playerId === me?.playerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed])
  const standingsPanel = (
    <section className="panel">
      <p className="section-title">{t.challenge.final}</p>
      <Standings detail={detail} standings={standings} revealed={revealed} crown={suspense} lift={suspense} />
      {revealed === standings.length && <p className="note">{t.challenge.rules}</p>}
    </section>
  )
  // The rest of the recap would give the winner away: it waits for the reveal.
  // A fragment either way: the panel stays the same element as the rest comes in.
  if (revealed < standings.length) return <>{standingsPanel}</>

  return (
    <>
      {standingsPanel}
      <ScoreRace standings={standings} player={player} />
      <Trophies detail={detail} reactions={reactions} />
      {mine && <MyWords detail={detail} standing={mine} />}
      <MoreStats detail={detail} reactions={reactions} />
      <ShareSoon />
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

// No push reaches an open screen: the board asks again while others play.
const WATCH_MS = 8_000

/** One challenge, opened from the home screen: to play, under way, or over. */
export function ChallengeScreen({ id, onPlay, onRematch, onBack }: ChallengeScreenProps) {
  const [detail, setDetail] = useState<ChallengeDetail | null | 'loading'>('loading')
  const [held, setHeld] = useState<Held>('no')
  const [suspense] = useState(() => !recapRevealed(id))
  const load = () =>
    fetchChallenge(id).then((next) =>
      setDetail((current) => {
        // Closed under the player's eyes: the board they were reading stays, and a pop offers the recap.
        const watched = typeof current === 'object' && current !== null && !current.finished
        if (watched && next?.finished && current.players.some((player) => player.me && player.playedAt !== null)) setHeld('pop')
        // A failed poll keeps what was shown rather than blanking the screen.
        return next ?? (typeof current === 'object' ? current : null)
      }),
    )

  useEffect(() => {
    setDetail('loading')
    load()
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const waiting =
    typeof detail === 'object' && detail !== null && !detail.finished && detail.players.some((player) => player.me && player.playedAt !== null)
  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), WATCH_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, id])

  // A recap read is set aside on its own: it waits among the statistics' old
  // challenges, and comes back home only if something new happens to it.
  const recap = typeof detail === 'object' && detail !== null && detail.finished && held === 'no' ? detail : null
  useEffect(() => {
    if (!recap) return
    markChallengeSeen(id, 'recap')
    rememberWinner(id, winnerOf(recap))
    hideChallengeDetail(recap)
  }, [recap, id])

  return (
    <ChallengeView
      detail={detail}
      held={held}
      suspense={suspense}
      onRevealed={() => markRecapRevealed(id)}
      onHold={setHeld}
      onPlay={onPlay}
      onRematch={onRematch}
      onReact={(target, emoji) => reactInChallenge(id, target, emoji)}
      onBack={onBack}
      onChanged={load}
    />
  )
}

/** A challenge that closed while its board was open: the pop, then the board kept until asked. */
type Held = 'no' | 'pop' | 'board'


interface ChallengeViewProps extends Omit<ChallengeScreenProps, 'id'> {
  detail: ChallengeDetail | null | 'loading'
  held?: Held
  onHold?(held: Held): void
  suspense?: boolean
  onRevealed?(): void
  onChanged(): void
  onReact(target: string, emoji: ReactionEmoji | null): Promise<boolean>
}

/** The challenge screen once read: the debug board shows it without a server. */
export function ChallengeView({
  detail,
  held = 'no',
  onHold,
  suspense = false,
  onRevealed,
  onPlay,
  onRematch,
  onReact,
  onBack,
  onChanged,
}: ChallengeViewProps) {
  const t = useT()
  const finished = detail !== 'loading' && detail !== null && detail.finished && held === 'no'
  const openFinal = () => {
    onHold?.('no')
    window.scrollTo(0, 0)
  }
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
            <ChallengeRecap detail={detail} suspense={suspense} onRevealed={onRevealed} onRematch={onRematch} onReact={onReact} />
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
            <ChallengeBoard detail={detail} onChanged={onChanged} onOpenFinal={detail.finished ? openFinal : undefined} />
          )}
          {held === 'pop' && (
            <ChallengeNotice
              challenge={{ ownerName: detail.ownerName, players: detail.players.length, expiresAt: detail.expiresAt }}
              kind="recap"
              onLater={() => onHold?.('board')}
              onGo={openFinal}
            />
          )}
        </>
      )}

      <button type="button" className="btn btn--ghost btn--block" onClick={onBack}>
        {t.challenge.home}
      </button>
    </div>
  )
}
