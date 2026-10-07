# Audit — une version Reddit (Devvit Web)

7 octobre 2026 · révision `2f066a1` · **lecture seule : aucune ligne de jeu modifiée**.

La question : peut-on faire de Lettre Minute un jeu jouable dans un post Reddit, et à quel prix ?
Réponse courte : **oui, et le jeu s'y prête mieux que la plupart** — à condition de ne pas porter
l'app, mais d'en tirer un **puzzle quotidien** : une graine par jour, la même pour tout Reddit,
un classement du post, et les mots que personne d'autre n'a trouvés en vedette.

## Méthode

- Plateforme : documentation Devvit lue dans son dépôt source (`reddit/devvit-docs`, commit du
  5 octobre 2026, release 0.14.7), paquets npm `@devvit/*` 0.14.7, template React officiel, centre
  d'aide Reddit (Developer Funds H2 2026, mis à jour le 7 octobre). Les chemins `docs/…` ci-dessous
  sont relatifs à `https://developers.reddit.com/docs/`.
- Code : inventaire des couplages (domaine, `cloud.ts`, `native.ts`, `App.tsx`, dictionnaires,
  bundle), avec références `fichier:ligne`.
- **Rien n'a été lancé sur Reddit** : ni `devvit playtest`, ni essai du clavier dans l'app Reddit.
  Ce qui en dépend est marqué « à vérifier » et constitue la phase 0.

## Cinq constats structurants

1. **Le domaine part tel quel.** `src/domain/` (9 125 lignes hors tests) n'importe ni React, ni le
   DOM, ni Supabase, et ne lit jamais l'horloge ni le hasard (`rng.ts` déterministe). La partie
   (`run.ts`), le tirage (`unlocks.ts:112` `dealLineup`), la tolérance de frappe (`words.ts`), le
   règlement à plusieurs avec bonus de mot unique (`challenge.ts:124`, ×1,25), les trophées et la
   course rejouée (`scoreAt`) sont exactement les briques d'un quotidien. C'est le dividende des
   règles de `CLAUDE.md` : il se touche ici.
2. **Tout le reste est à réécrire, et c'est voulu.** `cloud.ts` a 81 fonctions sur Supabase (comptes,
   amis, défis, duel, modération, push…), `native.ts` 544 lignes de Capacitor, `App.tsx` 2 167 lignes
   et ~60 `useState`. Sur Reddit, l'identité est donnée (`context.userId`/`username`), le stockage
   est un Redis **isolé par subreddit**, le client ne peut appeler que son propre `/api/…` (CSP), et
   le serveur ne vit que le temps d'une requête (Node 24, bundle CommonJS). Porter `App.tsx` serait
   plus long que d'écrire une coquille de 5 écrans.
3. **Le format qui marche sur Reddit est celui que le jeu sait déjà faire.** Les jeux qui tiennent
   (r/Pixelary, r/syllo, r/Sections, Daily Guess, Wordseekr — `docs/guides/best-practices/community_games`)
   sont quotidiens, courts, asynchrones, avec série et classement du jour. Le défi entre amis
   (même graine, mêmes catégories, `createRun({shared: true})`) **est** un quotidien à l'échelle du
   post. Le « Petit Bac à l'envers » (un mot que personne n'a trouvé rapporte plus) devient le
   sujet de conversation des commentaires.
4. **Trois contraintes de plateforme dictent l'écran.** (a) Le post **inline** (dans le fil) ne
   tolère que le tap : aucun défilement capturé, aucun `touch-action: none` sur la racine
   (`docs/guides/best-practices/scroll-traps`), et doit charger en < 1 s — donc un écran d'accueil
   sans dictionnaire. (b) La partie se joue en **expanded** (plein écran mobile,
   `requestExpandedMode`) : le clavier y est indispensable et **rien ne documente son comportement
   dans l'app Reddit** — c'est le risque n° 1. (c) `localStorage` est **vidé à chaque version
   publiée** : toute progression vit dans Redis.
5. **Reddit interdit de renvoyer vers l'app Android.** `docs/devvit_rules` : pas de « link out »,
   pas de promotion de la même app sur une autre plateforme, pas de compte à créer ailleurs. La
   version Reddit est un **produit à part entière**, pas un tunnel d'acquisition pour le Play Store.
   C'est la décision qui conditionne tout le reste (voir « À trancher »).

