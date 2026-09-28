/*
 * Écrit par `npm run debug:recent` : les planches touchées depuis les deux
 * dernières versions livrées (1.6.5, 1.6.6). Le fichier est commité — la
 * planche et le build n'ont pas besoin de git — et se régénère avant de livrer.
 * NEW_SCENARIOS : les planches que la 1.6.6 n'avait pas.
 */
export const RECENT_VERSIONS: readonly string[] = ['1.6.5', '1.6.6']
export const RECENT_SCENARIOS: readonly string[] = ['over-classic', 'over-proposals', 'over-proposals-failed', 'over-category', 'over-power', 'over-both', 'over-hidden', 'over-hidden-spent', 'over-hidden-premium', 'over-anonymous', 'over-empty', 'challenge-over', 'challenge-sending', 'challenge-failed', 'challenge-create', 'challenge-create-bare', 'challenge-past', 'friend-page', 'friend-page-tie', 'friend-page-empty', 'challenge-powers', 'home-error', 'home-news', 'home-newcomer', 'long-boards', 'home-climb', 'leaderboards', 'leaderboards-anonymous', 'leaderboards-advanced', 'feedback-pop', 'feedback-pop-failed', 'home-categories-news', 'categories-ban', 'categories-ban-plus', 'categories-ban-full', 'categories-ban-max', 'plus-pop', 'checkout', 'premium-thanks', 'plus-pop-peek', 'ideas-admin', 'ideas-admin-denied', 'ideas-admin-empty', 'push-offer']
export const NEW_SINCE = '1.6.6'
export const NEW_SCENARIOS: readonly string[] = ['home-waiting']
