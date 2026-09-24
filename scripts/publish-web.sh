#!/usr/bin/env bash
# Builds the web version and publishes it to GitHub Pages, from the public
# repository jfongue/lettre-minute: the game's own repository stays private,
# only what a browser downloads anyway goes out.
#
#   scripts/publish-web.sh           build, commit and push
#   PUBLISH_DRY=1 scripts/publish-web.sh   build and commit, show the diff, push nothing
#
# Pages serves the site under /lettre-minute/, hence --base: the Android build
# keeps the root base Capacitor expects, so this never touches dist/.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo="${PAGES_REPO:-https://github.com/jfongue/lettre-minute.git}"
pages="$root/.cache/pages"
out="$root/.cache/pages-build"

cd "$root"
npx tsc -b
rm -rf "$out"
npx vite build --base=/lettre-minute/ --outDir "$out" --emptyOutDir

if [ -d "$pages/.git" ]; then
  git -C "$pages" fetch -q origin main
  git -C "$pages" reset -q --hard origin/main
else
  git clone -q "$repo" "$pages"
fi

# Every build renames its chunks: clearing the tree drops the old ones rather
# than letting them pile up forever.
find "$pages" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$out/." "$pages/"
touch "$pages/.nojekyll"

git -C "$pages" add -A
if git -C "$pages" diff --cached --quiet; then
  echo "Nothing changed since the last publication."
  exit 0
fi
git -C "$pages" commit -qm "Publish the web version ($(git -C "$root" rev-parse --short HEAD))"
git -C "$pages" --no-pager show --stat --oneline HEAD | tail -n 5

if [ "${PUBLISH_DRY:-}" = 1 ]; then
  echo "Dry run: committed in $pages, not pushed."
else
  git -C "$pages" push -q origin main
  echo "Published: https://jfongue.github.io/lettre-minute/ (live within a minute)"
fi
