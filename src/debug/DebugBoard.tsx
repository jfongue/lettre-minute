import { useEffect, useState, type ReactNode } from 'react'
import { DEFAULT_AVATAR, type AvatarChoice } from '../domain/avatar'
import type { ChallengeWord } from '../domain/challenge'
import { choosePower } from '../domain/powers'
import { NEW_PROFILE, xpForLevel, type Profile } from '../domain/progression'
import type { RarityTier } from '../domain/rarity'
import type { KeptWord, MissedWord, Run } from '../domain/run'
import { chooseCategory } from '../domain/unlocks'
import type { Account, ChallengeDetail, ChallengePlayer, ChallengeSummary } from '../lib/cloud'
import type { AccountActions } from '../ui/AccountPanel'
import { ChallengeNotice } from '../ui/ChallengeHome'
import { ChallengePowers } from '../ui/ChallengePowers'
import { ChallengeView } from '../ui/ChallengeScreen'
import { HomeScreen } from '../ui/HomeScreen'
import { LanguagePicker } from '../ui/LanguagePicker'
import { ModeratorOffer } from '../ui/ModeratorOffer'
import { OverScreen } from '../ui/OverScreen'
import { PlayerActionsContext, type PlayerActions } from '../ui/PlayerSheet'
import { TutorialScreen } from '../ui/TutorialScreen'
import { UpdateNotice } from '../ui/UpdateNotice'
import type { Boards } from '../domain/boards'

/*
 * The debug board: every screen a player only meets by luck or by level,
 * played with invented data. A developer tool, so its own labels are French
 * and stay out of the i18n; the screens it shows speak the interface's
 * language. Nothing here reaches the server: the calls that would write
 * (moderator answer, account) are replaced by stand-ins.
 *
 * A screen hard to reach in the game gets its scenario here as soon as it exists.
 */

const noop = () => {}
const later = <T,>(value: T, ms = 400) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms))

/** A tap on a name asks nothing of the server here. */
const PLAYER_ACTIONS: PlayerActions = { befriend: () => later('sent'), block: () => later('blocked') }


const quietAccount: AccountActions = {
  onRegister: () => later(null),
  onLogIn: () => later(null),
  onGoogle: () => later(null),
  onRequestReset: () => later(null),
  onResetPassword: () => later(null),
  onChooseName: () => later(null),
}

const NAMED: Account = {
  name: 'Testeur',
  email: 'testeur@example.com',
  anonymous: false,
  needsName: false,
  stats: { xp: 0, runs: 0, bestScore: 0, wordsFound: 0, bestCombo: 0 },
  avatar: DEFAULT_AVATAR,
}
const ANONYMOUS: Account = { ...NAMED, name: 'Anonyme', email: null, anonymous: true }

const avatarOf = (design: number, ground: string, shape: string, accent: string): AvatarChoice => ({ design, ground, shape, accent })

const LONG_BOARD = Array.from({ length: 24 }, (_, index) => ({
  name: index === 14 ? 'Testeur' : `Joueur ${index + 1}`,
  avatar: avatarOf((index * 7) % 100, 'bleu', 'jaune', 'rouge'),
  value: 400 - index * 12,
}))
const LONG_BOARDS: Boards = { day: LONG_BOARD, week: LONG_BOARD, discoveries: LONG_BOARD.slice(0, 6) }

// ------------------------------------------------------------ fixtures --

type Word = [categoryId: string, letter: string, display: string, points: number, tier: RarityTier, approximate?: boolean]

const WORDS: readonly Word[] = [
  ['pays', 'B', 'Bhoutan', 64, 'rare'],
  ['animaux', 'O', 'Ornithorynque', 92, 'très rare'],
  ['couleurs', 'V', 'Vermillon', 38, 'peu commun'],
  ['pays', 'C', 'Canada', 12, 'courant'],
  ['animaux', 'C', 'Chat', 10, 'courant'],
  ['couleurs', 'B', 'Bleu', 10, 'courant'],
  ['pays', 'T', 'Thaïlande', 12, 'rare', true],
  ['animaux', 'L', 'Lama', 14, 'courant'],
]

