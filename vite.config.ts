import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
let commit = "dev";
try { commit = execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* not a git checkout */ }

export default defineConfig({
  // Relative paths, so the same build works at the live address and at each pull request's test address.
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify((process.env.JFDI_COMMIT ?? commit).slice(0, 7)),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "J.F.D.I",
        short_name: "J.F.D.I",
        description: "Build training programmes and run them in the gym.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "any",
        background_color: "#111214",
        theme_color: "#111214",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "index.html",
        // The live app's service worker must not answer for the test versions published beneath it.
        navigateFallbackDenylist: [/\/pr-preview\//],
      },
    }),
  ],
  build: { target: "es2022" },
});
