import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:3000'

  return {
    plugins: [
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        // Proxy /api to the Python backend. Set VITE_PROXY_TARGET in .env.local for network IP.
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
