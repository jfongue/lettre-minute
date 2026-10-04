# Supabase

Vingt-neuf migrations : [`0001_init.sql`](migrations/0001_init.sql) pour le schéma,
[`0002_delete_account.sql`](migrations/0002_delete_account.sql) pour l'effacement
d'un compte depuis l'application, [`0003_accounts.sql`](migrations/0003_accounts.sql)
pour les comptes nommés et l'avatar, [`0004_boards_friends.sql`](migrations/0004_boards_friends.sql)
pour les classements par période et les amis, [`0005_my_submissions.sql`](migrations/0005_my_submissions.sql)
pour retirer ou corriger un mot proposé tant qu'il attend, [`0006_house_bots.sql`](migrations/0006_house_bots.sql)
pour les deux joueurs maison, [`0007_moderation.sql`](migrations/0007_moderation.sql)
pour la modération des mots proposés, [`0008_challenges.sql`](migrations/0008_challenges.sql)
pour les défis entre amis, [`0009_push.sql`](migrations/0009_push.sql) et
[`0010_push_config.sql`](migrations/0010_push_config.sql) pour leurs notifications push,
[`0011_hardening.sql`](migrations/0011_hardening.sql) pour fermer ce que la batterie de
tests a trouvé ouvert : propositions et dates de parties falsifiables, votes
contournables, demandes d’ami croisées, bilan perdu, arguments invalides qui levaient,
[`0012_bots_in_challenges.sql`](migrations/0012_bots_in_challenges.sql) pour inviter
les joueurs maison aux défis, [`0013_moderation_friends.sql`](migrations/0013_moderation_friends.sql)
pour faire remonter les mots proposés par des amis dans la file de modération,
[`0014_blocks_reactions.sql`](migrations/0014_blocks_reactions.sql) pour bloquer un
joueur et réagir au bilan d'un défi, [`0015_ideas.sql`](migrations/0015_ideas.sql)
pour la boîte à idées, [`0016_challenge_setup.sql`](migrations/0016_challenge_setup.sql)
pour qu'un défi autorise ou non les pouvoirs, [`0017_challenge_name.sql`](migrations/0017_challenge_name.sql)
pour nommer un défi, [`0018_gentler_levels.sql`](migrations/0018_gentler_levels.sql)
pour la courbe d'XP adoucie, [`0019_moderation_reserve.sql`](migrations/0019_moderation_reserve.sql)
pour la réserve de mots versée aux modérateurs qui ont vidé leur file,
[`0020_tester_invites.sql`](migrations/0020_tester_invites.sql) pour inviter un ami
par e-mail au test fermé de Play, [`0021_leaderboards.sql`](migrations/0021_leaderboards.sql)
pour la page des classements, [`0022_prompt_weight.sql`](migrations/0022_prompt_weight.sql)
pour les couples lettre + catégorie que les parties des joueurs effacent ou ramènent,
et [`0023_moderation_topup_cooldown.sql`](migrations/0023_moderation_topup_cooldown.sql)
pour le renflouage de la file limité à un versement par heure,
[`0024_bots_off_leaderboards.sql`](migrations/0024_bots_off_leaderboards.sql)
pour sortir les joueurs maison des classements, et
[`0025_insights.sql`](migrations/0025_insights.sql) pour les classements
avancés du mode débug (pouvoirs joués, rythme des parties et des comptes,
couples les plus rentables ou les plus quittés), et
[`0026_insights_history.sql`](migrations/0026_insights_history.sql) pour en
sortir les joueurs maison et y lire les mots joués des parties qui n'ont rien
rapporté, [`0027_friend_challenges.sql`](migrations/0027_friend_challenges.sql)
pour l'historique des défis joués avec chaque ami, et
[`0028_ideas_admin.sql`](migrations/0028_ideas_admin.sql) pour lire, archiver
et effacer les idées reçues depuis l'app, réservé aux administrateurs, et
[`0029_events.sql`](migrations/0029_events.sql) pour les statistiques d'usage
(ouvertures, écrans, boutons, fonctions, erreurs) et le tableau de bord
qui les lit (`analytics_snapshot`, par `npm run analytics`), et
[`0030_admin_analytics.sql`](migrations/0030_admin_analytics.sql) pour que
l'app le lise aussi, réservé aux administrateurs (`admin_analytics`), et
[`0037_moderation_topup_on_open.sql`](migrations/0037_moderation_topup_on_open.sql)
pour renflouer la file dès la visite qui la trouve courte, et
[`0038_word_bans.sql`](migrations/0038_word_bans.sql) pour qu'un modérateur
signale un mot à retirer, jugé par les autres comme un ajout.

