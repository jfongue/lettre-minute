# Supabase

Seize migrations : [`0001_init.sql`](migrations/0001_init.sql) pour le schéma,
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
pour la boîte à idées, et [`0016_challenge_setup.sql`](migrations/0016_challenge_setup.sql)
pour qu'un défi autorise ou non les pouvoirs.

## Ce que le serveur détient

| Table | Rôle |
| --- | --- |
| `profiles` | XP, niveau, records, avatar, nom de compte (unique, sauf « Anonyme »). Créé automatiquement à la naissance du compte. |
| `runs` | Une partie terminée : graine, score, série, passes. |
| `run_words` | Les mots d'une partie, forme normalisée — la matière du bonus de rareté. |
| `daily_challenges` | La graine du jour, la même pour tous : base du classement quotidien. |
| `dictionary_words` | Le dictionnaire vivant, en complément des fichiers embarqués. |
| `word_submissions` | Les mots proposés par les joueurs, avec leur statut ; `seen_at` éteint la pastille de « Mes demandes ». |
| `word_reviews` | Un mot proposé en cours de jugement (catégorie + mot), que rejoignent tous ceux qui l'ont réclamé. |
| `moderation_votes` | Un vote par modérateur et par mot : `correct`, `unsure`, `incorrect` ou `special`. |
| `moderators` | Les modérateurs, et l'ami qui les a élus. |
| `moderator_offers` | Les propositions de modérer (niveau, mots acceptés, ami) et la réponse du joueur. |
| `friendships` | Une ligne par demande d'ami (`pending` puis `accepted`), lue dans les deux sens. |
| `bots` | Les joueurs maison (Maxitoon, Terretciel) et les bornes de leurs scores. |
| `challenges` | Un défi entre amis : langue, graine, catégories, chef, et la revanche qui lui fait suite. |
| `challenge_players` | Un invité par ligne, puis sa partie : score, passes, série, mots en JSON ; ce qu'il a vu (invitation, bilan). |
| `push_tokens` | Le jeton FCM de chaque téléphone, le compte qui s'y est connecté en dernier, et la langue de ses messages. |
| `push_outbox` | Les pushs à envoyer (invitation, bilan), vidés par la fonction Edge `push`. |
| `account_merges` | Jetons à usage unique : versent un compte anonyme dans le compte auquel il se connecte. |
| `blocks` | Qui a bloqué qui. Bloquer efface l'amitié ; les demandes du bloqué ne sont plus écrites. |
| `challenge_reactions` | Une réaction (emoji) par joueur et par trophée ou mot du bilan d'un défi. |
| `ideas` | Une idée envoyée en texte libre par un joueur, vidée une fois par jour par la fonction Edge `ideas`. |

Fonctions de lecture : `leaderboard_board('day' | 'week' | 'discoveries')` — le
classement du jour, de la semaine (heure de Paris, semaine du lundi) et des
découvertes de la semaine ; `my_friends()` — amis et demandes en cours.

Vues : `leaderboard` (record de chaque compte nommé), `word_popularity` (part des parties où un mot
apparaît), `submission_tally` (combien de joueurs réclament un mot).

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
- **Tout vote passe par `cast_vote`** : les tables de modération n'ont aucune
  politique. La fonction refuse un modérateur qui a proposé le mot lui-même,
  un second vote, un cas spécial jugé par un modérateur ordinaire, et une
  correction d'orthographe après le premier vote (`gone`).
- **Le niveau 6 est écrit en XP dans `moderator_offer_due`** (2550) : SQL ne
  connaît pas `xpForLevel`. `MODERATOR_LEVEL_XP` et son test
  (`src/domain/moderation.ts`) cassent si la courbe change sans lui.
- **Un profil est lisible par tous les comptes connectés** : c'est ce
  qu'affiche le classement, et rien de sensible n'y est stocké.
- **Les parties sont insérées, jamais modifiées.** Un score ne se corrige pas.
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
  invité), `mark_challenge_seen`, `rematch_challenge`, `my_challenges`,
  `challenge_detail`. Les deux tables n'ont aucune politique.
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
  et volerait des découvertes. Ils ne figurent qu'aux classements de score.
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
