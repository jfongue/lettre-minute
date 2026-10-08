# Rapport des versions livrées (test fermé Play)

Périmètre : toutes les versions envoyées sur la piste **alpha** (test fermé) du
Play Store, de la première livraison à la dernière livrée. Source : `git log
origin/main`, les commits `Version X.Y.Z (versionCode N)` et les notes de
version livrées (`android/whatsnew/fr-FR.txt` à chaque commit). Le premier
envoi au test fermé est `45e14ea` (« Send the release bundle to Play's closed
testing »), versionName **1.3.0**, versionCode **5** ; le build 1.3.0/4 qui le
précède était interne.

Deux builds de la série disent eux-mêmes viser l'interne plutôt que le test
fermé : 1.3.2 (7, « for internal testing ») et 1.7.6 (28, outils de modération),
plus 1.7.7 (29), build silencieux sans notes.

## Tableau récapitulatif

| Version | code | date | Ce qui change |
| --- | --- | --- | --- |
| 1.3.0 | 5 | 2026-09-25 | Premier envoi test fermé : Google en un geste, compte persistant, tutoriel, défis robots, mots communautaires |
| 1.3.1 | 6 | 2026-09-25 | Connexion Google réparée, « Villes » remplace « Capitales », file de modération |
| 1.3.2 | 7 | 2026-09-25 | Publicités éteintes (build interne) |
| 1.4.0 | 8 | 2026-09-25 | Bilan de défi détaillé, ami/bloquer partout, boîte à idées, soutien |
| 1.4.1 | 9 | 2026-09-25 | Défis réglables (catégories, pouvoirs), notifications dans les options |
| 1.5.0 | 10 | 2026-09-25 | Défi en direct, 19 avatars, niveaux plus doux, réserve de modération |
| 1.5.1 | 11 | 2026-09-25 | Pouvoir Bavardage, son sans grésillement |
| 1.6.0 | 12 | 2026-09-26 | Prénoms, objets du quotidien, plantes |
| 1.6.1 | 13 | 2026-09-26 | Icône de lancement réparée |
| 1.6.2 | 14 | 2026-09-26 | Page des classements |
| 1.6.3 | 15 | 2026-09-26 | Geste retour, podium, thème sombre retiré |
| 1.6.4 | 16 | 2026-09-27 | Le tirage écoute la foule, marque « ton mot » |
| 1.6.5 | 17 | 2026-09-27 | « Grandes villes », 7 avatars de mots ajoutés |
| 1.6.6 | 18 | 2026-09-28 | Bannir une catégorie, Premium, page d'un ami, noms courts |
| 1.6.7 | 19 | 2026-09-28 | Téléchargement 2× plus léger, suivi d'usage |
| 1.6.8 | 20 | 2026-09-28 | Succès Play Games, sauvegarde du compte nommé |
| 1.6.9 | 21 | 2026-09-28 | Nom de joueur Play Games proposé à l'accueil |
| 1.7.0 | 22 | 2026-09-29 | Amis plus clairs, invitation par messagerie et e-mail, thème Sombre |
| 1.7.1 | 23 | 2026-09-30 | Animations fluides, accueil qui ne fige plus, « Plus… » |
| 1.7.2 | 24 | 2026-09-30 | Sons partout, bilan de défi en musique |
| 1.7.3 | 25 | 2026-09-30 | Stats sur tout l'historique, notification de défi qui s'efface |
| 1.7.4 | 26 | 2026-10-03 | Signalement d'un mot par un modérateur |
| 1.7.5 | 27 | 2026-10-03 | Trois pouvoirs : Retardataire, Passe-passe, Sans faute |
| 1.7.6 | 28 | 2026-10-05 | Tableau des mots (interne, outils de modération) |
| 1.7.7 | 29 | 2026-10-05 | Duel en ligne pour super modérateurs, fonctionnalités interruptibles |
| 1.7.8 | 30 | 2026-10-07 | Duel ouvert à tous, bilan des mots manqués, réserve de 3 modes |
| 1.7.9 | 31 | 2026-10-07 | Correctif : menus opaques, robot qui ne boucle plus |
| 1.7.10 | 32 | 2026-10-07 | Correctif : le duel s'ouvre au premier clic |
| 1.7.11 | 33 | 2026-10-07 | 30 succès et leur page, invitation au duel qui sonne |
| 1.7.12 | 34 puis 35 | 2026-10-07 | Correctifs : gel au lancement, Firebase, calendrier Reddit |
| 1.7.13 | 36 | 2026-10-08 | Avatar + succès sur une page, retrait de mot annulable |