## Ce que le serveur détient

| Table | Rôle |
| --- | --- |
| `profiles` | XP, niveau, records, avatar, nom de compte (unique, sauf « Anonyme »). Créé automatiquement à la naissance du compte. |
| `runs` | Une partie terminée : graine, score, série, passes, et les pouvoirs qu'elle a joués. |
| `run_words` | Les mots d'une partie, forme normalisée — la matière du bonus de rareté. |
| `daily_challenges` | La graine du jour, la même pour tous : base du classement quotidien. |
| `dictionary_words` | Le dictionnaire vivant, en complément des fichiers embarqués. |
| `word_submissions` | Les mots proposés par les joueurs, avec leur statut ; `seen_at` éteint la pastille de « Mes demandes ». |
| `word_reviews` | Un mot en cours de jugement (catégorie + mot) : un ajout, que rejoignent tous ceux qui l'ont réclamé, ou un ban (`kind`), signalé par un modérateur. |
| `moderation_votes` | Un vote par modérateur et par mot : `correct`, `unsure`, `incorrect` ou `special`. |
| `moderators` | Les modérateurs, et l'ami qui les a élus. |
| `moderation_reserve` | Mots évidents que les dictionnaires ignorent, versés au compte-goutte dans la file (`released_at`). |
| `moderation_topup` | Une seule ligne : l'heure du dernier versement, qui ferme le renflouage pour une heure, toutes langues confondues. |
| `moderator_offers` | Les propositions de modérer (niveau, mots acceptés, ami) et la réponse du joueur. |
| `friendships` | Une ligne par demande d'ami (`pending` puis `accepted`), lue dans les deux sens. |
| `bots` | Les joueurs maison (Maxitoon, Terretciel), hors classements, et les bornes de leurs scores. |
| `challenges` | Un défi entre amis : langue, graine, catégories, chef, et la revanche qui lui fait suite. |
| `challenge_players` | Un invité par ligne, puis sa partie : score, passes, série, mots en JSON ; ce qu'il a vu (invitation, bilan). |
| `push_tokens` | Le jeton FCM de chaque téléphone, le compte qui s'y est connecté en dernier, et la langue de ses messages. |
| `push_outbox` | Les pushs à envoyer (invitation, bilan), vidés par la fonction Edge `push`. |
| `account_merges` | Jetons à usage unique : versent un compte anonyme dans le compte auquel il se connecte. |
| `blocks` | Qui a bloqué qui. Bloquer efface l'amitié ; les demandes du bloqué ne sont plus écrites. |
| `challenge_reactions` | Une réaction (emoji) par joueur et par trophée ou mot du bilan d'un défi. |
| `ideas` | Une idée envoyée en texte libre par un joueur, vidée une fois par jour par la fonction Edge `ideas` ; sa provenance (`box` ou `prompt`, la question du retour de partie) et son archivage (`archived_at`). |
| `admins` | Les comptes qui lisent les idées dans l'app (`admin_ideas`, `archive_idea`, `delete_idea`). Aucune politique : seul `is_admin()` la lit. |
| `tester_invites` | Une adresse e-mail invitée depuis « Ajouter un ami » : la fonction Edge `invite` l'écrit aussitôt (0034), et le compte qui la prend devient ami de l'inviteur (`joined_by`). Aucune politique : jamais relue par un joueur. |
| `prompt_stats` | Par langue, ce que les parties ont dit de chaque couple lettre + catégorie : combien l'ont tiré, combien l'ont laissé vide, ce qu'il a rapporté en points et en mots. Lu par le tirage du client et par les classements avancés, écrit par la seule fonction `report_prompts`. |
| `prompt_reports` | Les graines qui ont déjà parlé, pour qu'une partie ne compte qu'une fois. Aucune politique : jamais relu. |
| `events` | Ce que les joueurs font de l'app, par lots de `track` : ouvertures, écrans, boutons touchés, fonctions, parties, erreurs. Un appareil, une ouverture, et le compte en plus (effacé avec lui). Aucune politique : jamais relu par le jeu, seulement par `analytics_snapshot`, que le propriétaire du projet exécute, et `admin_analytics`, qui ne la rend qu'à un administrateur. |