---

## Ce qu'offre la plateforme (à jour au 7 octobre 2026)

| Sujet | Fait | Source |
|---|---|---|
| Structure | `src/client` (webview, React/Vite) + `src/server` (Hono/Express, routes `/api/*`) + `devvit.json` | `capabilities/devvit-web/devvit_web_overview` |
| Template | `reddit/devvit-template-react` : Hono, Vite 8 + `@devvit/start/vite`, React 19 ; entrée inline `splash.html`, entrée `game.html` | GitHub, 5 oct. 2026 |
| CLI | `npx devvit init`, `npm run dev` → `devvit playtest` (crée `r/<app>_dev`), `devvit upload`, `devvit publish`, `devvit install`, `devvit logs` | `guides/tools/devvit_cli` |
| Post quotidien | `reddit.submitCustomPost({ entry, postData })` depuis un cron du scheduler ; `postData` ≤ 2 Ko | `capabilities/server/scheduler`, `post-data` |
| Requêtes | 30 s max, 4 Mo en entrée, 10 Mo en sortie | `devvit_web_overview` |
| Redis | 5 Go par installation, 5 Mo par requête ; chaînes, hashes, **sorted sets**, transactions ; pas de listes ni de scan | `capabilities/server/redis` |
| Assets client | ≤ 1 Go au total (code du CLI) ; nos 3,9 Mo d'anglais passent sans souci | `@devvit/cli` `AssetUploader` |
| Réseau | client : rien hors `/api` ; serveur : domaines déclarés **et approuvés** ; Supabase « avec exceptions », révocable | `capabilities/server/http-fetch-policy` |
| Identité | `userId`, `username`, `snoovatar`, `postId`, `loid` (non connecté), plateforme | `@devvit/shared-types` `baseContext` |
| Actions au nom du joueur | `submitComment` (`runAs: 'USER'`) sur bouton explicite ; un score partagé = commentaire du joueur sous le commentaire épinglé | `capabilities/server/userActions`, `devvit_rules` |
| Temps réel | canaux `realtime`, 1 Mo/message, 100 msg/s | `capabilities/realtime/overview` |
| Push | bêta fermée, jeux déjà établis seulement | `capabilities/notifications` |
| Langue | **aucune locale exposée** ; `Subreddit.language` côté serveur ; `navigator.language` non vérifié | types `@devvit/*` |
| Revue | 1–2 jours ouvrés par version (~1 semaine pour une nouvelle app) ; README non générique ; suppression des données à `onPostDelete` obligatoire | `guides/launch/launch-guide`, `devvit_rules` |
| Son | jamais sans geste, bouton muet obligatoire, coupure sur `visibilitychange` | `view_modes_entry_points` |

### Argent

- **Developer Funds H2 2026** (1ᵉʳ août → 31 déc.) : un « engagé qualifié » est un utilisateur
  **connecté**, unique par jour, dans un subreddit SFW d'au moins 300 actifs par semaine. Palier
  d'entrée **5 000 engagés/jour** (moyenne 7 j) → 4 000 $ une fois, puis un versement mensuel
  (10 000/jour ≈ 555 $/mois). Installations : 50/250/1 000 subreddits → 500/1 000/2 000 $.
  Le « jusqu'à 167 000 $ » encore cité par les guides est **périmé** (programme H1).
- **Payments** : produits en Reddit Gold (5 à 2 500), 0,01 $ par gold au développeur ; la France
  est éligible (18 ans, Persona + Stripe Connect). La doc se contredit sur un statut « pilote ».
- Lecture honnête : 5 000 joueurs connectés **par jour** est un vrai jeu à succès. Le financement
  n'est pas un plan, c'est un bonus si le format prend. Pas de pub possible (pas de ciblage, CSP).

---

## Proposition de produit

**Un post par jour, à minuit UTC, dans r/<NomDuJeu>.** Le splash inline montre la lettre du jour
masquée, les cinq catégories, le nombre de joueurs et le meilleur score ; un bouton « Jouer »
passe en plein écran.

