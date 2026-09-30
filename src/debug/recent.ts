/*
 * Écrit par `npm run debug:recent` : les planches touchées depuis les deux
 * dernières versions livrées (1.6.9, 1.7.0). Le fichier est commité — la
 * planche et le build n'ont pas besoin de git — et se régénère avant de livrer.
 * NEW_SCENARIOS : les planches que la 1.7.0 n'avait pas.
 */
export const RECENT_VERSIONS: readonly string[] = ['1.6.9', '1.7.0']
export const RECENT_SCENARIOS: readonly string[] = ['over-classic', 'over-proposals', 'over-proposals-failed', 'over-category', 'over-power', 'over-both', 'over-hidden', 'over-hidden-spent', 'over-hidden-premium', 'over-anonymous', 'over-empty', 'challenge-over', 'challenge-sending', 'challenge-failed', 'words-news', 'words-news-long', 'power-gift', 'challenge-past', 'social-friends', 'social-add-friend', 'social-invite', 'social-unnamed', 'home-error', 'home-waiting', 'home-news', 'home-newcomer', 'long-boards', 'home-climb', 'home-categories-news', 'stats', 'ideas-admin', 'ideas-admin-empty', 'name-prompt', 'invite-art']
export const NEW_SINCE = '1.7.0'
export const NEW_SCENARIOS: readonly string[] = ['share-news']
