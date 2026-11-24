# Version Playgama

La version CrazyGames (même page, mêmes styles, `crazygames.css`) derrière le
**Bridge v2** de Playgama (`@playgama/bridge`) au lieu du SDK CrazyGames.

- Entrée `playgama.html` / `src/playgama.tsx`, hôte `src/platform/playgama.ts`.
- `npm run playgama:build` → `dist-playgama/` et `playgama/lettre-minute-playgama.zip`
  (`index.html` à la racine, `playgama-bridge.js` premier script de la page,
  `playgama-bridge-config.json` à côté, tiré de `playgama/public/`).
- `npm run playgama:dev` : le serveur de dev ; hors du portail, le Bridge
  tourne en mode `mock` (ni pub ni nuage, la sauvegarde reste locale).

Ce que l'hôte fait :

- `game_ready` une fois l'accueil dessiné ; `level_started` / `level_completed`
  à l'entrée et à la sortie d'une partie.
- Interstitiel à chaque bouton qui mène au jeu (`midgame`) : le Bridge le
  rythme lui-même et répond `failed` à une demande trop rapprochée.
- Pub récompensée pour les révélations du bilan, payée seulement sur l'état
  `rewarded`.
- Son coupé pendant une pub, quand le portail coupe le son ou met en pause.
- Sauvegarde : les clés de `src/platform/saves.ts` relues du stockage du Bridge
  avant le premier rendu, puis recopiées à chaque écriture.
- Langue du portail (`bridge.platform.language`) avant celle du navigateur.
- Comme un invité CrazyGames : classements lus du serveur, rien d'autre de ce
  qui demande un compte (amis, duel, mots proposés, modération), rien qui
  quitte la page, aucun suivi d'usage (Playgama refuse les analytics externes).

Reste à faire avant une soumission (pas la sandbox) : relier les comptes
Playgama à ceux du jeu (`bridge.player`, vérification serveur), et la colonne
`runs.platform` (0072) n'accepte pas encore `playgama` — sans conséquence tant
qu'un joueur Playgama n'écrit rien sur le serveur.