function makeRun(score: number, words: readonly Word[] = WORDS, missed: readonly MissedWord[] = []): Run {
  const found: KeptWord[] = words.map(([categoryId, letter, display, points, tier, approximate = false], index) => ({
    prompt: { categoryId, letter },
    word: display.toLowerCase(),
    display: display.toLowerCase(),
    points,
    rarity: 0,
    tier,
    approximate,
    edits: approximate ? 1 : 0,
    joker: false,
    boost: 1,
    seconds: 3 + (index % 4),
    at: 5 + index * 6,
  }))
  return {
    seed: 42,
    categoryIds: ['pays', 'animaux', 'couleurs'],
    prompt: { categoryId: 'pays', letter: 'A' },
    drawn: words.length + 1,
    avoid: [],
    dealt: [],
    shared: false,
    seeded: [],
    found,
    used: [],
    promptAt: 0,
    skips: 2,
    penaltySeconds: 10,
    combo: 0,
    bestCombo: 4,
    score,
    powers: [],
    charges: {},
    joker: null,
    hush: null,
    heldSeconds: 0,
    rerolls: 0,
    missed,
  }
}

const RUN = makeRun(WORDS.reduce((sum, word) => sum + word[3], 0))

const at = (level: number, extra = 0) => xpForLevel(level) + extra

const PROFILE: Profile = {
  ...NEW_PROFILE,
  xp: at(3, 150),
  runs: 14,
  bestScore: 290,
  wordsFound: 120,
  bestCombo: 5,
  unlocked: ['fruits-legumes', 'metiers'],
  supportAskedAt: 14,
}

/** The profile before and after the run: the gap is what the end screen celebrates. */
function afterRun(before: Profile, run: Run, changes: Partial<Profile> = {}): Profile {
  return {
    ...before,
    xp: before.xp + run.score,
    runs: before.runs + 1,
    bestScore: Math.max(before.bestScore, run.score),
    wordsFound: before.wordsFound + run.found.length,
    ...changes,
  }
}

const challengeWords = (words: readonly Word[], at0 = 4): ChallengeWord[] =>
  words.map(([categoryId, letter, display, points, tier, approximate = false], index) => ({
    categoryId,
    letter,
    key: display.toLowerCase(),
    display: display.toLowerCase(),
    points,
    tier,
    approximate,
    seconds: 2 + ((index * 3) % 7),
    at: at0 + index * 7,
  }))

const HOUR = 3_600_000

function player(
  playerId: string,
  name: string,
  avatar: AvatarChoice,
  words: readonly Word[] | null,
  extra: Partial<ChallengePlayer> = {},
): ChallengePlayer {
  const list = words ? challengeWords(words) : []
  return {
    playerId,
    name,
    avatar,
    me: false,
    bot: false,
    playedAt: words ? Date.now() - HOUR : null,
    score: list.reduce((sum, word) => sum + word.points, 0),
    skips: 1,
    bestCombo: 3,
    words: list,
    ...extra,
  }
}

const LEA: Word[] = [
  ['pays', 'B', 'Bhoutan', 64, 'rare'],
  ['animaux', 'C', 'Chat', 10, 'courant'],
  ['couleurs', 'B', 'Bordeaux', 22, 'peu commun'],
  ['animaux', 'L', 'Lynx', 30, 'peu commun'],
]
const TOM: Word[] = [
  ['pays', 'C', 'Canada', 12, 'courant'],
  ['animaux', 'C', 'Chat', 10, 'courant'],
  ['couleurs', 'V', 'Vert', 8, 'courant'],
]