Fonctions d'écriture : `report_prompts(graine, langue, couples)` — le rapport
d'une partie terminée, une seule fois par graine, borné à trente couples et
nettoyé de ce qui n'est pas une lettre + une catégorie ; chaque couple y porte
aussi les points et les mots qu'il a rendus (facultatifs : un client d'avant
0025 les tait). Fonctions de lecture : `leaderboard_board('day' | 'week' | 'discoveries')` — le
classement du jour, de la semaine (heure de Paris, semaine du lundi) et des
découvertes de la semaine ; `leaderboard_stat(mesure, 'day' | 'week' | 'all')` —
la page des classements (`best`, `points`, `runs`, `words`, `discoveries`,
`combo`, `added`), cinquante lignes avec `rank()` et celle du joueur au-delà
(`extra`) ; `my_friends()` — amis et demandes en cours ; `debug_activity('hour' | 'day' | 'week')`,
`debug_powers()` et `debug_pairs(langue)` — les classements avancés du mode
débug, agrégés et sans un nom de joueur.

Vues : `leaderboard` (record de chaque compte nommé, joueurs maison écartés), `word_popularity` (part des parties où un mot
apparaît), `submission_tally` (combien de joueurs réclament un mot).

## Classements avancés

Plus aucun écran ne les lit depuis que le tableau de bord (0030) les a
remplacés derrière les cinq tapes ; les fonctions restent en base.

- **Un mode caché, pas un écran public** : cinq tapes sur le mot
  « Classement » les ouvrent dans l'application. Les trois fonctions ne
  rendent que des comptes et des moyennes — aucun nom, aucun identifiant — et
  restent réservées aux joueurs connectés, comme les classements.
- **Ce que le profil ne garde pas, la partie le dit** (0025) : les pouvoirs
  possédés et portés restent sur l'appareil, mais chaque partie envoyée
  emporte ceux qu'elle a joués (`runs.powers`), seule façon de répondre
  « quels pouvoirs sortent ». Une partie de robot ou de défi n'en porte
  aucun.
- **Un couple rend ce qu'il a rapporté** : les deux compteurs du tirage
  (0022) ne disaient que « tiré » et « quitté » ; `report_prompts` y ajoute
  les points et les mots de ses réponses. Un couple tiré deux fois dans la
  même partie ne les compte qu'une fois, sur son premier passage.
- **Les joueurs maison ne sont pas la foule** (0026) : leurs parties tournent
  toutes les heures par `pg_cron` — elles gonflaient le rythme du jeu comme si
  les joueurs veillaient la nuit. Les trois fonctions les écartent par leur
  compte (`bots`), jamais par leur nom.
- **L'histoire complète les rapports** : les compteurs de `prompt_stats` ne
  datent que des clients qui rapportent leurs couples, et des points depuis
  0025 seulement. `debug_pairs` y réunit donc les mots joués des parties dont
  aucun rapport n'est arrivé (`prompt_reports` dit lesquelles), avec la lettre
  que le jeu juge (`prompt_letter`, comme `initialOf` côté client). Ces lignes
  portent `reported = false` : leurs tirages quittés sont invisibles, `dealt`
  en est un plancher — « au moins N tirages » — et la part de tirages quittés
  ne se lit que sur les lignes rapportées.
- **Rien de tout cela n'écrit dans `prompt_stats`** : le tirage lit cette
  table (`Judge.pull`), et un `dealt` qui ne compterait que les tirages
  répondus fausserait la cote des couples concernés. L'histoire ne vit que
  dans ce que lisent les classements avancés.
