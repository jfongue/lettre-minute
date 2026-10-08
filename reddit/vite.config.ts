import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { devvit } from '@devvit/start/vite'

const NATIVE = fileURLToPath(new URL('../src/lib/native.ts', import.meta.url))
const NATIVE_STUB = fileURLToPath(new URL('./src/client/nativeStub.ts', import.meta.url))

/**
 * The game's screens import its Capacitor shell; Reddit's webview gets the
 * no-ops instead, without Capacitor's plugins in the bundle.
 */
function nativeStub(): Plugin {
  return {
    name: 'lettre-minute-native-stub',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || !/(^|\/)native$/.test(source)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved?.id === NATIVE ? NATIVE_STUB : null
    },
  }
}

export default defineConfig({
  plugins: [nativeStub(), react(), devvit()],
  // The game's host (`src/platform/index.ts`): the other hosts' code stays out.
  define: { 'import.meta.env.VITE_PLATFORM': JSON.stringify('reddit') },
  // React and the game's code live one level up (`../node_modules`, `../src`):
  // one copy of React, whichever side imports it.
  resolve: { dedupe: ['react', 'react-dom'] },
})
