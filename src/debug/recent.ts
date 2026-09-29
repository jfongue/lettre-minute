/*
 * Écrit par `npm run debug:recent` : les planches touchées depuis les deux
 * dernières versions livrées (1.6.8, 1.6.9). Le fichier est commité — la
 * planche et le build n'ont pas besoin de git — et se régénère avant de livrer.
 * NEW_SCENARIOS : les planches que la 1.6.9 n'avait pas.
 */
export const RECENT_VERSIONS: readonly string[] = ['1.6.8', '1.6.9']
export const RECENT_SCENARIOS: readonly string[] = ['over-classic', 'over-proposals', 'over-proposals-failed', 'over-category', 'over-power', 'over-both', 'over-hidden', 'over-hidden-spent', 'over-hidden-premium', 'over-anonymous', 'over-empty', 'challenge-over', 'challenge-sending', 'challenge-failed', 'challenge-past', 'home-error', 'home-waiting', 'home-news', 'home-newcomer', 'long-boards', 'home-climb', 'leaderboards', 'leaderboards-anonymous', 'leaderboards-advanced', 'achievement-icons', 'home-categories-news', 'categories-ban', 'categories-ban-plus', 'categories-ban-full', 'categories-ban-max', 'checkout', 'ideas-admin', 'ideas-admin-empty', 'name-prompt']
export const NEW_SINCE = '1.6.9'
export const NEW_SCENARIOS: readonly string[] = ['social-friends', 'social-add-friend', 'social-invite', 'social-unnamed', 'stats', 'invite-art']
