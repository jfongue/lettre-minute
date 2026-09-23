import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Vite does not read PORT on its own; honouring it lets a harness or a second
  // checkout run the dev server on a port it picked.
  // 5199 plutôt que 5173 : le port par défaut de Vite est déjà celui d'un autre
  // projet du même poste, et les deux serveurs doivent pouvoir tourner ensemble.
  server: { port: Number(process.env.PORT) || 5199 },
  // The dictionaries are data chunks, loaded only when a category is played:
  // a 600 kB "animaux" chunk is the point, not an accident of bundling.
  build: { chunkSizeWarningLimit: 1000 },
})
