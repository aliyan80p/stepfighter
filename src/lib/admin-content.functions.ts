import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { internalError } from "./errors";
import { recordChange } from "./content-changes.server";

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
  "publish",
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
  publish: "Publish to live site",
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

/**
 * On the live site an edit is written straight away. On the test site it is
 * parked as a draft and only written when someone presses "Publish to live".
 */
async function draftOrApply(
  admin: any,
  userId: string,
  spec: {
    entity: import("./content-apply.server").DraftEntity;
    qbank_id?: number | null;
    ref_id?: number | null;
    ref_key?: string | null;
    label: string;
    payload: any;
  },
): Promise<{ draft: boolean; result: any }> {
  const { isDraftSite, saveDraft } = await import("./content-drafts.server");
  if (isDraftSite()) {
    await saveDraft(admin, { ...spec, created_by: userId });
    return { draft: true, result: null };
  }
  const { applyChange } = await import("./content-apply.server");
  const result = await applyChange(admin, spec.entity, spec.payload);
  return { draft: false, result };
}


export type MyAdminAccess = {
  admin: boolean;
  isSuper: boolean;
  permissions: AdminPermission[];
  qbankScope: number[];
};

export const getMyAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAdminAccess> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { admin: false, isSuper: false, permissions: [], qbankScope: [] };
    const { data: row } = await supabase
      .from("admin_access")
      .select("is_super, permissions, qbank_scope")
      .eq("user_id", userId)
      .maybeSingle();
    const isSuper = Boolean(row?.is_super);
    return {
      admin: true,
      isSuper,
      qbankScope: isSuper ? [] : ((row?.qbank_scope ?? []) as number[]).map(Number),
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
  qbank_scope: number[];
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
      .select("user_id, is_super, permissions, qbank_scope")
      .in("user_id", ids);
    if (accessErr) throw internalError(accessErr);

    const accessMap = new Map(
      (access ?? []).map((a) => [
        a.user_id as string,
        {
          is_super: Boolean(a.is_super),
          permissions: (a.permissions ?? []) as string[],
          qbank_scope: ((a.qbank_scope ?? []) as number[]).map(Number),
        },
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
        qbank_scope: a?.qbank_scope ?? [],
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
    (d: {
      email?: string;
      userId?: string;
      isSuper: boolean;
      permissions: string[];
      qbankScope?: number[];
    }) => d,

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
    const qbankScope = Array.from(
      new Set((data.qbankScope ?? []).map(Number).filter((n) => Number.isFinite(n))),
    );

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleErr) throw internalError(roleErr);

    const { error } = await supabaseAdmin
      .from("admin_access")
      .upsert(
        {
          user_id: userId,
          is_super: data.isSuper,
          permissions,
          qbank_scope: data.isSuper ? [] : qbankScope,
          updated_at: new Date().toISOString(),
        },
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
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: me } = await context.supabase
      .from("admin_access")
      .select("is_super, qbank_scope")
      .eq("user_id", context.userId)
      .maybeSingle();
    const scope = ((me?.qbank_scope ?? []) as number[]).map(Number);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("qbanks")
      .select("id, slug, name")
      .order("id");
    if (error) throw internalError(error);
    const rows = (data ?? []) as QbankOption[];
    if (!me?.is_super && scope.length) {
      return { rows: rows.filter((r) => scope.includes(Number(r.id))) };
    }
    return { rows };
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
    await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);
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
    await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);
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
  .handler(async ({ context, data }): Promise<{ ok: true; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isDraftSite, saveDraft } = await import("./content-drafts.server");

    if (isDraftSite()) {
      await saveDraft(supabaseAdmin, {
        entity: "question",
        qbank_id: data.qbank_id,
        ref_id: data.id,
        label: `Question ${data.id}`,
        payload: data,
        created_by: context.userId,
      });
      return { ok: true, draft: true };
    }

    const { applyChange } = await import("./content-apply.server");
    await applyChange(supabaseAdmin, "question", data);

    await recordChange(supabaseAdmin, {
      entity: "question",
      qbank_id: data.qbank_id,
      ref_id: data.id,
      label: `Question ${data.id}`,
      changed_by: context.userId,
    });

    return { ok: true, draft: false };
  });

// ============================================================================
// Media (question images)
// ============================================================================

export const uploadQuestionMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; filename: string; contentBase64: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; name: string }> => {
    await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);

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

    await recordChange(supabaseAdmin, {
      entity: "media",
      qbank_id: data.qbank_id,
      ref_key: safeName,
      label: safeName,
      changed_by: context.userId,
    });

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
    await assertPerm(context.supabase, context.userId, "library", data.qbank_id);
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

export const updateLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; title: string; html: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "library");
    if (!data.title.trim()) throw new Error("Title is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draft } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "library_upsert",
      ref_id: data.id,
      label: data.title,
      payload: data,
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: "library",
        ref_id: data.id,
        label: data.title,
        changed_by: context.userId,
      });
    }
    return { ok: true, draft };
  });

