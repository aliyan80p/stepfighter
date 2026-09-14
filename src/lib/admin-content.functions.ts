import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { internalError } from "./errors";

// ============================================================================
// Permission model
//
// A person reaches the admin area when they hold the `admin` role. What they
// can *do* inside it comes from `admin_access`:
//   - is_super      -> everything
//   - permissions[] -> individually granted areas (sub-admin)
// ============================================================================

export const ADMIN_PERMISSIONS = [
  "analytics",
  "users",
  "feedback",
  "questions",
  "library",
  "subjects",
  "topics",
  "courses",
  "media",
  "admins",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  analytics: "Overview & analytics",
  users: "Users & subscriptions",
  feedback: "Feedback inbox",
  questions: "Question bank editing",
  library: "Medical library editing",
  subjects: "Subjects & systems",
  topics: "Topics",
  courses: "Courses",
  media: "Media library",
  admins: "Manage admins & permissions",
};

const MEDIA_BUCKET = "qbank-media-plain";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Checks the permission and, when a course is involved, that the person is
 * allowed to work in that course. An empty `qbank_scope` means "all courses".
 */
async function assertPerm(
  supabase: any,
  userId: string,
  permission: AdminPermission,
  qbankId?: number,
) {
  const { data, error } = await supabase.rpc("has_admin_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (error) throw internalError(error);
  if (!data) throw new Error("Forbidden");

  if (typeof qbankId === "number") {
    const { data: row } = await supabase
      .from("admin_access")
      .select("is_super, qbank_scope")
      .eq("user_id", userId)
      .maybeSingle();
    const scope = ((row?.qbank_scope ?? []) as number[]).map(Number);
    if (!row?.is_super && scope.length && !scope.includes(Number(qbankId))) {
      throw new Error("You do not have access to this course");
    }
  }
}


export type MyAdminAccess = {
  admin: boolean;
  isSuper: boolean;
  permissions: AdminPermission[];
};

export const getMyAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAdminAccess> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { admin: false, isSuper: false, permissions: [] };
    const { data: row } = await supabase
      .from("admin_access")
      .select("is_super, permissions")
      .eq("user_id", userId)
      .maybeSingle();
    const isSuper = Boolean(row?.is_super);
    return {
      admin: true,
      isSuper,
      permissions: isSuper
        ? [...ADMIN_PERMISSIONS]
        : ((row?.permissions ?? []) as string[]).filter((p): p is AdminPermission =>
            (ADMIN_PERMISSIONS as readonly string[]).includes(p),
          ),
    };
  });

// ============================================================================
// Admin / sub-admin management
// ============================================================================

export type AdminAccessRow = {
  user_id: string;
  email: string | null;
  is_super: boolean;
  permissions: AdminPermission[];
};

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminAccessRow[] }> => {
    await assertPerm(context.supabase, context.userId, "admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (rolesErr) throw internalError(rolesErr);

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id as string)));
    if (!ids.length) return { rows: [] };

    const { data: access, error: accessErr } = await supabaseAdmin
      .from("admin_access")
      .select("user_id, is_super, permissions")
      .in("user_id", ids);
    if (accessErr) throw internalError(accessErr);

    const accessMap = new Map(
      (access ?? []).map((a) => [
        a.user_id as string,
        { is_super: Boolean(a.is_super), permissions: (a.permissions ?? []) as string[] },
      ]),
    );

    const rows: AdminAccessRow[] = [];
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      const a = accessMap.get(id);
      rows.push({
        user_id: id,
        email: u?.user?.email ?? null,
        is_super: a?.is_super ?? false,
        permissions: ((a?.permissions ?? []) as string[]).filter((p): p is AdminPermission =>
          (ADMIN_PERMISSIONS as readonly string[]).includes(p),
        ),
      });
    }
    rows.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
    return { rows };
  });

