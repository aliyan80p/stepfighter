import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { redactPII } from "./lib/redact";
import { withSecurityHeaders } from "./lib/security-headers";



type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(redactPII(consumeLastCapturedError() ?? `h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Cloudflare Workers deliver vars/secrets on the per-request `env` object, not
// on `process.env`. Copy string bindings across (never overwriting an existing
// value) so server code can keep reading process.env on every host.
function hydrateProcessEnv(env: unknown): void {
  if (!env || typeof env !== "object") return;
  const target = (globalThis as { process?: { env?: Record<string, string> } }).process?.env;
  if (!target) return;
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string" && !target[key]) target[key] = value;
  }
}

type AssetsBinding = { fetch: (request: Request) => Promise<Response> };

function assetsBinding(env: unknown): AssetsBinding | undefined {
  const candidate = (env as { ASSETS?: AssetsBinding } | null | undefined)?.ASSETS;
  return candidate && typeof candidate.fetch === "function" ? candidate : undefined;
}

/**
 * Cloudflare routes every request to the Worker, so static files under
 * dist/client (JS/CSS chunks, favicon, manifest, service worker) must be
 * served from the ASSETS binding before the SSR handler runs — otherwise the
 * app ships HTML with no JavaScript and every image 404s.
 * Hosts without the binding (Lovable) simply skip this.
 */
async function serveStaticAsset(request: Request, env: unknown): Promise<Response | undefined> {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const assets = assetsBinding(env);
  if (!assets) return undefined;
  const { pathname } = new URL(request.url);
  if (pathname === "/" || pathname.startsWith("/api/")) return undefined;
  try {
    const response = await assets.fetch(request);
    if (response.status === 404) return undefined;
    return response;
  } catch {
    return undefined;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    hydrateProcessEnv(env);

    const staticAsset = await serveStaticAsset(request, env);
    if (staticAsset) return withSecurityHeaders(staticAsset, request);

    const { assertServerEnv } = await import("./lib/env.server");



    const missing = assertServerEnv();
    if (missing.length) {
      // Refuse to serve rather than run half-configured. The response says
      // nothing about which variable is absent.
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request);
    } catch (error) {
      const correlationId = crypto.randomUUID();
      console.error(`[${correlationId}]`, redactPII(error));
      return withSecurityHeaders(
        new Response(renderErrorPage(correlationId), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
      );
    }
  },

};
