import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
  resolve: {
    alias: {
      // Ensure proper resolution for wallet SDKs
      '@metamask/sdk': '@metamask/sdk',
    },
  },
  optimizeDeps: {
    include: ['@metamask/sdk'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
