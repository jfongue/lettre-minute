# Publier sur le Play Store

L'app Android est le jeu web emballé par [Capacitor](https://capacitorjs.com) :
`npm run build` produit `dist/`, que `cap sync` copie dans `android/`. Le code
natif se limite à ce que génère Capacitor ; ce qui parle au téléphone (écran de
lancement, barre d'état, bouton retour, vibration) passe par `src/lib/native.ts`.

La fiche du store (textes, réponses aux formulaires, visuels) est dans
[`store/android/`](../store/android/fiche.md).

## Une fois par poste : la chaîne d'outils

```bash
brew install --cask android-studio
```

Au premier lancement, Android Studio installe le SDK et un JDK. Puis, dans
`~/.zshrc` :

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

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
4. L'envoyer dans la Play Console, sur la piste de test interne d'abord.

Pour essayer sur un téléphone branché en USB (débogage USB activé) :
`npm run android:sync`, puis `npm run android:open` et ▶ dans Android Studio.

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
