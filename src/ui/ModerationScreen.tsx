import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { SWIPE_THRESHOLD, swipeVerdict, type Verdict } from '../domain/moderation'
import { castVote, fetchModerationQueue, type ReviewCard, type VoteOutcome } from '../lib/cloud'
import { sound } from '../lib/sound'
import { categoryText, useT } from '../i18n'
import { Burst, Figure } from './bauhaus'
import { CategoryIcon } from './CategoryIcon'
import { Pencil, VerdictMark } from './VerdictMark'
import { categoryMotif, onTint } from './motifs'
import { RespellField, respellValid } from './RespellField'

type Judged = Exclude<Verdict, 'special'>
type Mode = 'judge' | 'respell' | 'special'

/** What a gesture means to a review that proposes the opposite: the green thumb keeps. */
const OPPOSITE: Record<Verdict, Verdict> = {
  correct: 'incorrect',
  incorrect: 'correct',
  unsure: 'unsure',
  special: 'special',
}

interface Leaving {
  verdict: Verdict
  /** Where the card was let go, so it flies on from there rather than from the centre. */
  dx: number
  dy: number
}

interface Drag {
  dx: number
  dy: number
  /** The card's width, against which the swipe's reach is measured. */
  width: number
}

interface Tally {
  correct: number
  unsure: number
  incorrect: number
  special: number
  entered: number
}

const NO_TALLY: Tally = { correct: 0, unsure: 0, incorrect: 0, special: 0, entered: 0 }

/** Long enough for the card to leave the screen before the next one takes its place. */
const FLY_MS = 340

interface ModerationScreenProps {
  lang: string
  /** Back to « Mes demandes », where the next session is started. */
  onDone(): void
  /** The words to judge, from the debug board: no call, no server. */
  queue?: readonly ReviewCard[]
}

