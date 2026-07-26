import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const qb = () => z.number().int().positive().default(2);

export type LibraryNode = {
  id: number;
  name: string;
  docId: number | null;
  section: string | null;
  parentId: number | null;
  leaf: number | null;
};

/** Full table of contents for a qbank's medical library (flat; the UI nests it). */
export const getLibraryToc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ data, context }) => {
    const rows: LibraryNode[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data: chunk, error } = await context.supabase
        .from("library_toc")
        .select("id,name,doc_id,section,parent_id,leaf")
        .eq("qbank_id", data.qbankId)
        .order("id")
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      if (!chunk?.length) break;
      for (const r of chunk as any[]) {
        rows.push({
          id: r.id,
          name: r.name,
          docId: r.doc_id ?? null,
          section: r.section || null,
          parentId: r.parent_id ?? null,
          leaf: r.leaf ?? null,
        });
      }
      if (chunk.length < page) break;
    }
    return rows;
  });

/** One decrypted library article. */
export const getLibraryDoc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("library_docs")
      .select("id,title,html,qbank_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Article not found");
    return row as { id: number; title: string; html: string; qbank_id: number };
  });

/** Title + full-text search across library articles. */
export const searchLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ qbankId: qb(), q: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const term = data.q.replace(/[%,()]/g, " ").trim();
    const byTitle = await context.supabase
      .from("library_docs")
      .select("id,title")
      .eq("qbank_id", data.qbankId)
      .ilike("title", `%${term}%`)
      .limit(40);
    const byBody = await context.supabase
      .from("library_docs")
      .select("id,title")
      .eq("qbank_id", data.qbankId)
      .ilike("plain", `%${term}%`)
      .limit(40);
    const seen = new Set<number>();
    const out: { id: number; title: string; inBody: boolean }[] = [];
    for (const r of (byTitle.data ?? []) as any[]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, title: r.title, inBody: false });
    }
    for (const r of (byBody.data ?? []) as any[]) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, title: r.title, inBody: true });
    }
    return out.slice(0, 60);
  });
