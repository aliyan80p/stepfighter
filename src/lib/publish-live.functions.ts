/**
 * "Publish to live" — copies reviewed content edits from this site's database
 * to the real (live) site's database.
 *
 * The live target is configured with two server settings:
 *   LIVE_SUPABASE_URL
 *   LIVE_SUPABASE_SERVICE_ROLE_KEY
 * When they are missing, the tab explains that no live site is connected yet
 * instead of failing.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { internalError } from "./errors";

const MEDIA_BUCKET = "qbank-media-plain";

export type PendingChange = {
  id: number;
  entity: string;
  qbank_id: number | null;
  ref_id: number | null;
  ref_key: string | null;
  action: string;
  label: string | null;
  changed_at: string;
};

async function assertPublisher(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_admin_permission", {
    _user_id: userId,
    _permission: "publish",
  });
  if (error) throw internalError(error);
  if (!data) throw new Error("Forbidden");
}

function liveConfig() {
  const url = process.env["LIVE_SUPABASE_URL"];
  const key = process.env["LIVE_SUPABASE_SERVICE_ROLE_KEY"];
  return url && key ? { url, key } : null;
}

async function liveClient() {
  const cfg = liveConfig();
  if (!cfg) throw new Error("No live site is connected yet");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const publishTargetStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ configured: boolean; host: string | null }> => {
    await assertPublisher(context.supabase, context.userId);
    const cfg = liveConfig();
    if (!cfg) return { configured: false, host: null };
    let host: string | null = null;
    try {
      host = new URL(cfg.url).host;
    } catch {
      host = null;
    }
    return { configured: true, host };
  });

export const listPendingChanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ context, data }): Promise<{ rows: PendingChange[] }> => {
    await assertPublisher(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("content_changes")
      .select("id, entity, qbank_id, ref_id, ref_key, action, label, changed_at")
      .is("published_at", null)
      .order("changed_at", { ascending: false })
      .limit(Math.min(Math.max(data.limit ?? 300, 1), 1000));
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as PendingChange[] };
  });

export const discardChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: number[] }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertPublisher(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.ids.length) return { ok: true };
    const { error } = await supabaseAdmin
      .from("content_changes")
      .delete()
      .in("id", data.ids);
    if (error) throw internalError(error);
    return { ok: true };
  });

/** Copies one change from this database to the live one. */
async function applyChange(src: any, live: any, row: PendingChange) {
  const qbank = row.qbank_id;

  if (row.entity === "question" && qbank != null && row.ref_id != null) {
    if (row.action === "delete") {
      await live.from("answers").delete().eq("qbank_id", qbank).eq("question_id", row.ref_id);
      const { error } = await live.from("questions").delete().eq("qbank_id", qbank).eq("id", row.ref_id);
      if (error) throw error;
      return;
    }
    const { data: q, error: qErr } = await src
      .from("questions")
      .select("*")
      .eq("qbank_id", qbank)
      .eq("id", row.ref_id)
      .maybeSingle();
    if (qErr) throw qErr;
    if (!q) return;
    const { error: upErr } = await live.from("questions").upsert(q, { onConflict: "qbank_id,id" });
    if (upErr) throw upErr;

    const { data: answers, error: aErr } = await src
      .from("answers")
      .select("*")
      .eq("qbank_id", qbank)
      .eq("question_id", row.ref_id);
    if (aErr) throw aErr;
    await live.from("answers").delete().eq("qbank_id", qbank).eq("question_id", row.ref_id);
    if ((answers ?? []).length) {
      const { error } = await live.from("answers").upsert(answers, { onConflict: "qbank_id,id" });
      if (error) throw error;
    }
    return;
  }

  if (row.entity === "library" && row.ref_id != null) {
    if (row.action === "delete") {
      await live.from("library_toc").update({ doc_id: null }).eq("doc_id", row.ref_id);
      const { error } = await live.from("library_docs").delete().eq("id", row.ref_id);
      if (error) throw error;
      return;
    }
    const { data: doc, error } = await src
      .from("library_docs")
      .select("*")
      .eq("id", row.ref_id)
      .maybeSingle();
    if (error) throw error;
    if (!doc) return;
    const { error: upErr } = await live.from("library_docs").upsert(doc, { onConflict: "id" });
    if (upErr) throw upErr;
    return;
  }

  if (row.entity === "media" && row.ref_key) {
    if (row.action === "delete") {
      await live.storage.from(MEDIA_BUCKET).remove([row.ref_key]);
      if (qbank != null) {
        await live.from("qbank_media").delete().eq("qbank_id", qbank).eq("name", row.ref_key);
      }
      return;
    }
    const { data: blob, error } = await src.storage.from(MEDIA_BUCKET).download(row.ref_key);
    if (error) throw error;
    const bytes = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await live.storage
      .from(MEDIA_BUCKET)
      .upload(row.ref_key, bytes, { contentType: blob.type || "image/jpeg", upsert: true });
    if (upErr) throw upErr;
    if (qbank != null) {
      const { data: meta } = await src
        .from("qbank_media")
        .select("*")
        .eq("qbank_id", qbank)
        .eq("name", row.ref_key)
        .maybeSingle();
      if (meta) await live.from("qbank_media").upsert(meta, { onConflict: "qbank_id,name" });
    }
    return;
  }

  if ((row.entity === "subject" || row.entity === "system") && qbank != null && row.ref_id != null) {
    const table = row.entity === "subject" ? "subjects" : "systems";
    if (row.action === "delete") {
      const { error } = await live.from(table).delete().eq("qbank_id", qbank).eq("id", row.ref_id);
      if (error) throw error;
      return;
    }
    const { data: item, error } = await src
      .from(table)
      .select("*")
      .eq("qbank_id", qbank)
      .eq("id", row.ref_id)
      .maybeSingle();
    if (error) throw error;
    if (!item) return;
    const { error: upErr } = await live.from(table).upsert(item, { onConflict: "qbank_id,id" });
    if (upErr) throw upErr;
    return;
  }

  if (row.entity === "course" && row.ref_id != null) {
    const { data: course, error } = await src
      .from("qbanks")
      .select("*")
      .eq("id", row.ref_id)
      .maybeSingle();
    if (error) throw error;
    if (!course) return;
    const { error: upErr } = await live.from("qbanks").upsert(course, { onConflict: "id" });
    if (upErr) throw upErr;
    return;
  }

  if (row.entity === "topic" && qbank != null && row.ref_key) {
    // ref_key holds "old name\u0000new name".
    const [from, to] = row.ref_key.split("\u0000");
    if (!from || !to) return;
    const { error } = await live
      .from("questions")
      .update({ title: to })
      .eq("qbank_id", qbank)
      .eq("title", from);
    if (error) throw error;
    return;
  }
}

export const publishChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: number[] }) => d)
  .handler(
    async ({
      context,
      data,
    }): Promise<{ published: number; failed: { id: number; message: string }[] }> => {
      await assertPublisher(context.supabase, context.userId);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const live = await liveClient();

      if (!data.ids.length) return { published: 0, failed: [] };

      const { data: rows, error } = await supabaseAdmin
        .from("content_changes")
        .select("id, entity, qbank_id, ref_id, ref_key, action, label, changed_at")
        .in("id", data.ids)
        .is("published_at", null)
        .order("changed_at", { ascending: true });
      if (error) throw internalError(error);

      const failed: { id: number; message: string }[] = [];
      const done: number[] = [];

      for (const row of (rows ?? []) as PendingChange[]) {
        try {
          await applyChange(supabaseAdmin, live, row);
          done.push(row.id);
        } catch (e: any) {
          failed.push({ id: row.id, message: String(e?.message ?? e) });
        }
      }

      if (done.length) {
        await supabaseAdmin
          .from("content_changes")
          .update({ published_at: new Date().toISOString(), published_by: context.userId })
          .in("id", done);
      }

      return { published: done.length, failed };
    },
  );
