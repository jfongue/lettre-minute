#!/bin/sh
# Rebuilds the social kit in .cache/social-kit/kit (store/social/README.md):
# an offline build, a run filmed per language, the stills, the videos, the end.
set -e
cd "$(dirname "$0")/.."
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_PUSH_ENABLED=false npx vite build --outDir .cache/social-dist --emptyOutDir
npx vite preview --outDir .cache/social-dist --port 5761 --strictPort >/dev/null 2>&1 &
preview=$!
trap 'kill $preview' EXIT
sleep 3
for lang in fr en de es it nl pt; do node store/social/capture.ts "$lang"; done
node store/social/render-stills.ts
npm --prefix store/social install --no-audit --no-fund
node store/social/render-videos.ts
node store/social/finish.ts
