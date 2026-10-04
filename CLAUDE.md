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
- **Le tirage écoute aussi la foule** (`Judge.pull`, `src/domain/prompts.ts`) :
  un couple que les joueurs quittent sans rien écrire s'efface peu à peu, un
  couple qu'ils réussissent revient — jamais jusqu'à zéro, et jamais sur trois
  parties. Ce sont les compteurs de `prompt_stats`, que `pushRun` rapporte par
  partie (`promptOutcomes`, une fois par graine), avec les points et les mots
  que chaque couple a rendus — `debug_pairs` (0025) les lit, le tirage
  jamais. Là encore, **jamais un défi ni une
  partie de robot**, qui se rejouent sur chaque appareil et dont le tirage doit
  rester fonction de la graine et des dictionnaires embarqués seuls. Un couple
  à freiner à la main s'écrit dans `DAMPED_PROMPTS` (`src/domain/prompts.ts`),
  qui multiplie sa cote dans les parties seules. Un couple
  quitté se lit dans `Run.settled`, pas dans `dealt` — qui est un ensemble, et
  dont le dernier mot est encore à l'écran.
- **Les dictionnaires sont des tableaux JSON positionnels chargés à la
  demande** (`src/data/packs.ts`, type `WordRow`). Un objet par mot, avec ses
  clés répétées des dizaines de milliers de fois, doublerait la charge utile ; les tableaux ne
  coûtent que 4 % de plus que du texte une fois compressés. Et tout charger au
  démarrage fait payer au joueur les catégories qu'il n'a pas débloquées.
- **Une catégorie du catalogue sans fichier de mots est écartée du tirage**
  (`src/App.tsx`) : ajouter une entrée à `CATALOGUE` ne suffit pas, il faut
  lancer `npm run import:words` et commiter le `.json`.
- **Une catégorie en brouillon vit hors du jeu** (`DRAFT_SOURCES`,
  `scripts/sources.ts`, et `SOON`, `src/domain/catalogue.ts`) : elle est
  annoncée dans « Mes catégories » sous une étiquette « Bientôt… », mais
  `CATALOGUE` ne la liste pas, donc aucun tirage ne la distribue et aucun ban
  ne la vise. Ses dictionnaires sont sous `src/data/drafts/`, que ni `packs.ts`
  ni `words.test.ts` ne lisent, et
  `npm run import:words -- --lang=de --draft` la construit seule, sans lire
  aucun *pull* — le français depuis le Wiktionnaire français, les six autres
  langues depuis les thèmes du Wiktionnaire anglais (`TOPICS`,
  `scripts/languages.ts`), dont une entrée nouvelle périme le cache kaikki de
  chaque langue et fait relire tout son dump. C'est `src/data/drafts.test.ts`
  qui les garde — lignes bien formées, réponses évidentes trouvées dans chaque
  langue, assez de lettres connues pour le tirage, et la liste des brouillons
  exactement celle de `SOON`. La mettre en jeu demande une entrée de
  `CATALOGUE` et le déplacement de ses dictionnaires vers
  `src/data/words/<langue>/`.
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
- **Les villes ne viennent pas de Wikidata mais de GeoNames** (`largestCities`,
  `scripts/import-words.ts`) : le fichier `cities15000` porte déjà population et
  pays, là où les classes de ville de Wikidata laissent Paris et Berlin dehors.
  Chaque pays garde ses cinq plus grandes — dix au-dessus de
  `LARGE_COUNTRY_POPULATION` —, et les dix pays où le jeu se joue
  (`BIG_CITY_COUNTRIES`) gardent en plus toutes celles de `BIG_CITY_POPULATION`
  et plus : c'est ce qui fait sortir Villeurbanne, Coventry ou Sabadell. Cette
  extension est son propre *pull* (`big-cities`), pour que le jour où la liste
  des pays ou le seuil bouge, seule cette requête se repaie. La catégorie garde
  l'identifiant `capitales` sous lequel les profils et `prompt_stats` la
  connaissent, même si elle s'appelle « Grandes villes ».
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
- **Un mot signalé par un modérateur ne sort qu'au prochain import non plus**
  (0038, `scripts/banned-words.ts`, `scripts/banned-words.json`) : le
  dictionnaire est embarqué dans l'app, et le tirage d'un défi doit rester
  fonction de la graine et des dictionnaires seuls — un ban lu du serveur le
  ferait mentir. Le mot est jugé comme un ajout (`word_reviews.kind`), et
  l'import retire sa ligne et les formes qui le fléchissent. Commiter
  l'instantané avec les `.json`.
