import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { CHATTER_WORDS, POWER_CHARGES } from '../domain/powers'
import { answerPrompt, celerityDue, chargesLeft, hasPower, runScore, skipPenalty, type Prompt, type Run, type Verdict } from '../domain/run'
import { MODE_SECONDS, RECALL_SECONDS, modeEdge } from '../domain/modes'
import { capitalized, compactWord, normalizeWord } from '../domain/text'
import { categoryText, formatNumber, useT } from '../i18n'
import { sound } from '../lib/sound'
import { tapFeedback } from '../lib/native'
import type { Cheer } from '../state/session'
import type { AvatarChoice } from '../domain/avatar'
import { Avatar } from './Avatar'
import { Burst, LetterMark, MineMark, TierTag } from './bauhaus'
import { motifAt } from './motifs'
import { PowerBadge } from './PowerIcon'
import { useFlip } from './useFlip'
import { useFeature } from './features'

const URGENT_FROM = 10
/** Célérité waits this long after the last key, so « Chat » does not cut « Chatte » short. */
const CELERITY_SETTLE_MS = 140
/** Un refus ne se prononce qu'une fois les doigts arrêtés : juger un mot en cours était faux. */
const REFUSED_SETTLE_MS = 350
/** Le gain d'un mot reste lisible ce temps, même si la frappe du suivant a repris. */
const CHEER_HOLD_MS = 1200

// Tapping a button would blur the field and fold the phone keyboard away, only
// for the next prompt to open it again: the page would jump on every tap.
const keepFocus = (event: PointerEvent) => event.preventDefault()

/** A challenge rival, replayed at this second of their own run. */
export interface Racer {
  id: string
  name: string
  avatar: AvatarChoice
  score: number
}

interface RunScreenProps {
  run: Run
  draft: string
  live: Verdict | null
  cheer: Cheer | null
  remaining: number
  /** Silence holds the clock right now. */
  hushed: boolean
  /** The prompt coming next, shown under Divination; null without it. */
  next: Prompt | null
  /** Normalized words already proposed in this run. */
  proposed: readonly string[]
  /** The words the player himself got into the dictionary (`compactWord`): the field says so quietly. */
  mine?: ReadonlySet<string>
  /** In a challenge, those who played before, as if they were playing now; absent in a solo run. */
  rivals?: readonly Racer[]
  /** The player's own avatar, set among the rivals. */
  avatar?: AvatarChoice
  onType(draft: string): void
  /** `auto`: Célérité validated it, not the player. */
  onSubmit(auto?: boolean): void
  onSkip(): void
  onReroll(): void
  /** Le retard : revoir la question à remplir, contre `RECALL_SECONDS` secondes. */
  onRecall(): void
  onPropose(word: string): void
}

