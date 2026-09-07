import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // CRITICAL: pin one origin. IndexedDB is scoped per origin
    // (scheme+host+PORT), so localhost:5173 and localhost:5174 are treated as
    // different sites with separate databases. If Vite silently moves to
    // another port, the app loads an EMPTY database and history/queue look
    // "lost". strictPort makes Vite fail loudly instead of drifting.
    port: 5174,
    strictPort: true,
  },
  build: {
    // lucide-react bundles a single large icon factory; this keeps the build
    // output clean instead of warning on every build.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        // PUBLIC pages only. The staff queue tool is intentionally NOT hosted —
        // staff keep running it locally with `npm run dev`. Never add
        // Main public landing page.
        home: new URL('./home.html', import.meta.url).pathname,
        // Live queue page for pop-up events.
        live: new URL('./live.html', import.meta.url).pathname,
        // Next pop-up event info page.
        popup: new URL('./popup.html', import.meta.url).pathname,
        // Public home-studio booking request page.
        appointment: new URL('./appointment.html', import.meta.url).pathname,
        // Paperless waiver / consent gate (scanned from a printed QR).
        waiver: new URL('./waiver.html', import.meta.url).pathname,
        // Aftercare tips.
        aftercare: new URL('./aftercare.html', import.meta.url).pathname,
        // Privacy policy + legal notice.
        privacy: new URL('./privacy.html', import.meta.url).pathname,
      },
    },
  },
})
