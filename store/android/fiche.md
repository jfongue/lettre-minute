# Fiche Play Store — Lettre Minute

Textes et réponses à recopier dans la Play Console. Les visuels sont à côté :
`icon-512.png`, `feature-graphic.png` (1024 × 500), `listing/fr/` (les huit
captures légendées à téléverser, 1080 × 1920) et `screenshots/fr/` (les
captures brutes dont elles partent). Pour les régénérer :
`scripts/render-store.sh`.

## Fiche principale (français)

**Nom** (30 caractères max)
> Lettre Minute

**Description courte** (80 caractères max)
> Une lettre, une catégorie, 60 secondes. Plus le mot est rare, plus il rapporte.

**Description complète** (4 000 caractères max)

> Une lettre tombe, une catégorie s’affiche, le chrono démarre. Pays en B,
> animaux en M, couleurs en V… Vous avez soixante secondes pour écrire le plus
> de mots possible, et ceux que personne ne trouve rapportent le plus.
>
> Le jeu vérifie chaque mot pendant que vous tapez, grâce à un dictionnaire de
> plus de 40 000 mots français bâti sur Wikidata et le Wiktionnaire. « Chats »
> vaut « chat », et une faute de frappe passe : « thailnade » vaut
> « Thaïlande ».
>
> LES MOTS RARES VALENT PLUS
> Un mot que tout le monde écrit rapporte 10 points. Un mot que personne ne
> trouve rapporte jusqu’à trois fois plus. Et le bonus s’use si vous ressortez
> le même mot à chaque partie : il faut varier.
>
> ENCHAÎNEZ
> Chaque mot validé à la suite augmente le multiplicateur, jusqu’à ×2. Passer
> coûte cinq secondes et remet la série à zéro.
>
> DÉFIEZ VOS AMIS
> Jusqu’à huit joueurs sur la même partie : mêmes lettres, mêmes catégories,
> chacun quand il veut dans les 24 heures. Pendant que vous jouez, les scores
> de ceux qui sont passés avant vous avancent comme en direct. À la fin, règle
> du Petit Bac : un mot qu’un autre a aussi trouvé ne vaut que la moitié.
> Classement, trophées, et une revanche si le cœur vous en dit.
>
> DIX POUVOIRS
> Écrivez « chut » et le chrono s’arrête. Écrivez « Joker » et le jeu trouve un
> mot à votre place. Changez de lettre, voyez venir la catégorie suivante,
> laissez passer deux fautes… Un nouveau pouvoir tous les deux niveaux, deux
> à emporter dans chaque partie.
>
> PROGRESSEZ
> Chaque point rapporte de l’expérience, et chaque niveau vous propose trois
> nouvelles catégories, dont vous gardez une : fruits et légumes, métiers,
> sports, parties du corps, matières, capitales, marques… En chemin, quarante
> avatars animés et trente couleurs à débloquer.
>
> GRIMPEZ AU CLASSEMENT
> Meilleure partie du jour, de la semaine, et chasse aux découvertes : les mots
> que personne n’avait écrits depuis sept jours.
>
> FAITES GRANDIR LE DICTIONNAIRE
> Un mot manque ? Proposez-le en un geste. Validé par trois modérateurs, il
> entre au dictionnaire, et vous gagnez 150 XP.
>
> • Sans inscription : le compte est facultatif (e-mail ou Google)
> • Une seule pub, courte, au choix d’une nouvelle catégorie
> • Jouable hors ligne en solo
> • En sept langues, chacune avec son propre dictionnaire : français,
>   anglais, espagnol, allemand, italien, néerlandais, portugais
> • Musique et sons joués en direct, thème clair et sombre
> • Vos données s’effacent en un geste depuis le menu

**Catégorie de l’application** : Jeu › Mots
**Tags** (5 au plus, pris dans la liste de la Play Console) : Mots, Quiz,
Culture générale, Solo, Multijoueur
**Adresse e-mail de contact** : fongue.jeremy@gmail.com (publique sur la fiche)
**Règles de confidentialité** (une seule adresse pour toute l’app) :
https://jfongue.github.io/lettre-minute/confidentialite.html, soit
`VITE_PRIVACY_URL` ; la page renvoie vers ses traductions

## Contenu de l’application (Play Console › Règles › Contenu de l’application)