- **Le rythme se lit à l'heure de Paris**, comme les périodes des classements
  (`period_start`) : les vingt-quatre dernières heures, les sept derniers
  jours ou les douze dernières semaines, les cases vides sortant à zéro pour
  que le graphique montre les creux. Les créations de compte sont celles des
  comptes nommés : un joueur anonyme n'en a pas créé.

## Conventions

- **Le client n'écrit que ce qui lui appartient.** Les politiques d'insertion
  vérifient `auth.uid()`, et depuis 0011 une proposition naît `pending` et une
  partie à l'heure du serveur ; rien ne permet d'écrire dans `dictionary_words`
  hors de `settle_review`, pas même un modérateur.
- **Les récompenses passent par une fonction `security definer`**
  (`accept_word`), pas par le client : donner 150 XP est une décision du
  serveur, prise une seule fois, au passage du statut à `accepted`.
- **Ce sont les modérateurs qui font entrer un mot** (`settle_review`) : trois
  « correct », ou un seul d'un super modérateur. Depuis 0007, trois joueurs
  qui réclament le même mot ne suffisent plus. Les seuils sont dans la
  fonction, pas dans le client : les changer ne demande pas de redéploiement.
- **Un modérateur peut aussi signaler un mot à retirer** (0038,
  `propose_ban`) : son signalement est un premier vote, et les autres le
  jugent aux mêmes seuils — « correct » veut dire retirer. La revue porte un
  `kind`, et un mot peut en avoir deux, un ajout et un ban : la dernière
  réglée gagne. **Un ban ne touche pas la base du jeu** : le dictionnaire est
  embarqué dans l'app, et c'est l'import qui retire le mot
  (`scripts/banned-words.ts`, son instantané commité) — un mot signalé reste
  donc jouable jusqu'à la version d'après.
- **Tout vote passe par `cast_vote`** : les tables de modération n'ont aucune
  politique. La fonction refuse un modérateur qui a proposé le mot lui-même,
  un second vote, un cas spécial jugé par un modérateur ordinaire, et une
  correction d'orthographe après le premier vote (`gone`).
- **La file ne se vide jamais pour de bon** (`top_up_moderation`, 0019,
  0037) : un modérateur, super modérateur compris, qui ouvre « Mes demandes »
  avec moins de cinq mots à juger la voit complétée à cinq depuis
  `moderation_reserve`. Un joueur maison propose ces mots, sans en toucher
  d'XP : le reste — votes, dictionnaire, import — ne les distingue pas d'un mot
  de joueur. La réserve se charge par `npm run seed:moderation`
  (`scripts/moderation-reserve.json`), qui écarte ce que les dictionnaires
  embarqués connaissent déjà.
- **Un seul versement par heure, toutes langues confondues** (0023) : le
  renflouage lit `moderation_topup`, la ligne unique que le versement précédent
  a datée, et se tait tant que l'heure n'est pas passée. Sans elle, quelques
  modérateurs à sec vidaient la réserve en quelques minutes. Les mots déjà
  versés restent dans la file pour tout le monde : l'heure ne ferme que le
  versement, jamais la modération. Seul un versement qui a vraiment versé
  referme l'heure (0037) : une réserve à sec la laisse ouverte.
- **Le niveau 6 est écrit en XP dans `moderator_offer_due`** (1650, depuis 0018) : SQL ne
  connaît pas `xpForLevel`. `MODERATOR_LEVEL_XP` et son test
  (`src/domain/moderation.ts`) cassent si la courbe change sans lui.
- **Un profil est lisible par tous les comptes connectés** : c'est ce
  qu'affiche le classement, et rien de sensible n'y est stocké.
- **Les parties sont insérées, jamais modifiées.** Un score ne se corrige pas.
- **Le tirage adaptatif ne lit que la foule** : `prompt_stats` ne garde que
  deux compteurs par couple, et `report_prompts` refuse une graine qui a déjà
  parlé. Un défi ne rapporte rien — sa graine est publique, ses couples connus
  d'avance, et son tirage doit rester le même pour tous (`src/domain/prompts.ts`).
