#!/bin/sh
# Rend les visuels de la fiche Play Store sous store/android : bannière
# 1024 × 500 et icône 512 × 512. Demande Google Chrome, comme render-assets.sh.
set -e
cd "$(dirname "$0")/.."
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p store/android
"$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --allow-file-access-from-files --virtual-time-budget=2000 --window-size=1024,500 \
  --screenshot="$PWD/store/android/feature-graphic.png" "file://$PWD/assets/source/feature.html" 2>/dev/null
sips -Z 512 assets/icon-only.png --out store/android/icon-512.png >/dev/null
