import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeQbankAccess } from "@/lib/entitlements.functions";
import { internalError } from "./errors";
import {
  ALL_ADMIN_PERMISSIONS,
  type AdminAccess,
  type AdminPermission,
} from "@/lib/admin-permissions";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw internalError(error);
  if (!data) throw new Error("Forbidden");
}

/**
 * Server-only: throws unless the caller is an admin AND either a main admin
 * (super) or has been granted the given permission.
 */
export async function assertPermission(
  supabase: any,
  userId: string,
  permission: AdminPermission,
) {
  await assertAdmin(supabase, userId);
  const { data, error } = await supabase.rpc("has_admin_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (error) throw internalError(error);
  if (!data) throw new Error("Forbidden");
}

async function assertSuper(supabase: any, userId: string) {
  await assertAdmin(supabase, userId);
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) throw internalError(error);
  if (!data) throw new Error("Forbidden");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { admin: Boolean(data) };
  });

export const getMyAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccess> => {
    const { data: roleData } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!roleData) return { admin: false, isSuper: false, permissions: [] };
    const { data } = await (context.supabase as any)
      .from("admin_access")
      .select("is_super, permissions")
      .eq("user_id", context.userId)
      .maybeSingle();
    const isSuper = Boolean(data?.is_super);
    const granted = ((data?.permissions as string[] | null) ?? []).filter((p) =>
      (ALL_ADMIN_PERMISSIONS as string[]).includes(p),
    ) as AdminPermission[];
    return {
      admin: true,
      isSuper,
      permissions: isSuper ? [...ALL_ADMIN_PERMISSIONS] : granted,
    };
  });

export type AdminAccountRow = {
  user_id: string;
  email: string | null;
  is_super: boolean;
  permissions: AdminPermission[];
};

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccountRow[]> => {
    await assertPermission(context.supabase, context.userId, "admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw internalError(error);
    const ids = (roles ?? []).map((r) => r.user_id as string);
    if (ids.length === 0) return [];
    const { data: access } = await (supabaseAdmin as any)
      .from("admin_access")
      .select("user_id, is_super, permissions")
      .in("user_id", ids);
    const accessMap = new Map((access ?? []).map((a: any) => [a.user_id as string, a]));
    const rows: AdminAccountRow[] = [];
    for (const id of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
      const a: any = accessMap.get(id);
      rows.push({
        user_id: id,
        email: u?.user?.email ?? null,
        is_super: Boolean(a?.is_super),
        permissions: ((a?.permissions as string[] | null) ?? []) as AdminPermission[],
      });
    }
    return rows.sort((x, y) => Number(y.is_super) - Number(x.is_super));
  });

