import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This app imports the built library from ../dist, which is outside its own
// root, so Vite needs permission to serve the parent folder. There are no
// dependencies here: vite, react and the react plugin all come from the
// node_modules of the repo one folder up, so there is only one copy of React.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..'] } },

  // Serves ../dist as static files, so embed.html can load the embed bundle
  // from /replikateur.embed.js the same way a <script> tag on a real page does.
  publicDir: '../dist',
})
