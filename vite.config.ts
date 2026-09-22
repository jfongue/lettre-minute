import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Vite does not read PORT on its own; honouring it lets a harness or a second
  // checkout run the dev server on a port it picked.
  server: { port: Number(process.env.PORT) || 5173 },
  // The dictionaries are data chunks, loaded only when a category is played:
  // a 600 kB "animaux" chunk is the point, not an accident of bundling.
  build: { chunkSizeWarningLimit: 1000 },
})
