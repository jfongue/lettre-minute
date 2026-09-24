import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { POWER_CHARGES } from '../domain/powers'
import { chargesLeft, hasPower, RUN_SECONDS, skipPenalty, type MissedWord, type Prompt, type Run, type Verdict } from '../domain/run'
import { capitalized, normalizeWord } from '../domain/text'
import { categoryText, formatNumber, useT } from '../i18n'
import { sound } from '../lib/sound'
import type { Cheer } from '../state/session'
import { Burst, LetterMark, TierTag } from './bauhaus'
import { motifAt } from './motifs'
import { PowerBadge } from './PowerIcon'

const URGENT_FROM = 10
/** Célérité waits this long after the last key, so « Chat » does not cut « Chatte » short. */
const CELERITY_SETTLE_MS = 280

// Tapping a button would blur the field and fold the phone keyboard away, only
// for the next prompt to open it again: the page would jump on every tap.
const keepFocus = (event: PointerEvent) => event.preventDefault()

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
  onType(draft: string): void
  /** `auto`: Célérité validated it, not the player. */
  onSubmit(auto?: boolean): void
  onSkip(): void
  onReroll(): void
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
  onType,
  onSubmit,
  onSkip,
  onReroll,
  onPropose,
}: RunScreenProps) {
  const field = useRef<HTMLInputElement>(null)
  const [shaking, setShaking] = useState(false)
  const t = useT()
  const category = categoryText(t, run.prompt.categoryId)
  const seconds = Math.ceil(remaining)
  const urgent = remaining <= URGENT_FROM
  const accepted = live?.kind === 'accepted'
  const spell = live?.kind === 'spell' ? live.spell : undefined
  // A corrected answer is accepted, but the field must not light up and give
  // away that the player is one letter off a word it will not name.
  const exact = accepted && !live?.found?.approximate
  const magic = chargesLeft(run, 'magic')
  const dodge = hasPower(run, 'dodge')

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

  // Célérité: an exact word validates itself once the fingers pause.
  const submitNow = useRef(onSubmit)
  useEffect(() => {
    submitNow.current = onSubmit
  })
  const celerity = hasPower(run, 'celerity')
  useEffect(() => {
    if (!celerity || !exact) return
    const timer = setTimeout(() => submitNow.current(true), CELERITY_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [celerity, exact, draft])

  useEffect(() => {
    if (run.joker) sound.power('joker')
  }, [run.joker])

  useEffect(() => {
    if (hushed) sound.power('hush')
  }, [hushed])

  // Professeur whispers the answer a skip left behind, until the player types again.
  const [heardMissed, setHeardMissed] = useState(run.missed.length)
  const whispered = run.missed.length > heardMissed ? (run.missed[run.missed.length - 1] ?? null) : null
  const missedCount = run.missed.length
  useEffect(() => {
    if (missedCount > 0) sound.power('professor', 0.8)
  }, [missedCount])

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
    }
    onSubmit()
  }

  const skip = () => {
    if (dodge) sound.power('dodge')
    else sound.skipped()
    onSkip()
  }

  const reroll = () => {
    if (magic <= 0) return
    sound.power('magic')
    setHeardMissed(run.missed.length)
    onReroll()
  }

  const powers = run.powers.map((id) => ` run--${id}`).join('')
  return (
    <div className={`sheet run${urgent && !hushed ? ' run--urgent' : ''}${hushed ? ' run--hushed' : ''}${powers}`}>
      <div className="run-head">
        <div className="timer">
          <span
            className="timer-disc"
            style={{ '--ratio': Math.min(1, remaining / RUN_SECONDS) } as CSSProperties}
            aria-hidden="true"
          />
          {/* Re-keyed every second once urgent, so each second ticks visibly. */}
          <p className="clock" key={hushed ? 'hushed' : urgent ? seconds : 'calm'}>
            {seconds}
          </p>
          {hushed && <span className="timer-hold" aria-hidden="true"><span /><span /></span>}
        </div>
        <div className="score">
          {run.score > 0 && <Burst key={`burst-${run.score}`} />}
          <span className="score-value" key={run.score}>
            {formatNumber(t, run.score)}
          </span>
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
      {hushed && <HushVoice lines={t.powers.hushLines} label={t.powers.hushed} />}

      <section className="prompt" key={`${run.drawn}`}>
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
      {next && (
        <p className="prompt-next" key={`next-${run.drawn}`}>
          <span className="prompt-next-eye" aria-hidden="true" />
          <span className="note">{t.powers.next}</span>
          <LetterMark letter={next.letter} motif={motifAt(run.drawn + 1 + run.rerolls)} size="sm" />
          <span>{categoryText(t, next.categoryId).label}</span>
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
            value={draft}
            onChange={(event) => {
              setHeardMissed(run.missed.length)
              sound.key(event.target.value.length < draft.length)
              onType(capitalized(event.target.value))
            }}
            placeholder={t.run.placeholder(run.prompt.letter)}
            aria-label={t.run.fieldLabel(run.prompt.letter, category.label)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck={false}
            enterKeyHint="done"
            onKeyDown={(event) => {
              // Implicit form submission is not guaranteed on mobile keyboards,
              // and Entrée is how the whole game is played.
              // On a keyboard, Échap skips: the hands never leave the keys.
              if (event.key === 'Escape' && !event.repeat) {
                event.preventDefault()
                skip()
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
        <Feedback
          live={live}
          cheer={cheer}
          letter={run.prompt.letter}
          draft={draft}
          proposed={proposed.includes(normalizeWord(draft))}
          onPropose={onPropose}
          whispered={whispered}
        />

        <div className="answer-actions">
          <button
            type="button"
            className={`btn btn--ghost${dodge ? ' btn--dodge' : ''}`}
            onPointerDown={keepFocus}
            onClick={skip}
          >
            {t.run.skip(skipPenalty(run))}
          </button>
          <button type="submit" className="btn btn--blue" onPointerDown={keepFocus} disabled={!accepted && !spell}>
            {t.run.submit}
          </button>
        </div>
      </form>
    </div>
  )
}

function Feedback({
  live,
  cheer,
  letter,
  draft,
  proposed,
  onPropose,
  whispered,
}: {
  live: Verdict | null
  cheer: Cheer | null
  letter: string
  draft: string
  proposed: boolean
  onPropose(word: string): void
  /** Professeur's answer to the prompt just skipped. */
  whispered: MissedWord | null
}) {
  const t = useT()
  // The last find takes the verdict's line until the player types again: lower
  // down, the phone keyboard would hide it.
  // Points and rarity are only revealed here, once the word is validated.
  if (!live && cheer)
    return (
      <p className={`cheer verdict${cheer.auto ? ' cheer--auto' : ''}${cheer.boost > 1 ? ' cheer--boost' : ''}`} key={cheer.display}>
        {cheer.auto && <PowerBadge id="celerity" className="cheer-power" />}
        {cheer.joker && <PowerBadge id="joker" className="cheer-power" />}
        {cheer.approximate && <span aria-hidden="true">≈ </span>}
        <span className="cheer-word">{capitalized(cheer.display)}</span>
        <span className="cheer-points">+{cheer.points}</span>
        {cheer.joker ? (
          <span className="note">{t.powers.joker}</span>
        ) : cheer.approximate ? (
          <span className="note">{t.run.approximate}</span>
        ) : (
          <TierTag tier={cheer.tier} />
        )}
        {cheer.boost > 1 && <span className="cheer-boost">{t.powers.boost(cheer.boost)}</span>}
      </p>
    )
  if (!live && whispered)
    return (
      <p className="verdict verdict--whisper" key={`${whispered.prompt.categoryId}:${whispered.prompt.letter}:${whispered.display}`}>
        <PowerBadge id="professor" className="cheer-power" />
        <span className="note">{t.powers.whisper}</span>
        <span className="whisper-word">{capitalized(whispered.display)}</span>
      </p>
    )
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
      if (live.found?.approximate && live.found.edits > 1)
        return <p className="verdict verdict--approx verdict--dyslexia">{t.powers.twoLettersOff}</p>
      if (live.found?.approximate) return <p className="verdict verdict--approx">{t.run.oneLetterOff}</p>
      if (live.found?.joker)
        return (
          <p className="verdict verdict--valid verdict--joker">
            <PowerBadge id="joker" /> {capitalized(live.found.display)}
          </p>
        )
      return <p className="verdict verdict--valid">✓ {capitalized(live.found?.display ?? '')}</p>
    case 'wrong-letter':
      return <p className="verdict">{t.run.startsWith(letter)}</p>
    case 'already':
      return <p className="verdict">{t.run.already}</p>
    case 'unknown':
      return (
        <p className="verdict">
          {t.run.unknown}
          {proposed ? (
            <span className="verdict--sent">{t.run.proposed}</span>
          ) : (
            <button type="button" className="btn btn--quiet" onPointerDown={keepFocus} onClick={() => onPropose(draft)}>
              {t.run.propose}
            </button>
          )}
        </p>
      )
  }
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
