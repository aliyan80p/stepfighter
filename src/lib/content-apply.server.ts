/**
 * Applying a content change to the real tables.
 *
 * Every admin content edit is described as a small payload. On the live site
 * the payload is applied straight away; on the test site it is parked in
 * `content_drafts` and applied by this same code when someone presses
 * "Publish to live".
 */
import { internalError } from "./errors";

const MEDIA_BUCKET = "qbank-media-plain";

export function htmlToPlain(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type DraftEntity =
  | "question"
  | "question_import"
  | "library_upsert"
  | "library_delete"
  | "taxonomy_save"
  | "taxonomy_delete"
  | "topic_rename"
  | "course_save"
  | "media_delete";

function taxTable(kind: string): "subjects" | "systems" {
  if (kind !== "subjects" && kind !== "systems") throw new Error("Unknown list");
  return kind;
}

async function applyQuestion(admin: any, p: any) {
  const { error } = await admin
    .from("questions")
    .update({
      title: p.title,
      question: p.question,
      explanation: p.explanation,
      correct_answer: p.correct_answer,
      media_name: p.media_name,
      other_medias: p.other_medias,
    })
    .eq("qbank_id", p.qbank_id)
    .eq("id", p.id);
  if (error) throw internalError(error);

  const { data: existing, error: exErr } = await admin
    .from("answers")
    .select("id")
    .eq("qbank_id", p.qbank_id)
    .eq("question_id", p.id);
  if (exErr) throw internalError(exErr);

  const keepIds = (p.answers ?? [])
    .map((a: any) => a.id)
    .filter((v: any): v is number => typeof v === "number");
  const toDelete = (existing ?? [])
    .map((r: any) => r.id as number)
    .filter((id: number) => !keepIds.includes(id));
  if (toDelete.length) {
    const { error: delErr } = await admin
      .from("answers")
      .delete()
      .eq("qbank_id", p.qbank_id)
      .eq("question_id", p.id)
      .in("id", toDelete);
    if (delErr) throw internalError(delErr);
  }

  let nextId: number | null = null;
  if ((p.answers ?? []).some((a: any) => typeof a.id !== "number")) {
    const { data: maxRow } = await admin
      .from("answers")
      .select("id")
      .eq("qbank_id", p.qbank_id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    nextId = ((maxRow?.id as number) ?? 0) + 1;
  }

  const rows = (p.answers ?? []).map((a: any) => ({
    id: typeof a.id === "number" ? a.id : (nextId = (nextId ?? 1) + 1) - 1,
    question_id: p.id,
    qbank_id: p.qbank_id,
    answer_index: a.answer_index,
    answer_text: a.answer_text,
  }));
  if (rows.length) {
    const { error: upErr } = await admin.from("answers").upsert(rows, { onConflict: "qbank_id,id" });
    if (upErr) throw internalError(upErr);
  }
}

async function applyImport(admin: any, p: any): Promise<{ added: number; updated: number; skipped: number }> {
  const items: any[] = p.items ?? [];
  if (!items.length) return { added: 0, updated: 0, skipped: 0 };

  const ids = items.map((i) => Number(i.id));
  const { data: existingRows, error: exErr } = await admin
    .from("questions")
    .select("id")
    .eq("qbank_id", p.qbank_id)
    .in("id", ids);
  if (exErr) throw internalError(exErr);
  const existing = new Set((existingRows ?? []).map((r: any) => r.id as number));

  const toWrite = items.filter((i) => p.mode === "all" || !existing.has(Number(i.id)));
  const skipped = items.length - toWrite.length;
  if (!toWrite.length) return { added: 0, updated: 0, skipped };

  const rows = toWrite.map((i) => ({
    id: Number(i.id),
    qbank_id: p.qbank_id,
    title: i.title ?? null,
    question: String(i.question ?? ""),
    explanation: i.explanation ?? null,
    correct_answer: i.correct_answer ?? null,
    media_name: i.media_name ?? null,
    other_medias: i.other_medias ?? null,
    source: i.source ?? "main",
    subject_id: i.subject_id ?? null,
    system_id: i.system_id ?? null,
  }));
  const { error: upErr } = await admin.from("questions").upsert(rows, { onConflict: "qbank_id,id" });
  if (upErr) throw internalError(upErr);

  const withAnswers = toWrite.filter((i) => (i.answers ?? []).length);
  if (withAnswers.length) {
    const writeIds = withAnswers.map((i) => Number(i.id));
    const { error: delErr } = await admin
      .from("answers")
      .delete()
      .eq("qbank_id", p.qbank_id)
      .in("question_id", writeIds);
    if (delErr) throw internalError(delErr);

    const { data: maxRow } = await admin
      .from("answers")
      .select("id")
      .eq("qbank_id", p.qbank_id)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    let nextId = ((maxRow?.id as number) ?? 0) + 1;

    const answerRows = withAnswers.flatMap((i) =>
      (i.answers ?? []).map((a: any, idx: number) => ({
        id: nextId++,
        qbank_id: p.qbank_id,
        question_id: Number(i.id),
        answer_index: typeof a.answer_index === "number" ? a.answer_index : idx,
        answer_text: String(a.answer_text ?? ""),
      })),
    );
    const { error: aErr } = await admin.from("answers").upsert(answerRows, { onConflict: "qbank_id,id" });
    if (aErr) throw internalError(aErr);
  }

  const added = toWrite.filter((i) => !existing.has(Number(i.id))).length;
  return { added, updated: toWrite.length - added, skipped };
}

async function applyLibraryUpsert(admin: any, p: any): Promise<number> {
  if (typeof p.id === "number") {
    const { error } = await admin
      .from("library_docs")
      .update({ title: p.title, html: p.html, plain: htmlToPlain(p.html) })
      .eq("id", p.id);
    if (error) throw internalError(error);
    return p.id;
  }
  const { data: maxRow } = await admin
    .from("library_docs")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = ((maxRow?.id as number) ?? 0) + 1;
  const { error } = await admin.from("library_docs").insert({
    id,
    qbank_id: p.qbank_id,
    title: p.title,
    html: p.html,
    plain: htmlToPlain(p.html),
    path: null,
  });
  if (error) throw internalError(error);
  return id;
}

async function applyTaxonomySave(admin: any, p: any): Promise<number> {
  const table = taxTable(p.kind);
  if (typeof p.id === "number") {
    const { error } = await admin
      .from(table)
      .update({ name: p.name })
      .eq("qbank_id", p.qbank_id)
      .eq("id", p.id);
    if (error) throw internalError(error);
    return p.id;
  }
  const { data: maxRow } = await admin
    .from(table)
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = ((maxRow?.id as number) ?? 0) + 1;
  const { error } = await admin.from(table).insert({ id, name: p.name, qbank_id: p.qbank_id, count: 0 });
  if (error) throw internalError(error);
  return id;
}

async function applyCourseSave(admin: any, p: any): Promise<number> {
  if (typeof p.id === "number") {
    const { error } = await admin
      .from("qbanks")
      .update({ slug: p.slug, name: p.name, description: p.description })
      .eq("id", p.id);
    if (error) throw internalError(error);
    return p.id;
  }
  const { data: maxRow } = await admin
    .from("qbanks")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = ((maxRow?.id as number) ?? 0) + 1;
  const { error } = await admin
    .from("qbanks")
    .insert({ id, slug: p.slug, name: p.name, description: p.description });
  if (error) throw internalError(error);
  return id;
}

/** Writes one change into the real tables. Returns anything the caller needs back. */
export async function applyChange(admin: any, entity: DraftEntity, payload: any): Promise<any> {
  switch (entity) {
    case "question":
      await applyQuestion(admin, payload);
      return { ok: true };
    case "question_import":
      return applyImport(admin, payload);
    case "library_upsert":
      return { ok: true, id: await applyLibraryUpsert(admin, payload) };
    case "library_delete": {
      await admin.from("library_toc").update({ doc_id: null }).eq("doc_id", payload.id);
      const { error } = await admin.from("library_docs").delete().eq("id", payload.id);
      if (error) throw internalError(error);
      return { ok: true };
    }
    case "taxonomy_save":
      return { ok: true, id: await applyTaxonomySave(admin, payload) };
    case "taxonomy_delete": {
      const table = taxTable(payload.kind);
      const { error } = await admin
        .from(table)
        .delete()
        .eq("qbank_id", payload.qbank_id)
        .eq("id", payload.id);
      if (error) throw internalError(error);
      return { ok: true };
    }
    case "topic_rename": {
      const { error } = await admin
        .from("questions")
        .update({ title: payload.to })
        .eq("qbank_id", payload.qbank_id)
        .eq("title", payload.from);
      if (error) throw internalError(error);
      return { ok: true };
    }
    case "course_save":
      return { ok: true, id: await applyCourseSave(admin, payload) };
    case "media_delete": {
      await admin.storage.from(MEDIA_BUCKET).remove([payload.name]);
      const { error } = await admin
        .from("qbank_media")
        .delete()
        .eq("qbank_id", payload.qbank_id)
        .eq("name", payload.name);
      if (error) throw internalError(error);
      return { ok: true };
    }
    default:
      throw new Error("Unknown change type");
  }
}
