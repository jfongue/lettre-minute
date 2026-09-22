# Supabase

Une seule migration pour l'instant : [`migrations/0001_init.sql`](migrations/0001_init.sql).

## Ce que le serveur détient

| Table | Rôle |
| --- | --- |
| `profiles` | XP, niveau, records. Créé automatiquement à la naissance du compte. |
| `runs` | Une partie terminée : graine, score, série, passes. |
| `run_words` | Les mots d'une partie, forme normalisée — la matière du bonus de rareté. |
| `daily_challenges` | La graine du jour, la même pour tous : base du classement quotidien. |
| `dictionary_words` | Le dictionnaire vivant, en complément des fichiers embarqués. |
| `word_submissions` | Les mots proposés par les joueurs, avec leur statut. |
| `moderators` | Qui peut valider ou rejeter à la main. |

Vues : `leaderboard` (classement), `word_popularity` (part des parties où un mot
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

## Appliquer

```bash
supabase db push          # ou coller le SQL dans l'éditeur du projet
```

Sans migration appliquée, l'application bascule sur le stockage local : c'est un
mode de fonctionnement normal en développement, pas un bug.