export const grantAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { email?: string; userId?: string; isSuper: boolean; permissions: string[] }) => d,
  )
  .handler(async ({ context, data }) => {
    await assertPerm(context.supabase, context.userId, "admins");

    // Only a super admin may create or change another super admin.
    const { data: iAmSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    if (data.isSuper && !iAmSuper) throw new Error("Only a super admin can grant full access");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let userId = data.userId ?? null;
    if (!userId) {
      const email = (data.email ?? "").trim().toLowerCase();
      if (!email) throw new Error("Email is required");
      // Auth admin listUsers has no email filter on every version; page through.
      let found: string | null = null;
      for (let page = 1; page <= 20 && !found; page++) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) throw internalError(error);
        const hit = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (hit) found = hit.id;
        if (!list?.users?.length || list.users.length < 200) break;
      }
      if (!found) throw new Error("No account found with that email");
      userId = found;
    }

    const permissions = data.permissions.filter((p) =>
      (ADMIN_PERMISSIONS as readonly string[]).includes(p),
    );

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw internalError(roleErr);

    const { error } = await supabaseAdmin
      .from("admin_access")
      .upsert(
        { user_id: userId, is_super: data.isSuper, permissions, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw internalError(error);
    return { ok: true, userId };
  });

export const revokeAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertPerm(context.supabase, context.userId, "admins");
    if (data.userId === context.userId) throw new Error("You cannot remove your own access");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("admin_access")
      .select("is_super")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (target?.is_super) {
      const { data: iAmSuper } = await context.supabase.rpc("is_super_admin", {
        _user_id: context.userId,
      });
      if (!iAmSuper) throw new Error("Only a super admin can remove a super admin");
    }

    await supabaseAdmin.from("admin_access").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw internalError(error);
    return { ok: true };
  });

// ============================================================================
// Question bank editing
// ============================================================================

export type QbankOption = { id: number; slug: string; name: string };

export const listQbanks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: QbankOption[] }> => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("qbanks")
      .select("id, slug, name")
      .order("id");
    if (error) throw internalError(error);
    return { rows: (data ?? []) as QbankOption[] };
  });

export type QuestionSearchRow = {
  id: number;
  qbank_id: number;
  title: string | null;
  question: string;
  source: string;
};

export const searchQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; search?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: QuestionSearchRow[] }> => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(Math.max(data.limit ?? 40, 1), 100);
    const offset = Math.max(data.offset ?? 0, 0);
    const term = (data.search ?? "").trim();

    let query = supabaseAdmin
      .from("questions")
      .select("id, qbank_id, title, question, source")
      .eq("qbank_id", data.qbank_id);

    if (/^\d+$/.test(term)) {
      query = query.eq("id", Number(term));
    } else if (term) {
      const escaped = term.replace(/[%_,()]/g, " ");
      query = query.or(`title.ilike.%${escaped}%,question.ilike.%${escaped}%`);
    }

    const { data: rows, error } = await query.order("id").range(offset, offset + limit - 1);
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as QuestionSearchRow[] };
  });

export type AdminAnswer = { id: number; answer_index: number; answer_text: string };

export type AdminQuestionFull = {
  id: number;
  qbank_id: number;
  title: string | null;
  question: string;
  explanation: string | null;
  correct_answer: number | null;
  media_name: string | null;
  other_medias: string | null;
  source: string;
  answers: AdminAnswer[];
};

export const getQuestionFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; id: number }) => d)
  .handler(async ({ context, data }): Promise<AdminQuestionFull | null> => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: q, error } = await supabaseAdmin
      .from("questions")
      .select("id, qbank_id, title, question, explanation, correct_answer, media_name, other_medias, source")
      .eq("qbank_id", data.qbank_id)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw internalError(error);
    if (!q) return null;

    const { data: answers, error: aErr } = await supabaseAdmin
      .from("answers")
      .select("id, answer_index, answer_text")
      .eq("qbank_id", data.qbank_id)
      .eq("question_id", data.id)
      .order("answer_index");
    if (aErr) throw internalError(aErr);

    return { ...(q as any), answers: (answers ?? []) as AdminAnswer[] };
  });