| Rubrique | Réponse |
| --- | --- |
| Accès à l’application | Aucune restriction : tout est accessible sans connexion |
| Annonces | **Oui** : une interstitielle AdMob après chaque choix de catégorie à partir du deuxième |
| Classification du contenu (IARC) | Catégorie « Jeu » ; non à toutes les questions (violence, peur, sexualité, jeux d’argent, langage, drogues, achats numériques) ; **interactions entre utilisateurs : oui** (nom de joueur, avatar et scores visibles aux classements, entre amis et dans les défis ; aucune messagerie, aucun texte libre échangé hormis le nom). Résultat attendu : PEGI 3 / Tout public, avec la mention « Interactions entre utilisateurs » |
| Public cible | 13 ans et plus. Choisir une tranche de moins de 13 ans fait entrer l’app dans le programme Familles et ses exigences supplémentaires |
| Application d’actualités | Non |
| Applis gouvernementales / santé / finance | Non |
| ID publicitaire | **Oui**, par le SDK AdMob ; finalités : publicité, analyse, prévention de la fraude. La permission `AD_ID` est ajoutée au manifeste par le SDK |

## Sécurité des données

Les lignes Supabase ne valent que si le build embarque ses clés ; les lignes
AdMob valent pour tout build Android, puisque le SDK publicitaire y est
toujours. Les déclarations AdMob reprennent le guide « Sécurité des données »
de l’aide AdMob, à relire à chaque mise à jour du SDK.

- Collecte ou partage de données : **oui, collecte** et **oui, partage**
  (avec Google, pour la publicité)
- Données chiffrées en transit : **oui** (HTTPS vers Supabase et Google)
- Moyen de demander la suppression : **oui**, dans l’app (Menu › Profil ›
  Effacer mes données) et à l’adresse `VITE_PRIVACY_URL#effacer`

| Type de données (Play) | Ce que c’est ici | Collectée | Partagée | Traitement éphémère | Obligatoire | Finalité |
| --- | --- | --- | --- | --- | --- | --- |
| Infos personnelles › ID utilisateur | L’identifiant anonyme Supabase | Oui | Non | Non | Oui | Fonctionnement de l’app |
| Infos personnelles › Nom | Nom de joueur, choisi à la création du compte, visible des autres joueurs | Oui | Non | Non | Non (compte facultatif) | Fonctionnement de l’app, gestion du compte |
| Infos personnelles › Adresse e-mail | Connexion et code de réinitialisation du mot de passe (saisie ou transmise par Google) | Oui | Non | Non | Non (compte facultatif) | Fonctionnement de l’app, gestion du compte |
| Infos personnelles › Autres infos | Liste d’amis, défis | Oui | Non | Non | Non | Fonctionnement de l’app |
| Appareil ou autres ID | Jeton de notification Firebase (défis) | Oui | Non | Non | Non (le joueur accepte les notifications) | Fonctionnement de l’app |
| Activité dans l’app › Autres actions | Parties, scores, mots joués, XP | Oui | Non | Non | Oui | Fonctionnement de l’app |
| Activité dans l’app › Autre contenu généré par l’utilisateur | Mots proposés au dictionnaire | Oui | Non | Non | Non (le joueur choisit de proposer) | Fonctionnement de l’app |
| Position › Position approximative | Déduite de l’adresse IP par AdMob | Oui | Oui | Non | Oui | Publicité, analyse, prévention de la fraude |
| Appareil ou autres ID | Identifiant publicitaire (AdMob) | Oui | Oui | Non | Oui | Publicité, analyse, prévention de la fraude |
| Activité dans l’app › Interactions avec l’app | Affichages et clics sur la pub (AdMob) | Oui | Oui | Non | Oui | Publicité, analyse, prévention de la fraude |
| Infos et performances de l’app › Diagnostics, journaux de plantage | Remontés par le SDK AdMob | Oui | Oui | Non | Oui | Analyse, prévention de la fraude |

Tout le reste (position précise, contacts, photos, numéro de téléphone) :
**non collecté**. Le mot de passe n’est gardé que haché, par Supabase Auth.

## Suppression de compte (Play Console › Règles › Suppression des données)

- L’app permet-elle de créer un compte ? **Oui** : un compte anonyme est créé
  automatiquement, et le joueur peut le nommer (nom, e-mail, mot de passe, ou
  Google). L’effacement supprime l’un comme l’autre
- Lien de suppression hors de l’app : `VITE_PRIVACY_URL#effacer`
- Suppression partielle des données sans supprimer le compte : non proposée
