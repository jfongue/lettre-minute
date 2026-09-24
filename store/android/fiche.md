# Fiche Play Store — Lettre Minute

Textes et réponses à recopier dans la Play Console. Les visuels sont à côté :
`icon-512.png`, `feature-graphic.png` (1024 × 500), `screenshots/` (1080 × 1920,
clair et sombre). Pour les régénérer : `scripts/render-store.sh`.

## Fiche principale (français)

**Nom** (30 caractères max)
> Lettre Minute

**Description courte** (80 caractères max)
> Une lettre, une catégorie, 60 secondes. Plus le mot est rare, plus il rapporte.

**Description complète** (4 000 caractères max)

> Une lettre tombe, une catégorie s’affiche, le chrono démarre. Pays en B,
> animaux en M, couleurs en V… Vous avez soixante secondes pour écrire le plus
> de mots possible.
>
> Le jeu vérifie chaque mot pendant que vous tapez, grâce à un dictionnaire de
> plus de 60 000 mots français bâti sur Wikidata et le Wiktionnaire. « Chats »
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
> PROGRESSEZ
> Chaque point rapporte de l’expérience, et chaque niveau débloque une nouvelle
> catégorie : fruits et légumes, métiers, sports, parties du corps,
> matières, capitales, marques, insectes…
>
> FAITES GRANDIR LE DICTIONNAIRE
> Un mot manque ? Proposez-le en un clic. Réclamé par trois joueurs, il entre
> au dictionnaire, et vous gagnez 150 XP.
>
> • Sans inscription
> • Une seule pub, courte, au choix d’une nouvelle catégorie
> • Jouable hors ligne
> • Thème clair et sombre
> • Vos données s’effacent en un geste depuis l’accueil

**Catégorie de l’application** : Jeu › Mots
**Tags** : Mots, Quiz, Solo, Culture générale
**Adresse e-mail de contact** : à renseigner (publique sur la fiche)
**Règles de confidentialité** : `VITE_PRIVACY_URL`, soit l’adresse publique de
`public/confidentialite.html`

## Contenu de l’application (Play Console › Règles › Contenu de l’application)

| Rubrique | Réponse |
| --- | --- |
| Accès à l’application | Aucune restriction : tout est accessible sans connexion |
| Annonces | **Oui** : une interstitielle AdMob après chaque choix de catégorie à partir du deuxième |
| Classification du contenu (IARC) | Catégorie « Jeu » ; non à toutes les questions (violence, peur, sexualité, jeux d’argent, langage, drogues, achats numériques) ; les joueurs n’échangent aucun message et ne partagent rien entre eux. Résultat attendu : PEGI 3 / Tout public |
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
- Moyen de demander la suppression : **oui**, dans l’app (accueil › Effacer mes
  données) et à l’adresse `VITE_PRIVACY_URL#effacer`

| Type de données (Play) | Ce que c’est ici | Collectée | Partagée | Traitement éphémère | Obligatoire | Finalité |
| --- | --- | --- | --- | --- | --- | --- |
| Infos personnelles › ID utilisateur | L’identifiant anonyme Supabase | Oui | Non | Non | Oui | Fonctionnement de l’app |
| Activité dans l’app › Autres actions | Parties, scores, mots joués, XP | Oui | Non | Non | Oui | Fonctionnement de l’app |
| Activité dans l’app › Autre contenu généré par l’utilisateur | Mots proposés au dictionnaire | Oui | Non | Non | Non (le joueur choisit de proposer) | Fonctionnement de l’app |
| Position › Position approximative | Déduite de l’adresse IP par AdMob | Oui | Oui | Non | Oui | Publicité, analyse, prévention de la fraude |
| Appareil ou autres ID | Identifiant publicitaire (AdMob) | Oui | Oui | Non | Oui | Publicité, analyse, prévention de la fraude |
| Activité dans l’app › Interactions avec l’app | Affichages et clics sur la pub (AdMob) | Oui | Oui | Non | Oui | Publicité, analyse, prévention de la fraude |
| Infos et performances de l’app › Diagnostics, journaux de plantage | Remontés par le SDK AdMob | Oui | Oui | Non | Oui | Analyse, prévention de la fraude |

Tout le reste (position précise, contacts, photos, e-mail, nom) : **non
collecté**.

## Suppression de compte (Play Console › Règles › Suppression des données)

- L’app permet-elle de créer un compte ? **Oui**, un compte anonyme est créé
  automatiquement
- Lien de suppression hors de l’app : `VITE_PRIVACY_URL#effacer`
- Suppression partielle des données sans supprimer le compte : non proposée
