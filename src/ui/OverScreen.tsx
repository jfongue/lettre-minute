import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { newlyEarned, type AvatarChoice } from '../domain/avatar'
import type { Boards } from '../domain/boards'
import { capitalized } from '../domain/text'
import { levelFor, levelProgress, type Profile } from '../domain/progression'
import { pickShowsAd, picksOwed } from '../domain/unlocks'
import type { FoundWord, Run } from '../domain/run'
import { categoryText, formatNumber, useT } from '../i18n'
import type { Account } from '../lib/cloud'
import { adsSupported, tapFeedback } from '../lib/native'
import { sound, tierSound } from '../lib/sound'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { Avatar } from './Avatar'
import { Burst, Figure, LetterMark, Shape, TierTag } from './bauhaus'
import { categoryMotif } from './motifs'
import { RankMove } from './RankMove'
import { UnlockScreen } from './UnlockScreen'
import { PowerOfferScreen } from './PowerOfferScreen'
import { powerPicksOwed } from '../domain/powers'
import { reducedMotion, useCountUp } from './useCountUp'

interface OverScreenProps {
  run: Run
  profile: Profile
  profileBefore: Profile
  /** The reveal has played once: coming back from the avatar editor lands on the summary. */
  revealed: boolean
  onRevealed(): void
  /** The dictionary language, for the words the unlock screen types out. */
  lang: string
  avatar: AvatarChoice
  /** Null while the game runs without a server: there is no account to offer. */
  account: Account | null
  accountActions: AccountActions
  /** The boards as the run started, and as they stand once it reached the server: null until then, or without one. */
  boardsBefore?: Boards | null
  boardsAfter?: Boards | null
  /** The named account's display name; an anonymous player is not on the boards. */
  me?: string | null
  onAvatar(): void
  onChoose(categoryId: string): void
  onChoosePower(powerId: string): void
  onReplay(): void
  onHome(): void
}

export function OverScreen({ run, revealed, onRevealed, lang, ...summary }: OverScreenProps) {
  const { profile, profileBefore, onChoose, onChoosePower } = summary
  // Held from the pick to the end of its celebration: the offer is off the
  // table as soon as the pick is kept, and the screen must outlive it.
  const [celebrating, setCelebrating] = useState<'category' | 'power' | null>(null)
  // Each offer gets a fresh screen: a second pick owed deals the next one.
  const [round, setRound] = useState(0)

  if (!revealed) return <Reveal run={run} previousBest={profileBefore.runs > 0 ? profileBefore.bestScore : null} onNext={onRevealed} />
  const levelled = levelFor(profile.xp) > levelFor(profileBefore.xp)
  // Categories first, then powers: the sixth category and the first power come on the same level.
  if ((profile.offer.length > 0 && celebrating !== 'power') || celebrating === 'category') {
    return (
      <UnlockScreen
        key={round}
        offer={profile.offer}
        lang={lang}
        owed={picksOwed(profile)}
        level={levelled ? levelFor(profile.xp) : null}
        withAd={adsSupported() && pickShowsAd(profile)}
        onChoose={(id) => {
          setCelebrating('category')
          onChoose(id)
        }}
        onDone={() => {
          setCelebrating(null)
          setRound(round + 1)
        }}
      />
    )
  }
  if (profile.powerOffer.length > 0 || celebrating === 'power') {
    return (
      <PowerOfferScreen
        key={`power-${round}`}
        offer={profile.powerOffer}
        owed={powerPicksOwed(profile)}
        level={levelled ? levelFor(profile.xp) : null}
        onChoose={(id) => {
          setCelebrating('power')
          onChoosePower(id)
        }}
        onDone={() => {
          setCelebrating(null)
          setRound(round + 1)
        }}
      />
    )
  }
  return <Summary run={run} {...summary} />
}

/** The beat of silence before the score: the clock has stopped, let it register. */
const BLANK_MS = 650
const SCORE_MS = 900
/** The whole list takes about this long, whatever its length… */
const WORDS_SPAN_MS = 3600
/** …but no word flashes by faster than this, nor lingers longer than that. */
const WORD_MIN_MS = 170
const WORD_MAX_MS = 480

const TIER_WEIGHT: Record<string, number> = { 'peu commun': 1.25, rare: 1.7, 'très rare': 2.4 }
const isRare = (found: FoundWord) => !found.approximate && (found.tier === 'rare' || found.tier === 'très rare')

