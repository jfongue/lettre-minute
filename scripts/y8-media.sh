#!/bin/sh
# Y8's media at the exact sizes its Developer Portal asks (y8/submission.md),
# into y8/assets/: the promos from y8/assets/cover.html, the screenshots cut
# from the CrazyGames captures (crazygames/assets/, npm run crazygames:shots),
# and the gameplay video: Y8 wants one continuous clip, no trailer, so a real
# run filmed at 16:9 (crazygames/video/capture.mjs --landscape, against
# crazygames:harness), cut to start at the countdown — before it, the home's
# leaderboard names real players and the harness stands in for an ad.
#
#   sh scripts/y8-media.sh
#
# Headless Chrome runs without its sandbox and GPU: an agent's own sandbox
# refuses them (CLAUDE.md, « Pièges connus »).
set -eu
OUT=y8/assets
SRC=crazygames/assets
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(pwd)/.cache/y8-media-chrome"
mkdir -p "$PROFILE"

# Chrome's screenshot leaves the bottom of a tall window unpainted: the page is
# shot in a window 200 px taller, then cut to its exact size.
promo() { # format width height file
  "$CHROME" --headless=new --no-sandbox --disable-gpu --disable-crash-reporter --hide-scrollbars \
    --user-data-dir="$PROFILE" --force-device-scale-factor=1 --window-size="$2,$(($3 + 200))" \
    --virtual-time-budget=1500 --screenshot="$PROFILE/promo.png" "file://$(pwd)/$OUT/cover.html?format=$1" 2>/dev/null
  ffmpeg -loglevel error -y -i "$PROFILE/promo.png" -vf "crop=$2:$3:0:0" "$OUT/$4"
}
promo landscape 1920 1080 promo-landscape-1920x1080.png
promo tall 1080 1920 promo-portrait-1080x1920.png
promo card 760 570 promo-card-760x570.png

n=1
for shot in shot-1-home shot-2-announce shot-3-run shot-4-summary; do
  ffmpeg -loglevel error -y -i "$SRC/$shot.png" -vf "scale=1280:720:flags=lanczos" "$OUT/widescreen-$n-1280x720.png"
  # The home, the announcement and the run sit in the middle 1440 px of the
  # 1920: a 4:3 cut keeps them whole. The summary is wider, and stays 16:9 only.
  if [ "$shot" != shot-4-summary ]; then
    ffmpeg -loglevel error -y -i "$SRC/$shot.png" -vf "crop=1440:1080:240:0,scale=760:570:flags=lanczos" "$OUT/screenshot-$n-760x570.png"
  fi
  n=$((n + 1))
done

CLIP=crazygames/video/capture-landscape/gameplay.mp4
RUN=$(node -e "process.stdout.write(String(Math.max(0, require('./crazygames/video/capture-landscape/marks.json').run - 1.5)))")
ffmpeg -loglevel error -y -ss "$RUN" -i "$CLIP" -c:v libx264 -crf 18 -pix_fmt yuv420p -an -movflags +faststart "$OUT/gameplay-1920x1080.mp4"
for file in "$OUT"/*.png; do printf '%s %s\n' "$(sips -g pixelWidth -g pixelHeight "$file" | awk '/pixel/ {printf "%s ", $2}')" "$file"; done
