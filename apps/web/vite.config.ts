import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Cloudflare quick tunnels (cloudflared tunnel --url) get a random *.trycloudflare.com host.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
});
