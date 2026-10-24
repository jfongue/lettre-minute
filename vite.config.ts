/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { configDefaults } from 'vitest/config'

// The version the Play Store knows, stamped on every tracked event: the
// dashboard tells which build a crash or a drop came from.
const appVersion = /versionName "([^"]+)"/.exec(readFileSync('android/app/build.gradle', 'utf8'))?.[1] ?? 'dev'

// The commit a bundle was built from, readable in the debug board and on the
// document (data-build): the portal serves the build it has reviewed, not the
// one just uploaded, and « ça ne va toujours pas » has to be answerable without
// opening the portal — the page itself says which commit it runs.
const buildStamp = (() => {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  try {
    return `${git('rev-parse', '--short', 'HEAD')} · ${git('show', '-s', '--format=%cs', 'HEAD')}`
  } catch {
    return 'dev'
  }
})()

// `vite build --mode crazygames` (npm run crazygames:build): the portal's own
// page, relative paths, no public/ folder (privacy pages, invite art), and
// every outside service blanked whatever .env.local says but the server, for
// the leaderboards, and the privacy page it calls for — the game runs on the
// device, its progress kept by the portal's SDK (crazygames/README.md).
const CRAZYGAMES_BLANKS = [
  'VITE_ADMOB_INTERSTITIAL_ID',
  'VITE_PUSH_ENABLED',
  'VITE_GOOGLE_WEB_CLIENT_ID',
]

// The phone's plugins that pull code into a browser bundle even though only
// the Android shell calls them (src/lib/native.ts guards every call by
// `native` or a blanked variable): on CrazyGames they are no-ops, and the
// social-login providers alone weighed 40 kB of the first download.
const PHONE_ONLY_PLUGINS = ['@capgo/capacitor-social-login', '@capgo/native-purchases', '@capacitor-community/admob']
const PHONE_STUB = '\0phone-plugin-stub'

function crazyGamesLoad(): Plugin {
  return {
    name: 'lettre-minute-crazygames-load',
    enforce: 'pre',
    resolveId: (source) => (PHONE_ONLY_PLUGINS.includes(source) ? PHONE_STUB : null),
    load: (id) =>
      id === PHONE_STUB
        ? `const plugin = new Proxy({}, { get: () => () => Promise.reject(new Error('phone only')) })
const names = new Proxy({}, { get: (_, key) => String(key) })
export { plugin as SocialLogin, plugin as NativePurchases, plugin as AdMob }
export { names as PURCHASE_TYPE, names as AdmobConsentStatus, names as InterstitialAdPluginEvents, names as RewardAdPluginEvents }`
        : null,
    // The SDK and the main font are asked for with the bundle, not once the
    // bundle has run: the portal's player waits on the slowest of the three.
    transformIndexHtml: {
      order: 'post',
      handler: (_html, context) => {
        const font = Object.keys(context.bundle ?? {}).find((name) => /jost-latin-wght-normal-.*\.woff2$/.test(name))
        return [
          { tag: 'link', attrs: { rel: 'preload', as: 'script', href: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }, injectTo: 'head' },
          ...(font ? [{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `./${font}` }, injectTo: 'head' as const }] : []),
        ]
      },
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'crazygames' ? [crazyGamesLoad(), react()] : [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_BUILD': JSON.stringify(buildStamp),
    // The host the build is for (src/platform/index.ts), a literal the
    // minifier folds: the other hosts' code never reaches the bundle.
    'import.meta.env.VITE_PLATFORM': JSON.stringify(mode === 'crazygames' ? 'crazygames' : 'app'),
    ...(mode === 'crazygames' ? Object.fromEntries(CRAZYGAMES_BLANKS.map((name) => [`import.meta.env.${name}`, '""'])) : {}),
  },
  // Vite does not read PORT on its own; honouring it lets a harness or a second
  // checkout run the dev server on a port it picked.
  // 5199 plutôt que 5173 : le port par défaut de Vite est déjà celui d'un autre
  // projet du même poste, et les deux serveurs doivent pouvoir tourner ensemble.
  server: { port: Number(process.env.PORT) || 5199 },
  // The dictionaries are data chunks, loaded only when a category is played:
  // a 600 kB "animaux" chunk is the point, not an accident of bundling.
  // google.html is where the browser's Google popup lands (`googleIdToken`),
  // invite.html the page a shared invitation opens (src/invite.ts), dashboard/
  // the public dashboard (src/dashboard.tsx), a folder so Pages serves /dashboard.
  build:
    mode === 'crazygames'
      ? { chunkSizeWarningLimit: 1000, outDir: 'dist-crazygames', rollupOptions: { input: ['crazygames.html'] } }
      : { chunkSizeWarningLimit: 1000, rollupOptions: { input: ['index.html', 'google.html', 'invite.html', 'duel.html', 'dashboard/index.html'] } },
  ...(mode === 'crazygames' ? { base: './', publicDir: false as const } : {}),
  // Agent worktrees and scratch checkouts live inside the repo: without this,
  // `vitest run` also runs their copies of the suite (267 of 307 test files).
  test: { exclude: [...configDefaults.exclude, '.claude/**', '.cache/**'] },
}))
