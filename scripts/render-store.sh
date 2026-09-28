#!/bin/sh
# Rend les visuels de la fiche Play Store sous store/android : bannière
# 1024 × 500 (une par langue), icône 512 × 512, et les six captures légendées
# de chaque langue (listing/<lang>/), tirées des captures brutes que
# render-screenshots.ts laisse sous screenshots/<lang>/.
# Demande Google Chrome, comme render-assets.sh.
set -e
cd "$(dirname "$0")/.."
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p store/android
"$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --allow-file-access-from-files --virtual-time-budget=2000 --window-size=1024,500 \
  --screenshot="$PWD/store/android/feature-graphic.png" "file://$PWD/assets/source/feature.html" 2>/dev/null
for lang in en de es it nl pt; do
  "$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --allow-file-access-from-files --virtual-time-budget=2000 --window-size=1024,500 \
    --screenshot="$PWD/store/android/$lang/feature-graphic.png" "file://$PWD/assets/source/feature.html?lang=$lang" 2>/dev/null
done
for lang in fr en de es it nl pt; do
  rm -rf "store/android/listing/$lang" && mkdir -p "store/android/listing/$lang"
  for n in 1 2 3 4 5 6; do
    "$chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --allow-file-access-from-files --virtual-time-budget=2000 --window-size=1080,1920 \
      --screenshot="$PWD/store/android/listing/$lang/$n.png" "file://$PWD/assets/source/shot.html?lang=$lang&n=$n" 2>/dev/null
  done
done
sips -Z 512 assets/icon-only.png --out store/android/icon-512.png >/dev/null