- **Une proposition vit à deux endroits** : la file de l'appareil
  (`loadSubmissions`) tant que le serveur ne l'a pas vue, puis
  `word_submissions`. Le bilan de fin de partie corrige et retire dans celui
  qui la détient — `amend_submission` refuse dès qu'un modérateur a voté — et
  `session.proposals` ne fait que l'afficher. Les mots que le joueur a
  lui-même fait entrer se lisent dans ses demandes acceptées
  (`fetchMySubmissions`), comparées en forme compacte : une marque discrète les
  signale en partie comme au bilan.
- **Un alias Wikidata de pays court est un code** (`shortestAlias`), et une
  catégorie de noms (`names`) ne fléchit pas : leurs « formes » sont celles
  d'un homographe. Deux lignes qui se compactent pareil n'en font qu'une
  (le domaine ne garde que la première) : l'import choisit laquelle.
- **Un alias Wikidata est une forme de son libellé** (`Row.of`), pas un mot :
  « USA » marque comme « États-Unis », « Samsung » comme « Samsung
  Electronics », et ne compte pas parmi les mots connus de sa lettre. Un
  alias dont le libellé est refusé l'est aussi. Villes et marques
  (`strictAliases`) n'en gardent qu'un qui commence comme le libellé : leurs
  alias sont des surnoms, des filiales et des codes OACI. Ce qui manque à
  Wikidata s'ajoute dans `ADDED_ALIASES`.
- **Wikidata range sous `mul` seul** le nom qui s'écrit pareil partout (Oslo,
  WhatsApp, PlayStation) : les requêtes de noms lisent le libellé de la langue,
  sinon celui-là (`scope.label`). Jamais pour un taxon, dont le `mul` est le
  binôme latin.
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
- **La pub est éteinte pour l’instant** (`ADS_ENABLED`, `src/domain/unlocks.ts`) :
  seule la demande de soutien du récapitulatif reste. Le reste de ce point vaut
  quand on la rallume.
- **La pub se prépare avant l’offre qui la porte** (`adsDue`,
  `src/domain/unlocks.ts`) : consentement et chargement prennent des secondes,
  et une pub pas encore chargée au moment du choix est sautée plutôt que
  montrée en retard. Le choix est encaissé avant la pub : fermer l’app pendant
  qu’elle joue ne coûte pas la catégorie. Sans `VITE_ADMOB_INTERSTITIAL_ID` ni
  `admobAppId` (`android/gradle.properties`), le build sert les pubs de test de
  Google — ne jamais cliquer sur les vraies depuis son propre téléphone.
- **Demontoon est ajouté côté client** (`completeBoards`, `src/domain/boards.ts`,
  et `completeLeaderboard` pour la page des classements, qui recompte les
  rangs), pas en base : il ne figure qu'aux classements de meilleure partie du
  jour et de la semaine, et disparaît dès que le compte de ce nom a une vraie
  partie sur la période.
- **Les joueurs maison sont hors classements** (0024, `bots`) : Maxitoon et
  Terretciel jouent toujours — la liste d'amis et les défis les lisent —, mais
  `leaderboard_board`, `leaderboard_stat` et la vue `leaderboard` les écartent
  par leur compte, jamais par leur nom, qu'un vrai joueur peut porter. Le seul
  score maison d'un tableau reste Demontoon, ajouté côté client.
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
  Hors partie, tout bouton clique et tout champ de texte tape par deux
  écouteurs globaux (`src/App.tsx`) : un champ qui joue ses touches lui-même
  (celui de la partie, du tutoriel) porte `data-keys`, sinon il sonne deux
  fois.
- **Les récompenses d'XP pour un mot proposé sont décidées côté serveur**
  (`accept_word`), jamais par le client — et depuis 0007, seules les fonctions
  du serveur peuvent l'appeler.
