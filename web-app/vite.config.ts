import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Where the API runs in development. The dev server proxies to it so the
// browser sees one origin — no CORS preflights, and the same relative URLs as
// production, where nginx does the proxying (infra/docker/nginx.conf).
const API_TARGET = process.env.CHS_API_URL ?? "http://localhost:4100";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // packages/* are linked from outside this app and resolve their own
    // imports from the repo root. React and React Query must be the single
    // copy this app renders with — two Reacts break hooks, two React Querys
    // put the provider and the hooks in different contexts.
    dedupe: ["react", "react-dom", "@tanstack/react-query", "zod", "socket.io-client"],
  },
  server: {
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/realtime": { target: API_TARGET, changeOrigin: true, ws: true },
    },
    // Reachable from a phone on the LAN, not just localhost, so the admin
    // console can be checked on a real device without a tunnel.
    host: true,
    // The repo lives on /mnt/e — a Windows drive mounted into WSL through
    // drvfs, which does not deliver inotify events. Without polling, Vite
    // never sees an edit: it keeps serving the previous module and the change
    // looks like it did not work, which is indistinguishable from a bug in the
    // code you just wrote. Polling costs a little CPU and buys a dev loop that
    // actually reacts. Off outside WSL, where inotify works and polling is
    // pure waste.
    watch: process.env.WSL_DISTRO_NAME
      ? { usePolling: true, interval: 300 }
      : undefined,
  },
})