export const updateQuestionFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      qbank_id: number;
      id: number;
      title: string | null;
      question: string;
      explanation: string | null;
      correct_answer: number | null;
      media_name: string | null;
      other_medias: string | null;
      answers: { id?: number; answer_index: number; answer_text: string }[];
    }) => d,
  )
  .handler(async ({ context, data }) => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("questions")
      .update({
        title: data.title,
        question: data.question,
        explanation: data.explanation,
        correct_answer: data.correct_answer,
        media_name: data.media_name,
        other_medias: data.other_medias,
      })
      .eq("qbank_id", data.qbank_id)
      .eq("id", data.id);
    if (error) throw internalError(error);

    // Answer choices: replace the whole set so reordering and removals work.
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("answers")
      .select("id")
      .eq("qbank_id", data.qbank_id)
      .eq("question_id", data.id);
    if (exErr) throw internalError(exErr);

    const keepIds = data.answers.map((a) => a.id).filter((v): v is number => typeof v === "number");
    const toDelete = (existing ?? [])
      .map((r) => r.id as number)
      .filter((id) => !keepIds.includes(id));
    if (toDelete.length) {
      const { error: delErr } = await supabaseAdmin
        .from("answers")
        .delete()
        .eq("qbank_id", data.qbank_id)
        .eq("question_id", data.id)
        .in("id", toDelete);
      if (delErr) throw internalError(delErr);
    }

    let nextId: number | null = null;
    const newOnes = data.answers.filter((a) => typeof a.id !== "number");
    if (newOnes.length) {
      const { data: maxRow } = await supabaseAdmin
        .from("answers")
        .select("id")
        .eq("qbank_id", data.qbank_id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      nextId = ((maxRow?.id as number) ?? 0) + 1;
    }

    const payload = data.answers.map((a) => ({
      id: typeof a.id === "number" ? a.id : (nextId = (nextId ?? 1) + 1) - 1,
      question_id: data.id,
      qbank_id: data.qbank_id,
      answer_index: a.answer_index,
      answer_text: a.answer_text,
    }));

    if (payload.length) {
      const { error: upErr } = await supabaseAdmin
        .from("answers")
        .upsert(payload, { onConflict: "qbank_id,id" });
      if (upErr) throw internalError(upErr);
    }


    return { ok: true };
  });

// ============================================================================
// Media (question images)
// ============================================================================

export const uploadQuestionMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; filename: string; contentBase64: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; name: string }> => {
    await assertPerm(context.supabase, context.userId, "questions");

    const safeName = data.filename.replace(/[^\w.\-]/g, "_");
    if (!/\.[a-z0-9]{2,5}$/i.test(safeName)) throw new Error("File needs a normal image extension");

    const binary = Buffer.from(data.contentBase64, "base64");
    if (!binary.length) throw new Error("Empty file");
    if (binary.length > MAX_UPLOAD_BYTES) throw new Error("File is larger than 15 MB");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = safeName.split(".").pop()?.toLowerCase() ?? "";
    const contentType =
      ext === "png" ? "image/png"
      : ext === "gif" ? "image/gif"
      : ext === "webp" ? "image/webp"
      : ext === "svg" ? "image/svg+xml"
      : ext === "mp4" ? "video/mp4"
      : "image/jpeg";

    const { error } = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .upload(safeName, binary, { contentType, upsert: true });
    if (error) throw internalError(error);

    await supabaseAdmin.from("qbank_media").upsert(
      {
        qbank_id: data.qbank_id,
        name: safeName,
        drive_file_id: "",
        size_bytes: binary.length,
      },
      { onConflict: "qbank_id,name" },
    );

    return { ok: true, name: safeName };
  });

// ============================================================================
// Medical library editing
// ============================================================================

export type LibraryDocRow = { id: number; qbank_id: number; title: string; path: string | null };

