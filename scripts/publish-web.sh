#!/usr/bin/env bash
# Builds the web version and publishes it to GitHub Pages, in the public
# repository jfongue/lettre-minute: main carries the game's source, gh-pages
# only ever the files a browser downloads anyway.
#
#   scripts/publish-web.sh           build, commit and push
#   PUBLISH_DRY=1 scripts/publish-web.sh   build and commit, show the diff, push nothing
#
# Pages serves the site under /lettre-minute/, hence --base: the Android build
# keeps the root base Capacitor expects, so this never touches dist/.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo="${PAGES_REPO:-https://github.com/jfongue/lettre-minute.git}"
branch="${PAGES_BRANCH:-gh-pages}"
pages="$root/.cache/pages"
out="$root/.cache/pages-build"

cd "$root"

# Le site est la version livrée du jeu : c'est `main`. Publier depuis une
# branche en cours y ferait passer pour livré ce qui ne l’est pas — une page
# Premium, un écran de travail — et personne ne s'en aperçoit avant de
# l'avoir sous les yeux. Une publication volontaire d'une autre branche se
# demande : PUBLISH_ANY_BRANCH=1.
head_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "${PUBLISH_ANY_BRANCH:-}" != 1 ] && [ "$head_branch" != "main" ]; then
  echo "Refusé : ce dépôt est sur « $head_branch », pas sur main." >&2
  echo "Le site publié est celui de main ; PUBLISH_ANY_BRANCH=1 pour forcer." >&2
  exit 1
fi

npx tsc -b
rm -rf "$out"
npx vite build --base=/lettre-minute/ --outDir "$out" --emptyOutDir

# A clone's default branch is the source, so the published tree is always
# rebuilt from the published branch: a publication can never commit over main.
mkdir -p "$pages"
[ -d "$pages/.git" ] || git -C "$pages" init -q
if git -C "$pages" remote get-url origin >/dev/null 2>&1; then
  git -C "$pages" remote set-url origin "$repo"
else
  git -C "$pages" remote add origin "$repo"
fi
if git -C "$pages" fetch -q origin "$branch"; then
  git -C "$pages" checkout -q -B "$branch" FETCH_HEAD
else
  # First publication ever: the branch does not exist yet.
  git -C "$pages" checkout -q --orphan "$branch"
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
  git -C "$pages" push -q origin "$branch"
  echo "Published: https://jfongue.github.io/lettre-minute/ (live within a minute)"
fi
