// Standard TanStack Start + Vite config (no Lovable wrapper).
// Deploys to Vercel via preset.
/// <reference types="vitest" />
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { SITE_URL } from "./src/lib/site";

// The deployed origin is resolved once, here, from the build environment and
// baked into both the client and SSR bundles. scripts/generate-sitemap.ts and
// scripts/generate-robots.ts read the same constant, so the HTML and the two
// generated files cannot disagree about the host. On Vercel this needs no
// configuration (VERCEL_PROJECT_PRODUCTION_URL is supplied); anywhere else,
// build with SITE_URL set. See src/lib/site.ts for the precedence.
export default defineConfig({
  define: {
    __SITE_URL__: JSON.stringify(SITE_URL),
  },
  server: {
    // Vite blocks unknown Host headers by default; the app is developed
    // behind tunneling/preview proxies (Arena, ngrok, LAN devices) whose
    // hostnames aren't known ahead of time. Dev-server only — production
    // serves the built app from Vercel and is unaffected.
    allowedHosts: true,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    tsconfigPaths: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("src/data/nodes.ts")) return "nodes";
          return undefined;
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: {
        preset: "vercel",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
    viteReact(),
  ],
});
