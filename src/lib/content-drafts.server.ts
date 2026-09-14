/**
 * Test site vs live site.
 *
 * Both addresses run the same code against the same database. Edits made on
 * the live hostnames are written straight away; edits made anywhere else (the
 * workers.dev test address, the preview, localhost) are parked as drafts and
 * only reach real users when an admin presses "Publish to live".
 */
import { getRequestHeader } from "@tanstack/react-start/server";
import type { DraftEntity } from "./content-apply.server";

const DEFAULT_LIVE_HOSTS = ["stepfighter.com", "www.stepfighter.com"];

export function liveHosts(): string[] {
  const raw = process.env["LIVE_HOSTS"];
  if (!raw) return DEFAULT_LIVE_HOSTS;
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** True when this request came from the test address, so edits become drafts. */
export function isDraftSite(): boolean {
  let host = "";
  try {
    host = (getRequestHeader("host") ?? "").toLowerCase().split(":")[0] ?? "";
  } catch {
    host = "";
  }
  if (!host) return true;
  return !liveHosts().includes(host);
}

export type DraftInput = {
  entity: DraftEntity;
  qbank_id?: number | null;
  ref_id?: number | null;
  ref_key?: string | null;
  label: string;
  payload: unknown;
  created_by: string;
};

export async function saveDraft(admin: any, input: DraftInput): Promise<{ draft: true; id: number | null }> {
  const { data, error } = await admin
    .from("content_drafts")
    .insert({
      entity: input.entity,
      qbank_id: input.qbank_id ?? null,
      ref_id: input.ref_id ?? null,
      ref_key: input.ref_key ?? null,
      label: input.label,
      payload: input.payload,
      created_by: input.created_by,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return { draft: true, id: (data?.id as number) ?? null };
}
