# Supabase

Quatre migrations : [`0001_init.sql`](migrations/0001_init.sql) pour le schéma,
[`0002_delete_account.sql`](migrations/0002_delete_account.sql) pour l'effacement
d'un compte depuis l'application, [`0003_accounts.sql`](migrations/0003_accounts.sql)
pour les comptes nommés et l'avatar, [`0004_boards_friends.sql`](migrations/0004_boards_friends.sql)
pour les classements par période et les amis.

## Ce que le serveur détient

| Table | Rôle |
| --- | --- |
| `profiles` | XP, niveau, records, avatar, nom de compte (unique, sauf « Anonyme »). Créé automatiquement à la naissance du compte. |
| `runs` | Une partie terminée : graine, score, série, passes. |
| `run_words` | Les mots d'une partie, forme normalisée — la matière du bonus de rareté. |
| `daily_challenges` | La graine du jour, la même pour tous : base du classement quotidien. |
| `dictionary_words` | Le dictionnaire vivant, en complément des fichiers embarqués. |
| `word_submissions` | Les mots proposés par les joueurs, avec leur statut. |
| `moderators` | Qui peut valider ou rejeter à la main. |
| `friendships` | Une ligne par demande d'ami (`pending` puis `accepted`), lue dans les deux sens. |
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
- **Trois propositions distinctes suffisent** pour qu'un mot entre au
  dictionnaire (`auto_accept_word`). Le seuil est dans la fonction, pas dans le
  client : le changer ne demande pas de redéploiement de l'application.
- **Un profil est lisible par tous les comptes connectés** : c'est ce
  qu'affiche le classement, et rien de sensible n'y est stocké.
- **Les parties sont insérées, jamais modifiées.** Un score ne se corrige pas.
- **Les classements ne montrent que des comptes nommés** : les fonctions
  joignent `auth.users` et écartent `is_anonymous`.
- **Les amitiés s'écrivent par fonction** (`request_friend`, `respond_friend`,
  `remove_friend`) : la table n'a qu'une politique de lecture. Un compte
  anonyme ne peut ni demander ni être trouvé.
- **Un joueur peut tout effacer** (`delete_my_account`) : la suppression de
  l'utilisateur d'auth emporte le reste en cascade. Toute nouvelle table liée à
  un joueur doit donc référencer `profiles` avec `on delete cascade`, sans quoi
  l'effacement échoue ou laisse des données derrière lui.

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
