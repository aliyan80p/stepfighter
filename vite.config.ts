// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // Existing VITE_* env (do not change) — feeds client envDefine.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Load all env vars into process.env for server routes (no VITE_ prefix).
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);

  return {
    tanstackStart: {
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this
      server: { entry: "server" },
    },
    vite: {
      // Pin entities to the hoisted v4.5.0 copy so React Email SSR works.
      resolve: {
        alias: {
          "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
          "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
          entities: path.resolve(__dirname, "node_modules/entities"),
        },
      },
      // Keep client envDefine intact.
      define: env,
    },
  };
});