export const createLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; title: string; html: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; id: number | null; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "library", data.qbank_id);
    if (!data.title.trim()) throw new Error("Title is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draft, result } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "library_upsert",
      qbank_id: data.qbank_id,
      label: data.title,
      payload: data,
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: "library",
        qbank_id: data.qbank_id,
        ref_id: result?.id ?? null,
        label: data.title,
        changed_by: context.userId,
      });
    }
    return { ok: true, id: result?.id ?? null, draft };
  });

export const deleteLibraryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "library");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draft } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "library_delete",
      ref_id: data.id,
      label: `Delete article ${data.id}`,
      payload: data,
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: "library",
        ref_id: data.id,
        action: "delete",
        label: `Article ${data.id}`,
        changed_by: context.userId,
      });
    }
    return { ok: true, draft };
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
    await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);
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
    await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);
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
  .handler(
    async ({
      context,
      data,
    }): Promise<{ added: number; updated: number; skipped: number; draft: boolean; queued: number }> => {
      await assertPerm(context.supabase, context.userId, "questions", data.qbank_id);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      if (!Array.isArray(data.items) || !data.items.length)
        return { added: 0, updated: 0, skipped: 0, draft: false, queued: 0 };
      if (data.items.length > MAX_IMPORT_CHUNK) throw new Error("Too many questions in one batch");

      const ids = data.items.map((i) => Number(i.id)).filter((n) => Number.isFinite(n));
      if (ids.length !== data.items.length)
        throw new Error("Every question needs a numeric question number");

      const { draft, result } = await draftOrApply(supabaseAdmin, context.userId, {
        entity: "question_import",
        qbank_id: data.qbank_id,
        label: `${data.items.length} imported questions`,
        payload: data,
      });

      if (draft) {
        return { added: 0, updated: 0, skipped: 0, draft: true, queued: data.items.length };
      }

      const { recordChanges } = await import("./content-changes.server");
      await recordChanges(
        supabaseAdmin,
        data.items.map((i) => ({
          entity: "question" as const,
          qbank_id: data.qbank_id,
          ref_id: Number(i.id),
          label: `Question ${i.id}`,
          changed_by: context.userId,
        })),
      );

      return { ...result, draft: false, queued: 0 };
    },
  );

// ============================================================================
// Subjects & systems
// ============================================================================

export type TaxonomyRow = { id: number; name: string; count: number | null };
type TaxonomyKind = "subjects" | "systems";

function taxTable(kind: string): TaxonomyKind {
  if (kind !== "subjects" && kind !== "systems") throw new Error("Unknown list");
  return kind;
}

export const listTaxonomy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; kind: string }) => d)
  .handler(async ({ context, data }): Promise<{ rows: TaxonomyRow[] }> => {
    await assertPerm(context.supabase, context.userId, "subjects", data.qbank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from(taxTable(data.kind))
      .select("id, name, count")
      .eq("qbank_id", data.qbank_id)
      .order("name");
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as TaxonomyRow[] };
  });

export const saveTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; kind: string; id?: number; name: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; id: number | null; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "subjects", data.qbank_id);
    const name = data.name.trim();
    if (!name) throw new Error("Name is required");
    const table = taxTable(data.kind);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { draft, result } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "taxonomy_save",
      qbank_id: data.qbank_id,
      ref_id: data.id ?? null,
      label: `${table === "subjects" ? "Subject" : "System"}: ${name}`,
      payload: { ...data, name },
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: table === "subjects" ? "subject" : "system",
        qbank_id: data.qbank_id,
        ref_id: result?.id ?? data.id ?? null,
        label: name,
        changed_by: context.userId,
      });
    }
    return { ok: true, id: result?.id ?? data.id ?? null, draft };
  });

export const deleteTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; kind: string; id: number }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; inUse: number; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "subjects", data.qbank_id);
    const table = taxTable(data.kind);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const column = table === "subjects" ? "subject_id" : "system_id";
    const { count } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("qbank_id", data.qbank_id)
      .eq(column, data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`${count} questions still use this — move them first`);
    }

    const { draft } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "taxonomy_delete",
      qbank_id: data.qbank_id,
      ref_id: data.id,
      label: `Delete ${data.kind} ${data.id}`,
      payload: data,
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: table === "subjects" ? "subject" : "system",
        qbank_id: data.qbank_id,
        ref_id: data.id,
        action: "delete",
        label: `${data.kind} ${data.id}`,
        changed_by: context.userId,
      });
    }
    return { ok: true, inUse: 0, draft };
  });

// ============================================================================
// Topics (the title on each question)
// ============================================================================

export type TopicRow = { name: string; count: number };

