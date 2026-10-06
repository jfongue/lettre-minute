# Quick wins — par quoi commencer, et pourquoi

Complément de l'audit du 6 octobre 2026. Ici, rien que des correctifs **S** (petits), qui ne touchent
**aucune règle du jeu**, **aucune dépendance**, **aucune forme décorative**, et qui restent dans la palette
et les sept langues existantes. Chaque point est expliqué : ce que le joueur vit aujourd'hui, ce qu'on
change, et ce que ça donne.

Trois lots, dans l'ordre où je les ferais. Le lot 1 corrige ce qui fait perdre quelque chose au joueur
ou ce qui ment à l'écran ; le lot 2 polit la partie ; le lot 3 répare des promesses (argent, compte,
données).

---

## Lot 1 — à faire avant tout

### 1. Le retour Android ne doit plus fermer l'app depuis l'éditeur d'avatar

**Aujourd'hui.** À l'accueil, tu ouvres ta tuile avatar et tu changes une couleur. Tu appuies sur le retour
du téléphone (la flèche ou le geste) : **l'app se ferme**, comme si ce retour voulait dire « quitter ». La
modification non enregistrée est perdue. Même chose depuis l'écran de modération, qui n'a aucun retour non
plus.

**Pourquoi.** L'app tient une pile d'écrans : chaque couche qui s'ouvre dit « le retour me ferme, moi ».
Le tiroir du menu le fait, l'éditeur d'avatar ne le fait pas — il tombe donc jusqu'à la règle générale,
qui est « retour = quitter l'app » (`App.tsx:671`).

**Le correctif.** Une ligne dans `AvatarScreen.tsx` (et une dans `ModerationScreen.tsx`) qui dit : ce
retour ferme cette feuille, pas l'app.

**Ce que ça change.** On ne perd plus son travail, et l'app ne disparaît plus sous le doigt.

**Risque.** Aucun. Aucun texte, aucune couleur, aucune règle.

### 2. Le refus de saisie doit se voir, et cesser de mentir

**Aujourd'hui, deux problèmes dans la seule ligne de feedback de la partie.**
- Tu tapes « zzzz » alors que la lettre est G : sous le trait, une ligne grise annonce « commence par G ».
  Elle a exactement la même couleur, la même taille et le même ton que les textes neutres — le succès, lui,
  a sa couleur, son son et sa rareté. Le refus passe inaperçu.
- Pendant que tu écris un mot valide (« ch… » avant « chat »), cette même ligne annonce **« inconnu du
  dictionnaire »** : le jeu juge un mot qui n'est pas fini. Le joueur apprend à ignorer la ligne.

**Le correctif.** (a) Donner aux trois refus (« ne commence pas par la bonne lettre », « déjà donné »,
« inconnu ») une marque visuelle propre. (b) Ne rien annoncer tant que le doigt écrit : attendre environ
350 ms sans frappe, ou la validation — le succès, lui, reste immédiat.

**Ce que ça change.** La ligne de feedback redevient crédible, et un refus se remarque enfin.

**Risque.** Aucun : aucun texte d'aide n'est réécrit, la rareté n'est toujours révélée qu'à la validation.

### 3. Le gain et le palier du mot restent lisibles une seconde

**Aujourd'hui.** Tu valides « Chartreuse » : tu vois « +40 » et l'étiquette du palier. Dès que tu tapes la
première lettre du mot suivant, **tout disparaît**. Dans une course de 60 s, tu ne lis donc presque jamais
la rareté de ce que tu viens de trouver — alors que c'est la récompense centrale du jeu.

**Le correctif.** Garder cet affichage environ 1,2 s après la validation (un petit minuteur), au lieu de
l'effacer à la frappe suivante.

**Ce que ça change.** La rareté, les points et la série deviennent enfin visibles, sans ralentir la partie.

**Risque.** Aucun. La rareté reste cachée avant validation : la règle « le son ne révèle rien avant » tient.

