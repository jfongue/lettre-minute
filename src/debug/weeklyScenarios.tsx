import { useState } from 'react'
import { DEFAULT_AVATAR, type AvatarChoice } from '../domain/avatar'
import type { GameMode } from '../domain/modes'
import type { KeptWord, Prompt, Run } from '../domain/run'
import { weekOf, type WeeklyMeasures } from '../domain/weekly'
import type { ReactionEmoji, WeeklyBoardRow, WeeklyReactionCount, WeeklyRecap } from '../lib/cloud'
import type { Cheer } from '../state/session'
import { RunScreen } from '../ui/RunScreen'
import { WeeklyCard } from '../ui/WeeklyCard'
import { WeeklyDone } from '../ui/WeeklyDone'
import { WeeklyRecapView } from '../ui/WeeklyRecap'
import { WeeklyResultsView } from '../ui/WeeklyResults'
import { WeeklyView, type WeeklyViewProps } from '../ui/WeeklyScreen'

/*
 * Les planches du défi du moment : les vrais écrans, des joueurs inventés, et
 * des doublures pour tout ce qui écrirait sur le serveur.
 */

const WEEK = weekOf(Date.now())
/** Trois jours et quatre heures avant la clôture : un temps restant qui se lit. */
const NOW = WEEK.closesAt - (3 * 24 + 4) * 3_600_000

const NAMES = [
  'Maxitoon', 'Léa', 'Tom', 'Inès', 'Zoé', 'Hugo', 'Camille', 'Nour', 'Basile', 'Mila', 'Théo', 'Anouk', 'Jules', 'Sacha', 'Iris',
  'Noé', 'Lou', 'Oscar', 'Elsa', 'Gaspard', 'Rose', 'Léon', 'Jade', 'Marius', 'Alma', 'Ugo', 'Cléo', 'Samy', 'Nina', 'Paul',
  'Eden', 'Lola', 'Axel', 'Ambre', 'Rémi', 'Maëlle', 'Ilan', 'Salomé', 'Victor', 'Romy', 'Adam', 'Luna', 'Enzo', 'Pia', 'Kenzo',
  'Livia', 'Armand', 'Yaël', 'Félix', 'Mona', 'Aliénor', 'Titouan', 'Ève', 'Joris', 'Capucine', 'Mehdi', 'Faustine', 'Loïc', 'Dalia', 'Ruben',
]
const GROUNDS = ['bleu', 'jaune', 'rouge', 'vert', 'rose']
const SHAPES = ['jaune', 'noir', 'creme', 'rouge', 'bleu']

const avatarAt = (index: number): AvatarChoice => ({
  design: (index * 7) % 100,
  ground: GROUNDS[index % GROUNDS.length]!,
  shape: SHAPES[(index * 3) % SHAPES.length]!,
  accent: GROUNDS[(index + 2) % GROUNDS.length]!,
})

const ME = 11

/** Des dizaines de joueurs, le joueur de la planche au douzième rang. */
export const BOARD: readonly WeeklyBoardRow[] = NAMES.map((name, index) => ({
  rank: index + 1,
  playerId: `p${index}`,
  name: index === ME ? 'Testeur' : name,
  avatar: index === ME ? DEFAULT_AVATAR : avatarAt(index),
  value: Math.round((142.6 - index * 1.9 - (index % 3) * 0.4) * 10) / 10,
  attempts: 1 + ((index * 3) % 5),
  me: index === ME,
}))

export const MEASURES: readonly WeeklyMeasures[] = BOARD.map((row, index) => ({
  playerId: row.playerId,
  reachedAt: 1_000 + index,
  attempts: 1 + ((index * 3) % 5),
  climb: (index * 7) % 23,
  bestCombo: (index * 5) % 11,
  original: (index * 3) % 9,
  sheep: (index * 11) % 14,
  rarestTier: index % 5 === 0 ? 3 : index % 4,
  rarestPoints: 40 + index,
  rarestWord: 'ornithorynque',
  fastest: 2.1 + (index % 7) * 0.8,
  fastestWord: 'zèbre',
  longest: 7 + (index % 9),
  longestWord: 'anticonstitutionnellement',
}))

const react = (target: string, emoji: ReactionEmoji, count: number, mine = false): WeeklyReactionCount => ({ target, emoji, count, mine })

