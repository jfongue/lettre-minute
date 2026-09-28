/*
 * Écrit par `npm run debug:recent` : les planches touchées depuis les deux
 * dernières versions livrées (1.6.7, 1.6.8). Le fichier est commité — la
 * planche et le build n'ont pas besoin de git — et se régénère avant de livrer.
 * NEW_SCENARIOS : les planches que la 1.6.8 n'avait pas.
 */
export const RECENT_VERSIONS: readonly string[] = ['1.6.7', '1.6.8']
export const RECENT_SCENARIOS: readonly string[] = ['home-error', 'home-waiting', 'home-news', 'home-newcomer', 'long-boards', 'home-climb', 'leaderboards', 'leaderboards-anonymous', 'leaderboards-advanced', 'achievement-icons', 'home-categories-news', 'categories-ban', 'categories-ban-plus', 'categories-ban-full', 'categories-ban-max', 'checkout']
export const NEW_SINCE = '1.6.8'
export const NEW_SCENARIOS: readonly string[] = ['name-prompt']