### 4. Les textes secondaires repassent au-dessus du seuil de lisibilité

**Aujourd'hui.** Les petites notes grises — « 3 mots · 1 passé », l'indice de catégorie « Crus ou cuits »,
les notes du bilan — sont dans un gris qui donne **3,16:1** de contraste en clair. Le seuil de lisibilité
usuel (WCAG AA) est 4,5:1. Elles sont donc difficiles à lire, surtout en plein soleil.

**Le correctif.** Utiliser la couleur voisine déjà présente dans la palette (`--ink-soft`, 7,6:1). Une
valeur, aucun nouveau gris.

**Ce que ça change.** Tous les écrans d'un coup, y compris en thème sombre.

**Risque.** Aucun : c'est la même palette, juste plus lisible.

### 5. Les boutons colorés se lisent en thème sombre

**Aujourd'hui.** « Créer un compte » (rouge), « Bloquer », et le bouton bleu de la partie écrivent en crème
sur fond coloré : **2,94:1** en sombre pour le rouge. La nuit, ces boutons se lisent mal.

**Le correctif.** Écrire en noir sur le rouge — ce que le tag jaune fait déjà — et assombrir légèrement le
bleu dans les deux blocs du thème sombre (ils doivent rester identiques, c'est la règle du dépôt).

**Ce que ça change.** Les boutons qu'on utilise réellement (compte, bloquer, valider) redeviennent nets.

**Risque.** Faible : c'est une valeur de couleur, pas une forme, pas une mise en page.

### 6. On ne propose plus un mot à moitié tapé

**Aujourd'hui.** Dès que le verdict est « inconnu » — donc dès les premières lettres — un bouton
« le proposer » apparaît sous le champ. Une frappe ratée l'envoie dans la file de modération : le mot
part tronqué, sans confirmation, et un modérateur devra le juger.

**Le correctif.** N'afficher ce bouton qu'après un refus **validé** (appui sur Valider ou Entrée).

**Ce que ça change.** Moins de déchets dans la modération, moins de confusion pour le joueur.

**Risque.** Aucun.

---

## Lot 2 — la partie, juste après

### 7. Quitter une partie demande deux appuis

**Aujourd'hui.** Un balayage retour en pleine partie efface la manche : rien n'est enregistré, aucune
question. Le duel, lui, demande confirmation avant de quitter la table.

**Le correctif.** Deux retours rapprochés (moins de 2 s) pour abandonner. Aucun texte à écrire.

### 8. Le retour du tiroir remonte au profil, pas à l'accueil

**Aujourd'hui.** Dans Statistiques, Classements, Mes catégories ou une fiche d'ami, le retour ramène à
l'accueil au lieu du profil : on perd deux appuis et on ne sait plus où on en était.

**Le correctif.** La sous-page s'inscrit dans la même pile que le tiroir.

### 9. « Valider » répond au doigt

**Aujourd'hui.** Sur mobile, appuyer sur Valider quand le mot est refusé ne produit rien : ni son, ni
secousse. Le refus ne passe que par la touche « Terminé » du clavier. Le bouton principal paraît mort.

**Le correctif.** Faire passer le refus aussi par l'appui sur le bouton.

### 10. Les petits boutons atteignent 44 px

**Aujourd'hui.** « le proposer » et « passer » du tutoriel mesurent 36 px de haut, collés au champ : on les
rate au pouce (la cible recommandée est 44 px).

**Le correctif.** Les porter à 44 px, comme le bouton de son le fait déjà.

### 11. Le texte d'invite du champ redevient visible

**Aujourd'hui.** « un mot en G… » est affiché dans un gris très pâle à **1,88:1** (gris + opacité 60 %) :
il disparaît presque sur le papier.

**Le correctif.** Retirer l'opacité et prendre la couleur des textes secondaires lisibles.

### 12. « Jouer » répond dès la première image

**Aujourd'hui.** Le bouton « Jouer » n'existe pas pendant les 650 premières millisecondes de l'accueil : le
doigt, déjà posé, ne touche rien.

**Le correctif.** Afficher le corps de l'accueil au premier rendu, et ne garder l'écran d'attente que pour
l'attente du serveur.

---

## Lot 3 — les promesses (argent, compte, données) : une livraison « confiance »

Ces points ne coûtent presque rien mais ils se voient dans les endroits où le joueur donne sa confiance.

### 13. Retirer deux avantages Premium qui n'existent pas
La fenêtre Premium promet « des catégories exclusives » et « des modes de jeu événements »
(`Checkout.tsx:66-71`). Aucun verrou premium n'existe dans le catalogue ni dans les fonctionnalités : on
vend du vide. **Le correctif** : retirer ces deux lignes, ou les étiqueter « à venir ».

### 14. Dire le vrai plafond des catégories bannies
L'offre écrit « bannis autant de catégories que tu veux » alors que le jeu en autorise **cinq**, ce qu'il
dit lui-même ailleurs. **Le correctif** : faire lire le plafond réel dans la phrase.

### 15. Prévenir du risque du compte anonyme
Le panneau de compte ne parle que du suivi entre appareils. Le joueur n'apprend jamais que sans compte,
niveau, records, catégories, pouvoirs et amis **partent avec le téléphone** — et le premier avertissement
arrive après la perte. **Le correctif** : une phrase (« sans compte, tout reste sur ce téléphone : il part
avec lui ») dans le panneau de compte et dans le bilan.

### 16. Confirmer la déconnexion
« Se déconnecter » efface d'un tap le profil, l'historique et les propositions en attente de l'appareil,
alors que l'effacement des données est, lui, doublement confirmé. **Le correctif** : la même confirmation,
en disant ce qui reste sur le serveur et ce qui part.

### 17. Montrer les révélations gratuites qui restent
Le joueur dispose de cinq révélations gratuites, consommées en silence ; le mur Premium arrive sans qu'on
l'ait vu venir. **Le correctif** : afficher « x / 5 » sur le compteur déjà présent.

### 18. Réparer le repli du lien confidentialité
Le lien de confidentialité retombe sur une adresse **relative** si la variable de build manque
(`Menu.tsx:65`). Dans l'app Android, une page relative fait quitter le jeu à la WebView sans retour —
c'est écrit noir sur blanc dans les notes du dépôt. **Le correctif** : supprimer ce repli, ou mettre une
adresse complète.

### 19. Deux finitions de langue
Le premier écran écrit « Lettre Minute » en dur au lieu de lire le nom traduit du jeu, et changer de langue
coche le nouveau choix même si le fichier de langue n'a pas pu se charger (l'interface reste alors en
français). **Le correctif** : lire le nom traduit ; ne changer la langue qu'après un chargement réussi.

---

## En réserve, quand on passe par là

- « moyenne récente » → « moyenne des 10 dernières » (à côté d'une tendance qui, elle, chiffre sa fenêtre).
- L'explication du bannissement se marque lue à l'ouverture : elle s'éteint même si la feuille est balayée.
- La note « aucune carte demandée » arrive après le bouton « Payer 0,00 € » : le doute naît avant la réponse.
- La cohérence des noms du mode à plusieurs (« Multijoueur » → « Jouer entre amis » → « Défis entre amis »).
- Le parallélisme des trophées : « Le mouton », « Les gros doigts » à côté d'un émoji moqueur.

## Comment je vérifierais

- `npm run check` (lint + types + tests) : aucune règle du jeu n'est touchée, il doit rester vert.
- Sur téléphone : le geste retour depuis l'éditeur d'avatar (point 1), une partie avec un mot refusé puis un
  mot validé (points 2, 3, 9), et un mot refusé au doigt sur Valider (point 9) — c'est le seul endroit que
  les tests ne couvrent pas.
- Rien à mesurer de nouveau : le relevé d'usage suit déjà quels boutons sont touchés, écran par écran.