export const COUNTS: readonly WeeklyReactionCount[] = [
  react('podium:1', '👏', 48),
  react('podium:1', '🔥', 21, true),
  react('podium:2', '👏', 17),
  react('podium:3', '😮', 9),
  react('trophy:weekly-rarest', '😮', 31),
  react('trophy:weekly-rarest', '🏆', 12),
  react('trophy:weekly-fastest', '🔥', 26, true),
  react('trophy:weekly-sheep', '😂', 40),
  react('trophy:weekly-original', '❤️', 7),
  react('player:p4', '👏', 3),
  react('player:p11', '🔥', 5),
]

/** Un faux serveur pour les réactions : le compte bouge sans rien écrire. */
function useStandIn(initial: readonly WeeklyReactionCount[]) {
  const [counts, setCounts] = useState(initial)
  const onReact = (target: string, emoji: ReactionEmoji | null) =>
    setCounts((now) => {
      const without = now
        .map((count) => (count.target === target && count.mine ? { ...count, count: count.count - 1, mine: false } : count))
        .filter((count) => count.count > 0)
      if (!emoji) return without
      const same = without.find((count) => count.target === target && count.emoji === emoji)
      return same
        ? without.map((count) => (count === same ? { ...count, count: count.count + 1, mine: true } : count))
        : [...without, { target, emoji, count: 1, mine: true }]
    })
  return { counts, onReact }
}

export function WeeklyCardScenario({ onBack }: { onBack(): void }) {
  const states = [
    { used: 0, free: 1 },
    { used: 1, free: 1 },
    { used: 1, free: 2 },
    { used: 3, free: 3 },
  ]
  return (
    <div className="sheet" style={{ gap: '1.4rem' }}>
      <button type="button" className="btn btn--quiet" onClick={onBack}>
        ← Retour
      </button>
      {states.map((state) => (
        <WeeklyCard key={state.used} mode="endurance" closesAt={WEEK.closesAt} now={NOW} used={state.used} free={state.free} onOpen={onBack} />
      ))}
      <WeeklyCard mode="delayed" closesAt={WEEK.closesAt} now={NOW} used={0} free={1} onOpen={onBack} />
      <WeeklyCard mode="reversed" closesAt={WEEK.closesAt} now={NOW} used={1} free={2} onOpen={onBack} />
    </div>
  )
}

export function WeeklyScreenScenario({
  mode = 'endurance',
  used,
  plus,
  onBack,
  ads = 0,
  portal = false,
}: {
  mode?: GameMode
  used: number
  plus: boolean
  onBack(): void
  ads?: number
  portal?: boolean
}) {
  const props: WeeklyViewProps = {
    mode,
    closesAt: WEEK.closesAt,
    now: NOW,
    status: { used, ads, best: used === 0 ? null : 64.5, rank: used === 0 || portal ? null : 12, players: portal ? 0 : 342, online: !portal },
    plus,
    // CrazyGames : ni pub récompensée, ni boutique, ni serveur pour classer.
    adsOpen: !portal,
    premiumOpen: !portal,
    ranked: !portal,
    onLaunch: onBack,
    onWatchAd: () => undefined,
    onPremium: () => undefined,
    onTutorial: () => undefined,
    onResults: () => undefined,
    onBack,
  }
  return <WeeklyView {...props} />
}

type ScenarioWord = [string, string, string, number, KeptWord['tier']]

const RUN_WORDS: ScenarioWord[] = [
  ['animaux', 'A', 'Axolotl', 40, 'très rare'],
  ['pays', 'B', 'Bhoutan', 30, 'rare'],
  ['couleurs', 'V', 'Vermillon', 20, 'peu commun'],
  ['sports', 'C', 'Canoë', 10, 'courant'],
  ['metiers', 'F', 'Forgeron', 20, 'peu commun'],
  ['animaux', 'L', 'Lama', 10, 'courant'],
]

/** Le renversé : chaque mot finit par la lettre de sa question, jamais par le début. */
const REVERSED_WORDS: ScenarioWord[] = [
  ['pays', 'M', 'Vietnam', 40, 'rare'],
  ['animaux', 'E', 'Girafe', 20, 'courant'],
  ['couleurs', 'E', 'Rouge', 10, 'courant'],
  ['sports', 'T', 'Basket', 20, 'peu commun'],
  ['metiers', 'R', 'Boulanger', 20, 'peu commun'],
  ['animaux', 'N', 'Lion', 10, 'courant'],
]

