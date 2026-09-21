import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