function challenge(state: 'to-play' | 'waiting' | 'finished'): ChallengeDetail {
  const me = player('me', 'Testeur', DEFAULT_AVATAR, state === 'to-play' ? null : WORDS.slice(0, 6), { me: true, skips: 3, bestCombo: 4 })
  const players = [
    me,
    player('lea', 'Léa', avatarOf(12, 'rouge', 'jaune', 'bleu'), LEA, { skips: 0 }),
    player('tom', 'Tom', avatarOf(31, 'jaune', 'noir', 'rouge'), TOM, { skips: 5, bestCombo: 2 }),
    player('ines', 'Inès', avatarOf(47, 'vert', 'creme', 'rose'), state === 'finished' ? LEA.slice(1) : null),
  ]
  return {
    id: `debug-${state}`,
    ownerName: 'Léa',
    owned: state !== 'finished',
    lang: 'fr',
    seed: 7,
    categoryIds: ['pays', 'animaux', 'couleurs'],
    createdAt: Date.now() - 5 * HOUR,
    expiresAt: Date.now() + 19 * HOUR,
    finished: state === 'finished',
    nextId: null,
    players,
    reactions:
      state === 'finished'
        ? [
            { target: 'trophy:original', emoji: '👏', playerId: 'lea' },
            { target: 'trophy:original', emoji: '🔥', playerId: 'tom' },
            { target: 'word:animaux:chat', emoji: '😂', playerId: 'ines' },
          ]
        : [],
  }
}

function summaryOf(detail: ChallengeDetail): ChallengeSummary {
  return {
    id: detail.id,
    ownerName: detail.ownerName,
    owned: detail.owned,
    lang: detail.lang,
    categoryIds: detail.categoryIds,
    createdAt: detail.createdAt,
    players: detail.players.length,
    played: detail.players.filter((entry) => entry.playedAt !== null).length,
    mePlayed: false,
    myScore: null,
    finished: detail.finished,
    expiresAt: detail.expiresAt,
    seenInvite: false,
    seenRecap: false,
    nextId: null,
  }
}

// ------------------------------------------------------------ scenarios --

/** The real end screen, its picks applied to a copy of the profile the way the session would. */
function OverScenario({
  run = RUN,
  before = PROFILE,
  after,
  account = NAMED,
  challengeState,
  onBack,
}: {
  run?: Run
  before?: Profile
  after: Profile
  account?: Account
  challengeState?: ChallengeDetail | 'sending' | 'failed'
  onBack(): void
}) {
  const [profile, setProfile] = useState(after)
  const [revealed, setRevealed] = useState(false)
  return (
    <OverScreen
      run={run}
      profile={profile}
      profileBefore={before}
      revealed={revealed}
      onRevealed={() => setRevealed(true)}
      lang="fr"
      avatar={DEFAULT_AVATAR}
      account={account}
      accountActions={quietAccount}
      onAvatar={noop}
      onChoose={(id) => setProfile((current) => chooseCategory(current, id))}
      onChoosePower={(id) => setProfile((current) => choosePower(current, id))}
      onSupportAsked={noop}
      onReplay={onBack}
      onHome={onBack}
      challenge={challengeState}
      onChallengeChanged={noop}
    />
  )
}

interface Scenario {
  id: string
  group: string
  title: string
  how: string
  phase: string
  render(back: () => void): ReactNode
}