- **La partie** : 60 s, cinq catégories du jour tirées sur le catalogue complet (pas les
  catégories possédées), **sans pouvoirs** — tout le monde joue la même chose. Une seule partie
  comptée par joueur et par jour ; les suivantes sont « pour le plaisir », hors classement.
- **Le bilan** : score, mots un par un, puis le classement du post et, une fois joué, les mots
  **que toi seul as trouvés** (bonus ×1,25 du défi). Bouton « Partager dans les commentaires »
  qui poste, au nom du joueur, une grille sans spoiler (paliers en carrés de couleur, façon Wordle).
- **Le lendemain** : l'app épingle sous le post de la veille les mots les plus rares trouvés et
  ceux que personne n'a trouvés (« Personne n'a pensé à… »). C'est le contenu de discussion.
- **La série** : jours consécutifs joués, affichée en flair (`setUserFlair`) — la seule
  progression visible hors du post.

Ce qui reste dehors au lancement : comptes, amis, défis, duel, avatars, pouvoirs, modération,
mots proposés, Premium. Chacun a une version Reddit possible plus tard (voir phase 3) ; aucun
n'est nécessaire pour savoir si le format prend.

### Équité du score — un point à corriger dans le domaine

Aujourd'hui un défi humain compte encore la rareté avec l'usage personnel et la foule
(`App.tsx:848`, `judgeFor`) : deux joueurs qui écrivent le même mot n'ont pas les mêmes points.
Pour un quotidien, il faut un `Judge` **sans usage** (comme celui des robots,
`src/state/botRuns.ts:16`) : la rareté ne vient alors que de la notoriété embarquée, identique sur
chaque appareil. La foule s'exprime **après coup**, par le bonus de mot unique réglé sur le post.

### Langue

Reddit est d'abord anglophone, et Redis est isolé par subreddit : **une installation par langue**.
Recommandation : lancer en **anglais** (113 000 mots, la seule langue qui peut viser le seuil des
Funds), puis le français sur un second subreddit avec la même app. La langue se règle par
installation (paramètre d'app ou `Subreddit.language`), pas par `navigator` : un post doit avoir la
même partie pour tous ses lecteurs.

---

## Architecture cible

```
secondes/
  src/domain/        ← partagé, inchangé (+ daily.ts)
  src/data/words/    ← partagé, servi en assets statiques
  src/i18n/          ← partagé (sous-ensemble de clés)
  reddit/            ← nouveau projet Devvit (devvit.json, package.json à lui)
    src/client/splash.tsx   inline, < 1 s, aucun dictionnaire
    src/client/game.tsx     expanded : annonce → partie → bilan
    src/server/index.ts     Hono, /api/* + /internal/* (cron, triggers)
```

- **Client** : Vite avec alias vers `../src/domain`, `../src/data`, `../src/i18n`. `RunScreen`
  (`src/ui/RunScreen.tsx`, 625 l.) se réutilise : il ne prend que des props, et ses dépendances
  plateforme (`tapFeedback` de `native.ts`) ne font rien hors Capacitor — à remplacer par un
  module vide pour ne pas embarquer Capacitor. `CountdownScreen` aussi. `OverScreen` non : il tire
  comptes, pub, offres, défis (30 imports) — un `DailyOver` neuf, plus court.
- **Styles** : `src/styles.css` (120 Ko) contient tout le jeu ; extraire les sections utiles ou
  l'importer entier en expanded seulement. Police Jost embarquée (CSP).
- **Son** : `src/lib/sound.ts` est synthétisé, sans fichier : il part tel quel. Ajouter la coupure
  sur `visibilitychange` exigée par la revue (existe en partie, à vérifier) et un muet visible.
- **Serveur** : Redis seul, **pas de Supabase** au lancement (approbation révocable, données hors
  Reddit, une politique de confidentialité en plus). Clés par post :
  - `day:<postId>` hash : graine, catégories, date ;
  - `board:<postId>` sorted set : score par `userId` ;
  - `play:<postId>:<userId>` hash : mots (format `challengeWordsOf`), score, horodatage ;
  - `words:<postId>` hash : `catégorie:clé` → nombre de joueurs (mots uniques, top du lendemain) ;
  - `streak:<userId>` hash : dernier jour joué, série, record.
- **Confiance** : le client calcule, le serveur vérifie ce qu'il peut sans dictionnaire (une partie
  par jour, mots plausibles en nombre et en longueur, score borné par `(10 + 20) × 1,9` par mot).
  Rejouer la partie côté serveur avec le domaine est possible plus tard (5 catégories embarquées
  dans le bundle serveur) ; inutile tant qu'il n'y a ni argent ni prix en jeu.
