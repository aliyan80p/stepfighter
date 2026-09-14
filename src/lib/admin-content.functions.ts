import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { internalError } from "./errors";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

import { assertPermission } from "@/lib/admin.functions";
import type { AdminPermission } from "@/lib/admin-permissions";

async function assertAdmin(supabase: any, userId: string, permission: AdminPermission) {
  await assertPermission(supabase, userId, permission);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function nextId(db: any, table: string) {
  const { data, error } = await db.from(table).select("id").order("id", { ascending: false }).limit(1);
  if (error) throw internalError(error);
  return ((data?.[0]?.id as number) ?? 0) + 1;
}

/* ------------------------------------------------------------------ */
/* courses (qbanks)                                                    */
/* ------------------------------------------------------------------ */

export type AdminQbank = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  question_count: number;
};

export const listQbanksAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminQbank[]> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data, error } = await db.from("qbanks").select("id, slug, name, description").order("id");
    if (error) throw internalError(error);
    const out: AdminQbank[] = [];
    for (const q of data ?? []) {
      const { count } = await db
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("qbank_id", q.id as number);
      out.push({
        id: q.id as number,
        slug: q.slug as string,
        name: q.name as string,
        description: (q.description as string | null) ?? null,
        question_count: count ?? 0,
      });
    }
    return out;
  });

export const saveQbank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: number; slug: string; name: string; description?: string | null }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const slug = data.slug.trim().toLowerCase();
    if (!slug || !data.name.trim()) throw new Error("Slug and name are required");
    const id = data.id ?? (await nextId(db, "qbanks"));
    const { error } = await db
      .from("qbanks")
      .upsert({ id, slug, name: data.name.trim(), description: data.description ?? null }, { onConflict: "id" });
    if (error) throw internalError(error);
    return { ok: true, id };
  });

/* ------------------------------------------------------------------ */
/* subjects & systems                                                  */
/* ------------------------------------------------------------------ */

export type Taxon = { id: number; name: string; count: number | null; qbank_id: number };

export const listTaxonomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number }) => d)
  .handler(async ({ context, data }): Promise<{ subjects: Taxon[]; systems: Taxon[] }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const [s, y] = await Promise.all([
      db.from("subjects").select("id, name, count, qbank_id").eq("qbank_id", data.qbank_id).order("name"),
      db.from("systems").select("id, name, count, qbank_id").eq("qbank_id", data.qbank_id).order("name"),
    ]);
    if (s.error) throw internalError(s.error);
    if (y.error) throw internalError(y.error);
    return { subjects: (s.data ?? []) as Taxon[], systems: (y.data ?? []) as Taxon[] };
  });

export const saveTaxon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "subjects" | "systems"; id?: number; qbank_id: number; name: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    if (!data.name.trim()) throw new Error("Name is required");
    const id = data.id ?? (await nextId(db, data.kind));
    const { error } = await db
      .from(data.kind)
      .upsert({ id, qbank_id: data.qbank_id, name: data.name.trim() }, { onConflict: "id" });
    if (error) throw internalError(error);
    return { ok: true, id };
  });

export const deleteTaxon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "subjects" | "systems"; id: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const col = data.kind === "subjects" ? "subject_id" : "system_id";
    const { count } = await db.from("questions").select("id", { count: "exact", head: true }).eq(col, data.id);
    if ((count ?? 0) > 0) throw new Error(`Still used by ${count} question(s) — reassign them first`);
    const { error } = await db.from(data.kind).delete().eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* questions: search / full read / write / delete                      */
/* ------------------------------------------------------------------ */

export type QuestionListRow = {
  id: number;
  qbank_id: number;
  title: string | null;
  source: string;
  subject_id: number | null;
  system_id: number | null;
  question: string;
};

export const searchQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    qbank_id: number;
    text?: string;
    subject_id?: number | null;
    system_id?: number | null;
    source?: string | null;
    limit?: number;
    offset?: number;
  }) => d)
  .handler(async ({ context, data }): Promise<{ rows: QuestionListRow[]; total: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const limit = Math.min(Math.max(data.limit ?? 25, 1), 100);
    const offset = Math.max(data.offset ?? 0, 0);

    let q = db
      .from("questions")
      .select("id, qbank_id, title, source, subject_id, system_id, question", { count: "exact" })
      .eq("qbank_id", data.qbank_id);

    const text = (data.text ?? "").trim();
    if (text) {
      if (/^\d+$/.test(text)) q = q.eq("id", Number(text));
      else {
        const esc = text.replace(/[%,]/g, " ");
        q = q.or(`title.ilike.%${esc}%,question.ilike.%${esc}%`);
      }
    }
    if (data.subject_id) q = q.eq("subject_id", data.subject_id);
    if (data.system_id) q = q.eq("system_id", data.system_id);
    if (data.source) q = q.eq("source", data.source);

    const { data: rows, count, error } = await q.order("id").range(offset, offset + limit - 1);
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as QuestionListRow[], total: count ?? 0 };
  });

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number }) => d)
  .handler(async ({ context, data }): Promise<string[]> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: rows, error } = await db
      .from("questions")
      .select("source")
      .eq("qbank_id", data.qbank_id)
      .limit(50000);
    if (error) throw internalError(error);
    return Array.from(new Set((rows ?? []).map((r: any) => r.source as string).filter(Boolean))).sort();
  });

