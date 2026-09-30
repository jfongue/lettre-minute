/*
 * Écrit par `npm run debug:recent` : les planches touchées depuis la dernière
 * version livrée (1.7.2). Le fichier est commité — la planche et le
 * build n'ont pas besoin de git — et se régénère avant de livrer.
 * NEW_SCENARIOS : les planches que la 1.7.2 n'avait pas.
 */
export const RECENT_SCENARIOS: readonly string[] = ['challenge-recap', 'challenge-recap-reveal', 'challenge-closed-live', 'challenge-to-play', 'challenge-waiting', 'leaderboards', 'leaderboards-anonymous']
export const NEW_SINCE = '1.7.2'
export const NEW_SCENARIOS: readonly string[] = ['leaderboards-podium']
