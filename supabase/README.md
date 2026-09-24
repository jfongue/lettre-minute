# Supabase

Neuf migrations : [`0001_init.sql`](migrations/0001_init.sql) pour le schéma,
[`0002_delete_account.sql`](migrations/0002_delete_account.sql) pour l'effacement
d'un compte depuis l'application, [`0003_accounts.sql`](migrations/0003_accounts.sql)
pour les comptes nommés et l'avatar, [`0004_boards_friends.sql`](migrations/0004_boards_friends.sql)
pour les classements par période et les amis, [`0005_my_submissions.sql`](migrations/0005_my_submissions.sql)
pour retirer ou corriger un mot proposé tant qu'il attend, [`0006_house_bots.sql`](migrations/0006_house_bots.sql)
pour les deux joueurs maison, [`0007_moderation.sql`](migrations/0007_moderation.sql)
pour la modération des mots proposés, [`0008_challenges.sql`](migrations/0008_challenges.sql)
pour les défis entre amis, [`0009_push.sql`](migrations/0009_push.sql) pour
leurs notifications push.

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

Fonctions de lecture : `leaderboard_board('day' | 'week' | 'discoveries')` — le
classement du jour, de la semaine (heure de Paris, semaine du lundi) et des
découvertes de la semaine ; `my_friends()` — amis et demandes en cours.

Vues : `leaderboard` (record de chaque compte nommé), `word_popularity` (part des parties où un mot
apparaît), `submission_tally` (combien de joueurs réclament un mot).

## Conventions

- **Le client n'écrit que ce qui lui appartient.** Les politiques d'insertion
  vérifient `auth.uid()` ; rien ne permet d'écrire dans `dictionary_words` sans
  être modérateur.
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
  déclencheurs avalent leurs erreurs. Sans secrets `push_url` et
  `push_secret` dans le Vault, la file attend.
- **Un bilan ne s'annonce qu'une fois** (`challenges.recap_queued_at`), et
  seulement à ceux qui ont joué.
- **`claim_push_batch` et `finish_push_batch` ne sont ouverts qu'à
  `service_role`** : la fonction Edge seule lit la file. Mise en place :
  [`docs/notifications-push.md`](../docs/notifications-push.md).

## Joueurs maison

- **Maxitoon et Terretciel jouent par `pg_cron`** (`house-bots`, à la minute 17
  de chaque heure, pas la nuit) : une partie modeste, pas à chaque passage.
  Leurs bornes de score se règlent dans `bots`, sans redéploiement.
- **Leurs parties n'ont pas de mots** : un mot de robot fausserait la rareté
  et volerait des découvertes. Ils ne figurent qu'aux classements de score.
- **Une demande d'ami vers eux est acceptée à l'insertion**
  (`friendships_bots_accept`). `request_friend` répond quand même `sent`.
- **Personne ne se connecte à leurs comptes** : pas de mot de passe, adresse en
  `.invalid`. Pour les retirer : `select cron.unschedule('house-bots')`, puis
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

## Appliquer

```bash
supabase db push          # ou coller le SQL dans l'éditeur du projet
```

Sans migration appliquée, l'application bascule sur le stockage local : c'est un
mode de fonctionnement normal en développement, pas un bug.
