# Vidéo promo

`lettre-minute-promo.mp4` : 30 s en 1080 × 1920, sans voix, avec la musique
et les sons du jeu. Elle se refait en quatre temps, des prises au rendu.

## 1. Le build promo

Le jeu filmé n'écrit jamais sur le serveur : Supabase est débranché, la
modération et les classements sont inventés, le profil est niveau 14 avec
tout débloqué et aucun pouvoir porté, la graine vaut 42 et le clavier ne
s'affiche pas. Le patch ne vit que dans un worktree jetable :

```sh
git worktree add --detach .cache/promo-wt HEAD
ln -s "$PWD/node_modules" .cache/promo-wt/node_modules
cp android/keystore.properties android/local.properties .cache/promo-wt/android/
grep -vE '^VITE_(SUPABASE|PUSH|GOOGLE)' .env.local > .cache/promo-wt/.env.local
printf 'VITE_PROMO=1\nVITE_PUSH_ENABLED=false\n' >> .cache/promo-wt/.env.local
python3 store/promo/build/apply-promo.py .cache/promo-wt
cd .cache/promo-wt && npm run build && npx cap sync android
cd android && PROMO_SUFFIX=4 ./gradlew assembleDebug   # JAVA_HOME openjdk@21
adb install app/build/outputs/apk/debug/app-debug.apk
```

`PROMO_SUFFIX` donne un identifiant neuf (`fr.lettreminute.promo4`), donc un
profil vierge : le jeu use la rareté des mots rejoués, une deuxième prise
sur le même profil montre Zimbabwe « courant ». Les couples de la graine 42
suivent le dictionnaire et `DAMPED_PROMPTS` : après un changement de tirage,
refaire la liste des mots (Z Pays, R Plantes, F Couleurs, E Pays, J Prénoms,
T Objets, B Couleurs, M Pays, K Prénoms, P Objets, N Couleurs, I Objets…).

## 2. Les prises

L'émulateur se lance avec `-gpu host` : en rendu logiciel (SwiftShader), il
devient trop lent pour filmer. `capture/drive.sh` pilote le jeu par adb, à
des positions fixes (l'arbre d'accessibilité de la WebView est trop instable
pour Maestro), et note l'instant de chaque geste dans `takes/<prise>.log` :

```sh
cd store/promo/takes
../capture/drive.sh none home 44 "Zim_babwe" "roma_rin" "fus<chsia" "Esp_agne" "Je_an"
# équiper Tricherie seule, puis :
../capture/drive.sh joker home 8 '!Zimbabwe' '!romarin' '!fuchsia' '!Espagne' '!Jean' '!telephone' '!bordeaux' '!Madagascar' '!Kevin' '!poubelle' '!noisette' JOKER
```

S'y ajoutent `powers` (la liste des pouvoirs qu'on fait défiler) et `moder`
(une session de modération, trois glissements à droite, deux à gauche).

## 3. Les clips et le son

Les clips de `video/assets/` sont découpés, accélérés et recadrés
(`crop=1080:1620`, à partir de y = 135 ; y = 330 pour la modération) dans
les prises. Les extraits utilisés sont ceux de `sound/render.mjs`, qui pose
les sons du jeu dessus à partir des journaux, puis les rend par le vrai
`src/lib/sound.ts`, sur une horloge pilotée :

```sh
cd store/promo/video && npm install
cd ../sound && node render.mjs
```

## 4. Le rendu

```sh
cd store/promo/video && npm run render
```

La composition HyperFrames est `video/index.html`. Aucune mention ni lien
« web » : la promo dit « sur Android ».
