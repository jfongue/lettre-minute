# Publier sur le Play Store

L'app Android est le jeu web emballé par [Capacitor](https://capacitorjs.com) :
`npm run build` produit `dist/`, que `cap sync` copie dans `android/`. Le code
natif se limite à ce que génère Capacitor ; ce qui parle au téléphone (écran de
lancement, barre d'état, bouton retour, vibration) passe par `src/lib/native.ts`.

La fiche du store (textes, réponses aux formulaires, visuels) est dans
[`store/android/`](../store/android/fiche.md).

## Une fois par poste : la chaîne d'outils

Pas besoin d'Android Studio : un JDK et les outils en ligne de commande
suffisent.

```bash
brew install openjdk@21
brew install --cask android-commandlinetools
```

```bash
sdkmanager --sdk_root="$HOME/Library/Android/sdk" --licenses
```

```bash
sdkmanager --sdk_root="$HOME/Library/Android/sdk" platform-tools "platforms;android-36" "build-tools;36.0.0" "cmdline-tools;latest"
```

Puis, dans `~/.zshrc` :

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

et `android/local.properties` (ignoré par git) : `sdk.dir=/Users/<vous>/Library/Android/sdk`.

Pour un émulateur (le `avdmanager` de Homebrew ne voit pas ce SDK, d'où celui
de `cmdline-tools;latest`) :

```bash
sdkmanager --sdk_root="$ANDROID_HOME" emulator "system-images;android-36;google_apis;arm64-v8a"
```

```bash
"$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager" create avd -n lettre -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_7
```

```bash
"$ANDROID_HOME/emulator/emulator" -avd lettre
```

Et pour y installer une version de test :
`cd android && ./gradlew installDebug`.

## Une fois pour toutes : la clé d'upload

```bash
keytool -genkeypair -v -keystore ~/cles/lettre-minute-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Puis copier `android/keystore.properties.example` en
`android/keystore.properties` et le remplir. Ni la clé ni ce fichier n'entrent
dans le dépôt (`.gitignore`).

Google signe l'app distribuée avec sa propre clé (Play App Signing) ; celle-ci
ne sert qu'à prouver que l'envoi vient de vous. **La sauvegarder hors du
poste** (gestionnaire de mots de passe, avec son mot de passe) : sa perte
oblige à demander une réinitialisation au support Google, ce qui prend des
jours.

## À chaque version

1. Dans `.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` et
   `VITE_PRIVACY_URL` (voir `.env.example`). Sans les deux premières, l'app
   reste entièrement locale, sans classement.
2. Incrémenter `versionCode` (et `versionName`) dans
   `android/app/build.gradle` : le Play Store refuse un `versionCode` déjà
   envoyé.
3. Construire le bundle signé :

   ```bash
   npm run android:bundle
   ```

   Il sort dans `android/app/build/outputs/bundle/release/app-release.aab`.
4. Écrire les notes de version dans `android/whatsnew/<langue>.txt`
   (`fr-FR.txt`…, 500 caractères au plus), puis l'envoyer :

   ```bash
   npm run android:release              # bundle + envoi sur Test fermé
   npm run android:release -- --check   # vérifie la clé, liste les pistes
   ```

   `scripts/play-release.ts` passe par l'API Play Developer, avec la clé du
   compte de service `play-publisher@lettreminute-509707.iam.gserviceaccount.com`
   rangée dans `~/cles/lettre-minute-play.json` (ou `PLAY_KEY`), hors du dépôt.
   La release remplace ce que la piste avait (un brouillon compris) et part en
   examen chez Google. `--track=internal` vise le test interne.

## Une fois pour toutes : l'accès à l'API Play

1. Google Cloud, projet LettreMinute : activer *Google Play Android Developer API*.
2. Créer le compte de service `play-publisher` (sans rôle), puis une clé JSON,
   rangée dans `~/cles/lettre-minute-play.json`.
3. Play Console → Utilisateurs et autorisations : inviter son adresse, sur
   Lettre Minute, avec « Publier sur les canaux de test » et « Gérer les
   canaux de test ». Une clé perdue se révoque dans Google Cloud et se recrée.

Pour essayer sur un téléphone branché en USB (débogage USB activé) ou sur
l'émulateur : `npm run android:sync`, puis `cd android && ./gradlew installDebug`.

## La première publication

1. **Compte développeur** sur [play.google.com/console](https://play.google.com/console)
   (25 $, une fois). Compte personnel ou d'organisation : une organisation
   demande un numéro D-U-N-S, mais échappe au test fermé obligatoire.
2. **Créer l'application** : nom « Lettre Minute », langue par défaut français,
   jeu, gratuit.
3. **Remplir « Contenu de l'application »** avec les réponses de
   `store/android/fiche.md` : confidentialité, annonces, classification,
   public cible, sécurité des données, suppression de compte.
4. **Fiche principale** : textes et visuels de `store/android/`.
5. **Test interne** : envoyer l'`.aab`, ajouter sa propre adresse comme
   testeur, installer depuis le lien du Play Store et jouer une partie.
6. **Compte personnel créé après novembre 2023** : Google exige un **test fermé
   d'au moins 12 testeurs pendant 14 jours d'affilée** avant d'ouvrir l'accès
   à la production. Le lancer dès que le test interne est bon.
7. **Production** : demander l'accès, puis envoyer la version. La première
   relecture prend de quelques heures à quelques jours.

## Le jour où viendra iOS

Le dépôt y est prêt : `@capacitor/ios` est installé, les visuels partent de la
même source, `src/lib/native.ts` couvre déjà les deux plateformes. Il faudra un
Mac avec Xcode et un compte Apple Developer (99 $ par an), puis :

```bash
npx cap add ios
IOS=1 ./scripts/render-assets.sh
```

Apple regardera en plus : la suppression de compte (déjà là), un
`PrivacyInfo.xcprivacy` qui déclare l'usage de `UserDefaults` (le
`localStorage` de la WebView), et le fait que l'app apporte plus qu'un site
dans une coque (règle 4.2). Jeu hors ligne, vibrations et écran de lancement
natifs vont dans ce sens.