- **Données** : `onPostDelete` efface les clés du post ; `onCommentDelete` sans objet tant que
  l'app ne stocke pas de commentaires. Requis par les règles.

---

# Backlog

Effort : **S** ≈ une session courte · **M** ≈ une demi-journée · **L** ≈ chantier, à découper.
Les fichiers listés sont le périmètre d'écriture de chaque fiche. Rien ici ne touche `App.tsx`,
`HomeScreen.tsx` ni les fichiers aujourd'hui modifiés par une autre session.

## Phase 0 — Lever les risques (go / no-go)

| # | Tâche | Périmètre | Effort | Risque levé |
|---|---|---|---|---|
| R0 | **Créer le compte développeur et le projet** : `npx devvit init --template react` dans `reddit/`, `npm run dev`, voir le post de test dans `r/<app>_dev`. Demande le login Reddit de Jérémy. | `reddit/**` | S | Outillage |
| R1 | **Le clavier dans l'app Reddit** : un champ en expanded, testé sur l'app Android et iOS de Reddit et sur le web mobile — le clavier s'ouvre-t-il, cache-t-il le champ, `Entrée` arrive-t-il, l'autocorrection s'éteint-elle (`autocorrect`, `autocapitalize`, `spellcheck`) ? | `reddit/src/client/` | S | **Le jeu entier** |
| R2 | **Le domaine compile dans le projet Devvit** : alias Vite vers `../src/domain`, une partie jouée contre un pack chargé en asset (`animaux` anglais, 2,6 Mo) ; mesurer le temps de chargement en expanded sur téléphone. | `reddit/vite.config.ts`, `reddit/src/client/` | S | Build, poids |
| R3 | **Splash inline < 1 s, sans piège de défilement** : un écran statique + bouton qui appelle `requestExpandedMode`, vérifié contre la liste de `scroll-traps`. | `reddit/src/client/splash.tsx` | S | Revue |

**Acceptation** : une partie de 60 s se joue au clavier sur l'app Reddit Android, de l'accueil au
score. Si R1 échoue (clavier inutilisable), arrêter là : une saisie par boutons de lettres
changerait le jeu.

## Phase 1 — Le quotidien jouable (MVP)

| # | Tâche | Périmètre | Effort |
|---|---|---|---|
| D1 | **`src/domain/daily.ts`** : graine et catégories d'un jour à partir de sa date (`2026-10-08` → graine), sur le catalogue complet, + `Judge` sans usage ; tests de stabilité (même date = même partie, sur tout appareil). | `src/domain/daily.ts`, `.test.ts`, `src/state/judge.ts` (export seulement) | S |
| D2 | **Cron quotidien** : `/internal/cron/daily` crée le post (`submitCustomPost`, `postData` = date), épingle un commentaire « Partage ton score ici ». Action de menu modérateur « Créer le post du jour » en secours. | `reddit/devvit.json`, `reddit/src/server/` | M |
| D3 | **API** : `GET /api/day` (partie du post, classement, déjà joué ?), `POST /api/play` (une fois par joueur, contrôles de vraisemblance, transaction Redis), `GET /api/board`. | `reddit/src/server/` | M |
| D4 | **Coquille client** : splash → annonce (`CountdownScreen`) → `RunScreen` → `DailyOver` (score, mots, rang, mots uniques). Stub de `native.ts`. | `reddit/src/client/**` | L |
| D5 | **Partager** : bouton qui poste, au nom du joueur, la grille sans spoiler sous le commentaire épinglé (`runAs: 'USER'`). | `reddit/src/server/`, `DailyOver` | S |
| D6 | **Non connecté** : jouable, score non enregistré, `showLoginPrompt()` au bilan ; le résultat attend en `localStorage` et s'envoie à la connexion. | client + `/api/play` | S |
| D7 | **Son et accessibilité Reddit** : muet visible, coupure `visibilitychange`, pas de son avant geste. | `reddit/src/client/` | S |
| D8 | **i18n** : sous-ensemble de clés pour les écrans du quotidien, anglais + français ; langue = paramètre d'installation. | `src/i18n/*` (clés `daily.*`, 7 fichiers) | S |
| D9 | **Conformité** : README de l'app (règles, données stockées), `onPostDelete` qui efface, pas de lien vers Play. | `reddit/README.md`, serveur | S |

