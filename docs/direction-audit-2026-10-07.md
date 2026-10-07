# Audit direction artistique — audio, motion, visuel, feedback

7 octobre 2026 · révision `2390fd5` · **lecture seule : aucune ligne de jeu modifiée**.

Complète l'[audit UX du 6 octobre](ux-audit-2026-10-06.md), qui traitait le parcours et les promesses.
Ici : le *ressenti* — ce qui s'entend, ce qui bouge, ce qui se voit, ce qui répond au doigt.
Le backlog est écrit en fiches prêtes à découper (fichiers = périmètre d'écriture, pour que deux
agents ne se marchent pas dessus).

## Méthode

- Lecture de code sur quatre axes : audio (`src/lib/sound.ts`, ses 40 points d'appel), animation et
  fluidité (`styles.css`, `duel.css`, hooks `useFlip`/`useLeaving`/`useCountUp`), visuel statique
  (tokens, icônes, typographie, contrastes), feedback et états (`RunScreen`, `DuelScreen`, attentes
  réseau, haptique).
- Les ratios de contraste de ce document sont **recalculés** sur les jetons réels (WCAG 2.1, luminance
  relative), pas repris d'un relevé antérieur : deux chiffres qui circulaient étaient faux
  (`cream` sur `--blue` = 6,35:1 et non 4,16:1 — le bleu n'est pas à corriger ; `--blue` sur le papier
  sombre = 3,86:1).
- **Aucun rendu réel ni mesure de performance** : ni serveur lancé, ni trace, ni capture. Les constats
  de jank et de latence sont déduits du code et marqués « à confirmer » quand ils en dépendent.

## Cinq constats structurants

1. **L'audio est bien fait, mais il se tait là où l'app a l'air cassée.** Un seul module, quatre bus,
   un compresseur, une réverb, aucun son qui lève, la musique suit les écrans autour de la partie.
   Les trous sont précis : au retour d'arrière-plan les cues de la première seconde sont avalés
   (`sound.ts:748-790`), glisser un curseur de volume à zéro ne joue plus rien (`Menu.tsx:552-555`),
   le bouton muet est le seul bouton de l'app qui ne clique pas (`MuteButton.tsx:19`), et rien ne suit
   le chrono entre 10 s et 3 s alors que l'écran, lui, s'allume à 10 s (`RunScreen.tsx:17` vs
   `sound.ts:445-451`).
2. **Le chrono coûte un rendu complet de l'app dix fois par seconde, pendant la frappe.** `useElapsed`
   est lu dans `App.tsx:757` et faisait redescendre `elapsed`/`remaining`/`pulseStage`/`rivals` dans
   tout l'arbre ; le disque est un `conic-gradient` dont la borne change à chaque tick
   (`styles.css:857`, `RunScreen.tsx:212`), donc un repaint du disque 10×/s sur le même élément qui
   joue déjà `throb`. C'est le seul chantier vraiment structurel du lot (B1, B2).
3. **Le langage de mouvement n'a ni durée partagée ni lexique unique.** Trois easings sont
   mutualisés (`styles.css:23-25`), **aucune durée** : 118 `@keyframes`, ~235 déclarations
   `animation:`, des entrées de 320 à 700 ms pour le même geste, et `.dealt li` qui alterne 620 ms et
   480 ms (`styles.css:1132-1138`). Pire pour la maintenance : `stamp` existe en trois versions et
   `breathe` en deux, avec des corps différents. Les sorties d'écran, elles, n'existent pas : tout
   entre en 400-700 ms, rien ne sort, sauf le tiroir et les cartes de vote.
4. **Deux jetons passent sous le seuil de lisibilité, et c'est le même depuis le 6 octobre.**
   `--ink-faint` vaut **3,16:1** sur le papier clair, **2,75:1** sur les boutons inertes et **4,11:1**
   en sombre (`styles.css:7,43,61`) : c'est la couleur des notes, des sous-titres, des états
   désactivés. `.unlock` écrit en crème sur rouge (**3,61:1** clair, **2,94:1** sombre,
   `styles.css:1312-1313`) alors que `.btn--red` a déjà reçu le bon correctif (noir sur rouge,
   `styles.css:370-371`). Les quick wins Q1 et Q3 de l'audit du 6 octobre n'ont pas été appliqués :
   `.note` est toujours `--ink-faint` (`styles.css:224-227`), le placeholder garde son `opacity: .6`
   (`styles.css:1021-1025`).
5. **Le retour d'action est riche en partie, pauvre en attente.** Le solo dit tout par le son, la
   couleur et la secousse — mais sa ligne de verdict n'a **aucun `aria-live`** (`RunScreen.tsx:443-539`,
   le duel en a partout), l'haptique n'existe que sur les écrans de récompense, un envoi de partie
   qui échoue ne se sait pas (`cloud.ts` rend un repli muet, `App.tsx:1434-1438`), et les listes en
   chargement affichent un `<p>` sans `role="status"` ni `aria-busy`
   (`RequestsPage.tsx:176`, `FriendsView.tsx:99`, `ChallengeScreen.tsx:666`).

