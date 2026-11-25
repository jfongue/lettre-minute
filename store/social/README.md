# Kit réseaux sociaux

Vidéos et visuels de promotion dans les sept langues du jeu, déclinés pour
TikTok / Reels / Shorts, les fils Instagram et Facebook, X / Reddit /
Discord et les stores. Ici vivent les **sources** ; le kit rendu (≈ 90 Mo)
n’entre pas dans le dépôt, public : il atterrit dans `.cache/social-kit/kit/`
et se dépose sur le Drive du jeu.

```sh
npm run social:kit
```

Compter une vingtaine de minutes (sept prises filmées, 28 vidéos rendues).
Chaque étape se relance seule :

1. **Le build à filmer** : `npm run build` sans serveur, vers
   `.cache/social-dist`, servi sur le port 5761. Supabase est vidé au build
   et la page bloque toute requête qui sortirait (`capture.ts`) : aucune
   partie filmée n’arrive au serveur.
2. **Les prises** — `node store/social/capture.ts <langue>` : une partie
   jouée dans Chrome sans tête, sur un écran tactile de téléphone, avec une
   graine fixe par langue. Chaque couple tiré reçoit le mot le plus connu de son
   dictionnaire (`known`), sauf ceux que `CHOSEN` fixe à la main parce que le
   mot automatique était juste mais bizarre (« visitor » comme sport). Après un
   import de dictionnaire ou un changement du tirage, relire le journal : les
   couples changent et `CHOSEN` peut demander une nouvelle ligne.
3. **Les visuels** — `node store/social/render-stills.ts [langue…]` :
   `post.html` (titre + les six captures de la fiche Play, légendées comme
   elle) en carré, 4:5, story, paysage et bannière. Les captures viennent de
   `store/android/screenshots/<langue>/`, sauf la partie et le bilan, pris
   dans la prise de la langue : ceux des six langues autres que le français y
   sont vides.
4. **Les vidéos** — `cd store/social && npm install`, puis
   `node render-videos.ts [langue…] [--format=story,square]` : la composition
   HyperFrames `video.html` (carte titre, partie légendée, score, carte de
   fin), sans son.
5. **La fin** — `node store/social/finish.ts` : `post.txt` par langue, la promo
   française de 30 s de `store/promo/` et le `LISEZMOI.txt` du kit.

Les textes sont dans `copy.js` : nom et accroche de la fiche Play de chaque
langue, légendes des captures de `assets/source/shot.html`. Un texte changé
d’un côté se reporte de l’autre. La promo dit « sur Android », jamais « web ».
