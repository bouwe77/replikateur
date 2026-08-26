/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/kanza', 'src/vite-env.d.ts'],
      exclude: ['**/*.test.tsx'],
      rollupTypes: true,
    }),
  ],

  build: {
    lib: {
      entry: resolve(__dirname, 'src/kanza/index.ts'),
      name: 'Kanza',
      fileName: 'kanza',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/setupTests.ts',
  },
})