## Détail version par version

### 1.3.0 — versionCode 5 — 2026-09-25 — premier envoi au test fermé

- Connexion avec Google en un geste, compte qui reste connecté entre deux
  lancements (même hors ligne), mot de passe oublié par code e-mail.
- Défis contre les robots maison, qui répondent en quelques minutes.
- Nouveau tutoriel pour une première partie guidée.
- Avatars et couleurs plus rares à débloquer ; dictionnaires enrichis des mots
  validés par la communauté.

### 1.3.1 — versionCode 6 — 2026-09-25

- Correction : la connexion Google ne demande plus aucun scope (le plugin
  Android les refuse avant le sélecteur, le bouton ne faisait que clignoter).
- Correction : la musique se coupe quand on quitte le jeu.
- « Capitales » devient « Villes » : les plus grandes villes de chaque pays
  (dix pour un grand pays, cinq pour un petit), classées par GeoNames, au lieu
  des seules capitales ; villes allemandes importées dans la foulée.
- Un mot à une lettre près peut être proposé comme nouveau mot (« moule »
  n'est pas « poule » mal orthographié).
- Les mots des amis passent en tête de la file de modération, qui ne s'ouvre
  qu'à partir de cinq mots en attente.

### 1.3.2 — versionCode 7 — 2026-09-25 — build interne

- Les publicités sont éteintes pour l'instant ; l'appel au soutien au bilan
  reste le seul.

### 1.4.0 — versionCode 8 — 2026-09-25

- Bilan de défi : la course seconde par seconde, et des réactions sur les
  trophées et les mots, comme dans une messagerie.
- Touche un nom au classement pour l'ajouter en ami ou le bloquer (côté
  serveur compris) ; sur les classements longs, ton podium et tes amis
  d'abord.
- Un défi terminé s'écarte d'un glissement ; un pouvoir se choisit d'un seul
  toucher.
- Récompenses alternées : une catégorie au niveau 2, le premier pouvoir au 3,
  puis l'un et l'autre à tour de rôle.
- Boîte à idées et bouton de soutien dans le profil ; note du créateur d'un
  défi ; alerte quand une nouvelle version est disponible.
- Correction : musique de nouveau active par défaut, modérateurs montrés aux
  seuls modérateurs, note de réserve retirée.

### 1.4.1 — versionCode 9 — 2026-09-25

- Le créateur d'un défi choisit ses catégories parmi les siennes et autorise
  ou non les pouvoirs ; une revanche garde les deux.
- Petit Bac inversé : un mot que toi seul as trouvé vaut +25 %.
- Notifications réglables dans les options : état lu du téléphone, bouton pour
  les autoriser, lien vers les réglages du système.
- Thème clair par défaut, pouvoirs Échange et Challenge renommés, bouton
  « Ignorer » dans le bilan.

### 1.5.0 — versionCode 10 — 2026-09-25

- Défi : classement suivi en direct, gagnant dévoilé avec suspense du dernier
  au premier ; un défi peut être nommé par son créateur (0017) et son nom
  suit la revanche.
- 19 nouvelles formes d'avatar remplacent les quarts tournés, arches et
  moitiés ; trois tuiles arrivent avec les parties 3, 5 et 7 ; une tuile ou
  une couleur gagnée dit ce qui l'a gagnée.
- Niveaux plus doux (niveau 10 à 3 950 XP au lieu de 6 550) et 100 XP de
  bonus pour un record battu sous 250 points ; l'offre de modération suit le
  nouveau niveau 6 (0018).
