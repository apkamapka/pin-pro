import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "robots.txt",
      ],
      manifest: {
        name: "Mapelo — mapa klientów",
        short_name: "Mapelo",
        description:
          "Mapa klientów z kolorowymi pinami opartymi o terminy wizyt. Działa offline, dane lokalne.",
        theme_color: "#2563eb",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "pl",
        categories: ["business", "productivity", "navigation"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache wszystkie zasoby buildu (JS, CSS, HTML, ikony, fonty).
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Cache kafelków OpenStreetMap — działa offline po pierwszym
        // odwiedzeniu danego obszaru.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith(".tile.openstreetmap.org") ||
              url.hostname.endsWith(".basemaps.cartocdn.com") ||
              url.hostname.endsWith("tile.openstreetmap.org"),
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dni
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname === "nominatim.openstreetmap.org",
            handler: "NetworkFirst",
            options: {
              cacheName: "geocode",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dni
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Bezpiecznik: nie precache'uj plików większych niż 3 MB.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        // W trybie dev nie rejestrujemy SW — nie chcemy zaśmiecać HMR.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
