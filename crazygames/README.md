# Lettre Minute sur CrazyGames

La version du jeu soumise à CrazyGames (https://developer.crazygames.com/submit),
sous le nom **Letter Minute**. C'est l'app elle-même (`src/App.tsx`), construite
en mode `crazygames`, sans le téléphone, sans le serveur, derrière le SDK HTML5 v3
du portail. L'app Android et la version web ne changent pas : chaque différence
passe par l'hôte `crazyGamesHost` (`src/platform/crazygames.ts`), que seul ce
build choisit (`VITE_PLATFORM`, `src/platform/index.ts`), et Vite retire le code
mort — le build web ne contient ni le SDK ni ses appels.

## Commandes

| Commande | Effet |
|---|---|
| `npm run crazygames:build` | `tsc -b`, `vite build --mode crazygames` dans `dist-crazygames/` (`index.html` à la racine, chemins relatifs), zip dans `crazygames/lettre-minute-crazygames.zip`, puis contrôle des tailles contre les limites du portail |
| `npm run crazygames:harness` | sert `dist-crazygames/` sur http://localhost:5747 — le SDK y démarre en mode `local` (pubs simulées par un texte, journal dans la console) ; `/frame.html?size=desktop\|laptop\|small\|phone` (ou `?w=926&h=476`) montre le jeu dans une iframe aux tailles du portail |
| `npm run crazygames:check` | (harnais lancé) à 926×476, 800×450, 1280×720 et 390×844, pour un nouveau venu et un habitué : « Play » dans le cadre et au premier plan (`elementFromPoint`), un vrai clic souris CDP qui lance la leçon ou la partie, champ, Passer et Valider dans le cadre ; avec une adresse du réseau local en second argument, vérifie aussi que le jeu démarre hors du portail, SDK `disabled` |
| `npm run crazygames:dev` | le serveur de dev Vite en mode `crazygames`, sur `/crazygames.html` |
| `cd crazygames/video && npm install && node capture.mjs && node render.mjs` | (harnais lancé) enregistre une vraie partie en Chrome sans tête puis monte les deux vidéos de présentation avec HyperFrames, installé dans ce dossier seul : `crazygames/assets/video-*.mp4` |
| `node --experimental-strip-types scripts/crazygames-shots.ts` | (harnais lancé) rend les trois couvertures depuis `assets/cover.html` et joue de vraies parties en Chrome sans tête pour les captures ; imprime la console de la page à la fin |

Le zip et `dist-crazygames/` sont ignorés par git : ils se reconstruisent.

## Ce que fait le build

- **Entrée** : `crazygames.html` → `src/crazygames.tsx`. Le SDK
  (`https://sdk.crazygames.com/crazygames-sdk-v3.js`) est la seule ressource
  externe, ajoutée par script et jamais par une balise bloquante : un hôte qui
  ne répond pas laisserait la page blanche. L'entrée attend le script puis
  `SDK.init()` — 8 s au plus sur le portail ou localhost, 1,5 s ailleurs, où
  le SDK ne peut que finir `disabled` —, annonce
  `loadingStart`, recopie la progression sauvegardée, rend l'app, puis
  `loadingStop`. Pas de suivi d'usage (`track.ts`), pas de coquille native.
- **Hors ligne, sans Supabase** : `vite.config.ts` vide toutes les variables
  externes (`VITE_SUPABASE_*`, AdMob, Google, push, confidentialité) quel que
  soit `.env.local`. Choix le plus sûr pour la soumission : aucun compte, aucun
  formulaire, aucune donnée personnelle envoyée hors du SDK (donc pas de
  politique de confidentialité à afficher), aucun appel réseau qui pourrait
  échouer ou ralentir le jeu dans l'iframe. `cloud.ts` répond déjà par ses
  replis. Le prix : pas de classements, de rareté de la foule ni de mots
  proposés — qui demanderaient d'ailleurs, pour une Full Launch, de lier nos
  comptes à ceux de CrazyGames (module User + vérification du JWT côté serveur).
- **Fonctionnalités fermées** (`crazyGamesHost.closedFeatures`, soit `SERVER_FEATURES` et `APP_ONLY_FEATURES` de `src/platform/host.ts`) : défis, duel, amis,
  invitations, face-à-face, réactions, classements, Premium (faux paiement),
  modes de jeu, propositions de mots et modération, boîte à idées, question
  d'avis, demande de note, notifications, mise à jour du store, Play Games,
  pubs AdMob, outils de développeur. Le bouton « Partager — bientôt » (bouton mort, fonctionnalité `share`)
  et la note « Hors ligne » du menu (`keepsProgress`) disparaissent aussi. Restent : la
  partie, le tutoriel, les pouvoirs, les catégories et leurs bans, les mots
  cachés du bilan, l'avatar, les succès, les statistiques, les options.
- **Langue** : celle du SDK (`user.systemInfo.locale`), puis celle du
  navigateur, sinon l'anglais — jamais le sélecteur de langue au premier
  lancement. Le joueur peut en changer dans les options. Le titre affiché
  reste **Letter Minute** dans toutes les langues (`crazyGamesHost.title`), pour
  correspondre au nom soumis.
- **Thème clair par défaut** (`data-theme="light"` dès le HTML) ; le thème
  sombre reste au choix dans les options.
- **Événements** (`src/platform/usePlatformGameplay.ts`) : `gameplayStart` au compte
  à rebours, pendant la partie et pendant la leçon du premier lancement ;
  `gameplayStop` dès qu'on en sort. `happytime` quand une partie bat un record
  qui existait déjà.
- **Pub midgame** : demandée à « Rejouer » / « Jouer » s'il s'est terminé une
  partie depuis la précédente (`breakBetweenRuns`) ; le SDK refuse lui-même
  une pub à moins de 3 min de la dernière. La partie suivante attend la fin de
  la pub, ou son erreur (y compris bloqueur de pub), au plus 60 s. Le son est
  coupé seulement pendant que la pub joue (`adStarted` → `adFinished`/`adError`).
  En Basic Launch, le portail n'affiche aucune pub : l'appel ne coûte rien.
- **Pas de pub rewarded** : aucun pouvoir ne s'y prête sans une règle de domaine
  nouvelle (charge en plus, reroll payé…), et une Basic Launch interdit un
  bouton rewarded qui ne ferait rien. À reconsidérer pour une Full Launch.
- **Son** : `game.settings.muteAudio` et son écouteur coupent tout le jeu
  (`setAway('platform')` dans `src/lib/sound.ts`, qui suspend le contexte
  audio) ; le bouton muet du jeu ne peut pas le rallumer.
- **Sauvegarde (module Data)** : `restoreSavedProgress` relit au démarrage, dans
  le SDK, profil, historique, avatar, tutoriel, mots révélés, thème, son et
  langue ; la copie du SDK l'emporte, une clé qu'il n'a pas lui est confiée une
  fois. Ensuite toute écriture de ces clés dans `localStorage` est recopiée au
  SDK (patch de `Storage.prototype`, limité à `localStorage` et à ces clés).
  L'historique est rogné à ses parties les plus récentes pour rester sous
  900 Ko (le module refuse au-delà de 1 Mo). Si le module est désactivé
  (« Progress Save » non coché à la soumission), le premier refus coupe la
  recopie et le jeu garde `localStorage` seul.
- **CSS** (`src/crazygames.css`) : `user-select: none` et pas de menu au long
  appui sur `body` (le champ de réponse reste sélectionnable), pas de
  défilement qui se propage à la page du portail.

## Exigences CrazyGames (relevées le 7 octobre 2026)

Sources : docs.crazygames.com, pages *Requirements* (intro, technical,
gameplay, ads, account integration, game covers, quality) et *SDK* (intro,
game, video ads, data, user).

**Basic Launch / Full Launch.** Une Basic Launch passe sans adaptation : SDK
facultatif, monétisation désactivée, pas de pub externe, pas de connexion
externe, QA visuelle de base, PEGI 12. La Full Launch, si le jeu est retenu,
exige le SDK avec `gameplayStart/Stop`, le module Data si le jeu sauvegarde,
les pubs du SDK selon leurs règles, et que le joueur arrive dans la partie
directement (un clic au plus). Ce build vise déjà la Full Launch.

**Technique.**
- Total ≤ 250 Mo, ≤ 1 500 fichiers ; téléchargement initial ≤ 50 Mo (mesuré
  jusqu'au premier `gameplayStart`), ≤ 20 Mo pour la page d'accueil mobile ;
  temps jusqu'à la partie ≤ 20 s.
- Chemins relatifs uniquement.
- Chrome et Edge ; Safari désactivé si le jeu y marche mal ; Chromebook 4 Go.
- Souris et clavier, tactile si mobile. Desktop jouable en paysage ; portrait
  admis (bandes sur les côtés), surtout pour un jeu mobile. Le portail gère
  l'orientation, le jeu n'a pas à la verrouiller.
- `user-select: none` sur `body` ; marges de sécurité dans l'app CrazyGames ;
  iOS : `AudioContext.resume()` dans un geste (le jeu le fait déjà, `armSound`).
- Données personnelles hors SDK → notice CGU / confidentialité (sans objet ici).

**Jeu.** Lisible à `devicePixelRatio` 1, de 800×450 à 1920×1080 ; anglais
obligatoire, traductions de qualité, langue prise dans `systemInfo.locale` avec
repli anglais ; pas de bouton plein écran maison ; aucun lien vers d'autres
plateformes ni stores d'apps (seuls communauté, page CrazyGames, même série,
CGU/confidentialité) ; contenu PEGI 12 ; jeu original.

**Pubs.** Uniquement celles du SDK. Midgame : au plus une toutes les 3 min
(géré par le SDK), aux pauses logiques, jamais pendant le jeu ni depuis un
bouton de navigation. Rewarded : optionnelle, jamais enchaînée, récompense
sur `adFinished` seulement. Bloquer l'interface pendant la pub, couper le son
seulement quand elle démarre, continuer normalement sur `adError`. Ne jamais
pénaliser un bloqueur de pub.

**Comptes.** Pas de connexion externe (Google, Facebook, e-mail) ; jouer en
invité doit être le chemin principal ; progression liée au compte CrazyGames
via le module Data (préféré) ou le module User.

**Module Data.** Même API que `localStorage`, 1 Mo au plus, synchronisé pour
un joueur connecté ; doit être activé à la soumission (« Progress Save »),
sinon `dataModuleDisabled`.

**Couvertures.** Trois images obligatoires : paysage 1920×1080 (16:9),
portrait 800×1200 (2:3), carré 800×800 (1:1). Même visuel sur les trois ; le
titre seul comme texte ; ni bordure, ni icône, ni logo de store ; pas de flou.
Vidéos (facultatives à la soumission) : 15–20 s, 50 Mo max, paysage 1080p et
portrait 1080p, sans son, sans écran noir ni texte promotionnel, première image
= la couverture.

**Qualité (recommandé).** Arriver vite dans la partie, onboarding court et
sautable ; éviter les touches à comportement navigateur (Échap quitte le plein
écran) — d'où Tab, et non Échap, pour passer un mot ; volume homogène.

## Ce qui reste hors de portée

- La notoriété « de la foule » qui module le tirage et la rareté n'existe pas
  hors ligne : le tirage s'appuie sur les dictionnaires seuls, comme un défi.
