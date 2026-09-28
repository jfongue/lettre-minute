# store/

Ce qu’il faut pour publier Lettre Minute, hors du code et hors de `public/`
(qui part sur GitHub Pages) : rien ici n’est servi ni importé par l’app.

- `android/fiche.md` — fiche Play Store en français, réponses de la Play
  Console comprises (contenu de l’app, sécurité des données, suppression).
- `android/<lang>/fiche.md` — la même fiche traduite.
- `android/icon-512.png`, `android/feature-graphic.png` — visuels communs,
  régénérés par `scripts/render-store.sh`.
- `android/screenshots/<lang>/` — les douze captures brutes de chaque langue,
  clair et sombre, dans l’interface et avec les mots de cette langue.
  Régénérées par `scripts/render-screenshots.ts` (mode d’emploi en tête du
  script).
- `android/listing/<lang>/1.png` à `6.png` — l’accueil, la partie, puis une capture par section de la
  description, légendée du titre de la section dans sa langue : ce sont elles
  qu’on téléverse.
  Régénérées par `scripts/render-store.sh`, légendes dans
  `assets/source/shot.html`.

La confidentialité n’est pas ici : `public/confidentialite.html` et ses
traductions `public/confidentialite.<lang>.html` partent en ligne avec
`npm run web:publish`, et la page française renvoie vers chacune.

## Quel fichier pour quelle langue

| Langue Play Console | Fiche | Captures | Confidentialité |
| --- | --- | --- | --- |
| Français (fr-FR) | `android/fiche.md` | `android/listing/fr/` | `public/confidentialite.html` |
| Anglais (en-US, en-GB) | `android/en/fiche.md` | `android/listing/en/` | `public/confidentialite.en.html` |
| Espagnol (es-ES, es-419) | `android/es/fiche.md` | `android/listing/es/` | `public/confidentialite.es.html` |
| Allemand (de-DE) | `android/de/fiche.md` | `android/listing/de/` | `public/confidentialite.de.html` |
| Italien (it-IT) | `android/it/fiche.md` | `android/listing/it/` | `public/confidentialite.it.html` |
| Néerlandais (nl-NL) | `android/nl/fiche.md` | `android/listing/nl/` | `public/confidentialite.nl.html` |
| Portugais du Brésil (pt-BR) | `android/pt/fiche.md` | `android/listing/pt/` | `public/confidentialite.pt.html` |

## Avant de publier une traduction

- Le nombre de mots de chaque description longue est celui des formes
  acceptées par le dictionnaire de la langue, arrondi vers le bas, au
  24 septembre 2026 : 40 000 (fr, de), 45 000 (es), 110 000 (en),
  30 000 (it, nl), 35 000 (pt). À revoir après un import.
- La Play Console ne prend qu’une adresse de confidentialité pour toute
  l’app : la page française, qui mène aux traductions. Les ancres `#effacer`
  existent dans toutes les langues.
- Une fonctionnalité nouvelle entre d’abord dans `android/fiche.md`, puis
  dans chaque traduction, avec les termes exacts de `src/i18n/<lang>.ts`
  (noms des pouvoirs, mots des sorts, chemins du menu).
- Seuls le nom, la description courte et la description longue se
  saisissent par langue ; les rubriques Contenu de l’app, Sécurité des
  données et Suppression se remplissent une seule fois pour toute l’app.
