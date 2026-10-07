/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// The version the Play Store knows, stamped on every tracked event: the
// dashboard tells which build a crash or a drop came from.
const appVersion = /versionName "([^"]+)"/.exec(readFileSync('android/app/build.gradle', 'utf8'))?.[1] ?? 'dev'

// `vite build --mode crazygames` (npm run crazygames:build): the portal's own
// page, relative paths, no public/ folder (privacy pages, invite art), and
// every outside service blanked whatever .env.local says — the game runs on
// the device, its progress kept by the portal's SDK (crazygames/README.md).
const CRAZYGAMES_BLANKS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_PRIVACY_URL',
  'VITE_ADMOB_INTERSTITIAL_ID',
  'VITE_PUSH_ENABLED',
  'VITE_GOOGLE_WEB_CLIENT_ID',
  'VITE_TESTER_GROUP_URL',
]

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    ...(mode === 'crazygames'
      ? {
          'import.meta.env.VITE_PLATFORM': JSON.stringify('crazygames'),
          ...Object.fromEntries(CRAZYGAMES_BLANKS.map((name) => [`import.meta.env.${name}`, '""'])),
        }
      : {}),
  },
  // Vite does not read PORT on its own; honouring it lets a harness or a second
  // checkout run the dev server on a port it picked.
  // 5199 plutôt que 5173 : le port par défaut de Vite est déjà celui d'un autre
  // projet du même poste, et les deux serveurs doivent pouvoir tourner ensemble.
  server: { port: Number(process.env.PORT) || 5199 },
  // The dictionaries are data chunks, loaded only when a category is played:
  // a 600 kB "animaux" chunk is the point, not an accident of bundling.
  // google.html is where the browser's Google popup lands (`googleIdToken`),
  // invite.html the page a shared invitation opens (src/invite.ts).
  build:
    mode === 'crazygames'
      ? { chunkSizeWarningLimit: 1000, outDir: 'dist-crazygames', rollupOptions: { input: ['crazygames.html'] } }
      : { chunkSizeWarningLimit: 1000, rollupOptions: { input: ['index.html', 'google.html', 'invite.html', 'duel.html'] } },
  ...(mode === 'crazygames' ? { base: './', publicDir: false as const } : {}),
  // Agent worktrees and scratch checkouts live inside the repo: without this,
  // `vitest run` also runs their copies of the suite (267 of 307 test files).
  test: { exclude: [...configDefaults.exclude, '.claude/**', '.cache/**'] },
}))