const levelUp = (from: number, to: number): [Profile, Profile] => {
  const before = { ...PROFILE, xp: at(from, 80) }
  return [before, afterRun(before, RUN, { xp: at(to, 40) })]
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: 'over-classic',
    group: 'Fin de partie',
    title: 'Classique, record battu',
    how: 'Record, mots rares, faute d’une lettre, demande de soutien',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN, { runs: PROFILE.runs + 10 })} onBack={back} />,
  },
  {
    id: 'over-category',
    group: 'Fin de partie',
    title: 'Proposition de catégorie',
    how: 'Passage au niveau 4 : trois catégories, une à garder',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(3, 4)
      return <OverScenario before={before} after={{ ...after, offer: ['sports', 'capitales', 'marques'] }} onBack={back} />
    },
  },
  {
    id: 'over-power',
    group: 'Fin de partie',
    title: 'Proposition de pouvoir',
    how: 'Passage au niveau 5 : deux cartes de pouvoir',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(4, 5)
      return <OverScenario before={{ ...before, powers: ['joker'] }} after={{ ...after, powers: ['joker'], powerOffer: ['hush', 'divination'] }} onBack={back} />
    },
  },
  {
    id: 'over-both',
    group: 'Fin de partie',
    title: 'Catégorie puis pouvoir',
    how: 'Du niveau 2 au 4 d’un coup : le premier pouvoir (3) et une catégorie (4)',
    phase: 'over',
    render: (back) => {
      const [before, after] = levelUp(2, 4)
      return (
        <OverScenario
          before={before}
          after={{ ...after, offer: ['sports', 'corps-humain', 'matieres'], powerOffer: ['joker', 'magic'] }}
          onBack={back}
        />
      )
    },
  },
  {
    id: 'over-professor',
    group: 'Fin de partie',
    title: 'Mots soufflés par Professeur',
    how: 'Bilan avec la liste des mots manqués',
    phase: 'over',
    render: (back) => {
      const run = makeRun(120, WORDS.slice(3), [
        { prompt: { categoryId: 'pays', letter: 'K' }, display: 'kenya' },
        { prompt: { categoryId: 'animaux', letter: 'Z' }, display: 'zèbre' },
      ])
      return <OverScenario run={run} after={afterRun(PROFILE, run)} onBack={back} />
    },
  },
  {
    id: 'over-anonymous',
    group: 'Fin de partie',
    title: 'Joueur anonyme',
    how: 'Proposition de créer un compte (sans effet)',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} account={ANONYMOUS} onBack={back} />,
  },
  {
    id: 'over-empty',
    group: 'Fin de partie',
    title: 'Aucun mot trouvé',
    how: 'Zéro point',
    phase: 'over',
    render: (back) => {
      const run = makeRun(0, [])
      return <OverScenario run={run} after={afterRun(PROFILE, run)} onBack={back} />
    },
  },
  {
    id: 'challenge-over',
    group: 'Défi entre amis',
    title: 'Fin de partie de défi',
    how: 'Classement provisoire, deux joueurs sur quatre attendus',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} challengeState={challenge('waiting')} onBack={back} />,
  },
  {
    id: 'challenge-sending',
    group: 'Défi entre amis',
    title: 'Fin de défi, envoi en cours',
    how: 'La partie n’a pas encore atteint le serveur',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} challengeState="sending" onBack={back} />,
  },
  {
    id: 'challenge-failed',
    group: 'Défi entre amis',
    title: 'Fin de défi, envoi échoué',
    how: 'Le serveur n’a pas répondu',
    phase: 'over',
    render: (back) => <OverScenario after={afterRun(PROFILE, RUN)} challengeState="failed" onBack={back} />,
  },
  {
    id: 'challenge-recap',
    group: 'Défi entre amis',
    title: 'Défi clos : bilan',
    how: 'Classement final, trophées, mots partagés et uniques, revanche',
    phase: 'home',
    render: (back) => <ChallengeView detail={challenge('finished')} onPlay={noop} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />,
  },
  {
    id: 'challenge-to-play',
    group: 'Défi entre amis',
    title: 'Défi à jouer',
    how: 'Invité, pas encore joué',
    phase: 'home',
    render: (back) => <ChallengeView detail={challenge('to-play')} onPlay={back} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />,
  },
  {
    id: 'challenge-waiting',
    group: 'Défi entre amis',
    title: 'Défi en attente des autres',
    how: 'Joué, classement provisoire, inviter d’autres amis',
    phase: 'home',
    render: (back) => <ChallengeView detail={challenge('waiting')} onPlay={noop} onRematch={() => later(false)} onReact={() => later(true)} onBack={back} onChanged={noop} />,
  },
  {
    id: 'challenge-invite',
    group: 'Défi entre amis',
    title: 'Notification : invitation',
    how: 'Un ami vient d’envoyer un défi',
    phase: 'home',
    render: (back) => <ChallengeNotice challenge={summaryOf(challenge('to-play'))} kind="invite" onLater={back} onGo={back} />,
  },
  {
    id: 'challenge-recap-notice',
    group: 'Défi entre amis',
    title: 'Notification : bilan prêt',
    how: 'Tout le monde a joué',
    phase: 'home',
    render: (back) => <ChallengeNotice challenge={summaryOf(challenge('finished'))} kind="recap" onLater={back} onGo={back} />,
  },
  {
    id: 'challenge-powers',
    group: 'Défi entre amis',
    title: 'Choix des pouvoirs avant un défi',
    how: 'Plus de deux pouvoirs admis',
    phase: 'home',
    render: (back) => (
      <ChallengePowers allowed={['joker', 'dodge', 'hush', 'divination', 'professor']} initial={['joker', 'dodge']} onStart={back} onClose={back} />
    ),
  },
  ...(['level', 'words', 'friend'] as const).map(
    (reason): Scenario => ({
      id: `moderator-${reason}`,
      group: 'Modération',
      title: `Offre de modérateur : ${{ level: 'niveau 6', words: 'trois mots acceptés', friend: 'élu par un ami' }[reason]}`,
      how: 'Accepter montre l’accueil, sans rien écrire sur le serveur',
      phase: 'home',
      render: (back) => (
        <ModeratorOffer
          reason={reason}
          invitedBy={reason === 'friend' ? 'Léa' : null}
          anonymous={false}
          onAccount={back}
          onAnswered={(accepted) => !accepted && back()}
          onLater={back}
          onModerate={back}
          answerOffer={() => later(true)}
        />
      ),
    }),
  ),
  {
    id: 'moderator-anonymous',
    group: 'Modération',
    title: 'Offre de modérateur, joueur anonyme',
    how: 'Il faut d’abord un compte',
    phase: 'home',
    render: (back) => (
      <ModeratorOffer reason="level" invitedBy={null} anonymous onAccount={back} onAnswered={back} onLater={back} onModerate={back} />
    ),
  },
  {
    id: 'moderator-failed',
    group: 'Modération',
    title: 'Offre de modérateur, réponse perdue',
    how: 'Le serveur ne répond pas',
    phase: 'home',
    render: (back) => (
      <ModeratorOffer
        reason="words"
        invitedBy={null}
        anonymous={false}
        onAccount={back}
        onAnswered={back}
        onLater={back}
        onModerate={back}
        answerOffer={() => later(false)}
      />
    ),
  },
  {
    id: 'language',
    group: 'Premier lancement',
    title: 'Choix de la langue',
    how: 'Appareil dans une langue que le jeu ne parle pas',
    phase: 'home',
    render: (back) => <LanguagePicker onPick={back} />,
  },
  {
    id: 'home-error',
    group: 'Accueil',
    title: 'Dictionnaire introuvable',
    how: 'Le chargement de la partie a échoué',
    phase: 'home',
    render: (back) => <DebugHome back={back} error />,
  },
  {
    id: 'home-news',
    group: 'Accueil',
    title: 'Mots acceptés à annoncer',
    how: 'Pastille sur « Mes demandes »',
    phase: 'home',
    render: (back) => <DebugHome back={back} />,
  },
  {
    id: 'home-newcomer',
    group: 'Accueil',
    title: 'Nouveau joueur sans compte',
    how: 'Tout à zéro : boutons de compte à la place des chiffres, du niveau et du classement',
    phase: 'home',
    render: (back) => <DebugHome back={back} newcomer />,
  },
  {
    id: 'long-boards',
    group: 'Accueil',
    title: 'Classement de plus de dix joueurs',
    how: 'Podium, le joueur et ses amis d’abord, puis « Voir plus » ; un nom ouvre ami / bloquer',
    phase: 'home',
    render: (back) => <DebugHome back={back} boards={LONG_BOARDS} />,
  },
  {
    id: 'update',
    group: 'Accueil',
    title: 'Notification : nouvelle version',
    how: 'Le Play Store a une version plus récente',
    phase: 'home',
    render: (back) => <UpdateNotice onLater={back} onUpdate={back} />,
  },
  {
    id: 'tutorial',
    group: 'Accueil',
    title: 'Tutoriel du premier « Jouer »',
    how: 'Une couleur en R (dans la langue de l’interface), puis la partie',
    phase: 'playing',
    render: (back) => <TutorialScreen lang="fr" onDone={back} />,
  },
]

