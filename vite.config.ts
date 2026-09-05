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
    rollupOptions: {
      input: {
        // PUBLIC pages only. The staff queue tool is intentionally NOT hosted —
        // staff keep running it locally with `npm run dev`. Never add
        // `main: index.html` here or the staff UI would become public.
        live: new URL('./live.html', import.meta.url).pathname,
        // Public home-studio booking request page.
        appointment: new URL('./appointment.html', import.meta.url).pathname,
      },
    },
  },
})