const runOf = (mode: GameMode, words: readonly ScenarioWord[], prompt: Prompt, score: number): Run => ({
  seed: 7,
  mode,
  answer: null,
  armed: true,
  categoryIds: ['animaux', 'pays', 'couleurs'],
  prompt,
  drawn: 7,
  letterFreed: false,
  avoid: [],
  dealt: [],
  settled: [],
  shared: true,
  found: words.map(([categoryId, letter, display, points, tier], index) => ({
    prompt: { categoryId, letter },
    word: display.toLowerCase(),
    display,
    points,
    rarity: 0,
    tier,
    approximate: false,
    edits: 0,
    joker: false,
    boost: 1,
    seconds: 3,
    at: 4 + index * 5,
  })),
  used: [],
  usedPowers: [],
  promptAt: 0,
  skips: 1,
  penaltySeconds: 2,
  combo: 3,
  bestCombo: 4,
  score,
  powers: [],
  charges: {},
  joker: null,
  hush: null,
  heldSeconds: 0,
  latecomerSeconds: 0,
  bonusSeconds: 17.5,
} as unknown as Run)

const ENDURANCE_RUN = runOf('endurance', RUN_WORDS, { categoryId: 'animaux', letter: 'M' }, 130)
const REVERSED_RUN = runOf('reversed', REVERSED_WORDS, { categoryId: 'pays', letter: 'M' }, 120)

const CHEER: Cheer = { display: 'Lama', points: 10, tier: 'courant', approximate: false, edits: 0, joker: false, taught: false, boost: 1, auto: false }

export function WeeklyRunScenario({ mode = 'endurance', remaining = 21.4, urgent = false }: { mode?: GameMode; remaining?: number; urgent?: boolean }) {
  const noop = () => undefined
  const reversed = mode === 'reversed'
  return (
    <RunScreen
      run={reversed ? REVERSED_RUN : ENDURANCE_RUN}
      draft={urgent ? '' : reversed ? 'Vietna' : 'Mouf'}
      live={null}
      cheer={urgent ? null : CHEER}
      remaining={remaining}
      hushed={false}
      next={null}
      proposed={[]}
      onType={noop}
      onSubmit={noop}
      onSkip={noop}
      onFreeLetter={noop}
      onRecall={noop}
      onPropose={noop}
    />
  )
}

export function WeeklyDoneScenario({ record, onBack }: { record: boolean; onBack(): void }) {
  return (
    <WeeklyDone
      mode="endurance"
      value={record ? 88.2 : 41.6}
      previousBest={record ? 71 : 88.2}
      words={record ? 21 : 9}
      left={1}
      total={2}
      rank={record ? 9 : 12}
      players={342}
      sending="sent"
      ranked
      onBack={onBack}
    />
  )
}

export function WeeklyResultsScenario({ closed, onBack }: { closed: boolean; onBack(): void }) {
  const { counts, onReact } = useStandIn(COUNTS)
  return (
    <WeeklyResultsView
      mode="endurance"
      closed={closed}
      closesAt={WEEK.closesAt}
      now={NOW}
      rows={BOARD}
      total={342}
      measures={MEASURES}
      counts={counts}
      canReact
      onReact={onReact}
      onRetry={() => undefined}
      onBack={onBack}
      onPlay={onBack}
    />
  )
}

const RECAP: WeeklyRecap = {
  attempts: [34, 52.5, 48, 71, 88.2].map((value, index) => ({ n: index + 1, day: `2026-10-${12 + index}`, value, metric: 'survival', finished: true })),
  best: 88.2,
  rank: 7,
  players: 342,
  ranks: [
    { day: '2026-10-12', rank: 118, players: 140 },
    { day: '2026-10-13', rank: 64, players: 205 },
    { day: '2026-10-14', rank: 31, players: 260 },
    { day: '2026-10-15', rank: 12, players: 310 },
    { day: '2026-10-16', rank: 7, players: 342 },
  ],
}

export function WeeklyRecapScenario({ onBack }: { onBack(): void }) {
  return (
    <WeeklyRecapView
      mode="endurance"
      recap={RECAP}
      trophy={{ id: 'weekly-climber', playerId: 'p11', value: 54.2 }}
      onGo={onBack}
      onResults={onBack}
      onLater={onBack}
    />
  )
}
