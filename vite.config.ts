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
const serverEnv = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

// Values the hosting platform injects (Lovable-managed Supabase). Captured BEFORE the
// .env/.env.local overlay so a local override can swap them out of client bundles.
const platformEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID,
} as Record<string, string | undefined>;

Object.assign(process.env, serverEnv);

// When .env.local points at a self-managed Supabase project, rewrite the platform-injected
// import.meta.env literals in client code so dev/preview talks to that project instead.
const overrides = Object.entries(platformEnv)
  .map(([key, oldValue]) => {
    const newValue =
      serverEnv[key] ??
      (key === "VITE_SUPABASE_ANON_KEY" ? serverEnv["VITE_SUPABASE_PUBLISHABLE_KEY"] : undefined);
    return oldValue && newValue && oldValue !== newValue ? ([oldValue, newValue] as const) : null;
  })
  .filter((pair): pair is readonly [string, string] => pair !== null);

const supabaseEnvOverridePlugin = {
  name: "local-supabase-env-override",
  enforce: "post" as const,
  transform(code: string) {
    if (!overrides.length) return null;
    let out = code;
    for (const [oldValue, newValue] of overrides) out = out.split(oldValue).join(newValue);
    return out === code ? null : { code: out, map: null };
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [supabaseEnvOverridePlugin],

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
