import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Injects the emitted CSS into the JS bundle, so the <script> tag is all you need.
function injectCss() {
  return {
    name: 'inject-css',
    enforce: 'post' as const,
    generateBundle(_options: unknown, bundle: Record<string, { type: string; source?: string; code?: string }>) {
      const css = Object.entries(bundle)
        .filter(([name, chunk]) => chunk.type === 'asset' && name.endsWith('.css'))
        .map(([name, chunk]) => {
          delete bundle[name]
          return String(chunk.source)
        })
        .join('')
      if (!css) return
      const entry = Object.values(bundle).find((c) => c.type === 'chunk')!
      entry.code =
        `(function(){var s=document.createElement("style");s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();` +
        entry.code
    },
  }
}

export default defineConfig({
  plugins: [react(), injectCss()],
  // Lib mode leaves process.env in the bundle; the browser has no process.
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/embed.tsx'),
      name: 'Kanza',
      fileName: () => 'kanza.embed.js',
      formats: ['iife'],
    },
  },
})
