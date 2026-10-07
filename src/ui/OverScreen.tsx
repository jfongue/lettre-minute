import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { newlyEarned, type AvatarChoice } from '../domain/avatar'
import type { Boards } from '../domain/boards'
import { capitalized, compactWord } from '../domain/text'
import { levelFor, levelProgress, recordBonus, type Profile } from '../domain/progression'
import { pickShowsAd, picksOwed } from '../domain/unlocks'
import type { FoundWord, Run } from '../domain/run'
import { runScore } from '../domain/run'
import { ENDURANCE_TIME_BONUS } from '../domain/modes'
import { categoryText, formatNumber, useT } from '../i18n'
import type { Account, BanOutcome, ChallengeDetail, Submission } from '../lib/cloud'
import type { Proposal } from '../state/session'
import { adsSupported, storeUrl, tapFeedback } from '../lib/native'
import { supportDue } from '../domain/support'
import { sound, tierSound } from '../lib/sound'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { CHALLENGE_XP_BONUS } from '../domain/challenge'
import { ChallengeBoard } from './ChallengeScreen'
import { Avatar } from './Avatar'
import { Burst, Figure, LetterMark, MineMark, Shape, TierTag } from './bauhaus'
import { categoryMotif } from './motifs'
import { RankMove } from './RankMove'
import { UnlockScreen } from './UnlockScreen'
import { PowerOfferScreen } from './PowerOfferScreen'
import { powerPicksOwed } from '../domain/powers'
import { reducedMotion, useCountUp, useTween } from './useCountUp'
import { ShareSoon } from './ShareSoon'
import { RequestRow, type RequestEntry } from './RequestsPage'
import { peeksLeft, type HiddenAnswer } from '../domain/perks'
import { HiddenAnswers } from './HiddenAnswers'
import { FlagWordCard, type FlagWord } from './StatsPage'
import { useLongPress } from './useLongPress'
import { useFeature } from './features'

/** A word proposed during the run, and what the server holds of it — nothing while it still waits on the device. */
export interface RunProposal {
  proposal: Proposal
  submission: Submission | null
}

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
  /**
   * The words the player himself got into the dictionary (`compactWord`), in
   * the run's language: the game says so, quietly, wherever they come back.
   */
  mine?: ReadonlySet<string>
  /** What this run proposed: the last screen hands each request back. */
  proposals?: readonly RunProposal[]
  onCorrectProposal?(proposal: Proposal, display: string): Promise<boolean>
  onWithdrawProposal?(proposal: Proposal): Promise<boolean>
  onAvatar(): void
  onChoose(categoryId: string): void
  onChoosePower(powerId: string): void
  /** The summary asked for support: the next ask waits ten runs from here. */
  onSupportAsked(): void
  onReplay(): void
  onHome(): void
  /**
   * Set for a challenge run: its board takes the summary's place. `sending`
   * until the run has reached the challenge, `failed` if it never did.
   */
  challenge?: ChallengeDetail | 'sending' | 'failed'
  onChallengeChanged?(): void
  /** The prompts the run skipped, each hiding a word it could have taken. */
  hidden?: readonly HiddenAnswer[]
  /** One hidden word uncovered: spends one of the free ones. */
  onPeek?(): void
  onJoinPlus?(): void
  /**
  * Signals a word of the run — said, or still hidden — to the other
  * moderators, as the history's recap does; absent for a player who is not
  * one, which is what keeps the summary from offering the gesture.
  */
  onFlag?(word: FlagWord, reason: string): Promise<BanOutcome>
  /**
   * Faux pour un mode de la réserve : son score ne bat aucun record et ne
   * rapporte rien — le bilan le montre sans le comparer à rien.
   */
  ranked?: boolean
}