export const setAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; isSuper: boolean; permissions: string[] }) => d)
  .handler(async ({ context, data }) => {
    await assertSuper(context.supabase, context.userId);
    if (data.userId === context.userId && !data.isSuper)
      throw new Error("Cannot remove your own main-admin status");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const permissions = data.permissions.filter((p) =>
      (ALL_ADMIN_PERMISSIONS as string[]).includes(p),
    );
    const { error } = await (supabaseAdmin as any)
      .from("admin_access")
      .upsert(
        { user_id: data.userId, is_super: data.isSuper, permissions, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw internalError(error);
    return { ok: true };
  });

export type AdminAnalytics = {
  kpis: {
    totalUsers: number;
    signups7d: number;
    signups30d: number;
    activeTrials: number;
    paid: number;
    expired: number;
    conversionRate: number; // paid / (paid + expired)
    attempts7d: number;
    tests7d: number;
  };
  signupsByDay: { day: string; count: number }[];
  attemptsByDay: { day: string; step1: number; step2: number; step3: number }[];
  qbankAccess: { qbank: string; trial: number; paid: number }[];
  countries: { country: string; count: number }[];
};

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAnalytics> => {
    const { supabase, userId } = context;
    await assertPermission(supabase, userId, "analytics");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const d7 = new Date(now - 7 * 86_400_000).toISOString();
    const d30 = new Date(now - 30 * 86_400_000).toISOString();

    // --- profiles / signups ---
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, created_at, country")
      .order("created_at", { ascending: false })
      .limit(50000);
    const profs = profiles ?? [];

    const signupsByDayMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      signupsByDayMap.set(d, 0);
    }
    let signups7d = 0;
    let signups30d = 0;
    for (const p of profs) {
      const iso = new Date(p.created_at as string).toISOString();
      if (iso >= d7) signups7d++;
      if (iso >= d30) {
        signups30d++;
        const day = iso.slice(0, 10);
        if (signupsByDayMap.has(day)) signupsByDayMap.set(day, (signupsByDayMap.get(day) ?? 0) + 1);
      }
    }
    const signupsByDay = Array.from(signupsByDayMap.entries()).map(([day, count]) => ({ day, count }));

    // --- entitlements ---
    const { data: ents } = await supabaseAdmin
      .from("user_entitlements")
      .select("user_id, plan, trial_ends_at, paid_until, qbank_access")
      .limit(50000);
    const rows = ents ?? [];
    let activeTrials = 0;
    let paid = 0;
    let expired = 0;
    const qbankMap: Record<string, { trial: number; paid: number }> = {
      "USMLE Step 1": { trial: 0, paid: 0 },
      "USMLE Step 2 CK": { trial: 0, paid: 0 },
      "USMLE Step 3": { trial: 0, paid: 0 },
    };
    const slugToLabel: Record<string, string> = {
      step1: "USMLE Step 1",
      step2: "USMLE Step 2 CK",
      step2ck: "USMLE Step 2 CK",
      step3: "USMLE Step 3",
    };
    for (const r of rows) {
      const isPaid = r.plan === "paid" && (!r.paid_until || new Date(r.paid_until as string).getTime() > now);
      const isTrial =
        r.plan === "trial" && r.trial_ends_at && new Date(r.trial_ends_at as string).getTime() > now;
      if (isPaid) paid++;
      else if (isTrial) activeTrials++;
      else expired++;

      const access = (r.qbank_access as string[] | null) ?? [];
      for (const slug of access) {
        const label = slugToLabel[slug] ?? slug;
        if (!qbankMap[label]) qbankMap[label] = { trial: 0, paid: 0 };
        if (isPaid) qbankMap[label].paid++;
        else if (isTrial) qbankMap[label].trial++;
      }
    }
    const qbankAccess = Object.entries(qbankMap).map(([qbank, v]) => ({ qbank, ...v }));

    // --- attempts / tests ---
    const { data: attempts } = await supabaseAdmin
      .from("attempts")
      .select("qbank_id, created_at")
      .gte("created_at", d30)
      .limit(200000);
    const at = attempts ?? [];
    const qbankNameById: Record<number, "step1" | "step2" | "step3"> = { 1: "step2", 2: "step1", 3: "step3" };
    const attemptsMap = new Map<string, { step1: number; step2: number; step3: number }>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
      attemptsMap.set(d, { step1: 0, step2: 0, step3: 0 });
    }
    let attempts7d = 0;
    for (const a of at) {
      const iso = new Date(a.created_at as string).toISOString();
      if (iso >= d7) attempts7d++;
      const day = iso.slice(0, 10);
      const bucket = attemptsMap.get(day);
      if (!bucket) continue;
      const key = qbankNameById[a.qbank_id as number];
      if (key) bucket[key]++;
    }
    const attemptsByDay = Array.from(attemptsMap.entries()).map(([day, v]) => ({ day, ...v }));

    const { count: tests7d } = await supabaseAdmin
      .from("tests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", d7);

    // --- countries ---
    const countryMap = new Map<string, number>();
    for (const p of profs) {
      const c = (p.country as string | null)?.trim() || "Unknown";
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
    }
    const countries = Array.from(countryMap.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const conversionRate = paid + expired > 0 ? paid / (paid + expired) : 0;

    return {
      kpis: {
        totalUsers: profs.length,
        signups7d,
        signups30d,
        activeTrials,
        paid,
        expired,
        conversionRate,
        attempts7d,
        tests7d: tests7d ?? 0,
      },
      signupsByDay,
      attemptsByDay,
      qbankAccess,
      countries,
    };
  });

// ============================================================================
// User management
// ============================================================================

export type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
  country: string | null;
  target_exam: string | null;
  created_at: string;
  plan: string | null;
  trial_ends_at: string | null;
  paid_until: string | null;
  qbank_access: string[];
  is_admin: boolean;
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: AdminUserRow[]; total: number }> => {
    await assertPermission(context.supabase, context.userId, "users");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(Math.max(data.limit ?? 50, 1), 200);
    const offset = Math.max(data.offset ?? 0, 0);
    const search = (data.search ?? "").trim().toLowerCase();

    // Pull auth users via admin API (paged). For search we filter after.
    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: Math.floor(offset / limit) + 1,
      perPage: search ? 1000 : limit,
    });
    if (authErr) throw new Error(authErr.message);
    let users = authList?.users ?? [];
    if (search) {
      users = users.filter((u) => (u.email ?? "").toLowerCase().includes(search));
      users = users.slice(offset % 1000, (offset % 1000) + limit);
    }
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return { rows: [], total: authList?.total ?? 0 };

    const [{ data: profs }, { data: ents }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, full_name, country, target_exam, created_at").in("id", ids),
      supabaseAdmin.from("user_entitlements").select("user_id, plan, trial_ends_at, paid_until, qbank_access").in("user_id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids).eq("role", "admin"),
    ]);

    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const entMap = new Map((ents ?? []).map((e) => [e.user_id, e]));
    const adminSet = new Set((roles ?? []).map((r) => r.user_id));

    const rows: AdminUserRow[] = users.map((u) => {
      const p = profMap.get(u.id);
      const e = entMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        display_name: p?.display_name ?? null,
        full_name: p?.full_name ?? null,
        country: p?.country ?? null,
        target_exam: p?.target_exam ?? null,
        created_at: (p?.created_at as string) ?? u.created_at,
        plan: e?.plan ?? null,
        trial_ends_at: (e?.trial_ends_at as string) ?? null,
        paid_until: (e?.paid_until as string) ?? null,
        qbank_access: normalizeQbankAccess(e?.qbank_access as string[] | null),
        is_admin: adminSet.has(u.id),
      };
    });

    return { rows, total: authList?.total ?? rows.length };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "users");
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw internalError(error);
    return { ok: true };
  });

