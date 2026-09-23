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
- **Une lettre n'est proposée que si la catégorie a au moins
  `MIN_WORDS_PER_PROMPT` mots dessus** : sans ce filtre, le tirage sort des
  couples que personne ne peut résoudre.
- **Les dictionnaires sont du texte brut chargé à la demande**
  (`src/data/packs.ts`). Passer les 48 000 mots en JSON triple la charge utile,
  et tout charger au démarrage fait payer au joueur les catégories qu'il n'a pas
  débloquées.
- **Une catégorie du catalogue sans fichier de mots est écartée du tirage**
  (`src/App.tsx`) : ajouter une entrée à `CATALOGUE` ne suffit pas, il faut
  lancer `npm run import:words` et commiter le `.txt`.
- **Le Wiktionnaire est la source des noms communs**, Wikidata celle des
  entités : Wikidata connaît cinquante races de chat mais pas « abeille ». Une
  catégorie de noms communs bâtie sur Wikidata seul laisse dehors les réponses
  évidentes.
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
  Wikipédia FR (clickstream mensuel). Un mot sans article doit être écrit avec
  zéro visite, pas sans champ : un champ absent fait retomber le domaine sur
  les sitelinks.
- **Les pages vues ne se demandent pas article par article** : 45 000 appels à
  l'API font bannir l'adresse (429) bien avant la fin. Le clickstream se
  télécharge d'un bloc ; seule la résolution libellé → article passe par l'API,
  cinquante titres par appel, en séquentiel et en cache
  (`.cache/frwiki-articles-v2.json`).
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
- **Les récompenses d'XP pour un mot proposé sont décidées côté serveur**
  (`accept_word`), jamais par le client.

## Conventions

- Contenu du jeu (catégories, textes d'interface) en français, avec apostrophe
  typographique (’) ; identifiants et code en anglais.
- Commentaires réservés au *pourquoi* non évident (contrainte cachée, invariant,
  contournement) — jamais au *quoi*, que les noms doivent déjà porter.
- Pas de gestion d'erreur pour des cas qui ne peuvent pas se produire côté
  domaine : la saisie du joueur, Wikidata et Supabase sont les seules frontières
  à valider.