- **Les classements ne montrent que des comptes nommés** : les fonctions
  joignent `auth.users` et écartent `is_anonymous`.
- **Une proposition ne se retire ou ne se corrige qu'en attente** : la politique
  `submissions_withdraw_own` et `amend_submission` exigent `status = 'pending'`,
  et `amend_submission` refuse aussi dès qu'un modérateur a voté.
  Un mot accepté a déjà payé son XP ; un mot refusé reste en archive.
- **Les amitiés s'écrivent par fonction** (`request_friend`, `respond_friend`,
  `remove_friend`) : la table n'a qu'une politique de lecture. Un compte
  anonyme ne peut ni demander ni être trouvé.
- **Un blocage ne se dit pas au bloqué** (`block_player`, par le nom) : sa
  demande suivante lui répond `sent` sans rien écrire. Demander soi-même un
  joueur qu'on a bloqué le débloque.
- **Un joueur peut tout effacer** (`delete_my_account`) : la suppression de
  l'utilisateur d'auth emporte le reste en cascade. Toute nouvelle table liée à
  un joueur doit donc référencer `profiles` avec `on delete cascade`, sans quoi
  l'effacement échoue ou laisse des données derrière lui.

## Défis

- **Hors de `runs` et `run_words`** : la graine d'un défi est connue d'avance,
  un joueur peut s'entraîner dessus avant d'envoyer son score. Ces parties
  n'entrent ni aux classements, ni dans la rareté, ni dans les découvertes ;
  seuls les totaux du profil (XP, parties, mots) bougent.
- **Tout passe par fonction** : `create_challenge`, `invite_to_challenge` (le
  chef seul, huit joueurs au plus), `submit_challenge_run` (une fois par
  invité), `mark_challenge_seen`, `mark_challenge_hidden`, `rematch_challenge`,
  `my_challenges`, `challenge_detail`. Les deux tables n'ont aucune politique.
- **Ce qui est vu ou écarté suit le compte** (`seen_invite_at`,
  `seen_recap_at`, `hidden_stamp`, 0041) : ces marques vivent dans la ligne du
  joueur, pas dans le stockage d'un appareil, pour qu'un défi lu ou masqué sur
  le téléphone le reste dans le navigateur. L'empreinte masquée dit à quoi le
  défi ressemblait quand il a été écarté — un invité qui joue, la clôture, une
  revanche la font changer, et le défi revient de lui-même dans `my_challenges`.
- **Un défi se clôt de lui-même** : chaque invité a joué, ou vingt-quatre
  heures ont passé depuis la dernière partie (`challenge_finished`). Rien ne
  tourne pour le clore, chaque lecture le recalcule.
- **Les mots des autres restent cachés tant qu'on n'a pas joué** :
  `challenge_detail` n'envoie alors que leur instant et leurs points, de quoi
  rejouer la course sans rien à recopier.
- **Une seule revanche par défi** : `rematch_challenge` verrouille la ligne ;
  le second à la demander reçoit celle du premier.
- **Les joueurs maison ne se défient pas** (`challengeable`) : ils ne joueraient
  jamais, et le défi attendrait un jour entier.

## Notifications push

- **La base n'appelle pas Firebase** : elle remplit `push_outbox` (invité
  ajouté, dernière partie jouée, défi échu) et réveille la fonction Edge
  `push` par pg_net ; pg_cron (`push-challenges`) repasse chaque minute.
- **Rien de tout ça ne peut faire échouer une partie** : `kick_push` et les
  déclencheurs avalent leurs erreurs. La base tire elle-même
  `push_secret` dans le Vault, et la fonction y inscrit `push_url` à chaque
  appel (`push_config`) : aucun secret ne se recopie à la main. Tant que la
  fonction n'a jamais été appelée, la file attend.
- **Un bilan ne s'annonce qu'une fois** (`challenges.recap_queued_at`), et
  seulement à ceux qui ont joué.
- **`claim_push_batch` et `finish_push_batch` ne sont ouverts qu'à
  `service_role`** : la fonction Edge seule lit la file. Mise en place :
  [`docs/notifications-push.md`](../docs/notifications-push.md).

