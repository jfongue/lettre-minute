# CLAUDE.md

Repère pour un LLM qui reprend ce dépôt à froid.

## À lire d'abord

- [`README.md`](README.md) — le jeu, le barème, les commandes, l'architecture
- [`supabase/README.md`](supabase/README.md) — schéma et conventions RLS

Source de vérité ; ne pas les dupliquer ici, seulement les compléter par ce
qu'un nouvel arrivant casserait sans le savoir.

## Pièges connus

- **`src/domain/` n'a aucune dépendance vers React, le DOM ou Supabase**, et doit
  le rester : c'est ce qui le rend testable et rejouable à l'identique depuis sa
  graine. Toute nouvelle règle s'y écrit d'abord, avec ses tests. Le dictionnaire
  et les compteurs d'usage lui sont injectés par un `Judge` (`src/state/judge.ts`),
  jamais importés.
- **La graine et l'horloge viennent de l'interface**, jamais du domaine : aucun
  `Math.random` ni `Date.now` sous `src/domain/`.
- **`inspect()` juge une réponse sans la jouer** : c'est lui que le champ appelle
  à chaque frappe. `submit()` rejoue le même verdict avant de l'encaisser — les
  deux ne doivent jamais diverger, sous peine d'un mot affiché valide et refusé
  à la validation.
- **Un couple lettre + catégorie se tire selon ses mots *connus***
  (`knownByLetter`, célébrité absolue ≥ `KNOWN_FAME`) : un seul suffit pour
  qu'il sorte, et ses chances croissent comme le logarithme de leur nombre —
  Z + Pays sort, rarement ; les « République de… » ne font pas de R la seule
  lettre des pays. Pas le rang de `notoriety` : parmi 23 000 animaux, il
  sacre les quiscales. Un couple de moins de `THIN_PROMPT_WORDS` mots connus
  ne revient pas dans la même partie, et ce verrou passe avant le changement
  de catégorie. Il n'y a plus de jeu de lettres par langue : c'est le
  dictionnaire qui dit quelles lettres existent.
- **Les dictionnaires sont des tableaux JSON positionnels chargés à la
  demande** (`src/data/packs.ts`, type `WordRow`). Un objet par mot, avec ses
  clés répétées des dizaines de milliers de fois, doublerait la charge utile ; les tableaux ne
  coûtent que 4 % de plus que du texte une fois compressés. Et tout charger au
  démarrage fait payer au joueur les catégories qu'il n'a pas débloquées.
- **Une catégorie du catalogue sans fichier de mots est écartée du tirage**
  (`src/App.tsx`) : ajouter une entrée à `CATALOGUE` ne suffit pas, il faut
  lancer `npm run import:words` et commiter le `.json`.
- **Le Wiktionnaire est la source des noms communs**, Wikidata celle des
  entités : Wikidata connaît cinquante races de chat mais pas « abeille ». Une
  catégorie de noms communs bâtie sur Wikidata seul laisse dehors les réponses
  évidentes. Hors français, ce sont les catégories thématiques du Wiktionary
  anglais, lues dans le dump Wiktextract (kaikki.org) avec les formes
  fléchies. Leur liste est choisie à la main (`TOPICS`, `scripts/languages.ts`) :
  l'arbre des thèmes dérive — « Occupations » contient les Beatles —, seuls
  les taxons animaux prennent leurs sous-catégories.
- **Le dictionnaire suit la langue de l'interface**, et le serveur ne connaît
  pas les langues : `cloud.ts` préfixe mots et catégories (`de:animaux`) pour
  que rareté, découvertes et mots proposés restent dans leur langue. Le
  français garde les noms nus sous lesquels ses lignes existent déjà.
- **L'import Wikidata est fragile par nature** : les requêtes lourdes (taxons)
  dépassent la limite serveur, et les réponses JSON reviennent parfois tronquées
  à un mégaoctet. D'où le cache par source sous `.cache/pulls`, le repli CSV à la
  troisième tentative, et la reconstruction d'une catégorie sur les sources qui
  ont répondu. Un identifiant de taxon se vérifie auprès de l'API Wikidata avant
  d'être écrit dans `scripts/sources.ts` — une classe inexistante renvoie zéro
  ligne sans erreur.