export function OverScreen({ run, revealed, onRevealed, lang, ...summary }: OverScreenProps) {
  const { profile, profileBefore, onChoose, onChoosePower, ranked = true } = summary
  // Held from the pick to the end of its celebration: the offer is off the
  // table as soon as the pick is kept, and the screen must outlive it.
  const [celebrating, setCelebrating] = useState<'category' | 'power' | null>(null)
  // Each offer gets a fresh screen: a second pick owed deals the next one.
  const [round, setRound] = useState(0)
  const powers = useFeature('powers')

  // A challenge run beats no record: it does not count for one.
  const previousBest = ranked && profileBefore.runs > 0 && !summary.challenge ? profileBefore.bestScore : null
  if (!revealed) {
    return (
      <Reveal
        run={run}
        previousBest={previousBest}
        mine={summary.mine}
        hidden={summary.hidden ?? []}
        peeks={peeksLeft(profile)}
        onPeek={summary.onPeek}
        onJoinPlus={summary.onJoinPlus}
        onFlag={summary.onFlag}
        onNext={onRevealed}
      />
    )
  }
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
  if ((powers && profile.powerOffer.length > 0) || celebrating === 'power') {
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
  return summary.challenge ? <ChallengeSummary {...summary} challenge={summary.challenge} /> : <Summary run={run} {...summary} />
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
function Reveal({
  run,
  previousBest,
  mine,
  hidden,
  peeks,
  onPeek,
  onJoinPlus,
  onFlag,
  onNext,
}: {
  run: Run
  previousBest: number | null
  mine?: ReadonlySet<string>
  hidden: readonly HiddenAnswer[]
  peeks: number
  onPeek?(): void
  onJoinPlus?(): void
  onFlag?(word: FlagWord, reason: string): Promise<BanOutcome>
  onNext(): void
}) {
  const t = useT()
  const total = run.found.length
  // -2: blank, -1: the score alone, n: the score and the first n words.
  const [shown, setShown] = useState(() => (reducedMotion() ? total : -2))
  const done = shown >= total
  const step = Math.min(WORD_MAX_MS, Math.max(WORD_MIN_MS, WORDS_SPAN_MS / Math.max(1, total)))
  const bestPoints = Math.max(0, ...run.found.map((found) => found.points))
  const latest = useRef<HTMLLIElement>(null)
  const [flagged, setFlagged] = useState<FlagWord | null>(null)
  const press = useLongPress<FlagWord>((word) => setFlagged(word))

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
      // Un appui long ouvre la carte du mot : le tape qui suit ne doit pas
      // passer au bilan dans son dos, ni la refermer.
      onClick={() => {
        if (flagged) return
        if (done) onNext()
        else setShown(total)
      }}
      role="presentation"
    >
      {shown >= -1 && <RevealScore score={runScore(run)} previousBest={previousBest} mode={run.mode} />}

      {shown >= 0 && (
        <ol className="reveal-words">
          {run.found.slice(0, Math.max(0, shown)).map((found, index) => {
            const best = done && found.points === bestPoints && bestPoints > 0
            const ours = mine?.has(compactWord(found.display)) === true
            return (
              <li
                key={found.word}
                ref={index === shown - 1 ? latest : undefined}
                className={`reveal-word${isRare(found) ? ' reveal-word--rare' : ''}${best ? ' reveal-word--best' : ''}`}
                {...(onFlag
                  ? press({ categoryId: found.prompt.categoryId, word: found.word, display: found.display })
                  : {})}
              >
                <LetterMark letter={found.prompt.letter} motif={categoryMotif(found.prompt.categoryId)} size="sm" />
                <span className="reveal-word-text">
                  {found.approximate && <span className="note">≈ </span>}
                  {capitalized(found.display)}
                  <span className="reveal-word-category">
                    {categoryText(t, found.prompt.categoryId).label}
                    {ours && (
                      <>
                        {' · '}
                        <MineMark label={t.requests.mine} />
                      </>
                    )}
                  </span>
                </span>
                {!found.approximate && found.tier !== 'courant' && <TierTag tier={found.tier} />}
                <span className="reveal-word-points">
                  {/* En endurance le mot rend des secondes : c'est la seule monnaie du mode. */}
                  {run.mode === 'endurance' ? t.over.seconds(ENDURANCE_TIME_BONUS[found.tier] ?? 0) : `+${found.points}`}
                  {isRare(found) && <Burst />}
                </span>
              </li>
            )
          })}
          {total === 0 && <li className="note reveal-empty">{t.over.empty}</li>}
        </ol>
      )}

      {onFlag && shown >= 0 && <p className="note">{t.moderation.flag.hint}</p>}

      {done && hidden.length > 0 && (
        <HiddenAnswers
          hidden={hidden}
          peeks={peeks}
          onPeek={onPeek}
          onJoinPlus={onJoinPlus}
          onFlag={onFlag && ((word) => setFlagged(word))}
        />
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

      {flagged && onFlag && (
        <FlagWordCard
          word={flagged}
          category={categoryText(t, flagged.categoryId).label}
          onFlag={(reason) => onFlag(flagged, reason)}
          onClose={() => setFlagged(null)}
        />
      )}
    </div>
  )
}

/**
 * The old record waits under the counter, so the moment the count passes it
 * lands on screen — not on the summary, a tap later. A first run has no record
 * to beat (null).
 */
function RevealScore({ score, previousBest, mode }: { score: number; previousBest: number | null; mode: Run['mode'] }) {
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
      <p className="score-poster-unit">{mode === 'endurance' ? t.over.survived : t.over.points}</p>
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
  ranked = true,
  avatar,
  account,
  accountActions,
  boardsBefore,
  boardsAfter,
  me,
  mine,
  proposals,
  onCorrectProposal,
  onWithdrawProposal,
  onAvatar,
  onSupportAsked,
  onReplay,
  onHome,
}: SummaryProps) {
  const t = useT()
  const support = useFeature('support')
  const leaderboards = useFeature('leaderboards')
  // The reveal may have scrolled down its list: the summary reads from the top.
  // Braced: recent Chrome returns a promise from scrollTo, which React would
  // take for a clean-up function and crash on.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const record = ranked && run.score > profileBefore.bestScore && run.score > 0
  const bonus = ranked ? recordBonus(profileBefore, run.score) : 0
  const ours = mine ? run.found.filter((found) => mine.has(compactWord(found.display))).length : 0
  // Decided once: marking the ask makes `supportDue` false, and the panel must stay.
  const [asking] = useState(() => support && supportDue(profileBefore, profile, run.score, false))
  useEffect(() => {
    if (asking) onSupportAsked()
  }, [asking, onSupportAsked])

  return (
    <div className="sheet cascade">
      <XpGain from={profileBefore.xp} to={profile.xp} />
      {bonus > 0 && <p className="note challenge-xp-note">{t.over.recordBonus(bonus)}</p>}

      <Earned profileBefore={profileBefore} profile={profile} avatar={avatar} onAvatar={onAvatar} />

      <div className="figures figures--three">
        <Figure tint="yellow" value={run.found.length} label={t.over.words(run.found.length)} />
        <Figure tint="red" value={run.bestCombo} label={t.over.bestCombo} />
        <Figure
          tint="blue"
          value={formatNumber(t, profile.bestScore)}
          label={record ? t.over.newRecord : t.over.record}
        />
      </div>

      {ours > 0 && <p className="note mine-note">{t.over.mineNote(ours)}</p>}

      {asking && <SupportPanel />}


      <RunRequests
        proposals={proposals ?? []}
        onCorrect={onCorrectProposal}
        onWithdraw={onWithdrawProposal}
      />

      {me && leaderboards && boardsBefore && boardsAfter && (
        <RankMove title={t.over.dayBoard} before={boardsBefore.day} after={boardsAfter.day} me={me} />
      )}

      {(account?.anonymous || account?.needsName) && (
        <AccountPanel
          title={t.over.keepTitle}
          lead={t.over.keepLead}
          needsName={account.needsName}
          {...accountActions}
        />
      )}
      {account && !account.anonymous && !account.needsName && (
        <p className="account-saved">
          <Avatar choice={avatar} size="sm" />
          <span>
            {t.over.savedTo[0]}
            <strong>{account.name}</strong>
            {t.over.savedTo[1]}
          </span>
        </p>
      )}

      <ShareSoon />

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

/** A rating, asked at a happy moment: with no store page there is nothing to open. */
function SupportPanel() {
  const t = useT()
  const store = storeUrl()
  if (!store) return null
  return (
    <section className="panel support">
      <p className="section-title">{t.support.title}</p>
      <p>{t.support.lead}</p>
      <div className="support-actions">
        <a className="btn btn--ghost" href={store} target="_blank" rel="noopener noreferrer">
          {t.support.rate}
        </a>
      </div>
    </section>
  )
}

/**
 * Les mots proposés pendant la partie, sur le dernier écran : tant qu'ils
 * attendent, l'orthographe se corrige et la demande se retire, comme dans
 * « Mes demandes ». Le serveur a le dernier mot sur l'orthographe — un
 * modérateur a pu la corriger avant de valider.
 */
function RunRequests({
  proposals,
  onCorrect,
  onWithdraw,
}: {
  proposals: readonly RunProposal[]
  onCorrect?(proposal: Proposal, display: string): Promise<boolean>
  onWithdraw?(proposal: Proposal): Promise<boolean>
}) {
  const t = useT()
  // Un geste perdu — serveur muet, ou modérateur qui a voté entre-temps — se
  // dit ici, comme dans « Mes demandes » : sans quoi « Retirer » ne ferait
  // rien, sans rien dire.
  const [failed, setFailed] = useState(false)
  if (proposals.length === 0) return null

  const act = async (work: Promise<boolean>): Promise<boolean> => {
    const ok = await work
    setFailed(!ok)
    return ok
  }

  return (
    <section className="panel">
      <p className="section-title">{t.over.proposals}</p>
      <p className="note">{t.over.proposalsLead}</p>
      <ul className="requests">
        {proposals.map(({ proposal, submission }) => {
          const entry: RequestEntry = submission
            ? {
                source: 'server',
                key: submission.id,
                categoryId: submission.categoryId,
                display: submission.display,
                submission,
              }
            : {
                source: 'queued',
                key: `queued-${proposal.at}`,
                categoryId: proposal.categoryId,
                display: proposal.word,
                queued: proposal,
              }
          // Un mot refusé n'est plus une demande : il reste au bilan, sans geste.
          const waiting = submission === null || submission.status === 'pending'
          return (
            <RequestRow
              key={entry.key}
              entry={entry}
              note={submission?.status === 'accepted' ? t.requests.entered : undefined}
              onWithdraw={waiting && onWithdraw ? () => void act(onWithdraw(proposal)) : undefined}
              onCorrect={waiting && onCorrect ? (display) => act(onCorrect(proposal, display)) : undefined}
            />
          )
        })}
      </ul>
      {failed && <p className="note note--warn">{t.requests.failed}</p>}
    </section>
  )
}

/** The avatar tiles and colours the run just earned, if any. */
function Earned({
  profileBefore,
  profile,
  avatar,
  onAvatar,
}: Pick<OverScreenProps, 'profileBefore' | 'profile' | 'avatar' | 'onAvatar'>) {
  const t = useT()
  const avatars = useFeature('avatar')
  const earned = newlyEarned(profileBefore, profile)
  if (earned.designs.length === 0 && earned.colours.length === 0) return null
  return (
    <section className="panel earned">
      <p className="section-title">{t.over.earned(earned.designs.length + earned.colours.length)}</p>
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
      {avatars ? (
        <button type="button" className="btn btn--ghost" onClick={onAvatar}>
          {t.over.customize}
        </button>
      ) : null}
    </section>
  )
}

/**
 * After a challenge run: the XP, then the standings as they stand — settled
 * like a Petit Bac, and settled again as the others play.
 */
function ChallengeSummary({
  profile,
  profileBefore,
  avatar,
  onAvatar,
  onHome,
  proposals,
  onCorrectProposal,
  onWithdrawProposal,
  challenge,
  onChallengeChanged,
}: Omit<SummaryProps, 'run' | 'challenge'> & { challenge: ChallengeDetail | 'sending' | 'failed' }) {
  const t = useT()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="sheet cascade">
      <XpGain from={profileBefore.xp} to={profile.xp} />
      <p className="note challenge-xp-note">{t.challenge.xpBonus(Math.round(CHALLENGE_XP_BONUS * 100))}</p>
      <Earned profileBefore={profileBefore} profile={profile} avatar={avatar} onAvatar={onAvatar} />

      {challenge === 'sending' && <p className="note">{t.challenge.sending}</p>}
      {challenge === 'failed' && <p className="note note--warn">{t.challenge.pushFailed}</p>}
      {typeof challenge === 'object' && <ChallengeBoard detail={challenge} onChanged={() => onChallengeChanged?.()} />}

      <RunRequests proposals={proposals ?? []} onCorrect={onCorrectProposal} onWithdraw={onWithdrawProposal} />

      <button type="button" className="btn btn--play btn--block" onClick={onHome}>
        <span>{t.challenge.home}</span>
        <span className="play-glyph" aria-hidden="true">
          <Shape kind="circle" tint="yellow" />
          <span className="motion play-triangle">
            <Shape kind="triangle" tint="red" />
          </span>
        </span>
      </button>
    </div>
  )
}

/** The bar fills from where the run started, rolling over each level it crosses. */
const XP_MS = 1600
const XP_DELAY_MS = 450

function XpGain({ from, to }: { from: number; to: number }) {
  const t = useT()
  const xp = useTween(to, XP_MS, from, XP_DELAY_MS)
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
        {t.over.towards(Math.floor(progress.into), progress.span, progress.level + 1)}
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
