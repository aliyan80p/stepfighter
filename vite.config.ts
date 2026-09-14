// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "path";

// Load all env vars into process.env for server routes (no VITE_ prefix).
// VITE_* env injection is still handled by the wrapped config for client code.
// The mode comes from the CLI (e.g. `vite build --mode cfprod`) so the
// Cloudflare production build reads .env.cfprod instead of the local .env.
const modeArgIndex = process.argv.indexOf("--mode");
const mode =
  modeArgIndex !== -1 && process.argv[modeArgIndex + 1]
    ? process.argv[modeArgIndex + 1]
    : (process.env.NODE_ENV ?? "development");
const serverEnv = loadEnv(mode, process.cwd(), "");
// Mode-specific files must win over the generic .env, so overwrite here —
// but never clobber a value the hosting platform already injected.
const injected = new Set(Object.keys(process.env));
for (const [key, value] of Object.entries(serverEnv)) {
  if (!injected.has(key)) process.env[key] = value;
}

export default defineConfig({
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
  },
});