## Boîte à idées

- **Même geste que le push** (0009/0010) : la base ne parle pas au monde
  extérieur, elle remplit `ideas` puis, une fois par jour à 7 h UTC
  (`ideas-digest`, pg_cron), réveille la fonction Edge `ideas` par pg_net
  avec un secret qu'elle a tiré elle-même dans le Vault (`ideas_config`,
  qui inscrit `ideas_url` à chaque appel).
- **`submit_idea` accepte un joueur anonyme** : la boîte à idées n'exige pas
  de compte nommé, seulement une session — dix idées par joueur et par jour.
- **`claim_ideas` et `finish_ideas` ne sont ouverts qu'à `service_role`** :
  la fonction Edge seule lit la file, envoie un mail groupé par l'API Resend
  et marque ce qui est parti.
- Mise en place, une fois :
  ```bash
  supabase secrets set RESEND_API_KEY=...
  supabase functions deploy ideas --no-verify-jwt --use-api
  ```
  `IDEAS_FROM` et `IDEAS_TO` ont des valeurs par défaut (expéditeur de test
  Resend, `fongue.jeremy@gmail.com`) ; les changer est optionnel.

## Joueurs maison

- **Maxitoon et Terretciel jouent par `pg_cron`** (`house-bots`, à la minute 17
  de chaque heure, pas la nuit) : une partie modeste, pas à chaque passage.
  Leurs bornes de score se règlent dans `bots`, sans redéploiement.
- **Leurs parties n'ont pas de mots** : un mot de robot fausserait la rareté
  et volerait des découvertes. **Ils ne figurent à aucun classement** (0024) :
  leurs parties restent en base — la liste d'amis, les défis et leur
  avancement les lisent —, mais `leaderboard_board`, `leaderboard_stat` et la
  vue `leaderboard` les écartent par leur compte (`bots`), jamais par leur nom,
  qu'un vrai joueur peut porter. Le seul score maison des tableaux est
  Demontoon, ajouté côté client aux meilleures parties du jour et de la
  semaine.
- **Une demande d'ami vers eux est acceptée à l'insertion**
  (`friendships_bots_accept`). `request_friend` répond quand même `sent`.
- **Invités à un défi, ils acceptent et jouent seuls** : `challenge_players_bots_accept`
  marque l'invitation vue et tire `bot_play_at` entre une et cinq minutes, et
  `house-bots-challenges` (chaque minute, nuit comprise) les marque joués. Sans
  score ni mots : chaque client rejoue leur partie depuis la graine
  (`playBot`, `src/domain/bot.ts`).
- **Personne ne se connecte à leurs comptes** : pas de mot de passe, adresse en
  `.invalid`. Pour les retirer : `select cron.unschedule('house-bots')` et `'house-bots-challenges'`, puis
  effacer leurs utilisateurs d'auth — le reste part en cascade.

## Comptes

- **S'enregistrer ne déplace rien** : le client pose un nom puis appelle
  `auth.updateUser({ email, password })` sur le compte anonyme, qui devient
  permanent avec les parties qu'il a déjà.
- **Se connecter change d'utilisateur** : le client prend un jeton
  (`prepare_merge`) tant que la session anonyme existe, se connecte, puis le
  rend (`complete_merge`) — parties, propositions et totaux passent sur le
  compte, et l'anonyme est effacé. Un identifiant seul ne suffirait pas : le
  classement les expose.
- **Désactiver « Confirm email »** (Authentication → Providers → Email) pour
  qu'un compte serve dès sa création. Activée, l'adresse reste en attente et
  le joueur anonyme jusqu'au clic sur le lien.
- **Mot de passe oublié passe par un code, pas un lien** : un lien ouvrirait
  le navigateur, sans retour possible vers l'app. Le modèle « Reset Password »
  (Authentication → Emails) doit donc afficher `{{ .Token }}` — le modèle par
  défaut n'a que le lien, et le joueur recevrait un mail inutilisable. Le code
  connecte le joueur (`verifyOtp`, type `recovery`, avec la même fusion que
  la connexion), puis le mot de passe est changé depuis le compte.
