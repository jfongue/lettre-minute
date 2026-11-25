# Version Y8

La version CrazyGames (« Letter Minute ») derrière le SDK de Y8 (minimal SDK
2.0, [docs.y8.com](https://docs.y8.com)) au lieu de celui du portail : même
page, mêmes styles (`src/crazygames.css`), même joueur invité. L'hôte est
`src/platform/y8.ts`, l'entrée `y8.html` / `src/y8.tsx`.

## Construire

```bash
npm run y8:build
```

Construit `dist-y8/` (la page renommée `index.html` à la racine) et
`y8/lettre-minute-y8.zip`, le fichier à téléverser. `npm run y8:dev` ouvre la
version de développement.

Deux identifiants du Developer Portal entrent dans `.env.local` avant un build
destiné à la revue :

- `VITE_Y8_APP_ID` : l'App ID, donné à la première ouverture de la page du jeu
  dans le Developer Portal. Sans lui le build part **sans SDK** : ni pub, ni
  sauvegarde Y8, la progression reste dans le navigateur.
- `VITE_Y8_GAME_ID` : le Game ID, que l'`adConfig` du SDK demande. Sans lui,
  pas de pub, et les révélations du bilan sont gratuites.

## Ce que Y8 change

- **Pubs** : l'interstitiel (`showAd`, type `next`) ne part que des boutons qui
  lancent une partie (`midgame`, comme sur CrazyGames) — Y8 refuse un
  interstitiel qu'aucun clic n'a demandé, même en fin de partie. Y8 les espace
  lui-même (trois minutes par défaut). La pub récompensée (type `reward`) paie
  les révélations du bilan, seulement sur `adViewed`. Le son se coupe de
  `beforeAd` à `afterAd` ; onglet caché ou fenêtre quittée le coupent déjà
  partout (`src/lib/sound.ts`). Un bloqueur de pub laisse le jeu jouable.
- **Sauvegarde** : un joueur connecté à Y8 (`autoLogin`) retrouve sa
  progression dans le cloud de Y8, sous une seule clé (`lettre-minute`) :
  Y8 n'accepte qu'une écriture par clé toutes les cinq secondes et 30 Ko par
  valeur, d'où un envoi groupé au plus toutes les six secondes et un historique
  coupé à ses parties récentes. Un invité garde la progression du navigateur.
- **Serveur** : les classements seulement, lus en invité. Le compte Y8 n'est
  pas lié à un compte du jeu : ni amis, ni duel, ni mots proposés, ni
  modération. Pas de suivi d'usage (le serveur ne l'accepte d'un invité que
  pour CrazyGames, 0084).
- **Liens** : aucun lien hors de la page (« External links are not allowed
  inside games on Y8 ») : `VITE_PRIVACY_URL` est vidé au build.
- **Langue** : celle de Y8 (`getPlatformLocale`), puis celle du navigateur.

## Soumettre

Sur [developer.y8.com](https://developer.y8.com/games) : créer le jeu (nom
seul), téléverser le zip, puis les médias aux tailles exactes (captures
760×570 et 1280×720, promos 1920×1080, 1080×1920 et 760×570, vidéo 16:9
d'au moins 15 s, sans adresse web ni logo d'un autre portail), la déclaration
IA, les appareils et l'orientation. Un build en brouillon ou en revue reçoit
des pubs maison de Y8.

## Encore inconnu

La doc de Y8 ne dit rien du format exact d'envoi, des limites de taille, ni des
appels réseau externes (notre serveur Supabase) : à confirmer auprès de
integration@y8.com si la revue bute dessus.