**Acceptation** : sur `r/<app>_dev`, deux comptes jouent le même jour, voient le même couple
lettre + catégorie, le même classement, et le mot que l'un seul a trouvé porte son bonus.
`npm run check` vert à la racine (domaine) ; `devvit upload` passe.

## Phase 2 — Rétention

| # | Tâche | Effort |
|---|---|---|
| E1 | Série de jours joués + flair automatique (`🔥 12`). | S |
| E2 | Commentaire de l'app sur le post de la veille : mots les plus rares, « personne n'a pensé à… ». | M |
| E3 | Classement de la semaine (somme des 7 jours) dans le splash. | S |
| E4 | Rejouer les jours passés (hors classement), depuis les anciens posts. | S |
| E5 | Course rejouée au bilan (`scoreAt`) : ta course contre le premier du jour. | M |

## Phase 3 — Communauté (si la phase 2 tient)

| # | Tâche | Effort |
|---|---|---|
| C1 | **Mot manquant** proposé au bilan → file pour les modérateurs du subreddit (action de menu) ; accepté, il vit dans Redis et entre au prochain import. Rester fidèle à la règle : un mot du serveur n'entre pas dans le tirage. | L |
| C2 | **Défi du jour lancé par un joueur** : un post utilisateur avec sa propre graine et ses catégories (UGC, à la Pixelary). | M |
| C3 | **Duel en direct** sur `realtime` : le journal de coups (`duelLog.ts`) est déjà ce qu'il faut transmettre. | L |
| C4 | Pouvoirs en mode libre (hors quotidien) avec progression stockée dans Redis. | L |
| C5 | Achat en Gold (thème, catégorie bonus) — seulement après avoir lu les Earn Terms. | M |

## Lancement

1. App **non listée**, installée sur son propre subreddit (r/<NomDuJeu>, et r/LettreMinute pour le
   français), comme r/Pixelary.
2. Deux semaines de quotidien sans faute, puis le formulaire de featuring
   (`docs/guides/launch/feature-guide` : premier écran sur mesure, mobile et desktop, aucun scroll
   en inline ; critères CTR, rétention J1/J3).
3. Icône, visuel et tuile pour le catalogue (`docs/guides/launch/in-app-assets`) — l'affiche
   bauhaus de l'accueil s'y prête.

---

## À trancher par Jérémy

1. **La version Reddit est-elle un produit à part, sans renvoi vers Android ?** Les règles ne
   laissent pas le choix ; si le but était d'abord d'amener des joueurs au Play Store, le projet
   ne le sert pas.
2. **Le nom anglais** (Letter Minute ? One Letter ? autre) et celui du subreddit.
3. **L'anglais d'abord**, ou le français d'abord sur un petit subreddit pour roder ?
4. **Pas de Supabase au lancement** : les classements Reddit et ceux de l'app restent séparés.
5. **Où vit le code** : `reddit/` dans ce dépôt (partage direct du domaine, recommandé) ou un
   dépôt à part qui copie le domaine.

## Incertitudes

- Clavier mobile dans l'app Reddit : non documenté, d'où R1.
- En-têtes `devvit-accept-language` / `devvit-accept-timezone` présents dans les paquets mais non
  documentés : ne pas s'appuyer dessus.
- Doc contradictoire sur les transactions Redis concurrentes (20 ou 30) et sur le statut pilote
  des paiements.
- Pas de chiffre publié sur la mémoire du serveur ni les démarrages à froid : à mesurer en R2.
