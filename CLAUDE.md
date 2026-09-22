# CLAUDE.md

Repère pour un LLM qui reprend ce dépôt à froid.

## À lire d'abord

[`README.md`](README.md) — commandes, boucle de jeu, barème, architecture. Source
de vérité ; ne pas la dupliquer ici, seulement la compléter par ce qu'un nouvel
arrivant casserait sans le savoir.

## Pièges connus

- **`src/domain/` n'a aucune dépendance vers React ni le DOM**, et doit le rester :
  c'est ce qui le rend testable et rejouable à l'identique depuis sa graine.
  Toute nouvelle règle s'y écrit d'abord, avec ses tests.
- **La graine vient de l'interface** (`App.tsx`), jamais du domaine : aucun
  `Math.random` ni `Date.now` sous `src/domain/`.
- **L'ordre de `CATEGORIES` fait partie de la graine** : `shuffled` parcourt la
  liste dans l'ordre. Trier ou réordonner le catalogue change toutes les parties
  déjà distribuées depuis une graine donnée.
- **Une catégorie ajoutée doit déclarer ses lettres impossibles** (`unplayable`).
  Sans ça, elle sortira sur un tirage où la table reste muette — `card.test.ts`
  vérifie l'inverse, pas l'oubli.
- **Le chrono se recalcule depuis `Date.now()` à chaque frame**, pas en cumulant
  le delta : un onglet en arrière-plan suspend `requestAnimationFrame` mais pas
  l'horloge murale.
- **Le dépouillement écrit dans `session.sheet`, jamais dans le match** : le match
  n'est mis à jour qu'une fois la dernière catégorie saisie (`recordRound`), ce
  qui laisse le bouton « Retour » corriger une réponse sans défaire de points.

## Conventions

- Contenu du jeu (catégories, textes d'interface) en français, avec apostrophe
  typographique (’) ; identifiants et code en anglais.
- Commentaires réservés au *pourquoi* non évident (contrainte cachée, invariant,
  contournement) — jamais au *quoi*, que les noms doivent déjà porter.
- Pas de gestion d'erreur pour des cas qui ne peuvent pas se produire côté
  domaine : la saisie du joueur est le seul point de validation.