- **Les règles de modération vivent en SQL** (`settle_review`, 0007), pas dans
  le domaine : trois « correct », deux « incorrect », louche à deux « je ne
  sais pas ». `src/domain/moderation.ts` ne garde que ce que l'interface doit
  savoir (taille de session, lecture d'un glissement). La modération suit la
  langue de l'interface : un modérateur ne voit que les mots préfixés de la
  sienne.

- **Une file de modération courte se remplit toute seule** (`top_up_moderation`,
  0019, 0037) : ouvrir « Mes demandes » avec moins de cinq mots à juger
  complète la file à cinq depuis la réserve, super modérateur compris,
  proposés par un joueur maison. Ses mots
  (`scripts/moderation-reserve.json`) doivent manquer aux dictionnaires : un
  mot déjà connu ferait voter les modérateurs pour rien, le script le jette.
  **Un seul versement par heure, toutes langues confondues** (0023,
  `moderation_topup`) : l'heure ne ferme que le versement, jamais la
  modération — les mots versés restent à juger pour tout le monde —, et
  seul un versement non vide la referme. `src/App.tsx` ne rafraîchit
  qu'à un versement non nul : les autres découvrent ces mots à leur propre
  ouverture de l'écran.

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
  Seule exception, la partie envoyée emporte les pouvoirs qu'elle a joués
  (`runs.powers`, 0025) : le tableau de bord en tire « quels pouvoirs
  sortent » et ce qu'ils rapportent, et rien d'autre ne les relit. Une partie de robot ou de défi n'en porte aucun.

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

- **Le téléphone ne demande le droit de notifier qu'après une nouvelle
  amitié** (`pushOfferDue`, `src/state/pushOffer.ts`), et après la question
  du jeu (`PushOffer`) : `enablePush` enregistre sans jamais demander. Un
  « non » attend l'ami suivant.

- **`VITE_PUSH_ENABLED=true` exige `android/app/google-services.json`** :
  sans Firebase dans le build, `PushNotifications.register()` fait planter
  l'app nativement au lieu d'échouer. Le texte des pushs vit dans la fonction
  Edge (`supabase/functions/push/messages.ts`), pas dans `src/i18n/` : il
  suit `challenge.invitePop` et `challenge.overPop`, à tenir alignés.

- **Un blocage ne se dit jamais au bloqué** (`block_player`, 0014) : sa
  demande suivante répond `sent` sans rien écrire. Toute nouvelle façon
  d'atteindre un joueur (invitation, message) doit consulter `blocks`. Les
  actions « ami / bloquer » d'un nom passent par `PlayerActionsContext`
  (`src/ui/PlayerSheet.tsx`), que la planche debug remplace par des doublures.
- **Une réaction vise une chaîne que le client compose** (`trophy:<id>`,
  `word:<catégorie>:<clé>`) : le serveur ne calcule pas les trophées. Changer
  un identifiant de trophée ou une clé de mot orpheline les réactions déjà
  données.
- **Le face-à-face avec un ami se règle sur l'appareil** (`src/state/rivalry.ts`) :
  le serveur (`friend_challenges`, 0027) ne dit que qui a partagé quel défi.
  Le score réglé dépend des mots de tous et ceux des robots n'existent que
  rejoués, d'où un détail chargé et rejoué par défi, un à la fois, puis gardé
  sur l'appareil une fois le défi clos. Gagner contre un ami, c'est finir
  devant lui, pas premier.
- **Un défi vu ou écarté l'est pour le compte, pas pour l'appareil**
  (`mark_challenge_hidden`, 0041, `hideChallenge`, `src/state/challenges.ts`) :
  les marques vivent dans la ligne du joueur, sous une empreinte (joués, clos,
  revanche) que le client relit dans `my_challenges` — un défi écarté reste
  écarté sur le téléphone comme dans le navigateur, et revient dès que
  l'empreinte change. Le client n'en garde qu'un dépassement de session
  (`hiddenOverrides`), le temps que la liste revienne du serveur. Un bilan lu se
  masque tout seul et range son gagnant sur l'appareil (`rememberWinner`), lui :
  le serveur ne connaît pas le score des robots, que seul un client rejoue. Les
  anciens défis des statistiques relisent le détail de ceux qui n'en ont pas.
- **Un ami sans le jeu s'invite par un lien ou par e-mail** (`InvitePanel`,
  `src/ui/FriendsView.tsx`). Le lien mène à `invite.html` (`src/invite.ts`,
  entrée Vite à part), dont les balises Open Graph et `invite-card.png`
  font l'aperçu dans WhatsApp ou Discord : ils ne lisent aucun script, ces
  balises restent donc statiques. Sur Android, la page envoie au groupe
  Google public qui sert de liste de testeurs au test fermé
  (`VITE_TESTER_GROUP_URL`) ; sans lui, elle ne propose que le web, un lien
  Play répondant « application indisponible » à qui n'est pas testeur.
  L'e-mail (`invite_tester`, 0034) attend que l'adresse soit dans le groupe
  (ou une heure, 0035), puis part par la fonction Edge
  `invite`, depuis la boîte Gmail du jeu (`GMAIL_USER`,
  `GMAIL_APP_PASSWORD`, un mot de passe d'application) au nom de
  l'inviteur, une réponse allant à l'inviteur : aucun service ne laisse un
  mail se donner l'adresse de l'inviteur pour expéditeur. Le mail tient en
  un bouton vers la même page (`supabase/functions/invite/mail.ts`, que
  l'app relit pour `invitePage`). Le compte qui prend l'adresse invitée
  devient ami de l'inviteur sans demande (`befriend_invited`, déclencheur
  sur `auth.users`), comme celui qui présente un code : referrer Play,
  `?ref=` de la version web, ou presse-papiers que les boutons de la page
  remplissent (`LM-…`, lu une fois au premier lancement, `onInstallTraces`).
  Une adresse qui joue déjà reçoit une demande
  ordinaire, et l'inviteur lit `sent` dans les deux cas, pour que le champ
  ne dise jamais qui joue. Un nom de compte en forme d'adresse reste refusé
  (`checkName`). Un groupe Google grand public n'a pas d'API : c'est
  `npm run group:invites` (`scripts/group-invites.ts`), lancé toutes les dix
  minutes par launchd sur le poste du développeur (`--install`), qui ajoute
  les adresses invitées au groupe dans un Chrome sans tête connecté une fois
  par `--login`, et les marque `listed_at`. Mac éteint, l'invité rejoint le
  groupe lui-même depuis la page.
- **La boîte à idées part par Resend** (fonction Edge `ideas`, 0015) : sans
  `RESEND_API_KEY` dans les secrets, les idées s'accumulent en base sans
  mail.

- **Catégories et pouvoirs suivent le compte nommé** (`src/domain/progress.ts`,
  0032, `player_progress`) : à la connexion, la sauvegarde du serveur se
  fusionne avec le profil de l'appareil — ce qui se possède s'additionne,
  ce qui est en cours vient de la copie qui a le plus joué —, puis le profil
  y remonte trois secondes après chaque changement. Un compte anonyme n'a
  pas de sauvegarde : il vit et meurt avec l'appareil. Un champ nouveau du
  profil qui ne se recompte pas depuis les parties entre dans la sauvegarde.
- **Play Games connecte sans formulaire, une fois par appareil**
  (`quietTried`, `src/App.tsx`) : un joueur anonyme que le SDK a reconnu
  passe par la petite feuille Google (`style: 'bottom'`, choix automatique
  du seul compte), puis l'accueil lui demande son nom en proposant celui de
  Play Games (`NamePrompt`) — jamais imposé. « Plus tard » laisse la
  question au menu. Fermer la feuille ou se déconnecter plus tard est une
  réponse : la clé `quiet-sign-in` survit à `clearLocalData`.
- **Sidekick est posé en bas à gauche** (`res/xml/sidekick_config.xml`) :
  seul coin libre à l'accueil comme en partie, et masqué la première
  demi-heure. La Play Console l'ajoute d'elle-même à chaque bundle.

- **Un succès Play Games ne se reprend jamais** (`src/domain/achievements.ts`) :
  ses quinze seuils sont écrits en dur, pas lus dans les paliers de l'avatar,
  qui peuvent bouger. Mots ajoutés et découvertes restent bas (10 et 15) :
  plus le dictionnaire grossit, plus ils se font rares. Les découvertes ne
  se comptent que sur le serveur (`fetchMyDiscoveries`), une fois la partie
  envoyée ; un anonyme n'en a pas. Le téléphone renvoie tous les succès
  atteints au lancement et à chaque fin de partie : Play ignore un doublon,
  et c'est ce qui rattrape un joueur pas encore connecté à Play Games. Les
  identifiants Play vivent dans `src/lib/playGames.ts`, les icônes et le
  ZIP d'import sous `store/android/play-games/` (`npm run render:achievements`,
  `scripts/play-games-achievements.ts`) : la Console importe des succès
  nouveaux, elle ne met jamais à jour ceux qu'elle a.