- Les mots acceptés s'annoncent à l'ouverture ; le troisième offre le pouvoir
  Challenge, sur son propre écran.
- Célérité valide deux fois plus vite, « chut » lance Silence dès la frappe.
- Défis masqués rangés en bas des statistiques, derrière un interrupteur.
- Réserves de modération : la file se remplit seule à cinq mots (0019).
- Retour à l'accueil après une partie qui gagne des places : la ligne du
  joueur monte sur le tableau du jour avec un « +X » vert.
- Icône de notification avec le logo du jeu, écran de lancement fondu dans le
  papier.
- Corrections : « Toi » n'est plus souligné dans le classement final, la liste
  des réactions passe au-dessus des sections suivantes, le formulaire de don
  garde une hauteur utilisable sur une fenêtre courte, un mot déjà connu du
  dictionnaire dit « Déjà existant ! ».

### 1.5.1 — versionCode 11 — 2026-09-25

- Nouveau pouvoir Bavardage : « ... » après un mot garde la lettre et le thème
  pour trois mots de plus, une fois par partie.
- Correction : plus de grésillement quand la page travaille (tampon audio plus
  solide, réverbe courte, musique planifiée plus en avance, dictionnaires
  analysés pendant que l'accueil est inactif).

### 1.6.0 — versionCode 12 — 2026-09-26

- Trois nouvelles catégories : prénoms (une liste par langue, Wikidata et
  registres INSEE, SSA, ONS), objets du quotidien et plantes.
- Un joueur qui avait déjà tout débloqué reçoit l'une des trois en cadeau au
  lancement, sans dépenser un choix de niveau.
- Une demande d'ami se signale sur le menu ; les défis lus se rangent tout
  seuls avec leur gagnant ; Célérité valide les mots à une lettre près.
- Une adresse e-mail tapée dans le champ ami invite au test fermé (listée par
  une console Play sans tête, puis mail d'invitation).
- Correction : plantes et objets du quotidien coupés à ce qu'un joueur
  nommerait (pas de familles botaniques, pas de bois de charpente, un mot du
  Wiktionnaire doit être attesté par wordfreq).

### 1.6.1 — versionCode 13 — 2026-09-26

- Correction : l'icône de lancement montre à nouveau la marque du jeu — le
  robot du modèle Capacitor, dans `drawable-v24`, l'emportait sur le vecteur
  depuis Android 7.

### 1.6.2 — versionCode 14 — 2026-09-26

- Nouvelle page des classements : meilleure partie, points, parties, mots
  trouvés, découvertes, série, mots ajoutés — chacun pour le jour, la semaine
  ou depuis toujours, avec la place du joueur. Ouverte depuis le titre
  « Classement », en glissant après le troisième tableau, ou depuis les
  statistiques.

### 1.6.3 — versionCode 15 — 2026-09-26

- Correction : le geste retour referme les fenêtres au lieu de quitter la
  partie, et une catégorie offerte mise de côté est remise au bilan.
- Correction : les longs pseudos s'affichent en entier sur le podium (taille
  réduite d'un cran, hauteur de ligne fixée).
- Correction : le thème sombre ne se choisit plus (auto et clair restent).
- Plus d'animaux en néerlandais ; publication web sur gh-pages.

### 1.6.4 — versionCode 16 — 2026-09-27

- Le tirage des lettres écoute la foule : un couple lettre + catégorie que les
  joueurs quittent s'efface peu à peu (jamais à zéro), un couple réussi
  revient ; rapporté une fois par graine, jamais par un défi (0024).
- Les mots que le joueur a fait entrer au dictionnaire portent une marque
  « ton mot », en partie comme au bilan.
- Le bilan de fin de partie relit les mots proposés pendant la partie : on
  peut corriger leur orthographe ou retirer la demande tant qu'elle attend.
- Corrections : l'icône garde son fond papier sur un téléphone en thème
  sombre ; la file de modération n'est renflouée qu'une fois par heure, toutes
  langues confondues ; Maxitoon et Terretciel quittent les classements.

### 1.6.5 — versionCode 17 — 2026-09-27

- « Villes » devient « Grandes villes » : aux capitales s'ajoutent les villes
  de plus de 100 000 habitants des dix pays où le jeu se joue (Villeurbanne,
  Coventry, Sabadell), lues dans `cities15000` de GeoNames et non des classes
  de ville de Wikidata, qui laissent Paris et Berlin dehors ; les sept
  dictionnaires sont reconstruits.
- Sept nouvelles formes d'avatar récompensent les mots ajoutés au
  dictionnaire, de 1 à 1 000.
- Tableau de bord avancé, caché derrière cinq tapes sur « Classement » :
  pouvoirs portés par chaque partie et couples lettre + thème qui rapportent
  le plus ou se font passer le plus (0025, 0026).
- Correction : les parties horaires des robots maison et leurs comptes sortent
  du rythme du tableau de bord.

### 1.6.6 — versionCode 18 — 2026-09-28

- Une catégorie peut être écartée des parties seules depuis « Mes
  catégories » : premier ban dès sept catégories, cinq bans au plus, jamais
  moins de six catégories en jeu (0028).
- Premium (ex « Joueur + ») : le deuxième ban et la révélation de plus de cinq
  mots cachés, gratuits pour l'instant, passent par un faux paiement ; le
  retour à l'accueil remercie une fois et demande un avis.
- La page d'un ami montre le face-à-face des défis joués ensemble (0027).
- Noms courts acceptés : USA, Angleterre, Samsung, Mercedes, Oslo, Francfort
  — un alias est une forme de son libellé, les libellés `mul` sont lus.
- Herbes, champignons, parties du corps et matières du quotidien entrent au
  dictionnaire.
- Corrections : la musique ne grésille plus à bas volume (son envoyé chaud,
  limiteur, l'atténuation laissée au téléphone) ; le pouvoir Professeur sort
  du jeu, remplacé par les mots cachés ; la liste d'amis d'un défi défile
  aussi sur les WebViews antérieurs à Chrome 105 ; « Toi » d'un bilan s'aligne
  à gauche comme les autres noms.

### 1.6.7 — versionCode 19 — 2026-09-28

- Le premier téléchargement est deux fois plus léger (937 → 455 kB, 270 →
  131 kB gzippé) : tous les écrans sauf l'accueil, la planche debug et les six
  langues chargent à la demande, le client Supabase ne garde que l'auth et le
  REST, le chrono ne redessine plus qu'au dixième de seconde.
- Le suivi d'usage arrive (0029) : ouvertures avec ou sans partie, écrans,
  boutons, fonctionnalités, parties, erreurs, temps de chargement, envoyés par
  lots ; le tableau du propriétaire s'ouvre par cinq tapes sur « Classement »
  et `admin_analytics` ne rend rien aux autres (0030).
- Chaque catégorie a un sous-titre court ; « Marque » et « Partie du corps »
  passent au pluriel dans les sept langues.
- Correction : une ligne bannie de « Mes catégories » se lit sur deux lignes.

### 1.6.8 — versionCode 20 — 2026-09-28

- Succès Google Play Games : quinze objectifs, du niveau 4 au Maître de la
  minute, débloqués depuis le profil au lancement et après chaque partie ;
  chaque partie compte aussi comme événement Play (parties, mots, points).
- Un joueur reconnu par Play Games est connecté en silence, avec son compte
  Google et son nom de joueur, sans formulaire, une fois par appareil.
- Catégories, pouvoirs, bans et Premium suivent un compte nommé d'un
  téléphone à l'autre (0032).
- Sidekick posé en bas à gauche, masqué la première demi-heure.
- « Mes catégories » annonce Ingrédients et Lieux et bâtiments sous
  « Bientôt… », hors du catalogue jouable.
- Outils : le tableau de bord exclut le compte admin et gagne une section
  « 1 j » heure par heure (0031).

### 1.6.9 — versionCode 21 — 2026-09-28

- Un joueur connecté en silence par Play Games est invité à choisir son nom à
  l'accueil : le nom du joueur est proposé dans le champ mais jamais imposé,
  et « Plus tard » laisse la question au menu.

### 1.7.0 — versionCode 22 — 2026-09-29

- Liste d'amis plus claire : classement entre amis par record, ou de A à Z
  d'un toucher ; le nom du joueur dans une carte avec bouton de partage.
- Inviter un ami qui n'a pas le jeu par WhatsApp, Messenger, Telegram, SMS,
  Discord, la feuille de partage ou e-mail, avec une page d'invitation et un
  aperçu de chat ; l'invité devient ami dès qu'il crée son compte (0034,
  0035).
- Le thème Sombre revient parmi les options, le clair restant le défaut.
- Corrections : la question « qui t'a invité » disparaît pour les comptes
  existants ; une demande d'ami déjà partie s'affiche « en attente » (et
  « Accepter » si elle vient de l'autre) ; l'onglet Social demande son nom à
  un compte anonyme au lieu de montrer une liste vide ; les statistiques
  relisent au moins vingt parties du compte ; 397 mots acceptés par les
  modérateurs entrent enfin dans les dictionnaires livrés.

### 1.7.1 — versionCode 23 — 2026-09-30

- Animations plus fluides : le menu se referme en glissant, la barre d'XP se
  remplit d'un trait, les rivaux d'un défi se doublent en glissant.
- L'accueil ne se fige plus pendant le chargement des catégories : le
  dictionnaire se construit deux à trois fois plus vite (animaux français
  130 → 48 ms).
- L'onglet Social montre l'avatar du joueur, « Ajouter un ami » sous son nom
  et un « M » sur les modérateurs ; une pop-up unique annonce les invitations.
- « Plus… » remplace l'onglet Découvertes sur les classements de l'accueil ;
  « Mes demandes » porte un « ! » au-delà de vingt mots en attente.
- Correction : le mail des adresses invitées que le groupe n'a pas prises
  dans l'heure ne part plus au propriétaire.

### 1.7.2 — versionCode 24 — 2026-09-30

- Le jeu sonne là où il était muet : menu, champs de texte, fenêtres, envois,
  réactions et montée au classement.
- Le bilan d'un défi dévoile son classement en musique, jusqu'au gagnant ;
  le tutoriel a ses sons.
- Correction : Couleurs sur H, P et T sort quatre fois moins souvent en partie
  seule (`DAMPED_PROMPTS`), défi et robots intacts.

### 1.7.3 — versionCode 25 — 2026-09-30 (deux envois de suite)

- Les statistiques remontent tout l'historique du compte, trente parties à la
  fois, et rouvrent le bilan de chaque partie — les mots dits et, sous leurs
  bandes, ceux que ses thèmes passés avaient encore — « Mots les plus dits »
  devient un top 10 des mots dits trois fois ou plus ; chaque catégorie est
  une carte avec ses points, ses chiffres par mot et la part de thèmes passés.
- Corrections : la notification d'un défi s'efface une fois le défi joué ou le
  bilan lu, sur ce téléphone comme sur un autre ; glisser les classements de
  l'accueil vers « Plus… » ne clignote plus ; sur le podium, la place du
  joueur est encadrée dans sa propre bordure au lieu d'un contour rogné ; la
  musique s'efface pendant la première révélation d'un bilan de défi (0037
  côté serveur).

### 1.7.4 — versionCode 26 — 2026-10-03

- Un modérateur signale un mot qui n'a pas sa place dans une catégorie d'un
  appui long (clic droit sur le web) dans le récapitulatif d'une partie, avec
  son motif (140 caractères au plus), y compris un mot jamais trouvé sous
  « Ce que tu aurais pu écrire » (0038).
- Les autres jugent le mot : le conserver à droite, le retirer à gauche ; un
  super modérateur le règle seul.
- Les mots retirés quittent les dictionnaires au prochain import (liste
  committée, `scripts/banned-words.ts`) et les couples lettre + catégorie
  qu'ils vidaient sortent moins souvent (0039) ; un job nocturne applique les
  bans aux dictionnaires livrés.
- Corrections : la carte de modération dit « Ajout » ou « Retrait » et chaque
  verdict se lit dans les mots de la carte ; un mot signalé depuis le plateau
  des mots attend bien les autres modérateurs ; la planche debug revient où
  la liste était défilée.

### 1.7.5 — versionCode 27 — 2026-10-03

- Trois pouvoirs entrent dans le tirage :
  - Retardataire : un mot validé dans les cinq dernières secondes rend une
    seconde, cinq fois au plus par partie ;
  - Passe-passe : le thème qui suit un passage est gratuit, une fois par
    partie ;
  - Sans faute : 10 points tous les trois mots écrits sans faute de frappe.
- Chacun a son icône, sa couleur, son son et sa carte dans les sept langues.

### 1.7.6 — versionCode 28 — 2026-10-05 — build interne (outils de modération)

- Le plateau des mots s'ouvre par cinq tapes sur « Mes catégories » : part
  théorique d'un couple lettre + catégorie (poids du tirage calculé depuis les
  dictionnaires livrés) contre la part réelle de `prompt_stats`, et tout ce
  qu'une catégorie accepte, mots ajoutés et retirés compris (0043).
- Un mot se signale d'un appui long ; un super modérateur peut le retirer
  d'office (`force_ban`, 0044), ce qui supprime tout de suite la copie
  communautaire côté serveur.
- Corrections : un compte anonyme jamais vu jouer et les parties de test d'un
  agent sortent du tableau de bord (0040, 0042) ; un défi écarté reste écarté
  sur tous les appareils du joueur (0041) ; l'écran des pouvoirs est poli
  (impact et limite de chaque carte).

### 1.7.7 — versionCode 29 — 2026-10-05 — build silencieux

- Le duel en direct contre amis et robots maison ouvre aux super modérateurs,
  derrière le bouton des défis, avec un choix entre duel et défi 24 h (0046).
- Chaque fonctionnalité devient un interrupteur : par public (tout le monde,
  modérateur, Premium, super modérateur) et par fonctionnalité, réglé par un
  super modérateur (0045).
- Corrections : sans compte nommé ni serveur, la table propose les robots
  maison sur place ; les trous du duel sont bouchés (lobby partagé, draft,
  mort mise en scène, rematch, choix de l'ouvreur par la graine).

### 1.7.8 — versionCode 30 — 2026-10-07

- Le duel en direct ouvre à tout le monde : les amis y accèdent depuis
  « Créer un défi », et l'hôte peut annuler un départ que personne n'a encore
  choisi (0058).
- Le bilan de fin de partie propose les mots qui manquaient.
- Un mot signalé attend plusieurs modérateurs ; l'offre de modérer s'obtient
  par les mots, le niveau ou un ami ; le pouvoir Professeur revient
  autrement (il donne un mot peu commun au lieu du favori de la foule).
- Une réserve de trois modes de jeu vit derrière « Jouer » : retard,
  endurance et renversé, chacun sans pouvoir et avec sa leçon.
- Côté serveur (0054 à 0057) : un score est borné par les mots qui l'ont
  fait, un signalement de thème exige une vraie partie derrière lui,
  l'historique des parties d'un joueur n'est plus lisible par les autres, le
  niveau qui ouvre la modération est recalculé par le serveur, 300 parties par
  jour au plus, les vues PostgREST ne lisent plus `auth.users`.
- Corrections : un duel survit à une coupure serveur (le dernier état connu
  reste à l'écran, les coups attendent en file), un coup perdant la course à
  son numéro est renvoyé, on peut quitter une table, un robot peut rejouer,
  un mot ou une proposition qu'aucun dictionnaire livré ne peut porter est
  refusé, l'alerte de file pleine se déclenche.

### 1.7.9 — versionCode 31 — 2026-10-07 — build correctif

- Correction : les deux menus derrière « Jouer » arrivent opaques — l'écran
  précédent ne montre plus à travers un quart de seconde — et leurs cartes
  entrent ensemble au lieu de l'une après l'autre.
- Correction : une pop-up d'avis attend la fin du choix de mode de jeu.
- Correction : un robot à sa dernière seconde ne fait plus durer un duel
  indéfiniment (deux robots s'échangeaient des mots sans fin ; une partie
  entre eux dure maintenant une cinquantaine de secondes).

### 1.7.10 — versionCode 32 — 2026-10-07 — build correctif

- Correction : le duel s'ouvre au premier clic — ses règles n'ouvrent plus
  avant que la table en ligne ait assis le joueur, ce qui vidait l'écran
  (bouton retour compris).

### 1.7.11 — versionCode 33 — 2026-10-07

- Trente succès avec une page dédiée : trois familles, barres chiffrées, les
  tuiles d'avatar pour les exploits et une marque Play Games sur les quinze
  publiés ; le bilan de partie annonce ce qui vient d'être gagné.
- Une invitation au duel fait sonner le téléphone et cesse de sonner dès que
  la table n'attend plus (0060).
- L'accueil s'allège : les quatre tuiles et la liste des défis ne s'affichent
  que s'il y a quelque chose derrière, et la note de compte ne promet plus de
  scores à un nouveau venu.
- Les textes les plus fins remontent à 0,7 rem ; un joueur éliminé au duel a
  son propre son (un glas).
- Corrections : deux seuils Play injoignables descendent (666 points, 2 000
  mots) ; les scrims suivent le thème, dix avatars ne rétrécissent plus à
  31 px ; un cue demandé au retour du fond est planifié au lieu d'être perdu ;
  un écran caché ne relit plus la table du duel en fond.

### 1.7.12 — versionCode 34 puis 35 — 2026-10-07 — builds correctifs

- Correction (34) : l'app ne gèle plus au lancement — l'objectif Play abaissé
  à 666 points nommait une tuile d'avatar qui n'existe pas, donc `tileOf`
  cherchait sans fin dès le chargement du module de succès ; la recherche
  s'arrête à la grille, 666 garde la tuile du seuil de 900 points et la barre
  « partie propre » récupère la tuile 27.
- Correction (34) : un build release retrouve Firebase — le service de
  messagerie du duel lit `RemoteMessage`, qui n'atteignait que le plugin
  push ; `firebase-messaging` est déclaré aussi pour le module de l'app.
- Correction (35) : le calendrier du défi quotidien Reddit ne construit plus
  de `Date` dans le domaine, le test de pureté qui les bannit repasse au vert.
- Même note de version que 1.7.11 ; rien de visible ne change.

### 1.7.13 — versionCode 36 — 2026-10-08 — dernière livrée

- L'éditeur d'avatar et les succès tiennent sur une seule page du tiroir,
  avec un bouton retour en haut et en bas, au lieu de deux feuilles empilées ;
  chaque palier gagné montre la tuile et la couleur que ce palier débloque.
- « Mes demandes » liste les retraits qu'un modérateur attend encore, sous
  « En attente » et avec un bouton « Retirer », pour reprendre un signalement
  au lieu de le laisser dans la file de tout le monde ; un retrait que
  personne n'a rejoint emporte sa revue, un retrait déjà réglé n'apparaît ni
  dans « Ajoutés grâce à toi » ni dans « Refusées » (0061, appliquée).
- Correction : une liste de retraits que le serveur ne peut pas rendre se lit
  vide plutôt que « en chargement ».

## Après 1.7.13 (non livré)

Ce qui a atterri sur `main` et sur la branche de travail après la dernière
livraison n'est dans aucune version du test fermé : version CrazyGames 1.0.0
et son cadre, version Reddit (défi quotidien), interface `src/platform/`
partagée entre les quatre versions, correction du cadre CrazyGames (actions
visibles, panneau de mots replié, conditions des succès au survol), leçon
autonome des modes de réserve, et les suites de tests SQL.
