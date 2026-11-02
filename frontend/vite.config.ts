import path from "node:path";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "ResQFlow — Disaster Management & Emergency Response",
        short_name: "ResQFlow",
        description: "Report incidents, request SOS help, find shelters and follow disaster alerts.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#b91c1c",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { allowedHosts: true, port: 5173, proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true }, "/socket.io": { target: "http://localhost:4000", changeOrigin: true, ws: true } } },
  preview: { allowedHosts: true, port: 4173, proxy: { "/api": { target: "http://localhost:4000", changeOrigin: true }, "/socket.io": { target: "http://localhost:4000", changeOrigin: true, ws: true } } },
});