export const listLibraryDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; search?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: LibraryDocRow[] }> => {
    await assertPerm(context.supabase, context.userId, "library");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
    const offset = Math.max(data.offset ?? 0, 0);
    const term = (data.search ?? "").trim().replace(/[%_,()]/g, " ");

    let query = supabaseAdmin
      .from("library_docs")
      .select("id, qbank_id, title, path")
      .eq("qbank_id", data.qbank_id);
    if (term) query = query.ilike("title", `%${term}%`);

    const { data: rows, error } = await query.order("title").range(offset, offset + limit - 1);
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as LibraryDocRow[] };
  });

export type LibraryDocFull = LibraryDocRow & { html: string };

export const getLibraryDoc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }): Promise<LibraryDocFull | null> => {
    await assertPerm(context.supabase, context.userId, "library");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("library_docs")
      .select("id, qbank_id, title, path, html")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw internalError(error);
    return (doc as LibraryDocFull) ?? null;
  });

function htmlToPlain(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const updateLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; title: string; html: string }) => d)
  .handler(async ({ context, data }) => {
    await assertPerm(context.supabase, context.userId, "library");
    if (!data.title.trim()) throw new Error("Title is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("library_docs")
      .update({ title: data.title, html: data.html, plain: htmlToPlain(data.html) })
      .eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });

export const createLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; title: string; html: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; id: number }> => {
    await assertPerm(context.supabase, context.userId, "library");
    if (!data.title.trim()) throw new Error("Title is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: maxRow } = await supabaseAdmin
      .from("library_docs")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = ((maxRow?.id as number) ?? 0) + 1;

    const { error } = await supabaseAdmin.from("library_docs").insert({
      id,
      qbank_id: data.qbank_id,
      title: data.title,
      html: data.html,
      plain: htmlToPlain(data.html),
      path: null,
    });
    if (error) throw internalError(error);
    return { ok: true, id };
  });

export const deleteLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }) => {
    await assertPerm(context.supabase, context.userId, "library");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("library_toc").update({ doc_id: null }).eq("doc_id", data.id);
    const { error } = await supabaseAdmin.from("library_docs").delete().eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });

// ============================================================================
// Bulk export / import / compare
// ============================================================================

export type ExportedQuestion = {
  id: number;
  qbank_id: number;
  title: string | null;
  question: string;
  explanation: string | null;
  correct_answer: number | null;
  media_name: string | null;
  other_medias: string | null;
  source: string;
  subject_id: number | null;
  system_id: number | null;
  answers: { answer_index: number; answer_text: string }[];
};

const EXPORT_PAGE = 200;

/** One page of a full question export (questions + their answer choices). */
export const exportQuestionsPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: ExportedQuestion[]; done: boolean; nextOffset: number }> => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const offset = Math.max(data.offset ?? 0, 0);

    const { data: qs, error } = await supabaseAdmin
      .from("questions")
      .select("id, qbank_id, title, question, explanation, correct_answer, media_name, other_medias, source, subject_id, system_id")
      .eq("qbank_id", data.qbank_id)
      .order("id")
      .range(offset, offset + EXPORT_PAGE - 1);
    if (error) throw internalError(error);

    const ids = (qs ?? []).map((q) => q.id as number);
    let answers: any[] = [];
    if (ids.length) {
      const { data: ans, error: aErr } = await supabaseAdmin
        .from("answers")
        .select("question_id, answer_index, answer_text")
        .eq("qbank_id", data.qbank_id)
        .in("question_id", ids)
        .order("answer_index");
      if (aErr) throw internalError(aErr);
      answers = ans ?? [];
    }

    const byQuestion = new Map<number, { answer_index: number; answer_text: string }[]>();
    for (const a of answers) {
      const list = byQuestion.get(a.question_id) ?? [];
      list.push({ answer_index: a.answer_index, answer_text: a.answer_text });
      byQuestion.set(a.question_id, list);
    }

    const rows = (qs ?? []).map((q) => ({ ...(q as any), answers: byQuestion.get(q.id as number) ?? [] }));
    return {
      rows: rows as ExportedQuestion[],
      done: rows.length < EXPORT_PAGE,
      nextOffset: offset + rows.length,
    };
  });

