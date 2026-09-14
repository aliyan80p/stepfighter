// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "path";

// Load local env vars for development without overwriting values supplied by
// the deployment environment. GitHub Actions injects the managed production
// database values before Vite starts; those must take precedence over .env.
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
for (const [key, value] of Object.entries(serverEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

// The Lovable config normally reloads VITE_* from .env into `define`, which
// would overwrite values injected by GitHub Actions. Build the definitions
// explicitly so deployment environment variables always win, while local
// development can still use .env.
const clientEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? serverEnv.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? serverEnv.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID:
    process.env.VITE_SUPABASE_PROJECT_ID ?? serverEnv.VITE_SUPABASE_PROJECT_ID,
};

const clientEnvDefine = Object.fromEntries(
  Object.entries(clientEnv)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
);

export default defineConfig({
  envDefine: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: clientEnvDefine,
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
