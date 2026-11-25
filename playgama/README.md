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
- Connexion du portail, comme sur CrazyGames : `bridge.player.authorize()`
  depuis « Se connecter » (menu, onglet des amis), puis `bridge.player.extra`
  envoyé à la fonction Edge `playgama-auth`, qui le fait vérifier par l'API de
  Playgama (`/api/bridge/v1/verify`, plateformes `playgama`, `msn`,
  `microsoft_store`) et ouvre le compte du jeu lié (`playgama_accounts`,
  0114), nommé d'après le pseudo du portail. Ailleurs (partenaires sans
  vérification, mode `mock`), pas de bouton : le joueur reste invité.
- Un joueur connecté a tout ce qu'un compte nommé porte : amis, face-à-face,
  duel et matchmaking, défis de 24 h entre amis et leurs réactions, mots
  proposés, modération, boîte à idées ; un super modérateur, ses outils.
  Fermé : ce qui mène hors de la page (invitation par lien ou e-mail,
  partage, store) et ce qui se vend.
- Score de chaque partie envoyé au classement du portail partenaire quand il
  en a un (`best_score`, `playgama-bridge-config.json`) ; Playgama lui-même
  n'en a pas, ses classements sont ceux du serveur.
- Bannière avancée du Bridge (`run`, 12 % du bas de la fenêtre) pendant la
  partie, son récap et son bilan, jamais pour un Premium ; la page ne réserve
  sa bande (`data-portal-banner`, `crazygames.css`) que quand elle s'affiche.
  Prise en charge sur playgama et msn seulement.
- Les événements `trackFeature` partent à l'analytics du Bridge (sauf `ad`,
  que le Bridge compte lui-même) ; aucun autre suivi d'usage (Playgama refuse
  les analytics externes).
- Les succès nommés (Play Games et exploits) sont déclarés dans
  `playgama-bridge-config.json` en snake_case et envoyés une fois chacun ;
  natifs seulement sur Y8 et Lagged, suivis localement par le Bridge ailleurs.
- Une pub plein écran fige le chrono de la partie, même ouverte en retard.

Mise en ligne de la connexion : `supabase db push --linked --yes` (0114), puis
`supabase functions deploy playgama-auth --no-verify-jwt --use-api`.