---

# Backlog

Effort : **S** ≈ une session courte, un fichier · **M** ≈ une demi-journée, quelques fichiers ·
**L** ≈ chantier, à découper. « Acceptation » = ce qui prouve que c'est fini.

## Lot A — Audio

| # | Tâche | Preuve | Effort | Risque |
|---|---|---|---|---|
| A1 | **Réveiller l'audio au retour d'arrière-plan** : au `focus`/`visibilitychange` revenu, `ctx.resume()` **puis** un `wake` immédiat et une resynchronisation de la musique et de `pulseStage`, pour que les cues de la seconde suivante ne soient plus avalés (`live()` rend `null` tant que le contexte est suspendu). | `sound.ts:748-790`, `sound.ts:158-162` | S | Faible |
| A2 | **Entendre ce qu'on règle** : `previewChannel` doit jouer même si le curseur visé est à 0 (échantillon au niveau courant, pas au niveau réglé) et `MuteButton` doit cliquer comme tous les autres boutons — c'est le seul hors `TAPPABLE` (`App.tsx:732`). | `Menu.tsx:552-555`, `sound.ts:298`, `MuteButton.tsx:19` | S | Faible |
| A3 | **Deux paliers d'urgence au chrono** : 10 s discret (une note, pas de boucle) et 3 s marqué, au lieu du seul tick ≤ 3 s, sinon 7 s de silence entre l'allumage visuel et le premier son. À valider à l'oreille : le risque est d'être envahissant. | `RunScreen.tsx:17,174-176`, `sound.ts:445-451` | S | Faible |
| A4 | **Un cue pour la mort et la fin de manche au duel** : `dead` réutilise aujourd'hui `timeUp` et `crowned` arrive sur un chrono épuisé — deux moments distincts, deux timbres distincts. | `DuelScreen.tsx:756,951`, `sound.ts:311-388` | S/M | Faible |
| A5 | **Nettoyer nœuds et timers** : `tone`/`hiss` ne déconnectent jamais leur `GainNode` (`osc.onended = () => gain.disconnect()`), et trois `setTimeout` sonnent après démontage. | `sound.ts:170-198`, `DuelScreen.tsx:951`, `TutorialScreen.tsx:70`, `ModeTutorial.tsx:80` | S | Faible |
| A6 | **Combler les sons d'interface manquants** : fin de tutoriel (règles terminées), partage d'un défi/duel, refus d'un mot proposé (limite atteinte), appui long (bannir, expulser), et un cue descendant au bilan quand le record **n'est pas** battu (contrepartie de `record()`). | `ModeTutorial.tsx:268`, `DuelTutorial.tsx:268,307`, `DuelScreen.tsx:886`, `App.tsx:1327`, `OverScreen.tsx:345` | M | Faible |
| A7 | **Arbitrer les niveaux et le ducking à l'écoute** : `effects` 0,8 contre `keys` 0,6 (`state/sound.ts:15`), un commentaire faux (« +8 dB » pour `MAKEUP_GAIN = 2.5`, `sound.ts:39`), et sous Silence le passe-bas du bus maître étouffe aussi les effets : musique et voix s'y confondent. Vérifier à l'oreille avant de toucher, ne pas « calmer » le bus maître (règle du dépôt). | `sound.ts:39,145,269-274,714`, `state/sound.ts:15` | M | Moyen (oreille) |
| A8 | **Session audio native (Android/iOS)** : aucun réglage de focus audio dans `src/lib/native.ts` ; sur iOS le mode silencieux coupe le jeu, et une autre app en lecture ne fait ni pause ni atténuation. **À arbitrer avec Jérémy** : non testable ici, L. | `src/lib/native.ts`, `android/` | L | Moyen |

