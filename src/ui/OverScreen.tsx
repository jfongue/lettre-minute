import { useEffect, useState, type CSSProperties } from 'react'
import { newlyEarned, type AvatarChoice } from '../domain/avatar'
import { achievementIcon, newlyEarnedAchievements } from '../domain/achievements'
import type { Boards } from '../domain/boards'
import { compactWord } from '../domain/text'
import { levelFor, levelProgress, recordBonus, type Profile } from '../domain/progression'
import { pickShowsAd, picksOwed } from '../domain/unlocks'
import type { Run } from '../domain/run'
import { categoryText, formatNumber, useT } from '../i18n'
import type { Account, BanOutcome, ChallengeDetail, Submission } from '../lib/cloud'
import type { Proposal } from '../state/session'
import { adsSupported, storeUrl } from '../lib/native'
import { supportDue } from '../domain/support'
import { sound } from '../lib/sound'
import { AccountPanel, type AccountActions } from './AccountPanel'
import { CHALLENGE_XP_BONUS } from '../domain/challenge'
import { ChallengeBoard } from './ChallengeScreen'
import { Avatar } from './Avatar'
import { Figure, Shape } from './bauhaus'
import { RankMove } from './RankMove'
import { UnlockScreen } from './UnlockScreen'
import { PowerOfferScreen } from './PowerOfferScreen'
import { BonusOfferScreen } from './BonusOfferScreen'
import { CurrencyRow } from './CurrencyRow'
import { powerPicksOwed } from '../domain/powers'
import { bonusesOwed } from '../domain/bonus'
import { reducedMotion, useTween } from './useCountUp'
import { ShareSoon } from './ShareSoon'
import { RequestRow, type RequestEntry } from './RequestsPage'
import { todayKey } from '../lib/today'
import { revealBudget, type HiddenAnswer } from '../domain/perks'
import { FlagWordCard, type FlagWord } from './StatsPage'
import { Reveal } from './Reveal'
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
  onChooseBonus(bonusId: string): void
  /** A moderator is not offered the moderator card: it would give nothing. */
  isModerator?: boolean
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
  /** One hidden word uncovered: spends one of the day's reveals. */
  onPeek?(): void
  /** A rewarded ad watched through: one more reveal today. */
  onAd?(): void
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
  const { profile, profileBefore, onChoose, onChoosePower, onChooseBonus, ranked = true } = summary
  // Held from the pick to the end of its celebration: the offer is off the
  // table as soon as the pick is kept, and the screen must outlive it.
  const [celebrating, setCelebrating] = useState<'category' | 'power' | 'bonus' | null>(null)
  // Each offer gets a fresh screen: a second pick owed deals the next one.
  const [round, setRound] = useState(0)
  const powers = useFeature('powers')
  const t = useT()

  // A challenge run beats no record: it does not count for one.
  const previousBest = ranked && profileBefore.runs > 0 && !summary.challenge ? profileBefore.bestScore : null
  if (!revealed) {
    return (
      <Reveal
        run={run}
        previousBest={previousBest}
        mine={summary.mine}
        hidden={summary.hidden ?? []}
        budget={revealBudget(profile, todayKey())}
        onPeek={summary.onPeek}
        onAd={summary.onAd}
        onFlag={summary.onFlag}
        flagCard={(word, close) =>
          summary.onFlag && (
            <FlagWordCard
              word={word}
              category={categoryText(t, word.categoryId).label}
              onFlag={(reason) => summary.onFlag!(word, reason)}
              onClose={close}
            />
          )
        }
        onNext={onRevealed}
      />
    )
  }
  const levelled = levelFor(profile.xp) > levelFor(profileBefore.xp)
  // Categories first, then powers: the sixth category and the first power come on the same level.
  if ((profile.offer.length > 0 && celebrating !== 'power' && celebrating !== 'bonus') || celebrating === 'category') {
    return (
      <UnlockScreen
        key={round}
        offer={profile.offer}
        lang={lang}
        owed={picksOwed(profile, summary.isModerator)}
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
  if ((powers && profile.powerOffer.length > 0 && celebrating !== 'bonus') || celebrating === 'power') {
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
  if (profile.bonusOffer.length > 0 || celebrating === 'bonus') {
    return (
      <BonusOfferScreen
        key={`bonus-${round}`}
        offer={profile.bonusOffer}
        owed={bonusesOwed(profile, summary.isModerator)}
        level={levelled ? levelFor(profile.xp) : null}
        profile={profile}
        onChoose={(id) => {
          setCelebrating('bonus')
          onChooseBonus(id)
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

      <CurrencyRow profile={profile} />

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
  const achievements = newlyEarnedAchievements(profileBefore, profile)
  // Le succès touché : il déplie ce qu'il fallait faire pour l'obtenir.
  const [open, setOpen] = useState<string | null>(null)
  if (earned.designs.length === 0 && earned.colours.length === 0 && achievements.length === 0) return null
  return (
    <section className="panel earned">
      {earned.designs.length + earned.colours.length > 0 ? (
        <p className="section-title">{t.over.earned(earned.designs.length + earned.colours.length)}</p>
      ) : null}
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
        {achievements.length > 0 ? (
          <>
            <p className="section-title">{t.over.newAchievement}</p>
            <div className="earned-row">
              {achievements.map((achievement, index) => (
                <button
                  key={achievement.id}
                  type="button"
                  className={`earned-item earned-ach${open === achievement.id ? ' earned-ach--open' : ''}`}
                  style={{ '--i': earned.designs.length + earned.colours.length + index } as CSSProperties}
                  title={`${t.ach.howTitle} · ${t.ach.how(achievement.goal)}`}
                  onClick={() => setOpen(open === achievement.id ? null : achievement.id)}
                >
                  <Avatar choice={achievementIcon(achievement.id)} size="sm" />
                  <span className="earned-ach-name">{t.ach[achievement.id].name}</span>
                  <span className="earned-how">
                    <span className="ach-how-title">{t.ach.howTitle}</span>
                    {t.ach.how(achievement.goal)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
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