/**
 * First screen: nothing, then the score, then every word the run found, one at
 * a time. Fast, but each find gets its own beat — and a rare one a longer one.
 * A tap skips to the end; the next tap moves on.
 */
function Reveal({ run, previousBest, onNext }: { run: Run; previousBest: number | null; onNext(): void }) {
  const t = useT()
  const total = run.found.length
  // -2: blank, -1: the score alone, n: the score and the first n words.
  const [shown, setShown] = useState(() => (reducedMotion() ? total : -2))
  const done = shown >= total
  const step = Math.min(WORD_MAX_MS, Math.max(WORD_MIN_MS, WORDS_SPAN_MS / Math.max(1, total)))
  const bestPoints = Math.max(0, ...run.found.map((found) => found.points))
  const latest = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (done) return
    const previous = run.found[shown - 1]
    const delay =
      shown === -2 ? BLANK_MS : shown === -1 ? SCORE_MS + 250 : step * (previous ? (TIER_WEIGHT[previous.tier] ?? 1) : 1)
    const timer = setTimeout(() => setShown(shown + 1), delay)
    return () => clearTimeout(timer)
  }, [shown, done, step, run.found])

  useEffect(() => {
    const found = run.found[shown - 1]
    if (!found) return
    tapFeedback(isRare(found) ? 'medium' : 'light')
    sound.recap(tierSound(found.tier, found.approximate), shown - 1)
    latest.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [shown, run.found])

  return (
    <div
      className="sheet reveal"
      onClick={() => (done ? onNext() : setShown(total))}
      role="presentation"
    >
      {shown >= -1 && <RevealScore score={run.score} previousBest={previousBest} />}

      {shown >= 0 && (
        <ol className="reveal-words">
          {run.found.slice(0, Math.max(0, shown)).map((found, index) => {
            const best = done && found.points === bestPoints && bestPoints > 0
            return (
              <li
                key={found.word}
                ref={index === shown - 1 ? latest : undefined}
                className={`reveal-word${isRare(found) ? ' reveal-word--rare' : ''}${best ? ' reveal-word--best' : ''}`}
              >
                <LetterMark letter={found.prompt.letter} motif={categoryMotif(found.prompt.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {found.approximate && <span className="note">≈ </span>}
                  {capitalized(found.display)}
                  <span className="reveal-word-category">{categoryText(t, found.prompt.categoryId).label}</span>
                </span>
                {!found.approximate && found.tier !== 'courant' && <TierTag tier={found.tier} />}
                <span className="reveal-word-points">
                  +{found.points}
                  {isRare(found) && <Burst />}
                </span>
              </li>
            )
          })}
          {total === 0 && <li className="note reveal-empty">{t.over.empty}</li>}
        </ol>
      )}

      {done && (
        <button
          type="button"
          className="btn btn--play btn--block reveal-next"
          onClick={(event) => {
            event.stopPropagation()
            onNext()
          }}
        >
          <span>{t.over.next}</span>
          <span className="play-glyph" aria-hidden="true">
            <Shape kind="circle" tint="yellow" />
            <span className="motion play-triangle">
              <Shape kind="triangle" tint="red" />
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

/**
 * The old record waits under the counter, so the moment the count passes it
 * lands on screen — not on the summary, a tap later. A first run has no record
 * to beat (null).
 */
function RevealScore({ score, previousBest }: { score: number; previousBest: number | null }) {
  const t = useT()
  const shown = useCountUp(score, SCORE_MS)
  const beaten = previousBest !== null && shown > previousBest

  useEffect(() => {
    if (!beaten) return
    tapFeedback('heavy')
    sound.record()
  }, [beaten])

  return (
    <header className={`reveal-score${beaten ? ' reveal-score--record' : ''}`}>
      <p className="eyebrow">{t.over.timeUp}</p>
      <h1 className="score-final">
        {formatNumber(t, shown)}
        {beaten && <Burst />}
      </h1>
      <p className="score-poster-unit">{t.over.points}</p>
      {previousBest !== null && score > previousBest && (
        <p className="reveal-record" key={beaten ? 'new' : 'old'}>
          {beaten ? t.over.newRecord : `${t.over.record} ${formatNumber(t, previousBest)}`}
        </p>
      )}
    </header>
  )
}

type SummaryProps = Omit<OverScreenProps, 'revealed' | 'onRevealed' | 'lang'>

/** Second screen: what the run was worth beyond its score. */
function Summary({
  run,
  profile,
  profileBefore,
  avatar,
  account,
  accountActions,
  boardsBefore,
  boardsAfter,
  me,
  onAvatar,
  onReplay,
  onHome,
}: SummaryProps) {
  const t = useT()
  const earned = newlyEarned(profileBefore, profile)
  // The reveal may have scrolled down its list: the summary reads from the top.
  // Braced: recent Chrome returns a promise from scrollTo, which React would
  // take for a clean-up function and crash on.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const record = run.score > profileBefore.bestScore && run.score > 0

  return (
    <div className="sheet cascade">
      <XpGain from={profileBefore.xp} to={profile.xp} />

      {(earned.designs.length > 0 || earned.colours.length > 0) && (
        <section className="panel earned">
          <p className="section-title">
            {t.over.earned(earned.designs.length + earned.colours.length)}
          </p>
          <div className="earned-row">
            {earned.designs.map((design, index) => (
              <span key={design.id} className="earned-item" style={{ '--i': index } as CSSProperties}>
                <Avatar choice={{ ...avatar, design: design.id }} size="md" />
              </span>
            ))}
            {earned.colours.map((colour, index) => (
              <span
                key={colour.id}
                className="earned-item earned-colour"
                style={{ '--i': earned.designs.length + index } as CSSProperties}
              >
                <span className="swatch-dot" style={{ background: colour.hex }} />
                {t.colours[colour.id] ?? colour.label}
              </span>
            ))}
          </div>
          <button type="button" className="btn btn--ghost" onClick={onAvatar}>
            {t.over.customize}
          </button>
        </section>
      )}

      <div className="figures figures--three">
        <Figure tint="yellow" value={run.found.length} label={t.over.words(run.found.length)} />
        <Figure tint="red" value={run.bestCombo} label={t.over.bestCombo} />
        <Figure
          tint="blue"
          value={formatNumber(t, profile.bestScore)}
          label={record ? t.over.newRecord : t.over.record}
        />
      </div>

      {me && boardsBefore && boardsAfter && (
        <RankMove title={t.over.dayBoard} before={boardsBefore.day} after={boardsAfter.day} me={me} />
      )}

      {account?.anonymous && (
        <AccountPanel
          title={t.over.keepTitle}
          lead={t.over.keepLead}
          {...accountActions}
        />
      )}
      {account && !account.anonymous && (
        <p className="account-saved">
          <Avatar choice={avatar} size="sm" />
          <span>
            {t.over.savedTo[0]}
            <strong>{account.name}</strong>
            {t.over.savedTo[1]}
          </span>
        </p>
      )}

      <div className="stack">
        <button type="button" className="btn btn--play btn--block" onClick={onReplay}>
          <span>{t.over.replay}</span>
          <span className="play-glyph" aria-hidden="true">
            <Shape kind="circle" tint="yellow" />
            <span className="motion play-triangle">
              <Shape kind="triangle" tint="red" />
            </span>
          </span>
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onHome}>
          {t.over.home}
        </button>
      </div>
    </div>
  )
}

/** The bar fills from where the run started, rolling over each level it crosses. */
const XP_MS = 1600
const XP_DELAY_MS = 450

function XpGain({ from, to }: { from: number; to: number }) {
  const t = useT()
  const xp = useCountUp(to, XP_MS, from, XP_DELAY_MS)
  const progress = levelProgress(xp)
  const levelledUp = progress.level > levelFor(from)

  useEffect(() => {
    if (to > from && !reducedMotion()) sound.xp(XP_MS / 1000, XP_DELAY_MS / 1000)
  }, [from, to])
  useEffect(() => {
    if (levelledUp) sound.levelUp()
  }, [levelledUp, progress.level])

  return (
    <section className="stack xp-gain">
      <div className="spread">
        <p className="section-title">{t.over.level(progress.level)}</p>
        <p className="xp-gain-amount">+{formatNumber(t, to - from)} XP</p>
      </div>
      <div className="progress">
        <span style={{ '--ratio': progress.ratio } as CSSProperties} />
      </div>
      <p className="note">
        {t.over.towards(progress.into, progress.span, progress.level + 1)}
      </p>
      {levelledUp && (
        <div className="unlock" key={progress.level}>
          <Shape kind="sun" tint="yellow" className="unlock-sun" />
          <p className="eyebrow">{t.over.levelUp}</p>
          <p className="unlock-text">{t.over.levelReached(progress.level)}</p>
        </div>
      )}
    </section>
  )
}
