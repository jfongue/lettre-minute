# store/

Ce qu’il faut pour publier Lettre Minute, hors du code et hors de `public/`
(qui part sur GitHub Pages) : rien ici n’est servi ni importé par l’app.

- `android/fiche.md` — fiche Play Store en français, réponses de la Play
  Console comprises (contenu de l’app, sécurité des données, suppression).
- `android/<lang>/fiche.md` — la même fiche traduite.
- `android/icon-512.png`, `android/feature-graphic.png`, `android/screenshots/`
  — visuels communs, régénérés par `scripts/render-store.sh`. Les captures
  montrent l’interface française.
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

- Remplacer `{WORD_COUNT}` dans la description longue par la taille réelle
  du dictionnaire de cette langue, arrondie vers le bas.
- Publier la page de confidentialité traduite et mettre son adresse dans la
  fiche ; les ancres `#effacer` sont conservées dans toutes les langues.
- Seuls le nom, la description courte et la description longue se
  saisissent par langue ; les rubriques Contenu de l’app, Sécurité des
  données et Suppression se remplissent une seule fois pour toute l’app.