export const listTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; search?: string }) => d)
  .handler(async ({ context, data }): Promise<{ rows: TopicRow[] }> => {
    await assertPerm(context.supabase, context.userId, "topics", data.qbank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const term = (data.search ?? "").trim().replace(/[%_,()]/g, " ");
    const counts = new Map<string, number>();
    for (let from = 0; from < 40000; from += 1000) {
      let q = supabaseAdmin
        .from("questions")
        .select("title")
        .eq("qbank_id", data.qbank_id)
        .range(from, from + 999);
      if (term) q = q.ilike("title", `%${term}%`);
      const { data: page, error } = await q;
      if (error) throw internalError(error);
      for (const r of page ?? []) {
        const t = (r.title as string | null)?.trim();
        if (!t) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      if (!page || page.length < 1000) break;
    }

    const rows = Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return { rows };
  });

export const renameTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; from: string; to: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "topics", data.qbank_id);
    const to = data.to.trim();
    if (!to) throw new Error("New name is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draft } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "topic_rename",
      qbank_id: data.qbank_id,
      ref_key: `${data.from}\u0000${to}`,
      label: `${data.from} \u2192 ${to}`,
      payload: { ...data, to },
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: "topic",
        qbank_id: data.qbank_id,
        ref_key: `${data.from}\u0000${to}`,
        label: `${data.from} \u2192 ${to}`,
        changed_by: context.userId,
      });
    }
    return { ok: true, draft };
  });

// ============================================================================
// Courses
// ============================================================================

export type CourseRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  questions: number;
};

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: CourseRow[] }> => {
    await assertPerm(context.supabase, context.userId, "courses");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("qbanks")
      .select("id, slug, name, description")
      .order("id");
    if (error) throw internalError(error);

    const rows: CourseRow[] = [];
    for (const c of data ?? []) {
      const { count } = await supabaseAdmin
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("qbank_id", c.id as number);
      rows.push({ ...(c as any), questions: count ?? 0 });
    }
    return { rows };
  });

export const saveCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: number; slug: string; name: string; description: string | null }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; id: number | null; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "courses");
    const name = data.name.trim();
    const slug = data.slug.trim().toLowerCase();
    if (!name) throw new Error("Name is required");
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) {
      throw new Error("Short code must be lowercase letters, numbers or dashes");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { draft, result } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "course_save",
      ref_id: data.id ?? null,
      label: `Course: ${name}`,
      payload: { ...data, name, slug },
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: "course",
        ref_id: result?.id ?? data.id ?? null,
        label: name,
        changed_by: context.userId,
      });
    }
    return { ok: true, id: result?.id ?? data.id ?? null, draft };
  });

// ============================================================================
// Media library
// ============================================================================

export type MediaRow = { name: string; size_bytes: number | null };

export const listMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; search?: string; limit?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: MediaRow[]; total: number }> => {
    await assertPerm(context.supabase, context.userId, "media", data.qbank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(Math.max(data.limit ?? 60, 1), 200);
    const term = (data.search ?? "").trim().replace(/[%_,()]/g, " ");

    let query = supabaseAdmin
      .from("qbank_media")
      .select("name, size_bytes", { count: "exact" })
      .eq("qbank_id", data.qbank_id);
    if (term) query = query.ilike("name", `%${term}%`);

    const { data: rows, error, count } = await query.order("name").range(0, limit - 1);
    if (error) throw internalError(error);
    return { rows: (rows ?? []) as MediaRow[], total: count ?? 0 };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; name: string }) => d)
  .handler(async ({ context, data }): Promise<{ ok: true; usedBy: number; draft: boolean }> => {
    await assertPerm(context.supabase, context.userId, "media", data.qbank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("qbank_id", data.qbank_id)
      .eq("media_name", data.name);
    if ((count ?? 0) > 0) throw new Error(`${count} questions still use this image`);

    const { draft } = await draftOrApply(supabaseAdmin, context.userId, {
      entity: "media_delete",
      qbank_id: data.qbank_id,
      ref_key: data.name,
      label: `Delete image ${data.name}`,
      payload: data,
    });
    if (!draft) {
      await recordChange(supabaseAdmin, {
        entity: "media",
        qbank_id: data.qbank_id,
        ref_key: data.name,
        action: "delete",
        label: data.name,
        changed_by: context.userId,
      });
    }
    return { ok: true, usedBy: 0, draft };
  });

export type MissingMediaRow = { question_id: number; name: string };

export const findMissingMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: MissingMediaRow[] }> => {
    await assertPerm(context.supabase, context.userId, "media", data.qbank_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const known = new Set<string>();
    for (let from = 0; from < 60000; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("qbank_media")
        .select("name")
        .eq("qbank_id", data.qbank_id)
        .range(from, from + 999);
      if (error) throw internalError(error);
      for (const r of page ?? []) known.add((r.name as string).toLowerCase());
      if (!page || page.length < 1000) break;
    }

    const rows: MissingMediaRow[] = [];
    for (let from = 0; from < 40000 && rows.length < 500; from += 1000) {
      const { data: page, error } = await supabaseAdmin
        .from("questions")
        .select("id, media_name")
        .eq("qbank_id", data.qbank_id)
        .not("media_name", "is", null)
        .range(from, from + 999);
      if (error) throw internalError(error);
      for (const r of page ?? []) {
        const name = (r.media_name as string | null)?.trim();
        if (name && !known.has(name.toLowerCase())) {
          rows.push({ question_id: r.id as number, name });
        }
      }
      if (!page || page.length < 1000) break;
    }
    return { rows };
  });
