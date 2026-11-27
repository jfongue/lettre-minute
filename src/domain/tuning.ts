/**
 * Les réglages du jeu qu'une migration peut changer sans livrer de version
 * (`game_config`, 0125) : chaque clé a sa valeur par défaut, celle que le jeu
 * embarque et joue sans serveur, et sa plage. Une valeur lue hors plage, d'un
 * autre type ou d'une clé inconnue est ignorée — une migration ratée ne casse
 * jamais une partie.
 *
 * Trois familles, selon qui doit lire la même valeur :
 * - `run.*` voyage avec chaque partie (`Run.tuning`) : un défi, un robot qui
 *   le rejoue ou le défi du moment le reçoivent figé, jamais celui de l'appareil ;
 * - `duel.*` voyage avec chaque duel (`Duel.tuning`), figé par le serveur au
 *   lancement de la table (`duel_tables.tuning`) ;
 * - le reste ne règle que l'appareil qui le lit, et s'applique au lancement
 *   suivant, comme les fonctionnalités.
 *
 * `ranked.*` est aussi lu par le serveur (`game_config_value`), qui seul règle
 * le classement : l'écran n'en tire que l'annonce de l'enjeu.
 */

type Spec = readonly [value: number, min: number, max: number, integer?: 'int']

const SPEC = {
  // ------------------------------------------------ la partie, figée avec elle
  'run.seconds.solo': [60, 20, 300, 'int'],
  'run.seconds.delayed': [60, 20, 300, 'int'],
  'run.seconds.endurance': [30, 10, 120, 'int'],
  'run.seconds.reversed': [60, 20, 300, 'int'],
  'run.seconds.race': [180, 60, 600, 'int'],
  'run.raceWords': [10, 3, 50, 'int'],
  'run.endurance.courant': [2, 0, 10],
  'run.endurance.peuCommun': [2.5, 0, 10],
  'run.endurance.rare': [3, 0, 10],
  'run.endurance.tresRare': [4, 0, 10],
  'run.recallSeconds': [3, 0, 15],
  'run.skipPenalty': [5, 0, 20],
  'run.dodgePenalty': [3, 0, 20],
  'run.hushSeconds': [10, 0, 30],
  'run.latecomerThreshold': [10, 0, 60],
  'run.latecomerSeconds': [1, 0, 10],
  'run.latecomerCap': [5, 0, 30],
  'run.flawlessStreak': [6, 2, 30, 'int'],
  'run.flawlessPoints': [30, 0, 200, 'int'],
  'run.basePoints': [10, 1, 100, 'int'],
  'run.rarityPoints': [20, 0, 200, 'int'],
  'run.comboStep': [0.1, 0, 1],
  'run.comboMax': [9, 0, 50, 'int'],

  // --------------------------------------------- le duel, figé avec sa table
  'duel.reserve': [30, 10, 120],
  'duel.passPenalty': [5, 0, 20],
  'duel.floor': [1.5, 0.5, 10],
  'duel.grace': [1, 0, 5],
  'duel.deathBonus': [1.5, 0, 10],
  'duel.bonus.courant': [0, 0, 10],
  'duel.bonus.peuCommun': [1, 0, 10],
  'duel.bonus.rare': [1.5, 0, 10],
  'duel.bonus.tresRare': [2, 0, 10],
  'duel.echoFirst': [1, 0, 5],
  'duel.echoNext': [0.5, 0, 5],
  'duel.echoMax': [3, 0, 10, 'int'],
  'duel.longSeconds': [180, 30, 1800],
  'duel.fadeSeconds': [180, 10, 1800],
  'duel.pickSeconds': [10, 3, 60],
  'duel.xpBonus': [100, 0, 1000, 'int'],

  // --------------------------------------------------- l'appareil, au lancement
  'xp.perPoint': [1, 0, 10],
  'xp.recordBonus': [100, 0, 1000, 'int'],
  'xp.recordBonusBelow': [250, 0, 5000, 'int'],
  'xp.challengeBonus': [0.25, 0, 5],
  'powers.firstLevel': [3, 1, 50, 'int'],
  'powers.levelStep': [2, 1, 20, 'int'],
  'powers.offerSize': [2, 1, 6, 'int'],
  'bonus.fromLevel': [7, 1, 100, 'int'],
  'bonus.everyLevels': [3, 1, 50, 'int'],
  'bonus.offerSize': [2, 1, 6, 'int'],
  'reveals.base': [2, 0, 50, 'int'],
  'reveals.perAd': [3, 0, 50, 'int'],
  'reveals.bonusMax': [3, 0, 50, 'int'],
  'bans.freeMax': [3, 0, 20, 'int'],
  'bans.plus': [6, 0, 20, 'int'],
  'bans.minPlayable': [6, 3, 30, 'int'],
  'ads.first': [3, 1, 100, 'int'],
  'ads.gap': [4, 1, 100, 'int'],
  'ads.growth': [2, 0, 50, 'int'],
  'asks.feedbackFirst': [10, 1, 1000, 'int'],
  'asks.feedbackEvery': [30, 1, 1000, 'int'],
  'asks.ratingFirst': [10, 1, 1000, 'int'],
  'asks.ratingEvery': [20, 1, 1000, 'int'],
  'asks.shareNewsRuns': [15, 0, 1000, 'int'],
  'weekly.freeAttempts': [1, 0, 5, 'int'],
  'weekly.adAttempts': [2, 0, 5, 'int'],
  'weekly.plusAttempts': [3, 1, 5, 'int'],
  'weekly.minLevel': [4, 1, 100, 'int'],

  // ------------------------------------- le classement, réglé par le serveur
  'ranked.offerSeconds': [20, 5, 120, 'int'],
  'ranked.botGrace': [10, 0, 300, 'int'],
  'ranked.botDefaultWait': [20, 0, 600, 'int'],
  'ranked.botMaxWait': [180, 10, 1800, 'int'],
  'ranked.botAnswerMin': [0.55, 0, 1],
  'ranked.botAnswerMax': [0.95, 0, 1],
  'ranked.kEarly': [60, 1, 200, 'int'],
  'ranked.kMid': [40, 1, 200, 'int'],
  'ranked.kLate': [20, 1, 200, 'int'],
  'ranked.kEarlyGames': [10, 0, 1000, 'int'],
  'ranked.kMidGames': [20, 0, 1000, 'int'],
  'ranked.boost': [2, 1, 5, 'int'],
  'ranked.startEarly': [950, 100, 3000, 'int'],
  'ranked.startLate': [800, 100, 3000, 'int'],
  'ranked.bronzeStartGold': [50, 0, 100000, 'int'],
  'ranked.mastersFromDiamonds': [10, 0, 100000, 'int'],
  'ranked.botStake': [0.5, 0, 2],
  'ranked.decayGraceDays': [7, 0, 365, 'int'],
  'ranked.decayPerDay': [5, 0, 200, 'int'],
  'ranked.decayCap': [150, 0, 3000, 'int'],
  'ranked.decayFloor': [950, 100, 3000, 'int'],
} as const satisfies Record<string, Spec>

