/*
 * Le relevé des mots, tel que `admin_words` (0043) le rend : les compteurs du
 * dictionnaire vivant, par langue et par catégorie, pour l'écran caché de
 * « Mes catégories ». Les dictionnaires embarqués, eux, ne sont pas en base —
 * c'est la vue qui les confronte à ces chiffres.
 *
 * Dates en ISO, un mot toujours sous sa forme canonique (`WordEntry.key`), sa
 * catégorie et lui sans le préfixe de langue que le serveur leur donne.
 */

/** Ce que le tirage a donné à un couple lettre + catégorie (`prompt_stats`). */
export interface PairStat {
  category: string
  letter: string
  dealt: number
  passed: number
  words: number
  points: number
}

/** Ce qu'un mot du dictionnaire a rendu chez les joueurs (`run_words`). */
export interface WordUse {
  word: string
  category: string
  uses: number
  /** Écrit de travers et accepté par le dictionnaire, au tarif plat (0043). */
  approx: number
  /** La dernière fois qu'il a été écrit. */
  last: string | null
}

/** Un nom et un instant : un demandeur, un modérateur, un vote. */
export interface NamedAt {
  name: string
  at: string
}

export interface Vote extends NamedAt {
  verdict: string
  note: string | null
}

/** Un mot entré par la communauté : qui l'a demandé, qui l'a laissé passer. */
export interface AddedWord {
  word: string
  category: string
  display: string
  at: string
  uses: number
  approx: number
  /** Depuis son entrée au dictionnaire : ce qu'il a rendu, et les parties qui l'ont vu passer. */
  uses_since: number
  approx_since: number
  parties_since: number
  requesters: NamedAt[]
  /** Les votes qui l'ont fait entrer (correct ou super modérateur). */
  moderators: Vote[]
}

/** Un mot signalé puis retiré : ce qu'il rendait avant, et qui l'a sorti. */
export interface RemovedWord {
  word: string
  category: string
  display: string
  at: string
  uses_before: number
  approx_before: number
  parties_before: number
  /** Le signaleur d'abord — son motif est sur son vote —, puis ceux qui ont suivi. */
  moderators: Vote[]
}

/** Un mot que la modération juge encore : un ajout ou un retrait. */
export interface PendingWord {
  id: string
  word: string
  category: string
  display: string
  kind: 'add' | 'ban'
  at: string
  respelled: boolean
  special: boolean
  proposals: number
  proposers: NamedAt[]
  votes: Vote[]
}

export interface WordsReport {
  generated_at: string
  lang: string
  category: string | null
  /** Toutes les parties, toutes langues : le décor. */
  runs: number
  /** Les parties où un mot de cette langue a été écrit. */
  lang_runs: number
  /** Tous les tirages de la langue, filtre ou pas : ce à quoi se compare un couple. */
  dealt: number
  pairs: PairStat[]
  words: WordUse[]
  added: AddedWord[]
  removed: RemovedWord[]
  pending: PendingWord[]
}