**Acceptation lot A** : une partie jouée téléphone en poche puis rouverte sonne comme si on ne l'avait
pas quittée ; les deux paliers d'urgence s'entendent ; `npx vitest run src/lib` (ou la suite) vert ;
`npm run check` vert.

## Lot B — Motion et fluidité

| # | Tâche | Preuve | Effort | Risque |
|---|---|---|---|---|
| B1 | **Sortir le chrono du rendu global** : un composant `<Timer>` mémoïsé (ou un `useSyncExternalStore` sur le tick) qui lit lui-même `elapsed`/`remaining`, au lieu de faire redescendre la valeur dans `App.tsx` et de re-rendre l'arbre entier 10×/s en pleine frappe. Attention : la fin de partie dépend de `remaining <= 0` (`App.tsx:784-786`), ce déclencheur doit rester fiable. | `App.tsx:757-786`, `ui/RunScreen.tsx:212-213` | M | Moyen |
| B2 | **Disque du chrono sans repaint** : un masque constant + `transform: rotate()` piloté par le même ratio, au lieu du `conic-gradient(var(--ratio))` réécrit 10×/s. Vérifier les deux thèmes (le disque partage sa bordure avec `--ink`). | `styles.css:852-858`, `ui/RunScreen.tsx:212-213` | M | Faible visuel |
| B3 | **Des durées tokenisées** : `--dur-tap`/`--dur-in`/`--dur-out`/`--dur-slow` à côté des trois easings, puis remplacer par famille (`pop-in`, `rise`, `slide-from-*`, entrées de `.sheet`). Corriger au passage l'asymétrie accidentelle de `.dealt li` (620 ms vs 480 ms). | `styles.css:23-25,1132-1138`, `duel.css` | M | Faible |
| B4 | **Renommer les keyframes homonymes** : `stamp` ×3 et `breathe` ×2, corps différents — une édition vise aujourd'hui le mauvais bloc selon la cascade. Gain de sûreté, zéro effet visuel. | `styles.css:2863,2898,3906,5468,5576` | S | Nul |
| B5 | **Supprimer le dernier reflow d'animation** : `transition: height 240ms` sur `.leaderboards-track` → animer `grid-template-rows`/`max-height`, ou piloter en WAAPI. Les autres cas coûteux (`filter`, `box-shadow`) sont ponctuels et déjà découpés quand ça comptait. | `styles.css:1581-1584` | S | Faible |
| B6 | **Ne rien animer quand l'écran est caché** : le battement de 100 ms du duel (`setInterval(beat, 100)`) et les relectures 450 ms/1 s/2,5 s ne testent pas `document.hidden`, alors que `ChallengeScreen.tsx:588` le fait déjà et que `hidden` existe dans le même fichier. Un `sync()` au retour est déjà prévu. | `state/duel.ts:472-486` | S | Faible |
| B7 | **Un seul langage de tap et une sortie d'écran** : `:active` n'existe que dans 18 règles pour ~8 800 lignes (cartes de réactions, lignes de classement, sièges de duel n'ont rien), et les écrans routés se remplacent d'un coup alors que le tiroir sort proprement (`menu-out`, `styles.css:2705-2715`). Une sortie courte (150-200 ms), à faire en **un seul endroit** du routage. | `styles.css:341,1170,1562,4493,…`, `ui/Menu.tsx:166`, `App.tsx` | M | Moyen (routage) |

**Acceptation lot B** : profil de performance sur une partie — plus de rendu global à 10 Hz (B1) ni de
repaint du disque (B2) ; `prefers-reduced-motion` continue de tout couper (le balai
`styles.css:3400-3409` et les gardes JS `useCountUp.ts:3` restent la référence) ; captures avant/après
des écrans touchés par B3/B7, clair et sombre.

## Lot C — Visuel statique

| # | Tâche | Preuve | Effort | Risque |
|---|---|---|---|---|
| C1 | **Remonter `--ink-faint` au-dessus de 4,5:1 dans les trois blocs** (clair, média sombre, `data-theme="dark"`) : notes, sous-titres, états inertes. Les deux blocs sombres doivent rester identiques — c'est la règle du dépôt et ils le sont aujourd'hui. Effet global, une valeur. | `styles.css:7,43,61` (mesures ci-dessus), usages `:226,353,379,405,638,1022,1931` + `duel.css` | S | Faible |
| C2 | **`.unlock` en noir sur rouge** comme `.btn--red` : 3,61:1 clair / 2,94:1 sombre aujourd'hui. | `styles.css:1312-1313` vs `370-371` | S | Nul |
| C3 | **Un plancher typographique** : onze tailles à 0,58-0,68 rem (9,3 à 10,9 px) — `.features-cell::before`, `podium-word--smaller`, `.friend-moderator`, `.tag`, axes du graphe, plusieurs en duel. Une variable `--font-micro` ≥ 0,7 rem, appliquée par famille. | `styles.css:752,1621,4368,8505`, `duel.css:882,1023,1048` | M | Faible |
| C4 | **Cibles tactiles** : `.avatar-grid` à 10 colonnes donne ~28 px par cellule sur 360-375 px (sous les 40 px recommandés) ; `.challenge-word` (39 px), `.standing--me` (36 px) et `.power-slot` (34 px) sont aussi sous le seuil alors que `.btn` est à 52 px. | `styles.css:3050-3052,1490,3565,5450` | M | Faible |
| C5 | **Cohérence d'icônes** : une échelle de `stroke-width` (4/7/10) et un seul `stroke-linecap` (arrondi partout — le chevron des lignes est carré, `styles.css:6454`) ; remplacer les ✓/✕/★ en texte (`RunScreen.tsx:446,524`, `PowerSlots.tsx:146`, `UnlockScreen.tsx:158`) par les SVG déjà dessinés dans `VerdictMark.tsx` ; supprimer les classes `.tier-*` orphelines si personne ne les utilise. | `CategoryIcon.tsx:16-19,102-103`, `PowerIcon.tsx:46,67,72`, `TrophyIcon.tsx:56,82`, `styles.css:1405-1416` | S/M | Faible |
| C6 | **Sortir les deux scrims en dur** de `rgba(21, 21, 21, 0.45)` : ils ne s'inversent pas en sombre, contrairement à tout le reste. | `styles.css:1758,4961` | S | Nul |
| C7 | **Dériver `PALETTE` des jetons** au lieu de réécrire les mêmes hex dans le domaine (sept couleurs + le gris `--ink-faint` recopié) : une teinte bouge aujourd'hui à deux endroits. Le domaine ne peut pas importer du CSS : passer par une table d'identifiants → variables, ou assumer la duplication par un test de cohérence. | `src/domain/avatar.ts:220-226,248` vs `styles.css:3-19` | M | Faible |

**Acceptation lot C** : les ratios ci-dessus recalculés au-dessus de 4,5:1 pour le texte courant ;
captures des écrans touchés en clair et sombre, 375 px et bureau ; `npm run check` vert.

## Lot D — Feedback et accessibilité des retours

| # | Tâche | Preuve | Effort | Risque |
|---|---|---|---|---|
| D1 | **`aria-live="polite"` sur la ligne de verdict solo** : mot trouvé, à une lettre près, refus, sort du silence pour un lecteur d'écran. Le duel le fait déjà partout. | `RunScreen.tsx:443-539` vs `DuelScreen.tsx:403,825,903` | S | Faible |
| D2 | **Haptique dans l'action de jeu** : aujourd'hui elle n'existe que sur les écrans de récompense (`OverScreen`, `RankMove`, `UnlockScreen`, bans). Un `light` sur le mot trouvé, un `medium` sur le refus, et rien de plus — ne vibrer que sur les bascules d'état, jamais à chaque frappe. | `RunScreen.tsx:130-134,178-184`, `native.ts:92` | S | Moyen (nuisance) |
| D3 | **Rendre visible l'échec d'envoi** : `pushRun` est appelé sans branche d'échec, `cloud.ts` rend un repli muet — une partie peut ne jamais partir sans que le joueur le sache (le défi, lui, dit « échec »). Même chose pour un mot proposé. | `App.tsx:1315-1331,1434-1438`, `cloud.ts:53-63` | M | Faible |
| D4 | **Annoncer les chargements de listes** : `role="status"` + `aria-busy` au lieu d'un `<p>` nu (demandes, amis, défi, modération). | `RequestsPage.tsx:176`, `FriendsView.tsx:99`, `ChallengeScreen.tsx:666`, `ModerationScreen.tsx:199-202` | S | Faible |
| D5 | **Distinguer l'inerte du désactivé** : `.btn:disabled` (`--ink-faint` sur `paper-2`) et `.btn--idle` (pourtant cliquable) ont exactement le même aspect ; et dans la partie, solo et duel traitent le même refus différemment (secousse d'un côté, bouton `disabled` de l'autre — le doigt ne reçoit rien). | `styles.css:350-380`, `RunScreen.tsx:376-378`, `DuelScreen.tsx:892` | S | Moyen |
| D6 | **Combler les deux silences d'état vide** : `UnlockScreen` avale l'échec de `loadPack` et affiche des cartes sans mot, sans message ; la barre de révélations à zéro ne réagit pas du tout sans Premium (pas de `PlusPop`, pas de mouvement). | `UnlockScreen.tsx:46-77`, `HiddenAnswers.tsx:115-133` | M | Faible |
| D7 | **Focus et Échap dans les couches** : les feuilles `role="dialog" aria-modal` (offre, avis, ami, offre de modération) ne déplacent pas le focus et ne le piègent pas ; Échap ferme tout le tiroir au lieu de dépiler. *(recoupe F8 de l'audit du 6 octobre — une seule fois, pas deux.)* | `FeedbackPop.tsx:53`, `FriendPicker.tsx:49`, `ModeratorOffer.tsx:59`, `Menu.tsx:154-155` | M | Moyen |

**Acceptation lot D** : navigation clavier et lecteur d'écran (VoiceOver/TalkBack) sur une partie
complète ; une partie jouée avion en mode avion montre qu'elle n'a pas été envoyée ; `npm run check` vert.

## Lot E — Déjà fait depuis le 6 octobre (ne pas refaire)

- Q2 boutons rouges lisibles : `.btn--red` écrit en noir sur rouge (`styles.css:370-371`), et le bleu
  n'était pas en cause (6,35:1 clair, 4,96:1 sombre).
- Q4 refus avec une marque propre : `.verdict--refused` existe (`styles.css:1080`).
- Q6 récompense tenue ~1,2 s : `CHEER_HOLD_MS` en place (`RunScreen.tsx:21-23`).
- `prefers-reduced-motion` est couvert par un balai global plus sept blocs ciblés, et les animations
  pilotées en JS consultent déjà `reducedMotion()` — les trous restants sont ceux des clignotements
  du chrono et de la réserve du duel (B2, C1 n'y changent rien : à traiter avec B3 ou à part).

## Ordre conseillé

1. **Vague « cohérence » (une livraison visible)** — C1, C2, C4, D1, D3, D4 : les contrastes, les
   cibles au pouce, le lecteur d'écran, l'envoi qui se sait. Aucun chantier structurel, tout est
   vérifiable en captures et en test manuel.
2. **Vague « moteur »** — B1, B2, B3, B4, B6, B7, puis A1, A2, A3, A5 : le chrono cesse de coûter un
   rendu global, le mouvement gagne un vocabulaire, l'audio se réveille et se règle.
3. **Vague « finition »** — A4, A6, C3, C5, C7, D2, D5, D6, D7.
4. **À arbitrer avec Jérémy** — A7 (écoute), A8 (session audio native, non testable ici), B5 (mineur).

Deux agents en parallèle : **séparer par fichier**, jamais deux sur `styles.css`, `RunScreen.tsx` ou
`sound.ts` en même temps. Découpage naturel : (1) `sound.ts` + `state/sound.ts` + `MuteButton.tsx`,
(2) `styles.css`/`duel.css` + les composants d'icônes, (3) `state/duel.ts` + `App.tsx` +
`RunScreen.tsx`. `npm run check` une fois par vague, avant de commit.

## Comment je vérifierais

- `npm run check` (oxlint + tsc + vitest) après chaque vague ; les tests de style n'existent pas, donc
  les lots B, C et D demandent des captures réelles : `npm run dev -- --host`, 375 px et bureau,
  thème clair **et** sombre, une partie complète, un duel local (`duel.html#auto`) et la planche debug.
- B1/B2 : relever avant/après le coût d'une partie (capture de performance, `requestAnimationFrame`
  compté, ou au minimum la disparition du re-render complet dans le profileur React).
- A1/A3/A4 : écoute réelle sur téléphone, seule mesure qui vaut pour le son.
- Un changement de jeton (C1, C2, C6, C7) se vérifie par le recalcul des ratios — la commande est dans
  l'historique de cette session, elle se refait en dix lignes de script.