export type TuningKey = keyof typeof SPEC
export type Tuning = Record<TuningKey, number>
type KeysOf<Prefix extends string> = Extract<TuningKey, `${Prefix}.${string}`>
export type RunTuning = Pick<Tuning, KeysOf<'run'>>
export type DuelTuning = Pick<Tuning, KeysOf<'duel'>>

export const TUNING_KEYS = Object.keys(SPEC) as TuningKey[]

export const DEFAULT_TUNING: Readonly<Tuning> = Object.freeze(
  Object.fromEntries(TUNING_KEYS.map((key) => [key, SPEC[key][0]])) as Tuning,
)

/** La plage d'une clé, pour la planche debug. */
export function tuningRange(key: TuningKey): { min: number; max: number; integer: boolean } {
  const [, min, max, integer] = SPEC[key] as Spec
  return { min, max, integer: integer === 'int' }
}

function isKey(key: string): key is TuningKey {
  return Object.hasOwn(SPEC, key)
}

/** Ce qu'une valeur lue devient : un nombre dans sa plage, sinon rien. */
function accepted(key: TuningKey, raw: unknown): number | null {
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const [, min, max, integer] = SPEC[key] as Spec
  if (value < min || value > max) return null
  if (integer === 'int' && !Number.isInteger(value)) return null
  return value
}

/** Les réglages valides d'un objet lu (serveur, cache, instantané), sans les autres. */
export function parseTuning(raw: unknown): Partial<Tuning> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Partial<Tuning> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isKey(key)) continue
    const ok = accepted(key, value)
    if (ok !== null) out[key] = ok
  }
  return out
}

/**
 * Les réglages en vigueur sur cet appareil : les valeurs par défaut tant que
 * rien n'est appliqué. Muable à dessein — seul `applyTuning` y écrit, au
 * lancement ; les parties partagées ne le lisent jamais, elles portent leur
 * instantané.
 */
export const TUNING: Tuning = { ...DEFAULT_TUNING }

/** Remplace les réglages de l'appareil : les défauts, puis ce qui est valide. */
export function applyTuning(raw: unknown): void {
  Object.assign(TUNING, DEFAULT_TUNING, parseTuning(raw))
}

function group<K extends TuningKey>(prefix: string, source: Partial<Tuning>): Pick<Tuning, K> {
  const out = {} as Pick<Tuning, K>
  for (const key of TUNING_KEYS) if (key.startsWith(prefix)) (out as Record<string, number>)[key] = source[key] ?? DEFAULT_TUNING[key]
  return out
}

/** Les réglages d'une partie : ceux de l'appareil, ou d'un instantané complété des défauts. */
export function runTuning(snapshot?: unknown): RunTuning {
  return group<KeysOf<'run'>>('run.', snapshot === undefined ? TUNING : parseTuning(snapshot))
}

/** Les réglages d'un duel : ceux de l'appareil, ou d'un instantané complété des défauts. */
export function duelTuning(snapshot?: unknown): DuelTuning {
  return group<KeysOf<'duel'>>('duel.', snapshot === undefined ? TUNING : parseTuning(snapshot))
}

/** Les réglages par défaut d'une famille : ceux d'une partie qui n'a pas d'instantané. */
export const DEFAULT_RUN_TUNING: RunTuning = group<KeysOf<'run'>>('run.', DEFAULT_TUNING)
export const DEFAULT_DUEL_TUNING: DuelTuning = group<KeysOf<'duel'>>('duel.', DEFAULT_TUNING)