- **Le suivi d'usage ne lève jamais et ne bloque rien** (`src/lib/track.ts`,
  0029) : les événements s'empilent dans une file de l'appareil, partent par
  lots de cent toutes les vingt secondes et au passage en arrière-plan, et
  une ouverture sans partie se lit dans les sessions sans `run_start`. Un
  bouton touché se nomme par `data-track`, sinon `aria-label`, sinon son
  texte : un bouton sans mots (icône seule) mérite un `data-track`. Le
  relevé (`analytics_snapshot`) reste fermé à l'app : elle ne le lit que par
  `admin_analytics` (0030), qui ne rend rien à qui n'est pas dans `admins`,
  et l'artefact par `npm run analytics`.

- **Le premier bundle ne porte que l'accueil** : les autres écrans sont des
  `lazyScreen` (`src/ui/lazyScreen.ts`) préchargés une fois l'accueil posé,
  et une partie attend les siens (`preloadRunScreens`, `src/App.tsx`) avec
  ses dictionnaires — un écran de la partie chargé à l'affichage laisserait
  une image vide entre annonce et chrono. Un écran nouveau entre dans
  `preloadScreens`, sous son propre `<Suspense>` : un seul autour de tout
  cacherait l'accueil pendant qu'un menu arrive. Les six langues autres que
  le français viennent aussi à la demande (`loadMessages`), avant le premier
  rendu et avant tout changement de langue.
