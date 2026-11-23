import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const backend = "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Saathi — UP Heritage Companion",
        short_name: "Saathi",
        description: "Your heritage guide for Uttar Pradesh, in your language.",
        theme_color: "#7a2e1c",
        background_color: "#faf7f0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/data/],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /\/data\/.*\.(json|geojson)$/, handler: "StaleWhileRevalidate",
            options: { cacheName: "city-data" } },
          { urlPattern: /\/data\/.*\.mp3$/, handler: "CacheFirst",
            options: { cacheName: "tour-audio", rangeRequests: true,
                       cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/, handler: "CacheFirst",
            options: { cacheName: "map-tiles", expiration: { maxEntries: 3000 },
                       cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, handler: "CacheFirst",
            options: { cacheName: "fonts", cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/upload\.wikimedia\.org\/.*/, handler: "CacheFirst",
            options: { cacheName: "photos", expiration: { maxEntries: 300 },
                       cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
    }),
  ],
  worker: { format: "es" },
  server: { proxy: { "/api": backend, "/data": backend }, host: true },
});
