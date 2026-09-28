import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The version the Play Store knows, stamped on every tracked event: the
// dashboard tells which build a crash or a drop came from.
const appVersion = /versionName "([^"]+)"/.exec(readFileSync('android/app/build.gradle', 'utf8'))?.[1] ?? 'dev'

export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) },
  // Vite does not read PORT on its own; honouring it lets a harness or a second
  // checkout run the dev server on a port it picked.
  // 5199 plutôt que 5173 : le port par défaut de Vite est déjà celui d'un autre
  // projet du même poste, et les deux serveurs doivent pouvoir tourner ensemble.
  server: { port: Number(process.env.PORT) || 5199 },
  // The dictionaries are data chunks, loaded only when a category is played:
  // a 600 kB "animaux" chunk is the point, not an accident of bundling.
  // google.html is where the browser's Google popup lands (`googleIdToken`).
  build: { chunkSizeWarningLimit: 1000, rollupOptions: { input: ['index.html', 'google.html'] } },
})