- **Le client Supabase est assemblé à la main** (`src/lib/supabase.ts`) :
  `auth-js` et `postgrest-js` seuls, sans Realtime, Storage ni Functions,
  qu'on n'appelle pas et qui pesaient un tiers du bundle. La clé de stockage
  de la session reprend celle de `createClient` (`sb-<projet>-auth-token`) :
  la changer déconnecterait tout le monde. Une fonction Edge garde
  `supabase-js`, qu'elle importe par `npm:`.
- **Le chrono ne rend qu'au dixième de seconde** (`useElapsed`) : rien de ce
  que la partie affiche n'est plus fin, et rendre toute l'app à chaque image
  coûtait leur fluidité aux vieux téléphones pendant la frappe.
- **L'accueil entre en trois temps** : l'affiche et le titre, puis — seulement
  si le profil, le compte ou les classements tardent — trois formes qui
  sautillent (`home-loader`), puis la page d'un bloc. L'écran de lancement
  natif ne se retire qu'une fois ce premier rendu demandé (`src/main.tsx`).

## Conventions

- **Les idées se lisent dans l'app, pour l'administrateur seul** (0028,
  `admins`, nommé par son compte) : cinq tapes sur « Boîte à idées » — le
  bouton qui l'ouvre compte pour la première — ouvrent `src/debug/IdeasAdmin.tsx`.
  Pour en tirer un backlog, les idées à traiter se lisent avec
  `supabase db query --linked "select body, lang, source, created_at from ideas where archived_at is null order by created_at"`.
  La question d'avis (`feedbackDue`, `src/domain/perks.ts`) tombe au retour à
  l'accueil après la dixième partie, puis toutes les trente.