- **Google se connecte par jeton d'identité** (`signInWithIdToken`) : le
  sélecteur de comptes du téléphone rend un jeton que Supabase vérifie, sans
  page web — Google refuse sa page de connexion dans une WebView. C'est une
  connexion comme une autre (fusion comprise) ; un compte Google neuf naît
  sans nom, et l'interface le lui demande (`needsName`). Pour l'activer :
  1. Google Cloud → Identifiants : un client OAuth **Web** (son identifiant
     va dans `VITE_GOOGLE_WEB_CLIENT_ID` et dans Supabase) et un client
     **Android** pour `fr.lettreminute.app`, avec l'empreinte SHA-1 de la clé
     de signature de Play (Play Console → Intégrité de l'app) *et* celle de la
     clé de debug. Sans client Android à la bonne empreinte, le sélecteur
     échoue sans message. La clé de signature Play n'est pas la clé d'upload :
     l'empreinte de `lettre-minute-upload.jks` ne signe aucune installation.
  2. Google Auth Platform → Audience : publier l'app (« En production »).
     En mode Test, seuls les utilisateurs tests se connectent — et là encore
     le sélecteur échoue sans message. Publier demande une page d'accueil et
     des règles de confidentialité dans Branding, mais pas de validation tant
     qu'il n'y a pas de logo : l'e-mail et le profil ne sont pas sensibles.
  3. Supabase → Authentication → Providers → Google : activer, coller
     l'identifiant et le secret du client Web.

  Dans un navigateur, la page de Google s'ouvre dans une fenêtre surgissante
  qui revient sur `google.html`, puis le jeton suit le même chemin que sur
  téléphone. Revenir par Supabase (`signInWithOAuth`) ferait afficher par
  Google « Accéder à l'application <projet>.supabase.co ». Cela demande en
  plus, dans le client Web de Google Cloud :
  4. Origines JavaScript autorisées : `https://jfongue.github.io` et
     `http://localhost:5199`.
  5. URI de redirection autorisés : `https://jfongue.github.io/lettre-minute/google.html`
     et `http://localhost:5199/google.html`.

## Appliquer

```bash
supabase db push          # ou coller le SQL dans l'éditeur du projet
```

Sans migration appliquée, l'application bascule sur le stockage local : c'est un
mode de fonctionnement normal en développement, pas un bug.

## Tests

```bash
npm run test:db           # ou scripts/test-db.sh moder : seulement les fichiers qui contiennent « moder »
```

- **Un Postgres jetable, pas `supabase start`** : le script lance
  `postgres:17-alpine` dans Docker, applique le prélude puis les migrations dans
  l’ordre, et joue chaque fichier de [`tests/`](tests/) sur sa propre copie de
  la base. Il rend un code d’erreur au moindre échec ; `TEST_DB_KEEP=1` garde le
  conteneur pour l’inspecter.
- **Le prélude simule Supabase** ([`tests/prelude.sql`](tests/prelude.sql)) : rôles
  `anon`, `authenticated` et `service_role`, `auth.users`, `auth.uid()` et
  `auth.jwt()` lus dans `request.jwt.claims`, un Vault en clair, et les droits
  par défaut de Supabase sur `public` — sans eux, un test passerait faute de
  droit là où, en production, seule la RLS protège. pg_cron et pg_net sont des
  extensions factices ([`tests/extensions/`](tests/extensions/)) : la première
  note les tâches, la seconde range ses requêtes dans `net.http_request_queue`
  sans rien envoyer.
- **Un test joue un joueur** par `tests.login('label')` : rôle `authenticated` et
  claims du compte, comme une requête de l’application. Les courses entre deux
  appels passent par dblink, deux sessions qui ne voient que le validé.
- **Docker Desktop peut rester bloqué au `docker pull`** : son gestionnaire
  d’identifiants attend le trousseau quand personne n’est là pour répondre. Si
  l’image manque, le script la tire avec une configuration Docker vide ; l’image
  est publique, aucun identifiant n’est nécessaire.
