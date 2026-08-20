import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { umamiPlugin } from './vite/umami-plugin'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    base: '/struxure/',
    plugins: [
      react(),
      tailwindcss(),
      umamiPlugin(env.VITE_UMAMI_ID, env.VITE_UMAMI_SRC || 'https://cloud.umami.is/script.js'),
      viteStaticCopy({
        targets: [{
          src: 'node_modules/web-ifc/*.wasm',
          dest: '.',
        }],
      }),
    ],
    optimizeDeps: {
      exclude: ['web-ifc'],
    },
  }
})