function DebugHome({
  back,
  error = false,
  newcomer = false,
  boards = null,
}: {
  back(): void
  error?: boolean
  newcomer?: boolean
  boards?: Boards | null
}) {
  return (
    <HomeScreen
      profile={newcomer ? NEW_PROFILE : { ...PROFILE, powers: ['joker', 'hush'], equipped: ['joker'] }}
      error={error ? 'Le dictionnaire n’a pas pu être chargé.' : null}
      loading={false}
      settled
      boards={boards}
      me={newcomer ? null : 'Testeur'}
      avatar={DEFAULT_AVATAR}
      requestsNews={error || newcomer ? 0 : 3}
      challenges={null}
      onChallenge={noop}
      onCreateChallenge={noop}
      onMenu={back}
      onPlay={back}
      onEquip={noop}
      onAccount={back}
    />
  )
}

// --------------------------------------------------------------- board --

interface DebugBoardProps {
  onClose(): void
  /** The phase class the stage should wear, so each screen gets its own layout. */
  onPhase(phase: string): void
}

export function DebugBoard({ onClose, onPhase }: DebugBoardProps) {
  const [open, setOpen] = useState<Scenario | null>(null)
  // Replaying remounts the screen, its animations and picks with it.
  const [take, setTake] = useState(0)

  useEffect(() => {
    onPhase(open?.phase ?? 'home')
    window.scrollTo(0, 0)
  }, [open, onPhase])

  if (open) {
    return (
      <>
        <PlayerActionsContext.Provider value={PLAYER_ACTIONS}>
          <div key={`${open.id}:${take}`} className="debug-scene">
            {open.render(() => setOpen(null))}
          </div>
        </PlayerActionsContext.Provider>
        <div className="debug-bar">
          <button type="button" className="btn btn--quiet" onClick={() => setOpen(null)}>
            ← Planche
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => setTake(take + 1)}>
            Rejouer
          </button>
        </div>
      </>
    )
  }

  const groups = [...new Set(SCENARIOS.map((scenario) => scenario.group))]
  return (
    <div className="sheet cascade debug-board">
      <div className="spread">
        <h1 className="subpage-title">Planche debug</h1>
        <button type="button" className="btn btn--quiet" onClick={onClose}>
          Fermer
        </button>
      </div>
      <p className="note">
        Chaque écran difficile d’accès, avec des données inventées. Rien n’est envoyé au serveur ; les choix ne
        touchent pas au vrai profil.
      </p>
      {groups.map((group) => (
        <section key={group} className="stack">
          <p className="section-title">{group}</p>
          <ul className="debug-list">
            {SCENARIOS.filter((scenario) => scenario.group === group).map((scenario) => (
              <li key={scenario.id}>
                <button
                  type="button"
                  className="debug-item"
                  onClick={() => {
                    setTake(0)
                    setOpen(scenario)
                  }}
                >
                  <strong>{scenario.title}</strong>
                  <span className="note">{scenario.how}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
