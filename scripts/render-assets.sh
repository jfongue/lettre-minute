#!/bin/sh
# Rend assets/source/mark.html en PNG sources pour @capacitor/assets, puis
# génère les icônes et écrans de lancement Android (et iOS une fois ajouté).
# Demande Google Chrome, pour la police variable que librsvg ne sait pas lire.
# Les couleurs suivent la palette de src/styles.css.
set -e
cd "$(dirname "$0")/.."
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
source="file://$PWD/assets/source/mark.html"

shot() { # sortie, taille, paramètres
  "$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --virtual-time-budget=2000 \
    --window-size="$2,$2" --screenshot="$PWD/assets/$1" "$source?size=$2&$3" 2>/dev/null
}

# capacitor-assets place déjà le premier plan de l'icône adaptative dans les
# 66 % visibles : le réduire ici en plus le rendrait minuscule.
shot icon-only.png 1024 "layer=full&scale=1.05"
shot icon-foreground.png 1024 "layer=foreground&scale=0.86"
shot icon-background.png 1024 "layer=background"
shot splash.png 2732 "layer=full&scale=0.22"
shot splash-dark.png 2732 "layer=full&theme=dark&scale=0.22"

npx capacitor-assets generate --android ${IOS:+--ios} \
  --iconBackgroundColor '#f2ecdf' --splashBackgroundColor '#f2ecdf' \
  --iconBackgroundColorDark '#151515' --splashBackgroundColorDark '#151515'
