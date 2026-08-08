import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig(({ mode }) => ({
  server: { port: 3000 },
  resolve: mode === 'test'
    ? { alias: { 'cloudflare:workers': path.resolve('src/test-cloudflare-workers.ts') } }
    : undefined,
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), tanstackStart(), react()],
}))
