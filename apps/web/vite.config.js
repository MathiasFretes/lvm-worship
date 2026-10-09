import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { visualizer } from 'rollup-plugin-visualizer'

// Consume packages/core as TS source (no build step). The alias points the
// @lavozmisionera/core specifier (and its subpaths) at the package source so
// esbuild/Vite transpile it as part of the app graph. Paths are relative to
// apps/web/ — packages/ and the repo-root .env live two levels up.
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

const SW_VERSION = process.env.VITE_COMMIT_SHA || new Date().toISOString()

export default defineConfig({
  // Keep assets rooted at the site origin for absolute public paths.
  base: '/',
  // .env stays at the repo root (alongside .env.example), not in apps/web.
  envDir: repoRoot,
  define: {
    __SW_VERSION__: JSON.stringify(SW_VERSION),
  },
  resolve: {
    alias: [
      { find: '@lavozmisionera/core', replacement: coreSrc },
    ],
  },
  plugins: [
    react({
      // Make the React plugin handle .js files too (not just .jsx/.tsx)
      include: [/\.jsx?$/, /\.tsx?$/], // includes .js, .jsx, .ts, .tsx
      jsxRuntime: 'automatic',
    }),
    viteStaticCopy({
      targets: [
        { src: 'src/sw.js', dest: '' },
        { src: '404.html', dest: '' },
        // Ensure the dot-directory deep-link files land in dist/ deterministically.
        { src: 'public/.well-known/apple-app-site-association', dest: '.well-known' },
        { src: 'public/.well-known/assetlinks.json', dest: '.well-known' }
      ]
    }),
    // Enable bundle analysis with ANALYZE=1 to find unused JS and split chunks safely
    process.env.ANALYZE ? visualizer({ filename: 'dist/stats.html', template: 'treemap' }) : null
  ],
  // In local dev, proxy /bible/* and /pptx/* to the R2 CDN so the Pages Function path is simulated.
  // Set VITE_R2_PUBLIC_URL in .env.local to enable this (e.g. https://assets.lavozmisionera.com).
  server: process.env.VITE_R2_PUBLIC_URL
    ? {
        proxy: {
          '/bible': {
            target: process.env.VITE_R2_PUBLIC_URL,
            changeOrigin: true,
          },
          '/pptx': {
            target: process.env.VITE_R2_PUBLIC_URL,
            changeOrigin: true,
          },
        },
      }
    : {},
  build: {
    outDir: 'dist',
    // Keep previous hashed assets so stale cached HTML can still load CSS/JS.
    // This is important when a CDN caches HTML longer than expected.
    emptyOutDir: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase':     ['@supabase/supabase-js'],
          'i18n':         ['i18next', 'react-i18next'],
          'helmet':       ['react-helmet-async'],
        },
      },
    },
  },
  optimizeDeps: {
    // pako v2 dropped its "main" field (only "module" + "exports" remain).
    // Explicitly including it here ensures vite's esbuild optimizer selects
    // the CJS entry (exports.require → index.js) rather than falling back to
    // the ESM "module" field when jszip calls require('pako').
    include: ['pako'],
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './src/setupTests.js',
    globals: true,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key'
    }
  }
})