- **Bannir une catégorie et Premium vivent dans le profil, sur l'appareil**
  (`src/domain/perks.ts`) : un ban dès sept catégories, les suivants et plus
  de cinq mots cachés révélés au récap réservés à Premium, gratuit pour
  l'instant (`plusSince`). Un ban ne vaut que pour les parties seules : un
  défi distribue ses propres catégories. Cinq bans au plus (`MAX_BANS`), et
  jamais moins de `MIN_PLAYABLE_CATEGORIES` (six) catégories en jeu : à sept
  catégories, l'offre Premium ne sort donc pas, puisqu'elle ne pourrait rien
  débloquer. Une ligne de « Mes catégories » se bannit ou se rétablit aussi
  d'un glissement, sous `data-no-swipe` pour ne pas refermer le tiroir.
  Passer Premium traverse un faux paiement (`src/ui/Checkout.tsx`) qui ne
  demande aucune carte ; le retour suivant à l'accueil remercie le joueur
  une fois (`plusThanked`) et ouvre la demande d'avis.
- **Le son part fort et la limite le tient** (`MAKEUP_GAIN`, `src/lib/sound.ts`) :
  le téléphone baisse le volume sur des échantillons 16 bits, et un mixage
  discret y devenait robotique. Ne pas rabaisser le bus maître pour « calmer »
  le jeu : c'est le volume du téléphone qui doit le faire.
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
  qu'on en crée un, on l'y ajoute. Le tableau de bord a le sien
  (`leaderboards-advanced`). On l'ouvre par cinq tapes rapides sur
  la tuile en haut à droite de l'affiche d'accueil, ou `#debug` sur le web, dans n'importe quel
  build. Elle montre les vrais composants avec des données inventées et
  n'écrit jamais sur le serveur : un écran qui appelle `cloud.ts` pour
  écrire reçoit une doublure en prop (`answerOffer` de `ModeratorOffer`),
  un écran qui charge lui-même ses données se découpe en chargeur + vue
  (`ChallengeScreen` / `ChallengeView`). Outil de développeur : ses
  libellés restent en français, hors de l'i18n.
- **Le bouton quitter reste à gauche** : le coin haut droit de l'affiche est
  celui des cinq tapes qui ouvrent la planche, un bouton au même endroit la
  refermait aussitôt.
- **Le tableau de bord remplace les classements avancés** (`src/debug/Dashboard.tsx`) :
  cinq tapes rapprochées sur le mot « Classement » — le titre de l'accueil ou
  celui de la page des classements — l'ouvrent par-dessus tout, posé sur
  `body` parce que le tiroir du menu est trop étroit. C'est la page de
  l'artefact, mêmes sections, lue à l'ouverture (`fetchDashboard`) ; un
  joueur qui n'est pas administrateur n'y voit que « réservé ». Outil de
  développeur, donc libellés français hors de l'i18n ; les noms de pouvoirs
  et de catégories viennent de l'interface. Une section ajoutée au relevé
  s'ajoute à `src/debug/snapshot.ts`, puis aux deux vues. Depuis 0036,
  `analytics_snapshot` n'est que `analytics_core` (le corps de 0031) fusionné
  à `analytics_extras` (invitations, couples passés) : une section nouvelle
  va dans l'une des deux, sans réécrire l'autre. Toucher une barre
  d'activité ou d'invitations nomme ses joueurs (`admin_slot`), filtrés
  côté client par la même règle que la série (`COUNTS`). Les fonctions
  `debug_*` (0025, 0026) restent en base, plus aucun écran ne les lit.
- **Les planches touchées depuis la dernière version livrée sont surlignées
  en rouge, celles qu'elle n'avait pas en bleu** (`npm run debug:recent`) : le script relit les commits
  « Version X.Y.Z » de git et écrit `src/debug/recent.ts`, à commiter — la
  planche et le build n'ont donc pas besoin de git. Tout se lit dans `HEAD` :
  ce qui n'est pas commité n'est pas livré. Un identifiant de planche reste
  littéral dans `DebugBoard.tsx` (`id: 'moderator-level'`, pas
  `` `moderator-${reason}` ``), sinon le script ne sait pas le nommer. Une
  planche est retenue quand un écran de `src/ui/` qu'elle montre a changé, ou
  quand son propre bloc a changé.