- **Les sitelinks ne mesurent pas la notoriété** : des robots ont écrit un
  article en quarante langues pour chaque espèce et chaque commune. Ils ne
  servent que de repli ; la notoriété vient de wordfreq et des visites de
  la Wikipédia de la langue (clickstream mensuel). Un mot sans article doit être écrit avec
  zéro visite, pas sans champ : un champ absent fait retomber le domaine sur
  les sitelinks.
- **Les pages vues ne se demandent pas article par article** : 45 000 appels à
  l'API font bannir l'adresse (429) bien avant la fin. Le clickstream se
  télécharge d'un bloc ; seule la résolution libellé → article passe par l'API,
  cinquante titres par appel, en séquentiel et en cache
  (`.cache/frwiki-articles-v2.json`, `.cache/<langue>wiki-articles.json`). Le
  clickstream anglais pèse un demi-gigaoctet compressé : il se lit en flux, en
  ne gardant que les titres cherchés.
- **Toute régénération des dictionnaires passe par `src/data/words.test.ts`** :
  un mot évident perdu (« shark » que le Wiktionary range sous Sports) se
  rajoute dans `ADDED_WORDS`, pas en retouchant le `.json`, que le prochain
  import écraserait. `acceptable` doit accepter tout l'alphabet latin : le
  Latin-1 seul jetait « cœur », « œil » et chaque « maître d’hôtel ».
- **Un mot accepté par les modérateurs n'est embarqué qu'au prochain import**
  (`scripts/community-words.ts`, via `supabase db query --linked`) : jusque-là
  il n'existe que chargé du serveur, donc ni hors ligne ni en défi. Commiter
  `scripts/community-words.json` avec les `.json` : c'est lui que relit un
  import sans accès au projet.
- **Un alias Wikidata de pays court est un code** (`shortestAlias`), et une
  catégorie de noms (`names`) ne fléchit pas : leurs « formes » sont celles
  d'un homographe. Deux lignes qui se compactent pareil n'en font qu'une
  (le domaine ne garde que la première) : l'import choisit laquelle.
- **La fréquence wordfreq se cherche à l'orthographe exacte**, accents compris :
  repliée comme `normalizeWord`, « aï » (le paresseux) lit « ai ». Et elle ne
  vaut que pour un mot attesté dans la catégorie par le Wiktionnaire, ou
  décrit par au moins cinquante Wikipédias — sinon « Mars » poisson prend la
  fréquence du mois.
- **Une forme fléchie porte la clé du mot qu'elle fléchit** (`WordEntry.key`).
  C'est ce qui empêche « chat » puis « chats » de marquer deux fois dans la même
  partie — et ce qui fera la même chose pour « USA » et « États-Unis ». Toute
  comparaison de mots joués passe par cette clé, jamais par la forme tapée.
- **`findWord` refuse de deviner** : si deux mots de la catégorie sont à une
  lettre de ce qui a été tapé, la réponse est rejetée plutôt qu'arbitrée. La
  tolérance ne s'applique pas non plus sous quatre lettres. Sans ces deux
  garde-fous, elle transforme le jeu en distributeur de points.
- **La recherche approchée tourne à chaque frappe** : elle ne scanne que les
  mots de la bonne initiale, filtrés par longueur (0,005 ms sur les 23 000
  animaux). Toute évolution qui la ferait parcourir le dictionnaire entier est à
  refuser — c'est le chemin chaud de l'interface.
- **La notoriété est calculée au chargement du dictionnaire**
  (`rankNotoriety`), pas à la volée : c'est un rang dans la catégorie, donc elle
  dépend de l'ensemble du fichier et ne peut pas se déduire d'une entrée seule.
- **Le chrono se recalcule depuis `Date.now()` à chaque frame**, pas en cumulant
  le delta : un onglet en arrière-plan suspend `requestAnimationFrame` mais pas
  l'horloge murale.
- **Tout appel à `src/lib/cloud.ts` répond par une valeur de repli** plutôt que
  de lever : le jeu doit rester jouable sans projet Supabase, et une panne de
  synchronisation ne coûte qu'un classement périmé.
- **L'app mobile embarque `dist/` tel quel** : un changement web n'y arrive
  qu'après `npm run android:sync`. Tout ce qui touche au téléphone passe par
  `src/lib/native.ts`, qui ne fait rien dans un navigateur — un plugin
  Capacitor appelé ailleurs lève sur le web.