export type FullQuestion = {
  id: number;
  qbank_id: number;
  title: string | null;
  question: string;
  explanation: string | null;
  correct_answer: number | null;
  subject_id: number | null;
  system_id: number | null;
  source: string;
  media_name: string | null;
  other_medias: string | null;
  answers: { id: number; answer_index: number; answer_text: string; correct_percentage: number | null }[];
  refs: { id: number; ref_title: string | null; ref_link: string | null }[];
};

export const getFullQuestion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }): Promise<FullQuestion | null> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: q, error } = await db
      .from("questions")
      .select(
        "id, qbank_id, title, question, explanation, correct_answer, subject_id, system_id, source, media_name, other_medias",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw internalError(error);
    if (!q) return null;
    const [a, r] = await Promise.all([
      db.from("answers").select("id, answer_index, answer_text, correct_percentage").eq("question_id", data.id).order("answer_index"),
      db.from("refs").select("id, ref_title, ref_link").eq("question_id", data.id).order("id"),
    ]);
    return { ...(q as any), answers: (a.data ?? []) as any, refs: (r.data ?? []) as any };
  });

export type QuestionInput = {
  id?: number;
  qbank_id: number;
  title?: string | null;
  question: string;
  explanation?: string | null;
  correct_answer?: number | null;
  subject_id?: number | null;
  system_id?: number | null;
  source?: string;
  media_name?: string | null;
  other_medias?: string | null;
  answers?: { answer_index: number; answer_text: string; correct_percentage?: number | null }[];
  refs?: { ref_title?: string | null; ref_link?: string | null }[];
};

async function writeQuestion(db: any, input: QuestionInput) {
  if (!input.question?.trim()) throw new Error("Question text is required");
  const id = input.id ?? (await nextId(db, "questions"));
  const row = {
    id,
    qbank_id: input.qbank_id,
    title: input.title ?? null,
    question: input.question,
    explanation: input.explanation ?? null,
    correct_answer: input.correct_answer ?? null,
    subject_id: input.subject_id ?? null,
    system_id: input.system_id ?? null,
    source: input.source?.trim() || "custom",
    media_name: input.media_name ?? null,
    other_medias: input.other_medias ?? null,
  };
  const { error } = await db.from("questions").upsert(row, { onConflict: "id" });
  if (error) throw internalError(error);

  if (input.answers) {
    const del = await db.from("answers").delete().eq("question_id", id);
    if (del.error) throw internalError(del.error);
    if (input.answers.length) {
      let base = await nextId(db, "answers");
      const rows = input.answers.map((a, i) => ({
        id: base + i,
        question_id: id,
        qbank_id: input.qbank_id,
        answer_index: a.answer_index,
        answer_text: a.answer_text,
        correct_percentage: a.correct_percentage ?? null,
      }));
      const ins = await db.from("answers").insert(rows);
      if (ins.error) throw internalError(ins.error);
    }
  }

  if (input.refs) {
    const del = await db.from("refs").delete().eq("question_id", id);
    if (del.error) throw internalError(del.error);
    const clean = input.refs.filter((r) => (r.ref_title ?? "").trim() || (r.ref_link ?? "").trim());
    if (clean.length) {
      let base = await nextId(db, "refs");
      const rows = clean.map((r, i) => ({
        id: base + i,
        question_id: id,
        qbank_id: input.qbank_id,
        ref_title: r.ref_title ?? null,
        ref_link: r.ref_link ?? null,
        ref_type: 0,
      }));
      const ins = await db.from("refs").insert(rows);
      if (ins.error) throw internalError(ins.error);
    }
  }
  return id;
}

export const saveFullQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: QuestionInput) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const id = await writeQuestion(db, data);
    return { ok: true, id };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    for (const t of ["attempts", "bookmarks", "answers", "refs"]) {
      const { error } = await (db as any).from(t).delete().eq("question_id", data.id);
      if (error) throw internalError(error);
    }
    const { error } = await db.from("questions").delete().eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* bulk import / export                                                */
