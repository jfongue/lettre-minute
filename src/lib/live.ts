/**
 * Comment un écran apprend que le serveur a peut-être changé : une table de
 * duel où quelqu'un a joué, une invitation qui arrive. Le transport ne porte
 * aucune donnée, il réveille seulement l'écran, qui relit lui-même le serveur
 * (`duel_sync`, `duel_my_invites`) : un signal perdu ou doublé coûte une
 * lecture, jamais une table fausse, et le journal du duel reste ordonné par
 * `seq` et départagé par `stale` quel que soit le transport.
 *
 * Seul le relevé à intervalle existe aujourd'hui. Realtime viendra se brancher
 * derrière la même interface, le relevé restant son filet
 * (docs/realtime-migration.md).
 */

export type LiveTopic = { kind: 'duelTable'; table: string } | { kind: 'duelInvites' }

export interface WatchOptions {
  /**
   * La cadence du relevé, en millisecondes. Un transport prévenu des
   * changements peut l'étirer en filet de sécurité, jamais la raccourcir.
   */
  every: number
}

export interface LiveTransport {
  readonly name: 'polling' | 'realtime'
  /**
   * Appelle `wake` chaque fois que `topic` a pu changer, jusqu'à l'appel de la
   * fonction rendue. Jamais page cachée : l'écran relit de lui-même à son retour.
   * La première lecture reste à l'écran, qui la fait avant de s'abonner.
   */
  watch(topic: LiveTopic, wake: () => void, options: WatchOptions): () => void
}

/** Ce que le relevé lit du navigateur, remplacé par une doublure dans les tests. */
export interface PollClock {
  hidden(): boolean
  setInterval(tick: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
}

const browserClock: PollClock = {
  hidden: () => typeof document !== 'undefined' && document.hidden,
  setInterval: (tick, ms) => setInterval(tick, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

export function pollingTransport(clock: PollClock = browserClock): LiveTransport {
  return {
    name: 'polling',
    watch(_topic, wake, { every }) {
      const handle = clock.setInterval(() => {
        if (!clock.hidden()) wake()
      }, every)
      return () => clock.clearInterval(handle)
    },
  }
}

/**
 * Le canal Realtime d'un sujet, celui que les déclencheurs de 0121 nomment et
 * que les politiques de `realtime.messages` ouvrent : les deux côtés doivent
 * l'écrire pareil. Null pour les invitations d'un joueur encore inconnu.
 */
export function channelOf(topic: LiveTopic, player: string | null): string | null {
  if (topic.kind === 'duelTable') return `duel:${topic.table}`
  return player ? `duel-invites:${player}` : null
}

const polling = pollingTransport()

/** Le transport de ce lancement : le choix se fera ici, derrière une fonctionnalité. */
export function liveTransport(): LiveTransport {
  return polling
}