export const updateEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    plan: "trial" | "paid" | "expired";
    trial_ends_at?: string | null;
    paid_until?: string | null;
    qbank_access?: string[];
  }) => d)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "users");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { plan: data.plan };
    if (data.trial_ends_at !== undefined) patch.trial_ends_at = data.trial_ends_at;
    if (data.paid_until !== undefined) patch.paid_until = data.paid_until;
    if (data.qbank_access !== undefined) patch.qbank_access = normalizeQbankAccess(data.qbank_access);
    const { error } = await supabaseAdmin
      .from("user_entitlements")
      .upsert({ user_id: data.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw internalError(error);
    return { ok: true };
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; admin: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "admins");
    if (data.userId === context.userId && !data.admin) throw new Error("Cannot demote yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.admin) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw internalError(error);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
      if (error) throw internalError(error);
    }
    return { ok: true };
  });

// ============================================================================
// Feedback management
// ============================================================================

export type AdminFeedbackRow = {
  id: string;
  user_id: string;
  email: string | null;
  qbank_id: number | null;
  question_id: number | null;
  message: string;
  is_technical: boolean;
  created_at: string;
};

export const listFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; offset?: number }) => d)
  .handler(async ({ context, data }): Promise<{ rows: AdminFeedbackRow[] }> => {
    await assertPermission(context.supabase, context.userId, "feedback");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(Math.max(data.limit ?? 100, 1), 500);
    const offset = Math.max(data.offset ?? 0, 0);
    const { data: fb, error } = await supabaseAdmin
      .from("feedback")
      .select("id, user_id, qbank_id, question_id, message, is_technical, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw internalError(error);
    const ids = Array.from(new Set((fb ?? []).map((f) => f.user_id)));
    const emailMap = new Map<string, string | null>();
    for (const uid of ids) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
      emailMap.set(uid, u?.user?.email ?? null);
    }
    return {
      rows: (fb ?? []).map((f) => ({
        id: f.id as string,
        user_id: f.user_id as string,
        email: emailMap.get(f.user_id as string) ?? null,
        qbank_id: f.qbank_id as number | null,
        question_id: f.question_id as number | null,
        message: f.message as string,
        is_technical: f.is_technical as boolean,
        created_at: f.created_at as string,
      })),
    };
  });

export const deleteFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "feedback");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback").delete().eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });

// ============================================================================
// Question management (edit / delete)
// ============================================================================

export type AdminQuestion = {
  id: number;
  qbank_id: number;
  title: string | null;
  question: string;
  explanation: string | null;
  correct_answer: number | null;
};

export const getQuestionForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { qbank_id: number; id: number }) => d)
  .handler(async ({ context, data }): Promise<AdminQuestion | null> => {
    await assertPermission(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q, error } = await supabaseAdmin
      .from("questions")
      .select("id, qbank_id, title, question, explanation, correct_answer")
      .eq("qbank_id", data.qbank_id)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw internalError(error);
    return (q as AdminQuestion) ?? null;
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    qbank_id: number;
    id: number;
    title?: string | null;
    question?: string;
    explanation?: string | null;
    correct_answer?: number | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase, context.userId, "questions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      title?: string | null;
      question?: string;
      explanation?: string | null;
      correct_answer?: number | null;
    } = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.question !== undefined) patch.question = data.question;
    if (data.explanation !== undefined) patch.explanation = data.explanation;
    if (data.correct_answer !== undefined) patch.correct_answer = data.correct_answer;
    const { error } = await supabaseAdmin
      .from("questions")
      .update(patch)
      .eq("qbank_id", data.qbank_id)
      .eq("id", data.id);
    if (error) throw internalError(error);
    return { ok: true };
  });