/* ------------------------------------------------------------------ */

export const bulkImportQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; items: QuestionInput[]; dryRun?: boolean }) => d)
  .handler(async ({ context, data }): Promise<{ imported: number; errors: string[] }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const errors: string[] = [];
    if (!Array.isArray(data.items)) throw new Error("File must contain a list of questions");
    if (data.items.length > 2000) throw new Error("Please import at most 2000 questions at a time");

    let imported = 0;
    for (let i = 0; i < data.items.length; i++) {
      const item = { ...data.items[i], qbank_id: data.qbank_id } as QuestionInput;
      try {
        if (!item.question?.trim()) throw new Error("missing question text");
        if (data.dryRun) { imported++; continue; }
        await writeQuestion(db, item);
        imported++;
      } catch (e) {
        errors.push(`Row ${i + 1}: ${(e as Error).message}`);
        if (errors.length > 50) break;
      }
    }
    return { imported, errors };
  });

export const exportQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<QuestionInput[]> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const limit = Math.min(Math.max(data.limit ?? 500, 1), 2000);
    const offset = Math.max(data.offset ?? 0, 0);
    const { data: qs, error } = await db
      .from("questions")
      .select(
        "id, qbank_id, title, question, explanation, correct_answer, subject_id, system_id, source, media_name, other_medias",
      )
      .eq("qbank_id", data.qbank_id)
      .order("id")
      .range(offset, offset + limit - 1);
    if (error) throw internalError(error);
    const ids = (qs ?? []).map((q: any) => q.id as number);
    if (!ids.length) return [];
    const [a, r] = await Promise.all([
      db.from("answers").select("question_id, answer_index, answer_text, correct_percentage").in("question_id", ids),
      db.from("refs").select("question_id, ref_title, ref_link").in("question_id", ids),
    ]);
    const aMap = new Map<number, any[]>();
    for (const row of a.data ?? []) {
      const arr = aMap.get(row.question_id as number) ?? [];
      arr.push({ answer_index: row.answer_index, answer_text: row.answer_text, correct_percentage: row.correct_percentage });
      aMap.set(row.question_id as number, arr);
    }
    const rMap = new Map<number, any[]>();
    for (const row of r.data ?? []) {
      const arr = rMap.get(row.question_id as number) ?? [];
      arr.push({ ref_title: row.ref_title, ref_link: row.ref_link });
      rMap.set(row.question_id as number, arr);
    }
    return (qs ?? []).map((q: any) => ({
      ...q,
      answers: (aMap.get(q.id) ?? []).sort((x, y) => x.answer_index - y.answer_index),
      refs: rMap.get(q.id) ?? [],
    }));
  });

/* ------------------------------------------------------------------ */
/* medical library                                                     */
/* ------------------------------------------------------------------ */

export type LibraryDocRow = { id: number; qbank_id: number; title: string; path: string | null };

export const listLibraryDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; search?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: LibraryDocRow[]; total: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const limit = Math.min(Math.max(data.limit ?? 25, 1), 100);
    const offset = Math.max(data.offset ?? 0, 0);
    let q = db.from("library_docs").select("id, qbank_id, title, path", { count: "exact" }).eq("qbank_id", data.qbank_id);
    const s = (data.search ?? "").trim();
    if (s) q = q.ilike("title", `%${s.replace(/[%,]/g, " ")}%`);
    const { data: rows, count, error } = await q.order("title").range(offset, offset + limit - 1);
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as LibraryDocRow[], total: count ?? 0 };
  });

export const getLibraryDoc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    const { data: doc, error } = await db
      .from("library_docs")
      .select("id, qbank_id, title, path, html")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw internalError(error);
    return doc as { id: number; qbank_id: number; title: string; path: string | null; html: string } | null;
  });

export const saveLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: number; qbank_id: number; title: string; path?: string | null; html: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    if (!data.title.trim()) throw new Error("Title is required");
    const id = data.id ?? (await nextId(db, "library_docs"));
    const { error } = await db.from("library_docs").upsert(
      {
        id,
        qbank_id: data.qbank_id,
        title: data.title.trim(),
        path: data.path ?? null,
        html: data.html,
        plain: data.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200000),
      },
      { onConflict: "id" },
    );
    if (error) throw internalError(error);
    return { ok: true, id };
  });

export const deleteLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = await admin();
    await db.from("library_toc").delete().eq("doc_id", data.id);
    const { error } = await db.from("library_docs").delete().eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });
