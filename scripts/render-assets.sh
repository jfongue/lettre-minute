#!/bin/sh
# Rend assets/source/mark.html en PNG sources pour @capacitor/assets, puis
# génère les icônes et écrans de lancement Android (et iOS une fois ajouté),
# et les icônes web de public/.
# Demande Google Chrome, pour la police variable que librsvg ne sait pas lire.
# Les couleurs suivent la palette de src/styles.css.
set -e
cd "$(dirname "$0")/.."
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
source="file://$PWD/assets/source/mark.html"

shot() { # sortie, taille, paramètres
  "$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=2000 \
    --window-size="$2,$2" --screenshot="$PWD/$1" "$source?size=$2&$3" 2>/dev/null
}

# capacitor-assets place déjà le premier plan de l'icône adaptative dans les
# 66 % visibles : le réduire ici en plus le rendrait minuscule.
shot assets/icon-only.png 1024 "layer=full&scale=1.05"
shot assets/icon-foreground.png 1024 "layer=foreground&scale=0.86"
shot assets/icon-background.png 1024 "layer=background"
shot assets/splash.png 2732 "layer=full&scale=0.22"
shot assets/splash-dark.png 2732 "layer=full&theme=dark&scale=0.22"

shot public/icon-512.png 512 "layer=full&scale=1.05"
shot public/icon-maskable-512.png 512 "layer=full&scale=0.8"
sips -Z 180 public/icon-512.png --out public/apple-touch-icon.png >/dev/null

# L'icône adaptative est en vecteur (drawable/ic_launcher_*.xml) : on ne garde
# de capacitor-assets que les PNG entiers d'avant Android 8. Il reformate
# aussi le manifeste, qu'on lui reprend.
res=android/app/src/main/res
keep=$(mktemp -d)
cp -R $res/mipmap-anydpi-v26 $res/values/ic_launcher_background.xml android/app/src/main/AndroidManifest.xml "$keep"

npx capacitor-assets generate --android ${IOS:+--ios} \
  --iconBackgroundColor '#f2ecdf' --splashBackgroundColor '#f2ecdf' \
  --iconBackgroundColorDark '#151515' --splashBackgroundColorDark '#151515'


cp -R "$keep"/mipmap-anydpi-v26 $res/ && cp "$keep"/ic_launcher_background.xml $res/values/
cp "$keep"/AndroidManifest.xml android/app/src/main/
rm -f $res/mipmap-*/ic_launcher_foreground.png $res/mipmap-*/ic_launcher_background.png