- **Pas de lien relatif vers une autre page dans l'app mobile** : il ferait
  quitter le jeu à la WebView sans retour possible. D'où `VITE_PRIVACY_URL`,
  une adresse complète ouverte hors de l'app.
- **Les avatars et couleurs gagnés ne sont stockés nulle part** : ils se
  déduisent du profil (`src/domain/avatar.ts`). Changer un seuil redistribue
  donc les déblocages de tout le monde, y compris vers le bas ; l'avatar porté
  reste valide même s'il redevient verrouillé.
- **Le compte connecté survit hors ligne** : `fetchAccount` rend
  `'unreachable'` quand le serveur ne répond pas, distinct de `null` (aucune
  session sur l'appareil), et l'interface garde alors le compte mis en cache
  (`loadAccount`). Sur téléphone, la session Supabase vit dans les
  préférences natives (`authStorage`, `src/lib/native.ts`), pas dans le
  localStorage de la WebView que le système peut reprendre.
- **Se connecter doit attendre l'envoi de la partie** (`pushing` dans
  `src/App.tsx`) : la fusion déplace les parties du compte anonyme puis
  l'efface, et une partie encore en vol partirait avec lui.
- **La pub se prépare avant l’offre qui la porte** (`adsDue`,
  `src/domain/unlocks.ts`) : consentement et chargement prennent des secondes,
  et une pub pas encore chargée au moment du choix est sautée plutôt que
  montrée en retard. Le choix est encaissé avant la pub : fermer l’app pendant
  qu’elle joue ne coûte pas la catégorie. Sans `VITE_ADMOB_INTERSTITIAL_ID` ni
  `admobAppId` (`android/gradle.properties`), le build sert les pubs de test de
  Google — ne jamais cliquer sur les vraies depuis son propre téléphone.
- **Demontoon est ajouté côté client** (`completeBoards`, `src/domain/boards.ts`),
  pas en base : il ne figure qu'aux classements de score, et disparaît dès que
  le compte de ce nom a une vraie partie sur la période.
- **Une découverte se juge contre les sept jours qui précèdent la partie**, pas
  contre la semaine calendaire : un mot écrit dimanche soir n'est plus une
  découverte lundi matin.
- **Le thème forcé passe par `data-theme` sur `<html>`**, posé avant le premier
  rendu (`src/main.tsx`) : chaque jeton sombre de `styles.css` existe donc en
  deux blocs (média et attribut), à tenir identiques.
- **Aucun texte d'interface en dur dans `src/ui/`** : tout passe par `useT()`
  (`src/i18n/`). `fr.ts` est la référence typée — une clé ajoutée là et
  oubliée dans une autre langue casse le build. Les noms français des
  catégories et des couleurs restent dans le domaine (`CATALOGUE`, `PALETTE`),
  que `fr.ts` relit ; les autres langues les traduisent par identifiant, et un
  test vérifie qu'aucune n'en oublie. Le domaine et `cloud.ts` rendent des
  identifiants (palier de rareté, `AuthError`), jamais des phrases.
- **Une réponse se compare sous sa forme compacte** (`compactWord`) : ni
  accents, ni espaces, ni ponctuation. `WordEntry.key` garde en revanche ses
  espaces, car c'est le nom sous lequel le serveur range les compteurs d'usage.
- **Le son ne révèle rien que l’écran ne montre** (`src/lib/sound.ts`) :
  pendant la frappe, il dit seulement « mot nommé » ou « à une lettre près » ;
  le palier de rareté ne s’entend qu’à la validation. Comme `cloud.ts`, le
  module ne lève jamais, et un navigateur n’ouvre le son qu’après un geste :
  `armSound()` réveille le contexte au premier toucher, un son demandé avant
  est perdu, la musique attend.
- **Les récompenses d'XP pour un mot proposé sont décidées côté serveur**
  (`accept_word`), jamais par le client — et depuis 0007, seules les fonctions
  du serveur peuvent l'appeler.
