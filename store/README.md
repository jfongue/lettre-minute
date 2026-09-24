# store/

Ce qu’il faut pour publier Lettre Minute, hors du code et hors de `public/`
(qui part sur GitHub Pages) : rien ici n’est servi ni importé par l’app.

- `android/fiche.md` — fiche Play Store en français, réponses de la Play
  Console comprises (contenu de l’app, sécurité des données, suppression).
- `android/<lang>/fiche.md` — la même fiche traduite.
- `android/icon-512.png`, `android/feature-graphic.png` — visuels communs,
  régénérés par `scripts/render-store.sh`.
- `android/screenshots/<lang>/` — les huit captures de chaque langue, clair et
  sombre, dans l’interface et avec les mots de cette langue. Régénérées par
  `scripts/render-screenshots.ts` (mode d’emploi en tête du script).
- `privacy/confidentialite.<lang>.html` — la page de confidentialité par
  langue ; `confidentialite.fr.html` est une copie de
  `public/confidentialite.html`, qui reste la version en ligne.

## Quel fichier pour quelle langue

| Langue Play Console | Fiche | Confidentialité |
| --- | --- | --- |
| Français (fr-FR) | `android/fiche.md` | `privacy/confidentialite.fr.html` |
| Anglais (en-US, en-GB) | `android/en/fiche.md` | `privacy/confidentialite.en.html` |
| Espagnol (es-ES, es-419) | `android/es/fiche.md` | `privacy/confidentialite.es.html` |
| Allemand (de-DE) | `android/de/fiche.md` | `privacy/confidentialite.de.html` |
| Italien (it-IT) | `android/it/fiche.md` | `privacy/confidentialite.it.html` |
| Néerlandais (nl-NL) | `android/nl/fiche.md` | `privacy/confidentialite.nl.html` |
| Portugais du Brésil (pt-BR) | `android/pt/fiche.md` | `privacy/confidentialite.pt.html` |

## Avant de publier une traduction

- Le nombre de mots de chaque description longue est celui des formes
  acceptées par le dictionnaire de la langue, arrondi vers le bas, au
  24 septembre 2026 : 40 000 (fr, de), 45 000 (es), 110 000 (en),
  30 000 (it, nl), 35 000 (pt). À revoir après un import.
- Publier la page de confidentialité traduite et mettre son adresse dans la
  fiche ; les ancres `#effacer` sont conservées dans toutes les langues.
- Seuls le nom, la description courte et la description longue se
  saisissent par langue ; les rubriques Contenu de l’app, Sécurité des
  données et Suppression se remplissent une seule fois pour toute l’app.
