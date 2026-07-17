import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ count: totalQ }, { data: subjects }, { data: attempts }, { count: bookmarks }] = await Promise.all([
      supabase.from("questions").select("*", { count: "exact", head: true }),
      supabase.from("subjects").select("id,name,count").order("id"),
      supabase.from("attempts").select("is_correct,question_id").eq("user_id", userId),
      supabase.from("bookmarks").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    const uniqueDone = new Set((attempts ?? []).map((a) => a.question_id)).size;
    const correct = (attempts ?? []).filter((a) => a.is_correct).length;
    const total = (attempts ?? []).length;
    return {
      totalQuestions: totalQ ?? 0,
      subjects: subjects ?? [],
      answered: uniqueDone,
      totalAttempts: total,
      correctAttempts: correct,
      accuracy: total ? Math.round((correct / total) * 100) : 0,
      bookmarks: bookmarks ?? 0,
    };
  });

export const getFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: subjects }, { data: systems }] = await Promise.all([
      context.supabase.from("subjects").select("id,name,count").order("name"),
      context.supabase.from("systems").select("id,name,count").order("name"),
    ]);
    return { subjects: subjects ?? [], systems: systems ?? [] };
  });

const CreateTestInput = z.object({
  subjectIds: z.array(z.number()).default([]),
  systemIds: z.array(z.number()).default([]),
  count: z.number().min(1).max(200).default(20),
  mode: z.enum(["practice", "test"]).default("practice"),
  scope: z.enum(["all", "unused", "incorrect", "bookmarked"]).default("all"),
});

export const createTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase.from("questions").select("id");
    if (data.subjectIds.length) query = query.in("subject_id", data.subjectIds);
    if (data.systemIds.length) query = query.in("system_id", data.systemIds);

    if (data.scope === "unused" || data.scope === "incorrect") {
      const { data: att } = await supabase.from("attempts").select("question_id,is_correct").eq("user_id", userId);
      const attempted = new Set((att ?? []).map((a) => a.question_id));
      const incorrect = new Set((att ?? []).filter((a) => !a.is_correct).map((a) => a.question_id));
      const { data: rows } = await query.limit(5000);
      let ids = (rows ?? []).map((r) => r.id);
      if (data.scope === "unused") ids = ids.filter((id) => !attempted.has(id));
      if (data.scope === "incorrect") ids = ids.filter((id) => incorrect.has(id));
      ids = shuffle(ids).slice(0, data.count);
      if (!ids.length) throw new Error("No questions match those filters.");
      return await insertTest(supabase, userId, ids, data);
    }
    if (data.scope === "bookmarked") {
      const { data: bm } = await supabase.from("bookmarks").select("question_id").eq("user_id", userId);
      const bmIds = new Set((bm ?? []).map((b) => b.question_id));
      const { data: rows } = await query.limit(5000);
      const ids = shuffle((rows ?? []).map((r) => r.id).filter((id) => bmIds.has(id))).slice(0, data.count);
      if (!ids.length) throw new Error("No bookmarked questions match those filters.");
      return await insertTest(supabase, userId, ids, data);
    }
    const { data: rows } = await query.limit(5000);
    const ids = shuffle((rows ?? []).map((r) => r.id)).slice(0, data.count);
    if (!ids.length) throw new Error("No questions match those filters.");
    return await insertTest(supabase, userId, ids, data);
  });

async function insertTest(supabase: any, userId: string, ids: number[], data: z.infer<typeof CreateTestInput>) {
  const { data: inserted, error } = await supabase
    .from("tests")
    .insert({ user_id: userId, question_ids: ids, mode: data.mode })
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted.id as number };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const getTest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: test, error } = await supabase.from("tests").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error || !test) throw new Error("Test not found");
    const { data: questions } = await supabase
      .from("questions")
      .select("id,title,question,explanation,correct_answer,subject_id,system_id")
      .in("id", test.question_ids);
    const { data: answers } = await supabase
      .from("answers")
      .select("id,question_id,answer_index,answer_text")
      .in("question_id", test.question_ids)
      .order("answer_index");
    const { data: attempts } = await supabase
      .from("attempts")
      .select("question_id,selected_answer,is_correct")
      .eq("user_id", userId)
      .eq("test_id", data.id);
    const { data: bookmarks } = await supabase.from("bookmarks").select("question_id").eq("user_id", userId).in("question_id", test.question_ids);
    return {
      test,
      questions: (test.question_ids as number[]).map((id) => (questions ?? []).find((q) => q.id === id)!).filter(Boolean),
      answersByQ: groupBy(answers ?? [], (a) => a.question_id),
      attemptsByQ: Object.fromEntries((attempts ?? []).map((a) => [a.question_id, a])),
      bookmarkedIds: new Set((bookmarks ?? []).map((b) => b.question_id)),
    };
  });

function groupBy<T, K extends string | number>(arr: T[], fn: (x: T) => K): Record<K, T[]> {
  const out: Record<string, T[]> = {};
  for (const x of arr) {
    const k = String(fn(x));
    (out[k] ??= []).push(x);
  }
  return out as Record<K, T[]>;
}

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    testId: z.number(),
    questionId: z.number(),
    selectedIndex: z.number(),
    timeSeconds: z.number().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q } = await supabase.from("questions").select("correct_answer").eq("id", data.questionId).single();
    if (!q) throw new Error("Question not found");
    const isCorrect = q.correct_answer === data.selectedIndex;
    // Upsert attempt: delete prior then insert
    await supabase.from("attempts").delete().eq("user_id", userId).eq("test_id", data.testId).eq("question_id", data.questionId);
    await supabase.from("attempts").insert({
      user_id: userId, test_id: data.testId, question_id: data.questionId,
      selected_answer: data.selectedIndex, is_correct: isCorrect, time_seconds: data.timeSeconds,
    });
    // Update tallies
    const { data: attempts } = await supabase.from("attempts").select("is_correct").eq("test_id", data.testId).eq("user_id", userId);
    const right = (attempts ?? []).filter((a) => a.is_correct).length;
    const wrong = (attempts ?? []).filter((a) => a.is_correct === false).length;
    await supabase.from("tests").update({ right_count: right, wrong_count: wrong }).eq("id", data.testId).eq("user_id", userId);
    return { isCorrect, correctAnswer: q.correct_answer };
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ questionId: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("bookmarks").select("question_id").eq("user_id", userId).eq("question_id", data.questionId).maybeSingle();
    if (existing) {
      await supabase.from("bookmarks").delete().eq("user_id", userId).eq("question_id", data.questionId);
      return { bookmarked: false };
    }
    await supabase.from("bookmarks").insert({ user_id: userId, question_id: data.questionId });
    return { bookmarked: true };
  });

export const finishTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ testId: z.number() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("tests").update({ done: true }).eq("id", data.testId).eq("user_id", userId);
    return { ok: true };
  });

export const listTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("tests")
      .select("id,mode,question_ids,right_count,wrong_count,done,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((t) => ({ ...t, total: (t.question_ids as number[]).length }));
  });

export const listBookmarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: bm } = await context.supabase.from("bookmarks").select("question_id,created_at").eq("user_id", context.userId).order("created_at", { ascending: false });
    const ids = (bm ?? []).map((b) => b.question_id);
    if (!ids.length) return [];
    const { data: qs } = await context.supabase.from("questions").select("id,title,subject_id,system_id").in("id", ids);
    return (bm ?? []).map((b) => ({ ...b, question: (qs ?? []).find((q) => q.id === b.question_id) }));
  });
