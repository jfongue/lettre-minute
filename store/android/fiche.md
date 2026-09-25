# Fiche Play Store — Lettre Minute

Textes et réponses à recopier dans la Play Console. Les visuels sont à côté :
`icon-512.png`, `feature-graphic.png` (1024 × 500), `listing/fr/` (les cinq
captures légendées à téléverser, 1080 × 1920) et `screenshots/fr/` (les
captures brutes dont elles partent). Pour les régénérer :
`scripts/render-store.sh`.

## Fiche principale (français)

**Nom** (30 caractères max)
> Lettre Minute

**Description courte** (80 caractères max)
> Le Petit Bac express : une lettre, un thème, 60 secondes. Défie tes amis !

**Description complète** (4 000 caractères max)

> Petit Bac, version éclair. Une lettre tombe, un thème s’affiche, le chrono
> démarre : pays en B, animaux en M, métiers en P… Tu as soixante secondes
> pour en trouver le plus possible.
>
> DÉFIE TES AMIS
> Invite jusqu’à sept amis sur la même partie : mêmes lettres, mêmes thèmes,
> chacun joue quand il veut. Classement, trophées, et revanche.
>
> DES POUVOIRS POUR TRICHER UN PEU
> Change de lettre, vois venir le thème suivant, laisse passer deux fautes…
> Dix pouvoirs à gagner : trouve ta combinaison préférée.
>
> DE NOUVEAUX THÈMES À CHAQUE NIVEAU
> Gagne de nouveaux thèmes pour encore plus de défi : fruits et légumes,
> métiers, sports, corps humain, villes, marques…
>
> ET POUR LES ACHARNÉS
> Les mots les plus rares rapportent jusqu’à trois fois plus : à toi de venir
> les découvrir, ou de les proposer.
>
> • Sans inscription, compte facultatif
> • Une seule pub courte, au choix d’un nouveau thème
> • Jouable hors ligne en solo
> • En sept langues

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
