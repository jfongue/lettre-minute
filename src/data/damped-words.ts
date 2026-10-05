/**
 * Écrit par `npm run ban:sync` : les couples lettre + catégorie qu'un ban a
 * vidés à moitié, leur cote multipliée d'autant. Le tirage ne les juge que par
 * le nombre de mots qui leur restent (`run.ts`), ce qui ne suffit pas quand une
 * catégorie perd la moitié de ce qu'on pouvait écrire. Parties seules, comme
 * `DAMPED_PROMPTS` : un défi ne tire que selon la graine et ses dictionnaires.
 */
export const DAMPED_WORDS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  "fr": {
    "couleurs:H": 0.05
  }
}