export function RunScreen({
  run,
  draft,
  live,
  cheer,
  remaining,
  hushed,
  next,
  proposed,
  mine,
  rivals,
  avatar,
  onType,
  onSubmit,
  onSkip,
  onReroll,
  onRecall,
  onPropose,
}: RunScreenProps) {
  const field = useRef<HTMLInputElement>(null)
  const [shaking, setShaking] = useState(false)
  const t = useT()
  const category = categoryText(t, run.prompt.categoryId)
  // Le retard remplit la question d'avant, le renversé juge la fin du mot.
  const answer = answerPrompt(run)
  const edge = modeEdge(run.mode)
  // En endurance, le score est le temps tenu, pas les points.
  const score = runScore(run)
  const seconds = Math.ceil(remaining)
  // Le rappel du retard s'affiche une seule fois, à sa première question : il
  // se rachète ensuite question par question, contre `RECALL_SECONDS` secondes.
  const firstAnswer = useRef<number | null>(null)
  if (run.mode === 'delayed' && run.armed && firstAnswer.current === null) firstAnswer.current = run.drawn
  const [recalled, setRecalled] = useState<number | null>(null)
  const showsAnswer = run.armed && (firstAnswer.current === run.drawn || recalled === run.drawn)
const latecomerTriggered = remaining < 5 && hasPower(run, 'latecomer') && chargesLeft(run, 'latecomer') > 0
const latecomerAnnounced = useRef(false)
useEffect(() => {
if (!latecomerTriggered) {
latecomerAnnounced.current = false
return
}
if (latecomerAnnounced.current) return
latecomerAnnounced.current = true
sound.power('latecomer')
}, [latecomerTriggered])
  const urgent = remaining <= URGENT_FROM
  const accepted = live?.kind === 'accepted'
  const spell = live?.kind === 'spell' ? live.spell : undefined
  // A corrected answer is accepted, but the field must not light up and give
  // away that the player is one letter off a word it will not name.
  const exact = accepted && !live?.found?.approximate
  const magic = chargesLeft(run, 'magic')
  const dodge = hasPower(run, 'dodge')
const doubleSkip = hasPower(run, 'double-skip')
const flawless = hasPower(run, 'flawless')

  // The field must never lose focus mid-run: a tap on "Passer" would otherwise
  // close the keyboard on a phone and cost the player the next prompt.
  useEffect(() => {
    field.current?.focus()
  }, [run.prompt])

  // What the field says, heard: named, or some letters off — never how rare.
  const heard = !accepted ? null : exact ? 'named' : (live?.found?.edits ?? 1) > 1 ? 'far' : 'close'
  useEffect(() => {
    if (heard === 'named') sound.recognized()
    else if (heard === 'close') sound.oneLetterOff()
    else if (heard === 'far') sound.power('dyslexia')
  }, [heard])

  // Célérité: an accepted word validates itself once the fingers pause.
  const submitNow = useRef(onSubmit)
  useEffect(() => {
    submitNow.current = onSubmit
  })
  const celerity = hasPower(run, 'celerity')
  // With Bavardage in hand, the fingers get time to add its three dots.
  const settle = chargesLeft(run, 'chatter') > 0 ? CELERITY_SETTLE_MS * 3 : CELERITY_SETTLE_MS
  // « Chut » casts itself the same way, Célérité or not: a player in need of a pause has no time for Enter.
  const hushing = spell === 'hush'
  const due = celerity && celerityDue(live, draft)
  useEffect(() => {
    if (!due && !hushing) return
    const timer = setTimeout(() => submitNow.current(!hushing), settle)
    return () => clearTimeout(timer)
  }, [due, hushing, draft, settle])

  const chattering = run.chatter === CHATTER_WORDS
  useEffect(() => {
    if (chattering) sound.power('chatter')
  }, [chattering])

  useEffect(() => {
    if (run.joker) sound.power('joker')
  }, [run.joker])

  useEffect(() => {
    if (hushed) sound.power('hush')
  }, [hushed])

  // Divination rings softly each time the future moves on.
  const seen = useRef(run.drawn)
  useEffect(() => {
    if (!next || seen.current === run.drawn) return
    seen.current = run.drawn
    sound.power('divination', 0.35)
  }, [next, run.drawn])

  useEffect(() => {
    if (urgent && seconds > 0) sound.tick(seconds)
  }, [urgent, seconds])

  const submit = () => {
    if (!accepted && !spell && draft.trim() !== '') {
      setShaking(true)
      sound.refused()
      tapFeedback('medium')
    }
    onSubmit()
  }

  const skip = () => {
    if (dodge) sound.power('dodge')
else if (doubleSkip) sound.power('double-skip')
    else sound.skipped()
    onSkip()
  }

  const reroll = () => {
    if (magic <= 0) return
    sound.power('magic')
    onReroll()
  }

  // La question à remplir se rachète pour la question en cours seulement.
  const recallAnswer = () => {
    setRecalled(run.drawn)
    sound.click()
    onRecall()
  }

  const powers = run.powers.map((id) => ` run--${id}`).join('')
  return (
    <div className={`sheet run${urgent && !hushed ? ' run--urgent' : ''}${hushed ? ' run--hushed' : ''}${powers}`}>
      <div className="run-head">
        <div className="timer">
          <span
            className="timer-disc"
            style={{ '--ratio': Math.min(1, remaining / MODE_SECONDS[run.mode]) } as CSSProperties}
            aria-hidden="true"
          />
          {/* Re-keyed every second once urgent, so each second ticks visibly. */}
          <p className={`clock${latecomerTriggered ? ' clock--latecomer' : ''}`} key={hushed ? 'hushed' : urgent ? seconds : 'calm'}>
            {seconds}
          </p>
          {hushed && <span className="timer-hold" aria-hidden="true"><span /><span /></span>}
        </div>
        <div className="score">
          {score > 0 && <Burst key={`burst-${score}`} />}
          <span className="score-value" key={score}>
            {formatNumber(t, score)}
          </span>
          {/* En endurance le score est un temps : « 47 s », pas « 47 points ». */}
          {run.mode === 'endurance' && <span className="score-unit">{t.run.secondsUnit}</span>}
          {run.combo > 1 && (
            <span className="combo" key={run.combo}>
              ×{(1 + Math.min(run.combo, 9) * 0.1).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <div className="run-meta">
        <p className="note">{t.run.meta(run.found.length, run.skips)}</p>
        {run.powers.length > 0 && (
          <span className="run-powers">
            {run.powers.map((id) => (
              <PowerBadge
                key={id}
                id={id}
                left={POWER_CHARGES[id] && id !== 'permutation' ? chargesLeft(run, id) : undefined}
              />
            ))}
          </span>
        )}
      </div>
      {rivals && rivals.length > 0 && avatar && <Race rivals={rivals} avatar={avatar} score={run.score} />}
      {hushed && <HushVoice lines={t.powers.hushLines} label={t.powers.hushed} />}

      <section className={`prompt${edge === 'last' ? ' prompt--last' : ''}`} key={`${run.drawn}`}>
        {magic > 0 ? (
          <button
            type="button"
            className="prompt-magic"
            key={run.rerolls}
            onPointerDown={keepFocus}
            onClick={reroll}
            aria-label={t.powers.reroll(run.prompt.letter, magic)}
          >
            <LetterMark letter={run.prompt.letter} motif={motifAt(run.drawn + run.rerolls)} size="lg" />
            <span className="prompt-magic-spark" aria-hidden="true" />
          </button>
        ) : (
          <span className={run.rerolls > 0 ? 'prompt-magic prompt-magic--spent' : undefined} key={run.rerolls}>
            <LetterMark letter={run.prompt.letter} motif={motifAt(run.drawn + run.rerolls)} size="lg" />
          </span>
        )}
        <div className="prompt-text">
          <h2 className="prompt-label">{category.label}</h2>
          <p className="note">{category.hint}</p>
        </div>
      </section>
      {run.chatter > 0 && (
        <p className="prompt-chatter" key={`chatter-${run.chatter}`}>
          <PowerBadge id="chatter" />
          {t.powers.chatterLeft(run.chatter)}
        </p>
      )}
      {next && (
        <p className="prompt-next" key={`next-${run.drawn}`}>
          <span className="prompt-next-eye" aria-hidden="true" />
          <span className="note">{t.powers.next}</span>
          <LetterMark letter={next.letter} motif={motifAt(run.drawn + 1 + run.rerolls)} size="sm" />
          <span>{categoryText(t, next.categoryId).label}</span>
        </p>
      )}
      {run.mode === 'delayed' && (
        <p className="prompt-next" key={`answer-${run.drawn}`}>
          {!run.armed ? (
            <span className="note">{t.modes.armNote}</span>
          ) : showsAnswer ? (
            <>
              <span className="note">{t.modes.answerTo}</span>
              <LetterMark letter={answer.letter} motif={motifAt(run.drawn + run.rerolls)} size="sm" />
              <span>{categoryText(t, answer.categoryId).label}</span>
            </>
          ) : (
            <button type="button" className="btn btn--quiet" onPointerDown={keepFocus} onClick={recallAnswer}>
              {t.modes.recall(RECALL_SECONDS)}
            </button>
          )}
        </p>
      )}

      <form
        className={`answer${exact ? ' answer--valid' : ''}${spell ? ` answer--spell answer--${spell}` : ''}`}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <div
          className={`answer-field${shaking ? ' answer-field--shake' : ''}${run.joker ? ' answer-field--joker' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          <input
            ref={field}
            data-keys
            value={draft}
            onChange={(event) => {
              sound.key(event.target.value.length < draft.length)
              onType(capitalized(event.target.value))
            }}
            placeholder={t.run.placeholder(answer.letter)}
            aria-label={t.run.fieldLabel(answer.letter, category.label)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            enterKeyHint="done"
            onKeyDown={(event) => {
              // Implicit form submission is not guaranteed on mobile keyboards,
              // and Entrée is how the whole game is played.
              // On a keyboard, Tab skips: the hands never leave the keys, and
              // the focus stays in the field. Not Échap, which a browser keeps
              // to leave full screen.
              if (event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault()
                if (!event.repeat) skip()
                return
              }
              if (event.key !== 'Enter') return
              event.preventDefault()
              submit()
            }}
          />
          <span className="answer-line" aria-hidden="true" />
          {/* A card flipped over the line, not a remount: the field must keep the keyboard open. */}
          {run.joker && <span className="joker-card" key={run.joker.key} aria-hidden="true" />}
        </div>
        {/* The verdict is the only line that says what the run just did: it is read
        out, and its container stays put so the announcement lands. */}
        <div aria-live="polite">
          <Feedback
            flawlessTriggered={flawless && run.flawlessStreak > 0 && run.flawlessStreak % 3 === 0}
            live={live}
            cheer={cheer}
            shaking={shaking}
            letter={answer.letter}
            edge={edge}
            draft={draft}
            proposed={proposed.includes(normalizeWord(draft))}
            mine={mine}
            onPropose={onPropose}
          />
        </div>

        <div className="answer-actions">
          <button
            type="button"
            className={`btn btn--ghost${dodge ? ' btn--dodge' : ''}`}
            onPointerDown={keepFocus}
            onClick={skip}
          >
            {run.chatter > 0 ? t.powers.chatterLeave : run.freeSkipReady ? t.powers.doubleSkipFree : t.run.skip(skipPenalty(run))}
          </button>
          <button
            type="submit"
            className={`btn btn--blue${!accepted && !spell && run.armed ? ' btn--idle' : ''}`}
            onPointerDown={keepFocus}
            aria-disabled={!accepted && !spell && run.armed}
          >
            {t.run.submit}
          </button>
        </div>
      </form>
    </div>
  )
}

function Feedback({
flawlessTriggered,
  live,
  cheer,
  shaking,
  letter,
  edge,
  draft,
  proposed,
  mine,
  onPropose,
}: {
flawlessTriggered: boolean
  live: Verdict | null
  cheer: Cheer | null
  shaking: boolean
  letter: string
  /** Le renversé contraint la dernière lettre : la ligne de refus doit le dire. */
  edge: 'first' | 'last'
  draft: string
  proposed: boolean
  /** The words the player himself got into the dictionary. */
  mine?: ReadonlySet<string>
  onPropose(word: string): void
}) {
  const t = useT()
  const canPropose = useFeature('proposeWord')
  const ours = (word: string | undefined) => word !== undefined && mine?.has(compactWord(word)) === true
  const proposal = !canPropose ? null : proposed ? (
    <span className="verdict--sent">{t.run.proposed}</span>
  ) : (
    <button type="button" className="btn btn--quiet" onPointerDown={keepFocus} onClick={() => onPropose(draft)}>
      {t.run.propose}
    </button>
  )
  // A refusal only judges what is written: while the fingers move it says
  // nothing — it used to call every prefix "unknown", and the player learnt to
  // ignore the only feedback line of the run.
  const [typing, setTyping] = useState(draft.trim() !== '')
  useEffect(() => {
    if (draft.trim() === '') {
      setTyping(false)
      return
    }
    setTyping(true)
    const timer = setTimeout(() => setTyping(false), REFUSED_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [draft])
  // The last find holds the line this long, the next word's typing included:
  // this is the only place the rarity is ever said.
  const [held, setHeld] = useState<Cheer | null>(cheer)
  useEffect(() => {
    if (!cheer) return
    setHeld(cheer)
    const timer = setTimeout(() => setHeld(null), CHEER_HOLD_MS)
    return () => clearTimeout(timer)
  }, [cheer])
  const refused = live !== null && (live.kind === 'wrong-letter' || live.kind === 'already' || live.kind === 'unknown')
  const refusedMark = <span aria-hidden="true">✗ </span>
  const cheerLine = (shown: Cheer) => (
    <p className={`cheer verdict${shown.auto ? ' cheer--auto' : ''}${shown.boost > 1 ? ' cheer--boost' : ''}`} key={shown.display}>
      {shown.auto && <PowerBadge id="celerity" className="cheer-power" />}
      {shown.joker && <PowerBadge id="joker" className="cheer-power" />}
      {shown.approximate && <span aria-hidden="true">≈ </span>}
      <span className="cheer-word">{capitalized(shown.display)}</span>
      {ours(shown.display) && <MineMark label={t.requests.mine} />}
      <span className="cheer-points">+{shown.points + (flawlessTriggered ? 10 : 0)}</span>
      {flawlessTriggered && <PowerBadge id="flawless" className="cheer-power" />}
      {shown.joker ? (
        <span className="note">{t.powers.joker}</span>
      ) : shown.approximate ? (
        <span className="note">{t.run.approximate}</span>
      ) : (
        <TierTag tier={shown.tier} />
      )}
      {shown.boost > 1 && <span className="cheer-boost">{t.powers.boost(shown.boost)}</span>}
    </p>
  )
  // La question du retard part vide : le texte qui y entre est refusé tout de
  // suite, sans attendre que les doigts s'arrêtent.
  if (live?.kind === 'must-empty')
    return (
      <p className="verdict verdict--refused">
        {refusedMark}
        {t.modes.armNote}
      </p>
    )
  // The line keeps the find unless a refusal has to take it: lower down, the
  // phone keyboard would hide it.
  if (refused && typing && !shaking) return held ? cheerLine(held) : <p className="verdict">&nbsp;</p>
  if (held && !refused) return cheerLine(held)
  if (!live || live.kind === 'empty') return <p className="verdict">&nbsp;</p>

  switch (live.kind) {
    case 'spell':
      return (
        <p className={`verdict verdict--spell verdict--${live.spell}`}>
          {live.spell && <PowerBadge id={live.spell} />}
          {live.spell === 'joker' ? t.powers.castJoker : t.powers.castHush}
        </p>
      )
    case 'accepted':
      // The word is named only once typed exactly: naming the correction would
      // hand the player the spelling they were missing.
      // A near miss may be another word altogether (« moule » for « poule »):
      // it can still be put forward.
      if (live.found?.approximate && live.found.edits > 1)
        return (
          <p className="verdict verdict--approx verdict--dyslexia">
            {t.powers.twoLettersOff}
            {proposal}
          </p>
        )
      if (live.found?.approximate)
        return (
          <p className="verdict verdict--approx">
            {t.run.oneLetterOff}
            {proposal}
          </p>
        )
      if (live.found?.joker)
        return (
          <p className="verdict verdict--valid verdict--joker">
            <PowerBadge id="joker" /> {capitalized(live.found.display)}
            {ours(live.found.display) && <MineMark label={t.requests.mine} />}
          </p>
        )
      if (live.chatter)
        return (
          <p className="verdict verdict--valid verdict--chatter">
            <PowerBadge id="chatter" /> {capitalized(live.found?.display ?? '')} · {t.powers.castChatter}
            {ours(live.found?.display) && <MineMark label={t.requests.mine} />}
          </p>
        )
      return (
        <p className="verdict verdict--valid">
          ✓ {capitalized(live.found?.display ?? '')}
          {ours(live.found?.display) && <MineMark label={t.requests.mine} />}
        </p>
      )
    case 'wrong-letter':
      return <p className="verdict verdict--refused">{refusedMark}{edge === 'last' ? t.run.endsWith(letter) : t.run.startsWith(letter)}</p>
    case 'already':
      return <p className="verdict verdict--refused">{refusedMark}{t.run.already}</p>
    case 'unknown':
      return (
        <p className="verdict verdict--refused">
          {refusedMark}
          {t.run.unknown}
          {proposal}
        </p>
      )
  }
}

/**
 * The rivals' scores, second by second, around the player's own: points only,
 * never a word — the Petit Bac is settled at the end.
 */
function Race({ rivals, avatar, score }: { rivals: readonly Racer[]; avatar: AvatarChoice; score: number }) {
  const t = useT()
  const racers = [...rivals, { id: '', name: t.challenge.you, avatar, score }].sort((a, b) => b.score - a.score)
  const list = useRef<HTMLOListElement>(null)
  useFlip(list, racers.map((racer) => racer.id).join(' '))
  return (
    <ol className="race" aria-label={t.challenge.race} ref={list}>
      {racers.map((racer, index) => (
        <li key={racer.id} data-flip={racer.id} className={`race-entry${racer.id === '' ? ' race-entry--me' : ''}${index === 0 ? ' race-entry--lead' : ''}`}>
          <Avatar choice={racer.avatar} size="sm" />
          <span className="race-name">{racer.name}</span>
          <span className="race-score" key={racer.score}>
            {formatNumber(t, racer.score)}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Each line stays this long, typed out then erased, before the next one. */
const HUSH_LINE_MS = 3000
const HUSH_TYPE_MS = 55
const HUSH_ERASE_MS = 22

/**
 * Silence speaks: in the band where the clock would say it is stopped, the
 * game types to the player as if it were live, a new line every few seconds.
 */
function HushVoice({ lines, label }: { lines: readonly string[]; label: string }) {
  // A random opening line, then round the list: two Silences do not read alike.
  const [start] = useState(() => Math.floor(Math.random() * lines.length))
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState('')
  const line = lines[(start + index) % lines.length] ?? ''

  useEffect(() => {
    const timer = setTimeout(() => setIndex((at) => at + 1), HUSH_LINE_MS)
    return () => clearTimeout(timer)
  }, [index])

  useEffect(() => {
    let text = ''
    let timer: ReturnType<typeof setTimeout>
    const eraseAt = Date.now() + HUSH_LINE_MS - line.length * HUSH_ERASE_MS - 150
    const tick = () => {
      if (Date.now() >= eraseAt) {
        text = text.slice(0, -1)
        setShown(text)
        if (text !== '') timer = setTimeout(tick, HUSH_ERASE_MS)
        return
      }
      if (text.length < line.length) {
        text = line.slice(0, text.length + 1)
        setShown(text)
        timer = setTimeout(tick, HUSH_TYPE_MS + Math.random() * 45)
        return
      }
      timer = setTimeout(tick, Math.max(0, eraseAt - Date.now()))
    }
    timer = setTimeout(tick, 120)
    return () => clearTimeout(timer)
  }, [line])

  return (
    <p className="hush-note" role="status" aria-label={label}>
      <span className="hush-voice" aria-live="polite">
        {shown}
        <span className="hush-caret" aria-hidden="true" />
      </span>
    </p>
  )
}