export function ModerationScreen({ lang, onDone, queue }: ModerationScreenProps) {
  const t = useT()
  const [cards, setCards] = useState<ReviewCard[] | null | 'loading'>(() => (queue ? [...queue] : 'loading'))
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<Mode>('judge')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const [toast, setToast] = useState<{ key: number; outcome: VoteOutcome; ban: boolean } | null>(null)
  const [tally, setTally] = useState<Tally>(NO_TALLY)
  const [draft, setDraft] = useState('')
  const busy = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (queue) return
    fetchModerationQueue(lang).then(setCards)
  }, [lang, queue])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 1600)
    return () => clearTimeout(timer)
  }, [toast])

  const deck = cards === 'loading' || cards === null ? [] : cards
  const card = deck[index] ?? null
  // A flagged word asks the opposite question — keep it? — so the green gesture
  // is « keep », and the word only goes once enough moderators say it should.
  const labels = card?.kind === 'ban' ? t.moderation.screen.banVerdicts : t.moderation.screen.verdicts
  const finished = cards !== 'loading' && cards !== null && deck.length > 0 && index >= deck.length
  // The last card's verdict sounds first; the confetti of a queue cleared come just after.
  useEffect(() => {
    if (!finished) return
    const timer = setTimeout(sound.news, 450)
    return () => clearTimeout(timer)
  }, [finished])

  const vote = useCallback(
    async (verdict: Verdict, extra: { note?: string; respell?: string } = {}, from = { dx: 0, dy: 0 }) => {
      if (!card || busy.current) return
      busy.current = true
      setDrag(null)
      setLeaving({ verdict, ...from })
      sound.recognized()
      // The card leaves at once: waiting on the server before moving would
      // make every gesture feel like it had missed.
      const [outcome] = await Promise.all([
        // What a flagged word's review proposes is to take the word out: keeping
        // it is a « no », and the green gesture is the one that says so.
        castVote(card, lang, card.kind === 'ban' ? OPPOSITE[verdict] : verdict, extra),
        new Promise((resolve) => setTimeout(resolve, FLY_MS)),
      ])
      busy.current = false
      if (outcome === 'unreachable') {
        setLeaving(null)
        setToast({ key: Date.now(), outcome, ban: card.kind === 'ban' })
        sound.refused()
        return
      }
      if (outcome === 'accepted') sound.found(3, 4)
      if (outcome === 'rejected') sound.skipped()
      // A review settled between the card being dealt and the vote — already
      // voted, or decided without him — took no verdict: counting it would tell
      // the moderator he judged a word the server never recorded.
      if (outcome !== 'gone') {
        setTally((before) => ({
          ...before,
          [verdict]: before[verdict] + 1,
          // Only an addition enters the dictionary: a flagged word that settles
          // leaves it, which the judgement card's own words say.
          entered: before.entered + (outcome === 'accepted' && card.kind === 'add' ? 1 : 0),
        }))
      }
      setToast({ key: Date.now(), outcome, ban: card.kind === 'ban' })
      setLeaving(null)
      setMode('judge')
      setIndex((at) => at + 1)
    },
    [card, lang],
  )

  // Arrows for a keyboard: the same three verdicts as the thumb.
  useEffect(() => {
    if (mode !== 'judge' || !card) return
    const onKey = (event: KeyboardEvent) => {
      const verdict: Judged | null =
        event.key === 'ArrowRight' ? 'correct' : event.key === 'ArrowLeft' ? 'incorrect' : event.key === 'ArrowUp' ? 'unsure' : null
      if (!verdict) return
      event.preventDefault()
      void vote(verdict)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, card, vote])

  const grab = (event: PointerEvent<HTMLElement>) => {
    if (mode !== 'judge' || busy.current || (event.target as Element).closest('button')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: event.clientX, y: event.clientY }
    setDrag({ dx: 0, dy: 0, width: event.currentTarget.offsetWidth })
  }

  const move = (event: PointerEvent<HTMLElement>) => {
    const from = start.current
    if (!from) return
    setDrag((before) => before && { ...before, dx: event.clientX - from.x, dy: event.clientY - from.y })
  }

  const release = () => {
    const from = start.current
    start.current = null
    if (!from || !drag) return setDrag(null)
    const verdict = swipeVerdict(drag.dx, drag.dy, drag.width)
    if (verdict) void vote(verdict, {}, { dx: drag.dx, dy: drag.dy })
    else setDrag(null)
  }

  const openRespell = () => {
    if (!card) return
    setDraft(card.display)
    setMode('respell')
  }

  const openSpecial = () => {
    setDraft('')
    setMode('special')
  }

  const confirmRespell = (event: FormEvent) => {
    event.preventDefault()
    const next = draft.trim()
    if (!card || !respellValid(next, card.display)) return
    void vote('correct', next === card.display ? {} : { respell: next })
  }

  const confirmSpecial = (event: FormEvent) => {
    event.preventDefault()
    void vote('special', { note: draft })
  }

  if (cards === 'loading') {
    return (
      <div className="sheet moderation">
        <p className="note">{t.loading}</p>
      </div>
    )
  }

  if (cards === null || deck.length === 0) {
    return (
      <div className="sheet moderation cascade">
        <ModerationHead t={t} onQuit={onDone} />
        <div className="moderation-empty">
          <span className="moderation-empty-art" aria-hidden="true">
            <VerdictMark verdict="unsure" />
          </span>
          <p>{cards === null ? t.moderation.screen.offline : t.moderation.screen.empty}</p>
        </div>
        <button type="button" className="btn btn--block" onClick={onDone}>
          {t.moderation.screen.finish}
        </button>
      </div>
    )
  }

  if (finished) {
    const judged = tally.correct + tally.unsure + tally.incorrect + tally.special
    return (
      <div className="sheet moderation cascade">
        <div className="moderation-done">
          <span className="moderation-done-art" aria-hidden="true">
            <VerdictMark verdict="correct" />
            <Burst />
          </span>
          <h1 className="section-title">{t.moderation.screen.done}</h1>
          <p>{t.moderation.screen.judged(judged)}</p>
          {tally.entered > 0 && <p className="moderation-entered">{t.moderation.screen.entered(tally.entered)}</p>}
        </div>
        <div className="figures">
          <Figure tint="green" value={tally.correct} label={t.moderation.screen.gestures.correct} />
          <Figure tint="yellow" value={tally.unsure} label={t.moderation.screen.gestures.unsure} />
          <Figure tint="red" value={tally.incorrect} label={t.moderation.screen.gestures.incorrect} />
          <Figure tint="blue" value={tally.special} label={t.moderation.screen.gestures.special} />
        </div>
        <button type="button" className="btn btn--block" onClick={onDone}>
          {t.moderation.screen.finish}
        </button>
      </div>
    )
  }

  const next = deck[index + 1] ?? null
  const lean = drag ? swipeLean(drag.dx, drag.dy, drag.width) : { correct: 0, unsure: 0, incorrect: 0 }

  return (
    <div className="sheet moderation">
      <ModerationHead t={t} onQuit={onDone} />

      <div className="moderation-progress" aria-label={t.moderation.screen.counter(index + 1, deck.length)}>
        {deck.map((entry, at) => (
          <span key={entry.id} className={at < index ? 'is-done' : at === index ? 'is-current' : ''} />
        ))}
      </div>
      <p className="note moderation-counter">{t.moderation.screen.counter(index + 1, deck.length)}</p>

      <div className="moderation-deck">
        {next && <WordCard key={next.id} card={next} behind />}
        {card && (
          <WordCard
            key={card.id}
            card={card}
            drag={drag}
            leaving={leaving}
            lean={lean}
            onPointerDown={grab}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
          >
            {mode === 'respell' && (
              <form className="moderation-form" onSubmit={confirmRespell}>
                <label className="note" htmlFor="respell">
                  {t.moderation.screen.respellLabel}
                </label>
                <RespellField
                  id="respell"
                  value={draft}
                  onChange={setDraft}
                  original={card.display}
                  autoComplete="off"
                  autoFocus
                  maxLength={60}
                />
                <p className="note">{t.moderation.screen.respellLead}</p>
                <div className="moderation-form-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => setMode('judge')}>
                    {t.moderation.screen.back}
                  </button>
                  <button type="submit" className="btn btn--green" disabled={!respellValid(draft, card.display)}>
                    <VerdictMark verdict="correct" />
                    {t.moderation.screen.respellConfirm}
                  </button>
                </div>
              </form>
            )}
            {mode === 'special' && (
              <form className="moderation-form" onSubmit={confirmSpecial}>
                <p className="note">{t.moderation.screen.specialLead}</p>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={t.moderation.screen.specialPlaceholder}
                  aria-label={t.moderation.screen.specialPlaceholder}
                  autoFocus
                  maxLength={140}
                  rows={2}
                />
                <div className="moderation-form-actions">
                  <button type="button" className="btn btn--quiet btn--muted" onClick={() => setMode('judge')}>
                    {t.moderation.screen.back}
                  </button>
                  <button type="submit" className="btn btn--blue">
                    <VerdictMark verdict="special" />
                    {t.moderation.screen.specialConfirm}
                  </button>
                </div>
              </form>
            )}
          </WordCard>
        )}
      </div>

      <div className="moderation-toast-slot" aria-live="polite">
        {toast && (
          <p key={toast.key} className={`moderation-toast moderation-toast--${toast.outcome}`}>
            {toast.outcome === 'accepted' && <Burst />}
            {(toast.ban ? t.moderation.screen.banOutcomes : t.moderation.screen.outcomes)[toast.outcome]}
          </p>
        )}
      </div>

      {mode === 'judge' && card && (
        <>
          <div className="votes">
            {(['incorrect', 'unsure', 'correct'] as const).map((verdict) => (
              <button
                key={verdict}
                type="button"
                className={`vote vote--${verdict}`}
                style={{ '--lean': lean[verdict] } as CSSProperties}
                onClick={() => vote(verdict)}
                aria-label={labels[verdict]}
                title={labels[verdict]}
              >
                <VerdictMark verdict={verdict} />
              </button>
            ))}
          </div>
          <p className="note moderation-hint">{card.kind === 'ban' ? t.moderation.screen.banHint : t.moderation.screen.hint}</p>
          <div className="moderation-extras">
            {card.canRespell && !card.special && (
              <button type="button" className="btn btn--quiet" onClick={openRespell}>
                <Pencil />
                {t.moderation.screen.respell}
              </button>
            )}
            {!card.special && card.kind === 'add' && (
              <button type="button" className="btn btn--quiet" onClick={openSpecial}>
                <VerdictMark verdict="special" />
                {t.moderation.screen.verdicts.special}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** How far the drag leans towards each verdict, from 0 to 1: the stamp and its button light up with it. */
function swipeLean(dx: number, dy: number, width: number): Record<Judged, number> {
  const reach = width * SWIPE_THRESHOLD
  const clamp = (value: number) => Math.max(0, Math.min(1, value / reach))
  const up = -dy > Math.abs(dx) ? clamp(-dy) : 0
  return { correct: up ? 0 : clamp(dx), incorrect: up ? 0 : clamp(-dx), unsure: up }
}

function ModerationHead({ t, onQuit }: { t: ReturnType<typeof useT>; onQuit(): void }) {
  return (
    <header className="moderation-head">
      <h1 className="section-title">{t.moderation.title}</h1>
      <button type="button" className="moderation-quit" onClick={onQuit} aria-label={t.moderation.screen.quit} title={t.moderation.screen.quit}>
        <VerdictMark verdict="incorrect" />
      </button>
    </header>
  )
}

interface WordCardProps {
  card: ReviewCard
  behind?: boolean
  drag?: Drag | null
  leaving?: Leaving | null
  lean?: Record<Judged, number>
  children?: ReactNode
  onPointerDown?(event: PointerEvent<HTMLElement>): void
  onPointerMove?(event: PointerEvent<HTMLElement>): void
  onPointerUp?(event: PointerEvent<HTMLElement>): void
  onPointerCancel?(event: PointerEvent<HTMLElement>): void
}

function WordCard({ card, behind, drag, leaving, lean, children, ...pointer }: WordCardProps) {
  const t = useT()
  const text = categoryText(t, card.categoryId)
  const motif = categoryMotif(card.categoryId)
  // What each gesture does to this card, said on the stamp that follows the thumb.
  const labels = card.kind === 'ban' ? t.moderation.screen.banVerdicts : t.moderation.screen.verdicts
  const style: CSSProperties = {}
  if (drag) {
    style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx * 0.05}deg)`
    style.transition = 'none'
  }
  if (leaving) {
    Object.assign(style, {
      '--from-x': `${leaving.dx}px`,
      '--from-y': `${leaving.dy}px`,
      '--from-r': `${leaving.dx * 0.05}deg`,
    })
  }
  const state = behind ? ' word-card--behind' : leaving ? ` word-card--leave-${leaving.verdict}` : ''

  return (
    <article className={`word-card${state}`} style={style} aria-hidden={behind} {...(behind ? {} : pointer)}>
      <div className="word-card-stamps" aria-hidden="true">
        {(['correct', 'unsure', 'incorrect'] as const).map((verdict) => (
          <span
            key={verdict}
            className={`word-card-stamp word-card-stamp--${verdict}`}
            style={{ opacity: lean?.[verdict] ?? 0 } as CSSProperties}
          >
            <VerdictMark verdict={verdict} />
            <span className="word-card-stamp-word">{labels[verdict]}</span>
          </span>
        ))}
      </div>

      {card.special && (
        <p className="word-card-special">
          <VerdictMark verdict="special" />
          <span>
            {t.moderation.screen.verdicts.special}
            {card.note && ` · ${card.note}`}
          </span>
        </p>
      )}

      <p className={`tag word-card-kind word-card-kind--${card.kind}`}>{t.moderation.screen.kinds[card.kind]}</p>
      <p className="word-card-question note">
        {card.kind === 'ban' ? t.moderation.screen.banQuestion : t.moderation.screen.question}
      </p>
      <p className="word-card-word">{card.display}</p>
      {card.kind === 'ban' && card.note && (
        <p className="note word-card-reason">{t.moderation.screen.banReason(card.note)}</p>
      )}
      <p className="note">
        {card.kind === 'ban'
          ? t.moderation.screen.banProposedBy(card.proposals)
          : card.friends.length > 0
            ? t.moderation.screen.proposedByFriends(card.friends, card.proposals - card.friends.length)
            : t.moderation.screen.proposedBy(card.proposals)}
      </p>

      {children}

      <p className="word-card-category" style={{ background: `var(--${motif.tint})`, color: `var(--${onTint(motif.tint)})` }}>
        <CategoryIcon categoryId={card.categoryId} tint={onTint(motif.tint)} className="word-card-icon" />
        <span>
          <strong>{text.label}</strong>
          <span>{text.hint}</span>
        </span>
      </p>
    </article>
  )
}