- **Les règles de modération vivent en SQL** (`settle_review`, 0007), pas dans
  le domaine : trois « correct », deux « incorrect », louche à deux « je ne
  sais pas ». `src/domain/moderation.ts` ne garde que ce que l'interface doit
  savoir (taille de session, lecture d'un glissement). La modération suit la
  langue de l'interface : un modérateur ne voit que les mots préfixés de la
  sienne.

- **Les pouvoirs sont des règles du domaine** (`src/domain/powers.ts`,
  `run.ts`), pas des effets d'interface : la partie porte ses pouvoirs et
  leurs charges (`Run.powers`, `Run.charges`). « Joker » et « chut » sont des
  sorts que `inspect()` juge comme n'importe quelle réponse (verdict `spell`),
  et seulement quand la catégorie ne connaît pas le mot — même déjà joué, un
  mot connu reste `already`. Leurs mots par langue viennent de l'i18n et
  passent par le `Judge`, comme les mots connus par lettre.
- **Divination montre ce qu'`advance` distribuera** : `nextPrompt()` ne dépend
  que de la graine et de `drawn`. Magie tire donc sa lettre sur un autre flux
  et ne touche pas à `drawn` — sinon l'aperçu mentirait.
- **Silence ne suspend pas `useElapsed`** : l'horloge murale continue, c'est
  `remainingSeconds()` qui rend le temps tenu (`heldSeconds`, au plus
  `HUSH_SECONDS`). Le son s'étouffe par un filtre sur le bus maître
  (`setHush`), musique comprise.
- **Permutation vit dans la session** (`swapsLeft`), pas dans la partie : un
  échange recrée la partie avec `createRun`, qui remettrait ses charges à zéro.
- **Pouvoirs possédés et portés restent sur l'appareil**, comme les
  catégories : le serveur ne garde que les totaux. Ils se déduisent du niveau
  (`powerPicksOwed`), donc un autre appareil se les voit simplement reproposer.

- **Un défi n'est équitable que si tout le monde tire les mêmes couples** :
  même graine, mêmes catégories, `avoid` vide, et pas de mots de la
  communauté dans le `Judge` (ils déplacent les lettres jouables et leurs
  poids). Permutation est écarté (`BARRED_POWERS`) : il changerait la liste.
  Toute règle de tirage nouvelle doit rester fonction de la graine et des
  dictionnaires embarqués seuls.
- **La partie d'un robot en défi n'existe que rejouée** (`withBotRuns`,
  `src/state/botRuns.ts`) : le serveur la marque jouée sans score ni mots, et
  chaque client la rejoue depuis la graine avec un `Judge` sans compteurs
  d'usage. Tout ce que `playBot` lit doit donc être identique sur chaque
  appareil — un changement de dictionnaire change aussi les parties de robot
  déjà jouées.
- **Une partie de défi ne passe jamais par `pushRun`** : `pushChallengeRun`
  l'envoie à son défi, hors classements et hors rareté, et
  `applyChallengeRun` ne touche ni au record ni à `lastPrompts`.

- **`VITE_PUSH_ENABLED=true` exige `android/app/google-services.json`** :
  sans Firebase dans le build, `PushNotifications.register()` fait planter
  l'app nativement au lieu d'échouer. Le texte des pushs vit dans la fonction
  Edge (`supabase/functions/push/messages.ts`), pas dans `src/i18n/` : il
  suit `challenge.invitePop` et `challenge.overPop`, à tenir alignés.

## Conventions

- Contenu du jeu (catégories, textes d'interface) en français, avec apostrophe
  typographique (’) ; identifiants et code en anglais.
- Commentaires réservés au *pourquoi* non évident (contrainte cachée, invariant,
  contournement) — jamais au *quoi*, que les noms doivent déjà porter.
- Pas de gestion d'erreur pour des cas qui ne peuvent pas se produire côté
  domaine : la saisie du joueur, Wikidata et Supabase sont les seules frontières
  à valider.

## Planche debug

- **Tout écran difficile d'accès a son scénario dans `src/debug/DebugBoard.tsx`**
  (fin de partie avec offre, défi, offre de modérateur, notification…) : dès
  qu'on en crée un, on l'y ajoute. On l'ouvre par sept tapes rapides sur
  « Thème » dans les options, ou `#debug` sur le web, dans n'importe quel
  build. Elle montre les vrais composants avec des données inventées et
  n'écrit jamais sur le serveur : un écran qui appelle `cloud.ts` pour
  écrire reçoit une doublure en prop (`answerOffer` de `ModeratorOffer`),
  un écran qui charge lui-même ses données se découpe en chargeur + vue
  (`ChallengeScreen` / `ChallengeView`). Outil de développeur : ses
  libellés restent en français, hors de l'i18n.
