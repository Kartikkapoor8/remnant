import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// PORT is the Bun API port and WEB_PORT this dev server's port; both default to
// what the README documents (8787 and 5173) and are set by `bun run demo`.
const apiPort = process.env.PORT ?? "8787";
const webPort = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: webPort,
    // Cloudflare quick tunnels (cloudflared tunnel --url) get a random *.trycloudflare.com host.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
    },
  },
});
