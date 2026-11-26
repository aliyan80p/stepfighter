import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { internalError } from "./errors";

const qb = () => z.number().int().positive().default(2);

/**
 * The medical library is shared across every course (Step 1 / 2 CK / 3):
 * the content lives under a single qbank row, so all queries pin to it and
 * the caller's active course is ignored.
 */
const LIBRARY_QBANK_ID = 2;

export type LibraryNode = {
  id: number;
  name: string;
  docId: number | null;
  section: string | null;
  parentId: number | null;
  leaf: number | null;
};

const TOC_CACHE_TTL_MS = 30 * 60 * 1000;
let tocCache: { rows: LibraryNode[]; expiresAt: number } | null = null;

/** Full table of contents for a qbank's medical library (flat; the UI nests it). */
export const getLibraryToc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ qbankId: qb() }).parse(d))
  .handler(async ({ context }) => {
    const now = Date.now();
    if (tocCache && tocCache.expiresAt > now) {
      return tocCache.rows;
    }

    const page = 1000;

    const fetchPage = async (from: number) => {
      const { data: chunk, error } = await context.supabase
        .from("library_toc")
        .select("id,name,doc_id,section,parent_id,leaf")
        .eq("qbank_id", LIBRARY_QBANK_ID)
        .order("id")
        .range(from, from + page - 1);
      if (error) throw internalError(error);
      return (chunk ?? []) as any[];
    };

    // Total first, then fetch every page in parallel: sequential paging made
    // the table of contents take ~15s on slower/remote database regions.
    const { count, error: countError } = await context.supabase
      .from("library_toc")
      .select("id", { count: "exact", head: true })
      .eq("qbank_id", LIBRARY_QBANK_ID);
    if (countError) throw internalError(countError);

    const total = count ?? 0;
    const offsets: number[] = [];
    for (let from = 0; from < total; from += page) offsets.push(from);

    const chunks = await Promise.all(offsets.map(fetchPage));
    const rows: LibraryNode[] = [];
    for (const chunk of chunks) {
      for (const r of chunk) {
        rows.push({
          id: r.id,
          name: r.name,
          docId: r.doc_id ?? null,
          section: r.section || null,
          parentId: r.parent_id ?? null,
          leaf: r.leaf ?? null,
        });
      }
    }
    if (rows.length > 0) {
      tocCache = { rows, expiresAt: now + TOC_CACHE_TTL_MS };
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
    if (error) throw internalError(error);
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
    const [byTitle, byBody] = await Promise.all([
      context.supabase
        .from("library_docs")
        .select("id,title")
        .eq("qbank_id", LIBRARY_QBANK_ID)
        .ilike("title", `%${term}%`)
        .limit(40),
      context.supabase
        .from("library_docs")
        .select("id,title")
        .eq("qbank_id", LIBRARY_QBANK_ID)
        .ilike("plain", `%${term}%`)
        .limit(40),
    ]);
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
