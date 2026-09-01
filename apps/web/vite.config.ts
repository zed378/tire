import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * A plain Vite SPA (PLAN/01 §4.2).
 *
 * Chosen over a fullstack framework deliberately, and the trade is real: a
 * second deployable and CORS configuration, paid once. What it buys is a
 * client/server boundary that cannot leak — there is no way to call the
 * database from a component — a backend not tied to React, and a service worker
 * that is far simpler to control than one living alongside SSR (PLAN/06).
 *
 * No inline scripts or styles, because the CSP carries no 'unsafe-inline'
 * (PLAN/13 §7, decision A-07). That is much easier to start with than to
 * retrofit after hundreds of components exist.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5573,
    proxy: {
      // Development only. In production the SPA is static files served by Caddy
      // and talks to tire-api.zedth.my.id across origins.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    // Keeps assets as separate files rather than data: URIs, so the CSP stays
    // tight and the cache behaves predictably.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          // The dashboard chart is hand-written SVG rather than a charting
          // library — see components/ui/line-chart.tsx. That keeps the initial
          // bundle inside the 180 KB budget (PLAN/06 §7) and keeps the CSP free
          // of 'unsafe-inline' (PLAN/13 §7).
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
          ],
        },
      },
    },
  },
});