/** Every question number currently stored for a course — used to spot gaps. */
export const listQuestionIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number }) => d)
  .handler(async ({ context, data }): Promise<{ ids: number[] }> => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids: number[] = [];
    let from = 0;
    const step = 1000;
    for (;;) {
      const { data: rows, error } = await supabaseAdmin
        .from("questions")
        .select("id")
        .eq("qbank_id", data.qbank_id)
        .order("id")
        .range(from, from + step - 1);
      if (error) throw internalError(error);
      const batch = (rows ?? []).map((r) => r.id as number);
      ids.push(...batch);
      if (batch.length < step) break;
      from += step;
    }
    return { ids };
  });

export type ImportItem = {
  id: number;
  title?: string | null;
  question: string;
  explanation?: string | null;
  correct_answer?: number | null;
  media_name?: string | null;
  other_medias?: string | null;
  source?: string | null;
  subject_id?: number | null;
  system_id?: number | null;
  answers?: { answer_index: number; answer_text: string }[];
};

const MAX_IMPORT_CHUNK = 200;

/**
 * Bulk add/update questions for one course.
 *  - mode "missing": only question numbers that do not exist yet are written
 *  - mode "all":     existing ones are overwritten too
 */
export const importQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; mode: "missing" | "all"; items: ImportItem[] }) => d)
  .handler(async ({ context, data }): Promise<{ added: number; updated: number; skipped: number }> => {
    await assertPerm(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!Array.isArray(data.items) || !data.items.length) return { added: 0, updated: 0, skipped: 0 };
    if (data.items.length > MAX_IMPORT_CHUNK) throw new Error("Too many questions in one batch");

    const ids = data.items.map((i) => Number(i.id)).filter((n) => Number.isFinite(n));
    if (ids.length !== data.items.length) throw new Error("Every question needs a numeric question number");

    const { data: existingRows, error: exErr } = await supabaseAdmin
      .from("questions")
      .select("id")
      .eq("qbank_id", data.qbank_id)
      .in("id", ids);
    if (exErr) throw internalError(exErr);
    const existing = new Set((existingRows ?? []).map((r) => r.id as number));

    const toWrite = data.items.filter((i) => data.mode === "all" || !existing.has(Number(i.id)));
    const skipped = data.items.length - toWrite.length;
    if (!toWrite.length) return { added: 0, updated: 0, skipped };

    const payload = toWrite.map((i) => ({
      id: Number(i.id),
      qbank_id: data.qbank_id,
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

    const { error: upErr } = await supabaseAdmin
      .from("questions")
      .upsert(payload, { onConflict: "qbank_id,id" });
    if (upErr) throw internalError(upErr);

    // Answer choices: replace the set for every question we just wrote.
    const withAnswers = toWrite.filter((i) => (i.answers ?? []).length);
    if (withAnswers.length) {
      const writeIds = withAnswers.map((i) => Number(i.id));
      const { error: delErr } = await supabaseAdmin
        .from("answers")
        .delete()
        .eq("qbank_id", data.qbank_id)
        .in("question_id", writeIds);
      if (delErr) throw internalError(delErr);

      const { data: maxRow } = await supabaseAdmin
        .from("answers")
        .select("id")
        .eq("qbank_id", data.qbank_id)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextId = ((maxRow?.id as number) ?? 0) + 1;

      const answerRows = withAnswers.flatMap((i) =>
        (i.answers ?? []).map((a, idx) => ({
          id: nextId++,
          qbank_id: data.qbank_id,
          question_id: Number(i.id),
          answer_index: typeof a.answer_index === "number" ? a.answer_index : idx,
          answer_text: String(a.answer_text ?? ""),
        })),
      );
      const { error: aErr } = await supabaseAdmin
        .from("answers")
        .upsert(answerRows, { onConflict: "qbank_id,id" });
      if (aErr) throw internalError(aErr);
    }

    const added = toWrite.filter((i) => !existing.has(Number(i.id))).length;
    return { added, updated: toWrite.length - added, skipped };
  });
